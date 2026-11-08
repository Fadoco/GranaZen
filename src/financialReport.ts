import type { Debt } from './financeTypes.ts'

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
  before: Pick<FinancialReportMovement, 'kind' | 'category' | 'name'>
  after: Pick<FinancialReportMovement, 'kind' | 'category' | 'name'>
}

export type FinancialAnalysisProposal = {
  movements: FinancialReportMovement[]
  changes: FinancialAnalysisChange[]
  newExpenseCategories: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const prepareFinancialAnalysisProposal = (
  value: unknown,
  currentMovements: FinancialReportMovement[],
  existingExpenseCategories: string[],
  currentCustomCategories: string[],
): FinancialAnalysisProposal => {
  if (!isRecord(value) || value.app !== 'GranaZen' || value.reportType !== 'financial-analysis' ||
      value.formatVersion !== 1 || !Array.isArray(value.movements)) {
    throw new Error('Arquivo incompatível. Use o relatório financeiro JSON original revisado pela IA.')
  }

  const currentById = new Map(currentMovements.map((movement) => [movement.id, movement]))
  const proposedIds = new Set<string>()
  const updates = new Map<string, Pick<FinancialReportMovement, 'kind' | 'category' | 'name'>>()
  const newExpenseCategories = new Set<string>()
  const knownCategories = new Set([...existingExpenseCategories, ...currentCustomCategories])

  for (const [index, item] of value.movements.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      throw new Error(`O movimento ${index + 1} não tem um ID válido.`)
    }
    const current = currentById.get(item.id)
    if (!current) throw new Error(`O ID ${item.id} não pertence aos dados atuais. A IA não pode adicionar nem substituir transações.`)
    if (proposedIds.has(item.id)) throw new Error(`O ID ${item.id} aparece mais de uma vez no arquivo.`)
    proposedIds.add(item.id)

    for (const field of ['date', 'amount', 'walletId', 'sourceId', 'createdAt'] as const) {
      if (Object.hasOwn(item, field) && item[field] !== current[field]) {
        throw new Error(`A IA alterou o campo protegido "${field}" do movimento ${item.id}. Valor, data, carteira e identificadores precisam permanecer iguais.`)
      }
    }

    const name = item.name === undefined ? current.name : typeof item.name === 'string' ? item.name.trim() : ''
    const kind = item.kind === undefined ? current.kind : item.kind
    const category = item.category === undefined ? current.category : typeof item.category === 'string' ? item.category.trim() : ''
    if (!name || name.length > 100 || !['expense', 'salary', 'extra'].includes(String(kind))) {
      throw new Error(`Nome ou tipo inválido no movimento ${item.id}.`)
    }
    if (kind === 'salary' && category !== 'Salário' || kind === 'extra' && category !== 'Renda extra' ||
        kind === 'expense' && (!category || category.length > 40)) {
      throw new Error(`A categoria "${category}" não corresponde ao tipo do movimento ${item.id}.`)
    }
    if (kind === 'expense' && !knownCategories.has(category)) newExpenseCategories.add(category)
    updates.set(item.id, { name, kind: kind as FinancialReportMovement['kind'], category })
  }

  if (currentCustomCategories.length + newExpenseCategories.size > 50) {
    throw new Error('A proposta excede o limite de 50 categorias personalizadas.')
  }

  const movements = currentMovements.map((current) => ({ ...current, ...updates.get(current.id) }))
  const changes = movements.flatMap((movement, index) => {
    const current = currentMovements[index]
    if (movement.name === current.name && movement.kind === current.kind && movement.category === current.category) return []
    return [{
      id: movement.id,
      before: { name: current.name, kind: current.kind, category: current.category },
      after: { name: movement.name, kind: movement.kind, category: movement.category },
    }]
  })

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