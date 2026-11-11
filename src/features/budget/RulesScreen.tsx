import { useEffect, useState } from 'react'
import { FormField } from '../../components/FormField'
import { PickerSelect } from '../../components/PickerSelect'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApp } from '../../components/StoreProvider'
import { useBackHandler } from '../../components/useBackHandler'
import { categoryName, categoryUsable, cleanRuleMatch, MAX_RULES, RULE_MAX } from '../../lib/budget'
import { categoryPickOptions } from './formKit'

/**
 * Merchant rules: "when the merchant contains this word, suggest this category" for bank messages and statements.
 * Newest first, and the newest matching rule wins. Never applied to entries already added. Opened from Manage.
 */
export function RulesScreen({ onBack, toLearned = false }: { onBack: () => void; /** Opened from Settings > Learned payees: scrolls to that list. */ toLearned?: boolean }) {
  useBackHandler(true, onBack)
  const budget = useApp((s) => s.budget)
  const addRule = useApp((s) => s.addRule)
  const deleteRule = useApp((s) => s.deleteRule)
  const setLearned = useApp((s) => s.setLearned)
  const forgetLearned = useApp((s) => s.forgetLearned)
  const rules = budget.rules ?? []
  const learned = budget.learned ?? []
  useEffect(() => { if (toLearned) document.getElementById('learned')?.scrollIntoView?.({ block: 'start' }) }, [toLearned])

  const [text, setText] = useState('')
  const [cat, setCat] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const options = categoryPickOptions(budget)

  const checked = cleanRuleMatch(text)
  const textError = submitted && !checked.ok ? checked.error : null
  const catError = submitted && !cat ? 'Pick a category from the list' : null

  const submit = () => {
    setSubmitted(true)
    if (!checked.ok || !cat) return
    if (addRule(checked.value, cat)) {
      setText('')
      setCat('')
      setSubmitted(false)
    }
  }

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Merchant rules">
      <ScreenHeader title="Merchant rules" onBack={onBack} />
      <div className="screen__body">
        <section className="sect sect--settings" aria-label="Add a rule">
          <h2 className="sect__head">Add a rule</h2>
          <div className="sect__body import__intro">
            <FormField label="When the merchant contains" htmlFor="rule-text" required hint="A word such as swiggy. Not case sensitive. At least 3 letters." error={textError}>
              <input
                id="rule-text"
                className="field"
                value={text}
                maxLength={RULE_MAX}
                autoComplete="off"
                spellCheck={false}
                aria-required="true"
                aria-invalid={textError ? true : undefined}
                aria-describedby="rule-text-msg"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              />
            </FormField>
            <FormField label="Use this category" htmlFor="rule-cat" required error={catError}>
              <PickerSelect id="rule-cat" label="Category" title="Category" value={cat} placeholder="Pick a category" options={options} invalid={!!catError} describedBy={catError ? 'rule-cat-msg' : undefined} onChange={setCat} />
            </FormField>
            <button type="button" className="btn btn--primary" onClick={submit}>Add rule</button>
          </div>
          <p className="manage__help">Rules pick the category when you add from bank messages or a statement file. The newest matching rule wins. They never change entries you already added.</p>
        </section>

        <section className="sect sect--settings" aria-label="Your rules">
          <h2 className="sect__head"><span>Your rules</span><span className="sect__count">{rules.length}</span></h2>
          <div className="sect__body">
            {rules.length === 0 && <p className="manage__none">No rules yet. You can also tap "Remember this merchant" when you add an entry from a message or statement.</p>}
            {rules.map((r) => {
              const gone = !categoryUsable(budget, r.categoryId)
              return (
                <div key={r.id} className="budget__entry import__row">
                  <span className="budget__main">
                    <span className="row__label">{r.match}</span>
                    <span className="row__hint">{gone ? `Category removed (${budget.categories.find((c) => c.id === r.categoryId)?.name ?? 'unknown'}). Not used until it is back.` : categoryName(budget, r.categoryId)}</span>
                  </span>
                  <div className="import__acts">
                    <button type="button" className="link-btn link-btn--danger" aria-label={`Delete rule ${r.match}`} onClick={() => deleteRule(r.id)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
          {rules.length >= MAX_RULES && <p className="manage__help">That is the most rules you can have ({MAX_RULES}).</p>}
        </section>

        <section id="learned" className="sect sect--settings" aria-label="Learned payees">
          <h2 className="sect__head"><span>Learned payees</span><span className="sect__count">{learned.length}</span></h2>
          <div className="sect__body">
            {learned.length === 0 && <p className="manage__none">Nothing learned yet. When you approve a payment from your bank messages, Calc remembers how you tagged that payee.</p>}
            {learned.map((l) => {
              const name = l.key.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
              const gone = !categoryUsable(budget, l.categoryId)
              return (
                <div key={l.key} className="learned__item">
                  <span className="budget__main">
                    <span className="row__label">{name}</span>
                    <span className="row__hint">
                      {gone ? 'Category removed. Not used until you pick another.' : l.count >= 2 ? `Tagged the same way ${l.count} times in a row. Auto mode may add it, unless it is a person.` : 'Tagged once. Only a suggestion for now.'}
                    </span>
                  </span>
                  <div className="learned__acts">
                    <PickerSelect label={`Category for ${name}`} title={`Category for ${name}`} value={gone ? '' : l.categoryId} placeholder="Pick a category" options={options} onChange={(v) => setLearned(l.key, v)} />
                    <button type="button" className="link-btn link-btn--danger" aria-label={`Forget ${name}`} onClick={() => forgetLearned(l.key)}>Forget</button>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="manage__help">Calc counts. A payee you tag the same way twice in a row can be added for you (in Auto mode), never a person. Changing a category here, or forgetting a payee, starts the count again.</p>
        </section>
      </div>
    </div>
  )
}
