import assert from 'node:assert/strict'
import test from 'node:test'
import { createFinancialAnalysisReport } from '../src/financialReport.ts'

const movement = (changes) => ({
  id: 'movement-1',
  kind: 'expense',
  category: 'Outros',
  name: 'Mercado',
  amount: 100,
  date: '2026-03-01',
  notes: 'Importado de extrato PDF',
  walletId: 'wallet-1',
  createdAt: '2026-03-01T10:00:00.000Z',
  ...changes,
})

test('builds a complete finance report with monthly and wallet summaries', () => {
  const report = createFinancialAnalysisReport({
    movements: [
      movement({ id: 'expense-1' }),
      movement({ id: 'expense-2', name: 'Mercado!' }),
      movement({ id: 'salary-1', kind: 'salary', name: 'Salário', amount: 1000, date: '2026-03-02', notes: '' }),
      movement({ id: 'extra-1', kind: 'extra', name: 'Freelance', amount: 200, date: '2026-04-04', notes: '', walletId: null }),
    ],
    debts: [
      { id: 'open-debt', category: 'Boleto', name: 'Conta', amount: 300, dueDate: '2026-03-20', notes: '', isPaid: false, paidAt: null, isRecurring: false, recurrenceGroupId: null, remainingBalance: 250, createdAt: '2026-03-01T10:00:00.000Z' },
      { id: 'paid-debt', category: 'Boleto', name: 'Conta antiga', amount: 50, dueDate: '2026-02-20', notes: '', isPaid: true, paidAt: '2026-02-19', isRecurring: false, recurrenceGroupId: null, remainingBalance: 0, createdAt: '2026-02-01T10:00:00.000Z' },
    ],
    wallets: [{ id: 'wallet-1', name: 'Carteira principal', kind: 'checking', openingBalance: 10 }],
    budgets: [{ id: 'budget-1', category: 'Outros', limit: 500, month: '2026-03' }],
    goals: [{ id: 'goal-1', name: 'Reserva', target: 2000, saved: 300, deadline: '', createdAt: '2026-01-01T10:00:00.000Z' }],
    customExpenseCategories: ['Pets'],
  }, new Date('2026-05-01T12:00:00.000Z'))

  assert.equal(report.reportType, 'financial-analysis')
  assert.equal(report.formatVersion, 1)
  assert.equal(report.movements.length, 4)
  assert.equal(report.summary.totalIncome, 1200)
  assert.equal(report.summary.totalExpenses, 200)
  assert.equal(report.summary.netFromMovements, 1000)
  assert.equal(report.summary.openDebtBalance, 250)
  assert.equal(report.summary.paidDebtOriginalAmount, 50)
  assert.equal(report.summary.importedPdfMovementCount, 2)
  assert.deepEqual(report.monthlySummary.map(({ month, income, expenses }) => ({ month, income, expenses })), [
    { month: '2026-03', income: 1000, expenses: 200 },
    { month: '2026-04', income: 200, expenses: 0 },
  ])
  assert.equal(report.wallets[0].balance, 1010)
  assert.deepEqual(report.qualityChecks.possibleDuplicateGroups[0].movementIds, ['expense-1', 'expense-2'])
  assert.equal('profile' in report, false)
  assert.equal('preferences' in report, false)
  assert.equal(JSON.stringify(report).includes('profile-photo'), false)
})