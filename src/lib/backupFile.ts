import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { downloadTextFile } from './device'

/**
 * Saves a backup into its own Download/Calc folder (Android) through the local BackupFile plugin, or as an
 * ordinary browser download on the web.
 *
 * Folder-exists rule: Android cannot list an empty folder without a storage permission, and an app only sees
 * files it created. So "no Calc files yet" is treated as "folder absent" and we ask once. The answer is
 * remembered under FOLDER_OK_KEY so later backups do not ask again.
 */
interface BackupFilePlugin {
  hasBackupFolder(): Promise<{ exists: boolean }>
  saveBackup(o: { filename: string; text: string }): Promise<{ uri: string; path: string }>
  openBackupFolder(o?: { uri?: string }): Promise<{ opened: 'folder' | 'downloads' }>
}

export const FOLDER_OK_KEY = 'vkcalc.backupFolderOk'

const plugin = registerPlugin<BackupFilePlugin>('BackupFile')

export type SaveBackupResult =
  | { ok: true; where: string; open: () => Promise<void> }
  | { ok: false; reason: 'declined' | 'failed'; message: string }

export async function saveBackupFile(
  filename: string,
  text: string,
  confirmCreate: () => Promise<boolean>,
): Promise<SaveBackupResult> {
  if (!Capacitor.isNativePlatform()) {
    try {
      downloadTextFile(filename, text)
      return { ok: true, where: 'your downloads', open: async () => undefined }
    } catch (e) {
      return { ok: false, reason: 'failed', message: errText(e) }
    }
  }
  try {
    const remembered = (await Preferences.get({ key: FOLDER_OK_KEY })).value === '1'
    if (!remembered && !(await plugin.hasBackupFolder()).exists) {
      if (!(await confirmCreate())) return { ok: false, reason: 'declined', message: 'No backup was saved.' }
    }
    const saved = await plugin.saveBackup({ filename, text })
    await Preferences.set({ key: FOLDER_OK_KEY, value: '1' })
    return {
      ok: true,
      where: saved.path,
      open: async () => {
        await plugin.openBackupFolder({ uri: saved.uri })
      },
    }
  } catch (e) {
    return { ok: false, reason: 'failed', message: errText(e) }
  }
}

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Could not save the backup.')
