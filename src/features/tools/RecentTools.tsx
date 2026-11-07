import { Icon, type IconName } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import type { ToolSpec } from '../../lib/tool'
import { yourTools } from '../../lib/toolUse'
import { groupOfTool } from './groups'
import { ALL_TOOLS } from './registry'

/** The one-colour stroke icon for each group: a "Your tools" tile shows its group's, a group tile on Tools home too. */
export const GROUP_ICON: Record<string, IconName> = {
  math: 'sum',
  money: 'tag',
  units: 'ruler',
  life: 'calendar',
  loans: 'percent',
  savings: 'trend',
  tax: 'receipt',
  business: 'chart',
}

/**
 * "Recents" (the calculators you open most, pinned first): a row of small flat icon tiles that scrolls sideways, pinned first and then the most opened (see
 * lib/toolUse.ts). Shown directly under the search field wherever you search or pick a calculator, and hidden by the
 * caller while a query is typed. `only` limits it to calculators that fit the place (the "Use in" picker). Draws
 * nothing when there is nothing to show. A shape reads faster than a word when scanning
 * (docs/design-reference/DIAGNOSIS-AND-DECISIONS.md, change 3).
 */
export function RecentTools({ onPick, only, heading = true }: { onPick: (id: string) => void; only?: (id: string) => boolean; heading?: boolean }) {
  const toolUse = useApp((s) => s.settings.toolUse)
  const pinnedTools = useApp((s) => s.settings.pinnedTools)
  const mine = yourTools(toolUse, pinnedTools, (id) => ALL_TOOLS.some((t) => t.id === id) && (only?.(id) ?? true))
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter((t): t is ToolSpec => !!t)
  if (mine.length === 0) return null
  return (
    <section aria-label="Recents">
      {heading && <h2 className="section-head">Recents</h2>}
      <div className="tiles">
        {mine.map((t) => (
          <button key={t.id} type="button" className="tile" onClick={() => onPick(t.id)}>
            <span className="tile__icon" aria-hidden="true">
              <Icon name={GROUP_ICON[groupOfTool(t.id)?.id ?? ''] ?? 'calculate'} size={20} />
              {pinnedTools.includes(t.id) && <Icon name="pinFilled" size={12} className="tile__pin" />}
            </span>
            <span className="tile__label">{t.title}</span>
            {pinnedTools.includes(t.id) && <span className="sr-only">, pinned</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
