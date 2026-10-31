import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, compare, convert, decimal, fixed, formatMoney, normalizeAmount, share, sum, ZERO } from './money';

test('normalizes Polish input without going through floating point', () => {
  assert.equal(normalizeAmount(' 000 123\u00a0456,78900 '), '123456.789');
  assert.equal(normalizeAmount('000.000'), '0');
  assert.equal(normalizeAmount('9'.repeat(1000) + '.' + '1'.repeat(100)).length, 1101);
  for (const bad of ['1e25', '-2', 'Infinity', '1.000,50', '0x10', '', '1,2,3', '5' + '0'.repeat(1000)]) assert.throws(() => normalizeAmount(bad));
});
test('adds 1000-digit amounts exactly, including sub-cent fractions', () => {
  const amount = '9'.repeat(1000) + '.99';
  assert.equal(fixed(add(decimal(amount), decimal('0.01'))), '1' + '0'.repeat(1000) + '.00');
  assert.equal(fixed(sum(Array.from({ length: 10 }, () => decimal('0.001')))! ), '0.01');
});
test('converts a huge amount through PLN exactly and preserves the original', () => {
  const amount = '123456789012345678901234567890.125';
  const rates = { PLN: '1', EUR: '4.25', USD: '4' };
  assert.equal(fixed(convert(amount, 'EUR', 'USD', rates)!), '131172838325617283832561728383.26');
  assert.equal(fixed(convert('100', 'USD', 'EUR', rates)!), '94.12');
  assert.equal(amount, '123456789012345678901234567890.125');
});
test('does not round individual assets before adding', () => {
  const values = Array.from({ length: 3 }, () => convert('0.01', 'USD', 'EUR', { USD: '1', EUR: '3' }));
  assert.equal(fixed(sum(values)!), '0.01');
});
test('missing rates invalidate aggregate, same-currency amounts remain usable', () => {
  assert.equal(convert('100', 'USD', 'EUR', { PLN: '1' }), null);
  assert.deepEqual(convert('100', 'USD', 'USD', { PLN: '1' }), decimal('100'));
  assert.equal(sum([decimal('20'), null]), null);
  assert.deepEqual(sum([]), ZERO);
  assert.equal(convert('100', 'USD', 'EUR', { USD: '4', EUR: '0' }), null);
});
test('rounds half up only at display and uses Polish trillion scale', () => {
  assert.equal(fixed(decimal('999.995')), '1000.00');
  assert.equal(formatMoney(decimal('1000000000000'), 'PLN', true), '1,00 bilion PLN');
  assert.match(formatMoney(decimal('1' + '0'.repeat(200)), 'PLN', true), /decylionów PLN$/);
});
test('sorts and charts amounts outside the Number range', () => {
  const enormous = decimal('1' + '0'.repeat(600));
  const total = add(enormous, enormous);
  assert.equal(share(enormous, total), 50);
  assert.equal(compare(enormous, decimal('1' + '0'.repeat(599))), 1);
  assert.equal(share(ZERO, ZERO), 0);
});

 test('shows the entire requested amount without magnitude abbreviations', () => {
  assert.equal(formatMoney(decimal('3418503043.40'), 'PLN').replace(/\u00a0/g, ' '), '3 418 503 043,40 PLN');
 });


test('uses the reference long scale through centylion and carries rounding', () => {
  const examples = [[3, 'tysiąc'], [6, 'milion'], [9, 'miliard'], [12, 'bilion'], [15, 'biliard'], [18, 'trylion'], [21, 'tryliard'], [24, 'kwadrylion'], [30, 'kwintylion'], [36, 'sekstylion'], [42, 'septylion'], [48, 'oktylion'], [54, 'nonylion'], [60, 'decylion'], [600, 'centylion']] as const;
  for (const [power, name] of examples) assert.equal(formatMoney(decimal('1' + '0'.repeat(power)), 'USD', true), `1,00 ${name} USD`);
  assert.equal(formatMoney(decimal('3418503043.4'), 'PLN', true), '3,42 miliarda PLN');
  assert.equal(formatMoney(decimal('999999999.99'), 'USD', true), '1,00 miliard USD');
  assert.equal(formatMoney(decimal('2500000'), 'USD', true), '2,50 miliona USD');
  assert.equal(formatMoney({ n: -3500000n, d: 1n }, 'USD', true), '-3,50 miliona USD');
});
