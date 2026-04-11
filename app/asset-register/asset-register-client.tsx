'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type AssetKind = 'tractor' | 'manual' | 'property';
type AssetMethod = 'aim4price' | 'market' | 'department' | 'manual';

type RegisterAsset = {
  id: number;
  userId: string;
  valuationRunId: number | null;
  kind: AssetKind;
  title: string;
  value: number;
  selectedMethod: AssetMethod;
  selectedValueExVat: number;
  brandName: string;
  modelName: string;
  drive: string;
  tractorType: string;
  cab: string;
  powerKw: number | null;
  yearModel: number | null;
  hours: number | null;
  aim4priceValueExVat: number | null;
  marketMidExVat: number | null;
  departmentValueExVat: number | null;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  financeNote: string;
  photos: string[];
  createdAtIso: string;
  updatedAtIso: string;
};

type AssetRegisterApiResponse = {
  ok: boolean;
  items?: RegisterAsset[];
  summary?: {
    count: number;
    totalValue: number;
  };
  item?: RegisterAsset;
  error?: string;
};

type AssetDraft = {
  kind: AssetKind;
  title: string;
  value: string;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  financeNote: string;
};

const initialAssetDraft: AssetDraft = {
  kind: 'manual',
  title: '',
  value: '',
  note: '',
  serialNumber: '',
  isFinanced: false,
  financeNote: '',
};

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function methodLabel(value: AssetMethod): string {
  return (
    {
      aim4price: 'Aim4price',
      market: 'Market',
      department: 'DALRRD',
      manual: 'Manual',
    }[value] ?? 'Manual'
  );
}

function kindLabel(value: AssetKind): string {
  return (
    {
      tractor: 'Equipment',
      manual: 'Manual asset',
      property: 'Property',
    }[value] ?? 'Manual asset'
  );
}

export default function AssetRegisterClient() {
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(initialAssetDraft);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAssets() {
      setIsLoading(true);

      try {
        const assetsResponse = await fetch('/api/asset-register', {
          cache: 'no-store',
          credentials: 'include',
        });

        const assetsData = (await assetsResponse.json()) as AssetRegisterApiResponse;

        if (!assetsResponse.ok || !assetsData.ok) {
          throw new Error(assetsData.error ?? 'Failed to load asset register.');
        }

        if (!mounted) {
          return;
        }

        setAssets(Array.isArray(assetsData.items) ? assetsData.items : []);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load your asset register.',
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAssets();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const totalValue = useMemo(() => {
    return assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0);
  }, [assets]);

  const equipmentCount = useMemo(() => {
    return assets.filter((asset) => asset.kind === 'tractor').length;
  }, [assets]);

  async function handleAssetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = Math.round(Number(assetDraft.value) || 0);
    if (!assetDraft.title.trim() || value <= 0) {
      setNotice({ tone: 'error', message: 'Asset title and value are required.' });
      return;
    }

    setIsSavingAsset(true);

    try {
      const response = await fetch('/api/asset-register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...assetDraft,
          value,
        }),
      });

      const data = (await response.json()) as AssetRegisterApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to add asset.');
      }

      setAssets((current) => [data.item as RegisterAsset, ...current]);
      setAssetDraft(initialAssetDraft);
      setNotice({ tone: 'success', message: 'Asset added to the register.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to add asset.',
      });
    } finally {
      setIsSavingAsset(false);
    }
  }

  async function handleDeleteAsset(assetId: number) {
    setBusyDeleteId(assetId);

    try {
      const response = await fetch(`/api/asset-register?id=${assetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = (await response.json()) as AssetRegisterApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete asset.');
      }

      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setNotice({ tone: 'success', message: 'Asset removed.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete asset.',
      });
    } finally {
      setBusyDeleteId(null);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Asset Register</span>
            <h1>Keep your saved machinery in one place.</h1>
            <p>
              This workspace now focuses on saved assets, valuation history and manual additions.
              Account, contact and future PDF settings have been separated into a dedicated account
              page.
            </p>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <span>Total register value</span>
              <strong>{money(totalValue)}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Total assets</span>
              <strong>{assets.length}</strong>
            </div>
            <div className={styles.statCard}>
              <span>Equipment assets</span>
              <strong>{equipmentCount}</strong>
            </div>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.kicker}>Account</span>
                <h2>Account, PDFs and contact settings</h2>
                <p>
                  This setup has been moved out of the register so saved assets can stay cleaner and
                  easier to scale. Use the account page for profile, contact and report details.
                </p>
              </div>
            </div>

            <div className={styles.assetList}>
              <article className={styles.assetCard}>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>Profile</span>
                  <span className={styles.badge}>Contact</span>
                </div>
                <h3>Dedicated account workspace</h3>
                <p className={styles.note}>
                  Business name, address, VAT number and phone details now belong in a separate
                  account route instead of being mixed into the register screen.
                </p>
              </article>

              <article className={styles.assetCard}>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>Reports</span>
                  <span className={styles.badge}>PDFs</span>
                </div>
                <h3>Correct base for exports</h3>
                <p className={styles.note}>
                  This separation prepares Aim4price for proper branded PDF reports, contact blocks
                  and future marketplace seller defaults.
                </p>
              </article>
            </div>

            <div className={styles.inlineLinks}>
              <Link href="/account" className={styles.primaryButton}>
                Open account page
              </Link>
              <Link href="/valuation" className={styles.secondaryButton}>
                Open valuation
              </Link>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.kicker}>Add manually</span>
                <h2>Add another asset</h2>
                <p>Use this for property or manual records that did not come from the valuation workflow.</p>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleAssetSubmit}>
              <label className={styles.field}>
                <span>Asset type</span>
                <select
                  value={assetDraft.kind}
                  onChange={(event) => setAssetDraft((current) => ({ ...current, kind: event.target.value as AssetKind }))}
                >
                  <option value="manual">Manual asset</option>
                  <option value="property">Property</option>
                  <option value="tractor">Equipment</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>Title</span>
                <input
                  value={assetDraft.title}
                  onChange={(event) => setAssetDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Main workshop or JD 6830 loader tractor"
                />
              </label>

              <label className={styles.field}>
                <span>Value</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={assetDraft.value}
                  onChange={(event) => setAssetDraft((current) => ({ ...current, value: event.target.value }))}
                  placeholder="0"
                />
              </label>

              <label className={styles.field}>
                <span>Serial / reference</span>
                <input
                  value={assetDraft.serialNumber}
                  onChange={(event) => setAssetDraft((current) => ({ ...current, serialNumber: event.target.value }))}
                  placeholder="Serial number or internal reference"
                />
              </label>

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Notes</span>
                <textarea
                  rows={4}
                  value={assetDraft.note}
                  onChange={(event) => setAssetDraft((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Extra details about the asset"
                />
              </label>

              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={assetDraft.isFinanced}
                  onChange={(event) =>
                    setAssetDraft((current) => ({ ...current, isFinanced: event.target.checked }))
                  }
                />
                <span>This asset is financed</span>
              </label>

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Finance note</span>
                <input
                  value={assetDraft.financeNote}
                  onChange={(event) => setAssetDraft((current) => ({ ...current, financeNote: event.target.value }))}
                  placeholder="Bank or finance reference"
                />
              </label>

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryButton} disabled={isSavingAsset}>
                  {isSavingAsset ? 'Saving...' : 'Add asset'}
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.kicker}>Saved assets</span>
              <h2>Your register</h2>
              <p>Valuations saved from the valuation page now appear here automatically.</p>
            </div>

            <div className={styles.inlineLinks}>
              <Link href="/valuation" className={styles.secondaryButton}>
                Open valuation
              </Link>
              <Link href="/marketplace" className={styles.secondaryButton}>
                Open marketplace
              </Link>
            </div>
          </div>

          {isLoading ? (
            <p className={styles.loading}>Loading assets...</p>
          ) : assets.length ? (
            <div className={styles.assetList}>
              {assets.map((asset) => (
                <article className={styles.assetCard} key={asset.id}>
                  <div className={styles.assetTop}>
                    <div>
                      <div className={styles.badgeRow}>
                        <span className={styles.badge}>{kindLabel(asset.kind)}</span>
                        <span className={styles.badge}>{methodLabel(asset.selectedMethod)}</span>
                        {asset.valuationRunId ? <span className={styles.badge}>Saved valuation</span> : null}
                      </div>
                      <h3>{asset.title}</h3>
                      <p>
                        {[
                          asset.brandName,
                          asset.modelName,
                          asset.yearModel ? String(asset.yearModel) : '',
                          asset.hours ? `${asset.hours.toLocaleString('en-ZA')} hours` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Manual asset'}
                      </p>
                    </div>

                    <div className={styles.priceBlock}>
                      <strong>{money(asset.value)}</strong>
                      <span>Updated {formatDate(asset.updatedAtIso)}</span>
                    </div>
                  </div>

                  <div className={styles.detailGrid}>
                    <div>
                      <span>Serial</span>
                      <strong>{asset.serialNumber || '—'}</strong>
                    </div>
                    <div>
                      <span>Finance</span>
                      <strong>{asset.isFinanced ? 'Financed' : 'Not financed'}</strong>
                    </div>
                    <div>
                      <span>Hours</span>
                      <strong>{asset.hours ? asset.hours.toLocaleString('en-ZA') : '—'}</strong>
                    </div>
                    <div>
                      <span>Saved</span>
                      <strong>{formatDate(asset.createdAtIso)}</strong>
                    </div>
                  </div>

                  {asset.note ? <p className={styles.note}>{asset.note}</p> : null}
                  {asset.financeNote ? <p className={styles.note}>Finance: {asset.financeNote}</p> : null}

                  <div className={styles.assetActions}>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={busyDeleteId === asset.id}
                      onClick={() => handleDeleteAsset(asset.id)}
                    >
                      {busyDeleteId === asset.id ? 'Removing...' : 'Delete'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>No assets saved yet</h3>
              <p>Start with a valuation or add a manual asset to begin your register.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
