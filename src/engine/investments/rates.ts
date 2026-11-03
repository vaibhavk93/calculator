/**
 * Every investment rate, limit and rule that can change. Checked 2026-11-02.
 *
 * CONFIRMED from a primary source:
 * - PPF deposit limits, 15-year term, 5-year extension blocks: Public Provident Fund Scheme, 2019
 *   (Gazette notification G.S.R. 915(E), 12 Dec 2019), paras 4, 11, 12.
 *   https://www.indiapost.gov.in/documents/offerings/schemesandservices/posb/PublicProvidentFundScheme2019English.pdf
 *   Para 4: "not less than five hundred rupees and not more than one lakh fifty thousand rupees ... in a year".
 *
 * NOT CONFIRMED from a primary source, so the app shows these only as example defaults, labelled
 * "example rate, enter your own":
 * - PPF 7.1%: press reports of the finmin notification of 30 Sep 2026 (Oct-Dec 2026 quarter); the
 *   notification itself could not be opened.
 * - EPF interest 8.25%: not checked against an EPFO circular.
 * - EPS share 8.33% of wages and the wage ceiling: older EPFO pages say ceiling Rs 15,000; PIB releases
 *   (Sep 2026) report it was raised to Rs 25,000 from 17 Sep 2026. Neither page could be opened here,
 *   so the ceiling is a user input.
 * - NPS minimum annuity share and annuity rate: PFRDA exit rules have been revised; not checked.
 */

/** Small-savings rates are reset every quarter: this pack is stale from 1 Jan 2027. */
export const RATES_AS_OF = { asOf: '2026-11-02', until: '2027-01-01' } as const

export const PPF = {
  minYearly: '500',
  maxYearly: '150000',
  termYears: 15,
  extensionBlockYears: 5,
  confirmed: '2026-11-02',
} as const

/** Example defaults only. Never present these as the official rate. */
export const EXAMPLE = {
  ppfRate: '7.1',
  epfRate: '8.25',
  epsShare: '8.33',
  epsWageCeiling: '15000',
  npsAnnuityShare: '40',
  npsAnnuityRate: '6',
} as const
