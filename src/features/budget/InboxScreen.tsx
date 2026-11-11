import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { FormField } from '../../components/FormField'
import { Icon } from '../../components/Icon'
import { PickerSelect } from '../../components/PickerSelect'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { D } from '../../engine'
import { MAX_NOTE, categoryName, instrumentLabel, modeLabel, type BudgetData } from '../../lib/budget'
import { pendingItems, recentlyAuto, suggestionConfirmed, type InboxItem } from '../../lib/inbox'
import { drainNow, smsPort } from '../../store/smsRuntime'
import { CaptureExplainer } from './CaptureExplainer'
import { IgnoreSheet, canIgnore, type IgnoreTarget } from './IgnoreSheet'
import { GuardedFooter, categoryPickOptions, useDiscardGuard } from './formKit'
import { ExpenseSheet } from './sheets'
import { shortDate, useMoney } from './SpendSummary'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const nameOf = (i: Pick<InboxItem, 'merchant' | 'bank'>) => i.merchant || (i.bank ? `${i.bank} payment` : 'Bank payment')

/** How it was paid, in words: "UPI · HDFC Salary ••1234", or the bank and digits when the card is not in your list yet. */
function routeOf(budget: BudgetData, i: Pick<InboxItem, 'mode' | 'instrumentId' | 'bank' | 'last4'>): string {
  const inst = i.instrumentId ? budget.instruments.find((x) => x.id === i.instrumentId) : undefined
  return [i.mode ? modeLabel(i.mode) : '', inst ? instrumentLabel(inst) : i.bank && i.last4 ? `${i.bank} ••${i.last4}` : ''].filter(Boolean).join(' · ')
}

/** A saved card's name, as the person knows it. */
const routeCard = (budget: BudgetData, id: string): string | undefined => {
  const inst = budget.instruments.find((x) => x.id === id)
  return inst ? instrumentLabel(inst) : undefined
}

/** Pick another category and/or add a note, then approve. Same sheet rules as every form (docs/FORMS-AND-SHEETS.md). */
function ChangeSheet({ item, onClose }: { item: InboxItem; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const approve = useApp((s) => s.approveInbox)
  const toast = useApp((s) => s.toast)
  const store = useAppStore()
  const money = useMoney()
  const [cat, setCat] = useState(item.categoryId ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const guard = useDiscardGuard(note.trim() !== '' || cat !== (item.categoryId ?? ''), onClose)
  const save = () => {
    if (approve(item.id, { categoryId: cat || null, note })) {
      toast(`Added ${money(new D(item.amount))}${cat ? ` to ${categoryName(budget, cat)}` : ''}`)
      return onClose()
    }
    setError(store.getState().notice?.text ?? 'Could not add this one')
  }
  return (
    <Sheet
      title="Change, then approve"
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard your changes?">
          <button type="button" className="btn btn--primary" onClick={save}>Approve</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <p className="budget__note">{[money(new D(item.amount)), nameOf(item), shortDate(item.date), routeOf(budget, item)].filter(Boolean).join(' · ')}</p>
        <FormField label="Category" htmlFor="inbox-cat">
          <PickerSelect id="inbox-cat" label="Category" title="Category" value={cat} placeholder="Uncategorised" options={[{ value: '', label: 'Uncategorised' }, ...categoryPickOptions(budget)]} onChange={(v) => { setCat(v); setError(null) }} />
        </FormField>
        <FormField label="Note" htmlFor="inbox-note" hint="Optional. Added after the payee's name" error={error}>
          <input id="inbox-note" className="field" value={note} maxLength={MAX_NOTE - 60} autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={error ? 'inbox-note-msg' : undefined} onChange={(e) => { setNote(e.target.value); setError(null) }} onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
        </FormField>
      </div>
    </Sheet>
  )
}

/**
 * The Inbox: bank payments the phone caught, waiting for a tap. One row per payment. Nothing here is in your budget until you approve it.
 * In Auto mode it also lists what the app added by itself in the last 14 days, each with one-tap Undo.
 */
export function InboxScreen({ onBack }: { onBack: () => void }) {
  useBackHandler(true, onBack)
  const budget = useApp((s) => s.budget)
  const capture = useApp((s) => s.settings.smsCapture)
  const paused = useApp((s) => s.settings.smsAutoPausedAt)
  const mode = useApp((s) => s.settings.smsMode)
  const update = useApp((s) => s.updateSettings)
  const approve = useApp((s) => s.approveInbox)
  const approveSuggested = useApp((s) => s.approveSuggested)
  const reject = useApp((s) => s.rejectInbox)
  const undoAuto = useApp((s) => s.undoAutoAdded)
  const toast = useApp((s) => s.toast)
  const store = useAppStore()
  const money = useMoney()

  const [changing, setChanging] = useState<InboxItem | null>(null)
  const [full, setFull] = useState<InboxItem | null>(null)
  const [explain, setExplain] = useState(false)
  const [ignoring, setIgnoring] = useState<IgnoreTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const pending = pendingItems(budget)
  const ready = pending.filter((i) => suggestionConfirmed(budget, i))
  const auto = recentlyAuto(budget, Date.now())

  const check = async () => {
    if (busy || !capture) return
    setBusy(true)
    const r = await drainNow()
    setBusy(false)
    setStatus(
      r.status === 'unsaved' ? 'New messages were found but could not be saved yet. They are safe on the phone and will be tried again.'
      : r.status === 'failed' ? 'Could not check for new messages. Try again.'
      : r.held > 0 ? `${plural(r.held, 'more message is', 'more messages are')} waiting on the phone. Review some here to make room.`
      : r.pending + r.auto > 0 ? `Found ${plural(r.pending + r.auto, 'new payment', 'new payments')}.` : 'No new bank payments.',
    )
  }
  // Opening the Inbox checks for anything new (the app also checks whenever it opens or comes back).
  useEffect(() => { void check() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pull down from the top to check again.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    let y0: number | null = null
    const start = (e: TouchEvent) => { y0 = el.scrollTop <= 0 ? (e.touches[0]?.clientY ?? null) : null }
    const end = (e: TouchEvent) => {
      const y1 = e.changedTouches[0]?.clientY
      if (y0 !== null && y1 !== undefined && y1 - y0 > 80) void check()
      y0 = null
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchend', end, { passive: true })
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end) }
  })

  const approveOne = (i: InboxItem) => {
    // A card bill needs its card picked, so it opens the full sheet. So does anything that cannot be added as it is.
    if (i.kind === 'cardBill') return setFull(i)
    if (approve(i.id)) return toast(`Added ${money(new D(i.amount))}${i.categoryId ? ` to ${categoryName(budget, i.categoryId)}` : ''}`)
    toast(store.getState().notice?.text ?? 'Could not add this one. Tap Change to fix it.')
  }
  const approveAll = () => {
    const n = approveSuggested()
    if (n === 0) toast('Nothing to approve')
  }

  const row = (i: InboxItem) => {
    const route = routeOf(budget, i)
    const what = i.kind === 'cardBill' ? 'Card bill, not spending' : i.categoryId ? categoryName(budget, i.categoryId) : 'No category yet'
    const name = nameOf(i)
    const note = [i.why, i.person && mode === 'auto' ? 'Looks like a person, so it is never added without you.' : ''].filter(Boolean).join(' ')
    return (
      <div key={i.id} className="budget__entry import__row inbox__item">
        <button type="button" className="budget__main tap-row" aria-label={`Change ${money(new D(i.amount))} ${name}`} onClick={() => (i.kind === 'cardBill' ? setFull(i) : setChanging(i))}>
          <span className="budget__amt spend__amt">{money(new D(i.amount))}</span>
          <span className="row__label">{name}</span>
          <Icon name="chevron" size={18} className="tap-row__chev" />
          <span className="row__hint">{[shortDate(i.date), route, what].filter(Boolean).join(' · ')}</span>
        </button>
        {note && <p className="inbox__why">{note}</p>}
        <div className="inbox__acts">
          <button type="button" className="btn btn--primary" aria-label={`${i.kind === 'cardBill' ? 'Review' : 'Approve'} ${money(new D(i.amount))} ${name}`} onClick={() => approveOne(i)}>{i.kind === 'cardBill' ? 'Review' : 'Approve'}</button>
          {i.kind === 'spend' && <button type="button" className="btn" aria-label={`Change ${money(new D(i.amount))} ${name}`} onClick={() => setChanging(i)}>Change</button>}
          <button type="button" className="link-btn" aria-label={`${money(new D(i.amount))} ${name} is not a spend`} onClick={() => reject(i.id, true)}>Not a spend</button>
          <button type="button" className="link-btn link-btn--danger" aria-label={`Reject ${money(new D(i.amount))} ${name}`} onClick={() => reject(i.id)}>Reject</button>
          {canIgnore({ last4: i.last4, bank: i.bank, sender: i.sender ?? null }) && (
            <button type="button" className="link-btn" aria-label={`Ignore messages like ${money(new D(i.amount))} ${name}`} onClick={() => setIgnoring({ last4: i.last4, bank: i.bank, sender: i.sender ?? null, cardName: i.instrumentId ? routeCard(budget, i.instrumentId) : undefined })}>Ignore</button>
          )}
        </div>
      </div>
    )
  }

  const empty = pending.length === 0 && auto.length === 0

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="To review">
      <ScreenHeader title="To review" onBack={onBack} />
      <div className="screen__body" ref={bodyRef}>
        {paused !== null && (
          <p className="note" role="status">
            Auto-add switched itself off because 2 of the last 10 payments it added were undone or changed. New payments wait here for you.{' '}
            <button type="button" className="link-btn" onClick={() => update({ smsAutoPausedAt: null })}>Got it</button>
          </p>
        )}
        {empty ? (
          <EmptyState
            level="h2"
            title={capture ? 'Nothing to review' : 'Bank payments, caught for you'}
            action={
              capture ? <button type="button" className="btn" onClick={() => void check()}>{busy ? 'Checking…' : 'Check for new messages'}</button>
              : smsPort() ? <button type="button" className="btn btn--primary" onClick={() => setExplain(true)}>Capture bank messages</button> : undefined
            }
          >
            {capture ? 'New bank payments show up here. Calc checks whenever you open the app. Nothing is added to your budget until you approve it.' : 'Turn on capture and Calc catches bank payments while the app is closed. They wait here until you approve them.'}
          </EmptyState>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="sect" aria-label="Waiting for you">
                <h2 className="sect__head"><span>Waiting for you</span><span className="sect__count">{pending.length}</span></h2>
                {ready.length > 0 && (
                  <div className="inbox__all">
                    <button type="button" className="btn" onClick={approveAll}>Approve all suggested ({ready.length})</button>
                    <p className="manage__help">{plural(ready.length, 'payment matches', 'payments match')} a payee you have tagged the same way twice in a row.</p>
                  </div>
                )}
                <div className="sect__body">{pending.map(row)}</div>
              </section>
            )}
            {auto.length > 0 && (
              <section className="sect" aria-label="Recently auto-added">
                <h2 className="sect__head"><span>Recently auto-added</span><span className="sect__count">{auto.length}</span></h2>
                <div className="sect__body">
                  {auto.map(({ item, entry }) => (
                    <div key={item.id} className="budget__entry import__row">
                      <span className="budget__main">
                        <span className="budget__amt spend__amt">{money(new D(entry.amount))}</span>
                        <span className="row__label">{nameOf(item)}</span>
                        <span className="row__hint">{[shortDate(entry.date), routeOf(budget, item), categoryName(budget, entry.categoryId)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <div className="import__acts">
                        <button type="button" className="link-btn" aria-label={`Undo ${money(new D(entry.amount))} ${nameOf(item)}`} onClick={() => undoAuto(item.id)}>Undo</button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="manage__help">Added without a tap because you tagged these payees the same way twice. Undo removes the entry and makes Calc ask again.</p>
              </section>
            )}
            {capture && <button type="button" className="link-btn spend__link" onClick={() => void check()}>{busy ? 'Checking…' : 'Check for new messages'}</button>}
          </>
        )}
        {status && <p className="manage__help" role="status">{status}</p>}
      </div>
      {changing && <ChangeSheet item={changing} onClose={() => setChanging(null)} />}
      {full && (
        <ExpenseSheet
          prefill={{ amount: full.amount, categoryId: full.categoryId, mode: full.mode, instrumentId: full.kind === 'cardBill' ? null : full.instrumentId, date: full.date, note: nameOf(full), settlement: full.kind === 'cardBill' ? 'cardBill' : null }}
          onSaved={() => store.getState().markInboxDone(full.id)}
          onClose={() => setFull(null)}
        />
      )}
      {explain && <CaptureExplainer onClose={() => setExplain(false)} />}
      {ignoring && <IgnoreSheet target={ignoring} onClose={() => setIgnoring(null)} />}
    </div>
  )
}
