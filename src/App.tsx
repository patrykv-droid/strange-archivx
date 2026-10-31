import EntityProfile, { FinancialForm } from './EntityProfile';
import { makeThumbnail } from './lib/images';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpRight, ArrowUpDown, Building2, Check, ChevronRight, CircleHelp, Coins, Download, ExternalLink, FileJson, Globe2, Landmark, LayoutGrid, LockKeyhole, PieChart, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, TrendingUp, Upload, UserRound, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { add, compare, convert, decimal, formatMoney, normalizeAmount, share, sum, ZERO, type Rational } from './lib/money';
import { CATEGORIES, CURRENCIES, demoRegistry, id, parseNbp, RATE_KEY, STORAGE_KEY, TYPES, validateRegistry, type Asset, type Category, type Currency, type Entity, type EntityType, type Financials, type Rates, type Registry } from './lib/data';

type View = 'overview' | 'assets' | 'reports' | 'rates';
type Filter = 'all' | EntityType;
type FormState = { kind: 'finances'; entityId: string } | { kind: 'entity'; entity?: Entity } | { kind: 'asset'; entityId: string; asset?: Asset } | null;
type Confirmation = { title: string; message: string; action: string; run: () => void } | null;
const TYPE_ICONS: Record<EntityType, LucideIcon> = { person: UserRound, company: Building2, organization: Landmark };
const VIEW_TITLES: Record<View, string> = { overview: 'Przegląd majątku', assets: 'Wszystkie aktywa', reports: 'Raport majątkowy', rates: 'Kursy walut' };

function profileFromHash(): string | null {
  try { return location.hash.startsWith('#profil/') ? decodeURIComponent(location.hash.slice(8)) || null : null; } catch { return null; }
}
function profileUrl(entityId: string): string { const url = new URL(location.href); url.hash = 'profil/' + encodeURIComponent(entityId); return url.href; }
function initialRegistry(): { data: Registry; damaged: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { data: raw ? validateRegistry(JSON.parse(raw)) : demoRegistry(), damaged: false };
  } catch { return { data: { version: 1, entities: [], isDemo: false }, damaged: true }; }
}
function cachedRates(): Rates | null {
  try {
    const raw = JSON.parse(localStorage.getItem(RATE_KEY) || 'null') as Rates | null;
    if (!raw || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || typeof raw.table !== 'string' || !Number.isFinite(Date.parse(raw.fetchedAt)) || !CURRENCIES.every(c => typeof raw.rates[c] === 'string' && decimal(raw.rates[c]).n > 0n) || raw.rates.PLN !== '1') return null;
    return raw;
  } catch { return null; }
}
function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dateLabel(date: string) { return date.split('-').reverse().join('.'); }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(); }

function Modal({ title, subtitle, children, close, wide = false }: { title: string; subtitle?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-label={title} onCancel={e => { e.preventDefault(); closeRef.current(); }} onClick={e => { if (e.target === ref.current) closeRef.current(); }}>
    <div className="modal-top"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Zamknij" onClick={close}><X size={20} /></button></div>
    {children}
  </dialog>;
}

function PhotoUpload({ value, change, busy }: { value?: string; change: (photo?: string) => void; busy: (value: boolean) => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    setError(''); setLoading(true); busy(true);
    try { change(await makeThumbnail(file)); } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); busy(false); if (input.current) input.current.value = ''; }
  }
  return <div className="photo-upload"><div className="photo-preview">{value ? <img src={value} alt="Podgląd miniatury" /> : <UserRound size={28} />}</div><div><strong>Miniatura rekordu</strong><p>JPG, PNG lub WebP · do 10 MB. Dowolne proporcje — bez przycinania.</p><div className="photo-buttons"><button type="button" className="button secondary small" disabled={loading} onClick={() => input.current?.click()}><Upload size={14} />{loading ? 'Przetwarzanie…' : value ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}</button>{value && <button type="button" className="text-button" disabled={loading} onClick={() => change(undefined)}>Usuń zdjęcie</button>}</div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Wybierz zdjęcie miniatury" className="sr-only" onChange={e => void upload(e.target.files?.[0])} />{error && <p className="field-error" role="alert">{error}</p>}</div></div>;
}

function EntityForm({ entity, save, close }: { entity?: Entity; save: (entity: Entity) => void; close: () => void }) {
  const [photo, setPhoto] = useState(entity?.photo);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [name, setName] = useState(entity?.name || '');
  const [type, setType] = useState<EntityType>(entity?.type || 'person');
  const [description, setDescription] = useState(entity?.description || '');
  function submit(e: FormEvent) {
    e.preventDefault(); if (!name.trim() || photoBusy) return;
    const now = new Date().toISOString();
    save({ financials: entity?.financials, photo, id: entity?.id || id(), name: name.trim(), type, description: description.trim(), assets: entity?.assets || [], createdAt: entity?.createdAt || now, updatedAt: now });
  }
  return <Modal title={entity ? 'Edytuj podmiot' : 'Nowy podmiot'} subtitle="Wszystko zaczyna się od osoby, firmy lub organizacji." close={close}>
    <form onSubmit={submit} className="editor-form">
      <PhotoUpload value={photo} change={setPhoto} busy={setPhotoBusy} />
      <fieldset><legend>Rodzaj podmiotu</legend><div className="type-choices">{Object.entries(TYPES).map(([key, label]) => { const Icon = TYPE_ICONS[key as EntityType]; return <button key={key} type="button" className={type === key ? 'selected' : ''} aria-pressed={type === key} onClick={() => setType(key as EntityType)}><Icon size={21} />{label}</button>; })}</div></fieldset>
      <label>Nazwa / imię i nazwisko<input autoFocus required maxLength={150} value={name} onChange={e => setName(e.target.value)} placeholder={type === 'person' ? 'np. Jan Kowalski' : 'np. Meridian Capital'} /></label>
      <label>Opis <span className="optional">opcjonalnie</span><textarea maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Krótki opis, kraj lub dodatkowe informacje" rows={3} /></label>
      <div className="form-note"><ShieldCheck size={16} /> Dane pozostają w tej przeglądarce.</div>
      <div className="modal-actions"><button className="button secondary" type="button" onClick={close}>Anuluj</button><button className="button primary" type="submit" disabled={photoBusy}><Check size={17} />{entity ? 'Zapisz zmiany' : 'Dodaj podmiot'}</button></div>
    </form>
  </Modal>;
}

function AssetForm({ entity, asset, save, close }: { entity: Entity; asset?: Asset; save: (asset: Asset) => void; close: () => void }) {
  const [photo, setPhoto] = useState(asset?.photo);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [name, setName] = useState(asset?.name || '');
  const [category, setCategory] = useState<Category>(asset?.category || 'investments');
  const [amount, setAmount] = useState(asset?.amount.replace('.', ',') || '');
  const [currency, setCurrency] = useState<Currency>(asset?.currency || 'USD');
  const [error, setError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    try { const normalized = normalizeAmount(amount); if (!name.trim() || photoBusy) return; save({ photo, id: asset?.id || id(), name: name.trim(), category, amount: normalized, currency }); }
    catch (err) { setError((err as Error).message); }
  }
  let preview = '';
  try { if (amount.trim()) preview = formatMoney(decimal(amount), currency); } catch { /* Incomplete input. */ }
  return <Modal title={asset ? 'Edytuj aktywo' : 'Dodaj aktywo'} subtitle={`Właściciel: ${entity.name}`} close={close}>
    <form className="editor-form" onSubmit={submit}>
      <PhotoUpload value={photo} change={setPhoto} busy={setPhotoBusy} />
      <label>Nazwa aktywa<input autoFocus required maxLength={150} value={name} onChange={e => setName(e.target.value)} placeholder="np. Portfel inwestycyjny" /></label>
      <label>Kategoria<select value={category} onChange={e => setCategory(e.target.value as Category)}>{Object.entries(CATEGORIES).map(([key, c]) => <option value={key} key={key}>{c.label}</option>)}</select></label>
      <div className="amount-fields"><label>Wartość<input required type="text" inputMode="decimal" maxLength={1500} value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} placeholder="0,00" aria-invalid={!!error} aria-describedby={error ? 'amount-error' : 'amount-help'} /></label><label>Waluta<select value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
      {error && <p className="field-error" id="amount-error" role="alert">{error}</p>}
      {preview && <div className="amount-preview">{preview}</div>}
      <div className="form-note" id="amount-help"><Sparkles size={17} /><span>Miliony, biliony i więcej. Wpisz pełną kwotę — zachowamy każdą cyfrę. Do 1000 cyfr części całkowitej i 100 miejsc po przecinku.</span></div>
      <div className="modal-actions"><button className="button secondary" type="button" onClick={close}>Anuluj</button><button className="button primary" type="submit" disabled={photoBusy}><Check size={17} />{asset ? 'Zapisz zmiany' : 'Dodaj aktywo'}</button></div>
    </form>
  </Modal>;
}

export default function App() {
  const [profileId, setProfileId] = useState(profileFromHash);
  function backToRegistry() { history.replaceState(null, '', location.pathname + location.search); setProfileId(null); }
  useEffect(() => { const changed = () => setProfileId(profileFromHash()); window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  const [initial] = useState(initialRegistry);
  const [registry, setRegistry] = useState(initial.data);
  useEffect(() => {
    function sync() {
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setRegistry(validateRegistry(JSON.parse(raw))); } catch { /* Preserve the current in-memory registry when another tab has invalid storage. */ }
    }
    const storage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) sync(); };
    window.addEventListener('storage', storage); window.addEventListener('focus', sync);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('focus', sync); };
  }, []);
  const [damaged, setDamaged] = useState(initial.damaged);
  const [view, setView] = useState<View>('overview');
  const [currency, setCurrency] = useState<Currency>(() => { try { const saved = localStorage.getItem('aureo.currency.v2'); return CURRENCIES.includes(saved as Currency) ? saved as Currency : 'USD'; } catch { return 'USD'; } });
  useEffect(() => { try { localStorage.setItem('aureo.currency.v2', currency); } catch { /* A display preference must not block the registry. */ } }, [currency]);
  const [rates, setRates] = useState<Rates | null>(cachedRates);
  const [rateStatus, setRateStatus] = useState<'loading' | 'live' | 'cached' | 'error'>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'value' | 'name'>('value');
  const [form, setForm] = useState<FormState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [toast, setToast] = useState('');
  const [help, setHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const ratesRef = useRef(rates); ratesRef.current = rates;

  const refreshRates = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setRateStatus('loading');
    try {
      const response = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/?format=json', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`NBP: ${response.status}`);
      const next = parseNbp(await response.json());
      if (controller.signal.aborted) return;
      setRates(next); ratesRef.current = next; setRateStatus('live');
      try { localStorage.setItem(RATE_KEY, JSON.stringify(next)); } catch { /* Rate cache is optional; registry is saved separately. */ }
    } catch {
      if (!controller.signal.aborted) setRateStatus(ratesRef.current ? 'cached' : 'error');
    }
  }, []);
  useEffect(() => { void refreshRates(); const timer = setInterval(() => void refreshRates(), 3600000); return () => { clearInterval(timer); request.current?.abort(); }; }, [refreshRates]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);

  const fx = rates?.rates || { PLN: '1' };
  const valueOf = (a: Asset) => convert(a.amount, a.currency, currency, fx);
  const entityValue = (e: Entity) => sum(e.assets.map(valueOf));
  const assets = registry.entities.flatMap(entity => entity.assets.map(asset => ({ ...asset, entity })));
  const total = sum(assets.map(valueOf));
  const byCategory = Object.entries(CATEGORIES).map(([key, category]) => ({ key: key as Category, ...category, value: sum(assets.filter(a => a.category === key).map(valueOf)), count: assets.filter(a => a.category === key).length }));
  const missingRates = assets.some(a => valueOf(a) === null);
  const personCount = registry.entities.filter(e => e.type === 'person').length;
  const companyCount = registry.entities.filter(e => e.type === 'company').length;
  const profile = registry.entities.find(e => e.id === profileId);
  useEffect(() => { document.title = profile ? `${profile.name} — profil finansowy | Aureo` : 'Aureo — Twój rejestr majątku'; }, [profile?.name]);
  const selected = registry.entities.find(e => e.id === selectedId);
  const searchMatches = (e: Entity) => `${e.name} ${e.description} ${e.assets.map(a => a.name).join(' ')}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl'));
  const filtered = registry.entities.filter(e => (filter === 'all' || e.type === filter) && searchMatches(e)).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'pl');
    const av = entityValue(a), bv = entityValue(b);
    return av && bv ? compare(bv, av) : av ? -1 : bv ? 1 : a.name.localeCompare(b.name, 'pl');
  });
  function commit(next: Registry): boolean {
    if (damaged) { setToast('Najpierw pobierz kopię odzyskiwania i zresetuj uszkodzony zapis.'); return false; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setRegistry(next); return true; }
    catch { setToast('Nie udało się zapisać danych. Sprawdź miejsce i uprawnienia przeglądarki.'); return false; }
  }
  function saveFinances(entityId: string, financials: Financials) {
    if (commit({ ...registry, entities: registry.entities.map(e => e.id === entityId ? { ...e, financials, updatedAt: new Date().toISOString() } : e) })) { setForm(null); setToast('Dane finansowe zapisane.'); }
  }
  function saveEntity(entity: Entity) {
    const exists = registry.entities.some(e => e.id === entity.id);
    const entities = exists ? registry.entities.map(e => e.id === entity.id ? entity : e) : [...registry.entities, entity];
    if (commit({ ...registry, entities })) { setForm(null); setToast(exists ? 'Zapisano zmiany podmiotu.' : 'Podmiot dodany. Teraz możesz dodać jego aktywa.'); if (!exists) setSelectedId(entity.id); }
  }
  function saveAsset(entityId: string, asset: Asset) {
    const entities = registry.entities.map(e => e.id === entityId ? { ...e, updatedAt: new Date().toISOString(), assets: e.assets.some(a => a.id === asset.id) ? e.assets.map(a => a.id === asset.id ? asset : a) : [...e.assets, asset] } : e);
    if (commit({ ...registry, entities })) { setForm(null); setToast('Aktywo zapisane. Wartości majątku zostały przeliczone.'); }
  }
  function deleteEntity(entity: Entity) {
    setConfirmation({ title: 'Usunąć podmiot?', message: `„${entity.name}” i wszystkie jego aktywa zostaną trwale usunięte z tego rejestru.`, action: 'Usuń podmiot', run: () => { if (commit({ ...registry, entities: registry.entities.filter(e => e.id !== entity.id) })) { setSelectedId(null); setToast('Podmiot usunięty.'); } } });
  }
  function deleteAsset(entityId: string, asset: Asset) {
    setConfirmation({ title: 'Usunąć aktywo?', message: `Aktywo „${asset.name}” zostanie trwale usunięte.`, action: 'Usuń aktywo', run: () => { if (commit({ ...registry, entities: registry.entities.map(e => e.id === entityId ? { ...e, updatedAt: new Date().toISOString(), assets: e.assets.filter(a => a.id !== asset.id) } : e) })) setToast('Aktywo usunięte.'); } });
  }
  function clearDemo() {
    setConfirmation({ title: 'Zacząć od pustego rejestru?', message: 'Usuniemy wszystkie widoczne podmioty i aktywa, również dodane przez Ciebie. Najpierw wyeksportuj dane, jeśli chcesz je zachować.', action: 'Wyczyść rejestr', run: () => { if (commit({ version: 1, entities: [], isDemo: false })) setToast('Rejestr gotowy na Twoje dane.'); } });
  }
  function exportData() { download(`aureo-kopia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(registry, null, 2)); setToast('Wyeksportowano kopię wszystkich podmiotów i aktywów.'); }
  async function importData(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setToast('Plik jest zbyt duży. Limit importu to 10 MB.'); return; }
    try {
      const data = validateRegistry(JSON.parse(await file.text()));
      setConfirmation({ title: 'Przywrócić kopię danych?', message: `Plik zawiera ${data.entities.length} podmiotów. Import zastąpi cały obecny rejestr. Przed importem możesz anulować i pobrać kopię obecnych danych.`, action: 'Przywróć kopię', run: () => { if (commit(data)) { setSelectedId(null); setToast('Kopia została przywrócona.'); } } });
    } catch (err) { setToast(err instanceof SyntaxError ? 'Plik nie zawiera poprawnego formatu JSON.' : (err as Error).message); }
  }
  function exportReport() {
    const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
    // Prefix text cells beginning with formula characters to prevent CSV formula execution.
    const textCell = (s: string) => quote(/^[=+@\-\t\r]/.test(s) ? `'${s}` : s);
    const rows = [['Podmiot', 'Typ', 'Aktywo', 'Kategoria', 'Kwota oryginalna', 'Waluta', `Wartość w ${currency}`, 'Data kursów NBP'].map(quote).join(';'), ...assets.map(a => [textCell(a.entity.name), quote(TYPES[a.entity.type]), textCell(a.name), quote(CATEGORIES[a.category].label), quote(a.amount), quote(a.currency), quote(valueOf(a) ? formatMoney(valueOf(a)) : 'Brak kursu'), quote(rates?.date || '')].join(';'))];
    download(`aureo-raport-${currency}.csv`, '\ufeff' + rows.join('\r\n'), 'text/csv;charset=utf-8'); setToast('Raport CSV pobrany. Kopię do ponownego importu zapiszesz przyciskiem Eksportuj.');
  }
  const nav: { key: View; title: string; icon: LucideIcon }[] = [{ key: 'overview', title: 'Przegląd', icon: LayoutGrid }, { key: 'assets', title: 'Aktywa', icon: Wallet }, { key: 'reports', title: 'Raporty', icon: PieChart }, { key: 'rates', title: 'Kursy walut', icon: ArrowUpDown }];

  function profileLink(entity: Entity) {
    return <a className="profile-link" href={profileUrl(entity.id)} target="_blank" rel="noopener" aria-label={`Profil ${entity.name} w nowej karcie`} onClick={event => { if (!commit(registry)) event.preventDefault(); }}><ExternalLink size={14} />Profil</a>;
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); backToRegistry(); setView('overview'); }}><span className="brand-symbol">a<span>.</span></span><span>aureo<span className="brand-period">.</span></span></a>
      <div className="workspace-label"><span className="workspace-avatar">P</span><span>Przestrzeń prywatna<small>Twój rejestr majątku</small></span><LockKeyhole size={13} /></div>
      <div className="nav-label">PRZESTRZEŃ ROBOCZA</div>
      <nav aria-label="Nawigacja główna">{nav.map(({ key, title, icon: Icon }) => <button key={key} aria-label={title} className={`nav-item ${view === key ? 'active' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={() => { backToRegistry(); setView(key); setQuery(''); }}><Icon size={19} strokeWidth={1.7} /><span>{title}</span>{key === 'overview' && <span className="nav-count">{registry.entities.length}</span>}{key === 'rates' && <span className={`nav-dot ${rateStatus === 'live' ? 'online' : ''}`} />}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="precision-card"><span className="precision-icon"><Sparkles size={19} /></span><h3>Wielkie liczby.<br />Pełna precyzja.</h3><p>Bo każda cyfra Twojego<br />majątku ma znaczenie.</p><button onClick={() => setHelp(true)}>Poznaj Aureo <ArrowUpRight size={15} /></button><div className="precision-orbit" /></div>
        <button className="sidebar-help" onClick={() => setHelp(true)}><CircleHelp size={18} />Pomoc i informacje<ArrowUpRight size={14} /></button>
        <div className="local-profile"><span className="profile-avatar"><UserRound size={19} /></span><span>Twój rejestr<small>Zapis lokalny</small></span><span className="profile-dot" /></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Moja przestrzeń <ChevronRight size={13} /><strong>{profileId ? (profile?.name || 'Profil podmiotu') : VIEW_TITLES[view]}</strong></div><div className="topbar-right"><span className="private-label"><LockKeyhole size={13} /> Prywatne i bezpieczne</span><span className="topbar-divider" /><span className="top-avatar">TY</span></div></header>
      <main>
        {profileId ? (profile ? <EntityProfile entity={profile} currency={currency} rates={fx} rateDate={rates?.date} setCurrency={setCurrency} back={backToRegistry} edit={() => setForm({ kind: 'entity', entity: profile })} addAsset={() => setForm({ kind: 'asset', entityId: profile.id })} editAsset={assetId => setForm({ kind: 'asset', entityId: profile.id, asset: profile.assets.find(a => a.id === assetId) })} finances={() => setForm({ kind: 'finances', entityId: profile.id })} exportEntity={() => download('aureo-profil.json', JSON.stringify({ version: 1, isDemo: false, entities: [profile] }, null, 2))} /> : <div className="empty-state"><h1>Nie znaleziono profilu</h1><p>Rekord został usunięty lub nie jest zapisany w tej przeglądarce.</p><button className="button secondary" onClick={backToRegistry}>Wróć do rejestru</button></div>) : <>
        <section className="page-heading"><div><div className="eyebrow"><span /> WIEDZA TO KAPITAŁ</div><h1>{view === 'overview' ? <>Majątek pod kontrolą<span>.</span></> : VIEW_TITLES[view]} </h1><p>{view === 'overview' ? 'Osoby, firmy i ich aktywa. Jeden przejrzysty obraz całości.' : view === 'assets' ? 'Każdy składnik majątku, w jednym miejscu.' : view === 'reports' ? 'Przyjrzyj się strukturze majątku i zabierz dane ze sobą.' : 'Aktualne kursy średnie z Narodowego Banku Polskiego.'}</p></div><button className="button primary add-entity" onClick={() => setForm({ kind: 'entity' })}><Plus size={18} />Dodaj podmiot</button></section>

        {damaged && <div className="notice error-notice" role="alert"><span>Nie można odczytać zapisu. Zachowaliśmy oryginał; zapisywanie jest zablokowane.</span><button onClick={() => { try { download('aureo-odzyskiwanie.txt', localStorage.getItem(STORAGE_KEY) || '', 'text/plain'); } catch { setToast('Przeglądarka blokuje dostęp do zapisu.'); } }}>Pobierz oryginał</button><button onClick={() => setConfirmation({ title: 'Zresetować uszkodzony zapis?', message: 'Zapis zostanie usunięty. Najpierw pobierz oryginał do odzyskiwania danych.', action: 'Zresetuj zapis', run: () => { try { localStorage.removeItem(STORAGE_KEY); setDamaged(false); setToast('Możesz teraz zapisywać nowe dane.'); } catch { setToast('Nie można zresetować zapisu.'); } } })}>Resetuj</button></div>}

        <div className="context-bar"><div className="context-left"><span className="live-marker" />Przegląd Twojego rejestru{registry.isDemo && <span className="demo-badge">Dane przykładowe</span>}</div><label className="display-currency"><Globe2 size={16} /><span>Waluta widoku</span><select aria-label="Waluta widoku" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label></div>

        {missingRates && <div className="notice" role="status">Brak kursów potrzebnych do przeliczenia. Niepełne sumy oznaczamy „—”; oryginalne kwoty pozostają dostępne.<button onClick={() => setView('rates')}>Sprawdź kursy <ArrowUpRight size={14} /></button></div>}

        {(view === 'overview' || view === 'reports') && <>
          <section className="stats-grid" aria-label="Podsumowanie majątku">
            <article className="stat-card featured"><div className="stat-label">Łączna wartość majątku<span className="stat-icon"><Wallet size={19} /></span></div><div className="total-number" title={formatMoney(total, currency)}>{formatMoney(total, undefined, true)}<span>{currency}</span></div><div className="stat-foot"><span className="light-pill"><span />{assets.length} aktywów</span><span>Wszystkie podmioty</span></div><div className="card-arcs" /></article>
            <article className="stat-card"><div className="stat-label">Podmioty w rejestrze<span className="stat-icon"><Users size={19} /></span></div><div className="stat-number">{registry.entities.length}<span>podmiotów</span></div><div className="stat-foot"><span className="tiny-dot" />{personCount} osób <span className="foot-separator">·</span> {companyCount} firm <span className="foot-separator">·</span> {registry.entities.length - personCount - companyCount} organizacji</div></article>
            <article className="stat-card"><div className="stat-label">Zarejestrowane aktywa<span className="stat-icon"><Landmark size={19} /></span></div><div className="stat-number">{assets.length}<span>aktywów</span></div><div className="stat-foot"><span className="tiny-dot" />W {byCategory.filter(c => c.count > 0).length} kategoriach majątku</div></article>
          </section>
        </>}

        {view === 'overview' && <section className="middle-grid">
          <article className="panel allocation-panel"><div className="panel-title"><h2>Struktura majątku</h2><span className="subtle-tag">{currency}</span></div><div className="allocation-content"><div className="donut-wrap"><svg viewBox="0 0 160 160" className="donut" role="img" aria-label="Udział kategorii w majątku"><circle cx="80" cy="80" r="64" fill="none" stroke="#eef0e9" strokeWidth="20" />{(() => { let offset = 0; return byCategory.map(c => { const percent = total && c.value ? share(c.value, total) : 0; const start = offset; offset += percent; return <circle key={c.key} cx="80" cy="80" r="64" fill="none" stroke={c.color} strokeWidth="20" pathLength="100" strokeDasharray={`${Math.max(0, percent - (percent > 1 ? 1.2 : 0))} ${100 - Math.max(0, percent - (percent > 1 ? 1.2 : 0))}`} strokeDashoffset={-start} transform="rotate(-90 80 80)" />; }); })()}</svg><div className="donut-center"><span>{byCategory.filter(c => c.count > 0).length}</span><small>kategorii</small></div></div><div className="chart-legend">{byCategory.map(c => <div className="legend-row" key={c.key}><span className="legend-color" style={{ background: c.color }} /><span>{c.label}</span><strong>{total && c.value ? `${share(c.value, total).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%` : '—'}</strong></div>)}</div></div></article>
          <article className="panel insight-panel"><div className="insight-top"><span className="insight-icon"><Globe2 size={21} strokeWidth={1.5} /></span><span className={`connection-status ${rateStatus === 'live' ? 'connected' : ''}`}><span />{rateStatus === 'loading' ? 'Łączenie z NBP' : rateStatus === 'live' ? 'Połączono z NBP' : rates ? 'Zapisana tabela' : 'Tryb bez kursów'}</span></div><h2>Jeden majątek.<br />Wiele możliwości.</h2><p>Patrz globalnie. Zmieniaj walutę widoku,<br className="desktop-break" /> a wartości przeliczą się automatycznie.</p><div className="currency-coins"><span>zł</span><span>€</span><span>$</span><span>£</span><span className="more-currency">+9</span></div><button className="text-button" onClick={() => setView('rates')}>Zobacz kursy walut <ArrowUpRight size={16} /></button></article>
        </section>}

        {view === 'overview' && <section className="panel registry-panel">
          <div className="registry-top"><div><h2>Twój rejestr <span className="count-badge">{registry.entities.length}</span></h2><p>Ludzie i organizacje, których majątek obserwujesz.</p></div><div className="registry-actions"><button className="button secondary small" onClick={() => fileInput.current?.click()}><Upload size={15} />Importuj</button><button className="button secondary small" onClick={exportData}><ArrowDownToLine size={15} />Eksportuj</button></div></div>
          <div className="table-toolbar"><div className="tabs" role="group" aria-label="Typ podmiotu">{([['all', 'Wszystkie'], ['person', 'Osoby'], ['company', 'Firmy'], ['organization', 'Organizacje']] as const).map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}{key === 'all' && <span>{registry.entities.length}</span>}</button>)}</div><label className="search-box"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj podmiotu..." aria-label="Szukaj podmiotu" />{query && <button onClick={() => setQuery('')} aria-label="Wyczyść wyszukiwanie"><X size={14} /></button>}</label></div>
          <div className="table-scroll"><table><thead><tr><th>Nazwa podmiotu</th><th>Typ</th><th>Liczba aktywów</th><th className="value-column"><button className="sort-button" onClick={() => setSort(sort === 'value' ? 'name' : 'value')}>Wartość majątku <ArrowUpDown size={13} /><span className="sr-only">{sort === 'value' ? 'Sortuj po nazwie' : 'Sortuj malejąco po wartości'}</span></button></th><th><span className="sr-only">Szczegóły</span></th></tr></thead><tbody>{filtered.map((entity, index) => <tr key={entity.id}><td><button className="entity-name" onClick={() => setSelectedId(entity.id)}><span className={`entity-avatar tone-${index % 5}`}>{entity.photo ? <img src={entity.photo} alt={`Zdjęcie: ${entity.name}`} className="record-photo" /> : entity.type === 'person' ? initials(entity.name) : entity.type === 'company' ? <Building2 size={19} /> : <Landmark size={19} />}</span><span><strong>{entity.name}</strong><small>{entity.description || 'Bez dodatkowego opisu'}</small></span></button></td><td><span className={`type-badge ${entity.type}`}>{(() => { const Icon = TYPE_ICONS[entity.type]; return <Icon size={12} />; })()}{TYPES[entity.type]}</span></td><td className="asset-count">{entity.assets.length}<span> aktywów</span></td><td className="value-column"><strong className="table-value" title={formatMoney(entityValue(entity), currency)}>{formatMoney(entityValue(entity), currency, true)}</strong></td><td><div className="record-actions">{profileLink(entity)}<button className="row-open" aria-label={`Otwórz ${entity.name}`} onClick={() => setSelectedId(entity.id)}><ArrowUpRight size={18} /></button></div></td></tr>)}</tbody></table></div>
          {filtered.length === 0 && <div className="empty-state"><Users size={28} /><h3>{registry.entities.length === 0 ? 'Tutaj zaczyna się Twój rejestr' : 'Nie znaleziono podmiotów'}</h3><p>{registry.entities.length === 0 ? 'Dodaj pierwszą osobę, firmę lub organizację.' : 'Zmień wyszukiwanie lub wybierz inny typ podmiotu.'}</p><button className="button secondary" onClick={() => registry.entities.length === 0 ? setForm({ kind: 'entity' }) : (setQuery(''), setFilter('all'))}>{registry.entities.length === 0 ? 'Dodaj pierwszy podmiot' : 'Wyczyść filtry'}</button></div>}
          <div className="table-bottom"><span>Wyświetlono {filtered.length} z {registry.entities.length} podmiotów</span><span><LockKeyhole size={12} />Zapis lokalny w przeglądarce</span></div>
        </section>}

        {view === 'assets' && <section className="panel assets-panel"><div className="registry-top"><div><h2>Składniki majątku <span className="count-badge">{assets.length}</span></h2><p>Kwoty oryginalne oraz wartości w wybranej walucie.</p></div><label className="search-box"><Search size={16} /><input aria-label="Szukaj aktywa" placeholder="Nazwa lub właściciel..." value={query} onChange={e => setQuery(e.target.value)} /></label></div><div className="table-scroll"><table><thead><tr><th>Aktywo / właściciel</th><th>Kategoria</th><th className="value-column">Wartość oryginalna</th><th className="value-column">Wartość w {currency}</th><th /></tr></thead><tbody>{assets.filter(a => `${a.name} ${a.entity.name}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl'))).map(a => <tr key={a.id}><td><button className="entity-name" onClick={() => setSelectedId(a.entity.id)}><span className="asset-icon" style={{ background: CATEGORIES[a.category].color + '25', color: CATEGORIES[a.category].color }}><>{a.photo ? <img src={a.photo} alt={`Zdjęcie: ${a.name}`} className="record-photo" /> : <Coins size={18} />}</></span><span><strong>{a.name}</strong><small>{a.entity.name}</small></span></button></td><td><span className="category-label"><i style={{ background: CATEGORIES[a.category].color }} />{CATEGORIES[a.category].label}</span></td><td className="value-column"><span title={formatMoney(decimal(a.amount), a.currency)}>{formatMoney(decimal(a.amount), a.currency, true)}</span></td><td className="value-column"><strong title={formatMoney(valueOf(a), currency)}>{formatMoney(valueOf(a), currency, true)}</strong></td><td><button className="row-open" aria-label={`Edytuj ${a.name}`} onClick={() => setForm({ kind: 'asset', entityId: a.entity.id, asset: a })}><ArrowUpRight size={18} /></button></td></tr>)}</tbody></table></div>{assets.filter(a => `${a.name} ${a.entity.name}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl'))).length === 0 && <div className="empty-state"><Wallet size={28} /><h3>{assets.length ? 'Nie znaleziono aktywów' : 'Brak aktywów w rejestrze'}</h3><p>{assets.length ? 'Zmień szukaną nazwę lub właściciela.' : 'Otwórz podmiot w przeglądzie, aby dodać jego pierwsze aktywo.'}</p><button className="button secondary" onClick={() => assets.length ? setQuery('') : setView('overview')}>{assets.length ? 'Wyczyść wyszukiwanie' : 'Przejdź do podmiotów'}</button></div>}</section>}

        {view === 'reports' && <div className="reports-grid"><section className="panel"><div className="registry-top"><div><h2>Majątek według kategorii</h2><p>Wartości wyrażone w {currency}.</p></div><PieChart size={20} /></div><div className="category-report">{byCategory.map(c => <div className="report-category" key={c.key}><div><span className="category-label"><i style={{ background: c.color }} />{c.label}</span><strong title={formatMoney(c.value, currency)}>{formatMoney(c.value, currency, true)}</strong></div><div className="bar-track"><span style={{ background: c.color, width: `${total && c.value ? share(c.value, total) : 0}%` }} /></div><small>{c.count} aktywów · {total && c.value ? `${share(c.value, total).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%` : '—'}</small></div>)}</div></section><section className="panel export-panel"><div className="round-icon"><Download size={24} /></div><h2>Twoje dane.<br />Zawsze pod ręką.</h2><p>Pobierz raport do arkusza lub kompletną kopię rejestru. Kwoty w kopii JSON zachowują pełną precyzję.</p><button className="button primary" onClick={exportReport}><Download size={16} />Pobierz raport CSV</button><button className="button secondary" onClick={exportData}><FileJson size={16} />Eksportuj kopię JSON</button><button className="text-button" onClick={() => fileInput.current?.click()}><Upload size={15} />Przywróć kopię JSON</button><small>CSV służy do analizy; JSON do przenoszenia danych. Arkusze mogą zaokrąglać bardzo duże liczby.</small></section></div>}

        {view === 'rates' && <section className="panel rates-panel"><div className="registry-top"><div><h2>Kursy średnie NBP <span className="subtle-tag">Tabela A</span></h2><p>{rates ? `Ostatnia tabela: ${dateLabel(rates.date)} · nr ${rates.table}` : 'Pobierz tabelę, aby przeliczać majątek między walutami.'}</p></div><button className="button secondary" disabled={rateStatus === 'loading'} onClick={() => void refreshRates()}><RefreshCw size={16} className={rateStatus === 'loading' ? 'spin' : ''} />{rateStatus === 'loading' ? 'Pobieranie…' : 'Odśwież kursy'}</button></div>{rateStatus === 'error' && <div className="rates-notice" role="status">Nie udało się połączyć z NBP. Sprawdź połączenie i spróbuj ponownie. Kwoty w tej samej walucie nadal są dostępne. Nie używamy wymyślonych kursów.</div>}{rateStatus === 'cached' && <div className="rates-notice" role="status">Brak połączenia z NBP — używamy zapisanej tabeli z {rates && dateLabel(rates.date)}. Kursy mogą być nieaktualne.</div>}<div className="rate-grid">{CURRENCIES.filter(c => c !== 'PLN').map(c => <article className="rate-card" key={c}><div><span className="currency-symbol">{({ EUR: '€', USD: '$', GBP: '£', CHF: 'Fr', JPY: '¥', CNY: '¥', CAD: '$', AUD: '$', NOK: 'kr', SEK: 'kr', DKK: 'kr', CZK: 'Kč' } as Record<string, string>)[c]}</span><span><strong>{c}</strong><small>1 {c} w PLN</small></span></div><strong>{rates?.rates[c] ? `${rates.rates[c].replace('.', ',')} zł` : '—'}</strong></article>)}</div><div className="rate-disclaimer"><ShieldCheck size={18} /><p>Źródło: <a href="https://nbp.pl/statystyka-i-sprawozdawczosc/kursy/" target="_blank" rel="noreferrer">Narodowy Bank Polski <ExternalLink size={12} /></a>. Tabela A jest publikowana w dni robocze. Kursy średnie służą do orientacyjnej wyceny i nie są kursami transakcyjnymi. Odświeżamy je przy otwarciu aplikacji i co godzinę; po utracie połączenia korzystamy z ostatniej zapisanej tabeli.</p></div></section>}

        <footer className="page-footer"><span><ShieldCheck size={14} />Twoje dane pozostają Twoje.</span><div>{registry.isDemo && <button onClick={clearDemo}>Usuń dane przykładowe</button>}<button className="footer-rates" onClick={() => setView('rates')}><span className={`status-dot ${rateStatus === 'live' ? 'online' : ''}`} />{rateStatus === 'loading' ? 'Pobieranie kursów NBP…' : rates ? `NBP · ${dateLabel(rates.date)}${rateStatus === 'cached' ? ' · zapisane' : ''}` : 'Kursy NBP niedostępne'}<ArrowUpRight size={12} /></button></div></footer>
        </>}
      </main>
    </div>
    <input className="sr-only" type="file" accept=".json,application/json" ref={fileInput} aria-label="Importuj kopię JSON" onChange={e => { void importData(e.target.files?.[0]); e.target.value = ''; }} />

    {selected && <Modal title={selected.name} subtitle={`${TYPES[selected.type]}${selected.description ? ' · ' + selected.description : ''}`} close={() => setSelectedId(null)} wide>
      <div className="detail-summary">{selected.photo && <img className="detail-photo" src={selected.photo} alt={`Zdjęcie: ${selected.name}`} />}<span>Łączna wartość majątku</span><strong className="exact-amount">{formatMoney(entityValue(selected), currency, true)}</strong><small>{selected.assets.length} aktywów · waluta widoku {currency}</small></div>
      <div className="detail-toolbar">{profileLink(selected)}<h3>Aktywa podmiotu</h3><button className="button primary small" onClick={() => setForm({ kind: 'asset', entityId: selected.id })}><Plus size={16} />Dodaj aktywo</button></div>
      <div className="detail-assets">{selected.assets.map(a => <article key={a.id}><span className="asset-icon" style={{ background: CATEGORIES[a.category].color + '22', color: CATEGORIES[a.category].color }}><>{a.photo ? <img src={a.photo} alt={`Zdjęcie: ${a.name}`} className="record-photo" /> : <Coins size={18} />}</></span><div className="detail-asset-info"><strong>{a.name}</strong><small>{CATEGORIES[a.category].label}</small><span className="exact-amount">{formatMoney(decimal(a.amount), a.currency, true)}</span>{a.currency !== currency && <small className="exact-amount">≈ {formatMoney(valueOf(a), currency, true)}</small>}</div><button className="text-button" onClick={() => setForm({ kind: 'asset', entityId: selected.id, asset: a })}>Edytuj</button><button className="icon-button danger-text" aria-label={`Usuń ${a.name}`} onClick={() => deleteAsset(selected.id, a)}><Trash2 size={16} /></button></article>)}{!selected.assets.length && <div className="empty-state"><Wallet size={28} /><h3>Pierwsze aktywo czeka na dodanie</h3><p>Dodaj inwestycje, nieruchomości, udziały lub inne składniki majątku.</p></div>}</div>
      <div className="modal-actions detail-actions"><button className="text-button danger-text" onClick={() => deleteEntity(selected)}><Trash2 size={15} />Usuń podmiot</button><button className="button secondary" onClick={() => setForm({ kind: 'entity', entity: selected })}>Edytuj podmiot</button></div>
    </Modal>}
    {form?.kind === 'finances' && registry.entities.find(e => e.id === form.entityId) && <Modal title="Dane finansowe" close={() => setForm(null)}><FinancialForm entity={registry.entities.find(e => e.id === form.entityId)!} close={() => setForm(null)} save={data => saveFinances(form.entityId, data)} /></Modal>}
    {form?.kind === 'entity' && <EntityForm key={form.entity?.id || 'new-entity'} entity={form.entity} close={() => setForm(null)} save={saveEntity} />}
    {form?.kind === 'asset' && registry.entities.find(e => e.id === form.entityId) && <AssetForm key={form.asset?.id || 'new-asset'} entity={registry.entities.find(e => e.id === form.entityId)!} asset={form.asset} close={() => setForm(null)} save={a => saveAsset(form.entityId, a)} />}
    {confirmation && <Modal title={confirmation.title} close={() => setConfirmation(null)}><p className="confirmation-message">{confirmation.message}</p><div className="modal-actions"><button className="button secondary" onClick={() => setConfirmation(null)}>Anuluj</button><button className="button danger" onClick={() => { confirmation.run(); setConfirmation(null); }}>{confirmation.action}</button></div></Modal>}
    {help && <Modal title="Poznaj Aureo" subtitle="Twoje centrum wiedzy o majątku." close={() => setHelp(false)}><div className="help-content"><div><Users size={22} /><span><strong>Wszystko zaczyna się od podmiotu</strong><p>Dodaj osobę, firmę lub organizację, a następnie otwórz jej kartę i zapisz aktywa w odpowiednich kategoriach.</p></span></div><div><TrendingUp size={22} /><span><strong>Duże liczby, dokładne obliczenia</strong><p>Przechowujemy pełne kwoty jako tekst. Sumy i przeliczenia wykorzystują BigInt, a zaokrąglenie do dwóch miejsc następuje dopiero przy wyświetlaniu. Stosujemy polską skalę długą: milion (10⁶), miliard (10⁹), bilion (10¹²), biliard (10¹⁵), trylion (10¹⁸), aż do centyliona (10⁶⁰⁰). Pełne kwoty pozostają w edycji i kopii JSON. Obsługujemy do 1000 cyfr przed przecinkiem i 100 po nim.</p></span></div><div><Globe2 size={22} /><span><strong>Kursy z wiarygodnego źródła</strong><p>Zmiana waluty widoku przelicza wszystkie dostępne wartości przez PLN według tabeli A NBP. Oryginalne kwoty aktywów pozostają bez zmian. Brak kursu oznacza „—”.</p></span></div><div><LockKeyhole size={22} /><span><strong>Lokalnie, na Twoim urządzeniu</strong><p>Nie wysyłamy Twojego rejestru na serwer. Dostęp do niego ma każdy użytkownik tego profilu przeglądarki — zapis nie jest szyfrowany ani chroniony hasłem. Eksportuj regularnie kopię JSON. Wyczyszczenie danych przeglądarki usunie zapis.</p></span></div></div><div className="modal-actions"><button className="button primary" onClick={() => setHelp(false)}>Rozumiem</button></div></Modal>}
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button aria-label="Zamknij powiadomienie" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
