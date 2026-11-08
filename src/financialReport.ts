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
  before: Pick<FinancialReportMovement, 'kind' | 'category' | 'name' | 'amount' | 'date' | 'notes' | 'walletId' | 'sourceId'> | null
  after: Pick<FinancialReportMovement, 'kind' | 'category' | 'name' | 'amount' | 'date' | 'notes' | 'walletId' | 'sourceId'> | null
}

export type FinancialAnalysisWalletChange = {
  id: string
  name: string
  before: number
  after: number
}

export type FinancialBalanceReconciliation = {
  asOf: string
  statementClosingBalance: number
  userReportedCurrentBalance: number
  difference: number
  note: string
}

export type FinancialAnalysisProposal = {
  movements: FinancialReportMovement[]
  changes: FinancialAnalysisChange[]
  wallets: FinancialReportWallet[]
  walletChanges: FinancialAnalysisWalletChange[]
  balanceReconciliation?: FinancialBalanceReconciliation
  newExpenseCategories: string[]
}

type EditableMovementFields = Pick<FinancialReportMovement, 'kind' | 'category' | 'name' | 'amount' | 'date' | 'notes' | 'walletId' | 'sourceId'>
const editableMovementFields = ['kind', 'category', 'name', 'amount', 'date', 'notes', 'walletId', 'sourceId'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const prepareFinancialAnalysisProposal = (
  value: unknown,
  currentMovements: FinancialReportMovement[],
  existingExpenseCategories: string[],
  currentCustomCategories: string[],
  currentWallets?: FinancialReportWallet[],
): FinancialAnalysisProposal => {
  if (!isRecord(value) || value.app !== 'GranaZen' || value.reportType !== 'financial-analysis' ||
      value.formatVersion !== 1 || !Array.isArray(value.movements)) {
    throw new Error('Arquivo incompatível. Use o relatório financeiro JSON original revisado pela IA.')
  }

  const currentById = new Map(currentMovements.map((movement) => [movement.id, movement]))
  const currentWalletById = new Map((currentWallets ?? []).map((wallet) => [wallet.id, wallet]))
  const proposedIds = new Set<string>()
  const updates = new Map<string, EditableMovementFields>()
  const walletUpdates = new Map<string, FinancialReportWallet>()
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

  let balanceReconciliation: FinancialBalanceReconciliation | undefined
  if (value.balanceReconciliation !== undefined) {
    if (!isRecord(value.balanceReconciliation) || typeof value.balanceReconciliation.asOf !== 'string' ||
        typeof value.balanceReconciliation.statementClosingBalance !== 'number' ||
        typeof value.balanceReconciliation.userReportedCurrentBalance !== 'number' ||
        typeof value.balanceReconciliation.difference !== 'number' ||
        typeof value.balanceReconciliation.note !== 'string' ||
        ![value.balanceReconciliation.statementClosingBalance, value.balanceReconciliation.userReportedCurrentBalance,
          value.balanceReconciliation.difference].every(Number.isFinite)) {
      throw new Error('Os dados de conferência do saldo estão inválidos.')
    }
    balanceReconciliation = {
      asOf: value.balanceReconciliation.asOf,
      statementClosingBalance: value.balanceReconciliation.statementClosingBalance,
      userReportedCurrentBalance: value.balanceReconciliation.userReportedCurrentBalance,
      difference: value.balanceReconciliation.difference,
      note: value.balanceReconciliation.note.slice(0, 500),
    }
  }

  for (const [index, item] of value.movements.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      throw new Error(`O movimento ${index + 1} não tem um ID válido.`)
    }
    const current = currentById.get(item.id)
    if (removedIds.has(item.id)) throw new Error(`O movimento ${item.id} não pode ser editado e removido ao mesmo tempo.`)
    if (proposedIds.has(item.id)) throw new Error(`O ID ${item.id} aparece mais de uma vez no arquivo.`)
    proposedIds.add(item.id)

    if (current && Object.hasOwn(item, 'createdAt') && item.createdAt !== current.createdAt) {
      throw new Error(`O identificador protegido "createdAt" do movimento ${item.id} não pode ser alterado.`)
    }
    if (current?.sourceId && Object.hasOwn(item, 'sourceId') && item.sourceId !== current.sourceId) {
      throw new Error(`O identificador protegido "sourceId" do movimento ${item.id} não pode ser alterado.`)
    }
    if (Object.hasOwn(item, 'sourceId') && item.sourceId !== undefined &&
        (typeof item.sourceId !== 'string' || !/^\d{9,16}$/.test(item.sourceId))) {
      throw new Error(`O identificador sourceId do movimento ${item.id} é inválido.`)
    }

    const sourceId = typeof item.sourceId === 'string' ? item.sourceId : current?.sourceId

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
    if (walletId && currentWallets && !currentWalletById.has(walletId)) {
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
      sourceId,
    }
    if (current) updates.set(item.id, fields)
    else {
      additions.push({
        ...fields,
        id: item.id,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      })
    }
  }

  const proposedWalletIds = new Set<string>()
  if (value.wallets !== undefined && currentWallets) {
    if (!Array.isArray(value.wallets)) throw new Error('A lista de carteiras da proposta está inválida.')
    for (const [index, item] of value.wallets.entries()) {
      if (!isRecord(item) || typeof item.id !== 'string') throw new Error(`A carteira ${index + 1} não tem um ID válido.`)
      const current = currentWalletById.get(item.id)
      if (!current) throw new Error(`A carteira ${item.id} não pertence aos dados atuais.`)
      if (proposedWalletIds.has(item.id)) throw new Error(`A carteira ${item.id} aparece mais de uma vez no arquivo.`)
      proposedWalletIds.add(item.id)
      if (Object.hasOwn(item, 'kind') && item.kind !== current.kind) {
        throw new Error(`O tipo da carteira ${item.id} não pode ser alterado pelo relatório.`)
      }
      const name = item.name === undefined ? current.name : typeof item.name === 'string' ? item.name.trim() : ''
      const openingBalance = item.openingBalance === undefined ? current.openingBalance : item.openingBalance
      if (!name || name.length > 40 || typeof openingBalance !== 'number' || !Number.isFinite(openingBalance)) {
        throw new Error(`Nome ou saldo inicial inválido na carteira ${item.id}.`)
      }
      walletUpdates.set(item.id, { ...current, name, openingBalance })
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
    sourceId: movement.sourceId,
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
  const wallets = (currentWallets ?? []).map((current) => ({ ...current, ...walletUpdates.get(current.id) }))
  const walletChanges = (currentWallets ?? []).flatMap((current): FinancialAnalysisWalletChange[] => {
    const updated = walletUpdates.get(current.id)
    if (!updated || (updated.name === current.name && updated.openingBalance === current.openingBalance)) return []
    return [{ id: current.id, name: updated.name, before: current.openingBalance, after: updated.openingBalance }]
  })

  return { movements, changes, wallets, walletChanges, balanceReconciliation, newExpenseCategories: [...newExpenseCategories] }
}

const normalizedName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const toCents = (value: number) => Math.round(value * 100)
const fromCents = (value: number) => value / 100

export const createFinancialAnalysisReport = (input: FinancialAnalysisInput, exportedAt = new Date()) => {
  const incomeMovements = input.movements.filter((movement) => movement.kind !== 'expense')
  const expenseMovements = input.movements.filter((movement) => movement.kind === 'expense')
  const totalIncomeCents = incomeMovements.reduce((total, movement) => total + toCents(movement.amount), 0)
  const totalExpenseCents = expenseMovements.reduce((total, movement) => total + toCents(movement.amount), 0)
  const totalIncome = fromCents(totalIncomeCents)
  const totalExpenses = fromCents(totalExpenseCents)
  const monthlyTotals = new Map<string, { incomeCents: number; expenseCents: number; incomeCount: number; expenseCount: number }>()

  for (const movement of input.movements) {
    const month = movement.date.slice(0, 7)
    const totals = monthlyTotals.get(month) ?? { incomeCents: 0, expenseCents: 0, incomeCount: 0, expenseCount: 0 }
    if (movement.kind === 'expense') {
      totals.expenseCents += toCents(movement.amount)
      totals.expenseCount += 1
    } else {
      totals.incomeCents += toCents(movement.amount)
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
  const walletBalances = input.wallets.map((wallet) => {
    const balanceCents = toCents(wallet.openingBalance) + input.movements
      .filter((movement) => movement.walletId === wallet.id || (!movement.walletId && wallet.id === firstWalletId))
      .reduce((balance, movement) => balance + (movement.kind === 'expense' ? -toCents(movement.amount) : toCents(movement.amount)), 0)
    return { ...wallet, balance: fromCents(balanceCents) }
  })
  const openDebts = input.debts.filter((debt) => !debt.isPaid)
  const openDebtBalance = fromCents(openDebts.reduce((total, debt) => total + toCents(debt.remainingBalance ?? debt.amount), 0))
  const paidDebtOriginalAmount = fromCents(input.debts
    .filter((debt) => debt.isPaid)
    .reduce((total, debt) => total + toCents(debt.amount), 0))

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
      netFromMovements: fromCents(totalIncomeCents - totalExpenseCents),
      debtCount: input.debts.length,
      openDebtCount: openDebts.length,
      openDebtBalance,
      paidDebtOriginalAmount,
      importedMovementCount: input.movements.filter((movement) => movement.notes.startsWith('Importado de extrato')).length,
      importedPdfMovementCount: input.movements.filter((movement) => movement.notes === 'Importado de extrato PDF').length,
    },
    monthlySummary: [...monthlyTotals.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([month, totals]) => {
      const income = fromCents(totals.incomeCents)
      const expenses = fromCents(totals.expenseCents)
      return {
        month,
        income,
        expenses,
        incomeCount: totals.incomeCount,
        expenseCount: totals.expenseCount,
        net: fromCents(totals.incomeCents - totals.expenseCents),
      }
    }),
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