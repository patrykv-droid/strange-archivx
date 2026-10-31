import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENCIES, demoRegistry, parseNbp, validateRegistry } from './data';

test('JSON backup preserves enormous amounts as strings', () => {
  const registry = demoRegistry();
  registry.entities[0].assets[0].amount = '9'.repeat(800) + '.123456789';
  assert.deepEqual(validateRegistry(JSON.parse(JSON.stringify(registry))), registry);
});
test('rejects corrupt backups, duplicate ids and dangerous object keys', () => {
  for (const bad of [null, {}, { version: 1, entities: [] }, { version: 2, entities: [], isDemo: false }]) assert.throws(() => validateRegistry(bad));
  const numeric = demoRegistry();
  (numeric.entities[0].assets[0] as unknown as { amount: number }).amount = 1e30;
  assert.throws(() => validateRegistry(numeric));
  const duplicate = demoRegistry(); duplicate.entities[1].id = duplicate.entities[0].id;
  assert.throws(() => validateRegistry(duplicate));
  const badCategory = demoRegistry(); (badCategory.entities[0].assets[0] as unknown as { category: string }).category = '__proto__';
  assert.throws(() => validateRegistry(badCategory));
});
test('validates the complete NBP table and rejects incomplete rates', () => {
  const table = [{ table: 'A', no: 'TEST/A/NBP/2026', effectiveDate: '2026-10-30', rates: CURRENCIES.filter(c => c !== 'PLN').map(code => ({ code, mid: 4.25 })) }];
  assert.equal(parseNbp(table).rates.EUR, '4.25');
  assert.equal(parseNbp(table).rates.PLN, '1');
  table[0].rates.pop(); assert.throws(() => parseNbp(table));
});


test('accepts old backups and validates optional embedded photos', () => {
  const registry = demoRegistry();
  assert.equal(validateRegistry(registry), registry);
  registry.entities[0].photo = 'data:image/png;base64,aGVsbG8=';
  registry.entities[0].assets[0].photo = 'data:image/webp;base64,aGVsbG8=';
  assert.equal(validateRegistry(registry), registry);
  registry.entities[0].photo = 'https://example.com/image.png';
  assert.throws(() => validateRegistry(registry));
});


test('financial profile data are exact strings and remain backwards compatible', () => {
  const registry = demoRegistry();
  assert.equal(validateRegistry(registry), registry);
  registry.entities[0].financials = { currency: 'USD', liabilities: '1000000000000000000000000', annualIncome: '100', annualExpenses: '200', notes: 'Test' };
  assert.deepEqual(validateRegistry(JSON.parse(JSON.stringify(registry))), registry);
  registry.entities[0].financials.liabilities = '-1';
  assert.throws(() => validateRegistry(registry));
});
