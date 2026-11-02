/**
 * Every income-tax rate, slab, limit and date the tax calculators use, for FY 2026-27
 * ("tax year 2026-27" in the Income-tax Act, 2025; AY 2027-28 in the old wording).
 * Checked 2026-11-02. To move to a new year: copy this file, change the values and the
 * sources, and pass the new object to the engine functions (they all take `rules`).
 *
 * PRIMARY SOURCES
 * 1. Income-tax Act, 2025 (No. 30 of 2025), Gazette of India Extraordinary Part II s.1 No. 35, 21 Aug 2025,
 *    in force 1 Apr 2026: https://egazette.gov.in/WriteReadData/2025/265620.pdf (read in full, 2026-11-02)
 *    - s.202(1) new-regime slabs (default regime); s.202(2) what the new regime disallows.
 *    - s.19(1) Table Sl.1 professional tax (old regime only, per s.202(2)(a)(iv)); Sl.2 standard deduction
 *      Rs 75,000 (new regime) / Rs 50,000 (old); Sl.5 and Sl.6 gratuity exemption.
 *    - s.22(2), (5) self-occupied home-loan interest cap Rs 2,00,000 (old regime only, s.202(2)(a)(v)).
 *    - s.123 (old 80C) Rs 1,50,000. s.124(1)-(2) employer NPS: 10% of salary, 14% in the new regime or for a
 *      government employer; s.124(3) own NPS Rs 50,000 (old 80CCD(1B)). s.126 health insurance (old 80D):
 *      Rs 25,000 each for self/family and parents, Rs 50,000 where the insured person is a senior citizen.
 *      s.202(2)(a)(xii): in the new regime only s.124(1)-(2) (employer NPS) survives from Chapter VIII.
 *    - s.156(1) rebate (old regime): up to Rs 12,500 if total income <= Rs 5,00,000.
 *      s.156(2) rebate (new regime): up to Rs 60,000 if income <= Rs 12,00,000, with marginal relief above it.
 *    - s.2(101) short-term asset: held <= 24 months; <= 12 months for listed securities and equity-fund units.
 *      s.76 specified (debt) mutual fund bought on/after 1 Apr 2023: always short-term.
 *      s.196 equity STCG 20%. s.197 LTCG 12.5%; s.197(3) land/building bought before 23 Jul 2024: tax is the
 *      lower of 12.5% without indexation and 20% with indexation. s.198 equity LTCG 12.5% above Rs 1,25,000.
 *    - s.58(2) Table Sl.3 (old 44ADA): 50% of gross receipts, receipts <= Rs 50 lakh, or <= Rs 75 lakh if cash
 *      receipts are <= 5% of the total. s.403(3) residents aged 60+ with no business income: no advance tax.
 *    - s.404 advance tax due if tax for the year is Rs 10,000 or more; s.408 instalments 15/45/75/100%
 *      (15 Jun, 15 Sep, 15 Dec, 15 Mar); s.408(2) presumptive (s.58) assessees pay all by 15 Mar.
 *    - s.424 (old 234B): 1% a month or part, from 1 April after the year, if advance tax paid < 90% of assessed tax.
 *      s.425 (old 234C): 3% (1st-3rd instalment) / 1% (4th) of the shortfall; no interest if 12% paid by
 *      15 Jun and 36% by 15 Sep.
 *    - s.516: total income and tax payable rounded to the nearest Rs 10.
 *    - s.536(2)(j): notifications under the 1961 Act continue in force.
 * 2. Finance Bill 2026, Memorandum explaining the provisions, Part A "Rates of income-tax", section II
 *    (tax year 2026-27 under the 2025 Act): https://www.indiabudget.gov.in/doc/memo.pdf (read 2026-11-02).
 *    New-regime slabs unchanged; old-regime slabs by age (Part I-B Para A); surcharge 10/15/25/37%, 37% not in
 *    the new regime (capped at 25%), 15% cap on capital gains under ss.196-198 and dividends; marginal relief
 *    on surcharge; 4% Health and Education Cess on tax plus surcharge. Finance Bill text:
 *    https://www.indiabudget.gov.in/doc/Finance_Bill.pdf (no amendment found to ss.19, 58 limits, 123-126,
 *    156, 196-198, 408, or the s.425 rates). NOT CHECKED: the Finance Act 2026 as finally passed.
 * 3. Budget Speech 2025-26, Annexure to Part B (worked examples used in the tests):
 *    https://www.indiabudget.gov.in/budget2025-26/doc/budget_speech.pdf
 * 4. incometax.gov.in "Return applicable" page (old-regime cumulative slab tax and surcharge table, AY 2026-27):
 *    https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1 (read 2026-11-02).
 * 5. Cost Inflation Index: CBDT Notification 85/2026, S.O. 3889(E), 15 Jul 2026, under s.72 of the 2025 Act
 *    (2026-27 = 384) and the CII table at https://www.incometaxindia.gov.in/w/cost-inflation-index.
 *    That site refuses automated fetches; values were read from its search-indexed pages and match
 *    every secondary table checked. Earlier years are the long-standing series from 2001-02 (base 100).
 * 6. Gratuity: Payment of Gratuity Act 1972 s.4(2) (15 days' wages = monthly wage x 15 / 26, per completed
 *    year, a part year over 6 months counts as a year) and s.4(3) ceiling Rs 20 lakh. That Act was folded into
 *    the Code on Social Security, 2020 from 21 Nov 2025; reports say the ceiling there is still Rs 20 lakh.
 *    Not-covered exemption limit Rs 20 lakh: CBDT notification S.O. 1213(E), 8 Mar 2019, kept in force by
 *    s.536(2)(j). NOT read in primary form: the Code's gratuity section and its notified ceiling.
 *
 * NOT IN THIS FILE because no primary source could be read: the HRA rule under the Income-tax Rules, 2026
 * (G.S.R. 198(E), 20 Mar 2026; reports say the 50% list grew to eight cities), and the EPF wage ceiling.
 */

export interface Slab {
  /** Upper bound of this band, or null for "and above". */
  upTo: string | null
  ratePct: string
}

export type AgeBand = 'below60' | '60to80' | '80plus'

export const RULES_FY2026_27 = {
  fy: '2026-27',
  ay: '2027-28',
  checked: '2 Nov 2026',
  fyStart: '2026-04-01',
  fyEnd: '2027-03-31',

  newRegime: {
    slabs: [
      { upTo: '400000', ratePct: '0' },
      { upTo: '800000', ratePct: '5' },
      { upTo: '1200000', ratePct: '10' },
      { upTo: '1600000', ratePct: '15' },
      { upTo: '2000000', ratePct: '20' },
      { upTo: '2400000', ratePct: '25' },
      { upTo: null, ratePct: '30' },
    ] as Slab[],
    standardDeduction: '75000',
    rebateMax: '60000',
    rebateIncomeLimit: '1200000',
    /** s.156(2)(b): tax above the limit cannot exceed the income above the limit. */
    rebateMarginalRelief: true,
    employerNpsPctOfSalary: '14',
  },

  oldRegime: {
    slabs: {
      below60: [
        { upTo: '250000', ratePct: '0' },
        { upTo: '500000', ratePct: '5' },
        { upTo: '1000000', ratePct: '20' },
        { upTo: null, ratePct: '30' },
      ],
      '60to80': [
        { upTo: '300000', ratePct: '0' },
        { upTo: '500000', ratePct: '5' },
        { upTo: '1000000', ratePct: '20' },
        { upTo: null, ratePct: '30' },
      ],
      '80plus': [
        { upTo: '500000', ratePct: '0' },
        { upTo: '1000000', ratePct: '20' },
        { upTo: null, ratePct: '30' },
      ],
    } as Record<AgeBand, Slab[]>,
    standardDeduction: '50000',
    rebateMax: '12500',
    rebateIncomeLimit: '500000',
    rebateMarginalRelief: false,
    employerNpsPctOfSalary: '10',
    sec123Cap: '150000',
    ownNpsCap: '50000',
    healthSelfCap: '25000',
    healthParentsCap: '25000',
    healthSeniorCap: '50000',
    homeLoanInterestCap: '200000',
    /** Constitution of India, Article 276(2): tax on professions capped at Rs 2,500 a year. */
    professionalTaxCap: '2500',
  },

  /** Thresholds are "exceeding". Rate applies to the income-tax. */
  surcharge: [
    { above: '5000000', ratePct: '10' },
    { above: '10000000', ratePct: '15' },
    { above: '20000000', ratePct: '25' },
    { above: '50000000', ratePct: '37' },
  ],
  newRegimeSurchargeCapPct: '25',
  capitalGainsSurchargeCapPct: '15',
  cessPct: '4',
  /** s.516 */
  roundTo: '10',

  capitalGains: {
    /** Months held; long-term only if held MORE than this. */
    listedLongTermAfterMonths: 12,
    otherLongTermAfterMonths: 24,
    equityStcgPct: '20',
    ltcgPct: '12.5',
    equityLtcgExemption: '125000',
    propertyIndexedPct: '20',
    /** s.197(3): indexation option only for land/building bought before this date. */
    propertyIndexationBoughtBefore: '2024-07-23',
    /** s.76: units of a specified (debt) mutual fund bought on/after this date are always short-term. */
    debtFundAlwaysShortFrom: '2023-04-01',
    /** Equity bought before this date needs the 31 Jan 2018 price (grandfathering): not supported. */
    equityGrandfatherBefore: '2018-02-01',
    /** CII base year starts here; assets bought earlier need the 1 Apr 2001 value: not supported. */
    ciiBaseFrom: '2001-04-01',
    /** Cost Inflation Index by financial year (key = first calendar year of the FY). */
    cii: {
      2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117, 2006: 122, 2007: 129, 2008: 137, 2009: 148,
      2010: 167, 2011: 184, 2012: 200, 2013: 220, 2014: 240, 2015: 254, 2016: 264, 2017: 272, 2018: 280,
      2019: 289, 2020: 301, 2021: 317, 2022: 331, 2023: 348, 2024: 363, 2025: 376, 2026: 384,
    } as Record<number, number>,
  },

  advanceTax: {
    minTax: '10000',
    /** Cumulative share due by each date (MM-DD within the FY). */
    instalments: [
      { due: '2026-06-15', cumPct: '15', interestPct: '3', safeHarbourPct: '12' },
      { due: '2026-09-15', cumPct: '45', interestPct: '3', safeHarbourPct: '36' },
      { due: '2026-12-15', cumPct: '75', interestPct: '3', safeHarbourPct: null },
      { due: '2027-03-15', cumPct: '100', interestPct: '1', safeHarbourPct: null },
    ] as { due: string; cumPct: string; interestPct: string; safeHarbourPct: string | null }[],
    /** s.424: interest applies if advance tax paid is below this share of assessed tax. */
    sec424ThresholdPct: '90',
    sec424MonthlyPct: '1',
  },

  presumptive: {
    /** s.58(2) Table Sl.3 */
    deemedProfitPct: '50',
    receiptsLimit: '5000000',
    receiptsLimitLowCash: '7500000',
    lowCashMaxPct: '5',
  },

  gratuity: {
    /** Covered: days' wages per year / days in a month. */
    coveredDays: '15',
    coveredDivisor: '26',
    /** A part year above this many months counts as a full year (covered only). */
    roundUpAfterMonths: 6,
    /** Not covered: half a month's average salary per completed year. */
    notCoveredFraction: '0.5',
    ceiling: '2000000',
    exemptLimit: '2000000',
    minYears: 5,
  },

  /** EPF employee contribution, % of basic + DA (EPF Scheme 1952 para 29). Example default; user can change. */
  pfPct: '12',
}

export type TaxRules = typeof RULES_FY2026_27

/** Every result's note. */
export const taxNote = (r: TaxRules = RULES_FY2026_27) =>
  `Estimate for FY${r.fy} (AY ${r.ay}). Verify with a CA. Rules as of ${r.checked}.`
