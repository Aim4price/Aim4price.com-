'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from '../owner-app.module.css';

type Register = { id: string; businessName: string };
type Asset = {
  id: string; registerName: string; title: string; kind: string; brandName: string; modelName: string;
  yearModel: number | null; serialNumber: string; registrationNumber: string; location: string; value: number;
  replacementPriceExVat: number | null; isInsured: boolean; insuredValueExVat: number | null; isLicensed: boolean;
  marketplaceStatus: string; usage: number | null; usageMetric: 'hours' | 'km' | 'percentage'; thumbnailUrl: string;
};
type ApiResponse = { ok: boolean; items?: Asset[]; registers?: Register[]; redirectTo?: string; error?: string };

export default function OwnerAssetsClient({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<Asset[]>([]);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;
    const timeout = window.setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const response = await fetch(`/api/owner-app/assets?q=${encodeURIComponent(query)}`, { credentials: 'include', cache: 'no-store', signal: controller.signal });
        const payload = await response.json().catch(() => null) as ApiResponse | null;
        if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to load your assets.');
        if (id === requestId.current) { setItems(payload.items ?? []); setRegisters(payload.registers ?? []); }
      } catch (cause) {
        if (!controller.signal.aborted && id === requestId.current) setError(cause instanceof Error ? cause.message : 'Failed to load your assets.');
      } finally { if (!controller.signal.aborted && id === requestId.current) setLoading(false); }
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query]);

  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true); setCreateError('');
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const response = await fetch('/api/owner-app/assets', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null) as ApiResponse | null;
      if (!response.ok || !payload?.ok || !payload.redirectTo) throw new Error(payload?.error || 'Failed to create the asset.');
      window.location.assign(payload.redirectTo);
    } catch (cause) { setCreateError(cause instanceof Error ? cause.message : 'Failed to create the asset.'); setCreating(false); }
  }

  return (
    <div className={styles.wideContent}>
      <section className={styles.toolbar}>
        <input className={styles.searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search asset name or serial number" aria-label="Search all assets" />
        <div className={styles.toolbarRow}><button type="button" className={styles.primaryButton} onClick={() => setShowCreate((current) => !current)}>{showCreate ? 'Close new asset' : '+ Add asset'}</button>{query ? <button type="button" className={styles.secondaryButton} onClick={() => setQuery('')}>Clear search</button> : null}</div>
      </section>

      {showCreate ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}><div><h2>Add asset</h2><p>Save the basics, then open the asset for full editing.</p></div></div>
          <form className={styles.formGrid} onSubmit={createAsset}>
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Asset name</span><input name="title" required /></label>
            <label className={styles.field}><span>Register</span><select name="registerId" required>{registers.map((register) => <option key={register.id} value={register.id}>{register.businessName}</option>)}</select></label>
            <label className={styles.field}><span>Asset type</span><select name="kind" defaultValue="equipment"><option value="tractor">Tractor</option><option value="equipment">Equipment</option><option value="vehicle">Vehicle</option><option value="property">Property</option><option value="tools">Tools</option><option value="stock">Stock</option><option value="manual">Other</option></select></label>
            <label className={styles.field}><span>Make</span><input name="brandName" /></label>
            <label className={styles.field}><span>Model</span><input name="modelName" /></label>
            <label className={styles.field}><span>Year model</span><input name="yearModel" inputMode="numeric" /></label>
            <label className={styles.field}><span>Serial / VIN / chassis</span><input name="serialNumber" /></label>
            <label className={styles.field}><span>Current Aim4price value excl. VAT</span><input name="value" inputMode="decimal" required /></label>
            <label className={styles.field}><span>Replacement price excl. VAT</span><input name="replacementPriceExVat" inputMode="decimal" required /></label>
            <label className={styles.field}><span>Usage type</span><select name="usageMetric"><option value="hours">Hours</option><option value="km">Kilometres</option></select></label>
            <label className={styles.field}><span>Current usage</span><input name="hours" inputMode="decimal" /></label>
            <label className={styles.field}><span>Condition</span><select name="condition"><option value="">Not saved</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="used">Used</option><option value="serious">Serious</option></select></label>
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea name="note" /></label>
            {createError ? <div className={`${styles.errorNotice} ${styles.fieldFull}`}>{createError}</div> : null}
            <button type="submit" className={`${styles.primaryButton} ${styles.fieldFull}`} disabled={creating}>{creating ? 'Creating asset…' : 'Create asset'}</button>
          </form>
        </section>
      ) : null}

      {error ? <div className={styles.errorNotice}>{error}<button type="button" className={styles.smallButton} onClick={() => setQuery((current) => `${current} `)}>Try again</button></div> : null}
      {loading ? <div className={styles.loading}>Loading your assets…</div> : null}
      {!loading && !error && !items.length ? <div className={styles.empty}>{query ? 'No assets match your search.' : 'No assets have been added yet.'}</div> : null}
      {!loading && !error ? (
        <div className={styles.assetList}>
          {items.map((asset) => (
            <article key={asset.id} className={`${styles.assetCard} ${styles.assetPickerCard}`}>
              <div className={styles.assetPickerBody}>
                <h2>{asset.title}</h2>
                <p className={styles.assetSerial}>Serial: {asset.serialNumber || 'Not saved'}</p>
              </div>
              <Link className={styles.assetOpenButton} href={`/owner-app/assets/${encodeURIComponent(asset.id)}`} aria-label={`Open ${asset.title}`}>
                Open
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
