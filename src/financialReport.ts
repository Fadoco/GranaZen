import type { Debt } from './financeTypes.ts'

export type FinancialReportMovement = {
  id: string
  kind: 'expense' | 'salary' | 'extra'
  category: string
  name: string
  amount: number
  date: string
  notes: string
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