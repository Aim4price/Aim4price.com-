'use client';

import { useEffect, useState, type FormEvent } from 'react';
import styles from '../../../owner-app.module.css';

type Register = { id: string; businessName: string };
type ApiResponse = {
  ok: boolean;
  registers?: Register[];
  redirectTo?: string;
  error?: string;
};

export default function OwnerManualAssetClient() {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadRegisters() {
      try {
        const response = await fetch('/api/owner-app/assets', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as ApiResponse | null;
        if (response.status === 401) {
          window.location.replace('/owner-app/login');
          return;
        }
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to load your asset registers.');
        setRegisters(payload.registers ?? []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Failed to load your asset registers.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRegisters();
    return () => controller.abort();
  }, []);

  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await fetch('/api/owner-app/assets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as ApiResponse | null;
      if (!response.ok || !payload?.ok || !payload.redirectTo) {
        throw new Error(payload?.error || 'Failed to create the asset.');
      }
      window.location.assign(payload.redirectTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create the asset.');
      setCreating(false);
    }
  }

  if (loading) return <div className={`${styles.content} ${styles.loading}`}>Loading asset registers…</div>;

  return (
    <div className={styles.content}>
      <section className={styles.flowIntro}>
        <h1>Add manual asset</h1>
        <p>Enter asset details.</p>
      </section>

      <form className={`${styles.section} ${styles.focusedForm}`} onSubmit={createAsset}>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span>Asset name</span>
            <input name="title" required />
          </label>
          <label className={styles.field}>
            <span>Register</span>
            <select name="registerId" required>
              {registers.map((register) => <option key={register.id} value={register.id}>{register.businessName}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Asset type</span>
            <select name="kind" defaultValue="equipment">
              <option value="equipment">Equipment</option>
              <option value="vehicle">Vehicle</option>
              <option value="property">Property / Land / Building</option>
              <option value="tools">Tools</option>
              <option value="stock">Stock</option>
              <option value="manual">Furniture, appliances &amp; electronics</option>
            </select>
          </label>
          <label className={styles.field}><span>Make</span><input name="brandName" /></label>
          <label className={styles.field}><span>Model</span><input name="modelName" /></label>
          <label className={styles.field}><span>Year model / year built</span><input name="yearModel" inputMode="numeric" /></label>
          <label className={styles.field}><span>Serial / VIN / chassis</span><input name="serialNumber" /></label>
          <label className={styles.field}><span>Current value excl. VAT</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><input name="value" inputMode="decimal" required /></span></label>
          <label className={styles.field}><span>Replacement price excl. VAT</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><input name="replacementPriceExVat" inputMode="decimal" required /></span></label>
          <label className={styles.field}>
            <span>Usage type</span>
            <select name="usageMetric">
              <option value="hours">Hours</option>
              <option value="km">Kilometres</option>
            </select>
          </label>
          <label className={styles.field}><span>Current usage</span><input name="hours" inputMode="decimal" /></label>
          <label className={styles.field}>
            <span>Condition</span>
            <select name="condition" defaultValue="">
              <option value="">Not saved</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="used">Used</option>
              <option value="serious">Serious</option>
            </select>
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea name="note" /></label>
        </div>

        {error ? <div className={styles.errorNotice}>{error}</div> : null}
        {!registers.length ? <div className={styles.errorNotice}>Create an asset register on the desktop site before adding an asset.</div> : null}

        <button type="submit" className={styles.primaryButton} disabled={creating || !registers.length}>
          {creating ? 'Adding asset…' : 'Add asset'}
        </button>
      </form>
    </div>
  );
}
