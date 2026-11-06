import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { PickerSelect, type PickOption } from '../../components/PickerSelect'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp } from '../../components/StoreProvider'
import { backupNudge, countItems } from '../../lib/backupNudge'
import { checkReminderPermissions, ensurePermission, notificationsSupported, openExactAlarmSettings, scheduleTestReminder, type ReminderPermissions } from '../../lib/notifications'
import { moduleOn, startTab, tabOn, withModule } from '../../lib/modules'
import { timeLabel } from '../../lib/reminders'
import { ACCENT_NAMES, ACCENTS } from '../../lib/theme'
import { TABS, type CopyFormat, type Tab } from '../../store/types'
import pkg from '../../../package.json'
import { ALL_TOOLS } from '../tools/registry'
import { GROUPS } from '../tools/groups'
import { BackupScreen } from './BackupScreen'
import { OptionRow, Row, Segmented, Toggle } from './controls'
import { ReliableRemindersSheet } from './ReliableRemindersSheet'
import { TipsAndToursScreen } from '../onboarding/TipsAndTours'

const TAB_LABEL: Record<Tab, string> = { calculate: 'Calculate', tools: 'Tools', saved: 'Notes', due: 'Due', budget: 'Budget' }
const DECIMAL_CHOICES = ['auto', ...Array.from({ length: 11 }, (_, i) => String(i))]

/** One titled group of settings: a small heading over ONE flat panel of rows (docs/design-reference, Settings). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sect sect--settings" aria-label={title}>
      <h2 className="sect__head">{title}</h2>
      <div className="settings__panel">{children}</div>
    </section>
  )
}

/** A settings row that opens a screen of its own. */
function NavRow({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="row row--button tap-row" onClick={onClick}>
      <span className="row__text">
        <span className="row__label">{label}</span>
        <span className="row__hint">{hint}</span>
      </span>
      <Icon name="chevron" size={18} className="tap-row__chev" />
    </button>
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
    <>
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
    </>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** When reminders arrive, a way to prove they do, and (on the phone) what the system allows. */
function ReminderSettings() {
  const time = useApp((x) => x.settings.reminderTime)
  const update = useApp((x) => x.updateSettings)
  const toast = useApp((x) => x.toast)
  const [fixing, setFixing] = useState(false)

  const sendTest = async () => {
    const r = await scheduleTestReminder()
    if (r.ok) {
      const d = new Date(r.at)
      toast(`Test reminder set for ${timeLabel(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`)}. Lock the phone and wait.${r.exact ? '' : ' It may be a few minutes late: "Alarms and reminders" is off.'}`)
    } else if (r.reason === 'web') toast('A test reminder only works in the Android app.')
    else if (r.reason === 'denied') toast('Notifications are not allowed. Allow them above, then try again.')
    else toast('Could not set the test reminder.')
  }

  return (
    <Section title="Reminders">
      <Row label="Reminder time" hint="Reminders arrive at this time on their day">
        <input
          type="time"
          className="field field--mono"
          style={{ width: '8rem', textAlign: 'right' }}
          aria-label="Reminder time"
          value={time}
          onChange={(e) => e.target.value && update({ reminderTime: e.target.value })}
        />
      </Row>
      <button type="button" className="row row--button tap-row" onClick={() => void sendTest()}>
        <span className="row__text">
          <span className="row__label">Send a test reminder</span>
          <span className="row__hint">Arrives in about a minute. If it shows with the phone locked, real reminders can reach you too</span>
        </span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
      </button>
      <button type="button" className="row row--button tap-row" onClick={() => setFixing(true)}>
        <span className="row__text">
          <span className="row__label">Make reminders reliable</span>
          <span className="row__hint">Steps to stop your phone's battery saver from silencing reminders</span>
        </span>
        <Icon name="chevron" size={18} className="tap-row__chev" />
      </button>
      {notificationsSupported() && <ReminderPermissionRows />}
      {fixing && <ReliableRemindersSheet onClose={() => setFixing(false)} />}
    </Section>
  )
}

export function SettingsScreen() {
  const s = useApp((x) => x.settings)
  const update = useApp((x) => x.updateSettings)
  const setOverlay = useApp((x) => x.setOverlay)

  // One picker for both kinds of start: a screen ("tab:saved") or a calculator ("tool:gst").
  const opensOn = s.startupTool && ALL_TOOLS.some((t) => t.id === s.startupTool) ? `tool:${s.startupTool}` : `tab:${startTab(s)}`
  const chooseOpensOn = (v: string) => {
    const [kind, id = ''] = v.split(':')
    if (kind === 'tool') update({ startupTool: id })
    else update({ startupTab: id as Tab, startupTool: null })
  }

  const openOptions: PickOption[] = [
    ...TABS.filter((t) => tabOn(s, t)).map((t) => ({ value: `tab:${t}`, label: TAB_LABEL[t], group: 'Screens' })),
    ...GROUPS.flatMap((g) => g.tools.map((id) => ({ value: `tool:${id}`, label: ALL_TOOLS.find((t) => t.id === id)?.title ?? id, group: g.name }))),
  ]

  // Reminders on live cards. They keep ringing whether or not the Due tab is shown.
  const ringing = useApp((x) => x.reminders.filter((r) => x.cards.some((c) => c.id === r.cardId && c.deletedAt === null)).length)

  const [page, setPage] = useState<'none' | 'backup' | 'tips'>('none')
  const items = useApp((x) => countItems(x))
  const nudge = backupNudge(items, s.lastBackupAt, s.backupDismissedAt, Date.now())

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Settings">
      <ScreenHeader title="Settings" onBack={() => setOverlay('none')} />

      <div className="screen__body">
        {nudge && (
          <p className="note" role="status">
            {nudge}{' '}
            <button type="button" className="link-btn" onClick={() => update({ backupDismissedAt: Date.now() })}>
              Dismiss
            </button>
          </p>
        )}
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
          <Row label="Decimal places" hint="Auto drops .00 on whole money amounts">
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

        <Section title="Show in the app">
          <Row label="Budget" hint="Hidden, not deleted. Bill reminders will still ring. Switch on to get it all back.">
            <Toggle label="Budget" checked={moduleOn(s, 'budget')} onChange={(on) => update(withModule(s, 'budget', on))} />
          </Row>
          <Row
            label="Notes and reminders"
            hint={`Hidden, not deleted. ${ringing === 0 ? 'Reminders you set will still ring.' : `${ringing} ${ringing === 1 ? 'reminder is' : 'reminders are'} set and will still ring.`}`}
          >
            <Toggle label="Notes and reminders" checked={moduleOn(s, 'notes')} onChange={(on) => update(withModule(s, 'notes', on))} />
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

        <ReminderSettings />

        <Section title="More">
          <NavRow label="Backup and export" hint="Save a backup, restore one, or export notes and expenses" onClick={() => setPage('backup')} />
          <NavRow label="Tips and tours" hint="Replay a tour, or bring back the first-visit tips" onClick={() => setPage('tips')} />
        </Section>

        <p className="settings__foot">
          Calc {pkg.version}. Everything stays on this phone. No account, no ads, no tracking.
        </p>
      </div>
      {page === 'backup' && <BackupScreen onBack={() => setPage('none')} />}
      {page === 'tips' && <TipsAndToursScreen onBack={() => setPage('none')} />}
    </div>
  )
}
