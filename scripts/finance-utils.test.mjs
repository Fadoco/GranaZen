import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidDateValue, matchesSearch, nextRecurringDueDate } from '../src/financeUtils.ts'

test('date validation accepts real dates and leap days', () => {
  assert.equal(isValidDateValue('2024-02-29'), true)
  assert.equal(isValidDateValue('2026-11-07'), true)
})

test('date validation rejects impossible and malformed dates', () => {
  assert.equal(isValidDateValue('2025-02-29'), false)
  assert.equal(isValidDateValue('2026-13-01'), false)
  assert.equal(isValidDateValue('07/11/2026'), false)
  assert.equal(isValidDateValue(null), false)
})

test('search ignores accents and letter case', () => {
  assert.equal(matchesSearch('SAUDE', 'Despesa de saúde'), true)
  assert.equal(matchesSearch('  cartao  ', 'Cartão Nubank'), true)
  assert.equal(matchesSearch('jantar', 'Mercado'), false)
  assert.equal(matchesSearch('  ', 'Qualquer texto'), true)
})

test('recurring due date advances one month and clamps short months', () => {
  assert.equal(nextRecurringDueDate('2026-01-31', '2026-01-05'), '2026-02-28')
  assert.equal(nextRecurringDueDate('2024-01-31', '2024-01-05'), '2024-02-29')
})

test('overdue recurring bill advances from the current month', () => {
  assert.equal(nextRecurringDueDate('2026-08-15', '2026-11-07'), '2026-12-15')
})

test('recurring due date rolls over the year', () => {
  assert.equal(nextRecurringDueDate('2026-12-30', '2026-12-01'), '2027-01-30')
})
