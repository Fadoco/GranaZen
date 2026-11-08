import { Capacitor, registerPlugin } from '@capacitor/core'

type BackupFilesPlugin = {
  beginBackup(options: { fileName: string }): Promise<{ status: 'selected' | 'cancelled'; sessionId?: string }>
  writeBackupChunk(options: { sessionId: string; content: string; finish: boolean }): Promise<void>
  cancelBackup(options: { sessionId: string }): Promise<void>
  beginFinancialReport(options: { fileName: string }): Promise<{ status: 'selected' | 'cancelled'; sessionId?: string }>
  writeFinancialReportChunk(options: { sessionId: string; content: string; finish: boolean }): Promise<void>
  cancelFinancialReport(options: { sessionId: string }): Promise<void>
  pickBackup(): Promise<{ status: 'selected' | 'cancelled'; content?: string }>
}

const backupFilesPlugin = registerPlugin<BackupFilesPlugin>('BackupFiles')

const MAX_FILE_BYTES = 20 * 1024 * 1024
const FILE_CHUNK_CHARACTERS = 8 * 1024

const nextChunkEnd = (content: string, offset: number) => {
  let end = Math.min(offset + FILE_CHUNK_CHARACTERS, content.length)
  if (end < content.length) {
    const lastCharacter = content.charCodeAt(end - 1)
    const nextCharacter = content.charCodeAt(end)
    if (lastCharacter >= 0xd800 && lastCharacter <= 0xdbff && nextCharacter >= 0xdc00 && nextCharacter <= 0xdfff) end -= 1
  }
  return end
}

const getUtf8ByteLength = (content: string) => {
  const encoder = new TextEncoder()
  let byteLength = 0
  for (let offset = 0; offset < content.length;) {
    const end = nextChunkEnd(content, offset)
    byteLength += encoder.encode(content.slice(offset, end)).byteLength
    offset = end
  }
  return byteLength
}

const saveAndroidFileInChunks = async (
  content: string,
  fileName: string,
  begin: (options: { fileName: string }) => Promise<{ status: 'selected' | 'cancelled'; sessionId?: string }>,
  writeChunk: (options: { sessionId: string; content: string; finish: boolean }) => Promise<void>,
  cancel: (options: { sessionId: string }) => Promise<void>,
) => {
  if (getUtf8ByteLength(content) > MAX_FILE_BYTES) {
    throw new Error('O arquivo excede o limite de 20 MB para exportação no Android.')
  }

  const session = await begin({ fileName })
  if (session.status === 'cancelled') return false
  if (!session.sessionId) throw new Error('O Android não iniciou a gravação do arquivo.')

  try {
    if (!content.length) await writeChunk({ sessionId: session.sessionId, content: '', finish: true })
    for (let offset = 0; offset < content.length;) {
      const end = nextChunkEnd(content, offset)
      await writeChunk({
        sessionId: session.sessionId,
        content: content.slice(offset, end),
        finish: end === content.length,
      })
      offset = end
    }
    return true
  } catch (error) {
    await cancel({ sessionId: session.sessionId }).catch(() => undefined)
    throw error
  }
}

export const saveBackupFile = async (content: string, fileName: string) => {
  if (Capacitor.getPlatform() === 'android') {
    return saveAndroidFileInChunks(
      content,
      fileName,
      backupFilesPlugin.beginBackup,
      backupFilesPlugin.writeBackupChunk,
      backupFilesPlugin.cancelBackup,
    )
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

export const saveFinancialReportFile = async (content: string, fileName: string) => {
  if (Capacitor.getPlatform() !== 'android') {
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

  return saveAndroidFileInChunks(
    content,
    fileName,
    backupFilesPlugin.beginFinancialReport,
    backupFilesPlugin.writeFinancialReportChunk,
    backupFilesPlugin.cancelFinancialReport,
  )
}

export const pickBackupFile = async (): Promise<string | null> => {
  if (Capacitor.getPlatform() !== 'android') return null
  const result = await backupFilesPlugin.pickBackup()
  return result.status === 'selected' ? result.content ?? null : null
}
