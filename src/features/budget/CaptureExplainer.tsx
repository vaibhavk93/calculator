import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { drainNow, smsPort } from '../../store/smsRuntime'

type Stage = 'explain' | 'denied' | 'web'

/**
 * "Capture bank messages": the explanation shown BEFORE Android's own permission dialog (docs/SMS-INBOX-PLAN.md section 4), and what
 * happens after it: allowed (capture goes on), denied or blocked by Android's restricted settings (what to do), or not possible here (the web).
 * "Not now" is fine: nothing is turned on and everything else keeps working.
 */
export function CaptureExplainer({ onClose }: { onClose: () => void }) {
  const update = useApp((s) => s.updateSettings)
  const toast = useApp((s) => s.toast)
  const [stage, setStage] = useState<Stage>(smsPort() ? 'explain' : 'web')
  const [busy, setBusy] = useState(false)

  const allow = async () => {
    const port = smsPort()
    if (!port || busy) return
    setBusy(true)
    try {
      if ((await port.permission()) === 'unavailable') return setStage('web')
      if ((await port.request()) !== 'granted') return setStage('denied')
      await port.setCaptureEnabled(true)
      update({ smsCapture: true })
      onClose()
      toast('Capture is on. Bank payments will wait in "To review".')
      void drainNow()
    } catch {
      setStage('denied')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'web') {
    return (
      <Sheet title="Capture bank messages" onClose={onClose} footer={<button type="button" className="btn btn--primary" onClick={onClose}>Close</button>}>
        <p className="capture__text">Catching bank messages works only in the Android app. Everything else in Calc works as it does here.</p>
      </Sheet>
    )
  }

  if (stage === 'denied') {
    return (
      <Sheet
        title="Android did not allow it"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn btn--primary" onClick={() => void smsPort()?.openAppSettings()}>Open settings</button>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </>
        }
      >
        <div className="capture">
          <p className="capture__text">Capture is still off. Nothing was read, and the rest of Calc works as before.</p>
          <p className="capture__text"><span className="capture__lead">If you tapped Don't allow.</span> Open settings, tap Permissions, then SMS, then Allow. Come back and turn capture on again.</p>
          <p className="capture__text"><span className="capture__lead">If Android says "Restricted setting".</span> Newer phones block this for apps not installed from the Play Store. To allow it:</p>
          <ol className="capture__steps">
            <li>Tap Open settings. This opens Calc's App info.</li>
            <li>Tap the three dots at the top right.</li>
            <li>Tap Allow restricted settings, then come back here and turn capture on again.</li>
          </ol>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      title="Capture bank messages?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void allow()}>Allow messages</button>
          <button type="button" className="btn" onClick={onClose}>Not now</button>
        </>
      }
    >
      <ul className="capture">
        <li><span className="capture__lead">Why</span>So you do not have to type each payment. Calc catches them and you approve them in a list.</li>
        <li><span className="capture__lead">What is read</span>Only messages from bank-style senders (like HDFCBK). Personal chats are never read. One-time passwords and offers are ignored.</li>
        <li><span className="capture__lead">Where it stays</span>Only on this phone. Held encrypted until you open Calc. Not backed up. Never sent anywhere. No one else can see it.</li>
        <li><span className="capture__lead">What logs show</span>Nothing about your messages. Any text kept for fixing bugs is masked: real digits and names are swapped for fake ones.</li>
        <li><span className="capture__lead">Your control</span>Turn capture off any time in Settings. "Delete captured messages" removes what Calc is holding.</li>
      </ul>
    </Sheet>
  )
}
