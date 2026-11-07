import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApp } from '../../components/StoreProvider'
import { ScreenHeader } from '../../components/ScreenHeader'
import { tintStyle } from '../../components/tint'
import { useBackHandler } from '../../components/useBackHandler'
import type { ToolSpec } from '../../lib/tool'
import { ScientificScreen } from '../calculator/ScientificScreen'
import { groupById, groupOfTool, GROUPS, type ToolGroup } from './groups'
import { RecentTools, GROUP_ICON } from './RecentTools'
import { ALL_TOOLS } from './registry'
import { ToolScreen } from './ToolScreen'

const matches = (t: ToolSpec, q: string) =>
  [t.title, t.blurb, ...t.keywords].some((s) => s.toLowerCase().includes(q))

const specsOf = (g: ToolGroup) => g.tools.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter((t): t is ToolSpec => !!t)

/**
 * One group (design reference ToolsGroup, owner decision 2026-11-07): back, the group's dot and name, a search scoped to
 * this group, "Recents" scoped to this group, then "All tools" as the same 2-column tile grid as Tools home. The tile icons
 * all carry the group's own colour (you know the group from the header; a hue per tool would be noise). A full screen
 * over the Tools home, so Back returns to it.
 */
function GroupPage({ group, onBack, onOpen }: { group: ToolGroup; onBack: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const specs = specsOf(group)
  const shown = q ? specs.filter((t) => matches(t, q)) : specs
  const icon = GROUP_ICON[group.id] ?? 'calculate'
  return (
    // tintStyle puts the group colour in scope for the header dot and the tile icons below.
    <div className="screen" style={tintStyle(group.tint)} role="dialog" aria-modal="true" aria-label={group.name}>
      <ScreenHeader
        title={group.name}
        onBack={onBack}
        titleSlot={
          <h1 className="screen__title screen__title--dot">
            <span className="dot" aria-hidden="true" />
            {group.name}
          </h1>
        }
      />
      <div className="tools__search">
        <input
          className="field"
          type="search"
          placeholder={`Search ${specs.length} tools in this group`}
          aria-label={`Search in ${group.name}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="screen__body">
        {!q && <RecentTools onPick={onOpen} only={(id) => group.tools.includes(id)} />}
        {!q && <h2 className="section-head">All tools</h2>}
        {q && shown.length === 0 ? (
          <p className="tools__none">No calculator in {group.name} matches “{query}”.</p>
        ) : (
          <div className="gtiles" aria-label={q ? 'Matching tools' : 'All tools'}>
            {shown.map((t) => (
              <button key={t.id} type="button" className="gtile" onClick={() => onOpen(t.id)}>
                <span className="gtile__icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
                <span className="gtile__name">{t.title}</span>
              </button>
            ))}
          </div>
        )}
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
            <RecentTools onPick={(id) => setNav({ tool: id })} />
            <button type="button" className="hero tap-row" onClick={() => setNav({ scientific: true })}>
              <Icon name="calculate" size={20} />
              <span className="navrow__label">Scientific calculator</span>
              <Icon name="chevron" size={18} className="navrow__chev" />
            </button>
            <h2 className="section-head">Groups · tap to open</h2>
            {/* A 2-column grid of the eight groups (owner decision 2026-11-07, docs/design-reference/IMPLEMENTATION-NOTES.md):
                an icon square, the name and how many calculators. The group colour is only the small icon stroke. */}
            <div className="gtiles" aria-label="Groups">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="gtile"
                  style={tintStyle(g.tint)}
                  aria-label={`${g.name}, ${g.tools.length} calculators`}
                  onClick={() => setNav({ category: g.id })}
                >
                  <span className="gtile__icon" aria-hidden="true"><Icon name={GROUP_ICON[g.id] ?? 'calculate'} size={20} /></span>
                  <span className="gtile__name">{g.name}</span>
                  <span className="gtile__count" aria-hidden="true">{g.tools.length} tools</span>
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
