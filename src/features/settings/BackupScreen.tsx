import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import { saveBackupFile } from '../../lib/backupFile'
import { backupFilename, buildBackup, parseBackup } from '../../store/backup'
import type { PersistedData } from '../../store/types'
import { ExportSheet } from '../budget/ExportSheet'

type Backup = { state: 'idle' } | { state: 'confirm'; data: PersistedData; exportedAt: string | null } | { state: 'done'; text: string } | { state: 'error'; text: string }

/** Settings > Backup and export: save a backup file, save expenses as a spreadsheet, or restore a backup. A full screen with a visible Back. */
export function BackupScreen({ onBack }: { onBack: () => void }) {
  useBackHandler(true, onBack)
  const store = useAppStore()
  const update = useApp((x) => x.updateSettings)
  const showLinkSnack = useApp((x) => x.showLinkSnack)
  const toast = useApp((x) => x.toast)

  const fileRef = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<Backup>({ state: 'idle' })
  const [exportCsv, setExportCsv] = useState(false)
  // Asks before the first save creates the Calc folder in Downloads. Resolves true to go ahead.
  const [folderAsk, setFolderAsk] = useState<((ok: boolean) => void) | null>(null)

  // `toast`, not `showNotice`: a notice only draws on the Calculate tab, and this screen is never on it.
  const exportBackup = async () => {
    const r = await saveBackupFile(backupFilename(), buildBackup(store.getState().snapshot()), () => new Promise<boolean>((resolve) => setFolderAsk(() => resolve)))
    setFolderAsk(null)
    if (r.ok) update({ lastBackupAt: Date.now() })
    if (r.ok && r.open) showLinkSnack(`Backup saved to ${r.where}`, { label: 'Open folder', run: () => void r.open!() })
    else if (r.ok) toast(`Backup saved to ${r.where}`)
    else if (r.reason === 'failed') toast(r.message)
    else toast('No backup was made')
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseBackup(await file.text())
    setBackup(parsed.ok ? { state: 'confirm', data: parsed.data, exportedAt: parsed.exportedAt } : { state: 'error', text: parsed.message })
    if (fileRef.current) fileRef.current.value = ''
  }

  const restore = (data: PersistedData) => {
    store.getState().restore(data)
    setBackup({ state: 'done', text: `Restored ${data.history.length} calculations, ${data.cards.length} notes and lists, ${data.reminders.length} reminders and ${data.budget.expenses.length} budget entries.` })
  }

  const row = (label: string, hint: string, onClick: () => void) => (
    <button type="button" className="row row--button tap-row" onClick={onClick}>
      <span className="row__text">
        <span className="row__label">{label}</span>
        <span className="row__hint">{hint}</span>
      </span>
      <Icon name="chevron" size={18} className="tap-row__chev" />
    </button>
  )

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Backup and export">
      <ScreenHeader title="Backup and export" onBack={onBack} />
      <div className="screen__body">
        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Backup">
          <h2 className="sect__head">Backup</h2>
          {row('Export a backup', 'History and settings, as one file you keep', () => void exportBackup())}
          {row('Restore from a backup', 'Replaces what is on this phone now', () => fileRef.current?.click())}
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose a backup file" tabIndex={-1} onChange={(e) => void chooseFile(e.target.files?.[0])} />
        </section>

        {backup.state === 'confirm' && (
          <div className="confirm" style={{ margin: '16px 16px 0' }}>
            <p>
              Replace <strong>everything</strong> on this phone with the backup
              {backup.exportedAt ? ` from ${new Date(backup.exportedAt).toLocaleDateString()}` : ''}? That means your calculations ({backup.data.history.length}), notes and lists ({backup.data.cards.length}), reminders ({backup.data.reminders.length}),
              budget entries ({backup.data.budget.expenses.length}) and settings. What is on this phone now is lost. Save a backup of it first if you want to keep it.
            </p>
            <div className="confirm__actions">
              <button type="button" className="btn" onClick={() => setBackup({ state: 'idle' })}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={() => void exportBackup()}>
                Save a backup of this phone first
              </button>
              <button type="button" className="btn btn--primary" onClick={() => restore(backup.data)}>
                Replace everything
              </button>
            </div>
          </div>
        )}
        {(backup.state === 'done' || backup.state === 'error') && (
          <p className="note" role="status" data-tone={backup.state === 'error' ? 'error' : undefined}>
            {backup.text}
          </p>
        )}

        <section className="sect sect--settings" style={tintStyle(7)} aria-label="Export">
          <h2 className="sect__head">Export</h2>
          {row('Export expenses', 'Budget entries as a spreadsheet file (CSV)', () => setExportCsv(true))}
        </section>
      </div>
      {exportCsv && <ExportSheet onClose={() => setExportCsv(false)} />}
      {folderAsk && (
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
            Backups are kept together in a <strong>Calc</strong> folder inside your Downloads, so they do not get lost among other files.
            It does not exist yet.
          </p>
        </Sheet>
      )}
    </div>
  )
}
