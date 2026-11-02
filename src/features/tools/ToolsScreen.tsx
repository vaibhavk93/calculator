import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import type { ToolSpec } from '../../lib/tool'
import { ScientificScreen } from '../calculator/ScientificScreen'
import { groupById, groupOfTool, GROUPS, type ToolGroup } from './groups'
import { ALL_TOOLS } from './registry'
import { ToolScreen } from './ToolScreen'

const matches = (t: ToolSpec, q: string) =>
  [t.title, t.blurb, ...t.keywords].some((s) => s.toLowerCase().includes(q))

const specsOf = (g: ToolGroup) => g.tools.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter((t): t is ToolSpec => !!t)

/**
 * One group, split into its sections. Each section is its own tinted card with a heading, so you can see where one
 * kind of calculator ends and the next begins. A full screen over the Tools home, so Back returns to it.
 */
function GroupPage({ group, onBack, onOpen }: { group: ToolGroup; onBack: () => void; onOpen: (id: string) => void }) {
  return (
    <div className="screen" style={tintStyle(group.tint)} role="dialog" aria-modal="true" aria-label={group.name}>
      <div className="screen__bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <Icon name="back" size={20} />
        </button>
        <h1 className="screen__title screen__title--tint">{group.name}</h1>
      </div>
      <div className="screen__body sections">
        {group.sections.map((sec) => (
          <section className="sect" key={sec.title} aria-label={sec.title}>
            <h2 className="sect__head">
              <span>{sec.title}</span>
              <span className="sect__count">{sec.tools.length}</span>
            </h2>
            <div className="sect__body">
              {sec.tools
                .map((id) => ALL_TOOLS.find((t) => t.id === id))
                .filter((t): t is ToolSpec => !!t)
                .map((t) => (
                  <button key={t.id} type="button" className="navrow" onClick={() => onOpen(t.id)}>
                    <span className="row__text">
                      <span className="row__label">{t.title}</span>
                      <span className="row__hint">{t.blurb}</span>
                    </span>
                    <Icon name="chevron" size={18} className="navrow__chev" />
                  </button>
                ))}
            </div>
          </section>
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

  const found = q ? GROUPS.flatMap((g) => specsOf(g).filter((t) => matches(t, q))) : []

  return (
    <div className="tools">
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
                <button key={t.id} type="button" className="navrow" style={tintStyle(groupOfTool(t.id)?.tint ?? 8)} onClick={() => setNav({ tool: t.id })}>
                  <span className="dot" aria-hidden="true" />
                  <span className="navrow__label">{t.title}</span>
                  <span className="navrow__meta">{groupOfTool(t.id)?.name}</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <button type="button" className="hero" onClick={() => setNav({ scientific: true })}>
              <span>Scientific calculator</span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
            <h2 className="section-head">Browse by what you need</h2>
            <div className="tiles">
              {GROUPS.map((g) => (
                <button key={g.id} type="button" className="tile" style={tintStyle(g.tint)} onClick={() => setNav({ category: g.id })}>
                  <span className="tile__name">{g.name}</span>
                  <span className="tile__meta">{g.tools.length} calculators</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {group && <GroupPage group={group} onBack={() => setNav({ category: null })} onOpen={(id) => setNav({ tool: id })} />}
      {spec && <ToolScreen spec={spec} onBack={() => setNav({ tool: null })} />}
      {nav.scientific && <ScientificScreen onBack={() => setNav({ scientific: false })} />}
    </div>
  )
}
