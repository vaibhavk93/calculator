import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { downloadTextFile } from '../../lib/device'
import { ACCENT_NAMES, ACCENTS } from '../../lib/theme'
import { backupFilename, buildBackup, parseBackup } from '../../store/backup'
import { TABS, type PersistedData, type Tab } from '../../store/types'
import pkg from '../../../package.json'
import { ALL_TOOLS } from '../tools/registry'
import { GROUPS } from '../tools/groups'
import { OptionRow, Row, Segmented, Toggle } from './controls'

const TAB_LABEL: Record<Tab, string> = { calculate: 'Calculate', tools: 'Tools', saved: 'Notes', due: 'Due' }
const DECIMAL_CHOICES = ['auto', ...Array.from({ length: 11 }, (_, i) => String(i))]

type Backup = { state: 'idle' } | { state: 'confirm'; data: PersistedData; exportedAt: string | null } | { state: 'done'; text: string } | { state: 'error'; text: string }

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
      <div className="screen__bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => setOverlay('none')}>
          <Icon name="back" size={20} />
        </button>
        <h1 className="screen__title">Settings</h1>
      </div>

      <div className="screen__body">
        <h2 className="group__title">Appearance</h2>
        <div className="group">
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
        </div>

        <h2 className="group__title">Numbers</h2>
        <div className="group" role="radiogroup" aria-label="Number format">
          <OptionRow label="Indian" sample="12,34,567.89" checked={s.numberSystem === 'indian'} onSelect={() => update({ numberSystem: 'indian' })} />
          <OptionRow label="International" sample="1,234,567.89" checked={s.numberSystem === 'international'} onSelect={() => update({ numberSystem: 'international' })} />
        </div>
        <div className="group">
          <Row label="Decimal places" hint="Auto shows up to 10 and trims the zeros">
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
        </div>

        <h2 className="group__title">Behaviour</h2>
        <div className="group">
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
        </div>

        <h2 className="group__title">Your data</h2>
        <div className="group">
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
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(e) => void chooseFile(e.target.files?.[0])} />
        </div>

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

        <h2 className="group__title">About</h2>
        <div className="group">
          <Row label="Calc" hint="Everything stays on this phone. No account, no ads, no tracking.">
            <span className="row__value">{pkg.version}</span>
          </Row>
        </div>
      </div>
    </div>
  )
}
