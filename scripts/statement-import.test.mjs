import assert from 'node:assert/strict'
import test from 'node:test'
import { parseStatementFile } from '../src/statementImport.ts'

test('parses semicolon CSV with Brazilian dates, decimals, and quoted fields', () => {
  const entries = parseStatementFile('extrato.csv', [
    'Data;Descrição;Valor;Tipo',
    '2026-11-02;"Mercado; bairro";-123,45;Débito',
    '2026-11-03;Pagamento recebido;2.500,00;Crédito',
  ].join('\n'))
  assert.equal(entries.length, 2)
  assert.deepEqual(entries[0], {
    date: '2026-11-02',
    name: 'Mercado; bairro',
    amount: 123.45,
    kind: 'expense',
    category: 'Outros',
    notes: 'Importado de extrato',
  })
  assert.equal(entries[1].kind, 'extra')
  assert.equal(entries[1].amount, 2500)
})

test('parses bank OFX transactions as local entries', () => {
  const content = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261101120000[-3:BRT]<TRNAMT>-45.90<NAME>Farmácia</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261102120000<TRNAMT>850.00<MEMO>Pagamento extra</STMTTRN>
</BANKTRANLIST></OFX>`
  const entries = parseStatementFile('conta.ofx', content)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].date, '2026-11-01')
  assert.equal(entries[0].kind, 'expense')
  assert.equal(entries[0].amount, 45.9)
  assert.equal(entries[1].kind, 'extra')
  assert.equal(entries[1].name, 'Pagamento extra')
})

test('rejects invalid CSV columns, invalid dates, and unsupported files', () => {
  assert.throws(() => parseStatementFile('extrato.csv', 'Hora;Valor\n10:00;50'))
  assert.throws(() => parseStatementFile('extrato.csv', 'Data;Descrição;Valor\n2026-02-30;Compra;-50'))
  assert.throws(() => parseStatementFile('extrato.xlsx', 'dados'))
})

test('rejects malformed or oversized statement content', () => {
  assert.throws(() => parseStatementFile('extrato.csv', 'Data;Descrição;Valor\n2026-11-02;"sem fim;-10'))
  assert.throws(() => parseStatementFile('extrato.csv', 'x'.repeat(10 * 1024 * 1024 + 1)))
})
