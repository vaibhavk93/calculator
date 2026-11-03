import { D, type Dec } from '../engine'

/**
 * A budget bucket. `limit` is a plain decimal string for every month, or null for "no limit".
 * Two levels only: a top-level category (parentId null) may have subcategories; a subcategory never has children.
 */
export interface BudgetCategory {
  id: string
  name: string
  limit: string | null
  /** The top-level category this is a subcategory of, or null for a top-level one. */
  parentId: string | null
  deletedAt: number | null
  /** "This month only" limits: 'YYYY-MM' -> amount, or null for "no limit this month". An entry here wins over `limit`. */
  limitByMonth?: Record<string, string | null>
  /** Months this category exists in ('YYYY-MM'). Null or absent: every month. A subcategory without its own list uses its parent's. */
  months?: string[] | null
}

/** How an entry was paid. The six modes are fixed; the cards, accounts and wallets under them are the user's own (PayInstrument). */
export const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'credit', label: 'Credit card' },
  { id: 'debit', label: 'Debit card' },
  { id: 'netbanking', label: 'Net banking' },
  { id: 'wallet', label: 'Wallet' },
] as const
export type PaymentModeId = (typeof PAYMENT_MODES)[number]['id']
export const isPaymentMode = (v: unknown): v is PaymentModeId => PAYMENT_MODES.some((m) => m.id === v)
export const modeLabel = (id: PaymentModeId): string => PAYMENT_MODES.find((m) => m.id === id)!.label

export const INSTRUMENT_KINDS = [
  { id: 'credit', label: 'Credit card' },
  { id: 'debit', label: 'Debit card' },
  { id: 'bank', label: 'Bank account' },
  { id: 'wallet', label: 'Wallet' },
] as const
export type InstrumentKind = (typeof INSTRUMENT_KINDS)[number]['id']
export const isInstrumentKind = (v: unknown): v is InstrumentKind => INSTRUMENT_KINDS.some((k) => k.id === v)

export const NETWORKS = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'rupay', label: 'RuPay' },
  { id: 'amex', label: 'Amex' },
  { id: 'diners', label: 'Diners Club' },
] as const
export type NetworkId = (typeof NETWORKS)[number]['id']
export const isNetwork = (v: unknown): v is NetworkId => NETWORKS.some((n) => n.id === v)
export const networkLabel = (id: NetworkId): string => NETWORKS.find((n) => n.id === id)!.label

/** A card, bank account or wallet the user pays from. `rewardNote` is free text the user types; the app never assumes rewards. */
export interface PayInstrument {
  id: string
  name: string
  kind: InstrumentKind
  /** Only for credit and debit cards. */
  network: NetworkId | null
  bank: string
  /** '' or exactly 4 digits. */
  last4: string
  rewardNote: string
  deletedAt: number | null
  /** The product name, e.g. "Neo". */
  variant?: string
  holder?: string
  /** Day of the month the statement is made (credit cards), 1 to 28. */
  statementDay?: number | null
  dueDay?: number | null
  /** Plain decimal string. Credit cards only. */
  creditLimit?: string | null
  annualFee?: string | null
  /** "name@handle". Bank accounts and wallets only. */
  upiHandle?: string
  /** Bank accounts only. */
  accountType?: AccountType | null
}

export const ACCOUNT_TYPES = [
  { id: 'savings', label: 'Savings' },
  { id: 'current', label: 'Current' },
  { id: 'salary', label: 'Salary' },
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]['id']
export const isAccountType = (v: unknown): v is AccountType => ACCOUNT_TYPES.some((a) => a.id === v)

/** Common Indian banks and card issuers for pickers. Free text is still allowed. */
export const KNOWN_BANKS = [
  'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Yes Bank', 'IDFC First Bank', 'IndusInd Bank',
  'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India', 'Federal Bank', 'RBL Bank', 'AU Small Finance Bank',
  'Standard Chartered', 'HSBC', 'American Express', 'Tata Neu', 'Bank of India', 'Indian Bank', 'IDBI Bank', 'Bandhan Bank', 'South Indian Bank', 'Paytm Payments Bank',
] as const

/** Shown for UPI with no card or account picked. */
export const UPI_DEFAULT_LABEL = 'Bank account (default)'

export const MAX_INSTRUMENTS = 40
export const MAX_INSTRUMENT_NAME = 40
export const MAX_VARIANT = 40
export const MAX_HOLDER = 40
export const MAX_UPI_HANDLE = 40
export const MAX_REWARD_NOTE = 200

/** "Tata Neo ••4321", or with a product name "HDFC Regalia Gold ••4321". */
export const instrumentLabel = (i: PayInstrument): string => [i.name, i.variant?.trim(), i.last4 ? `••${i.last4}` : ''].filter(Boolean).join(' ')

/**
 * Which instruments a mode accepts. Credit, debit, net banking and wallet take their own kind.
 * UPI takes its funding source: a bank account, a debit card, a wallet, or a credit card only on RuPay.
 * Cash takes none.
 */
export function instrumentFitsMode(mode: PaymentModeId, i: Pick<PayInstrument, 'kind' | 'network'>): boolean {
  switch (mode) {
    case 'credit': return i.kind === 'credit'
    case 'debit': return i.kind === 'debit'
    case 'netbanking': return i.kind === 'bank'
    case 'wallet': return i.kind === 'wallet'
    case 'upi': return i.kind === 'bank' || i.kind === 'debit' || i.kind === 'wallet' || (i.kind === 'credit' && i.network === 'rupay')
    case 'cash': return false
  }
}

const MODE_HINT: Record<PaymentModeId, string> = {
  cash: 'Cash has no card or account to pick',
  upi: 'Pick a RuPay credit card, a bank account, a debit card or a wallet for UPI',
  credit: 'Pick a credit card for Credit card',
  debit: 'Pick a debit card for Debit card',
  netbanking: 'Pick a bank account for Net banking',
  wallet: 'Pick a wallet for Wallet',
}

/** Null when the pair is fine (no instrument is always fine), otherwise a plain message. */
export function paymentError(budget: Pick<BudgetData, 'instruments'>, mode: PaymentModeId | null, instrumentId: string | null): string | null {
  if (instrumentId === null) return null
  const i = budget.instruments.find((x) => x.id === instrumentId && x.deletedAt === null)
  if (!i) return 'That card or account was removed'
  if (mode === null) return 'Pick how it was paid first'
  return instrumentFitsMode(mode, i) ? null : MODE_HINT[mode]
}

const UPI_ORDER: Record<InstrumentKind, number> = { bank: 0, debit: 1, wallet: 2, credit: 3 }

/**
 * Live instruments a picker should offer for a mode, in the order they were added.
 * For UPI: bank accounts, debit cards, wallets, then RuPay credit cards (added order inside each group).
 * UPI with none picked is also fine: it means UPI_DEFAULT_LABEL.
 */
export function eligibleInstruments(budget: Pick<BudgetData, 'instruments'>, mode: PaymentModeId | null): PayInstrument[] {
  if (mode === null) return []
  const list = budget.instruments.filter((i) => i.deletedAt === null && instrumentFitsMode(mode, i))
  return mode === 'upi' ? list.map((i, n) => ({ i, n })).sort((a, b) => UPI_ORDER[a.i.kind] - UPI_ORDER[b.i.kind] || a.n - b.n).map((x) => x.i) : list
}

export interface InstrumentDraft {
  name: string
  kind: InstrumentKind
  network?: NetworkId | null
  bank?: string
  last4?: string
  rewardNote?: string
  variant?: string
  holder?: string
  /** A number or a typed string; blank, null and undefined mean "not set". */
  statementDay?: number | string | null
  dueDay?: number | string | null
  creditLimit?: string | null
  annualFee?: string | null
  upiHandle?: string
  accountType?: AccountType | string | null
}

export const MAX_BANK_NAME = 40
export const MAX_SUBCATEGORIES = 12
export const MAX_CATEGORY_NAME = 40
export const MAX_NOTE = 200
/** Most one entry may be: ₹10 crore. */
export const MAX_AMOUNT = '100000000'
export const MIN_DATE = '2000-01-01'

export interface InstrumentErrors {
  kind?: string
  name?: string
  bank?: string
  last4?: string
  rewardNote?: string
  variant?: string
  holder?: string
  statementDay?: string
  dueDay?: string
  creditLimit?: string
  annualFee?: string
  upiHandle?: string
  accountType?: string
}

/** What a field check can say. Each message names the fix. Null means the value is fine. */
const moneyProblem = (text: string, optional: boolean): string | null => {
  const clean = text.replace(/[,₹\s]/g, '')
  const what = optional ? 'Enter a limit above zero, or leave it empty' : 'Enter an amount above zero'
  if (clean === '' && optional) return null
  if (!/^(\d+\.?\d*|\.\d+)$/.test(clean)) return what
  const v = new D(clean)
  if (v.isZero()) return what
  if (v.decimalPlaces() > 2) return 'Use up to 2 decimal places'
  if (v.gt(MAX_AMOUNT)) return optional ? "A limit can't be more than ₹10 crore" : "Amount can't be more than ₹10 crore"
  return null
}

/** An amount for an entry: required, above zero, 2 decimals at most, up to ₹10 crore. */
export const validateAmount = (text: string): string | null => moneyProblem(text, false)

/** A monthly limit: empty means none, otherwise the same rules as an amount. */
export const validateLimit = (text: string): string | null => moneyProblem(text, true)

/** A real calendar day, from 2000-01-01 to one year after `today`. */
export function validateDate(date: string, today: Date = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return 'Pick a date'
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const real = new Date(y, mo - 1, d)
  if (real.getFullYear() !== y || real.getMonth() !== mo - 1 || real.getDate() !== d) return 'Pick a date'
  if (date < MIN_DATE) return 'Pick a date from the year 2000 onward'
  if (date > dayKey(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))) return 'That date is in the far future'
  return null
}

export interface ExpenseErrors {
  amount?: string
  date?: string
  category?: string
  paidWith?: string
}

/** True when the category is live and, for a subcategory, so is its parent. */
export function categoryUsable(budget: Pick<BudgetData, 'categories'>, id: string): boolean {
  const c = budget.categories.find((x) => x.id === id && x.deletedAt === null)
  return !!c && (c.parentId === null || budget.categories.some((x) => x.id === c.parentId && x.deletedAt === null))
}

/**
 * Every problem with an entry, by field. An empty object means it can be saved. The store checks again before saving.
 * `keepCategoryId` is the category the entry already has when it is being edited: it stays allowed even if the category
 * is not active in the date's month (entries are never dropped).
 */
export function validateExpense(
  d: { amount: string; date: string; categoryId: string | null; mode: PaymentModeId | null; instrumentId: string | null; settlement?: Settlement | null },
  budget: Pick<BudgetData, 'categories' | 'instruments'>,
  today: Date = new Date(),
  keepCategoryId: string | null = null,
): ExpenseErrors {
  const out: ExpenseErrors = {}
  const amount = validateAmount(d.amount)
  if (amount) out.amount = amount
  const date = validateDate(d.date, today)
  if (date) out.date = date
  if (d.settlement) {
    if (d.settlement === 'cardBill') {
      const card = d.instrumentId === null ? undefined : budget.instruments.find((i) => i.id === d.instrumentId && i.deletedAt === null)
      if (!card || card.kind !== 'credit') out.paidWith = 'Pick the credit card this bill is for'
    }
    return out
  }
  if (d.categoryId !== null) {
    if (!categoryUsable(budget, d.categoryId)) out.category = 'Pick a category from the list'
    else if (!date && d.categoryId !== keepCategoryId && !categoryActiveIn(budget, d.categoryId, d.date.slice(0, 7))) out.category = `That category is not used in ${monthLabel(d.date.slice(0, 7))}`
  }
  const pay = paymentError(budget, d.mode, d.instrumentId)
  if (pay) out.paidWith = pay
  return out
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/
export const isMonthKey = (v: unknown): v is string => typeof v === 'string' && MONTH_KEY.test(v)

/** Months a category is limited to, its own or its parent's; null means every month. */
export function categoryMonths(budget: Pick<BudgetData, 'categories'>, c: BudgetCategory): string[] | null {
  if (c.months && c.months.length > 0) return c.months
  const p = c.parentId === null ? undefined : budget.categories.find((x) => x.id === c.parentId)
  return p?.months && p.months.length > 0 ? p.months : null
}

/** Whether a category exists in `month` ('YYYY-MM'). Unknown ids are treated as active. */
export function categoryActiveIn(budget: Pick<BudgetData, 'categories'>, id: string, month: string): boolean {
  const c = budget.categories.find((x) => x.id === id)
  if (!c) return true
  const m = categoryMonths(budget, c)
  return m === null || m.includes(month)
}

/** Live categories and subcategories the Add-expense picker should offer for an entry in `month`. */
export const activeCategories = (budget: Pick<BudgetData, 'categories'>, month: string): BudgetCategory[] =>
  budget.categories.filter((c) => c.deletedAt === null && categoryUsable(budget, c.id) && categoryActiveIn(budget, c.id, month))

/** "only for Nov 2026" / "only for Nov 2026, Dec 2026" */
export function onlyForLabel(months: string[]): string {
  const short = (k: string) => { const [y = 1970, m = 1] = k.split('-').map(Number); return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1)) }
  return `only for ${months.map(short).join(', ')}`
}

/**
 * Null when `months` is fine for the category. Checks the format, that at least one month is chosen, that a subcategory stays
 * inside its parent's months, and that a parent's new months still cover its subcategories' own months.
 */
export function validateCategoryMonths(budget: Pick<BudgetData, 'categories'>, id: string, months: string[] | null): string | null {
  if (months === null) return null
  if (!Array.isArray(months) || months.length === 0) return 'Pick at least one month'
  if (!months.every(isMonthKey)) return 'Pick real months'
  const c = budget.categories.find((x) => x.id === id && x.deletedAt === null)
  if (!c) return 'That category was removed'
  if (c.parentId !== null) {
    const p = budget.categories.find((x) => x.id === c.parentId)
    if (p?.months && p.months.length > 0 && !months.every((m) => p.months!.includes(m))) return `The months must be inside ${p.name}'s months`
  } else {
    const kid = budget.categories.find((x) => x.parentId === id && x.deletedAt === null && x.months && x.months.some((m) => !months.includes(m)))
    if (kid) return `${kid.name} is used in months outside these. Change it first`
  }
  return null
}

/** Null when `months` can be given to a new subcategory of `parentId` (or a new top-level category when null). */
export function validateNewCategoryMonths(budget: Pick<BudgetData, 'categories'>, parentId: string | null, months: string[] | null): string | null {
  if (months === null) return null
  if (!Array.isArray(months) || months.length === 0) return 'Pick at least one month'
  if (!months.every(isMonthKey)) return 'Pick real months'
  const p = parentId === null ? undefined : budget.categories.find((x) => x.id === parentId)
  if (p?.months && p.months.length > 0 && !months.every((m) => p.months!.includes(m))) return `The months must be inside ${p.name}'s months`
  return null
}

/** The limit in force for `month`: a "this month only" entry (even null, meaning none) wins over the every-month limit. */
export function effectiveLimit(c: Pick<BudgetCategory, 'limit' | 'limitByMonth'>, month: string): string | null {
  return c.limitByMonth && Object.hasOwn(c.limitByMonth, month) ? (c.limitByMonth[month] ?? null) : c.limit
}

export function effectiveOverall(budget: Pick<BudgetData, 'overall' | 'overallByMonth'>, month: string): string | null {
  return budget.overallByMonth && Object.hasOwn(budget.overallByMonth, month) ? (budget.overallByMonth[month] ?? null) : budget.overall
}

/** Whether `month` has its own limit (or its own "no limit") instead of the every-month one. */
export const hasMonthLimit = (x: { limitByMonth?: Record<string, string | null>; overallByMonth?: Record<string, string | null> }, month: string): boolean =>
  Object.hasOwn(x.limitByMonth ?? x.overallByMonth ?? {}, month)

/** Null when `name` can be a category name, or the reason it cannot. `selfId` is the category being renamed. */
export function validateCategoryName(
  name: string,
  budget: Pick<BudgetData, 'categories'>,
  parentId: string | null = null,
  selfId?: string,
): string | null {
  const clean = name.trim()
  if (!clean) return 'Give it a name'
  if (clean.length > MAX_CATEGORY_NAME) return `Name can't be more than ${MAX_CATEGORY_NAME} characters`
  if (clean.toLowerCase() === 'uncategorised') return "That name is kept for entries with no category"
  const live = budget.categories.filter((c) => c.deletedAt === null)
  if (parentId !== null) {
    const parent = live.find((c) => c.id === parentId)
    if (!parent) return 'That category was removed'
    if (parent.parentId !== null) return "Subcategories can't have their own subcategories"
  }
  if (live.some((c) => c.id !== selfId && c.parentId === parentId && c.name.toLowerCase() === clean.toLowerCase())) return 'That name is already used here'
  if (selfId === undefined && parentId !== null && live.filter((c) => c.parentId === parentId).length >= MAX_SUBCATEGORIES) {
    return `A category can have up to ${MAX_SUBCATEGORIES} subcategories`
  }
  if (selfId === undefined && live.length >= MAX_CATEGORIES) return `You can have up to ${MAX_CATEGORIES} categories`
  return null
}

type InstrumentFields = Omit<Partial<InstrumentDraft>, 'kind'> & { kind?: string | null }

const blank = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === ''
const dayProblem = (v: unknown): string | null => {
  if (blank(v)) return null
  const t = String(v).trim()
  return /^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 28 ? null : 'Enter a day from 1 to 28'
}
/** Optional plain decimal. `allowZero` is for a fee, which may be free. */
const optionalMoney = (v: unknown, what: string, allowZero: boolean): string | null => {
  if (blank(v)) return null
  const clean = String(v).replace(/[,₹\s]/g, '')
  if (!/^(\d+\.?\d*|\.\d+)$/.test(clean)) return `Enter ${what} as a number`
  const n = new D(clean)
  if (!allowZero && n.isZero()) return `Enter ${what} above zero, or leave it empty`
  if (n.decimalPlaces() > 2) return 'Use up to 2 decimal places'
  if (n.gt(MAX_AMOUNT)) return "That is more than ₹10 crore"
  return null
}
const UPI_HANDLE = /^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,}$/

/** The checks that need no other data: what is typed in the fields. Fields that do not belong to the kind are an error only when filled in. */
export function validateInstrumentFields(d: InstrumentFields): InstrumentErrors {
  const out: InstrumentErrors = {}
  if (!isInstrumentKind(d.kind)) out.kind = 'Pick what this is'
  const name = String(d.name ?? '').trim()
  if (!name) out.name = 'Give it a name'
  else if (name.length > MAX_INSTRUMENT_NAME) out.name = `Name can't be more than ${MAX_INSTRUMENT_NAME} characters`
  if (String(d.bank ?? '').trim().length > MAX_BANK_NAME) out.bank = `Bank can't be more than ${MAX_BANK_NAME} characters`
  const last4 = String(d.last4 ?? '').trim()
  if (last4 !== '' && !/^\d{4}$/.test(last4)) {
    out.last4 = /^\d{5,}$/.test(last4) ? 'Enter only the last 4 digits. Calc never keeps a full card number' : 'Last 4 digits must be exactly 4 numbers'
  }
  const note = String(d.rewardNote ?? '')
  if (note.length > MAX_REWARD_NOTE) out.rewardNote = `Notes can't be more than ${MAX_REWARD_NOTE} characters`
  else if (/\d{13,}/.test(note.replace(/[\s-]/g, ''))) out.rewardNote = 'Remove the long number. Calc does not store card numbers'
  if (String(d.variant ?? '').trim().length > MAX_VARIANT) out.variant = `Card name can't be more than ${MAX_VARIANT} characters`
  if (String(d.holder ?? '').trim().length > MAX_HOLDER) out.holder = `Name can't be more than ${MAX_HOLDER} characters`
  const statement = dayProblem(d.statementDay)
  if (statement) out.statementDay = statement
  const due = dayProblem(d.dueDay)
  if (due) out.dueDay = due
  if (!blank(d.creditLimit)) out.creditLimit = d.kind !== 'credit' ? 'Only credit cards have a credit limit' : (optionalMoney(d.creditLimit, 'the limit', false) ?? undefined)
  const fee = optionalMoney(d.annualFee, 'the fee', true)
  if (fee) out.annualFee = fee
  const handle = String(d.upiHandle ?? '').trim()
  if (handle !== '') {
    if (d.kind !== 'bank' && d.kind !== 'wallet') out.upiHandle = 'Only bank accounts and wallets have a UPI ID'
    else if (handle.length > MAX_UPI_HANDLE || !UPI_HANDLE.test(handle)) out.upiHandle = 'UPI ID looks like name@bank'
  }
  if (!blank(d.accountType)) out.accountType = d.kind !== 'bank' ? 'Only bank accounts have an account type' : isAccountType(d.accountType) ? undefined : 'Pick savings, current or salary'
  for (const k of Object.keys(out) as (keyof InstrumentErrors)[]) if (out[k] === undefined) delete out[k]
  return out
}

/** Drops the fields a kind does not have (after the kind was changed), so an edit does not trip the checks above. */
export function dropInapplicable<T extends InstrumentFields>(d: T): T {
  const out = { ...d }
  if (d.kind !== 'credit') out.creditLimit = null
  if (d.kind !== 'bank' && d.kind !== 'wallet') out.upiHandle = ''
  if (d.kind !== 'bank') out.accountType = null
  return out
}

/** The field checks plus the ones that look at the other cards: a name already used for this kind, and the cap. `selfId` is the one being edited. */
export function validateInstrumentDraft(d: InstrumentFields, budget: Pick<BudgetData, 'instruments'>, selfId?: string): InstrumentErrors {
  const out = validateInstrumentFields(d)
  const live = budget.instruments.filter((i) => i.deletedAt === null)
  const name = String(d.name ?? '').trim().toLowerCase()
  if (!out.name && live.some((i) => i.id !== selfId && i.kind === d.kind && i.name.toLowerCase() === name)) out.name = 'You already have one with that name'
  if (!out.name && selfId === undefined && live.length >= MAX_INSTRUMENTS) out.name = `You can have up to ${MAX_INSTRUMENTS} cards, accounts and wallets. Delete one you no longer use`
  return out
}

const orUndef = (v: string): string | undefined => (v === '' ? undefined : v)
const plainMoney = (v: unknown): string | null => (blank(v) ? null : new D(String(v).replace(/[,₹\s]/g, '')).toFixed())
const dayOrNull = (v: unknown): number | null => (blank(v) ? null : Number(String(v).trim()))

/** Trims and checks a draft. Returns the clean fields or the reason it is not acceptable. Network is kept only for cards. Unset optional fields come back undefined. */
export function cleanInstrument(d: InstrumentDraft): { ok: true; value: Omit<PayInstrument, 'id' | 'deletedAt'> } | { ok: false; error: string } {
  const bad = validateInstrumentFields({ ...d, bank: String(d.bank ?? '').trim().slice(0, MAX_BANK_NAME), rewardNote: String(d.rewardNote ?? '').trim().slice(0, MAX_REWARD_NOTE) })
  const first = Object.values({ name: bad.name, kind: bad.kind, last4: bad.last4, rewardNote: bad.rewardNote, variant: bad.variant, holder: bad.holder, statementDay: bad.statementDay, dueDay: bad.dueDay, creditLimit: bad.creditLimit, annualFee: bad.annualFee, upiHandle: bad.upiHandle, accountType: bad.accountType }).find(Boolean)
  if (first) return { ok: false, error: first }
  const card = d.kind === 'credit' || d.kind === 'debit'
  return {
    ok: true,
    value: {
      name: String(d.name).trim(),
      kind: d.kind,
      network: card && isNetwork(d.network) ? d.network : null,
      bank: String(d.bank ?? '').trim().slice(0, MAX_BANK_NAME),
      last4: String(d.last4 ?? '').trim(),
      rewardNote: String(d.rewardNote ?? '').trim().slice(0, MAX_REWARD_NOTE),
      variant: orUndef(String(d.variant ?? '').trim()),
      holder: orUndef(String(d.holder ?? '').trim()),
      statementDay: dayOrNull(d.statementDay) ?? undefined,
      dueDay: dayOrNull(d.dueDay) ?? undefined,
      creditLimit: d.kind === 'credit' ? (plainMoney(d.creditLimit) ?? undefined) : undefined,
      annualFee: plainMoney(d.annualFee) ?? undefined,
      upiHandle: d.kind === 'bank' || d.kind === 'wallet' ? orUndef(String(d.upiHandle ?? '').trim()) : undefined,
      accountType: d.kind === 'bank' && isAccountType(d.accountType) ? d.accountType : undefined,
    },
  }
}

/** One thing spent. `date` is "YYYY-MM-DD" on the user's calendar. A null category means "Uncategorised". */
export interface BudgetExpense {
  id: string
  date: string
  amount: string
  /** A top-level category or a subcategory. Null is Uncategorised. */
  categoryId: string | null
  /** How it was paid, or null when not said. */
  mode: PaymentModeId | null
  /** The card, account or wallet it was paid from (see instrumentFitsMode), or null. */
  instrumentId: string | null
  note: string
  deletedAt: number | null
  /**
   * A card bill payment or a transfer between your own accounts. It is not spending: left out of every spend total,
   * but listed. A 'cardBill' has `instrumentId` = the credit card that was paid off, and no category.
   */
  settlement?: Settlement | null
  /** Money coming back (a returned item, a cancelled order). The amount stays positive; every total subtracts it. Never together with `settlement`. */
  refund?: boolean
  /** The recurring bill (RecurringItem.id) this entry was paid for. Set by "Repeats" and by marking a bill paid in Due. */
  recurringId?: string
}

export type Settlement = 'cardBill' | 'transfer'
export const isSettlement = (v: unknown): v is Settlement => v === 'cardBill' || v === 'transfer'
export const SETTLEMENT_LABEL: Record<Settlement, string> = { cardBill: 'Card bill payment', transfer: 'Transfer between own accounts' }

export const BILL_REPEATS = [
  { id: 'monthly', label: 'Monthly', months: 1 },
  { id: 'quarterly', label: 'Quarterly', months: 3 },
  { id: 'yearly', label: 'Yearly', months: 12 },
] as const
export type BillRepeat = (typeof BILL_REPEATS)[number]['id']
export const isBillRepeat = (v: unknown): v is BillRepeat => BILL_REPEATS.some((r) => r.id === v)
export const MAX_RECURRING = 100

/**
 * One bill or subscription that repeats. It owns BOTH the Due reminder (a task card and its reminder, found by `cardId`;
 * the next due date lives ONLY on that reminder) and the Budget entries (made when the reminder is marked paid; each carries
 * `recurringId`). 'cardBill' is a credit card's monthly bill reminder: it has no amount and never adds an entry.
 */
export interface RecurringItem {
  id: string
  kind: 'bill' | 'cardBill'
  title: string
  /** Plain decimal string. Null for a card bill. */
  amount: string | null
  repeat: BillRepeat
  categoryId: string | null
  mode: PaymentModeId | null
  /** What each entry is paid with. For a card bill: the credit card the reminder is about. */
  instrumentId: string | null
  /** The task card in Notes and Due that carries the reminder. */
  cardId: string | null
  /** True while paused: no reminder, no entries. */
  paused?: boolean
  /** Only while paused: when it was next due (ms), so Resume carries on from there. */
  pausedDue?: number
  deletedAt: number | null
}

export interface BudgetData {
  /** One limit for all spending in a month, or null. */
  overall: string | null
  /** "This month only" overall limits: 'YYYY-MM' -> amount, or null for "no limit this month". Wins over `overall`. */
  overallByMonth?: Record<string, string | null>
  categories: BudgetCategory[]
  instruments: PayInstrument[]
  expenses: BudgetExpense[]
  /** Fingerprints of bank messages already added or skipped (see smsParse.fingerprint). Not the text. Newest first. */
  smsSeen?: string[]
  /** Bills and subscriptions that repeat (see RecurringItem). Absent in older backups: none. */
  recurring?: RecurringItem[]
}

/** What the add/edit sheet sends. Mode and instrument must go together (see paymentError). */
export interface ExpenseDraft {
  amount: string
  categoryId: string | null
  mode?: PaymentModeId | null
  instrumentId?: string | null
  date: string
  note: string
  /** A card bill payment (instrumentId is the card) or an own-account transfer. Not spending. */
  settlement?: Settlement | null
  /** A refund: reduces spending. Ignored with a settlement. */
  refund?: boolean
}

export const MAX_EXPENSES = 20000
/** Live categories and subcategories together. */
export const MAX_CATEGORIES = 60

/** The categories a new install starts with: names only, no limits. They can all be renamed or removed. */
export const STARTER_CATEGORIES = ['Rent', 'Food', 'Groceries', 'Transport', 'Bills', 'Health', 'Shopping', 'Travel', 'Loan EMI', 'Savings']

export const starterBudget = (): BudgetData => ({
  overall: null,
  categories: STARTER_CATEGORIES.map((name) => ({ id: `starter-${name.toLowerCase().replace(/\W+/g, '-')}`, name, limit: null, parentId: null, deletedAt: null })),
  instruments: [],
  expenses: [],
})

/**
 * Budget maths. Totals are always worked out from the entries, never stored, so a deleted or edited
 * entry can never leave a stale total behind. Money is Decimal; entries keep it as plain strings.
 */

/** "2026-11" for a date. Local time, because "today" means the day on the user's phone. */
export const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** "2026-11-02" for a date, in local time. */
export const dayKey = (d: Date): string => `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`

export function shiftMonth(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

export function monthLabel(key: string): string {
  const [y = 1970, m = 1] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

export interface CategoryLine {
  id: string
  name: string
  parentId: string | null
  /** For a top-level line: its own entries plus all its subcategories'. */
  spent: Dec
  /** Top-level only: spent on the category itself, not in any subcategory. Zero for a subcategory line. */
  direct: Dec
  /** The monthly limit, or null when none is set. A subcategory's limit never changes its parent's. */
  limit: Dec | null
  /** limit minus spent; negative means over. Null without a limit. */
  left: Dec | null
  /** 0 to 100+, for the bar. Null without a limit. */
  pct: number | null
  /** Live subcategories (empty for a subcategory line). */
  children: CategoryLine[]
  /** Entries in the month for this line (a top-level line counts its subcategories' too). Refunds count as entries. */
  count: number
  /** Whether `limit` is for this month only, or the every-month one. */
  limitScope: 'month' | 'always'
  /** "only for Nov 2026" when the category is not active in the month but entries were recorded on it. Else null. */
  note: string | null
}

export interface Filter {
  modeId?: PaymentModeId
  /** The instrument's kind, whatever the mode: "all credit cards" is kind 'credit'. */
  kind?: InstrumentKind
  instrumentId?: string
  network?: NetworkId
  /** A top-level id matches it and all its subcategories; a subcategory id matches only itself. */
  categoryId?: string
  /**
   * A credit card's statement day (1 to 28). When set, "the month" means the statement cycle that ENDS on that day of the month:
   * the day after the previous statement day, through this month's statement day. Entries are placed by their own date.
   */
  cycleDay?: number
}

export interface MonthSummary {
  month: string
  /** Everything spent in the month that matches the filter. */
  spent: Dec
  overall: { limit: Dec; left: Dec; pct: number; scope: 'month' | 'always' } | null
  /** Live top-level categories, each with its subcategories as `children`. */
  lines: CategoryLine[]
  /** Spent in the month on entries with no category, or whose category was deleted. Never hidden. */
  uncategorised: Dec
  /** Spent per payment mode, only modes with spend. */
  byMode: { id: PaymentModeId; label: string; spent: Dec }[]
  /** Spent on entries with no mode. */
  noMode: Dec
  /** Per card, account or wallet with spend, biggest first. */
  byInstrument: { instrument: PayInstrument; spent: Dec; count: number }[]
  /** Per card network with spend (from the instrument's network), biggest first. */
  byNetwork: { id: NetworkId; label: string; spent: Dec; count: number }[]
  /** UPI entries with no card or account picked: "UPI from my bank" (UPI_DEFAULT_LABEL). Already counted under UPI in byMode. */
  upiDefault: { spent: Dec; count: number }
  /** Every entry with no card or account (cash, default UPI, no mode). Instrument-less spend, so byInstrument plus this equals `spent`. */
  noInstrument: { spent: Dec; count: number }
  /** Every live entry in the month that matches the filter, settlements included (they are not in any total). */
  entries: BudgetExpense[]
}

const parse = (s: string | null): Dec | null => {
  if (s === null) return null
  try {
    const v = new D(s)
    return v.isFinite() && !v.isNegative() ? v : null
  } catch {
    return null
  }
}

const pctOf = (spent: Dec, limit: Dec): number => (limit.isZero() ? (spent.isZero() ? 0 : 100) : Math.round(spent.div(limit).times(100).toNumber()))

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * The statement cycle that ends on `statementDay` of `month`: from the day after the previous month's statement day, to this
 * month's statement day, both included. For day 15 and 2026-11 that is 2026-10-16 to 2026-11-15. Days 1 to 28 exist in every month.
 */
export function cycleRange(statementDay: number, month: string): { from: string; to: string } {
  const prev = shiftMonth(month, -1)
  const startDay = statementDay + 1
  // Day 28 ends on the 28th, so the next cycle starts on the 29th, which may not exist: it starts on the 1st of the month instead.
  const from = startDay > daysInMonth(prev) ? `${month}-01` : `${prev}-${pad2(startDay)}`
  return { from, to: `${month}-${pad2(statementDay)}` }
}

/** Live entries in a month (or, with `cycleDay`, in that card's statement cycle), newest first. */
export function entriesIn(budget: BudgetData, month: string, cycleDay?: number): BudgetExpense[] {
  const range = cycleDay === undefined ? null : cycleRange(cycleDay, month)
  return budget.expenses.filter((e) => e.deletedAt === null && (range ? e.date >= range.from && e.date <= range.to : e.date.startsWith(month))).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
}

/** "Food" or "Food › Swiggy"; "Uncategorised" for none or a deleted one. */
export function categoryName(budget: Pick<BudgetData, 'categories'>, id: string | null): string {
  const c = budget.categories.find((x) => x.id === id && x.deletedAt === null)
  if (!c) return 'Uncategorised'
  const p = c.parentId === null ? null : budget.categories.find((x) => x.id === c.parentId && x.deletedAt === null)
  return p ? `${p.name} › ${c.name}` : c.name
}

const ZERO = () => new D(0)
/** What an entry adds to spending: its amount, or minus its amount for a refund. */
export const signedAmount = (e: Pick<BudgetExpense, 'amount' | 'refund'>): Dec => (e.refund ? (parse(e.amount) ?? ZERO()).neg() : (parse(e.amount) ?? ZERO()))
const bySpentDesc = (a: { spent: Dec }, b: { spent: Dec }) => b.spent.comparedTo(a.spent)

/** True when a live entry passes the filter. One rule for the summary, the trend and the entries list. */
export function entryMatches(budget: Pick<BudgetData, 'instruments' | 'categories'>, e: BudgetExpense, filter: Filter): boolean {
  const inst = e.instrumentId === null ? undefined : budget.instruments.find((i) => i.id === e.instrumentId)
  if (filter.modeId !== undefined && e.mode !== filter.modeId) return false
  if (filter.instrumentId !== undefined && e.instrumentId !== filter.instrumentId) return false
  if (filter.kind !== undefined && inst?.kind !== filter.kind) return false
  if (filter.network !== undefined && inst?.network !== filter.network) return false
  if (filter.categoryId !== undefined && e.categoryId !== filter.categoryId && (e.categoryId === null || budget.categories.find((c) => c.id === e.categoryId)?.parentId !== filter.categoryId)) return false
  return true
}

export function summarise(budget: BudgetData, month: string, filter: Filter = {}): MonthSummary {
  const instById = new Map(budget.instruments.map((i) => [i.id, i]))
  const entries = entriesIn(budget, month, filter.cycleDay).filter((e) => entryMatches(budget, e, filter))
  const tops = budget.categories.filter((c) => c.deletedAt === null && c.parentId === null)
  const topIds = new Set(tops.map((c) => c.id))
  // A subcategory counts only while its parent is live; otherwise its entries show as uncategorised.
  const subs = budget.categories.filter((c) => c.deletedAt === null && c.parentId !== null && topIds.has(c.parentId))
  const liveIds = new Set([...topIds, ...subs.map((c) => c.id)])

  const spentBy = new Map<string, Dec>()
  const countBy = new Map<string, number>()
  let uncategorised = ZERO()
  let spent = ZERO()
  let noMode = ZERO()
  const upiDefault = { spent: ZERO(), count: 0 }
  const noInstrument = { spent: ZERO(), count: 0 }
  const modeSpent = new Map<PaymentModeId, Dec>()
  const instSpent = new Map<string, { spent: Dec; count: number }>()
  const netSpent = new Map<NetworkId, { spent: Dec; count: number }>()
  for (const e of entries) {
    if (e.settlement) continue // a bill payment or own-account transfer is not spending
    const amount = signedAmount(e)
    spent = spent.plus(amount)
    if (e.categoryId !== null && liveIds.has(e.categoryId)) countBy.set(e.categoryId, (countBy.get(e.categoryId) ?? 0) + 1)
    if (e.mode === null) noMode = noMode.plus(amount)
    else modeSpent.set(e.mode, (modeSpent.get(e.mode) ?? ZERO()).plus(amount))
    if (e.categoryId !== null && liveIds.has(e.categoryId)) spentBy.set(e.categoryId, (spentBy.get(e.categoryId) ?? ZERO()).plus(amount))
    else uncategorised = uncategorised.plus(amount)
    const inst = e.instrumentId === null ? undefined : instById.get(e.instrumentId)
    if (inst) {
      const a = instSpent.get(inst.id) ?? { spent: ZERO(), count: 0 }
      instSpent.set(inst.id, { spent: a.spent.plus(amount), count: a.count + 1 })
      if (inst.network) {
        const n = netSpent.get(inst.network) ?? { spent: ZERO(), count: 0 }
        netSpent.set(inst.network, { spent: n.spent.plus(amount), count: n.count + 1 })
      }
    } else {
      noInstrument.spent = noInstrument.spent.plus(amount)
      noInstrument.count += 1
      if (e.mode === 'upi') {
        upiDefault.spent = upiDefault.spent.plus(amount)
        upiDefault.count += 1
      }
    }
  }

  const line = (c: BudgetCategory, own: Dec, total: Dec, children: CategoryLine[]): CategoryLine => {
    const count = (countBy.get(c.id) ?? 0) + children.reduce((t, k) => t + k.count, 0)
    const raw = effectiveLimit(c, month)
    const limit = parse(raw)
    const months = categoryMonths(budget, c)
    return {
      id: c.id, name: c.name, parentId: c.parentId, spent: total, direct: own, limit, left: limit ? limit.minus(total) : null, pct: limit ? pctOf(total, limit) : null, children, count,
      limitScope: hasMonthLimit(c, month) ? 'month' : 'always',
      note: months && !months.includes(month) ? onlyForLabel(months) : null,
    }
  }
  // A category outside its months is hidden, unless entries were recorded on it: those are never dropped.
  const lines = tops
    .map((c) => {
      const children = subs
        .filter((s) => s.parentId === c.id)
        .map((s) => line(s, ZERO(), spentBy.get(s.id) ?? ZERO(), []))
        .filter((k) => categoryActiveIn(budget, k.id, month) || !k.spent.isZero())
      const own = spentBy.get(c.id) ?? ZERO()
      return line(c, own, children.reduce((t, k) => t.plus(k.spent), own), children)
    })
    .filter((l) => categoryActiveIn(budget, l.id, month) || !l.spent.isZero())

  const overallLimit = parse(effectiveOverall(budget, month))
  return {
    month,
    spent,
    overall: overallLimit ? { limit: overallLimit, left: overallLimit.minus(spent), pct: pctOf(spent, overallLimit), scope: hasMonthLimit({ overallByMonth: budget.overallByMonth }, month) ? 'month' : 'always' } : null,
    lines,
    uncategorised,
    byMode: PAYMENT_MODES.filter((m) => modeSpent.has(m.id) && !modeSpent.get(m.id)!.isZero()).map((m) => ({ id: m.id, label: m.label, spent: modeSpent.get(m.id)! })),
    noMode,
    byInstrument: budget.instruments.filter((i) => instSpent.has(i.id)).map((i) => ({ instrument: i, ...instSpent.get(i.id)! })).sort(bySpentDesc),
    byNetwork: NETWORKS.filter((n) => netSpent.has(n.id)).map((n) => ({ id: n.id, label: n.label, ...netSpent.get(n.id)! })).sort(bySpentDesc),
    upiDefault,
    noInstrument,
    entries,
  }
}

/**
 * What a credit card still owes: its charges (mode credit, or UPI from that card; not deleted, not a settlement) minus the
 * bill payments recorded for it. Exact. Negative means paid in advance. All time, not one month.
 */
export function cardOutstanding(budget: Pick<BudgetData, 'expenses'>, instrumentId: string): Dec {
  let owed = ZERO()
  for (const e of budget.expenses) {
    if (e.deletedAt !== null || e.instrumentId !== instrumentId) continue
    const amount = signedAmount(e)
    if (e.settlement === 'cardBill') owed = owed.minus(amount)
    else if (!e.settlement && (e.mode === 'credit' || e.mode === 'upi')) owed = owed.plus(amount) // a refund is negative, so it lowers what is owed
  }
  return owed
}

/**
 * What to pre-fill when a note exactly matches (ignoring case) an earlier live entry's note.
 * Most recent date wins; the stored order breaks ties (newest added first). Null when nothing matches.
 * `categoryId` may be a subcategory, in which case `parentId` is its parent. Anything deleted comes back null.
 */
export function suggestFor(
  budget: BudgetData,
  note: string,
): { categoryId: string | null; parentId: string | null; mode: PaymentModeId | null; instrumentId: string | null } | null {
  const key = note.trim().toLowerCase()
  if (!key) return null
  let best: BudgetExpense | null = null
  for (const e of budget.expenses) {
    if (e.deletedAt !== null || e.settlement || e.note.trim().toLowerCase() !== key) continue
    if (!best || e.date > best.date) best = e
  }
  if (!best) return null
  const cat = budget.categories.find((c) => c.id === best!.categoryId && c.deletedAt === null)
  const parent = cat?.parentId ? budget.categories.find((c) => c.id === cat.parentId && c.deletedAt === null) : null
  const catOk = !!cat && (cat.parentId === null || !!parent)
  return {
    categoryId: catOk ? best.categoryId : null,
    parentId: catOk && cat!.parentId !== null ? cat!.parentId : null,
    mode: best.mode,
    instrumentId: paymentError(budget, best.mode, best.instrumentId) === null ? best.instrumentId : null,
  }
}

// ---------------------------------------------------------------- spend summary maths

const parseDay = (key: string): number => Number(key.slice(8, 10))

/** Days in a "YYYY-MM" month. */
export function daysInMonth(month: string): number {
  const [y = 1970, m = 1] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Sum of the live entries in a month that match the filter, optionally only up to and including `throughDay`. */
export function spentIn(budget: BudgetData, month: string, filter: Filter = {}, throughDay = 31): Dec {
  let total = ZERO()
  // With a statement cycle, `throughDay` (a day of the calendar month) does not apply: the whole cycle is summed.
  for (const e of entriesIn(budget, month, filter.cycleDay)) {
    if (!e.settlement && (filter.cycleDay !== undefined || parseDay(e.date) <= throughDay) && entryMatches(budget, e, filter)) total = total.plus(signedAmount(e))
  }
  return total
}

/** The `count` months ending at `month`, oldest first, same filter. Exact sums. */
export function trend(budget: BudgetData, month: string, count: number, filter: Filter = {}): { month: string; spent: Dec }[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1)).map((m) => ({ month: m, spent: spentIn(budget, m, filter) }))
}

/** Whether `month` is before, the same as, or after the month of `today`. */
const monthCmp = (month: string, today: Date): number => {
  const t = monthKey(today)
  return month < t ? -1 : month === t ? 0 : 1
}

/**
 * Average per day. This month: spent over the day of the month today (inclusive). A past month: over all its days.
 * A future month: null. Never divided by "days with entries".
 */
export function dailyAverage(spent: Dec, month: string, today: Date): { perDay: Dec; days: number } | null {
  const c = monthCmp(month, today)
  if (c > 0) return null
  const days = c === 0 ? today.getDate() : daysInMonth(month)
  return { perDay: spent.div(days), days }
}

export interface MonthCompare {
  /** The earlier month it is compared with. */
  prevMonth: string
  /** Last day compared in both months, or null for whole months. */
  throughDay: number | null
  current: Dec
  previous: Dec
  /** current minus previous; negative means less. */
  diff: Dec
  /** Whole percent change, or null when the earlier figure is zero. */
  pct: number | null
}

/**
 * This month against last month. For the current month only the same days are compared (1st to today), because half a
 * month against a whole one would say "down 50%" in week two. A past month is compared whole to whole. Future: null.
 */
export function compareLastMonth(budget: BudgetData, month: string, today: Date, filter: Filter = {}): MonthCompare | null {
  const c = monthCmp(month, today)
  if (c > 0) return null
  const prevMonth = shiftMonth(month, -1)
  const throughDay = c === 0 ? Math.min(today.getDate(), daysInMonth(prevMonth)) : null
  const current = spentIn(budget, month, filter, c === 0 ? today.getDate() : 31)
  const previous = spentIn(budget, prevMonth, filter, throughDay ?? 31)
  const diff = current.minus(previous)
  return { prevMonth, throughDay, current, previous, diff, pct: previous.lte(0) ? null : Math.round(diff.div(previous).times(100).toNumber()) }
}

/** The biggest `n` entries by amount. Ties: newest date first, then stored order. */
export function topEntries(entries: BudgetExpense[], n: number): BudgetExpense[] {
  return entries
    .filter((e) => !e.settlement && !e.refund)
    .map((e, i) => ({ e, i, a: parse(e.amount) ?? ZERO() }))
    .sort((x, y) => y.a.comparedTo(x.a) || (x.e.date === y.e.date ? x.i - y.i : x.e.date < y.e.date ? 1 : -1))
    .slice(0, n)
    .map((x) => x.e)
}

/** Whole percent of `part` in `total`; 0 when the total is zero. Callers show "under 1%" when part is above zero and this is 0. */
export const sharePercent = (part: Dec, total: Dec): number => (total.lte(0) || part.lte(0) ? 0 : Math.round(part.div(total).times(100).toNumber()))

/** Where spending stands against a limit. The 80% line is a guess (unproven): keep it in this one constant. */
export const CLOSE_AT = 0.8
export type LimitState = 'fine' | 'close' | 'reached' | 'over'
export function limitState(spent: Dec, limit: Dec): LimitState {
  if (spent.gt(limit)) return 'over'
  if (spent.eq(limit)) return 'reached'
  return spent.gte(limit.times(CLOSE_AT)) ? 'close' : 'fine'
}

export interface AttentionItem {
  id: string
  /** "Food" or "Food › Delivery". */
  name: string
  spent: Dec
  limit: Dec
  left: Dec
  state: Exclude<LimitState, 'fine'>
}

/** Categories and subcategories with a limit that are at 80% or more of it, worst first, at most `max`. */
export function needsAttention(lines: CategoryLine[], max = 3): AttentionItem[] {
  const out: AttentionItem[] = []
  for (const p of lines) {
    for (const c of [p, ...p.children]) {
      if (!c.limit) continue
      const state = limitState(c.spent, c.limit)
      if (state !== 'fine') out.push({ id: c.id, name: c.parentId ? `${p.name} › ${c.name}` : c.name, spent: c.spent, limit: c.limit, left: c.limit.minus(c.spent), state })
    }
  }
  return out.sort((a, b) => b.spent.div(b.limit).comparedTo(a.spent.div(a.limit))).slice(0, max)
}

/** About how much can be spent each remaining day (today included) to stay inside the limit. Null when not applicable. */
export function paceLeft(left: Dec, month: string, today: Date): { perDay: Dec; days: number } | null {
  if (monthCmp(month, today) !== 0 || !left.gt(0)) return null
  const days = daysInMonth(month) - today.getDate() + 1
  return { perDay: left.div(days), days }
}

// ---------------------------------------------------------------- pure helpers for the budget screens

/** "Nov 2026". */
export function monthShortLabel(key: string): string {
  const [y = 1970, m = 1] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

/** `count` months around `centre`, oldest first, with `centre` in the middle (for 12: five before it, six after). */
export const monthWindow = (centre: string, count = 12): string[] => Array.from({ length: count }, (_, i) => shiftMonth(centre, i - Math.ceil(count / 2) + 1))

/**
 * What a limit row says. `amount` is already formatted money, or null for "no limit".
 * Every month: "Monthly limit ₹X". One month only: "Limit ₹X for Nov 2026 only".
 */
export function limitLabel(amount: string | null, scope: 'month' | 'always', month: string): string {
  if (scope === 'month') return amount === null ? `No limit for ${monthShortLabel(month)} only` : `Limit ${amount} for ${monthShortLabel(month)} only`
  return amount === null ? 'No limit' : `Monthly limit ${amount}`
}

/** The most recently used categories (newest entry first), at most `n`, each usable and active in `month`. Settlements do not count. */
export function recentCategoryIds(budget: BudgetData, n: number, month: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const ordered = budget.expenses.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? 1 : -1))
  for (const { e } of ordered) {
    if (out.length >= n) break
    if (e.deletedAt !== null || e.settlement || e.categoryId === null || seen.has(e.categoryId)) continue
    seen.add(e.categoryId)
    if (categoryUsable(budget, e.categoryId) && categoryActiveIn(budget, e.categoryId, month)) out.push(e.categoryId)
  }
  return out
}

/** "Mon 3 Nov". */
export function dayLongLabel(key: string): string {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, o).format(date)
  return `${part({ weekday: 'short' })} ${d} ${part({ month: 'short' })}`
}

/** A month as weeks that start on Monday: 7 slots a row, the day of the month or null for a slot outside the month. */
export function monthWeeks(month: string): (number | null)[][] {
  const [y = 1970, m = 1] = month.split('-').map(Number)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const slots: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => i + 1)]
  while (slots.length % 7 !== 0) slots.push(null)
  return Array.from({ length: slots.length / 7 }, (_, w) => slots.slice(w * 7, w * 7 + 7))
}

export interface DayTotal {
  /** "YYYY-MM-DD". */
  date: string
  day: number
  spent: Dec
  /** Spending entries that day (settlements are not spending and are not counted). */
  count: number
  /** 0 for no spending, then 1 to 4 by the day's share of the month's biggest day: up to 25%, 50%, 75%, over 75%. */
  level: 0 | 1 | 2 | 3 | 4
}

/** One row per day of the month with what was spent (same filter as the summary) and a 5-step intensity. Exact sums. */
export function dailyTotals(budget: BudgetData, month: string, filter: Filter = {}): DayTotal[] {
  const spent = new Map<number, { total: Dec; count: number }>()
  for (const e of entriesIn(budget, month)) {
    if (e.settlement || !entryMatches(budget, e, filter)) continue
    const day = parseDay(e.date)
    const cur = spent.get(day) ?? { total: ZERO(), count: 0 }
    spent.set(day, { total: cur.total.plus(signedAmount(e)), count: cur.count + 1 })
  }
  const biggest = [...spent.values()].reduce((m, x) => (x.total.gt(m) ? x.total : m), ZERO())
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const day = i + 1
    const s = spent.get(day)
    const total = s?.total ?? ZERO()
    const level = total.gt(0) && biggest.gt(0) ? Math.min(4, Math.max(1, total.div(biggest).times(4).ceil().toNumber())) : 0
    return { date: `${month}-${String(day).padStart(2, '0')}`, day, spent: total, count: s?.count ?? 0, level: level as DayTotal['level'] }
  })
}

/** What a credit card owes, in words. `money` formats an amount. */
export function owesWords(owed: Dec, money: (v: Dec) => string): string {
  if (owed.gt(0)) return `Owes ${money(owed)}`
  if (owed.lt(0)) return `Paid ${money(owed.abs())} ahead`
  return 'Nothing owed'
}

/**
 * How much of a credit limit is in use, in words: "Using 34% of ₹1,50,000 limit". Null when no usable limit is set (missing,
 * zero or not a number), so nothing is shown rather than a made-up figure. Paid ahead counts as 0%. Over the limit says so in words.
 */
export function utilisationWords(owed: Dec, creditLimit: string | null | undefined, money: (v: Dec) => string): string | null {
  const limit = creditLimit ? parse(creditLimit) : null
  if (!limit || !limit.gt(0)) return null
  const pct = owed.gt(0) ? Math.round(owed.div(limit).times(100).toNumber()) : 0
  const base = `Using ${pct}% of ${money(limit)} limit`
  return owed.gt(limit) ? `${base}, over the limit` : base
}

/** True for a category whose own name, or its parent's, says interest, fee or charge. Only what the user named counts. */
const COST_WORDS = /interest|fee|charge/i
export function isCostCategory(budget: Pick<BudgetData, 'categories'>, id: string | null): boolean {
  const c = budget.categories.find((x) => x.id === id && x.deletedAt === null)
  if (!c) return false
  const p = c.parentId === null ? undefined : budget.categories.find((x) => x.id === c.parentId)
  return COST_WORDS.test(c.name) || (p !== undefined && COST_WORDS.test(p.name))
}

/**
 * What a card has cost in one year: its annual fee (once) plus entries paid with it that the user put in an interest, fee or
 * charge category. Only recorded data: nothing is guessed. Returns the parts and a plain sentence.
 */
export function cardCostIn(
  budget: BudgetData,
  card: Pick<PayInstrument, 'id' | 'annualFee'>,
  year: number,
  money: (v: Dec) => string,
): { fee: Dec; charges: Dec; total: Dec; words: string } {
  const fee = (card.annualFee ? parse(card.annualFee) : null) ?? ZERO()
  let charges = ZERO()
  for (const e of budget.expenses) {
    if (e.deletedAt !== null || e.settlement || e.instrumentId !== card.id || !e.date.startsWith(`${year}-`)) continue
    if (isCostCategory(budget, e.categoryId)) charges = charges.plus(signedAmount(e))
  }
  const total = fee.plus(charges)
  const parts = [fee.gt(0) ? `${money(fee)} annual fee` : '', charges.gt(0) ? `${money(charges)} in interest and fees you recorded` : ''].filter(Boolean)
  const words = parts.length === 0 ? `No annual fee, interest or fees recorded for this card in ${year}.` : `In ${year} this card has cost you ${money(total)}: ${parts.join(' and ')}.`
  return { fee, charges, total, words }
}

// ---------------------------------------------------------------- search, and a category's all-time total

/**
 * Entries whose note, category (with its parent), payment mode, card or account name, amount or kind (refund, card bill, transfer)
 * contain every word typed. Case does not matter. Commas, spaces and the rupee sign in the query are ignored for amounts, so "1,200" finds 1200.
 * An empty query returns the entries unchanged.
 */
export function searchEntries(budget: BudgetData, entries: BudgetExpense[], query: string): BudgetExpense[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return entries
  const instById = new Map(budget.instruments.map((i) => [i.id, i]))
  return entries.filter((e) => {
    const inst = e.instrumentId === null ? undefined : instById.get(e.instrumentId)
    const text = [
      e.note,
      e.settlement ? SETTLEMENT_LABEL[e.settlement] : categoryName(budget, e.categoryId),
      e.mode ? modeLabel(e.mode) : '',
      inst ? instrumentLabel(inst) : '',
      e.refund ? 'refund' : '',
      e.amount,
    ].join(' ').toLowerCase()
    return words.every((w) => text.includes(w) || text.includes(w.replace(/[,₹]/g, '')))
  })
}

/**
 * Everything ever recorded on a category (a top-level one includes its subcategories): the net amount (refunds subtracted) and how many
 * entries. Settlements are not spending. Use it for a trip or event kept as a subcategory ("Travel > Goa trip").
 * `from` and `to` ("YYYY-MM-DD") narrow it to a period, both included.
 */
export function categoryTotal(budget: BudgetData, categoryId: string, range?: { from: string; to: string }): { total: Dec; count: number } {
  let total = ZERO()
  let count = 0
  for (const e of budget.expenses) {
    if (e.deletedAt !== null || e.settlement || (range && (e.date < range.from || e.date > range.to))) continue
    if (!entryMatches(budget, e, { categoryId })) continue
    total = total.plus(signedAmount(e))
    count += 1
  }
  return { total, count }
}
