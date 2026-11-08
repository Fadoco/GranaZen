import { Capacitor, registerPlugin } from '@capacitor/core'

type BackupFilesPlugin = {
  saveBackup(options: { content: string; fileName: string }): Promise<{ status: 'saved' | 'cancelled' }>
  beginFinancialReport(options: { fileName: string }): Promise<{ status: 'selected' | 'cancelled'; sessionId?: string }>
  writeFinancialReportChunk(options: { sessionId: string; content: string; finish: boolean }): Promise<void>
  cancelFinancialReport(options: { sessionId: string }): Promise<void>
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

const REPORT_MAX_BYTES = 20 * 1024 * 1024
const REPORT_CHUNK_CHARACTERS = 8 * 1024

const nextChunkEnd = (content: string, offset: number) => {
  let end = Math.min(offset + REPORT_CHUNK_CHARACTERS, content.length)
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

  if (getUtf8ByteLength(content) > REPORT_MAX_BYTES) {
    throw new Error('O relatório excede o limite de 20 MB para exportação no Android.')
  }

  const session = await backupFilesPlugin.beginFinancialReport({ fileName })
  if (session.status === 'cancelled') return false
  if (!session.sessionId) throw new Error('O Android não iniciou a gravação do relatório.')

  try {
    if (!content.length) {
      await backupFilesPlugin.writeFinancialReportChunk({ sessionId: session.sessionId, content: '', finish: true })
    }
    for (let offset = 0; offset < content.length;) {
      const end = nextChunkEnd(content, offset)
      await backupFilesPlugin.writeFinancialReportChunk({
        sessionId: session.sessionId,
        content: content.slice(offset, end),
        finish: end === content.length,
      })
      offset = end
    }
    return true
  } catch (error) {
    await backupFilesPlugin.cancelFinancialReport({ sessionId: session.sessionId }).catch(() => undefined)
    throw error
  }
}

export const pickBackupFile = async (): Promise<string | null> => {
  if (Capacitor.getPlatform() !== 'android') return null
  const result = await backupFilesPlugin.pickBackup()
  return result.status === 'selected' ? result.content ?? null : null
}
