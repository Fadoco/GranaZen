import type { Debt } from './financeTypes.ts'
import { isValidDateValue } from './financeUtils.ts'

export type FinancialReportMovement = {
  id: string
  kind: 'expense' | 'salary' | 'extra'
  category: string
  name: string
  amount: number
  date: string
  notes: string
  sourceId?: string
  walletId?: string | null
  createdAt: string
}

export type FinancialReportWallet = {
  id: string
  name: string
  kind: 'checking' | 'savings' | 'cash' | 'credit' | 'other'
  openingBalance: number
}

export type FinancialReportBudget = { id: string; category: string; limit: number; month: string }
export type FinancialReportGoal = { id: string; name: string; target: number; saved: number; deadline: string; createdAt: string }

export type FinancialAnalysisInput = {
  movements: FinancialReportMovement[]
  debts: Debt[]
  wallets: FinancialReportWallet[]
  budgets: FinancialReportBudget[]
  goals: FinancialReportGoal[]
  customExpenseCategories: string[]
}

export type FinancialAnalysisChange = {
  id: string
  action: 'updated' | 'added' | 'removed'
  before: Pick<FinancialReportMovement, 'kind' | 'category' | 'name' | 'amount' | 'date' | 'notes' | 'walletId'> | null
  after: Pick<FinancialReportMovement, 'kind' | 'category' | 'name' | 'amount' | 'date' | 'notes' | 'walletId'> | null
}

export type FinancialAnalysisProposal = {
  movements: FinancialReportMovement[]
  changes: FinancialAnalysisChange[]
  newExpenseCategories: string[]
}

type EditableMovementFields = Pick<FinancialReportMovement, 'kind' | 'category' | 'name' | 'amount' | 'date' | 'notes' | 'walletId'>
const editableMovementFields = ['kind', 'category', 'name', 'amount', 'date', 'notes', 'walletId'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const prepareFinancialAnalysisProposal = (
  value: unknown,
  currentMovements: FinancialReportMovement[],
  existingExpenseCategories: string[],
  currentCustomCategories: string[],
  currentWalletIds?: string[],
): FinancialAnalysisProposal => {
  if (!isRecord(value) || value.app !== 'GranaZen' || value.reportType !== 'financial-analysis' ||
      value.formatVersion !== 1 || !Array.isArray(value.movements)) {
    throw new Error('Arquivo incompatível. Use o relatório financeiro JSON original revisado pela IA.')
  }

  const currentById = new Map(currentMovements.map((movement) => [movement.id, movement]))
  const proposedIds = new Set<string>()
  const updates = new Map<string, EditableMovementFields>()
  const additions: FinancialReportMovement[] = []
  const newExpenseCategories = new Set<string>()
  const knownCategories = new Set([...existingExpenseCategories, ...currentCustomCategories])
  const removedIdsValue = value.removeMovementIds ?? []
  if (!Array.isArray(removedIdsValue) || removedIdsValue.some((id) => typeof id !== 'string')) {
    throw new Error('A lista de movimentos para remover está inválida.')
  }
  const removedIds = new Set(removedIdsValue as string[])
  if (removedIds.size !== removedIdsValue.length) throw new Error('Há IDs repetidos na lista de movimentos para remover.')
  for (const id of removedIds) {
    if (!currentById.has(id)) throw new Error(`O movimento ${id} não existe nos dados atuais e não pode ser removido.`)
  }

  for (const [index, item] of value.movements.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      throw new Error(`O movimento ${index + 1} não tem um ID válido.`)
    }
    const current = currentById.get(item.id)
    if (removedIds.has(item.id)) throw new Error(`O movimento ${item.id} não pode ser editado e removido ao mesmo tempo.`)
    if (proposedIds.has(item.id)) throw new Error(`O ID ${item.id} aparece mais de uma vez no arquivo.`)
    proposedIds.add(item.id)

    if (current) {
      for (const field of ['sourceId', 'createdAt'] as const) {
        if (Object.hasOwn(item, field) && item[field] !== current[field]) {
          throw new Error(`O identificador protegido "${field}" do movimento ${item.id} não pode ser alterado.`)
        }
      }
    }

    const name = item.name === undefined ? current?.name ?? '' : typeof item.name === 'string' ? item.name.trim() : ''
    const kind = item.kind === undefined ? current?.kind : item.kind
    const category = item.category === undefined ? current?.category ?? '' : typeof item.category === 'string' ? item.category.trim() : ''
    const amount = item.amount === undefined ? current?.amount : item.amount
    const date = item.date === undefined ? current?.date ?? '' : item.date
    const notes = item.notes === undefined ? current?.notes ?? '' : typeof item.notes === 'string' ? item.notes.trim() : ''
    const walletId = item.walletId === undefined ? current?.walletId ?? null : item.walletId
    if (!name || name.length > 100 || !['expense', 'salary', 'extra'].includes(String(kind))) {
      throw new Error(`Nome ou tipo inválido no movimento ${item.id}.`)
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error(`O valor do movimento ${item.id} precisa ser um número positivo.`)
    }
    if (!isValidDateValue(date)) {
      throw new Error(`A data do movimento ${item.id} é inválida.`)
    }
    if (typeof notes !== 'string' || notes.length > 1000) throw new Error(`A observação do movimento ${item.id} é inválida.`)
    if (walletId !== null && (typeof walletId !== 'string' || !walletId)) throw new Error(`A carteira do movimento ${item.id} é inválida.`)
    if (walletId && currentWalletIds && !currentWalletIds.includes(walletId)) {
      throw new Error(`A carteira do movimento ${item.id} não existe nos dados atuais.`)
    }
    if (kind === 'salary' && category !== 'Salário' || kind === 'extra' && category !== 'Renda extra' ||
        kind === 'expense' && (!category || category.length > 40)) {
      throw new Error(`A categoria "${category}" não corresponde ao tipo do movimento ${item.id}.`)
    }
    if (kind === 'expense' && !knownCategories.has(category)) newExpenseCategories.add(category)
    const fields: EditableMovementFields = {
      name,
      kind: kind as FinancialReportMovement['kind'],
      category,
      amount,
      date,
      notes,
      walletId,
    }
    if (current) updates.set(item.id, fields)
    else {
      additions.push({
        ...fields,
        id: item.id,
        ...(typeof item.sourceId === 'string' ? { sourceId: item.sourceId } : {}),
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      })
    }
  }

  if (currentCustomCategories.length + newExpenseCategories.size > 50) {
    throw new Error('A proposta excede o limite de 50 categorias personalizadas.')
  }

  const snapshot = (movement: FinancialReportMovement): EditableMovementFields => ({
    name: movement.name,
    kind: movement.kind,
    category: movement.category,
    amount: movement.amount,
    date: movement.date,
    notes: movement.notes,
    walletId: movement.walletId ?? null,
  })
  const updatedMovements = currentMovements
    .filter((movement) => !removedIds.has(movement.id))
    .map((current) => ({ ...current, ...updates.get(current.id) }))
  const movements = [...updatedMovements, ...additions]
  const changes: FinancialAnalysisChange[] = [
    ...currentMovements.flatMap((current): FinancialAnalysisChange[] => {
      if (removedIds.has(current.id)) return [{ id: current.id, action: 'removed' as const, before: snapshot(current), after: null }]
      const after = updates.get(current.id)
      if (!after || editableMovementFields.every((field) => after[field] === snapshot(current)[field])) return []
      return [{ id: current.id, action: 'updated' as const, before: snapshot(current), after }]
    }),
    ...additions.map((movement): FinancialAnalysisChange => ({ id: movement.id, action: 'added', before: null, after: snapshot(movement) })),
  ]

  return { movements, changes, newExpenseCategories: [...newExpenseCategories] }
}

const normalizedName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export const createFinancialAnalysisReport = (input: FinancialAnalysisInput, exportedAt = new Date()) => {
  const incomeMovements = input.movements.filter((movement) => movement.kind !== 'expense')
  const expenseMovements = input.movements.filter((movement) => movement.kind === 'expense')
  const totalIncome = incomeMovements.reduce((total, movement) => total + movement.amount, 0)
  const totalExpenses = expenseMovements.reduce((total, movement) => total + movement.amount, 0)
  const monthlyTotals = new Map<string, { income: number; expenses: number; incomeCount: number; expenseCount: number }>()

  for (const movement of input.movements) {
    const month = movement.date.slice(0, 7)
    const totals = monthlyTotals.get(month) ?? { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 }
    if (movement.kind === 'expense') {
      totals.expenses += movement.amount
      totals.expenseCount += 1
    } else {
      totals.income += movement.amount
      totals.incomeCount += 1
    }
    monthlyTotals.set(month, totals)
  }

  const duplicateCandidates = new Map<string, FinancialReportMovement[]>()
  for (const movement of input.movements) {
    const key = `${movement.date}|${movement.kind}|${movement.amount.toFixed(2)}|${normalizedName(movement.name)}`
    const matches = duplicateCandidates.get(key) ?? []
    matches.push(movement)
    duplicateCandidates.set(key, matches)
  }

  const firstWalletId = input.wallets[0]?.id
  const walletBalances = input.wallets.map((wallet) => ({
    ...wallet,
    balance: wallet.openingBalance + input.movements
      .filter((movement) => movement.walletId === wallet.id || (!movement.walletId && wallet.id === firstWalletId))
      .reduce((balance, movement) => balance + (movement.kind === 'expense' ? -movement.amount : movement.amount), 0),
  }))
  const openDebts = input.debts.filter((debt) => !debt.isPaid)

  return {
    app: 'GranaZen',
    reportType: 'financial-analysis',
    formatVersion: 1,
    exportedAt: exportedAt.toISOString(),
    context: {
      locale: 'pt-BR',
      currency: 'BRL',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      source: 'Dados financeiros armazenados localmente pelo usuário.',
      privacy: 'Este relatório não inclui nome, e-mail, telefone, foto, preferências ou credenciais bancárias. Descrições, observações e nomes de carteiras registrados pelo usuário podem conter dados pessoais.',
    },
    dataDefinitions: {
      movementAmount: 'amount é armazenado como valor positivo; kind define o sentido. expense é saída; salary e extra são entradas.',
      movementDate: 'date é a data do lançamento e determina o mês dos resumos.',
      debtAmount: 'amount é o valor original; remainingBalance é o saldo pendente quando disponível.',
      walletBalance: 'Saldo inicial mais entradas vinculadas menos gastos vinculados, considerando movimentos de qualquer data. Movimento sem walletId é atribuído à primeira carteira.',
      possibleDuplicates: 'Grupos heurísticos com mesma data, tipo, valor em centavos e descrição normalizada. Não são uma confirmação de erro.',
    },
    summary: {
      movementCount: input.movements.length,
      incomeCount: incomeMovements.length,
      expenseCount: expenseMovements.length,
      totalIncome,
      totalExpenses,
      netFromMovements: totalIncome - totalExpenses,
      debtCount: input.debts.length,
      openDebtCount: openDebts.length,
      openDebtBalance: openDebts.reduce((total, debt) => total + (debt.remainingBalance ?? debt.amount), 0),
      paidDebtOriginalAmount: input.debts.filter((debt) => debt.isPaid).reduce((total, debt) => total + debt.amount, 0),
      importedMovementCount: input.movements.filter((movement) => movement.notes.startsWith('Importado de extrato')).length,
      importedPdfMovementCount: input.movements.filter((movement) => movement.notes === 'Importado de extrato PDF').length,
    },
    monthlySummary: [...monthlyTotals.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([month, totals]) => ({
      month,
      ...totals,
      net: totals.income - totals.expenses,
    })),
    qualityChecks: {
      movementsWithoutWalletId: input.movements.filter((movement) => !movement.walletId).length,
      possibleDuplicateGroups: [...duplicateCandidates.values()]
        .filter((matches) => matches.length > 1)
        .map((matches) => ({
          date: matches[0].date,
          kind: matches[0].kind,
          amount: matches[0].amount,
          normalizedDescription: normalizedName(matches[0].name),
          movementIds: matches.map((movement) => movement.id),
        })),
    },
    wallets: walletBalances,
    movements: input.movements,
    debts: input.debts,
    budgets: input.budgets,
    savingsGoals: input.goals,
    customExpenseCategories: input.customExpenseCategories,
  }
}