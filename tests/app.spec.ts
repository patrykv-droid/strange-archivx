import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CNY', 'CAD', 'AUD', 'NOK', 'SEK', 'DKK', 'CZK'];
async function mockRates(page: Page) {
  await page.route('https://api.nbp.pl/**', route => route.fulfill({ json: [{ table: 'A', no: 'TEST/A/NBP/2026', effectiveDate: '2026-10-30', rates: currencies.map(code => ({ code, mid: code === 'EUR' ? 4.25 : code === 'USD' ? 4 : 1 })) }] }));
}

test('creates a person and enormous assets, converts, edits, persists and deletes', async ({ page }) => {
  await mockRates(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Usuń dane przykładowe' }).click();
  await page.getByRole('button', { name: 'Wyczyść rejestr', exact: true }).click();
  await page.getByRole('button', { name: 'Dodaj podmiot', exact: true }).click();
  await page.getByLabel('Nazwa / imię i nazwisko').fill('Jan Testowy');
  await page.getByRole('dialog', { name: 'Nowy podmiot' }).getByRole('button', { name: 'Dodaj podmiot', exact: true }).click();
  await page.getByRole('button', { name: 'Dodaj aktywo', exact: true }).click();
  await page.getByLabel('Nazwa aktywa').fill('Gigantyczny portfel');
  await page.getByLabel('Wartość', { exact: true }).fill('123456789012345678901234567890,125');
  await page.getByRole('combobox', { name: 'Waluta', exact: true }).selectOption('EUR');
  await page.getByRole('dialog', { name: 'Dodaj aktywo', exact: true }).getByRole('button', { name: 'Dodaj aktywo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Jan Testowy' })).toContainText('Gigantyczny portfel');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('aureo.registry.v1')!));
  expect(stored.entities[0].assets[0].amount).toBe('123456789012345678901234567890.125');
  await page.getByRole('dialog', { name: 'Jan Testowy' }).getByRole('button', { name: 'Zamknij', exact: true }).click();
  await page.getByRole('combobox', { name: 'Waluta widoku' }).selectOption('USD');
  await page.getByRole('button', { name: 'Otwórz Jan Testowy' }).click();
  await expect(page.locator('.detail-summary strong')).toHaveText('131 172,84 kwadryliona USD', { useInnerText: true });
  await page.getByRole('button', { name: 'Edytuj', exact: true }).click();
  await page.getByLabel('Wartość', { exact: true }).fill('200');
  await page.getByRole('dialog', { name: 'Edytuj aktywo' }).getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.locator('.detail-summary strong')).toHaveText('212,50 USD');
  await page.reload();
  await page.getByRole('button', { name: 'Otwórz Jan Testowy' }).click();
  await expect(page.getByRole('dialog')).toContainText('200,00 EUR');
  await page.getByRole('button', { name: 'Usuń Gigantyczny portfel' }).click();
  await page.getByRole('button', { name: 'Usuń aktywo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Jan Testowy' })).toContainText('Pierwsze aktywo czeka na dodanie');
  await page.getByRole('button', { name: 'Usuń podmiot', exact: true }).click();
  await page.getByRole('dialog', { name: 'Usunąć podmiot?' }).getByRole('button', { name: 'Usuń podmiot', exact: true }).click();
  await expect(page.getByText('Tutaj zaczyna się Twój rejestr')).toBeVisible();
});

test('filters, reports and JSON backup import/export work', async ({ page }) => {
  await mockRates(page); await page.goto('/');
  await page.getByRole('button', { name: 'Firmy', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Szukaj podmiotu').fill('Meridian');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportuj', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/aureo-kopia.*\.json/);
  const backup = { version: 1, isDemo: false, entities: [{ id: 'import-1', name: 'Importowana firma', type: 'company', description: '', assets: [], createdAt: '2026-10-30T12:00:00Z', updatedAt: '2026-10-30T12:00:00Z' }] };
  await page.getByLabel('Importuj kopię JSON').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Przywróć kopię', exact: true }).click();
  await page.getByLabel('Szukaj podmiotu').fill('');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Importowana firma');
  await page.getByRole('button', { name: 'Raporty', exact: true }).click();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Pobierz raport CSV' }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
});

test('does not substitute rates on network failure and uses cached table offline', async ({ page }) => {
  await mockRates(page); await page.goto('/');
  await expect(page.getByText('Połączono z NBP')).toBeVisible();
  await page.unroute('https://api.nbp.pl/**');
  await page.route('https://api.nbp.pl/**', route => route.abort());
  await page.reload();
  await page.getByRole('button', { name: 'Kursy walut', exact: true }).click();
  await expect(page.getByText(/Brak połączenia z NBP/)).toBeVisible();
  await expect(page.getByText('4,25 zł', { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('aureo.nbp.v1'));
  await page.reload();
  await page.getByRole('button', { name: 'Kursy walut', exact: true }).click();
  await expect(page.getByText(/Nie udało się połączyć z NBP/)).toBeVisible();
  await page.getByLabel('Waluta widoku').selectOption('EUR');
  await page.getByRole('button', { name: 'Przegląd', exact: true }).click();
  await expect(page.locator('.total-number')).toContainText('—');
  await expect(page.getByText(/Brak kursów potrzebnych/)).toBeVisible();
});

test('invalid import preserves current data and damaged storage is not overwritten', async ({ page }) => {
  await mockRates(page); await page.goto('/');
  await page.getByLabel('Importuj kopię JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}') });
  await expect(page.getByRole('status')).toContainText('nie jest poprawną kopią');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.evaluate(() => localStorage.setItem('aureo.registry.v1', 'damaged-original'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('zapisywanie');
  expect(await page.evaluate(() => localStorage.getItem('aureo.registry.v1'))).toBe('damaged-original');
});

test('mobile layout fits viewport and dialogs support keyboard escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockRates(page); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Dodaj podmiot', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/aureo-mobile.png', fullPage: true });
});

test('desktop dashboard renders without browser errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await mockRates(page); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Majątek pod kontrolą.' })).toBeVisible();
  await expect(page.getByText('Połączono z NBP')).toBeVisible();
  await page.screenshot({ path: '/tmp/aureo-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('creates a company, updates entity details and validates an asset amount', async ({ page }) => {
  await mockRates(page); await page.goto('/');
  await page.getByRole('button', { name: 'Dodaj podmiot', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Firma', exact: true }).click();
  await page.getByLabel('Nazwa / imię i nazwisko').fill('Nowa firma');
  await page.getByRole('dialog').getByRole('button', { name: 'Dodaj podmiot', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nowa firma' })).toContainText('Firma');
  await page.getByRole('button', { name: 'Edytuj podmiot', exact: true }).click();
  await page.getByLabel('Nazwa / imię i nazwisko').fill('Nowa organizacja');
  await page.getByRole('dialog', { name: 'Edytuj podmiot' }).getByRole('button', { name: 'Organizacja', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edytuj podmiot' }).getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.getByRole('dialog', { name: 'Nowa organizacja' })).toContainText('Organizacja');
  await page.getByRole('button', { name: 'Dodaj aktywo', exact: true }).click();
  await page.getByLabel('Nazwa aktywa').fill('Budynek');
  await page.getByRole('combobox', { name: 'Kategoria', exact: true }).selectOption('property');
  await page.getByLabel('Wartość', { exact: true }).fill('1e30');
  await page.getByRole('dialog', { name: 'Dodaj aktywo', exact: true }).getByRole('button', { name: 'Dodaj aktywo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Wpisz');
  await page.getByLabel('Wartość', { exact: true }).fill('1 000 000,50');
  await page.getByRole('dialog', { name: 'Dodaj aktywo', exact: true }).getByRole('button', { name: 'Dodaj aktywo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nowa organizacja' })).toContainText('1,00 milion USD');
});


test('USD default, full amounts and photo upload survive edit, reload and export', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aureo.currency.v1', 'PLN'));
  await mockRates(page); await page.goto('/');
  await expect(page.getByLabel('Waluta widoku')).toHaveValue('USD');
  await page.getByRole('button', { name: 'Dodaj podmiot', exact: true }).click();
  await page.getByLabel('Nazwa / imię i nazwisko').fill('Zdjęcie testowe');
  const png = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 640, 480); return canvas.toDataURL('image/png').split(',')[1]; }), 'base64');
  await page.getByLabel('Wybierz zdjęcie miniatury').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Podgląd miniatury')).toBeVisible();
  await expect(page.getByAltText('Podgląd miniatury')).toHaveJSProperty('naturalWidth', 320);
  await expect(page.getByAltText('Podgląd miniatury')).toHaveJSProperty('naturalHeight', 240);
  await expect(page.getByAltText('Podgląd miniatury')).toHaveCSS('object-fit', 'contain');
  await page.getByLabel('Wybierz zdjęcie miniatury').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('JPG, PNG lub WebP');
  await expect(page.getByAltText('Podgląd miniatury')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Dodaj podmiot', exact: true }).click();
  await expect(page.getByRole('dialog').getByAltText('Zdjęcie: Zdjęcie testowe')).toBeVisible();
  await page.getByRole('button', { name: 'Dodaj aktywo', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Waluta', exact: true })).toHaveValue('USD');
  await page.getByLabel('Nazwa aktywa').fill('Pełna kwota');
  await page.getByLabel('Wartość', { exact: true }).fill('3418503043,40');
  await page.getByLabel('Wybierz zdjęcie miniatury').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Podgląd miniatury')).toBeVisible();
  await page.getByRole('dialog', { name: 'Dodaj aktywo', exact: true }).getByRole('button', { name: 'Dodaj aktywo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Zamknij', exact: true }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'Zdjęcie testowe' })).toContainText('3,42 miliarda USD');
  await page.reload();
  await expect(page.getByAltText('Zdjęcie: Zdjęcie testowe')).toBeVisible();
  await page.getByRole('button', { name: 'Otwórz Zdjęcie testowe' }).click();
  await expect(page.getByRole('dialog').getByAltText('Zdjęcie: Pełna kwota')).toBeVisible();
  await page.getByRole('button', { name: 'Edytuj podmiot', exact: true }).click();
  await page.getByRole('button', { name: 'Usuń zdjęcie', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edytuj podmiot' }).getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.getByRole('dialog').getByAltText('Zdjęcie: Zdjęcie testowe')).toHaveCount(0);
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('aureo.registry.v1')!));
  expect(data.entities.at(-1).assets[0].photo).toMatch(/^data:image/);
  await page.getByRole('dialog').getByRole('button', { name: 'Zamknij', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportuj', exact: true }).click();
  const saved = await readFile((await (await pending).path())!);
  expect(JSON.parse(saved.toString()).entities.at(-1).assets[0].photo).toBe(data.entities.at(-1).assets[0].photo);
  await page.getByLabel('Importuj kopię JSON').setInputFiles({ name: 'photos.json', mimeType: 'application/json', buffer: saved });
  await page.getByRole('button', { name: 'Przywróć kopię', exact: true }).click();
  await page.getByRole('button', { name: 'Otwórz Zdjęcie testowe' }).click();
  await expect(page.getByAltText('Zdjęcie: Pełna kwota')).toBeVisible();
});

test('opens a persistent financial profile in a new tab and updates its finances', async ({ page }) => {
  await mockRates(page); await page.goto('/');
  await expect(page.getByText('Połączono z NBP')).toBeVisible();
  const pending = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Profil Aleksander Nowak w nowej karcie', exact: true }).click();
  const profile = await pending;
  await profile.route('https://api.nbp.pl/**', r => r.abort());
  await expect(profile.getByRole('heading', { name: 'Aleksander Nowak', exact: true })).toBeVisible();
  await expect(profile).toHaveURL(/#profil\//);
  const metric = (name: string) => profile.locator('.profile-metric').filter({ has: profile.locator('span', { hasText: new RegExp(`^${name}$`) }) });
  await expect(metric('Aktywa brutto')).toContainText('2,40 miliarda USD');
  await expect(metric('Majątek netto')).toContainText('—');
  await profile.getByRole('button', { name: 'Edytuj finanse', exact: true }).click();
  await profile.getByLabel('Zobowiązania łącznie').fill('500000000');
  await profile.getByLabel('Roczne przychody / dochody').fill('100000000');
  await profile.getByLabel('Roczne koszty / wydatki').fill('125000000');
  await profile.getByLabel('Notatki finansowe').fill('Finanse podmiotu — test zapisu.');
  await profile.getByRole('button', { name: 'Zapisz finanse', exact: true }).click();
  await expect(metric('Majątek netto')).toContainText('1,90 miliarda USD');
  await expect(metric('Roczna nadwyżka / deficyt')).toContainText('-25,00 milionów USD');
  await profile.reload();
  await expect(profile.getByText('Finanse podmiotu — test zapisu.')).toBeVisible();
  await expect(metric('Majątek netto')).toContainText('1,90 miliarda USD');
  await profile.getByRole('button', { name: 'Edytuj podmiot', exact: true }).click();
  await profile.getByLabel('Nazwa / imię i nazwisko').fill('Aleksander Nowak — profil');
  await profile.getByRole('button', { name: 'Zapisz zmiany', exact: true }).click();
  await expect(metric('Majątek netto')).toContainText('1,90 miliarda USD');
  await profile.getByLabel('Waluta profilu').selectOption('EUR');
  await expect(metric('Majątek netto')).toContainText('1,79 miliarda EUR');
  const exported = profile.waitForEvent('download');
  await profile.getByRole('button', { name: 'Eksportuj profil JSON', exact: true }).click();
  const data = JSON.parse(await readFile((await (await exported).path())!, 'utf8'));
  expect(data.entities).toHaveLength(1);
  expect(data.entities[0].financials.liabilities).toBe('500000000');
  await page.bringToFront();
  await expect(page.locator('tbody')).toContainText('Aleksander Nowak — profil');
  await profile.setViewportSize({ width: 390, height: 844 });
  expect(await profile.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await profile.screenshot({ path: '/tmp/aureo-profile-mobile.png', fullPage: true });
  await profile.close();
});
