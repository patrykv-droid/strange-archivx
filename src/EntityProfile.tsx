import { useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowLeft, Plus, Settings2 } from 'lucide-react';
import { CATEGORIES, CURRENCIES, TYPES, type Currency, type Entity, type Financials } from './lib/data';
import { compare, convert, decimal, formatMoney, normalizeAmount, share, subtract, sum, ZERO } from './lib/money';

export function FinancialForm({ entity, save, close }: { entity: Entity; save: (data: Financials) => void; close: () => void }) {
  const [data, setData] = useState<Financials>(entity.financials || { currency: 'USD', liabilities: '0', annualIncome: '0', annualExpenses: '0', notes: '' });
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    try { save({ ...data, liabilities: normalizeAmount(data.liabilities), annualIncome: normalizeAmount(data.annualIncome), annualExpenses: normalizeAmount(data.annualExpenses), notes: data.notes.trim() }); }
    catch (err) { setError((err as Error).message); }
  }
  return <form className="editor-form" onSubmit={submit}>
    <label>Waluta danych finansowych<select value={data.currency} onChange={e => setData({ ...data, currency: e.target.value as Currency })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
    {([['liabilities', 'Zobowiązania łącznie'], ['annualIncome', 'Roczne przychody / dochody'], ['annualExpenses', 'Roczne koszty / wydatki']] as const).map(([key, label]) => <label key={key}>{label}<input required inputMode="decimal" maxLength={1500} value={data[key]} onChange={e => setData({ ...data, [key]: e.target.value })} /></label>)}
    <label>Notatki finansowe<textarea rows={5} maxLength={5000} value={data.notes} onChange={e => setData({ ...data, notes: e.target.value })} placeholder="Źródła wyceny, zobowiązania, plany inwestycyjne…" /></label>
    {error && <p role="alert" className="field-error">{error}</p>}
    <p className="form-note">Wpisz pełne kwoty. Roczne przychody i wydatki powinny dotyczyć tego samego okresu. Nie zmieniają wartości aktywów; zobowiązania pomniejszają majątek netto w profilu.</p>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Anuluj</button><button className="button primary" type="submit">Zapisz finanse</button></div>
  </form>;
}

export default function EntityProfile({ entity, currency, rates, rateDate, setCurrency, back, edit, addAsset, editAsset, finances, exportEntity }: {
  entity: Entity; currency: Currency; rates: Record<string, string>; rateDate?: string;
  setCurrency: (c: Currency) => void; back: () => void; edit: () => void; addAsset: () => void; editAsset: (id: string) => void; finances: () => void; exportEntity: () => void;
}) {
  const valueOf = (asset: Entity['assets'][number]) => convert(asset.amount, asset.currency, currency, rates);
  const gross = sum(entity.assets.map(valueOf));
  const financial = entity.financials;
  const financialValue = (amount: string) => decimal(amount).n === 0n ? ZERO : convert(amount, financial!.currency, currency, rates);
  const liabilities = financial ? financialValue(financial.liabilities) : null;
  const income = financial ? financialValue(financial.annualIncome) : null;
  const expenses = financial ? financialValue(financial.annualExpenses) : null;
  const net = gross && liabilities ? subtract(gross, liabilities) : null;
  const balance = income && expenses ? subtract(income, expenses) : null;
  const sorted = [...entity.assets].sort((a, b) => { const av = valueOf(a), bv = valueOf(b); return av && bv ? compare(bv, av) : av ? -1 : bv ? 1 : 0; });
  const categories = Object.entries(CATEGORIES).map(([key, c]) => ({ ...c, value: sum(entity.assets.filter(a => a.category === key).map(valueOf)), count: entity.assets.filter(a => a.category === key).length }));
  const originals = CURRENCIES.map(c => ({ currency: c, count: entity.assets.filter(a => a.currency === c).length, amount: sum(entity.assets.filter(a => a.currency === c).map(a => decimal(a.amount))) })).filter(c => c.count);
  return <div className="entity-profile">
    <button className="text-button" onClick={back}><ArrowLeft size={16} /> Wróć do rejestru</button>
    <div className="profile-hero">{entity.photo && <img src={entity.photo} alt={`Zdjęcie: ${entity.name}`} />}<div><span className="subtle-tag">{TYPES[entity.type]} · PROFIL FINANSOWY</span><h1>{entity.name}</h1><p>{entity.description || 'Dodaj opis podmiotu, aby uzupełnić jego profil.'}</p></div></div>
    <div className="context-bar"><span className="context-left">{entity.assets.length} aktywów · aktualizacja {new Date(entity.updatedAt).toLocaleDateString('pl-PL')}</span><label className="display-currency">Waluta profilu<select aria-label="Waluta profilu" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
    <div className="profile-actions"><button className="button primary" onClick={addAsset}><Plus size={16} />Dodaj aktywo</button><button className="button secondary" onClick={finances}><Settings2 size={16} />Edytuj finanse</button><button className="button secondary" onClick={edit}>Edytuj podmiot</button><button className="button secondary" onClick={exportEntity}><ArrowDownToLine size={16} />Eksportuj profil JSON</button></div>
    {!financial && <div className="notice">Uzupełnij zobowiązania, roczne przychody i wydatki. Majątek netto obliczymy po podaniu zobowiązań — brak danych nie oznacza zera.<button onClick={finances}>Uzupełnij finanse</button></div>}
    <section className="profile-metrics" aria-label="Finanse podmiotu">{[
      ['Majątek netto', net, 'Aktywa minus zobowiązania'], ['Aktywa brutto', gross, `${entity.assets.length} składników majątku`], ['Zobowiązania', liabilities, financial ? 'Zadeklarowane łączne zadłużenie' : 'Nie podano danych'],
      ['Roczne przychody / dochody', income, financial ? 'Wartość zadeklarowana' : 'Nie podano danych'], ['Roczne koszty / wydatki', expenses, financial ? 'Wartość zadeklarowana' : 'Nie podano danych'], ['Roczna nadwyżka / deficyt', balance, 'Przychody minus wydatki'],
    ].map(([label, value, note], i) => <article className={`profile-metric ${i === 0 ? 'profile-net' : ''}`} key={label as string}><span>{label as string}</span><strong title={formatMoney(value as typeof net, currency)}>{formatMoney(value as typeof net, currency, true)}</strong><small>{note as string}</small></article>)}</section>
    <p className="profile-finances-note">Wycena w {currency}{rateDate ? ` · tabela NBP z ${rateDate.split('-').reverse().join('.')}` : ' · brak pobranej tabeli NBP'}. Znak „—” oznacza brak danych lub kursu. Są to wyceny i zadeklarowane dane, a nie historia rachunku.</p>
    <div className="profile-sections"><section className="panel profile-panel"><h2>Struktura majątku</h2>{categories.map(c => <div className="report-category" key={c.label}><div><span className="category-label"><i style={{ background: c.color }} />{c.label}</span><strong title={formatMoney(c.value, currency)}>{formatMoney(c.value, currency, true)}</strong></div><div className="bar-track"><span style={{ width: `${gross && c.value ? share(c.value, gross) : 0}%`, background: c.color }} /></div><small>{c.count} aktywów · {gross && c.value ? `${share(c.value, gross).toLocaleString('pl-PL')}%` : '—'}</small></div>)}</section>
    <section className="panel profile-panel"><h2>Ekspozycja walutowa</h2>{originals.length ? originals.map(c => <div className="profile-line" key={c.currency}><span>{c.currency} · {c.count} aktywów</span><strong title={formatMoney(c.amount, c.currency)}>{formatMoney(c.amount, c.currency, true)}</strong></div>) : <p className="profile-unset">Brak aktywów. Dodaj pierwszy składnik majątku.</p>}<h2 style={{ marginTop: 25 }}>Notatki finansowe</h2><p className="profile-notes">{financial?.notes || 'Nie dodano notatek. Uzupełnisz je przez „Edytuj finanse”.'}</p></section></div>
    <section className="panel profile-assets"><div className="registry-top"><div><h2>Aktywa — od największego</h2><p>Pełną wartość zobaczysz po najechaniu na kwotę lub w edycji aktywa.</p></div></div><div className="table-scroll"><table><thead><tr><th>Aktywo</th><th>Kategoria</th><th className="value-column">Wartość oryginalna</th><th className="value-column">Wartość w {currency}</th><th /></tr></thead><tbody>{sorted.map(a => <tr key={a.id}><td><div className="entity-name">{a.photo && <img className="asset-photo" src={a.photo} alt={`Zdjęcie: ${a.name}`} />}<strong>{a.name}</strong></div></td><td>{CATEGORIES[a.category].label}</td><td className="value-column"><span title={formatMoney(decimal(a.amount), a.currency)}>{formatMoney(decimal(a.amount), a.currency, true)}</span></td><td className="value-column"><strong title={formatMoney(valueOf(a), currency)}>{formatMoney(valueOf(a), currency, true)}</strong></td><td><button className="text-button" onClick={() => editAsset(a.id)}>Edytuj</button></td></tr>)}</tbody></table></div>{!sorted.length && <div className="empty-state"><p>Nie dodano jeszcze aktywów.</p><button className="button secondary" onClick={addAsset}>Dodaj pierwsze aktywo</button></div>}</section>
  </div>;
}
