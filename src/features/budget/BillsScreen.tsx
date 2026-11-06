import { useState } from 'react'
import { FormField, RequiredNote } from '../../components/FormField'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { useApp, useAppStore } from '../../components/StoreProvider'
import { tintStyle } from '../../components/tint'
import { D } from '../../engine'
import { BILL_REPEATS, cleanPaymentCount, type BillRepeat, type RecurringItem } from '../../lib/budget'
import { billTotals, billWords, lastPaymentAt, liveBills, paymentsLeftText, validateBill } from '../../lib/recurring'
import { dueLabel } from '../../lib/reminders'
import { dayText, parseDay, shortDate } from '../../lib/tasks'
import { Segmented } from '../settings/controls'
import { GuardedFooter, MoneyInput, focusField, useDiscardGuard } from './formKit'
import { ExpenseSheet } from './sheets'
import { FitHero, useMoney } from './SpendSummary'

type SheetState = null | { kind: 'add' } | { kind: 'edit'; id: string }

/**
 * Bills and subscriptions: everything that repeats, what it costs a month and a year, when each is next due, and Pause and Stop.
 * Each item is ONE record that owns the Due reminder and the budget entries (docs/BUDGET-PLAN.md, Bills). The next due date is read
 * from the reminder, never kept twice. Reached from the Budget home; Back is handled by BudgetScreen.
 */
export function BillsScreen({ onBack }: { onBack: () => void }) {
  const budget = useApp((s) => s.budget)
  const reminders = useApp((s) => s.reminders)
  const pause = useApp((s) => s.pauseBill)
  const resume = useApp((s) => s.resumeBill)
  const stop = useApp((s) => s.stopBill)
  const money = useMoney()
  const [sheet, setSheet] = useState<SheetState>(null)

  const items = liveBills(budget)
  const bills = items.filter((i) => i.kind === 'bill')
  const cardBills = items.filter((i) => i.kind === 'cardBill')
  const totals = billTotals(items)
  const now = Date.now()
  const nextOf = (i: RecurringItem) => reminders.find((r) => r.cardId === i.cardId)?.dueAt

  const dueText = (i: RecurringItem) => {
    const at = nextOf(i)
    if (i.paused) return 'Paused: no reminder and no new entries'
    return at === undefined ? 'No reminder is set. Tap Resume to turn it on' : `Next due ${shortDate(at)} · ${dueLabel(at, now)}${i.remaining !== undefined ? ` · ${paymentsLeftText(i.remaining)}` : ''}`
  }
  // Card bill reminders have no detail sheet of their own (their day is set from Categories and cards), so
  // their Pause/Resume/Stop stay here, on the row. Regular bills open BillSheet on tap, so theirs moved there
  // instead (B20): the row already says the state in words (the title's "(paused)" and dueText's own line),
  // so no separate chip is needed, just fewer buttons.
  const cardBillActions = (i: RecurringItem) => (
    <div className="due__actions bills__actions">
      {i.paused || nextOf(i) === undefined ? (
        <button type="button" className="link-btn" aria-label={`Resume ${i.title}`} onClick={() => resume(i.id)}>Resume</button>
      ) : (
        <button type="button" className="link-btn" aria-label={`Pause ${i.title}`} onClick={() => pause(i.id)}>Pause</button>
      )}
      <button type="button" className="link-btn link-btn--danger" aria-label={`Stop ${i.title}`} onClick={() => stop(i.id)}>Stop</button>
    </div>
  )

  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Bills and subscriptions">
      <ScreenHeader title="Bills and subscriptions" onBack={onBack} />
      <div className="screen__body">
        <div className="sections">
          {totals.count > 0 && (
            <section className="sect" aria-label="What your bills cost">
              <div className="budget__sum">
                <span className="result__label">Per year, all running bills</span>
                <FitHero text={money(totals.perYear)} />
                <span className="budget__note">About {money(totals.perMonth)} a month · {totals.count} {totals.count === 1 ? 'bill' : 'bills'}</span>
              </div>
            </section>
          )}

          <section className="sect" aria-label="Bills">
            <h2 className="sect__head">
              <span>Bills</span>
              <span className="sect__count">{bills.length}</span>
            </h2>
            <div className="sect__body">
              {bills.length === 0 && <p className="budget__none">No bills yet. Add one below, or choose Repeats when you add an expense.</p>}
              {bills.map((i) => (
                <div key={i.id} className="bills__item">
                  <button type="button" className="budget__row tap-row" aria-label={`Edit ${i.title}. ${billWords(i, money)}`} onClick={() => setSheet({ kind: 'edit', id: i.id })}>
                    <span className="row__label">{i.title}{i.paused ? ' (paused)' : ''}</span>
                    <span className="budget__amt spend__amt">{money(new D(i.amount!))}</span>
                    <Icon name="chevron" size={18} className="tap-row__chev" />
                    <span className="budget__note">{billWords(i, money)}</span>
                    <span className="budget__note">{dueText(i)}</span>
                  </button>
                </div>
              ))}
            </div>
            <div className="manage__actions">
              <button type="button" className="btn btn--primary" onClick={() => setSheet({ kind: 'add' })}>Add a bill</button>
            </div>
          </section>

          {cardBills.length > 0 && (
            <section className="sect" aria-label="Card bill reminders">
              <h2 className="sect__head">
                <span>Card bill reminders</span>
                <span className="sect__count">{cardBills.length}</span>
              </h2>
              <div className="sect__body">
                {cardBills.map((i) => {
                  const day = budget.instruments.find((c) => c.id === i.instrumentId)?.dueDay
                  return (
                    <div key={i.id} className="bills__item">
                      <div className="budget__row budget__row--plain">
                        <span className="row__label">{i.title}{i.paused ? ' (paused)' : ''}</span>
                        <span className="budget__note">{day ? `Due on day ${day} of every month. ` : ''}Change the day in Categories and cards.</span>
                        <span className="budget__note">{dueText(i)}</span>
                      </div>
                      {cardBillActions(i)}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          <p className="budget__none">Marking a bill paid in Due adds that payment to your budget. Past entries stay if you stop a bill.</p>
        </div>
      </div>
      {sheet?.kind === 'add' && <ExpenseSheet title="Add a bill" startRepeat="monthly" onClose={() => setSheet(null)} />}
      {sheet?.kind === 'edit' && <BillSheet id={sheet.id} onClose={() => setSheet(null)} />}
    </div>
  )
}

/** Change a bill's name, amount, how often it repeats and (while it is running) when it is next due. */
function BillSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const budget = useApp((s) => s.budget)
  const reminders = useApp((s) => s.reminders)
  const pause = useApp((s) => s.pauseBill)
  const resume = useApp((s) => s.resumeBill)
  const stop = useApp((s) => s.stopBill)
  const store = useAppStore()
  const money = useMoney()
  const item = liveBills(budget).find((i) => i.id === id)
  const rem = item ? reminders.find((r) => r.cardId === item.cardId) : undefined
  const showDate = !!item && !item.paused && rem !== undefined
  const [start] = useState(() => ({ title: item?.title ?? '', amount: item?.amount ?? '', repeat: (item?.repeat ?? 'monthly') as BillRepeat, date: rem ? dayText(rem.dueAt) : '', left: item?.remaining === undefined ? '' : String(item.remaining) }))
  const [title, setTitle] = useState(start.title)
  const [amount, setAmount] = useState(start.amount)
  const [repeat, setRepeat] = useState(start.repeat)
  const [date, setDate] = useState(start.date)
  const [left, setLeft] = useState(start.left)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const guard = useDiscardGuard(title !== start.title || amount !== start.amount || repeat !== start.repeat || date !== start.date || left !== start.left, onClose)
  if (!item) return null

  const errors = validateBill({ title, amount, date: showDate ? date : null })
  const leftCount = cleanPaymentCount(left)
  const leftError = leftCount === undefined ? 'Use a whole number from 1 to 600, or leave it empty' : undefined
  // The date the count runs out: from the next due date shown here, so changing the date or the count changes it.
  const nextTs = showDate ? parseDay(date) : (item.pausedDue ?? null)
  const anchor = nextTs === null ? null : showDate && rem && date === start.date ? rem.anchorDay : new Date(nextTs).getDate()
  const lastText = typeof leftCount === 'number' && nextTs !== null && anchor !== null ? `Last payment on ${shortDate(lastPaymentAt(nextTs, repeat, anchor, leftCount))}` : null
  const shown = (f: 'title' | 'amount' | 'date') => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: string) => () => setTouched((t) => ({ ...t, [f]: true }))
  const aria = (f: 'title' | 'amount' | 'date') => ({ 'aria-invalid': shown(f) ? (true as const) : undefined, 'aria-describedby': shown(f) ? `bill-${f}-msg` : undefined })

  const save = () => {
    setSubmitted(true)
    const first = (['title', 'amount', 'date'] as const).find((f) => errors[f])
    if (first) return focusField(`bill-${first}`)
    if (leftError) return focusField('bill-left')
    if (store.getState().updateBill(id, { title, amount, repeat, remaining: leftCount ?? null, ...(showDate ? { date } : {}) })) return onClose()
    setStoreError(store.getState().notice?.text ?? 'Could not save this bill')
  }

  return (
    <Sheet
      title="Edit bill"
      onClose={guard.requestClose}
      footer={
        <GuardedFooter guard={guard} question="Discard your changes?">
          <button type="button" className="btn btn--primary" onClick={save}>Save changes</button>
        </GuardedFooter>
      }
    >
      <div className="save">
        <RequiredNote />
        {storeError && <p className="ffield__error" role="alert">{storeError}</p>}
        <div className="save__card" style={tintStyle(7)}>
          <FormField label="Name" htmlFor="bill-title" required error={shown('title')}>
            <input id="bill-title" className="field" value={title} maxLength={120} autoComplete="off" aria-required="true" onChange={(e) => setTitle(e.target.value)} onBlur={touch('title')} {...aria('title')} />
          </FormField>
          <FormField label="Amount in rupees" htmlFor="bill-amount" required error={shown('amount')} hint={!errors.amount ? billWords({ amount, repeat }, money) : undefined}>
            <MoneyInput id="bill-amount" value={amount} onChange={setAmount} onBlur={touch('amount')} invalid={!!shown('amount')} describedBy={shown('amount') ? 'bill-amount-msg' : undefined} />
          </FormField>
          <div className="ffield">
            <span className="ffield__label" id="bill-repeat-label">Repeats</span>
            <Segmented<BillRepeat>
              label="Repeats"
              value={repeat}
              onChange={setRepeat}
              options={BILL_REPEATS.map((r) => ({ value: r.id, label: r.label }))}
            />
          </div>
          {showDate ? (
            <FormField label="Next due" htmlFor="bill-date" required error={shown('date')} hint="When it shows up in Due">
              <input id="bill-date" className="field field--mono field--date" type="date" aria-required="true" value={date} onChange={(e) => setDate(e.target.value)} onBlur={touch('date')} {...aria('date')} />
            </FormField>
          ) : (
            <p className="ffield__hint">{item.paused ? 'Resume the bill to pick its next due date.' : 'There is no reminder for this bill. Resume it to turn the reminder on.'}</p>
          )}
          <FormField label="Payments left" htmlFor="bill-left" error={submitted || left !== start.left ? leftError : undefined} hint={lastText ?? 'Leave empty if it never ends'}>
            <input id="bill-left" className="field field--mono" inputMode="numeric" value={left} autoComplete="off" onChange={(e) => setLeft(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-invalid={leftError && left !== start.left ? true : undefined} aria-describedby="bill-left-msg" />
          </FormField>
        </div>
        <div>
          {item.paused ? (
            <button type="button" className="link-btn" onClick={() => resume(id)}>Resume this bill</button>
          ) : (
            <button type="button" className="link-btn" onClick={() => pause(id)}>Pause this bill</button>
          )}
          <button type="button" className="link-btn link-btn--danger" onClick={() => { stop(id); onClose() }}>Stop this bill</button>
        </div>
      </div>
    </Sheet>
  )
}
