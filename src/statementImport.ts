import { isValidDateValue } from './financeUtils.ts'

export type StatementEntry = {
  date: string
  name: string
  amount: number
  kind: 'expense' | 'extra'
  category: 'Outros' | 'Renda extra'
  notes: string
  sourceId?: string
}

const normalizeHeader = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')

type StatementIdentity = Pick<StatementEntry, 'date' | 'name' | 'amount'> &
  Partial<Pick<StatementEntry, 'kind' | 'notes' | 'sourceId'>>

const normalizedTransactionName = (name: string) =>
  normalizeHeader(name.replace(/\b\d{9,16}\b/g, ' ')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const legacySourceId = (entry: StatementIdentity) =>
  entry.sourceId ?? (entry.notes?.startsWith('Importado de extrato PDF') ? entry.name.match(/\b\d{9,16}\b/)?.[0] : undefined)

const statementNameKey = (entry: StatementIdentity) =>
  `${entry.date}|${entry.amount.toFixed(2)}|${normalizedTransactionName(entry.name)}`

const statementSourceKey = (entry: StatementIdentity, sourceId: string, includeFlow: boolean) =>
  `${entry.date}|${sourceId}|${entry.amount.toFixed(2)}${includeFlow && entry.kind ? `|${entry.kind === 'expense' ? 'expense' : 'income'}` : ''}`

export const selectNonDuplicateStatementEntries = (
  entries: StatementIdentity[],
  existingEntries: StatementIdentity[],
) => {
  const knownSourceEntries = new Set<string>()
  const knownLegacySourceEntries = new Set<string>()
  const knownLegacyNames = new Set<string>()
  const knownNames = new Set<string>()
  const addKnownEntry = (entry: StatementIdentity) => {
    knownNames.add(statementNameKey(entry))
    if (entry.sourceId) knownSourceEntries.add(statementSourceKey(entry, entry.sourceId, true))
    else {
      const sourceId = legacySourceId(entry)
      if (sourceId) knownLegacySourceEntries.add(statementSourceKey(entry, sourceId, false))
      else knownLegacyNames.add(statementNameKey(entry))
    }
  }
  existingEntries.forEach(addKnownEntry)

  return entries.map((entry) => {
    const nameKey = statementNameKey(entry)
    const sourceId = entry.sourceId
    const sourceKey = sourceId ? statementSourceKey(entry, sourceId, true) : ''
    const legacySourceKey = sourceId ? statementSourceKey(entry, sourceId, false) : ''
    const isDuplicate = sourceId
      ? knownSourceEntries.has(sourceKey) || knownLegacySourceEntries.has(legacySourceKey) || knownLegacyNames.has(nameKey)
      : knownNames.has(nameKey)
    if (isDuplicate) return false
    knownNames.add(nameKey)
    if (sourceId) knownSourceEntries.add(sourceKey)
    else knownLegacyNames.add(nameKey)
    return true
  })
}

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

const parsePdfDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [day, month, year] = value.split(/[./-]/)
  return `${year}-${month}-${day}`
}

const parsePdfAmount = (value: string) => {
  const negative = /[-−]|\(/.test(value)
  const cleaned = value.replace(/[R$\s()−-]/g, '')
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const amount = Number(normalized)
  return Number.isFinite(amount) ? (negative ? -amount : amount) : null
}

export const parsePdfStatementText = (content: string): StatementEntry[] => {
  const datePattern = /(?<!\d)(\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4})(?!\d)/
  const amountPattern = /(?:R\$\s*)?[-−]?\s*(?:\(\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2}|\.\d{2})\s*\)?/g
  const entries: StatementEntry[] = []
  let activeEntry: StatementEntry | undefined

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      activeEntry = undefined
      continue
    }

    const normalizedLine = normalizeHeader(trimmedLine)
    if (/^(data|extrato de conta|detalhe dos movimentos|saldo inicial|saldo final|entradas|saidas|data de geracao|mercado pago instituicao|voce tem alguma duvida|www\.)\b/.test(normalizedLine) || /^\d+\s*\/\s*\d+$/.test(trimmedLine)) {
      activeEntry = undefined
      continue
    }

    const dateMatch = datePattern.exec(line)
    if (!dateMatch) {
      if (activeEntry) {
        const continuation = trimmedLine
          .replace(amountPattern, ' ')
          .replace(/\b\d{9,16}\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (continuation) activeEntry.name = `${activeEntry.name} ${continuation}`.slice(0, 100)
      }
      continue
    }

    activeEntry = undefined
    const date = parsePdfDate(dateMatch[1])
    if (!isValidDateValue(date)) continue

    const amounts = [...line.matchAll(amountPattern)]
      .map((match) => ({ value: parsePdfAmount(match[0]), text: match[0] }))
      .filter((amount): amount is { value: number; text: string } => amount.value !== null && amount.value !== 0)
    if (!amounts.length) continue

    const selected = amounts[0]
    const withoutAmounts = line.replace(dateMatch[0], ' ').replace(amountPattern, ' ')
    const sourceId = withoutAmounts.match(/\b\d{9,16}\b/)?.[0]
    const description = line
      .replace(dateMatch[0], ' ')
      .replace(amountPattern, ' ')
      .replace(/\b\d{9,16}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!description || /^(data|historico|descri[cç][aã]o|lan[cç]amento)$/i.test(description)) continue

    const entry: StatementEntry = {
      date,
      name: description.slice(0, 100),
      amount: Math.abs(selected.value),
      kind: selected.value > 0 ? 'extra' : 'expense',
      category: selected.value > 0 ? 'Renda extra' : 'Outros',
      notes: 'Importado de extrato PDF',
      ...(sourceId ? { sourceId } : {}),
    }
    entries.push(entry)
    activeEntry = entry
  }

  if (!entries.length) {
    throw new Error('Não foram encontrados lançamentos de texto neste PDF. Confira se ele permite selecionar/copiar texto; PDFs digitalizados como imagem não são compatíveis.')
  }
  if (entries.length > 1000) throw new Error('O arquivo tem mais de 1.000 lançamentos. Divida o extrato em arquivos menores.')
  return entries
}

export const parseStatementFile = (fileName: string, content: string): StatementEntry[] => {
  if (content.length > 10 * 1024 * 1024) throw new Error('O extrato excede o limite de 10 MB.')
  const extension = fileName.toLocaleLowerCase('pt-BR').split('.').pop()
  if (extension === 'csv' || extension === 'txt') return parseCsv(content)
  if (extension === 'ofx') return parseOfx(content)
  throw new Error('Formato não suportado. Escolha um arquivo CSV ou OFX.')
}
