import { isValidDateValue } from './financeUtils.ts'

export type StatementEntry = {
  date: string
  name: string
  amount: number
  kind: 'expense' | 'extra'
  category: 'Outros' | 'Renda extra'
  notes: string
}

const normalizeHeader = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')

const parseCsvRows = (content: string): string[][] => {
  const rows: string[][] = []
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [';', ',', '\t'].sort((first, second) =>
    [...firstLine].filter((character) => character === second).length -
    [...firstLine].filter((character) => character === first).length,
  )[0]
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (character === delimiter && !inQuotes) {
      row.push(field.trim())
      field = ''
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (field || row.length) {
        row.push(field.trim())
        rows.push(row)
      }
      if (character === '\r' && content[index + 1] === '\n') index += 1
      row = []
      field = ''
    } else {
      field += character
    }
  }
  if (inQuotes) throw new Error('O CSV contém aspas sem fechamento.')
  if (field || row.length) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value !== ''))
}

const parseAmount = (value: string) => {
  const cleaned = value.replace(/[R$\s]/g, '')
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount === 0) throw new Error(`Valor inválido no extrato: "${value}".`)
  return amount
}

const parseCsv = (content: string): StatementEntry[] => {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new Error('O CSV precisa ter um cabeçalho e pelo menos um lançamento.')
  const headers = rows[0].map(normalizeHeader)
  const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header))
  const dateIndex = findColumn('data', 'date', 'dtposted')
  const nameIndex = findColumn('descricao', 'description', 'historico', 'memo', 'name', 'nome')
  const amountIndex = findColumn('valor', 'amount', 'value', 'trnamt')
  const typeIndex = findColumn('tipo', 'type')
  if (dateIndex < 0 || nameIndex < 0 || amountIndex < 0) {
    throw new Error('CSV não reconhecido. Inclua colunas Data, Descrição e Valor (ou Amount).')
  }
  return rows.slice(1).map((row, index) => {
    const date = row[dateIndex]?.trim()
    const name = row[nameIndex]?.trim()
    if (!isValidDateValue(date) || !name) throw new Error(`Data ou descrição inválida na linha ${index + 2}.`)
    const amount = parseAmount(row[amountIndex] ?? '')
    const typeLabel = normalizeHeader(row[typeIndex] ?? '')
    const positiveIncome = amount > 0 && (typeIndex < 0 ||
      /credito|credit|receita|income|deposito|deposit/i.test(typeLabel))
    const signedAmount = amount
    const isIncome = positiveIncome || (typeIndex >= 0 &&
      /credito|credit|receita|income|deposito|deposit/i.test(typeLabel))
    return {
      date,
      name: name.slice(0, 100),
      amount: Math.abs(signedAmount),
      kind: isIncome ? 'extra' : 'expense',
      category: isIncome ? 'Renda extra' : 'Outros',
      notes: 'Importado de extrato',
    }
  })
}

const getOfxTag = (block: string, tag: string) =>
  block.match(new RegExp(`<${tag}>([^\\r\\n<]+)`, 'i'))?.[1]?.trim() ?? ''

const parseOfxDate = (value: string) => {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!match) return ''
  return `${match[1]}-${match[2]}-${match[3]}`
}

const parseOfx = (content: string): StatementEntry[] => {
  const blocks = [...content.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi)]
  if (!blocks.length) throw new Error('Nenhuma transação foi encontrada neste arquivo OFX.')
  return blocks.map((match, index) => {
    const block = match[1]
    const date = parseOfxDate(getOfxTag(block, 'DTPOSTED'))
    const name = getOfxTag(block, 'NAME') || getOfxTag(block, 'MEMO')
    const rawAmount = getOfxTag(block, 'TRNAMT')
    const amount = Number(rawAmount.replace(',', '.'))
    if (!isValidDateValue(date) || !name || !Number.isFinite(amount) || amount === 0) {
      throw new Error(`Transação OFX inválida na posição ${index + 1}.`)
    }
    const isIncome = amount > 0
    return {
      date,
      name: name.slice(0, 100),
      amount: Math.abs(amount),
      kind: isIncome ? 'extra' : 'expense',
      category: isIncome ? 'Renda extra' : 'Outros',
      notes: 'Importado de extrato',
    }
  })
}

export const parseStatementFile = (fileName: string, content: string): StatementEntry[] => {
  if (content.length > 10 * 1024 * 1024) throw new Error('O extrato excede o limite de 10 MB.')
  const extension = fileName.toLocaleLowerCase('pt-BR').split('.').pop()
  if (extension === 'csv' || extension === 'txt') return parseCsv(content)
  if (extension === 'ofx') return parseOfx(content)
  throw new Error('Formato não suportado. Escolha um arquivo CSV ou OFX.')
}
