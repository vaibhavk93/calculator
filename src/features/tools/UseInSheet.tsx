import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import type { Fmt, TimeUnit } from '../../lib/tool'
import { linkTargets } from '../../lib/toolLink'
import { formatCell } from '../../lib/toolFormat'
import type { Dec } from '../../engine'
import { ALL_TOOLS } from './registry'
import { RecentTools } from './RecentTools'
import { prefillDraft } from './ToolScreen'

/**
 * "Use in another tool": step 1 picks the calculator, step 2 picks WHICH box of it gets the number.
 * Nothing is guessed, even when a tool has only one fitting box. The target opens with that box filled and
 * every other box as it was.
 */
export function UseInSheet({ fromToolId, value, text, fmt, unit, label, onClose }: { fromToolId: string; value: Dec; text: string; fmt: Fmt; unit?: TimeUnit; label: string; onClose: () => void }) {
  const store = useAppStore()
  const tab = useApp((s) => s.tab)
  const setTab = useApp((s) => s.setTab)
  const setNav = useApp((s) => s.setNav)
  const showCard = useApp((s) => s.showCard)
  const system = useApp((s) => s.settings.numberSystem)
  const decimals = useApp((s) => s.settings.decimals)
  const targets = linkTargets(ALL_TOOLS, fromToolId, fmt, unit)
  const [toolId, setToolId] = useState<string | null>(null)
  const [fieldId, setFieldId] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const target = targets.find((t) => t.toolId === toolId)
  const shown = formatCell(value, fmt, { system, decimals })

  const go = () => {
    const spec = ALL_TOOLS.find((s) => s.id === toolId)
    if (!spec || !fieldId) return setMissing(true)
    prefillDraft(store, spec, fieldId, text, unit)
    onClose()
    showCard(null)
    if (tab !== 'tools') setTab('tools')
    setNav({ tool: spec.id })
  }

  return (
    <Sheet
      title={target ? 'Which field?' : 'Use in'}
      onClose={onClose}
      footer={target ? <button type="button" className="btn btn--primary" onClick={go}>{`Open ${target.title}`}</button> : undefined}
    >
      <p className="pick__hint">{label}: {shown}</p>
      {!target ? (
        targets.length === 0 ? (
          <p className="pick__hint">No other calculator has a box this fits.</p>
        ) : (
          <>
          <RecentTools only={(id) => targets.some((t) => t.toolId === id)} onPick={(id) => { setToolId(id); setFieldId(null); setMissing(false) }} />
          <div className="pick__list" role="listbox" aria-label="Calculators">
            {targets.map((t) => (
              <button key={t.toolId} type="button" role="option" aria-selected={false} className="pick__opt" onClick={() => { setToolId(t.toolId); setFieldId(null); setMissing(false) }}>
                <span className="pick__text">
                  <span className="pick__label">{t.title}</span>
                  <span className="pick__hint">{t.fields.length === 1 ? t.fields[0]!.label : `${t.fields.length} fields fit`}</span>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            ))}
          </div>
          </>
        )
      ) : (
        <>
          <button type="button" className="link-btn" onClick={() => { setToolId(null); setFieldId(null); setMissing(false) }}>Change calculator</button>
          <h3 className="pick__group">Put {shown} in which box?</h3>
          <div className="pick__list" role="listbox" aria-label={`Fields in ${target.title}`}>
            {target.fields.map((f) => (
              <button key={f.id} type="button" role="option" aria-selected={fieldId === f.id} className="pick__opt" onClick={() => { setFieldId(f.id); setMissing(false) }}>
                <span className="pick__label">{f.label}</span>
                {fieldId === f.id && <Icon name="check" size={20} />}
              </button>
            ))}
          </div>
          {missing && <p className="ffield__error" role="alert">Pick a field first</p>}
        </>
      )}
    </Sheet>
  )
}
