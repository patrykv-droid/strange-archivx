// Money never passes through Number: decimal text -> rational BigInts -> display.
export type Rational = { n: bigint; d: bigint };
export const ZERO: Rational = { n: 0n, d: 1n };
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
function rational(n: bigint, d: bigint): Rational {
  if (d <= 0n) throw new Error('Nieprawidłowy mianownik');
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function normalizeAmount(input: string): string {
  const text = input.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (text.length > 1101 || !/^\d+(?:\.\d{1,100})?$/.test(text)) {
    throw new Error('Wpisz dodatnią kwotę cyframi, np. 1 000 000,50 (do 100 miejsc po przecinku).');
  }
  const [whole, fraction = ''] = text.split('.');
  if (whole.length > 1000) throw new Error('Kwota może mieć maksymalnie 1000 cyfr przed przecinkiem.');
  const tail = fraction.replace(/0+$/, '');
  return whole.replace(/^0+(?=\d)/, '') + (tail ? `.${tail}` : '');
}
export function decimal(input: string): Rational {
  const text = normalizeAmount(input);
  const [whole, fraction = ''] = text.split('.');
  return rational(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
}
export function add(a: Rational, b: Rational): Rational {
  const g = gcd(a.d, b.d);
  return rational(a.n * (b.d / g) + b.n * (a.d / g), (a.d / g) * b.d);
}
export function compare(a: Rational, b: Rational): number {
  const delta = a.n * b.d - b.n * a.d;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
export function convert(amount: string, from: string, to: string, rates: Record<string, string>): Rational | null {
  const value = decimal(amount);
  if (from === to) return value;
  if (!rates[from] || !rates[to]) return null;
  const source = decimal(rates[from]);
  const target = decimal(rates[to]);
  if (target.n === 0n || source.n === 0n) return null;
  return rational(value.n * source.n * target.d, value.d * source.d * target.n);
}
export function sum(values: (Rational | null)[]): Rational | null {
  if (values.some(v => v === null)) return null;
  return values.reduce<Rational>((total, v) => add(total, v!), ZERO);
}
export function fixed(value: Rational, places = 2): string {
  const factor = 10n ** BigInt(places);
  const negative = value.n < 0n;
  const n = negative ? -value.n : value.n;
  const rounded = (n * factor * 2n + value.d) / (value.d * 2n);
  const digits = rounded.toString().padStart(places + 1, '0');
  return `${negative ? '-' : ''}${places ? digits.slice(0, -places) + '.' + digits.slice(-places) : digits}`;
}
export function formatMoney(value: Rational | null, currency?: string, compact = false): string {
  if (!value) return '—';
  let formatted: string;
  if (compact && value.n / value.d >= 1_000_000n) {
    const units: [bigint, string][] = [
      [10n ** 18n, 'trl'], [10n ** 15n, 'bld'], [10n ** 12n, 'bln'], [10n ** 9n, 'mld'], [10n ** 6n, 'mln'],
    ];
    const [factor, unit] = units.find(([factor]) => value.n / value.d >= factor)!;
    // Above a trylion, scientific notation stays readable even for 1000-digit sums.
    if (value.n / value.d >= 10n ** 21n) {
      const digits = (value.n / value.d).toString();
      formatted = `${digits[0]},${digits.slice(1, 3)} × 10^${digits.length - 1}`;
    } else formatted = `${fixed({ n: value.n, d: value.d * factor }).replace('.', ',')} ${unit}`;
  } else {
    const [whole, fraction] = fixed(value).split('.');
    formatted = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${fraction}`;
  }
  return formatted + (currency ? ` ${currency}` : '');
}
export function share(value: Rational, total: Rational): number {
  if (total.n === 0n) return 0;
  // Only the bounded percentage is converted to Number for rendering charts.
  return Number(value.n * total.d * 10000n / (value.d * total.n)) / 100;
}
