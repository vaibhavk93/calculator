import { CURRENT_SCHEMA, migrate } from './persistence'
import type { PersistedData } from './types'

export const BACKUP_KIND = 'vkcalc-backup'
// 20,000 entries are about 3.6 MB compact; the old limit (5 MB) rejected the app's own pretty-printed backups (B-03).
const MAX_BACKUP_BYTES = 25 * 1024 * 1024

export function buildBackup(data: PersistedData, now: Date = new Date()): string {
  return JSON.stringify(
    {
      kind: BACKUP_KIND,
      schemaVersion: CURRENT_SCHEMA,
      exportedAt: now.toISOString(),
      app: 'Calc',
      data,
    },
  )
}

export function backupFilename(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `vkcalc-backup-${y}-${m}-${d}.json`
}

export type ParsedBackup = { ok: true; data: PersistedData; exportedAt: string | null } | { ok: false; message: string }

export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, message: 'That file is too large to be a Calc backup.' }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, message: "That file isn't a Calc backup." }
  }

  if (typeof json !== 'object' || json === null || (json as { kind?: unknown }).kind !== BACKUP_KIND) {
    return { ok: false, message: "That file isn't a Calc backup." }
  }

  const { data, exportedAt } = json as { data?: unknown; exportedAt?: unknown }
  if (typeof data !== 'object' || data === null) return { ok: false, message: 'That backup is damaged.' }

  return {
    ok: true,
    data: migrate({ ...(data as object), schemaVersion: (json as { schemaVersion?: unknown }).schemaVersion }),
    exportedAt: typeof exportedAt === 'string' ? exportedAt : null,
  }
}
