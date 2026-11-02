import { D, type Dec } from '../decimal'

export interface GradeRow { marks: Dec; maxMarks: Dec; credits: Dec }

/**
 * Credit-weighted average. `percent` is the weighted average of marks / max x 100.
 * `gpa10` is the same figure on a straight 10-point scale (percent / 10). Universities map marks to
 * grade points in their own ways, so this is a plain scale, not any one university's table.
 * Null if there are no rows, a max or credit is zero or less, marks are negative, or marks exceed max.
 */
export function gradeAverage(rows: GradeRow[]): { percent: Dec; gpa10: Dec; totalCredits: Dec } | null {
  if (rows.length === 0) return null
  let weighted = new D(0)
  let totalCredits = new D(0)
  for (const r of rows) {
    if (r.maxMarks.lte(0) || r.credits.lte(0) || r.marks.isNegative() || r.marks.gt(r.maxMarks)) return null
    weighted = weighted.plus(r.marks.div(r.maxMarks).times(100).times(r.credits))
    totalCredits = totalCredits.plus(r.credits)
  }
  const percent = weighted.div(totalCredits)
  return { percent, gpa10: percent.div(10), totalCredits }
}
