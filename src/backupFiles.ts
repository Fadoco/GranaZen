import { Capacitor, registerPlugin } from '@capacitor/core'

type BackupFilesPlugin = {
  saveBackup(options: { content: string; fileName: string }): Promise<{ status: 'saved' | 'cancelled' }>
  pickBackup(): Promise<{ status: 'selected' | 'cancelled'; content?: string }>
}

const backupFilesPlugin = registerPlugin<BackupFilesPlugin>('BackupFiles')

export const saveBackupFile = async (content: string, fileName: string) => {
  if (Capacitor.getPlatform() === 'android') {
    const result = await backupFilesPlugin.saveBackup({ content, fileName })
    return result.status === 'saved'
  }

  const file = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export const pickBackupFile = async (): Promise<string | null> => {
  if (Capacitor.getPlatform() !== 'android') return null
  const result = await backupFilesPlugin.pickBackup()
  return result.status === 'selected' ? result.content ?? null : null
}
