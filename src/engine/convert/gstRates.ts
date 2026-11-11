/**
 * GST rate presets offered as buttons. The user can always type a custom rate instead.
 *
 * Source: Ministry of Finance press release (PIB), "Recommendations of the 56th Meeting of the GST Council",
 *   3 Sept 2025, https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163555
 *   It states a 2-rate structure: standard rate 18%, merit rate 5%, special de-merit rate 40% for a select few
 *   goods and services, and that the new service and goods rates apply from 22 Sept 2025
 *   (tobacco items followed a later date). The old 12% and 28% slabs are gone for most items.
 * Checked: 2026-11-02. Not offered as presets (use Custom): 0.25% and 3% (diamonds, gold), which this
 *   release did not confirm. 12% and 28% remain possible via Custom for old invoices.
 * Which slab an item falls in comes from the HSN/SAC rate notifications, not from this app.
 */
export const GST_RATES_AS_OF = '2 Nov 2026'

/** The GST Council changes slabs on no schedule; 31 Mar 2027 (year end, pre-Budget meetings) is the point to say "check". */
export const RATES_AS_OF = { asOf: '2026-11-02', until: '2027-03-31' } as const

export const GST_PRESETS: { value: string; label: string }[] = [
  { value: '0', label: '0% (nil)' },
  { value: '5', label: '5% (merit)' },
  { value: '18', label: '18% (standard)' },
  { value: '40', label: '40% (special)' },
]

/**
 * Gold jewellery GST, read 2026-11-06 (`docs/RESEARCH-BLOCKED-2026-11-06.md` section 4), re-checked the same day.
 *
 * - **3% on jewellery.** Notification 9/2025-Central Tax (Rate), 17 Sep 2025, G.S.R. 641(E), from 22 Sep 2025:
 *   "Schedule IV- 1.5%", serial 10, heading 7113 "Articles of jewellery and parts thereof, of precious metal or of
 *   metal clad with precious metal". 1.5% central + 1.5% state = 3%.
 *   https://www.taxheal.com/wp-content/uploads/2025/09/266209-9-2025-central-tax-rate-17.09.25.pdf
 * - **Schedule IV was NOT touched by the 30 Apr 2026 amendment.** CONFIRMED 2026-11-06 from the signed text of
 *   Notification 01/2026-Central Tax (Rate), 30 Apr 2026 (a copy at https://www.caalley.com/gst26/01-2026-CTR-Eng.pdf;
 *   its IGST twin 01/2026-Integrated Tax (Rate) says the same): it amends only Schedule I (S. No. 150, 151) and
 *   Schedule III (S. No. 2, 3), all heading 2202 drinks, from 1 May 2026. Its own footnote says 9/2025 was last
 *   amended by 19/2025-Central Tax (Rate), 31 Dec 2025 (G.S.R. 946(E)), which a secondary summary describes as adding
 *   biris to Schedule II; that notification's own text was NOT opened (the PDF would not extract), so "Schedule IV
 *   untouched by 19/2025" rests on that summary only.
 * - **Which bill the 3% is on.** CBEC Gems & Jewellery FAQ (GST Council host), Q7: "GST is payable at the rate of 3% of
 *   the total transaction value of jewellery, whether the making charge is shown separately or not."
 *   https://www.gstcouncil.gov.in/sites/default/files/2024-02/sectoral-fq-gems-jewellery.pdf . CGST Act s.15(2)(c) puts
 *   "any amount charged for anything done by the supplier in respect of the supply" in the value. The FAQ is guidance,
 *   not a notification.
 * - **5% is job work only.** Notification 15/2025-Central Tax (Rate), G.S.R. 663(E): job work on products of
 *   Chapter 71 other than diamonds, 2.5% central (5% in all), on the job charges only (FAQ Q8). It is NOT the rate on
 *   a ready piece bought from a shop, so a shop billing 5% on making is over-charging on this reading.
 *
 * ASSUMPTIONS (flagged on screen):
 * - Inter-state sale: IGST 3%. The IGST notification for heading 7113 was not read; 3% is 1.5% + 1.5% by the same
 *   schedule structure.
 * - Price per gram for 22K, 18K, 14K = the 24K rate x karat / 24. Shops quote their own rate (BIS fineness 916 for
 *   22K is 91.6%, not 91.67%), so the screen lets you type the rate for your purity.
 * - Old-gold exchange and lab-grown stones are not modelled: no source here settles the GST treatment.
 */
export const GOLD = {
  ratePct: '3',
  cgstPct: '1.5',
  sgstPct: '1.5',
  igstPct: '3',
  /** Job work on own gold (not a ready piece): total GST on the job charge only. */
  jobWorkPct: '5',
  karats: [24, 22, 18, 14] as const,
  source: 'Notification 9/2025-Central Tax (Rate), Schedule IV serial 10 (heading 7113); GST Council jewellery FAQ Q7',
} as const

/** Gold GST was re-read on 2026-11-06 and is checked by the next Council meeting or 31 Mar 2027. */
export const GOLD_AS_OF = { asOf: '2026-11-06', until: '2027-03-31' } as const

