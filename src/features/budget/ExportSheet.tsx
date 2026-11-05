import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { saveBackupFile } from '../../lib/backupFile'
import { EXPORT_RANGES, buildExpensesCsv, expensesCsvFilename, exportEntries, type ExportRange } from '../../lib/csv'

/**
 * "Export expenses": pick a date range, then save one CSV file (opens in Excel or Sheets). It goes the same way a backup
 * does: into Download/Calc on the phone, or an ordinary download in a browser. Nothing leaves the phone by itself.
 * Used from Settings > Backup and export and from the Budget Spending summary.
 */
export function ExportSheet({ onClose }: { onClose: () => void }) {
  const store = useAppStore()
  const toast = useApp((s) => s.toast)
  const showLinkSnack = useApp((s) => s.showLinkSnack)
  const [range, setRange] = useState<ExportRange>('month')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Set while the first save asks whether to create the Calc folder. It takes the place of the form, not a second sheet.
  const [folderAsk, setFolderAsk] = useState<((ok: boolean) => void) | null>(null)

  const count = (r: ExportRange) => exportEntries(store.getState().budget, r).length
  const n = count(range)

  const exportNow = async () => {
    if (busy) return
    if (n === 0) return setError('There are no entries in this range. Pick a longer one.')
    setError(null)
    setBusy(true)
    const text = buildExpensesCsv(store.getState().budget, range)
    const r = await saveBackupFile(expensesCsvFilename(range), text, () => new Promise<boolean>((resolve) => setFolderAsk(() => resolve)), 'text/csv')
    setFolderAsk(null)
    setBusy(false)
    if (r.ok) {
      if (r.open) showLinkSnack(`Saved to ${r.where}`, { label: 'Open folder', run: () => void r.open!() })
      else toast(`Saved to ${r.where}`)
      return onClose()
    }
    if (r.reason === 'failed') setError(r.message)
  }

  if (folderAsk) {
    return (
      <Sheet
        title="Make a Calc folder?"
        onClose={() => folderAsk(false)}
        footer={
          <>
            <button type="button" className="btn btn--primary" onClick={() => folderAsk(true)}>Create folder and save</button>
            <button type="button" className="btn" onClick={() => folderAsk(false)}>Not now</button>
          </>
        }
      >
        <p className="note" style={{ margin: 0 }}>
          Files from Calc are kept together in a <strong>Calc</strong> folder inside your Downloads. It does not exist yet.
        </p>
      </Sheet>
    )
  }

  return (
    <Sheet
      title="Export expenses"
      onClose={onClose}
      footer={<button type="button" className="btn btn--primary" onClick={() => void exportNow()}>Export</button>}
    >
      <div className="save">
        <p className="save__sum">One spreadsheet file (CSV) with a row for each entry: date, amount, category, how you paid, note. Card bill payments and transfers are included and marked. A refund and money that came in have a minus sign and the type "refund" or "income", so adding up the amount column never counts income as spending.</p>
        {error && <p className="ffield__error" role="alert">{error}</p>}
        <div className="save__card" style={tintStyle(7)}>
          <div className="ffield">
            <span className="ffield__label" id="export-range-label">Which entries</span>
            <div className="chips" role="group" aria-labelledby="export-range-label">
              {EXPORT_RANGES.map((r) => (
                <button key={r.id} type="button" className="chip" aria-pressed={range === r.id} onClick={() => { setRange(r.id); setError(null) }}>{r.label}</button>
              ))}
            </div>
            <p className="ffield__hint" role="status">{n === 1 ? '1 entry' : `${n} entries`} in this range</p>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
