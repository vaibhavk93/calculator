/**
 * A starter guess at a category from a merchant name, for the review lists (manual scan and Inbox).
 *
 * Plain keyword matching, no AI, no network. It only ever SUGGESTS: nothing is added because of a guess, and the auto-add
 * test in docs/SMS-INBOX-PLAN.md still needs a learned payee. The guess is mapped onto the user's OWN categories by name
 * (a category called "Eating out" matches the "food" group); when nothing fits it says nothing rather than invent a category.
 */

interface Cat {
  id: string
  name: string
  parentId?: string | null
  deletedAt: number | null
}

/** group -> [words in a merchant name, words a user's category name may contain]. */
const GROUPS: Record<string, { merchants: string[]; names: string[] }> = {
  food: {
    merchants: ['swiggy', 'zomato', 'dominos', 'domino', 'mcdonald', 'kfc', 'pizza', 'starbucks', 'cafe', 'restaurant', 'biryani', 'box8', 'faasos', 'burger', 'chai', 'tea stall', 'bakery', 'sweets', 'dhaba', 'canteen', 'eatsure', 'haldiram', 'barbeque'],
    names: ['food', 'dining', 'eating', 'restaurant', 'eat'],
  },
  groceries: {
    merchants: ['bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart', 'grofers', 'jiomart', 'reliance fresh', 'more retail', 'dairy', 'milk', 'kirana', 'supermarket', 'vegetable', 'fruits', 'provision', 'amul', 'nature basket', 'general store'],
    names: ['grocer', 'kirana', 'vegetable', 'household'],
  },
  travel: {
    merchants: ['uber', 'ola', 'rapido', 'irctc', 'redbus', 'makemytrip', 'goibibo', 'cleartrip', 'indigo', 'air india', 'metro', 'fastag', 'petrol', 'diesel', 'indian oil', 'bharat petroleum', 'hp pay', 'toll', 'yatra', 'bmtc', 'ixigo', 'akasa', 'vistara', 'fuel'],
    names: ['travel', 'transport', 'commute', 'fuel', 'cab', 'petrol'],
  },
  shopping: {
    merchants: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'tata cliq', 'decathlon', 'lifestyle', 'croma', 'reliance digital', 'ikea', 'snapdeal', 'shoppers stop', 'pantaloons'],
    names: ['shop', 'clothes', 'online'],
  },
  bills: {
    merchants: ['airtel', 'jio', 'vodafone', 'vi', 'bsnl', 'electricity', 'bescom', 'tata power', 'adani electricity', 'piped gas', 'broadband', 'fibernet', 'netflix', 'spotify', 'hotstar', 'prime video', 'youtube', 'sony liv', 'zee5', 'insurance', 'lic', 'premium', 'recharge', 'water bill', 'dth'],
    names: ['bill', 'utilit', 'subscription', 'recharge', 'phone'],
  },
  health: {
    merchants: ['pharmacy', 'apollo', 'medplus', '1mg', 'pharmeasy', 'hospital', 'clinic', 'diagnostic', 'lab', 'cult', 'gym', 'dental', 'medical'],
    names: ['health', 'medical', 'fitness', 'medicine'],
  },
  entertainment: {
    merchants: ['bookmyshow', 'pvr', 'inox', 'gaming', 'steam', 'playstation'],
    names: ['entertain', 'movie', 'fun', 'leisure'],
  },
  education: {
    merchants: ['udemy', 'coursera', 'byju', 'unacademy', 'school', 'college', 'tuition', 'fees'],
    names: ['educat', 'learn', 'school'],
  },
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim()} `

/** The group a merchant name looks like ("food"), or null. Words of 4 letters or fewer must match as whole words. */
export function guessGroup(merchant: string): string | null {
  const m = norm(merchant)
  for (const [group, g] of Object.entries(GROUPS)) {
    for (const w of g.merchants) if (w.length <= 4 ? m.includes(` ${w} `) : m.includes(w)) return group
  }
  return null
}

/** The user's own category that fits the guess, with a plain reason, or null when nothing fits. */
export function guessCategory(merchant: string, categories: readonly Cat[]): { categoryId: string; why: string } | null {
  const group = guessGroup(merchant)
  if (!group) return null
  const live = categories.filter((c) => c.deletedAt === null)
  const hit = live.filter((c) => !c.parentId).find((c) => GROUPS[group]!.names.some((n) => c.name.toLowerCase().includes(n)))
    ?? live.find((c) => GROUPS[group]!.names.some((n) => c.name.toLowerCase().includes(n)))
  return hit ? { categoryId: hit.id, why: `Looks like ${group} (from the name). A guess: check it` } : null
}
