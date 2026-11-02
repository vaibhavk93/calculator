import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useBackHandler } from '../../components/useBackHandler'
import { INSTRUMENT_KINDS, NETWORKS, PAYMENT_MODES, instrumentLabel, modeLabel, networkLabel, type BudgetData, type Filter, type InstrumentKind, type NetworkId, type PaymentModeId } from '../../lib/budget'

/** The "where did the money come from" part of a filter. The category is chosen separately, on the Entries tab. */
export type Scope = Omit<Filter, 'categoryId'>

const kindLabel = (k: InstrumentKind) => INSTRUMENT_KINDS.find((x) => x.id === k)!.label

/** One string per choice, so the sheet can tell which row is ticked. */
export function scopeKey(s: Scope): string {
  if (s.instrumentId !== undefined) return `inst:${s.instrumentId}`
  if (s.network !== undefined) return `net:${s.network}`
  if (s.kind !== undefined) return `kind:${s.kind}`
  if (s.modeId !== undefined) return `mode:${s.modeId}`
  return 'all'
}

function scopeOf(key: string): Scope {
  const [type = '', id = ''] = key.split(':')
  if (type === 'inst') return { instrumentId: id }
  if (type === 'net') return { network: id as NetworkId }
  if (type === 'kind') return { kind: id as InstrumentKind }
  if (type === 'mode') return { modeId: id as PaymentModeId }
  return {}
}

/** The words on the filter chip. A hidden card or account that is still chosen says so. */
export function scopeLabel(budget: Pick<BudgetData, 'instruments'>, s: Scope): string {
  if (s.instrumentId !== undefined) {
    const i = budget.instruments.find((x) => x.id === s.instrumentId)
    return i ? `${instrumentLabel(i)}${i.deletedAt === null ? '' : ' (hidden)'}` : 'Removed account'
  }
  if (s.network !== undefined) return `${networkLabel(s.network)} cards`
  if (s.kind !== undefined) return `All ${kindLabel(s.kind).toLowerCase()}s`
  if (s.modeId !== undefined) return modeLabel(s.modeId)
  return 'All accounts'
}

/**
 * One choice, one tap, and the sheet closes. The groups overlap on purpose (UPI by mode, a card by account), and
 * the note under the title says how. See docs/BUDGET-PLAN.md section C.
 */
export function FilterSheet({ budget, value, onPick, onClose }: { budget: BudgetData; value: Scope; onPick: (s: Scope) => void; onClose: () => void }) {
  useBackHandler(true, onClose)
  const current = scopeKey(value)
  const live = budget.instruments.filter((i) => i.deletedAt === null)
  // A hidden account that is chosen stays in the list so the tick has somewhere to be.
  const hiddenChosen = value.instrumentId !== undefined && !live.some((i) => i.id === value.instrumentId) ? budget.instruments.find((i) => i.id === value.instrumentId) : undefined

  const row = (key: string, label: string, hint?: string) => (
    <button key={key} type="button" role="option" aria-selected={key === current} className="pick__opt" onClick={() => { onPick(scopeOf(key)); onClose() }}>
      <span className="pick__text">
        <span className="pick__label">{label}</span>
        {hint && <span className="pick__hint">{hint}</span>}
      </span>
      {key === current && <Icon name="check" size={20} />}
    </button>
  )

  return (
    <Sheet title="Show spending from" onClose={onClose}>
      <p className="note spend__note">UPI shows everything paid by UPI, from any account. A card or account shows everything charged to it, even by UPI.</p>
      <div className="pick__list" role="listbox" aria-label="Show spending from">
        {row('all', 'All accounts')}
        <h3 className="pick__group">How paid</h3>
        {PAYMENT_MODES.map((m) => row(`mode:${m.id}`, m.label))}
        <h3 className="pick__group">Card type</h3>
        {row('kind:credit', 'All credit cards')}
        {NETWORKS.map((n) => row(`net:${n.id}`, `${n.label} cards`))}
        <h3 className="pick__group">My accounts</h3>
        {live.length === 0 && !hiddenChosen && <p className="note spend__note">No cards or accounts yet. Add them from Categories and cards on the Budget page.</p>}
        {live.map((i) => row(`inst:${i.id}`, instrumentLabel(i), kindLabel(i.kind)))}
        {hiddenChosen && row(`inst:${hiddenChosen.id}`, `${instrumentLabel(hiddenChosen)} (hidden)`, kindLabel(hiddenChosen.kind))}
      </div>
    </Sheet>
  )
}
