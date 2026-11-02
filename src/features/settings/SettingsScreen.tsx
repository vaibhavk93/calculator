import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { tintStyle } from '../../components/tint'
import { PickerSelect, type PickOption } from '../../components/PickerSelect'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { saveBackupFile } from '../../lib/backupFile'
import { Sheet } from '../../components/Sheet'
import { checkReminderPermissions, ensurePermission, notificationsSupported, openExactAlarmSettings, type ReminderPermissions } from '../../lib/notifications'
import { ACCENT_NAMES, ACCENTS } from '../../lib/theme'
import { backupFilename, buildBackup, parseBackup } from '../../store/backup'
import { TABS, type CopyFormat, type PersistedData, type Tab } from '../../store/types'
import pkg from '../../../package.json'
import { ManageScreen } from '../budget/ManageScreen'
import { ALL_TOOLS } from '../tools/registry'
import { GROUPS } from '../tools/groups'
import { OptionRow, Row, Segmented, Toggle } from './controls'

const TAB_LABEL: Record<Tab, string> = { calculate: 'Calculate', tools: 'Tools', saved: 'Notes', due: 'Due', budget: 'Budget' }
const DECIMAL_CHOICES = ['auto', ...Array.from({ length: 11 }, (_, i) => String(i))]

type Backup = { state: 'idle' } | { state: 'confirm'; data: PersistedData; exportedAt: string | null } | { state: 'done'; text: string } | { state: 'error'; text: string }

/** One titled card of settings. All of them share one calm tint: Settings is one place, not eight sections to tell apart. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sect sect--settings" style={tintStyle(7)} aria-label={title}>
      <h2 className="sect__head">{title}</h2>
      {children}
    </section>
  )
}

/** What the phone allows reminders to do, and the buttons that fix it. Shown on the phone only. */
function ReminderPermissionRows() {
  const [perm, setPerm] = useState<ReminderPermissions | null>(null)
  const refresh = useCallback(() => void checkReminderPermissions().then(setPerm), [])
  useEffect(() => {
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [refresh])
  if (!perm) return null
  return (
    <Section title="Reminders">
        <button type="button" className="row row--button tap-row" disabled={perm.notifications} onClick={() => void ensurePermission().then(refresh)}>
          <span className="row__text">
            <span className="row__label">Notifications: {perm.notifications ? 'allowed' : 'not allowed'}</span>
            <span className="row__hint">
              {perm.notifications ? 'Reminders can show on your screen' : 'Tap to allow. If nothing appears, open Android Settings, Apps, Calc, Notifications'}
            </span>
          </span>
          {!perm.notifications && <Icon name="chevron" size={18} className="tap-row__chev" />}
        </button>
        <button type="button" className="row row--button tap-row" disabled={perm.exact} onClick={() => void openExactAlarmSettings().then(refresh)}>
          <span className="row__text">
            <span className="row__label">Alarms and reminders: {perm.exact ? 'allowed' : 'not allowed'}</span>
            <span className="row__hint">
              {perm.exact ? 'Reminders arrive on time' : 'Tap, then switch on "Allow setting alarms and reminders". Without it a reminder can be late'}
            </span>
          </span>
          {!perm.exact && <Icon name="chevron" size={18} className="tap-row__chev" />}
        </button>
    </Section>
  )
}

export function SettingsScreen() {
  const store = useAppStore()
  const s = useApp((x) => x.settings)
  const update = useApp((x) => x.updateSettings)
  const setOverlay = useApp((x) => x.setOverlay)

  // One picker for both kinds of start: a screen ("tab:saved") or a calculator ("tool:gst").
  const opensOn = s.startupTool && ALL_TOOLS.some((t) => t.id === s.startupTool) ? `tool:${s.startupTool}` : `tab:${s.startupTab}`
  const chooseOpensOn = (v: string) => {
    const [kind, id = ''] = v.split(':')
    if (kind === 'tool') update({ startupTool: id })
    else update({ startupTab: id as Tab, startupTool: null })
  }

  const openOptions: PickOption[] = [
    ...TABS.map((t) => ({ value: `tab:${t}`, label: TAB_LABEL[t], group: 'Screens' })),
    ...GROUPS.flatMap((g) => g.tools.map((id) => ({ value: `tool:${id}`, label: ALL_TOOLS.find((t) => t.id === id)?.title ?? id, group: g.name }))),
  ]

  const fileRef = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<Backup>({ state: 'idle' })
  const [manageBudget, setManageBudget] = useState(false)

  // Asks before the first save creates the Calc folder in Downloads. Resolves true to go ahead.
  const [folderAsk, setFolderAsk] = useState<((ok: boolean) => void) | null>(null)
  const showLinkSnack = useApp((x) => x.showLinkSnack)
  const showNotice = useApp((x) => x.showNotice)

  const exportBackup = async () => {
    const r = await saveBackupFile(backupFilename(), buildBackup(store.getState().snapshot()), () => new Promise<boolean>((resolve) => setFolderAsk(() => resolve)))
    setFolderAsk(null)
    if (r.ok) showLinkSnack(`Backup saved to ${r.where}`, { label: 'Open folder', run: () => void r.open() })
    else if (r.reason === 'failed') showNotice(r.message, 'error')
    else showNotice('No backup was made', 'info')
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseBackup(await file.text())
    setBackup(parsed.ok ? { state: 'confirm', data: parsed.data, exportedAt: parsed.exportedAt } : { state: 'error', text: parsed.message })
    if (fileRef.current) fileRef.current.value = ''
  }

  const restore = (data: PersistedData) => {
    store.getState().restore(data)
    setBackup({ state: 'done', text: `Restored ${data.history.length} calculations and your settings.` })
  }

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Settings">
      <ScreenHeader title="Settings" onBack={() => setOverlay('none')} />

      <div className="screen__body">
        <Section title="Appearance">
          <Row label="Theme">
            <Segmented
              label="Theme"
              value={s.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Row>
          <Row label="Accent" hint={ACCENTS[s.accent].label}>
            <div className="swatches" role="radiogroup" aria-label="Accent colour">
              {ACCENT_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={s.accent === name}
                  aria-label={ACCENTS[name].label}
                  className="swatch"
                  onClick={() => update({ accent: name })}
                >
                  <span className="swatch__chip" style={{ background: ACCENTS[name].fill }} />
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title="Numbers">
        <div role="radiogroup" aria-label="Number format">
          <OptionRow label="Indian" sample="12,34,567.89" checked={s.numberSystem === 'indian'} onSelect={() => update({ numberSystem: 'indian' })} />
          <OptionRow label="International" sample="1,234,567.89" checked={s.numberSystem === 'international'} onSelect={() => update({ numberSystem: 'international' })} />
        </div>
          <Row label="Decimal places" hint="Auto trims the zeros">
            <PickerSelect
              label="Decimal places"
              align="end"
              value={String(s.decimals)}
              onChange={(v) => update({ decimals: v === 'auto' ? 'auto' : Number(v) })}
              options={DECIMAL_CHOICES.map((d) => ({ value: d, label: d === 'auto' ? 'Auto' : d }))}
            />
          </Row>
          <Row label="Copying numbers" hint="1,50,000 or 150000">
            <PickerSelect
              label="Copying numbers"
              align="end"
              value={s.copyFormat}
              onChange={(v) => update({ copyFormat: v as CopyFormat })}
              options={[
                { value: 'ask', label: 'Ask each time', hint: 'Shows both, you tap one' },
                { value: 'with', label: 'With commas', hint: '1,50,000' },
                { value: 'without', label: 'Without commas', hint: '150000' },
              ]}
            />
          </Row>
          <Row label="Angles">
            <Segmented
              label="Angle mode"
              value={s.angle}
              onChange={(angle) => update({ angle })}
              options={[
                { value: 'deg', label: 'Degrees' },
                { value: 'rad', label: 'Radians' },
              ]}
            />
          </Row>
        </Section>

        <Section title="Behaviour">
          <Row label="Opens on">
            <PickerSelect label="Opens on" title="Open the app on" align="end" value={opensOn} onChange={chooseOpensOn} options={openOptions} />
          </Row>
          <Row label="Vibrate on key press">
            <Toggle label="Vibrate on key press" checked={s.haptics} onChange={(haptics) => update({ haptics })} />
          </Row>
          <Row label="Keep the screen on" hint="While the app is open">
            <Toggle label="Keep the screen on" checked={s.keepAwake} onChange={(keepAwake) => update({ keepAwake })} />
          </Row>
          <Row label="Keep calculation history" hint="Turn off to stop recording new calculations">
            <Toggle label="Keep calculation history" checked={s.keepHistory} onChange={(keepHistory) => update({ keepHistory })} />
          </Row>
        </Section>

        {notificationsSupported() && <ReminderPermissionRows />}

        <Section title="Your data">
          <button type="button" className="row row--button tap-row" onClick={() => setManageBudget(true)}>
            <span className="row__text">
              <span className="row__label">Categories and cards</span>
              <span className="row__hint">Budget limits, categories, cards and accounts</span>
            </span>
            <Icon name="chevron" size={18} className="tap-row__chev" />
          </button>
          <button type="button" className="row row--button tap-row" onClick={() => void exportBackup()}>
            <span className="row__text">
              <span className="row__label">Export a backup</span>
              <span className="row__hint">History and settings, as one file you keep</span>
            </span>
            <Icon name="chevron" size={18} className="tap-row__chev" />
          </button>
          <button type="button" className="row row--button tap-row" onClick={() => fileRef.current?.click()}>
            <span className="row__text">
              <span className="row__label">Restore from a backup</span>
              <span className="row__hint">Replaces what is on this phone now</span>
            </span>
            <Icon name="chevron" size={18} className="tap-row__chev" />
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose a backup file" tabIndex={-1} onChange={(e) => void chooseFile(e.target.files?.[0])} />
        </Section>

        {backup.state === 'confirm' && (
          <div className="confirm" style={{ margin: '16px 16px 0' }}>
            <p>
              Replace this phone&rsquo;s history and settings with the backup
              {backup.exportedAt ? ` from ${new Date(backup.exportedAt).toLocaleDateString()}` : ''}? It holds {backup.data.history.length} calculations.
              Export a backup first if you want to keep what is here.
            </p>
            <div className="confirm__actions">
              <button type="button" className="btn" onClick={() => setBackup({ state: 'idle' })}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={() => restore(backup.data)}>
                Restore
              </button>
            </div>
          </div>
        )}
        {(backup.state === 'done' || backup.state === 'error') && (
          <p className="note" role="status" data-tone={backup.state === 'error' ? 'error' : undefined}>
            {backup.text}
          </p>
        )}

        <Section title="About">
          <Row label="Calc" hint="Everything stays on this phone. No account, no ads, no tracking.">
            <span className="row__value">{pkg.version}</span>
          </Row>
        </Section>
      </div>
      {manageBudget && <ManageScreen onBack={() => setManageBudget(false)} />}
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
