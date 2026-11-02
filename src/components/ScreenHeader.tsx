import type { ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * The header of every full screen. One shape, so a person always knows where Back is and where the main action is.
 *
 *   [ Back ]  Title (wraps, never cut off)  ........  [icon actions]  [one primary text action]
 *
 * - Back is always first and always 44px.
 * - The title is one heading. A screen with an editable title (a list) passes `titleSlot` instead.
 * - `icons` are quiet icon buttons (Delete). At most two.
 * - `action` is the single main thing to do on this screen (Save, Update, Empty Trash). At most one.
 * See docs/DESIGN-SYSTEM.md, "Page anatomy".
 */
export function ScreenHeader({
  title,
  onBack,
  tint = false,
  titleSlot,
  icons,
  action,
}: {
  title: string
  onBack: () => void
  /** Colour the title with the section colour (a group page). */
  tint?: boolean
  titleSlot?: ReactNode
  icons?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="screen__bar">
      <button type="button" className="icon-btn" aria-label="Back" title="Back" onClick={onBack}>
        <Icon name="back" size={20} />
      </button>
      {titleSlot ?? <h1 className={tint ? 'screen__title screen__title--tint' : 'screen__title'}>{title}</h1>}
      <span className="screen__spacer" />
      {icons}
      {action}
    </header>
  )
}
