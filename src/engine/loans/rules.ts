/**
 * Every loan-related limit, rate and market figure that can change. Checked 2026-11-02.
 *
 * HOME LOAN TAX (tax year 2026-27, Income-tax Act, 2025, No. 30 of 2025, in force from 1 Apr 2026).
 * Read in the Act as published in the Gazette of India Extraordinary, Part II Section 1, No. 35, 21 Aug 2025
 * (egazette.gov.in), and the Finance Bill 2026 clauses that amend it. Consolidated text:
 * https://www.incometaxindia.gov.in/documents/d/guest/income_tax_act_2025_as_amended_by_fa_act_2026-pdf
 * - s.22(1)(b): interest on borrowed capital is deductible from house-property income.
 * - s.22(2)(a): for a self-occupied house (s.21(6)) the interest deduction is capped at Rs 2,00,000 if the
 *   loan is for purchase/construction completed within 5 years of the end of the year of borrowing;
 *   s.22(2)(b): Rs 30,000 in any other case (e.g. repairs). s.22(5): Rs 2,00,000 is the total for all
 *   self-occupied houses. Finance Bill 2026 cl.30 makes the cap include pre-construction interest (s.22(1)(c)).
 *   A let-out house has no cap on interest.
 * - s.109(1)(b): a house-property loss is set off against other heads only up to Rs 2,00,000 a year;
 *   s.110 carries the rest forward (house-property income only, 8 years).
 * - s.123 + Schedule XV para 1(r) and para 3(a)(iii): repayment of a housing loan's principal to a bank,
 *   HFC, LIC, NHB etc. is in the Rs 1,50,000 aggregate with PF, life insurance, ELSS and the rest.
 *   Reversed if the house is sold within 5 years of possession.
 * - s.202 (new regime) s.202(1)(a)(v): no deduction under s.22(1)(b) for a self-occupied house;
 *   (a)(xii): no Chapter VIII deduction (so no s.123); (b)(ii): no set-off of a house-property loss against
 *   any other head.
 *
 * CREDIT CARD GST.
 * - Notification 12/2017-Central Tax (Rate), entry 27(a): interest on loans is exempt "other than interest
 *   involved in credit card services", so card interest is taxable.
 * - Notification 11/2017-Central Tax (Rate), heading 9971 residual "Financial and related services": 9% CGST
 *   + 9% SGST = 18% (IGST 18%). GST Council services-rate chart:
 *   https://gstcouncil.gov.in/sites/default/files/2024-02/gstservicerates.pdf
 *   The 56th GST Council (PIB, 3 Sep 2025) changed only named 9971 insurance items, not this residual entry.
 *
 * LOAN PRESETS: market indications, NOT rules and NOT offers. Taken from published SBI rate pages
 * (sbi.bank.in, checked 2026-11-02) and one RBI rule. Where no figure could be checked, no rate is shown.
 */

export const LOAN_RULES_AS_OF = '2 Nov 2026'

/** Market loan rates change on any bank's say-so, so this pack is stale from the next quarter. Home loan TAX rules use the tax pack's stamp. */
export const RATES_AS_OF = { asOf: '2026-11-02', until: '2027-01-01' } as const

export const HOME_LOAN_TAX = {
  taxYear: '2026-27',
  selfOccupiedInterestCap: '200000',
  /** Let-out house: loss from house property set off against other income, per year. */
  houseLossSetOffCap: '200000',
  /** Section 123 aggregate, shared with PF, insurance, ELSS, tuition fees, etc. */
  section123Cap: '150000',
  /** Share of annual value (rent less municipal tax) deducted as standard deduction, s.22(1)(a). */
  standardDeductionPct: '30',
} as const

/** GST on credit-card interest and fees: heading 9971, 9% CGST + 9% SGST. */
export const CARD_GST_PCT = '18'

export type LoanType = 'home' | 'car' | 'personal' | 'education' | 'gold'

export interface Preset {
  label: string
  /** Typical rate band as text, or null if no figure could be checked. */
  rate: string | null
  /** Low end of the rate band, used for an example EMI. */
  rateFrom: string | null
  tenure: string
  /** Example tenure in months, for the example EMI. */
  exampleMonths: number
  source: string
}

export const PRESETS: Record<LoanType, Preset> = {
  home: {
    label: 'Home loan',
    rate: 'From 7.50% a year',
    rateFrom: '7.5',
    tenure: 'Up to 30 years, or to age 70 if sooner',
    exampleMonths: 240,
    source: 'SBI home loan rates w.e.f. 15 Oct 2026; SBI home loan MITC',
  },
  car: {
    label: 'Car loan',
    rate: '8.55% to 9.50% a year (new car, by credit score)',
    rateFrom: '8.55',
    tenure: 'Rate card has bands for 3 to 5 years and over 5 years; maximum not checked',
    exampleMonths: 60,
    source: 'SBI auto loan rate page, updated 15 Oct 2026',
  },
  personal: {
    label: 'Personal loan',
    rate: '10.00% to 15.00% a year',
    rateFrom: '10',
    tenure: '6 to 84 months',
    exampleMonths: 60,
    source: 'SBI personal loan rate page and Digi Personal Loan page',
  },
  education: {
    label: 'Education loan',
    rate: null,
    rateFrom: null,
    tenure: 'Repay over up to 15 years, after the course plus a 12-month holiday',
    exampleMonths: 120,
    source: 'SBI Student Loan Scheme. Rates depend on course, institute and collateral, so none shown',
  },
  gold: {
    label: 'Gold loan',
    rate: null,
    rateFrom: null,
    tenure: 'Bullet-repayment gold loans: up to 12 months (RBI rule). EMI gold loans vary',
    exampleMonths: 12,
    source: 'RBI (Lending Against Gold and Silver Collateral) Directions, 2025. Rate not checked, so none shown',
  },
}
