import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { FormField } from '../../components/FormField'
import { PickerSelect } from '../../components/PickerSelect'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { D } from '../../engine'
import { MAX_NOTE, categoryName, instrumentLabel, modeLabel, type BudgetData } from '../../lib/budget'
import { captureStatus } from '../../lib/captureStatus'
import type { SmsPermission } from '../../lib/smsQueue'
import { jumpToSettingsSection } from '../../lib/settingsJump'
import { pendingItems, recentlyAuto, suggestionConfirmed, type InboxItem } from '../../lib/inbox'
import type { CategoryGroup, PayeeGroup } from '../../lib/groupItems'
import { categoryFor, reviewSections } from '../../lib/inboxView'
import { drainNow, smsPort } from '../../store/smsRuntime'
import { CaptureExplainer } from './CaptureExplainer'
import { IgnoreSheet, canIgnore, type IgnoreTarget } from './IgnoreSheet'
import { GuardedFooter, categoryPickOptions, useDiscardGuard } from './formKit'
import { ExpenseSheet } from './sheets'
import { ActRow, CatHead, MoreSheet, PayeeKindChoice, RvMain, groupIsOpen, isOwnMoney, mergedOf, ownWhyOf, plural } from './ReviewKit'
import { shortDate, useMoney } from './SpendSummary'

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

/** Pick the category for every payment of one payee, then approve them all (each still its own entry). Starts empty: this is an explicit choice. */
function GroupSheet({ label, ids, total, onClose }: { label: string; ids: string[]; total: string; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const approveGroup = useApp((s) => s.approveGroup)
  const toast = useApp((s) => s.toast)
  const [cat, setCat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const guard = useDiscardGuard(cat !== '', onClose)
  const save = () => {
    if (cat === '') return setError('Pick a category first')
    const n = approveGroup(ids, cat)
    if (n > 0) {
      toast(`Added ${plural(n, 'payment', 'payments')} to ${categoryName(budget, cat)}`)
      return onClose()
    }
    setError('Could not add these. Try Change on one of them')
  }
  return (
    <Sheet
      title={`Category for all ${ids.length}`}
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard your choice?">
          <button type="button" className="btn btn--primary" onClick={save}>Approve all {ids.length}</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <p className="budget__note">{label} · {plural(ids.length, 'payment', 'payments')} · {total}. Each one is added as its own entry.</p>
        <FormField label="Category" htmlFor="inbox-group-cat" required error={error}>
          <PickerSelect id="inbox-group-cat" label="Category" title="Category" value={cat} placeholder="Pick a category" options={categoryPickOptions(budget)} onChange={(v) => { setCat(v); setError(null) }} />
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
  const setOverlay = useApp((s) => s.setOverlay)
  const approve = useApp((s) => s.approveInbox)
  const approveSuggested = useApp((s) => s.approveSuggested)
  const reject = useApp((s) => s.rejectInbox)
  const approveGroup = useApp((s) => s.approveGroup)
  const rejectGroup = useApp((s) => s.rejectGroup)
  const undoAuto = useApp((s) => s.undoAutoAdded)
  const toast = useApp((s) => s.toast)
  const store = useAppStore()
  const money = useMoney()

  const [changing, setChanging] = useState<InboxItem | null>(null)
  const [full, setFull] = useState<InboxItem | null>(null)
  const [explain, setExplain] = useState(false)
  const [openClubs, setOpenClubs] = useState<ReadonlySet<string>>(new Set())
  const [clubSheet, setClubSheet] = useState<{ label: string; ids: string[]; total: string } | null>(null)
  const [ignoring, setIgnoring] = useState<IgnoreTarget | null>(null)
  const [more, setMore] = useState<InboxItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // What Android allows, so an empty list can say why it may stay empty.
  const [perm, setPerm] = useState<SmsPermission | null>(null)
  useEffect(() => {
    const port = smsPort()
    if (port) void port.permission().then(setPerm, () => setPerm('unavailable'))
  }, [capture])

  const pending = pendingItems(budget)
  // Money that looks like the person's own never takes part in a bulk approve, and is listed on its own after "Not sure".
  const { sections, cardBills, own: ownMoney } = reviewSections(budget, pending)
  const ready = pending.filter((i) => !isOwnMoney(i) && suggestionConfirmed(budget, i))
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

  const ignoreTarget = (i: InboxItem): IgnoreTarget => ({ last4: i.last4, bank: i.bank, sender: i.sender ?? null, cardName: i.instrumentId ? routeCard(budget, i.instrumentId) : undefined })

  // One payment. `kid` = it sits under a repeat payee, so the date leads (the name is already in the header above).
  const row = (i: InboxItem, kid = false) => {
    const route = routeOf(budget, i)
    const cf = categoryFor(budget, i)
    const what = i.kind === 'cardBill' ? 'Card bill, not spending' : cf.categoryId ? `${categoryName(budget, cf.categoryId)}${cf.guess ? ' · guess' : ''}` : 'No category yet'
    const name = nameOf(i)
    const own = isOwnMoney(i)
    // Under a repeat payee the header already says the category and why, so a payment does not repeat it.
    const note = [own ? ownWhyOf(i) : kid ? '' : i.why, i.person && mode === 'auto' ? 'Looks like a person, so it is never added without you.' : ''].filter(Boolean).join(' ')
    const amt = money(new D(i.amount))
    const bill = i.kind === 'cardBill'
    // Own money that CAME IN can never become an expense, so it has no Change.
    const cameIn = i.direction === 'in'
    const askWho = !kid && (i.person || (own && i.ownKind === 'selfTransfer'))
    return (
      <div key={i.id} className="rv__item inbox__item">
        <RvMain
          name={kid ? shortDate(i.date) : name}
          amount={cameIn ? `+${amt}` : amt}
          meta={[kid ? '' : shortDate(i.date), route].filter(Boolean).join(' · ')}
          merged={mergedOf(i)}
          chip={kid || own ? undefined : what}
          label={`Change ${amt} ${name}`}
          onClick={() => (bill ? setFull(i) : setChanging(i))}
        />
        {note && <p className="rv__why">{note}</p>}
        <ActRow className="inbox__acts">
          {own ? (
            <button type="button" className="btn btn--primary" aria-label={`${amt} ${name} is not a spend`} onClick={() => reject(i.id, true)}>Not a spend</button>
          ) : (
            <button type="button" className="btn btn--primary" aria-label={`${bill ? 'Review' : 'Approve'} ${amt} ${name}`} onClick={() => approveOne(i)}>{bill ? 'Review' : 'Approve'}</button>
          )}
          {i.kind === 'spend' && !cameIn && <button type="button" className="btn" aria-label={`Change ${amt} ${name}`} onClick={() => setChanging(i)}>Change</button>}
          <button type="button" className="btn" aria-label={`Reject ${amt} ${name}`} onClick={() => reject(i.id)}>Reject</button>
          <button type="button" className="btn" aria-label={`More for ${amt} ${name}`} aria-haspopup="dialog" onClick={() => setMore(i)}>More</button>
        </ActRow>
        {askWho && <PayeeKindChoice merchant={i.merchant} />}
      </div>
    )
  }

  const toggleClub = (k: string) => setOpenClubs((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  /** One payee with 2 or more payments waiting: one header row that opens (closed from 3 payments up), with Approve all and Reject all. Each payment stays its own entry. */
  const club = (g: PayeeGroup<InboxItem>, sec: CategoryGroup<InboxItem>) => {
    const k = `${sec.categoryId ?? ''}|${g.key}`
    const n = g.items.length
    const isOpen = groupIsOpen(n, openClubs.has(k))
    const ids = g.items.map((i) => i.id)
    const cat = sec.categoryId
    const guess = g.items.some((i) => categoryFor(budget, i).guess)
    const person = g.items.some((i) => i.person)
    const name = g.label || 'Bank payment'
    const total = money(g.total)
    return (
      <div key={k} className="rv__group inbox__club">
        <RvMain
          name={`${name} ×${n}`}
          amount={total}
          meta={[plural(n, 'payment', 'payments'), cat ? `${categoryName(budget, cat)}${guess ? ' · guess' : ''}` : 'No category yet'].join(' · ')}
          label={`${name}, ${plural(n, 'payment', 'payments')}, ${total}. ${isOpen ? 'Hide' : 'Show'} them`}
          expanded={isOpen}
          onClick={() => toggleClub(k)}
        />
        <ActRow>
          {cat !== null && !person ? (
            <button type="button" className="btn btn--primary" aria-label={`Approve all ${n} ${name} as ${categoryName(budget, cat)}`} onClick={() => { if (approveGroup(ids, cat) === 0) toast('Could not add these. Open them and tap Change.') }}>Approve all {n}</button>
          ) : (
            <button type="button" className="btn btn--primary" aria-label={`Choose a category for all ${n} ${name}`} onClick={() => setClubSheet({ label: name, ids, total })}>Choose category</button>
          )}
          <button type="button" className="btn" aria-label={`Reject all ${n} ${name}`} onClick={() => rejectGroup(ids)}>Reject all</button>
        </ActRow>
        {person && <PayeeKindChoice merchant={g.label} />}
        {isOpen && <div className="rv__kids">{[...g.items].sort((a, b) => b.date.localeCompare(a.date)).map((i) => row(i, true))}</div>}
      </div>
    )
  }

  const section = (sec: CategoryGroup<InboxItem>) => {
    const name = sec.categoryId === null ? 'Not sure' : categoryName(budget, sec.categoryId)
    return (
      <div key={sec.categoryId ?? 'none'} role="group" aria-label={name} className="rv__section">
        <CatHead hook="inbox__cathead" name={name} meta={sec.payees.length > 1 ? `${plural(sec.count, 'payment', 'payments')} · ${money(sec.total)}` : undefined} />
        {sec.payees.map((g) => (g.items.length > 1 ? club(g, sec) : row(g.items[0]!)))}
      </div>
    )
  }
  const ownSection = ownMoney.length > 0 && (
    <div key="own" role="group" aria-label="Your own money" className="rv__section">
      <CatHead hook="inbox__cathead" name="Your own money" meta={plural(ownMoney.length, 'payment', 'payments')} />
      <p className="rv__hint">These look like moves between your own accounts. Not a spend is the usual answer, and they are never approved in bulk.</p>
      {ownMoney.map((i) => row(i))}
    </div>
  )
  // Right after "Not sure" (which is always first when it exists).
  const sectionsOut = sections.flatMap((sec, idx) => (idx === 0 && sec.categoryId === null ? [section(sec), ownSection] : idx === 0 ? [ownSection, section(sec)] : [section(sec)]))
  if (sections.length === 0 && ownSection) sectionsOut.push(ownSection)

  const empty = pending.length === 0 && auto.length === 0

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="To review">
      <ScreenHeader
        title="To review"
        onBack={onBack}
        action={<button type="button" className="link-btn" aria-label="Bank message settings" onClick={() => { jumpToSettingsSection('bank'); setOverlay('settings') }}>Settings</button>}
      />
      <div className="screen__body" ref={bodyRef}>
        {paused !== null && (
          <p className="note" role="status">
            Auto-add switched itself off because 2 of the last 10 payments it added were undone or changed. New payments wait here for you.{' '}
            <button type="button" className="link-btn" onClick={() => update({ smsAutoPausedAt: null })}>Got it</button>
          </p>
        )}
        {empty ? (
          <>
            <EmptyState
              level="h2"
              title={capture ? 'Nothing to review' : 'Bank payments, caught for you'}
              action={
                capture ? <button type="button" className="btn" onClick={() => void check()}>{busy ? 'Checking…' : 'Check for new messages'}</button>
                : smsPort() ? <button type="button" className="btn btn--primary" onClick={() => setExplain(true)}>Capture bank messages</button> : undefined
              }
            >
              {capture ? 'Bank messages are caught while Calc is closed and wait here when you open it. Nothing yet.' : 'Turn on capture and Calc catches bank payments while the app is closed. They wait here until you approve them.'}
            </EmptyState>
            <p className="manage__help">{captureStatus({ hasPort: smsPort() !== null, capture, mode, perm })}</p>
          </>
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
                <div className="sect__body">
                  {sectionsOut}
                  {cardBills.length > 0 && (
                    <div role="group" aria-label="Card bills" className="rv__section">
                      <CatHead hook="inbox__cathead" name="Card bills" meta={plural(cardBills.length, 'payment', 'payments')} />
                      {cardBills.map((i) => row(i))}
                    </div>
                  )}
                </div>
              </section>
            )}
            {auto.length > 0 && (
              <section className="sect" aria-label="Recently auto-added">
                <h2 className="sect__head"><span>Recently auto-added</span><span className="sect__count">{auto.length}</span></h2>
                <div className="sect__body">
                  {auto.map(({ item, entry }) => (
                    <div key={item.id} className="rv__item">
                      <div className="rv__main">
                        <span className="rv__name">{nameOf(item)}</span>
                        <span className="rv__amt">{money(new D(entry.amount))}</span>
                        <span className="rv__meta"><span>{[shortDate(entry.date), routeOf(budget, item), categoryName(budget, entry.categoryId)].filter(Boolean).join(' · ')}</span></span>
                      </div>
                      <ActRow>
                        <button type="button" className="btn" aria-label={`Undo ${money(new D(entry.amount))} ${nameOf(item)}`} onClick={() => undoAuto(item.id)}>Undo</button>
                      </ActRow>
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
      {clubSheet && <GroupSheet {...clubSheet} onClose={() => setClubSheet(null)} />}
      {changing && <ChangeSheet item={changing} onClose={() => setChanging(null)} />}
      {full && (
        <ExpenseSheet
          prefill={{ amount: full.amount, categoryId: full.categoryId, mode: full.mode, instrumentId: full.kind === 'cardBill' ? null : full.instrumentId, date: full.date, note: nameOf(full), settlement: full.kind === 'cardBill' ? 'cardBill' : null }}
          onSaved={() => store.getState().markInboxDone(full.id)}
          onClose={() => setFull(null)}
        />
      )}
      {explain && <CaptureExplainer onClose={() => setExplain(false)} />}
      {more && (
        <MoreSheet
          title={`More: ${nameOf(more)}`}
          onNotSpend={() => reject(more.id, true)}
          onIgnore={canIgnore({ last4: more.last4, bank: more.bank, sender: more.sender ?? null }) ? () => setIgnoring(ignoreTarget(more)) : undefined}
          onClose={() => setMore(null)}
        />
      )}
      {ignoring && <IgnoreSheet target={ignoring} onClose={() => setIgnoring(null)} />}
    </div>
  )
}
