/**
 * Every investment rate, limit and rule that can change. Checked 2026-11-06.
 * Full reading, with the host named for every document: `docs/RESEARCH-BLOCKED-2026-11-06.md` section 1.
 *
 * CONFIRMED from a primary source:
 * - PPF deposit limits, 15-year term, 5-year extension blocks: Public Provident Fund Scheme, 2019
 *   (Gazette notification G.S.R. 915(E), 12 Dec 2019), paras 4, 11, 12.
 *   https://www.indiapost.gov.in/documents/offerings/schemesandservices/posb/PublicProvidentFundScheme2019English.pdf
 *   Para 4: "not less than five hundred rupees and not more than one lakh fifty thousand rupees ... in a year".
 * - **PPF 7.1% (upgraded from "example only" on 2026-11-06.)** Two primary documents together:
 *   (1) Office Memorandum F.No.1/4/2019-NS, 30.09.2026, Ministry of Finance, DEA (Budget Division):
 *   the Oct-Dec 2026 rates "shall remain unchanged from those notified for the second quarter". The OM
 *   carries rates forward but contains no table. dea.gov.in refuses automated fetches; the scan read was
 *   https://www.staffnews.in/wp-content/uploads/2026/10/ECE_15533.pdf (a staff-news host, not dea.gov.in).
 *   (2) The number itself from the National Savings Institute rate page (nsiindia.gov.in,
 *   InternalPage.aspx?Id_Pk=178): PPF 7.1%, in force since 01.04.2020.
 *   **Still reset every quarter** — see `RATES_AS_OF.until`. Jan-Mar 2027 is not announced (due ~30 Dec 2026).
 * - EPS wage ceiling Rs 25,000 a month from 17 Sep 2026: S.O. 5109(E), Ministry of Labour, for the
 *   purposes of Chapter III of the Code on Social Security, replacing S.O. 2702(E) (Rs 15,000).
 *   https://www.labour.gov.in/static/uploads/2026/09/2b0f1dbbd3769fc388416186ec145328.pdf
 *   Still an editable input: it is the statutory ceiling, not necessarily what a given payslip uses.
 *
 * NOT CONFIRMED from a primary source, so the app shows these only as example defaults, labelled
 * "example rate, enter your own":
 * - EPF interest 8.25%: a Central Board of Trustees *recommendation* for FY 2025-26 only, still awaiting
 *   Government notification; the FY 2026-27 rate is not declared at all. The EPFO circular URL 404s.
 * - EPS share 8.33% of wages: not re-checked against an EPFO circular.
 * - NPS minimum annuity share and annuity rate: PFRDA exit rules have been revised; not checked.
 *
 * STILL BLOCKED, deliberately not built (a missing calculator is recoverable, a wrong number is not):
 * - Post Office RD: no rule text stating quarterly compounding could be found. The scheme rules
 *   (nsiindia.gov.in Id_Pk=165) give the Rs 100 minimum and 5-year term but no compounding wording.
 * - VPF: depends on the unnotified EPF rate above.
 */

/** Small-savings rates are reset every quarter: this pack is stale from 1 Jan 2027. */
export const RATES_AS_OF = { asOf: '2026-11-06', until: '2027-01-01' } as const

export const PPF = {
  minYearly: '500',
  maxYearly: '150000',
  termYears: 15,
  extensionBlockYears: 5,
  confirmed: '2026-11-06',
  /** Primary-confirmed (see the header). Still quarterly-reset, so the screen keeps it editable. */
  rate: '7.1',
  rateSource: 'OM F.No.1/4/2019-NS, 30.09.2026',
} as const

/** Example defaults only. Never present these as the official rate. */
export const EXAMPLE = {
  /** @deprecated Use `PPF.rate` — this is now primary-confirmed, not an example. Kept so old imports compile. */
  ppfRate: PPF.rate,
  epfRate: '8.25',
  epsShare: '8.33',
  /** Statutory ceiling, S.O. 5109(E) from 17 Sep 2026 (was 15000). Still editable: payslips vary. */
  epsWageCeiling: '25000',
  npsAnnuityShare: '40',
  npsAnnuityRate: '6',
} as const
