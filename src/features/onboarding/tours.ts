import type { TourId } from '../../store/types'

/** What a "Try it" link can do. The screen that opened the tour decides how; a tour opened from Settings has no Try links. */
export type TryAction = 'add-expense' | 'manage' | 'import' | 'summary' | 'bills' | 'tools' | 'new-list' | 'todo' | 'reliable'

export interface TourStep {
  /** Unique inside its tour. Never shown. */
  id: string
  heading: string
  /** Two or three short, plain sentences. */
  text: string
  /** A small link that closes the tour and opens the screen the step talks about. */
  try?: { label: string; action: TryAction }
}

export interface Tour {
  id: TourId
  /** The sheet title. */
  title: string
  /** "See what you can do in ___" on the first-visit row and the Settings row. */
  place: string
  steps: TourStep[]
}

/**
 * All the words of the first-run tours, in one place so they are easy to change.
 * Every step describes something the app does now. If a feature changes, change its step.
 */
export const TOURS: Record<TourId, Tour> = {
  budget: {
    id: 'budget',
    title: 'Budget: what you can do',
    place: 'Budget',
    steps: [
      {
        id: 'add',
        heading: 'Add what you spend',
        text: 'Tap Add expense. Type the amount, pick a category and say how you paid: cash, UPI, a card or a wallet. You can change or delete an entry later.',
        try: { label: 'Try it: Add an expense', action: 'add-expense' },
      },
      {
        id: 'limits',
        heading: 'Categories and monthly limits',
        text: 'Sort spending into categories, with subcategories inside them, like Travel and then Goa trip. Give a category a limit, for every month or for one month only. The home page tells you when you are close to a limit.',
        try: { label: 'Try it: Categories and cards', action: 'manage' },
      },
      {
        id: 'cards',
        heading: 'Cards, accounts and wallets',
        text: 'Add your cards, bank accounts and wallets. When you pay by UPI, say which account the money came from. For a credit card you can add the statement day, the due day and the limit.',
        try: { label: 'Try it: Cards and accounts', action: 'manage' },
      },
      {
        id: 'messages',
        heading: 'Add from bank messages',
        text: 'This is optional. Calc asks for permission only when you scan. It reads your bank texts on this phone and sends nothing anywhere. You choose what to add. You can also pick a statement saved as a CSV file.',
        try: { label: 'Try it: Add from bank messages', action: 'import' },
      },
      {
        id: 'summary',
        heading: 'See where it went',
        text: 'The Spending summary shows each month by category and by how you paid. Filter by card or category, search all your entries, and see a day-by-day map of what you spent.',
        try: { label: 'Try it: Spending summary', action: 'summary' },
      },
      {
        id: 'bills',
        heading: 'Bills, subscriptions and refunds',
        text: 'Turn rent or Netflix into a bill. Calc shows what it costs a year and reminds you when it is due. When money comes back, add a Refund and it is taken off your totals.',
        try: { label: 'Try it: Bills and subscriptions', action: 'bills' },
      },
      {
        id: 'export',
        heading: 'Keep a copy',
        text: 'You can export your entries as a CSV file for a spreadsheet. Pick this month, the last 3 months, this year or everything. It is in Settings, under Your data, as Export expenses.',
      },
    ],
  },
  notes: {
    id: 'notes',
    title: 'Notes and to-do: what you can do',
    place: 'Notes and to-do',
    steps: [
      {
        id: 'save',
        heading: 'Save a calculation',
        text: 'Press Save on any calculator. Give it a name, tags and a note. It shows up here, and you can open it again later.',
        try: { label: 'Try it: Open Tools', action: 'tools' },
      },
      {
        id: 'lists',
        heading: 'Lists with a running total',
        text: 'Tap New, then New list, and add lines with amounts. Calc keeps the total. Show checkboxes to make it a checklist, then tap a line to mark it Paid or Skipped. Skipped lines are left out of the total.',
        try: { label: 'Try it: New list', action: 'new-list' },
      },
      {
        id: 'tags',
        heading: 'Tags, pin and search',
        text: 'Add tags to find things faster, then tap a tag to filter. Tap the pin to keep a note at the top. The search box finds words in your notes.',
      },
      {
        id: 'todo',
        heading: 'To-do',
        text: 'Switch to To-do at the top. Type a task and tap Add. Today shows what is due now, Upcoming shows what is later and All shows everything. A task can repeat, and ticking it can be undone.',
        try: { label: 'Try it: Open To-do', action: 'todo' },
      },
      {
        id: 'trash',
        heading: 'Deleting is safe',
        text: 'A deleted note or task goes to Trash. Trash keeps it for 7 days. Tap Restore to bring it back.',
      },
      {
        id: 'backup',
        heading: 'Keep a backup',
        text: 'Everything stays on this phone. To keep a copy, open Settings and tap Export a backup. You can restore it later, even on a new phone.',
      },
    ],
  },
  due: {
    id: 'due',
    title: 'Due: what you can do',
    place: 'Due and reminders',
    steps: [
      {
        id: 'make',
        heading: 'Make a reminder',
        text: 'On any calculator result, tap Remind me. You can also add a reminder to a task or a list. It shows here under Overdue, This week or Later. If it has an amount, the total due soon shows at the top.',
      },
      {
        id: 'repeat',
        heading: 'Repeat and heads-up days',
        text: 'A reminder can repeat every month, quarter or year. Or choose Repeat after I tick it, and the next date counts from the day you tick it. Ask for a heads-up on the day, or 1, 3, 7, 14 or 30 days before.',
      },
      {
        id: 'paid',
        heading: 'Mark paid or snooze',
        text: 'Tap the round check beside a reminder when you have paid or done it. A repeating reminder moves to its next date. Tap the three dots to snooze it for 1 day, 3 days or a week. Removing a reminder always asks first.',
      },
      {
        id: 'tax',
        heading: 'Advance tax in one tap',
        text: 'Add a pack: advance tax adds four reminders, for 15 Jun, 15 Sep, 15 Dec and 15 Mar. Then you can edit them like any other reminder.',
      },
      {
        id: 'reliable',
        heading: 'Make sure reminders arrive',
        text: 'Some phones stop apps in the background, and a reminder can come late. In Settings, tap Send a test reminder to check. If it does not show, tap Make reminders reliable and follow the steps for your phone.',
        try: { label: 'Try it: Make reminders reliable', action: 'reliable' },
      },
    ],
  },
}

export const TOUR_LIST: Tour[] = [TOURS.budget, TOURS.notes, TOURS.due]
