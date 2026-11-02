import type { ReactNode } from 'react'

export type IconName =
  | 'history'
  | 'menu'
  | 'more'
  | 'up'
  | 'undo'
  | 'backspace'
  | 'calculate'
  | 'tools'
  | 'saved'
  | 'due'
  | 'back'
  | 'close'
  | 'trash'
  | 'check'
  | 'chevron'

const PATHS: Record<IconName, ReactNode> = {
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v5h5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  more: (
    <>
      <circle cx="5" cy="12" r="0.6" />
      <circle cx="12" cy="12" r="0.6" />
      <circle cx="19" cy="12" r="0.6" />
    </>
  ),
  up: <path d="M6 15l6-6 6 6" />,
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  backspace: (
    <>
      <path d="M21 5H9l-6 7 6 7h12z" />
      <path d="M17 9.5l-5 5M12 9.5l5 5" />
    </>
  ),
  calculate: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M8 7h8M8 12h3M8 16.5h3M15 12v4.5" />
    </>
  ),
  tools: <path d="M4 6h16M4 12h16M4 18h16" />,
  saved: <path d="M5 4.5h14v16l-7-4.2-7 4.2z" />,
  due: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
}

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}
