import { Icon, type IconName } from './Icon'
import { useApp } from './StoreProvider'
import { tabOn } from '../lib/modules'
import type { Tab } from '../store/types'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'calculate', label: 'Calculate', icon: 'calculate' },
  { id: 'tools', label: 'Tools', icon: 'wrench' },
  { id: 'saved', label: 'Notes', icon: 'noteDoc' },
  { id: 'due', label: 'Due', icon: 'clock' },
  { id: 'budget', label: 'Budget', icon: 'budget' },
]

export function TabBar() {
  const tab = useApp((s) => s.tab)
  const setTab = useApp((s) => s.setTab)
  const settings = useApp((s) => s.settings)

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.filter((t) => tabOn(settings, t.id)).map((t) => (
        <button
          key={t.id}
          type="button"
          className="tab"
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => setTab(t.id)}
        >
          <Icon name={t.icon} size={21} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
