import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parsePdfStatementText } from './statementImport.ts'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const parsePdfStatementFile = async (content: ArrayBuffer) => {
  if (content.byteLength > 10 * 1024 * 1024) throw new Error('O extrato excede o limite de 10 MB.')

  const loadingTask = getDocument({ data: new Uint8Array(content) })
  const document = await loadingTask.promise
  if (document.numPages > 250) {
    await loadingTask.destroy()
    throw new Error('O PDF excede o limite de 250 páginas.')
  }

  try {
    const lines: { y: number; parts: { x: number; text: string }[] }[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageLines: { y: number; parts: { x: number; text: string }[] }[] = []
      const items = textContent.items.flatMap((item) => {
        if (!('str' in item) || !('transform' in item) || !item.str.trim()) return []
        return [{ x: item.transform[4], y: item.transform[5], text: item.str.trim() }]
      }).sort((first, second) => second.y - first.y || first.x - second.x)

      for (const item of items) {
        let line: { y: number; parts: { x: number; text: string }[] } | undefined = pageLines[pageLines.length - 1]
        if (line && Math.abs(line.y - item.y) > 2.5) line = undefined
        if (!line) {
          line = { y: item.y, parts: [] }
          pageLines.push(line)
        }
        line.parts.push({ x: item.x, text: item.text })
      }
      lines.push(...pageLines)
      page.cleanup()
    }
    const text = lines
      .sort((first, second) => second.y - first.y)
      .map((line) => line.parts.sort((first, second) => first.x - second.x).map((part) => part.text).join(' '))
      .join('\n')
    return parsePdfStatementText(text)
  } finally {
    await loadingTask.destroy()
  }
}