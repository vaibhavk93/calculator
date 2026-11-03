import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { PickerSelect } from '../../components/PickerSelect'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import { D } from '../../engine'
import { INSTRUMENT_KINDS, categoryName, instrumentLabel, modeLabel, suggestFor } from '../../lib/budget'
import { buildStatementCandidates } from '../../lib/statementParse'
import { copyText } from '../../lib/device'
import { addToParseLog, clearParseLog, loadParseLog, logSalt, readBankMessages, smsSupported } from '../../lib/sms'
import { attachInstrument, buildCandidates, logAsText, newInstruments, type Candidate, type ParseLogEntry, type ScanResult } from '../../lib/smsParse'
import { Segmented } from '../settings/controls'
import { ExpenseSheet } from './sheets'
import { shortDate, useMoney } from './SpendSummary'

const DAYS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * "Add from messages": reads bank text messages ON THIS PHONE when the user taps Scan, lists the payments it found and lets
 * the user add or skip each one. Nothing is saved without a tap. The message text is never stored; see docs/SMS-CAPTURE.md.
 */
export function ImportScreen({ onBack }: { onBack: () => void }) {
  useBackHandler(true, onBack)
  const budget = useApp((s) => s.budget)
  const add = useApp((s) => s.addExpense)
  const markSeen = useApp((s) => s.markSmsSeen)
  const toast = useApp((s) => s.toast)
  const store = useAppStore()
  const money = useMoney()

  const [days, setDays] = useState('30')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [edit, setEdit] = useState<Candidate | null>(null)
  const [showDupes, setShowDupes] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [logCount, setLogCount] = useState(0)
  const [stmtFor, setStmtFor] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void loadParseLog().then((l) => setLogCount(l.length)) }, [logOpen])

  const CONSENT_KEY = 'vkcalc.smsConsent'
  const [consent, setConsent] = useState(false)
  const wantScan = () => {
    let known = false
    try { known = localStorage.getItem(CONSENT_KEY) === '1' } catch { /* ask again */ }
    if (known || !smsSupported()) void scan()
    else setConsent(true)
  }

  const scan = async () => {
    setBusy(true)
    setMessage(null)
    const r = await readBankMessages(Number(days))
    if (!r.ok) {
      setBusy(false)
      setResult(null)
      setMessage(
        r.reason === 'unsupported' ? 'Reading messages works only in the Android app.' : r.reason === 'denied'
          ? 'Calc was not allowed to read messages. You can allow it in Android Settings > Apps > Calc > Permissions, then scan again.'
          : 'Could not read the messages. Try again.',
      )
      return
    }
    const s = store.getState()
    const res = buildCandidates(r.messages, s.budget, (note) => suggestFor(s.budget, note), await logSalt())
    setResult(res)
    void addToParseLog(res.log).then((l) => setLogCount(l.length))
    setBusy(false)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    if (file.size > 5_000_000) return setMessage('That file is too big for a statement (over 5 MB).')
    if (/\.pdf$/i.test(file.name)) return setMessage('PDF statements are not supported yet. Download the statement as CSV from your bank site and pick that.')
    const s = store.getState()
    const r = buildStatementCandidates(await file.text(), s.budget, stmtFor || null, (note) => suggestFor(s.budget, note))
    if (!r.ok) { setResult(null); return setMessage(r.message) }
    setResult(r.result)
  }

  const addInstrument = useApp((s) => s.addInstrument)
  const addCard = (n: { bank: string; last4: string; kind: 'credit' | 'debit' | 'bank' | 'wallet' }) => {
    const id = addInstrument({ name: n.bank, kind: n.kind, bank: n.bank, last4: n.last4 })
    const inst = id ? store.getState().budget.instruments.find((i) => i.id === id) : undefined
    if (!inst) return
    setResult((r) => (r ? { ...r, found: attachInstrument(r.found, inst, n.bank, n.last4) } : r))
    toast(`Added ${instrumentLabel(inst)}`)
  }

  const drop = (id: string) => setResult((r) => (r ? { ...r, found: r.found.filter((c) => c.id !== id) } : r))
  const draftOf = (c: Candidate) => ({
    amount: c.amount,
    categoryId: c.categoryId,
    mode: c.mode,
    instrumentId: c.kind === 'cardBill' ? null : c.instrumentId,
    date: c.date,
    note: c.merchant || (c.bank ? `${c.bank} payment` : 'Bank payment'),
    settlement: c.kind === 'cardBill' ? ('cardBill' as const) : null,
  })
  // One tap adds it when everything needed is known. A card bill needs the card picked, so it opens the sheet.
  const quickAdd = (c: Candidate) => {
    if (c.kind === 'cardBill' || !add(draftOf(c))) return setEdit(c)
    markSeen([c.id])
    drop(c.id)
    toast(`Added ${money(new D(c.amount))}`)
  }
  const skip = (c: Candidate) => {
    markSeen([c.id])
    drop(c.id)
    toast('Skipped. It will not show again.')
  }

  const fresh = result?.found.filter((c) => !c.duplicateOfExisting) ?? []
  const dupes = result?.found.filter((c) => c.duplicateOfExisting) ?? []
  const skippedText = result
    ? [result.skipped.credit ? plural(result.skipped.credit, 'money-in message', 'money-in messages') : '', result.skipped.unsure || result.skipped['no-amount'] ? plural((result.skipped.unsure ?? 0) + (result.skipped['no-amount'] ?? 0), 'message', 'messages') + ' could not be read' : ''].filter(Boolean).join(' · ')
    : ''

  const row = (c: Candidate, dupe = false) => {
    const inst = c.instrumentId ? budget.instruments.find((i) => i.id === c.instrumentId) : undefined
    const how = [c.mode ? modeLabel(c.mode) : '', inst ? instrumentLabel(inst) : c.bank && c.last4 ? `${c.bank} ••${c.last4}` : ''].filter(Boolean).join(' · ')
    const what = c.kind === 'cardBill' ? 'Credit card bill payment' : c.categoryId ? categoryName(budget, c.categoryId) : 'Uncategorised'
    const name = c.merchant || 'Bank payment'
    return (
      <div key={c.id} className="budget__entry import__row">
        <button type="button" className="budget__main tap-row" aria-label={`Review ${money(new D(c.amount))} ${name}`} onClick={() => setEdit(c)}>
          <span className="budget__amt spend__amt">{money(new D(c.amount))}</span>
          <span className="row__label">{name}</span>
          <Icon name="chevron" size={18} className="tap-row__chev" />
          <span className="row__hint">{[shortDate(c.date), how, what, dupe ? 'Looks like one you already added' : ''].filter(Boolean).join(' · ')}</span>
        </button>
        <div className="import__acts">
          <button type="button" className="btn btn--primary" onClick={() => quickAdd(c)}>{dupe ? 'Add anyway' : c.kind === 'cardBill' ? 'Review' : 'Add'}</button>
          <button type="button" className="link-btn" onClick={() => skip(c)}>{dupe ? 'Hide' : 'Skip'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Add from messages">
      <ScreenHeader title="Add from messages" onBack={onBack} />
      <div className="screen__body">
        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Scan">
          <h2 className="sect__head">Find spending in bank messages</h2>
          <div className="sect__body import__intro">
            <p>Calc reads only messages from banks and payment apps, only when you tap Scan, only on this phone. Nothing is sent anywhere. The message text is not saved. You choose what to add.</p>
            <Segmented label="How far back" value={days} options={DAYS} onChange={setDays} />
            <button type="button" className="btn btn--primary" onClick={wantScan}>{busy ? 'Reading…' : smsSupported() ? 'Scan messages' : 'Scan messages (Android only)'}</button>
            {message && <p className="import__msg" role="status">{message}</p>}
          </div>
        </section>

        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Statement file">
          <h2 className="sect__head">Or pick a statement file</h2>
          <div className="sect__body import__intro">
            <p>Download a statement as CSV from your bank or card site, then pick it here. It is read on this phone and not kept. PDF is not supported yet.</p>
            <PickerSelect
              label="Statement is for"
              title="Statement is for"
              value={stmtFor}
              placeholder="Not sure"
              options={[{ value: '', label: 'Not sure' }, ...budget.instruments.filter((i) => i.deletedAt === null).map((i) => ({ value: i.id, label: instrumentLabel(i), hint: i.kind === 'credit' ? 'Credit card' : i.kind === 'debit' ? 'Debit card' : i.kind === 'bank' ? 'Bank account' : 'Wallet' }))]}
              onChange={setStmtFor}
            />
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Pick statement file</button>
          </div>
        </section>

        {result && (
          <section className="sect" style={tintStyle(4)} aria-label="Found">
            <h2 className="sect__head"><span>Found</span><span className="sect__count">{fresh.length}</span></h2>
            <div className="sect__body">
              {newInstruments(fresh).map((n) => (
                <div key={`${n.bank}${n.last4}${n.kind}`} className="budget__entry import__row">
                  <span className="budget__main">
                    <span className="row__label">{n.bank} ••{n.last4}</span>
                    <span className="row__hint">{INSTRUMENT_KINDS.find((k) => k.id === n.kind)?.label ?? 'Account'} found in {plural(n.uses, 'message', 'messages')}, not in your cards yet</span>
                  </span>
                  <div className="import__acts"><button type="button" className="btn" onClick={() => addCard(n)}>Add to my cards</button></div>
                </div>
              ))}
              {fresh.length === 0 && <p className="budget__none">Nothing new to add. {result.alreadySeen > 0 ? `${plural(result.alreadySeen, 'payment was', 'payments were')} handled before.` : 'No bank payments in this period.'}</p>}
              {fresh.map((c) => row(c))}
            </div>
            {(skippedText || result.alreadySeen > 0) && <p className="manage__help">Not listed: {[skippedText, result.alreadySeen > 0 ? `${plural(result.alreadySeen, 'handled before', 'handled before')}` : ''].filter(Boolean).join(' · ')}</p>}
            {dupes.length > 0 && (
              <div className="sect__body">
                <button type="button" className="link-btn spend__link" aria-expanded={showDupes} onClick={() => setShowDupes((v) => !v)}>
                  {showDupes ? 'Hide' : 'Show'} {plural(dupes.length, 'that looks already added', 'that look already added')}
                </button>
                {showDupes && dupes.map((c) => row(c, true))}
              </div>
            )}
          </section>
        )}

        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Reader log">
          <button type="button" className="navrow tap-row" onClick={() => setLogOpen(true)}>
            <span className="row__text">
              <span className="row__label">Reader log</span>
              <span className="row__hint">{logCount === 0 ? 'Messages Calc could not fully read will be listed here' : `${plural(logCount, 'message', 'messages')} Calc could not fully read, with every number and name swapped for a fake one`}</span>
            </span>
            <Icon name="chevron" size={18} className="navrow__chev" />
          </button>
        </section>
      </div>

      {edit && (
        <ExpenseSheet
          prefill={draftOf(edit)}
          onSaved={() => { markSeen([edit.id]); drop(edit.id) }}
          onClose={() => setEdit(null)}
        />
      )}
      {consent && (
        <Sheet
          title="Read bank messages?"
          onClose={() => setConsent(false)}
          footer={<button type="button" className="btn btn--primary" onClick={() => { try { localStorage.setItem(CONSENT_KEY, '1') } catch { /* asked again next time */ } setConsent(false); void scan() }}>Continue</button>}
        >
          <ul className="import__why">
            <li>Calc will ask Android for permission to read your text messages.</li>
            <li>It looks only at messages from banks and payment apps (sender names like HDFCBK), never at messages from people.</li>
            <li>It reads them once, when you tap Scan. It does not run in the background.</li>
            <li>Everything stays on this phone. Nothing is uploaded or shared. The message text is not saved.</li>
            <li>You decide what to add. You can take the permission back any time in Android Settings.</li>
          </ul>
        </Sheet>
      )}
      {logOpen && <LogSheet onClose={() => setLogOpen(false)} />}
    </div>
  )
}

function LogSheet({ onClose }: { onClose: () => void }) {
  const toast = useApp((s) => s.toast)
  const [log, setLog] = useState<ParseLogEntry[] | null>(null)
  useEffect(() => { void loadParseLog().then(setLog) }, [])
  const copy = async () => toast((await copyText(logAsText(log ?? []))) ? 'Log copied' : 'Could not copy')
  return (
    <Sheet
      title="Reader log"
      onClose={onClose}
      action={log && log.length > 0 ? <button type="button" className="link-btn" onClick={() => { void clearParseLog(); setLog([]) }}>Clear</button> : undefined}
      footer={<button type="button" className="btn btn--primary" onClick={() => void copy()}>Copy log</button>}
    >
      <p className="manage__help">Each line is a bank message the reader skipped or only partly understood. Before a line is kept, every number, date, UPI ID and name in it is swapped for a fake one of the same shape (a 5-digit amount stays a 5-digit amount), so the real values never reach the log, and the key for the swap stays on this phone. It stays on this phone and is not part of backups. Copy it to show whoever improves the reader.</p>
      {log === null ? null : log.length === 0 ? <p className="budget__none">Nothing logged yet. Scan messages first.</p> : (
        <ul className="import__log">
          {log.map((e, i) => (
            <li key={i}>
              <span className="row__label">{e.outcome === 'partial' ? 'Read, but something was missing' : e.outcome === 'unsure' ? 'Could not tell if money went out' : 'No amount found'}{e.count > 1 ? ` · seen ${e.count} times` : ''}</span>
              <span className="row__hint">{e.sender}: {e.template}</span>
              {e.got && <span className="row__hint">Understood: {[e.got.amount && `amount (${e.got.amount})`, e.got.merchant ? `name (${e.got.merchant})` : 'no name', e.got.last4 ? 'card digits' : 'no card digits'].filter(Boolean).join(', ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
