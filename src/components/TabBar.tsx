import { Icon, type IconName } from './Icon'
import { useApp } from './StoreProvider'
import type { Tab } from '../store/types'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'calculate', label: 'Calculate', icon: 'calculate' },
  { id: 'tools', label: 'Tools', icon: 'tools' },
  { id: 'saved', label: 'Saved', icon: 'saved' },
  { id: 'due', label: 'Due', icon: 'due' },
]

export function TabBar() {
  const tab = useApp((s) => s.tab)
  const setTab = useApp((s) => s.setTab)

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
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
