import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { ScreenHeader } from '../../components/ScreenHeader'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import type { ToolSpec } from '../../lib/tool'
import { yourTools } from '../../lib/toolUse'
import { ScientificScreen } from '../calculator/ScientificScreen'
import { groupById, groupOfTool, GROUPS, type ToolGroup } from './groups'
import { ALL_TOOLS } from './registry'
import { ToolScreen } from './ToolScreen'

const matches = (t: ToolSpec, q: string) =>
  [t.title, t.blurb, ...t.keywords].some((s) => s.toLowerCase().includes(q))

const specsOf = (g: ToolGroup) => g.tools.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter((t): t is ToolSpec => !!t)

/**
 * One group, split into its sections: a hairline list per section, no card (docs/THE-PLAN.md section 7,
 * Block B7). Every section inside one group shares the group's own single colour, so a tinted card per
 * section told nothing apart -- it just repeated the same wash down the page, reading as one long block
 * rather than separate sections. The group's colour still carries through to the header title (`tint`
 * below), which is enough to say "this is the Savings and investing page" without washing every row in it.
 * A full screen over the Tools home, so Back returns to it.
 */
function GroupPage({ group, onBack, onOpen }: { group: ToolGroup; onBack: () => void; onOpen: (id: string) => void }) {
  return (
    // tintStyle stays on the screen even though the content below no longer uses it: ScreenHeader's
    // `tint` prop (a small colour touch on the title only, not a card wash) still needs --tint-ink in
    // scope. Nothing in the hairline rows below reads --tint, so this cannot bring the wash back.
    <div className="screen" style={tintStyle(group.tint)} role="dialog" aria-modal="true" aria-label={group.name}>
      <ScreenHeader title={group.name} onBack={onBack} tint />
      <div className="screen__body">
        {group.sections.map((sec) => (
          <div key={sec.title}>
            <h2 className="group__title">
              <span>{sec.title}</span>
              <span className="sect__count">{sec.tools.length}</span>
            </h2>
            <div className="group" aria-label={sec.title}>
              {sec.tools
                .map((id) => ALL_TOOLS.find((t) => t.id === id))
                .filter((t): t is ToolSpec => !!t)
                .map((t) => (
                  <button key={t.id} type="button" className="navrow tap-row" onClick={() => onOpen(t.id)}>
                    <span className="row__text">
                      <span className="row__label">{t.title}</span>
                      <span className="row__hint">{t.blurb}</span>
                    </span>
                    <Icon name="chevron" size={18} className="navrow__chev" />
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Tools home, group page, calculator and scientific screen. Where you are lives in the store (`nav`),
 * so tapping the Tools tab can send you to the top and the Android back button can pop one level.
 */
export function ToolsScreen() {
  const nav = useApp((s) => s.nav)
  const setNav = useApp((s) => s.setNav)
  const tabTap = useApp((s) => s.tabTap)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // Tapping the Tools tab while on it also clears the search.
  useEffect(() => setQuery(''), [tabTap])

  const group = groupById(nav.category)
  const spec = ALL_TOOLS.find((t) => t.id === nav.tool)

  // Newest registered runs first: the group page is registered before the calculator opened from it.
  useBackHandler(!!group, () => setNav({ category: null }))
  useBackHandler(nav.scientific, () => setNav({ scientific: false }))

  const toolUse = useApp((s) => s.settings.toolUse)
  const pinnedTools = useApp((s) => s.settings.pinnedTools)
  const mine = yourTools(toolUse, pinnedTools, (id) => ALL_TOOLS.some((t) => t.id === id))
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter((t): t is ToolSpec => !!t)

  const found = q ? GROUPS.flatMap((g) => specsOf(g).filter((t) => matches(t, q))) : []

  return (
    <div className="tools">
      {/* The group page, a calculator and Scientific stack on top below without unmounting this --
          so their own h1 (from ScreenHeader) must be the only one while any is open, not two at once. */}
      {!group && !spec && !nav.scientific && (
        <header className="tabroot__bar">
          <h1 className="screen__title">Tools</h1>
        </header>
      )}
      <div className="tools__search">
        <input
          className="field"
          type="search"
          placeholder="Search calculators"
          aria-label="Search calculators"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="tools__list">
        {q ? (
          found.length === 0 ? (
            <p className="tools__none">No calculator matches “{query}”.</p>
          ) : (
            <div className="group">
              {found.map((t) => (
                <button key={t.id} type="button" className="navrow tap-row" style={tintStyle(groupOfTool(t.id)?.tint ?? 8)} onClick={() => setNav({ tool: t.id })}>
                  <span className="dot" aria-hidden="true" />
                  <span className="navrow__label">{t.title}</span>
                  <span className="navrow__meta">{groupOfTool(t.id)?.name}</span>
                  <Icon name="chevron" size={18} className="navrow__chev" />
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <button type="button" className="hero tap-row" onClick={() => setNav({ scientific: true })}>
              <span>Scientific calculator</span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
            {mine.length > 0 && (
              <>
                <h2 className="section-head">Your tools</h2>
                <div className="group">
                  {mine.map((t) => (
                    <button key={t.id} type="button" className="navrow tap-row" style={tintStyle(groupOfTool(t.id)?.tint ?? 8)} onClick={() => setNav({ tool: t.id })}>
                      <span className="dot" aria-hidden="true" />
                      <span className="navrow__label">{t.title}</span>
                      {pinnedTools.includes(t.id) && (
                        <>
                          <Icon name="pinFilled" size={16} />
                          <span className="sr-only">Pinned</span>
                        </>
                      )}
                      <Icon name="chevron" size={18} className="navrow__chev" />
                    </button>
                  ))}
                </div>
              </>
            )}
            <h2 className="section-head">Browse by what you need</h2>
            {/* One hairline list, same .group / .navrow pattern as Budget's "More in Budget": the eight groups are
                links to other screens (tier 3), so no tinted card each. The colour is only the small .dot. */}
            <div className="group" aria-label="Browse by what you need">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="navrow tap-row"
                  style={tintStyle(g.tint)}
                  aria-label={`${g.name}, ${g.tools.length} calculators`}
                  onClick={() => setNav({ category: g.id })}
                >
                  <span className="dot" aria-hidden="true" />
                  <span className="navrow__label">{g.name}</span>
                  <span className="navrow__meta sect__count" aria-hidden="true">{g.tools.length}</span>
                  <Icon name="chevron" size={18} className="navrow__chev" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {group && <GroupPage group={group} onBack={() => setNav({ category: null })} onOpen={(id) => setNav({ tool: id })} />}
      {spec && <ToolScreen key={spec.id} spec={spec} onBack={() => setNav({ tool: null })} />}
      {nav.scientific && <ScientificScreen onBack={() => setNav({ scientific: false })} />}
    </div>
  )
}
