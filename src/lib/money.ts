import { LONG_SCALE } from './scales';
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
  const absolute = value.n < 0n ? -value.n : value.n;
  if (compact && absolute / value.d >= 1000n) {
    let index = LONG_SCALE.findIndex(([power]) => absolute >= value.d * 10n ** BigInt(power));
    let [power, unit] = LONG_SCALE[index];
    let scaled = fixed({ n: value.n, d: value.d * 10n ** BigInt(power) });
    // Carry display rounding into the next named unit at boundaries.
    if (index > 0 && BigInt(scaled.replace('-', '').replace('.', '')) >= 100n * 10n ** BigInt(LONG_SCALE[index - 1][0] - power)) {
      [power, unit] = LONG_SCALE[--index];
      scaled = fixed({ n: value.n, d: value.d * 10n ** BigInt(power) });
    }
    const [whole, fraction] = scaled.split('.');
    const count = BigInt(whole.replace('-', ''));
    const name = fraction !== '00' ? (unit === 'tysiąc' ? 'tysiąca' : unit + 'a') : count === 1n ? unit : count % 10n >= 2n && count % 10n <= 4n && (count % 100n < 12n || count % 100n > 14n) ? (unit === 'tysiąc' ? 'tysiące' : unit + 'y') : (unit === 'tysiąc' ? 'tysięcy' : unit + 'ów');
    formatted = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${fraction} ${name}`;
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

export function subtract(a: Rational, b: Rational): Rational { return add(a, { n: -b.n, d: b.d }); }

export function multiply(a: Rational, b: Rational): Rational { return rational(a.n * b.n, a.d * b.d); }
export function divide(a: Rational, b: Rational): Rational | null {
  if (b.n === 0n) return null;
  const sign = b.n < 0n ? -1n : 1n;
  return rational(a.n * b.d * sign, a.d * b.n * sign);
}
