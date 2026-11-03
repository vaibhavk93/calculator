/**
 * The "next step" chip under a result (docs/MEMORY-LAYER.md 4.5). At most one, and never again once dismissed or used.
 * Only the two with an obvious, safe action exist. A SIP has none: "step it up every April" is a guess about the person.
 */
export interface Suggestion {
  id: 'emi-monthly' | 'advance-tax-pack'
  text: string
}

const BY_TOOL: Record<string, Suggestion> = {
  emi: { id: 'emi-monthly', text: 'Remind me every month on the 5th' },
  'advance-tax': { id: 'advance-tax-pack', text: 'Add all four quarterly due dates' },
}

export const suggestionFor = (toolId: string, dismissed: readonly string[]): Suggestion | null => {
  const s = BY_TOOL[toolId]
  return s && !dismissed.includes(s.id) ? s : null
}

/** The day of the month the EMI reminder is set for. */
export const EMI_REMINDER_DAY = 5
