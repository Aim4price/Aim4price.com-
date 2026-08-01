'use client';

import { useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import AppHeader from '../../../components/AppHeader';
import ownerStyles from '../../asset-registers/page.module.css';
import styles from './page.module.css';

type RegisterAccess = {
  shareId: string;
  ownerUserId: string;
  ownerName: string;
  ownerBusinessName: string;
  registerId: string;
  registerName: string;
  assetCount: number;
  totalValue: number;
  dateSharedIso: string;
  lastUpdatedIso: string;
  allowDirectUpdates: boolean;
  includeFuelLedger: boolean;
  includeCostLedger: boolean;
};

type AccountantAsset = {
  id: string;
  registerId: string | null;
  title: string;
  value: number;
  yearModel: number | null;
  hours: number | null;
  condition: string;
  updatedAtIso: string;
};

type Notice = { type: 'success' | 'error'; message: string } | null;

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

function SearchIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></IconBase>;
}

function RegistersIcon(props: IconProps) {
  return <IconBase {...props}><rect x="3" y="4" width="14" height="14" rx="2" /><path d="M7 8h6M7 12h6M7 16h4M17 8h4v12a2 2 0 0 1-2 2H7" /></IconBase>;
}

function OpenIcon(props: IconProps) {
  return <IconBase {...props}><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></IconBase>;
}

function ManageIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.38.36.72.6 1 .3.3.7.45 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6Z" /></IconBase>;
}

function formatMoney(value: number): string {
  return `R ${Math.round(Number(value) || 0).toLocaleString('en-ZA')}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function assetDetails(asset: AccountantAsset): string {
  const details: string[] = [];
  if (asset.yearModel) details.push(`Year model: ${asset.yearModel}`);
  if (asset.hours !== null) details.push(`Usage: ${Math.round(asset.hours).toLocaleString('en-ZA')} hours`);
  if (asset.condition) details.push(`Condition: ${asset.condition}`);
  return details.join(' · ') || 'Asset details available in the register';
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    const message = String(data.error ?? '').trim();
    return message || fallback;
  } catch {
    return fallback;
  }
}

export default function AccountantRegistersClient() {
  const [registers, setRegisters] = useState<RegisterAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [managedRegister, setManagedRegister] = useState<RegisterAccess | null>(null);
  const [managedAssets, setManagedAssets] = useState<AccountantAsset[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [targetByAsset, setTargetByAsset] = useState<Record<string, string>>({});
  const [manageLoading, setManageLoading] = useState(false);
  const [movingAssetId, setMovingAssetId] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRegisters() {
      setLoading(true);
      try {
        const response = await fetch('/api/accountant/registers', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw new Error(await responseMessage(response, 'Shared Asset Registers could not be loaded.'));
        const data = (await response.json()) as { registers?: RegisterAccess[] };
        if (!cancelled) setRegisters(Array.isArray(data.registers) ? data.registers : []);
      } catch (error) {
        if (!cancelled) setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Shared Asset Registers could not be loaded.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRegisters();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!managedRegister) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [managedRegister]);

  async function openManage(register: RegisterAccess, focusedAssetId = '') {
    setManagedRegister(register);
    setManagedAssets([]);
    setAssetSearch('');
    setTargetByAsset({});
    setManageLoading(true);
    try {
      const response = await fetch(`/api/accountant/registers/${encodeURIComponent(register.shareId)}`, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(await responseMessage(response, 'This register could not be loaded.'));
      const data = (await response.json()) as { items?: AccountantAsset[] };
      const items = Array.isArray(data.items) ? data.items : [];
      setManagedAssets(items);
      if (focusedAssetId) {
        const focused = items.find((item) => item.id === focusedAssetId);
        if (focused) setAssetSearch(focused.title);
      }
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'This register could not be loaded.' });
      setManagedRegister(null);
    } finally {
      setManageLoading(false);
    }
  }

  useEffect(() => {
    if (loading || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('manage')?.trim();
    if (!shareId) return;
    const register = registers.find((entry) => entry.shareId === shareId);
    if (register) void openManage(register, params.get('assetId')?.trim() || '');
    window.history.replaceState({}, '', window.location.pathname);
  }, [loading, registers]);

  const visibleRegisters = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return registers;
    return registers.filter((register) => [register.registerName, register.ownerName, register.ownerBusinessName]
      .some((value) => value.toLowerCase().includes(needle)));
  }, [registers, search]);

  const visibleAssets = useMemo(() => {
    const needle = assetSearch.trim().toLowerCase();
    return needle ? managedAssets.filter((asset) => asset.title.toLowerCase().includes(needle)) : managedAssets;
  }, [managedAssets, assetSearch]);

  function registerTargets(): RegisterAccess[] {
    if (!managedRegister) return [];
    return registers.filter((entry) => entry.ownerUserId === managedRegister.ownerUserId && entry.registerId !== managedRegister.registerId);
  }

  async function moveAsset(asset: AccountantAsset) {
    if (!managedRegister) return;
    const targetShareId = targetByAsset[asset.id] || '';
    const target = registers.find((entry) => entry.shareId === targetShareId);
    if (!target) {
      setNotice({ type: 'error', message: 'Choose the register this asset should move to.' });
      return;
    }

    setMovingAssetId(asset.id);
    try {
      const response = await fetch('/api/accountant/registers/move-assets', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, sourceShareId: managedRegister.shareId, targetShareId }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, 'The asset could not be moved.'));

      setManagedAssets((current) => current.filter((item) => item.id !== asset.id));
      setTargetByAsset((current) => {
        const next = { ...current };
        delete next[asset.id];
        return next;
      });
      setRegisters((current) => current.map((entry) => {
        if (entry.shareId === managedRegister.shareId) {
          return { ...entry, assetCount: Math.max(0, entry.assetCount - 1), totalValue: Math.max(0, entry.totalValue - asset.value) };
        }
        if (entry.shareId === targetShareId) {
          return { ...entry, assetCount: entry.assetCount + 1, totalValue: entry.totalValue + asset.value };
        }
        return entry;
      }));
      setManagedRegister((current) => current ? {
        ...current,
        assetCount: Math.max(0, current.assetCount - 1),
        totalValue: Math.max(0, current.totalValue - asset.value),
      } : current);
      setNotice({ type: 'success', message: `${asset.title} was moved to ${target.registerName}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'The asset could not be moved.' });
    } finally {
      setMovingAssetId('');
    }
  }

  const targets = registerTargets();

  return (
    <div className={ownerStyles.page}>
      <AppHeader active="none" />
      {notice ? (
        <div className={ownerStyles.toastViewport} role="status" aria-live="polite">
          <div className={`${ownerStyles.toast} ${notice.type === 'success' ? ownerStyles.toastSuccess : ownerStyles.toastError}`}>
            <span className={ownerStyles.toastDot} aria-hidden="true" />
            <span>{notice.message}</span>
          </div>
        </div>
      ) : null}

      <main className={ownerStyles.shell}>
        <section className={ownerStyles.managementPanel}>
          <div className={ownerStyles.panelHeader}>
            <div className={ownerStyles.pageTitleBlock}>
              <h1>Client Asset Registers</h1>
            </div>
            <div className={`${ownerStyles.toolbar} ${styles.accountantToolbar}`}>
              <label className={ownerStyles.searchWrap}>
                <SearchIcon className={ownerStyles.searchIcon} />
                <input className={ownerStyles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients or Asset Registers..." />
                {search ? <button className={ownerStyles.clearSearchButton} type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button> : null}
              </label>
            </div>
          </div>

          {loading ? <div className={ownerStyles.emptyState}><p className={ownerStyles.loading}>Loading shared Asset Registers…</p></div> : null}
          {!loading && visibleRegisters.length === 0 ? (
            <div className={ownerStyles.emptyState}>
              <strong>{registers.length ? 'No registers match your search.' : 'No Asset Registers have been shared yet.'}</strong>
              <span>{registers.length ? 'Try another client or register name.' : 'Shared client registers will appear here automatically.'}</span>
            </div>
          ) : null}

          {!loading && visibleRegisters.length ? (
            <div className={ownerStyles.registerList}>
              {visibleRegisters.map((register) => (
                <article className={ownerStyles.registerCard} key={register.shareId}>
                  <div className={`${ownerStyles.combinedRegisterGraphic} ${styles.accountantRegisterGraphic}`} aria-hidden="true">
                    <RegistersIcon />
                    <span>{(register.ownerBusinessName || register.ownerName).slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className={ownerStyles.registerInfo}>
                    <div className={ownerStyles.registerTitleBlock}>
                      <h2>{register.registerName}</h2>
                      <div className={ownerStyles.registerDetails}>
                        <span>{register.ownerBusinessName || register.ownerName}</span>
                        <span>Shared {formatDate(register.dateSharedIso)}</span>
                      </div>
                    </div>
                    <div className={ownerStyles.statGrid}>
                      <div><span>Assets</span><strong>{register.assetCount.toLocaleString('en-ZA')}</strong></div>
                      <div><span>Total value</span><strong>{formatMoney(register.totalValue)}</strong></div>
                      <div><span>Last updated</span><strong>{formatDate(register.lastUpdatedIso)}</strong></div>
                    </div>
                  </div>
                  <aside className={ownerStyles.registerAside}>
                    <div className={ownerStyles.badgeStack}>
                      <span className={ownerStyles.combinedBadge}>Client register</span>
                    </div>
                    <div className={`${ownerStyles.unitActions} ${styles.accountantUnitActions}`}>
                      <a className={`${ownerStyles.unitButton} ${ownerStyles.openRegisterButton}`} href={`/accountant/registers/${register.shareId}`}>
                        <OpenIcon className={ownerStyles.buttonIcon} /> Open
                      </a>
                      <button className={`${ownerStyles.unitButton} ${ownerStyles.manageUnitButton}`} type="button" onClick={() => void openManage(register)}>
                        <ManageIcon className={ownerStyles.buttonIcon} /> Manage
                      </button>
                    </div>
                  </aside>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      {managedRegister ? (
        <div className={`${ownerStyles.modalOverlay} ${ownerStyles.manageModalOverlay}`} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !movingAssetId) setManagedRegister(null);
        }}>
          <section className={`${ownerStyles.modalCard} ${ownerStyles.manageModalCard}`} role="dialog" aria-modal="true" aria-labelledby="accountant-manage-register-title">
            <header className={ownerStyles.modalHeader}>
              <div>
                <h2 id="accountant-manage-register-title">Move assets</h2>
                <p className={ownerStyles.modalIntro}>{managedRegister.registerName} · {managedRegister.ownerBusinessName || managedRegister.ownerName}</p>
              </div>
              <button className={ownerStyles.closeButton} type="button" onClick={() => setManagedRegister(null)} disabled={Boolean(movingAssetId)} aria-label="Close">×</button>
            </header>

            <div className={ownerStyles.manageModalScrollArea}>
              <div className={`${ownerStyles.manageActionPanel} ${styles.moveManagerPanel}`}>
                <label className={`${ownerStyles.searchWrap} ${ownerStyles.manageAssetSearchWrap}`}>
                  <SearchIcon className={ownerStyles.searchIcon} />
                  <input className={ownerStyles.searchInput} value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search assets in this register..." />
                  {assetSearch ? <button className={ownerStyles.clearSearchButton} type="button" onClick={() => setAssetSearch('')} aria-label="Clear asset search">×</button> : null}
                </label>

                <div className={ownerStyles.assetMovePanel}>
                  <div className={ownerStyles.subHeader}>
                    <h3>Build the correct register structure</h3>
                    <p>Move an asset only between Asset Registers belonging to this same client.</p>
                  </div>

                  {manageLoading ? <p className={ownerStyles.loading}>Loading assets…</p> : null}
                  {!manageLoading && targets.length === 0 ? <p className={ownerStyles.muted}>This client needs another shared Asset Register before assets can be moved.</p> : null}
                  {!manageLoading && managedAssets.length === 0 ? <p className={ownerStyles.muted}>There are no assets in this register.</p> : null}
                  {!manageLoading && managedAssets.length > 0 && visibleAssets.length === 0 ? <p className={ownerStyles.muted}>No assets match your search.</p> : null}

                  {!manageLoading && visibleAssets.length ? (
                    <div className={ownerStyles.assetMoveList}>
                      {visibleAssets.map((asset) => (
                        <div className={ownerStyles.assetMoveRow} key={asset.id}>
                          <div className={ownerStyles.assetMoveCopy}>
                            <strong>{asset.title}</strong>
                            <span>{assetDetails(asset)}</span>
                            <small className={ownerStyles.assetSourceRegister}>{managedRegister.registerName}</small>
                          </div>
                          <div className={ownerStyles.assetMoveControls}>
                            <select value={targetByAsset[asset.id] || ''} onChange={(event) => setTargetByAsset((current) => ({ ...current, [asset.id]: event.target.value }))} disabled={!targets.length || Boolean(movingAssetId)} aria-label={`Move ${asset.title} to register`}>
                              <option value="">Choose target register</option>
                              {targets.map((target) => <option value={target.shareId} key={target.shareId}>{target.registerName}</option>)}
                            </select>
                            <button className={`${ownerStyles.secondaryButton} ${ownerStyles.assetMoveReadyButton}`} type="button" onClick={() => void moveAsset(asset)} disabled={!targetByAsset[asset.id] || Boolean(movingAssetId)}>
                              {movingAssetId === asset.id ? 'Moving…' : 'Move'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
