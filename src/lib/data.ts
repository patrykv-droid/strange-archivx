import { isThumbnail } from './images';
import { normalizeAmount } from './money';

export const CURRENCIES = ['USD', 'PLN', 'EUR', 'GBP', 'CHF', 'JPY', 'CNY', 'CAD', 'AUD', 'NOK', 'SEK', 'DKK', 'CZK'] as const;
export type Currency = typeof CURRENCIES[number];
export const TYPES = { person: 'Osoba', company: 'Firma', organization: 'Organizacja' } as const;
export type EntityType = keyof typeof TYPES;
export const CATEGORIES = {
  investments: { label: 'Inwestycje', color: '#222222' },
  property: { label: 'Nieruchomości', color: '#777777' },
  business: { label: 'Udziały w firmach', color: '#aaaaaa' },
  cash: { label: 'Gotówka i depozyty', color: '#cccccc' },
  other: { label: 'Pozostałe aktywa', color: '#555555' },
} as const;
export type Category = keyof typeof CATEGORIES;
export type Asset = { photo?: string; id: string; name: string; category: Category; amount: string; currency: Currency };
export type Entity = { photo?: string; id: string; name: string; type: EntityType; description: string; assets: Asset[]; createdAt: string; updatedAt: string };
export type Registry = { version: 1; entities: Entity[]; isDemo: boolean };
export const STORAGE_KEY = 'aureo.registry.v1';
export const RATE_KEY = 'aureo.nbp.v1';
export function id(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Support development over plain HTTP on a local network as well as HTTPS.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function demoRegistry(): Registry {
  const date = new Date().toISOString();
  const asset = (name: string, category: Category, amount: string): Asset => ({ id: id(), name, category, amount, currency: 'USD' });
  return { version: 1, isDemo: true, entities: [
    { id: id(), name: 'Aleksander Nowak', type: 'person', description: 'Portfel prywatny · Polska', createdAt: date, updatedAt: date, assets: [asset('Portfel inwestycyjny', 'investments', '1800000000'), asset('Nieruchomości komercyjne', 'property', '450000000'), asset('Depozyty bankowe', 'cash', '150000000')] },
    { id: id(), name: 'Meridian Capital', type: 'company', description: 'Holding inwestycyjny', createdAt: date, updatedAt: date, assets: [asset('Udziały w spółkach', 'business', '1250000000'), asset('Obligacje i fundusze', 'investments', '580000000'), asset('Rezerwy gotówkowe', 'cash', '90000000')] },
    { id: id(), name: 'Natalia Wiśniewska', type: 'person', description: 'Portfel prywatny · Polska', createdAt: date, updatedAt: date, assets: [asset('Nieruchomości mieszkaniowe', 'property', '680000000'), asset('Akcje i ETF-y', 'investments', '210000000')] },
    { id: id(), name: 'Horizon Group', type: 'company', description: 'Technologia i nieruchomości', createdAt: date, updatedAt: date, assets: [asset('Park technologiczny', 'property', '420000000'), asset('Udziały w startupach', 'business', '260000000')] },
    { id: id(), name: 'Fundacja Dobre Jutro', type: 'organization', description: 'Fundusz wieczysty', createdAt: date, updatedAt: date, assets: [asset('Fundusz inwestycyjny', 'investments', '180000000'), asset('Zbiory sztuki', 'other', '30000000')] },
  ] };
}
export function validateRegistry(value: unknown): Registry {
  const fail = () => { throw new Error('Plik nie jest poprawną kopią danych Aureo. Żadne dane nie zostały zastąpione.'); };
  if (!value || typeof value !== 'object') return fail();
  const data = value as Registry;
  if (data.version !== 1 || !Array.isArray(data.entities) || data.entities.length > 10000 || typeof data.isDemo !== 'boolean') return fail();
  const ids = new Set<string>();
  const unique = (key: unknown) => { if (typeof key !== 'string' || !key || ids.has(key)) fail(); ids.add(key as string); };
  for (const e of data.entities) {
    if (!e || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 150 || !Object.hasOwn(TYPES, e.type) || typeof e.description !== 'string' || e.description.length > 1000 || !Array.isArray(e.assets) || e.assets.length > 10000) return fail();
    if (typeof e.createdAt !== 'string' || typeof e.updatedAt !== 'string' || !Number.isFinite(Date.parse(e.createdAt)) || !Number.isFinite(Date.parse(e.updatedAt))) return fail();
    if (e.photo !== undefined && !isThumbnail(e.photo)) return fail();
    unique(e.id);
    for (const a of e.assets) {
      if (!a || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 150 || !Object.hasOwn(CATEGORIES, a.category) || !CURRENCIES.includes(a.currency) || typeof a.amount !== 'string') return fail();
      if (a.photo !== undefined && !isThumbnail(a.photo)) return fail();
      unique(a.id);
      try { if (normalizeAmount(a.amount) !== a.amount) return fail(); } catch { return fail(); }
    }
  }
  return data;
}
export type Rates = { date: string; table: string; fetchedAt: string; rates: Record<string, string> };
export function parseNbp(value: unknown): Rates {
  if (!Array.isArray(value) || value.length !== 1) throw new Error('Niepoprawna odpowiedź NBP.');
  const table = value[0];
  if (table.table !== 'A' || typeof table.no !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(table.effectiveDate) || !Array.isArray(table.rates)) throw new Error('Niepoprawna tabela NBP.');
  const rates: Record<string, string> = { PLN: '1' };
  for (const entry of table.rates) {
    if (CURRENCIES.includes(entry.code) && typeof entry.mid === 'number' && Number.isFinite(entry.mid) && entry.mid > 0) rates[entry.code] = normalizeAmount(String(entry.mid));
  }
  if (!CURRENCIES.every(c => rates[c])) throw new Error('Niepełna tabela kursów NBP.');
  return { date: table.effectiveDate, table: table.no, fetchedAt: new Date().toISOString(), rates };
}
