import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { tintStyle } from '../../components/tint'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { downloadTextFile } from '../../lib/device'
import { checkReminderPermissions, ensurePermission, notificationsSupported, openExactAlarmSettings, type ReminderPermissions } from '../../lib/notifications'
import { ACCENT_NAMES, ACCENTS } from '../../lib/theme'
import { backupFilename, buildBackup, parseBackup } from '../../store/backup'
import { TABS, type CopyFormat, type PersistedData, type Tab } from '../../store/types'
import pkg from '../../../package.json'
import { ALL_TOOLS } from '../tools/registry'
import { GROUPS } from '../tools/groups'
import { OptionRow, Row, Segmented, Toggle } from './controls'

const TAB_LABEL: Record<Tab, string> = { calculate: 'Calculate', tools: 'Tools', saved: 'Notes', due: 'Due', budget: 'Budget' }
const DECIMAL_CHOICES = ['auto', ...Array.from({ length: 11 }, (_, i) => String(i))]

type Backup = { state: 'idle' } | { state: 'confirm'; data: PersistedData; exportedAt: string | null } | { state: 'done'; text: string } | { state: 'error'; text: string }

/** One titled, tinted card of settings. The tint says which section it is, nothing more. */
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="sect sect--settings" style={tintStyle(n)} aria-label={title}>
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
    <Section n={4} title="Reminders">
        <button type="button" className="row row--button" disabled={perm.notifications} onClick={() => void ensurePermission().then(refresh)}>
          <span className="row__text">
            <span className="row__label">Notifications: {perm.notifications ? 'allowed' : 'not allowed'}</span>
            <span className="row__hint">
              {perm.notifications ? 'Reminders can show on your screen' : 'Tap to allow. If nothing appears, open Android Settings, Apps, Calc, Notifications'}
            </span>
          </span>
        </button>
        <button type="button" className="row row--button" disabled={perm.exact} onClick={() => void openExactAlarmSettings().then(refresh)}>
          <span className="row__text">
            <span className="row__label">Alarms and reminders: {perm.exact ? 'allowed' : 'not allowed'}</span>
            <span className="row__hint">
              {perm.exact ? 'Reminders arrive on time' : 'Tap, then switch on "Allow setting alarms and reminders". Without it a reminder can be late'}
            </span>
          </span>
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

  const fileRef = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<Backup>({ state: 'idle' })

  const exportBackup = () => {
    downloadTextFile(backupFilename(), buildBackup(store.getState().snapshot()))
    setBackup({ state: 'done', text: 'Backup saved to your downloads.' })
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
        <Section n={1} title="Appearance">
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

        <Section n={2} title="Numbers">
        <div role="radiogroup" aria-label="Number format">
          <OptionRow label="Indian" sample="12,34,567.89" checked={s.numberSystem === 'indian'} onSelect={() => update({ numberSystem: 'indian' })} />
          <OptionRow label="International" sample="1,234,567.89" checked={s.numberSystem === 'international'} onSelect={() => update({ numberSystem: 'international' })} />
        </div>
          <Row label="Decimal places" hint="Auto trims the zeros">
            <select
              className="select"
              aria-label="Decimal places"
              value={String(s.decimals)}
              onChange={(e) => update({ decimals: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}
            >
              {DECIMAL_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d === 'auto' ? 'Auto' : d}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Copying numbers" hint="1,50,000 or 150000">
            <select className="select" aria-label="Copying numbers" value={s.copyFormat} onChange={(e) => update({ copyFormat: e.target.value as CopyFormat })}>
              <option value="ask">Ask each time</option>
              <option value="with">With commas</option>
              <option value="without">Without commas</option>
            </select>
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

        <Section n={3} title="Behaviour">
          <Row label="Opens on">
            <select className="select select--wide" aria-label="Opens on" value={opensOn} onChange={(e) => chooseOpensOn(e.target.value)}>
              <optgroup label="Screens">
                {TABS.map((t) => (
                  <option key={t} value={`tab:${t}`}>
                    {TAB_LABEL[t]}
                  </option>
                ))}
              </optgroup>
              {GROUPS.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.tools.map((id) => (
                    <option key={id} value={`tool:${id}`}>
                      {ALL_TOOLS.find((t) => t.id === id)?.title ?? id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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

        <Section n={5} title="Your data">
          <button type="button" className="row row--button" onClick={exportBackup}>
            <span className="row__text">
              <span className="row__label">Export a backup</span>
              <span className="row__hint">History and settings, as one file you keep</span>
            </span>
          </button>
          <button type="button" className="row row--button" onClick={() => fileRef.current?.click()}>
            <span className="row__text">
              <span className="row__label">Restore from a backup</span>
              <span className="row__hint">Replaces what is on this phone now</span>
            </span>
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

        <Section n={6} title="About">
          <Row label="Calc" hint="Everything stays on this phone. No account, no ads, no tracking.">
            <span className="row__value">{pkg.version}</span>
          </Row>
        </Section>
      </div>
    </div>
  )
}
