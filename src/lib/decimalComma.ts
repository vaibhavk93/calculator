/**
 * A comma typed as a decimal point (B-06). On a phone keyboard set to a comma-decimal language, "99,5" means 99.5.
 * Grouping commas ("1,500", "1,50,000") always leave 3 digits in the last group, so a final comma followed by
 * 0, 1 or 2 digits can never be grouping. Turn that one comma into a dot. A European "1.234,56" loses its dots.
 * Anything else is returned unchanged (the callers still strip the other commas).
 */
export function decimalComma(text: string): string {
  const m = /^(.*),(\d{0,2})$/s.exec(text)
  if (!m) return text
  const head = m[1]!
  if (head.includes('.') && !/^[₹\s]*\d{1,3}(\.\d{3})+$/.test(head)) return text // "1.5,5": not a pattern we can read
  return `${head.replace(/[.,]/g, '')}.${m[2]}`
}
