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
