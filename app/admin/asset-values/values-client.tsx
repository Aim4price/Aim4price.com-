'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import ListPagination from "../../../components/ListPagination";
import AssetValueDialog from '../../../components/asset-register/AssetValueDialog';
import { createPortal } from '../../../components/WebsitePortal';
import styles from './values.module.css';

type Row = { id: string; user_id: string; title: string; email: string; value: number; pending: number };
const money = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });
export default function Client() {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState({query:'', page:1, pending:false, total:0});
  const requested = useRef({query:'', page:1, pending:false});
  const appliedSearch = result.query;
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const load = useCallback(async (query = requested.current.query, page = requested.current.page, pending = requested.current.pending) => {
    requested.current = {query,page,pending};
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/asset-values?' + new URLSearchParams({search:query.trim(),page:String(page),pending:pending?'1':'0'}), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load asset values.');
      if (current === generation.current) { setItems(data.items ?? []); setResult({query:query.trim(), page:data.page, total:data.total, pending}); requested.current.page = data.page; }
    } catch (reason) {
      if (current === generation.current) setError(reason instanceof Error ? reason.message : 'Unable to load asset values.');
    } finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { generation.current++; }; }, []); // Search is applied on submit.
  return <section className={styles.panel} aria-label="Asset value reviews">
    <div className={styles.heading}><div><h2>Value reviews</h2><p>Review suggestions and value history. Every override requires a reason and records the administrator.</p></div><span>{loading ? 'Loading…' : error && !items.length ? 'Unavailable' : `${result.total} assets`}</span></div>
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); void load(search,1); }}>
      <label>Search assets<input type="search" data-search-input value={search} onChange={event => setSearch(event.target.value)} placeholder="Asset name or owner email" /></label>
      <button type="submit" disabled={loading}>Search</button>
      <button type="button" aria-pressed={result.pending} disabled={loading} onClick={() => void load(search,1,!result.pending)}>Pending reviews</button>
      {(search || appliedSearch) && <button type="button" disabled={loading} onClick={() => { setSearch(''); void load('',1); }}>Clear search</button>}
    </form>
    <p className={styles.resultsContext} role="status">{appliedSearch ? `Results for “${appliedSearch}”` : result.pending ? 'Assets with pending reviews' : 'All assets'}{error && items.length > 0 ? ' · Showing the last successful results.' : ''}</p>
    {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => void load()} disabled={loading}>Try again</button></div>}
    <div className={styles.tableWrap} aria-busy={loading}>
      <table><thead><tr><th>Asset</th><th>Owner</th><th>Value excl. VAT</th><th>Pending</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.email}</td><td className={styles.amount}>{money.format(Number(item.value))}</td><td>{item.pending ? <span className={styles.pending}>{item.pending} to review</span> : <span className={styles.muted}>Up to date</span>}</td><td><button type="button" disabled={loading || Boolean(error)} onClick={() => setSelected(item)}>Review values</button></td></tr>)}</tbody>
      </table>
      {loading && <p className={styles.empty} role="status">Loading asset values…</p>}
      {!loading && !error && !items.length && <div className={styles.empty}><strong>No assets found</strong><p>Try another asset name or owner email.</p></div>}
    </div>
    {result.total > 0 && <ListPagination label="Asset value pages" page={result.page} pageCount={Math.ceil(result.total/50)}
      summary={`${(result.page-1)*50+1}–${(result.page-1)*50+items.length} of ${result.total} assets`}
      disabled={loading || Boolean(error)} onPageChange={page => void load(result.query,page,result.pending)}/>}
    {selected && createPortal(<AssetValueDialog endpoint={`/api/admin/asset-values/${selected.id}?ownerId=${encodeURIComponent(selected.user_id)}`} assetTitle={selected.title} onClose={() => setSelected(null)} onSaved={() => { void load(); }} />, document.body)}
  </section>;
}
