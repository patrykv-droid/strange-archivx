import { CATEGORIES, type Currency, type Entity } from './data';
import { add, compare, convert, decimal, divide, fixed, multiply, share, subtract, sum, ZERO, type Rational } from './money';
export const ONE = decimal('1');
export const whole = (n: number): Rational => ({ n: BigInt(n), d: 1n });
export const average = (values: Rational[]) => values.length ? divide(sum(values)!, whole(values.length)) : null;
export function quantile(sorted: Rational[], numerator: number, denominator = 4): Rational | null {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * numerator;
  const lower = Math.floor(index / denominator), remainder = index % denominator;
  return add(multiply(sorted[lower], { n: BigInt(denominator - remainder), d: BigInt(denominator) }), multiply(sorted[Math.min(lower + 1, sorted.length - 1)], { n: BigInt(remainder), d: BigInt(denominator) }));
}
export function percentage(part: Rational | null, total: Rational | null): Rational | null {
  const ratio = part && total ? divide(part, total) : null;
  return ratio ? multiply(ratio, whole(100)) : null;
}
export function formatRatio(value: Rational | null, suffix = '', places = 2): string {
  if (!value) return '—';
  const [whole, fraction] = fixed(value, places).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}${fraction ? ',' + fraction : ''}${suffix}`;
}
export function distribution(values: Rational[]) {
  const sorted = [...values].sort(compare), total = sum(sorted)!;
  const positiveTotal = total.n > 0n;
  const weights = positiveTotal ? sorted.map(v => divide(v, total)!) : [];
  const hhi = positiveTotal ? sum(weights.map(w => multiply(w, w)))! : null;
  const gini = positiveTotal ? subtract(divide(multiply(sum(sorted.map((value, index) => multiply(value, whole(index + 1))))!, whole(2)), multiply(whole(sorted.length), total))!, { n: BigInt(sorted.length + 1), d: BigInt(sorted.length) }) : null;
  function top(count: number) { return percentage(sum(sorted.slice(-Math.min(count, sorted.length)))!, total); }
  let held = ZERO, count80 = 0;
  if (positiveTotal) for (const value of [...sorted].reverse()) { held = add(held, value); count80++; if (compare(multiply(held, whole(5)), multiply(total, whole(4))) >= 0) break; }
  let cumulative = ZERO;
  const lorenz = [{ x: 0, y: 0 }, ...sorted.map((value, index) => { cumulative = add(cumulative, value); return { x: (index + 1) / sorted.length * 100, y: positiveTotal ? share(cumulative, total) : 0 }; })];
  return { sorted, total, mean: average(sorted), median: quantile(sorted, 1, 2), q1: quantile(sorted, 1), q3: quantile(sorted, 3), min: sorted[0] || null, max: sorted.at(-1) || null, gini, hhi, effective: hhi ? divide(ONE, hhi) : null, top1: top(1), top3: top(3), top5: top(5), count80, held80: positiveTotal ? percentage(held, total) : null, lorenz };
}
export function analyze(entities: Entity[], currency: Currency, rates: Record<string, string>) {
  const all = entities.map(entity => ({ entity, value: sum(entity.assets.map(a => convert(a.amount, a.currency, currency, rates))) }));
  const rows = all.filter((row): row is { entity: Entity; value: Rational } => row.value !== null).sort((a, b) => compare(b.value, a.value) || a.entity.name.localeCompare(b.entity.name, 'pl'));
  let rank = 1;
  const ranked = rows.map((row, index) => { if (index === 0 || compare(row.value, rows[index - 1].value) !== 0) rank = index + 1; return { ...row, rank }; });
  const stats = distribution(rows.map(r => r.value));
  const assets = rows.flatMap(r => r.entity.assets.map(asset => ({ asset, entity: r.entity, value: convert(asset.amount, asset.currency, currency, rates)! }))).sort((a, b) => compare(b.value, a.value));
  const categories = Object.entries(CATEGORIES).map(([key, c]) => ({ ...c, count: assets.filter(a => a.asset.category === key).length, value: sum(assets.filter(a => a.asset.category === key).map(a => a.value))! }));
  const currencies = [...new Set(assets.map(a => a.asset.currency))].map(code => ({ code, count: assets.filter(a => a.asset.currency === code).length, value: sum(assets.filter(a => a.asset.currency === code).map(a => a.value))! })).sort((a, b) => compare(b.value, a.value));
  return { ...stats, rows: ranked, assets, categories, currencies, excluded: all.filter(r => r.value === null).length, assetStats: distribution(assets.map(a => a.value)), financialCount: rows.filter(r => r.entity.financials).length };
}
export function financialMetrics(entity: Entity, currency: Currency, rates: Record<string, string>) {
  const gross = sum(entity.assets.map(a => convert(a.amount, a.currency, currency, rates)));
  const cash = sum(entity.assets.filter(a => a.category === 'cash').map(a => convert(a.amount, a.currency, currency, rates)));
  const f = entity.financials;
  const value = (amount: string) => decimal(amount).n === 0n ? ZERO : convert(amount, f!.currency, currency, rates);
  const debt = f ? value(f.liabilities) : null, income = f ? value(f.annualIncome) : null, expenses = f ? value(f.annualExpenses) : null;
  const surplus = income && expenses ? subtract(income, expenses) : null;
  return { gross, cash, debt, income, expenses, debtRatio: percentage(debt, gross), surplusRate: percentage(surplus, income), runway: cash && expenses ? divide(multiply(cash, whole(12)), expenses) : null, expenseYears: gross && expenses ? divide(gross, expenses) : null, incomeDay: income ? divide(income, whole(365)) : null, expenseDay: expenses ? divide(expenses, whole(365)) : null, cashDebt: cash && debt ? divide(cash, debt) : null };
}
