/**
 * A dated snapshot of exchange rates, bundled with the app. The engine cannot fetch,
 * so this is what the converter uses until live refresh exists.
 *
 * Source: Frankfurter API, https://api.frankfurter.dev/v1/latest?base=INR
 *         (European Central Bank reference rates, published on working days).
 * Fetched: 2026-11-02. The rates inside are dated 2026-10-30.
 * Each number is how much of that currency 1 INR buys. Refresh by re-running the URL above.
 */
export const CURRENCY_SNAPSHOT = {
  date: '2026-10-30',
  source: 'ECB reference rates via Frankfurter',
  perInr: {
    INR: '1', AUD: '0.014992', BRL: '0.057213', CAD: '0.014712', CHF: '0.008667', CNY: '0.070066', CZK: '0.22957',
    DKK: '0.070452', EUR: '0.0094268', GBP: '0.0078601', HKD: '0.082628', HUF: '3.4533', IDR: '191.13', ILS: '0.032947',
    ISK: '1.2821', JPY: '1.6561', KRW: '14.0626', MXN: '0.19913', MYR: '0.042727', NOK: '0.09721', NZD: '0.018687',
    PHP: '0.67065', PLN: '0.041514', RON: '0.050384', SEK: '0.10349', SGD: '0.013463', THB: '0.35523', TRY: '0.52604',
    USD: '0.010532', ZAR: '0.17577',
  } as Record<string, string>,
} as const

export const CURRENCY_NAMES: Record<string, string> = {
  INR: 'Indian rupee', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', AUD: 'Australian dollar',
  BRL: 'Brazilian real', CAD: 'Canadian dollar', CHF: 'Swiss franc', CNY: 'Chinese yuan', CZK: 'Czech koruna',
  DKK: 'Danish krone', HKD: 'Hong Kong dollar', HUF: 'Hungarian forint', IDR: 'Indonesian rupiah', ILS: 'Israeli shekel',
  ISK: 'Icelandic krona', JPY: 'Japanese yen', KRW: 'South Korean won', MXN: 'Mexican peso', MYR: 'Malaysian ringgit',
  NOK: 'Norwegian krone', NZD: 'New Zealand dollar', PHP: 'Philippine peso', PLN: 'Polish zloty', RON: 'Romanian leu',
  SEK: 'Swedish krona', SGD: 'Singapore dollar', THB: 'Thai baht', TRY: 'Turkish lira', ZAR: 'South African rand',
}
