import type { ReactNode } from 'react'

/**
 * An empty screen that says what goes here and offers a way forward. Never just "nothing here".
 * `level` is 'h1' (default) when this IS the whole screen (Due, Budget with nothing in it yet); pass
 * 'h2' when it sits inside a screen that already has its own h1 (Notes and To-do, under the segmented
 * switch), so a screen reader's heading list never shows two h1s for one screen.
 */
export function EmptyState({ title, children, action, level = 'h1' }: { title: string; children: ReactNode; action?: ReactNode; level?: 'h1' | 'h2' }) {
  const Heading = level
  return (
    <div className="empty">
      <Heading>{title}</Heading>
      <p>{children}</p>
      {action}
    </div>
  )
}
