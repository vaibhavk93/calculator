import { Sheet } from '../../components/Sheet'
import { useApp } from '../../components/StoreProvider'
import { cardRule, senderRule, type IgnoreRule } from '../../lib/smsIgnore'

/** What the message named: the card's digits and bank, and the sender header. `cardName` is how the person knows the card (a saved card's name). */
export interface IgnoreTarget {
  last4: string | null
  bank: string | null
  sender: string | null
  cardName?: string
}

/** True when there is anything to ignore (card digits or a bank-style sender). */
export const canIgnore = (t: IgnoreTarget): boolean => cardRule(t) !== null || senderRule(t.sender) !== null

/**
 * "Ignore this card" / "Ignore this sender", for an Inbox item or a manual-scan item. One tap on the choice confirms it; the sheet says
 * in plain words what that does. `onDone` gets the rule so the caller can drop matching rows it is showing.
 */
export function IgnoreSheet({ target, onClose, onDone }: { target: IgnoreTarget; onClose: () => void; onDone?: (rule: IgnoreRule) => void }) {
  const addIgnore = useApp((s) => s.addIgnore)
  const toast = useApp((s) => s.toast)
  const card = cardRule(target, target.cardName)
  const sender = senderRule(target.sender)

  const go = (rule: IgnoreRule) => {
    const n = addIgnore(rule)
    if (n === null) return
    onDone?.(rule)
    onClose()
    if (n > 0) toast(`Ignoring ${rule.label}. ${n === 1 ? '1 payment' : `${n} payments`} removed from To review.`)
  }

  return (
    <Sheet
      title="Ignore messages?"
      onClose={onClose}
      footer={
        <>
          {card && <button type="button" className="btn btn--primary" onClick={() => go(card)}>Ignore this card</button>}
          {sender && <button type="button" className="btn" onClick={() => go(sender)}>Ignore this sender</button>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="capture">
        <p className="capture__text">Pick one. Messages from it are dropped the moment they arrive. They are not saved, not added to To review or to your budget, and not counted for learning.</p>
        {card && <p className="capture__text"><span className="capture__lead">This card.</span> Every message that names {card.label}, from any sender.</p>}
        {sender && <p className="capture__text"><span className="capture__lead">This sender.</span> Every message from {sender.sender}, about any card.</p>}
        <p className="capture__text">Anything already waiting from it is removed from To review. You can stop ignoring any time in Settings, Bank messages, Ignored.</p>
      </div>
    </Sheet>
  )
}
