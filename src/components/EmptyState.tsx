import type { ReactNode } from 'react'

/** An empty screen that says what goes here and offers a way forward. Never just "nothing here". */
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h1>{title}</h1>
      <p>{children}</p>
      {action}
    </div>
  )
}
