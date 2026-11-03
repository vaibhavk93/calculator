import { useEffect, useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { detectOemBrand, OEM_GUIDES, openNote, openReminderSettings, type OemBrand } from '../../lib/oemSettings'

/**
 * "Make reminders reliable". Names the phone maker, lists plain steps for that brand, and opens the nearest settings
 * page. Reached from Settings, Reminders, and from the Due tab's "A reminder may not have shown" notice.
 */
export function ReliableRemindersSheet({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState<{ brand: OemBrand; model: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void detectOemBrand().then((p) => live && setPhone(p))
    return () => void (live = false)
  }, [])

  const brand = phone?.brand ?? 'other'
  const guide = OEM_GUIDES[brand]
  const openIt = async () => setNote(openNote(await openReminderSettings()))

  return (
    <Sheet
      title="Make reminders reliable"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary" onClick={() => void openIt()}>
          Open settings
        </button>
      }
    >
      <div className="save">
        <div className="save__card">
          <p className="steps__lead">
            Some phones stop apps from running in the background to save battery. A reminder can then arrive late, or not at all. A few settings fix that.
          </p>
          <h3 className="steps__head">{brand === 'other' ? 'Steps for most phones' : `Steps for ${guide.name}`}</h3>
          {phone?.model && <p className="ffield__hint">Detected: {phone.model}</p>}
          <ol className="steps">
            {guide.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {note && <p className="ffield__hint" role="status">{note}</p>}
          <p className="ffield__hint">
            Names differ between phones and software versions. When you are done, go to Settings, Reminders, and tap "Send a test reminder" to check.
          </p>
        </div>
      </div>
    </Sheet>
  )
}
