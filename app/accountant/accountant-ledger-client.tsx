'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import type { AccountantRegisterAccess } from '../../lib/accountant-workspace';
import type { FuelLedgerData } from '../../lib/fuel-ledger';
import type { MyInvoiceListResult } from '../../lib/my-invoices';
import styles from './accountant-ledger.module.css';

type Props = { kind: 'fuel' | 'cost'; initialRegisters: AccountantRegisterAccess[] };

function money(value: unknown): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function date(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

export default function AccountantLedgerClient({ kind, initialRegisters }: Props) {
  const allowedRegisters = initialRegisters.filter((item) => kind === 'fuel' ? item.includeFuelLedger : item.includeCostLedger);
  const [shareId, setShareId] = useState(allowedRegisters[0]?.shareId || '');
  const [data, setData] = useState<{ fuel?: FuelLedgerData; cost?: MyInvoiceListResult } | null>(null);
  const [assetId, setAssetId] = useState('all');
  const [year, setYear] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selectedRegister = allowedRegisters.find((item) => item.shareId === shareId);

  useEffect(() => {
    if (!shareId) { setData(null); return; }
    let mounted = true;
    setLoading(true); setError(''); setAssetId('all');
    fetch(`/api/accountant/registers/${encodeURIComponent(shareId)}/ledger?kind=${kind}`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; fuel?: FuelLedgerData; cost?: MyInvoiceListResult; error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Ledger could not be loaded.');
        if (mounted) setData(payload);
      })
      .catch((cause) => mounted && setError(cause instanceof Error ? cause.message : 'Ledger could not be loaded.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [kind, shareId]);

  const assets = kind === 'fuel' ? data?.fuel?.assets || [] : data?.cost?.assets || [];
  const years = useMemo(() => {
    const values = new Set<string>();
    if (kind === 'fuel') (data?.fuel?.recentEvents || []).forEach((event) => values.add(String(new Date(event.createdAtIso).getFullYear())));
    else (data?.cost?.invoices || []).forEach((invoice) => invoice.invoiceDate && values.add(invoice.invoiceDate.slice(0, 4)));
    return [...values].filter((value) => /^\d{4}$/.test(value)).sort().reverse();
  }, [data, kind]);
  const fuelRows = useMemo(() => (data?.fuel?.recentEvents || []).filter((event) => {
    const matchesAsset = assetId === 'all' || event.assetId === assetId;
    const matchesYear = year === 'all' || String(new Date(event.createdAtIso).getFullYear()) === year;
    return matchesAsset && matchesYear && (!query || `${event.assetTitle} ${event.storageName} ${event.operatorName} ${event.note}`.toLowerCase().includes(query.toLowerCase()));
  }), [assetId, data, query, year]);
  const costRows = useMemo(() => (data?.cost?.invoices || []).filter((invoice) => {
    const matchesAsset = assetId === 'all' || invoice.assetId === assetId;
    const matchesYear = year === 'all' || invoice.invoiceDate?.slice(0, 4) === year;
    return matchesAsset && matchesYear && (!query || `${invoice.assetTitle} ${invoice.supplierName} ${invoice.invoiceNumber}`.toLowerCase().includes(query.toLowerCase()));
  }), [assetId, data, query, year]);
  const total = kind === 'fuel' ? fuelRows.reduce((sum, row) => sum + (row.totalAmount || 0), 0) : costRows.reduce((sum, row) => sum + row.totalIncVat, 0);

  return <main className={styles.page}>
    <AppHeader active={kind === 'fuel' ? 'fuel' : 'cost'} />
    <section className={styles.shell}>
      <header className={styles.hero}><div><h1>{kind === 'fuel' ? 'FUEL LEDGER' : 'COST LEDGER'}</h1><p>Read-only accountant view of owner-authorised records.</p></div>{selectedRegister ? <Link href={`/accountant/registers/${selectedRegister.shareId}`}>Open Asset Register</Link> : null}</header>
      <section className={styles.summary}>
        <article><span>Shared register</span><strong>{selectedRegister?.registerName || 'None selected'}</strong><small>{selectedRegister?.ownerBusinessName || 'No authorised records'}</small></article>
        <article><span>{kind === 'fuel' ? 'Filtered fuel records' : 'Filtered cost records'}</span><strong>{kind === 'fuel' ? fuelRows.length : costRows.length}</strong><small>Read-only operational records</small></article>
        <article><span>{kind === 'fuel' ? 'Recorded fuel spend' : 'Recorded total spend'}</span><strong>{money(total)}</strong><small>{kind === 'fuel' ? `${fuelRows.reduce((sum, row) => sum + row.litres, 0).toLocaleString('en-ZA')} litres` : 'Including recorded VAT'}</small></article>
      </section>
      <div className={styles.toolbar}>
        <select value={shareId} onChange={(event) => setShareId(event.target.value)}><option value="">Choose Asset Register</option>{allowedRegisters.map((item) => <option value={item.shareId} key={item.shareId}>{item.ownerBusinessName} — {item.registerName}</option>)}</select>
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="all">All assets</option>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.title}</option>)}</select>
        <select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All periods</option>{years.map((value) => <option value={value} key={value}>{value}</option>)}</select>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" />
        {shareId ? <a className={styles.download} href={`/api/accountant/registers/${encodeURIComponent(shareId)}/reports?kind=${kind === 'fuel' ? 'fuel' : 'cost-of-ownership'}${assetId !== 'all' ? `&assetId=${encodeURIComponent(assetId)}` : ''}`}>Download CSV</a> : null}
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? <div className={styles.empty}>Loading authorised records...</div> : kind === 'fuel' ? <div className={styles.records}>{fuelRows.map((row) => <article key={row.id}><div><strong>{row.assetTitle || row.storageName}</strong><span>{row.eventType.replace(/_/g, ' ')} · {date(row.createdAtIso)}</span></div><div><strong>{row.litres.toLocaleString('en-ZA')} L</strong><span>{row.totalAmount ? money(row.totalAmount) : 'Amount not recorded'}</span></div><div><span>{row.operatorName || 'Operator not recorded'}</span><small>{row.note || row.locationText || 'No note'}</small></div>{row.documentFileUrl ? <a href={row.documentFileUrl} target="_blank" rel="noreferrer">Open record</a> : null}</article>)}</div> : <div className={styles.records}>{costRows.map((row) => <article key={row.id}><div><strong>{row.assetTitle}</strong><span>{row.supplierName || 'Supplier not recorded'} · {date(row.invoiceDate)}</span></div><div><strong>{money(row.totalIncVat)}</strong><span>VAT {money(row.vatAmount)}</span></div><div><span>{row.invoiceNumber || 'Invoice number not recorded'}</span><small>{row.notes || 'No note'}</small></div>{row.document?.uploadUrl ? <a href={row.document.uploadUrl} target="_blank" rel="noreferrer">Open document</a> : null}</article>)}</div>}
      {!loading && !(kind === 'fuel' ? fuelRows.length : costRows.length) ? <div className={styles.empty}>No records match the selected Asset Register, asset and period.</div> : null}
    </section>
  </main>;
}
