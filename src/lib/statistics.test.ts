import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, distribution, financialMetrics, formatRatio, percentage } from './statistics';
import { decimal, fixed } from './money';
import { demoRegistry } from './data';

test('exact median, interpolated quartiles, Gini and concentration', () => {
  const d = distribution(['0', '0', '0', '100'].map(decimal));
  assert.equal(fixed(d.mean!), '25.00');
  assert.equal(fixed(d.median!), '0.00');
  assert.equal(fixed(d.q1!), '0.00');
  assert.equal(fixed(d.q3!), '25.00');
  assert.equal(fixed(d.gini!), '0.75');
  assert.equal(fixed(d.hhi!), '1.00');
  assert.equal(fixed(d.effective!), '1.00');
  assert.equal(d.count80, 1);
  assert.equal(fixed(d.top1!), '100.00');
  assert.deepEqual(d.lorenz.at(-1), { x: 100, y: 100 });
});
test('equal, empty, singleton and zero populations have defined semantics', () => {
  const equal = distribution(['10', '10', '10', '10'].map(decimal));
  assert.equal(fixed(equal.gini!), '0.00');
  assert.equal(fixed(equal.effective!), '4.00');
  assert.equal(fixed(equal.top1!), '25.00');
  const empty = distribution([]); assert.equal(empty.median, null); assert.equal(empty.gini, null);
  assert.equal(distribution([decimal('0')]).hhi, null);
  const single = distribution([decimal('10')]); assert.equal(fixed(single.gini!), '0.00'); assert.equal(single.count80, 1);
});
test('statistics retain precision for 1000-digit values and ties', () => {
  const value = '9'.repeat(1000);
  const d = distribution([decimal(value), decimal(value)]);
  assert.equal(fixed(d.mean!), value + '.00');
  assert.equal(fixed(d.gini!), '0.00');
  assert.equal(fixed(d.effective!), '2.00');
});
test('missing rates exclude an entire entity rather than reporting partial wealth', () => {
  const entities = demoRegistry().entities.slice(0, 2);
  entities[0].assets[0].currency = 'EUR';
  const d = analyze(entities, 'USD', { USD: '4', PLN: '1' });
  assert.equal(d.excluded, 1); assert.equal(d.rows.length, 1);
  assert.equal(d.assets.length, entities[1].assets.length);
  assert.equal(d.rows[0].rank, 1);
});
test('financial ratios distinguish missing data, zero denominator and negative surplus', () => {
  const entity = demoRegistry().entities[0];
  assert.equal(financialMetrics(entity, 'USD', {}).debtRatio, null);
  entity.financials = { currency: 'USD', liabilities: '500000000', annualIncome: '100000000', annualExpenses: '125000000', notes: '' };
  const f = financialMetrics(entity, 'USD', {});
  assert.equal(formatRatio(f.debtRatio, '%'), '20,83%');
  assert.equal(formatRatio(f.surplusRate, '%'), '-25,00%');
  assert.equal(formatRatio(f.runway), '14,40');
  entity.financials.annualIncome = '0'; entity.financials.annualExpenses = '0';
  const zero = financialMetrics(entity, 'USD', {});
  assert.equal(zero.surplusRate, null); assert.equal(zero.runway, null);
  assert.equal(percentage(decimal('0'), decimal('0')), null);
});
