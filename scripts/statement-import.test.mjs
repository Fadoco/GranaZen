import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePdfStatementText, parseStatementFile, selectNonDuplicateStatementEntries } from '../src/statementImport.ts'

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

test('parses text extracted from PDF statements as expenses and income', () => {
  const entries = parsePdfStatementText([
    '03/11/2026 PIX ENVIADO MERCADO -123,45 1.234,56',
    '04/11/2026 PIX RECEBIDO JOAO 2.500,00 3.734,56',
    '2026-11-05 COMPRA FARMACIA -42,10',
  ].join('\n'))

  assert.equal(entries.length, 3)
  assert.deepEqual(entries.map(({ date, name, amount, kind }) => ({ date, name, amount, kind })), [
    { date: '2026-11-03', name: 'PIX ENVIADO MERCADO', amount: 123.45, kind: 'expense' },
    { date: '2026-11-04', name: 'PIX RECEBIDO JOAO', amount: 2500, kind: 'extra' },
    { date: '2026-11-05', name: 'COMPRA FARMACIA', amount: 42.1, kind: 'expense' },
  ])
})

test('rejects PDFs without extractable transaction text', () => {
  assert.throws(() => parsePdfStatementText('Extrato bancário escaneado'))
})

test('parses Mercado Pago rows with wrapped descriptions, operation IDs, credits, and reversals', () => {
  const entries = parsePdfStatementText([
    '03-01-2026 Pagamento com QR Pix UBER 139737386195 R$ -17,95 R$ 9,08',
    'DO BRASIL TECNOLOGIA LTDA.',
    '03-01-2026 Transferência Pix recebida Douglas Micael 139665668581 R$ 20,00 R$ 28,83',
    '03-01-2026 Rendimentos 1738004907424 R$ 0,01 R$ 28,84',
    '03-01-2026 Pagamento GOOGLE BRASIL 140559250410 R$ -5,90 R$ 12,94',
    '03-01-2026 Pagamento cancelado GOOGLE BRASIL 140559250410 R$ 5,90 R$ 18,84',
  ].join('\n'))

  assert.deepEqual(entries.map(({ name, sourceId, amount, kind }) => ({ name, sourceId, amount, kind })), [
    { name: 'Pagamento com QR Pix UBER DO BRASIL TECNOLOGIA LTDA.', sourceId: '139737386195', amount: 17.95, kind: 'expense' },
    { name: 'Transferência Pix recebida Douglas Micael', sourceId: '139665668581', amount: 20, kind: 'extra' },
    { name: 'Rendimentos', sourceId: '1738004907424', amount: 0.01, kind: 'extra' },
    { name: 'Pagamento GOOGLE BRASIL', sourceId: '140559250410', amount: 5.9, kind: 'expense' },
    { name: 'Pagamento cancelado GOOGLE BRASIL', sourceId: '140559250410', amount: 5.9, kind: 'extra' },
  ])
  assert.deepEqual(selectNonDuplicateStatementEntries(entries, []), [true, true, true, true, true])
})

test('matches newly parsed PDF operation IDs against legacy imported descriptions', () => {
  const entry = parsePdfStatementText('03-01-2026 Rendimentos 1738004907424 R$ 0,01 R$ 28,84')[0]
  const legacyMovement = {
    date: entry.date,
    name: 'Rendimentos 1738004907424',
    amount: entry.amount,
    kind: 'expense',
    notes: 'Importado de extrato PDF',
  }

  assert.deepEqual(selectNonDuplicateStatementEntries([entry], [legacyMovement]), [false])
})

test('marks transactions from a re-read PDF as duplicates', () => {
  const firstRead = parsePdfStatementText('03/11/2026 PIX RECEBIDO JOAO 2500,00')
  const secondRead = parsePdfStatementText('03/11/2026 pix recebido: João 2.500,00')

  assert.deepEqual(selectNonDuplicateStatementEntries(firstRead, []), [true])
  assert.deepEqual(selectNonDuplicateStatementEntries(secondRead, firstRead), [false])
  assert.deepEqual(selectNonDuplicateStatementEntries([...firstRead, ...secondRead], []), [true, false])
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
