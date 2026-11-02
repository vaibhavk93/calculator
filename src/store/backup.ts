import { CURRENT_SCHEMA, migrate } from './persistence'
import type { PersistedData } from './types'

export const BACKUP_KIND = 'vkcalc-backup'
const MAX_BACKUP_BYTES = 5 * 1024 * 1024

export function buildBackup(data: PersistedData, now: Date = new Date()): string {
  return JSON.stringify(
    {
      kind: BACKUP_KIND,
      schemaVersion: CURRENT_SCHEMA,
      exportedAt: now.toISOString(),
      app: 'VK Calc',
      data,
    },
    null,
    2,
  )
}

export function backupFilename(now: Date = new Date()): string {
  return `vkcalc-backup-${now.toISOString().slice(0, 10)}.json`
}

export type ParsedBackup = { ok: true; data: PersistedData; exportedAt: string | null } | { ok: false; message: string }

export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, message: 'That file is too large to be a VK Calc backup.' }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, message: "That file isn't a VK Calc backup." }
  }

  if (typeof json !== 'object' || json === null || (json as { kind?: unknown }).kind !== BACKUP_KIND) {
    return { ok: false, message: "That file isn't a VK Calc backup." }
  }

  const { data, exportedAt } = json as { data?: unknown; exportedAt?: unknown }
  if (typeof data !== 'object' || data === null) return { ok: false, message: 'That backup is damaged.' }

  return {
    ok: true,
    data: migrate({ ...(data as object), schemaVersion: (json as { schemaVersion?: unknown }).schemaVersion }),
    exportedAt: typeof exportedAt === 'string' ? exportedAt : null,
  }
}
