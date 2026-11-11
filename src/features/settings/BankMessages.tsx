import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PickerSelect } from '../../components/PickerSelect'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { CaptureExplainer } from '../budget/CaptureExplainer'
import { RulesScreen } from '../budget/RulesScreen'
import type { SmsPermission } from '../../lib/smsQueue'
import { smsPort } from '../../store/smsRuntime'
import { Row, Toggle } from './controls'

const MODE_SENTENCE = {
  review: 'Payments wait in your list. Nothing is added until you approve it.',
  auto: 'Payments you have tagged the same way twice are added for you, marked Auto-added with Undo. The rest wait for you.',
} as const

/**
 * The rows of Settings > Bank messages: Capture on/off, the mode, Delete captured messages, Learned payees.
 * The explanation before Android's permission dialog lives in CaptureExplainer (shared with the Budget empty state).
 */
export function BankMessages() {
  const capture = useApp((s) => s.settings.smsCapture)
  const mode = useApp((s) => s.settings.smsMode)
  const paused = useApp((s) => s.settings.smsAutoPausedAt)
  const update = useApp((s) => s.updateSettings)
  const setMode = useApp((s) => s.setSmsMode)
  const clearInbox = useApp((s) => s.clearInbox)
  const toast = useApp((s) => s.toast)
  const learned = useApp((s) => (s.budget.learned ?? []).length)
  const waiting = useApp((s) => (s.budget.inbox ?? []).filter((i) => i.status === 'pending').length)

  const port = smsPort()
  const [perm, setPerm] = useState<SmsPermission | null>(null)
  const [explain, setExplain] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [learnedOpen, setLearnedOpen] = useState(false)

  useEffect(() => {
    const read = () => void (port ? port.permission().then(setPerm, () => setPerm('unavailable')) : undefined)
    read()
    document.addEventListener('visibilitychange', read)
    return () => document.removeEventListener('visibilitychange', read)
  }, [port, capture, explain])

  const toggle = (on: boolean) => {
    if (on) return setExplain(true)
    update({ smsCapture: false })
    void port?.setCaptureEnabled(false).catch(() => {})
    toast('Capture is off. Messages already held stay until you delete them.')
  }

  const del = async () => {
    setDeleting(false)
    try { await port?.clear() } catch { return toast('Could not delete the messages held on the phone. Try again.') }
    const n = clearInbox()
    toast(n > 0 ? `Deleted the held messages and ${n} ${n === 1 ? 'payment' : 'payments'} waiting for review` : 'Deleted the messages held on this phone')
  }

  const hint = !port ? 'Works in the Android app only'
    : capture && perm !== null && perm !== 'granted' ? 'On, but Android is not allowing it. Turn it off and on again to fix this'
    : capture ? 'On. Bank payments wait in To review until you open Calc'
    : 'Off. Calc reads no messages'

  return (
    <>
      <Row label="Capture bank messages" hint={hint}>
        <Toggle label="Capture bank messages" checked={capture} onChange={toggle} />
      </Row>
      <Row label="When a payment arrives" hint={paused !== null ? 'Auto-add switched itself off because 2 of the last 10 it added were undone or changed. ' + MODE_SENTENCE.review : MODE_SENTENCE[mode]}>
        <PickerSelect
          label="When a payment arrives"
          align="end"
          value={mode}
          onChange={(v) => setMode(v as 'review' | 'auto')}
          options={[
            { value: 'review', label: 'Review first', hint: MODE_SENTENCE.review },
            { value: 'auto', label: 'Auto-add the confident ones', hint: MODE_SENTENCE.auto },
          ]}
        />
      </Row>
      <button type="button" className="row row--button tap-row" onClick={() => setDeleting(true)}>
        <span className="row__text">
          <span className="row__label">Delete captured messages</span>
          <span className="row__hint">Removes what Calc holds on this phone{waiting > 0 ? ` and the ${waiting} waiting for review` : ''}. Payments you already added stay</span>
        </span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
      </button>
      <button type="button" className="row row--button tap-row" onClick={() => setLearnedOpen(true)}>
        <span className="row__text">
          <span className="row__label">Learned payees</span>
          <span className="row__hint">{learned === 0 ? 'What Calc learns from your approvals shows here' : `${learned} ${learned === 1 ? 'payee' : 'payees'}. Change a category or forget one`}</span>
        </span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
      </button>
      {explain && <CaptureExplainer onClose={() => setExplain(false)} />}
      {deleting && (
        <Sheet
          title="Delete captured messages?"
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button type="button" className="btn btn--primary" onClick={() => setDeleting(false)}>Keep them</button>
              <button type="button" className="btn btn--danger" onClick={() => void del()}>Delete</button>
            </>
          }
        >
          <p className="capture__text">This deletes every bank message Calc is holding on this phone, and the payments waiting in To review. Payments you already added stay in your budget. This cannot be undone.</p>
        </Sheet>
      )}
      {learnedOpen && <RulesScreen onBack={() => setLearnedOpen(false)} toLearned />}
    </>
  )
}
