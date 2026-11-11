import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { payeeKey, payeeKindFor } from '../../lib/payeeKey'

/**
 * The pieces the two review lists share: "Add from messages" (ImportScreen) and "To review" (InboxScreen).
 * One look for both: a payee or payment is a row (name left, amount right, small facts under it), and its actions are
 * one tidy row of real buttons: the main one filled, the others outlined. Styles: `.rv__*` in budget.css.
 * Grouping stays by hairline: a repeat payee is one header row, its payments sit under a left hairline.
 */

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** A group of payments opens by itself when it is small (2), and is closed when it is 3 or more. A tap flips that. */
export const OPEN_BY_DEFAULT_BELOW = 3
export const groupIsOpen = (size: number, flipped: boolean) => (size < OPEN_BY_DEFAULT_BELOW) !== flipped

/**
 * Optional fields the message reader is going to add (merged duplicates, and "this is your own money"). They do not exist on the
 * data yet, so everything here reads them defensively and shows nothing when they are missing.
 */
export interface ReviewExtras {
  /** How many messages were folded into this one payment (more than 1 shows "N messages merged"). */
  mergedFrom?: number
  /** 'ownMoney' = a move between the person's own accounts, a refund or the like, not spending. */
  nature?: string
  ownKind?: string
  /** Plain-words reason it looks like your own money. */
  ownWhy?: string
}
const extras = (x: object): ReviewExtras => x as ReviewExtras
export const isOwnMoney = (x: object): boolean => extras(x).nature === 'ownMoney'
export const ownWhyOf = (x: object): string => (isOwnMoney(x) ? extras(x).ownWhy ?? '' : '')
export const mergedOf = (x: object): number => { const n = extras(x).mergedFrom; return typeof n === 'number' && n > 1 ? n : 0 }

/** A row of action buttons. The first is the main one. Wide: one row. Narrow (big text or a small phone): the main one on its own line, the rest in pairs. */
export function ActRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="rv__actwrap">
      <div className={`rv__acts ${className}`.trim()}>{children}</div>
    </div>
  )
}

/**
 * The tappable top of a row. `expanded` set = this is a group header (a repeat payee) and the chevron turns. Otherwise it is one payment.
 * The chevron is always last on the first line, so every amount lines up in one column.
 */
export function RvMain({ name, amount, meta, chip, merged = 0, label, expanded, hook = '', onClick }: {
  name: string
  amount: string
  meta?: string
  chip?: string
  merged?: number
  label: string
  expanded?: boolean
  hook?: string
  onClick: () => void
}) {
  const group = expanded !== undefined
  return (
    <button type="button" className={`rv__main tap-row${group ? ' rv__main--group' : ''} ${hook}`.trim()} aria-label={label} aria-expanded={expanded} onClick={onClick}>
      <span className="rv__name">{name}</span>
      <span className="rv__end">
        <span className="rv__amt">{amount}</span>
        <Icon name="chevron" size={18} className={expanded ? 'tap-row__chev tap-row__chev--open' : 'tap-row__chev'} />
      </span>
      {(meta || chip || merged > 0) && (
        <span className="rv__meta">
          {meta && <span>{meta}</span>}
          {merged > 0 && <span className="rv__merged">{merged} messages merged</span>}
          {chip && <span className="rv__chip">{chip}</span>}
        </span>
      )}
    </button>
  )
}

/** A category section heading: a small quiet label with the count and total on the right. Lighter than a payee row on purpose. */
/** `meta` is left out when the section holds one payee: that payee's own row already says the same count and total. */
export function CatHead({ name, meta, hook = '' }: { name: string; meta?: string; hook?: string }) {
  return (
    <h3 className={`rv__cat ${hook}`.trim()}>
      <span>{name}</span>
      {meta && <span className="rv__catmeta">{meta}</span>}
    </h3>
  )
}

/** Where the less common actions of an Inbox payment live, in plain words. The buttons are in the footer, like every sheet. */
export function MoreSheet({ title, onNotSpend, onIgnore, onClose }: { title: string; onNotSpend: () => void; onIgnore?: () => void; onClose: () => void }) {
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={() => { onNotSpend(); onClose() }}>Not a spend</button>
          {onIgnore && <button type="button" className="btn" onClick={() => { onClose(); onIgnore() }}>Ignore this card or sender</button>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="capture">
        <p className="capture__text"><span className="capture__lead">Not a spend.</span> Money moved, but it is not spending: a transfer to your own account, a refund. It leaves To review and nothing is added.</p>
        {onIgnore && <p className="capture__text"><span className="capture__lead">Ignore.</span> Stop seeing messages from this card or sender. You can undo it in Settings.</p>}
      </div>
    </Sheet>
  )
}

/** Two outlined buttons, neither pre-picked. */
export function OwnAccountChoice({ onOwn, onSomeone }: { onOwn: () => void; onSomeone: () => void }) {
  return (
    <ActRow>
      <button type="button" className="btn" onClick={onOwn}>This is my own account</button>
      <button type="button" className="btn" onClick={onSomeone}>Someone else</button>
    </ActRow>
  )
}

/**
 * "Is this payee your own account?" for a payment to a name that could be you. Reads and writes what the person has taught the app
 * (store `markPayeeSelf`, which has its own Undo): unanswered shows the question, answered shows what was learned and a way to change it.
 * Items from the same payee re-sort themselves (own account = your own money, not a spend).
 */
export function PayeeKindChoice({ merchant }: { merchant: string }) {
  const kinds = useApp((s) => s.budget.payeeKinds)
  const mark = useApp((s) => s.markPayeeSelf)
  const key = payeeKey(merchant)
  if (key === null) return null
  const kind = payeeKindFor(kinds, key)
  if (kind === 'self') {
    return (
      <>
        <p className="rv__why">Marked as your own account.</p>
        <ActRow><button type="button" className="btn" onClick={() => mark(key, false)}>Someone else</button></ActRow>
      </>
    )
  }
  if (kind === 'person') {
    return (
      <>
        <p className="rv__why">Marked as someone else.</p>
        <ActRow><button type="button" className="btn" onClick={() => mark(key, true)}>This is my own account</button></ActRow>
      </>
    )
  }
  return (
    <>
      <p className="rv__why">Is {merchant} your own account?</p>
      <OwnAccountChoice onOwn={() => mark(key, true)} onSomeone={() => mark(key, false)} />
    </>
  )
}
