'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';

type AssetRegisterSummary = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  isPrimary: boolean;
  isSelected: boolean;
  assetCount: number;
  totalValue: number;
  totalReplacementPrice: number;
  createdAtIso: string;
  updatedAtIso: string;
};

type RegisterAsset = {
  id: string;
  userId: string;
  registerId: string | null;
  kind: string;
  title: string;
  value: number;
  replacementPriceExVat: number | null;
  serialNumber: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  updatedAtIso: string;
};

type AssetRegistersApiResponse = {
  ok: boolean;
  registers?: AssetRegisterSummary[];
  selectedRegister?: AssetRegisterSummary;
  register?: AssetRegisterSummary;
  movedCount?: number;
  deletedRegisterId?: string;
  error?: string;
};

type AssetRegisterItemsApiResponse = {
  ok: boolean;
  register?: AssetRegisterSummary;
  items?: RegisterAsset[];
  assets?: RegisterAsset[];
  error?: string;
};

type RegisterDraft = {
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
};

const emptyRegisterDraft: RegisterDraft = {
  businessName: '',
  email: '',
  phone: '',
  addressLine1: '',
};

function buildOpenHref(registerId: string): string {
  return `/asset-register?registerId=${encodeURIComponent(registerId)}`;
}

function draftFromRegister(register: AssetRegisterSummary): RegisterDraft {
  return {
    businessName: register.businessName,
    email: register.email,
    phone: register.phone,
    addressLine1: register.addressLine1,
  };
}

function money(value: unknown): string {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Math.round(safeValue));
}

function contactLine(register: AssetRegisterSummary): string {
  const parts = [register.email, register.phone, register.addressLine1]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  return parts.join(' • ') || 'No contact details saved yet';
}

function compactAssetMeta(asset: RegisterAsset): string {
  const parts = [
    asset.serialNumber ? `Serial: ${asset.serialNumber}` : '',
    asset.brandName,
    asset.modelName,
    asset.yearModel ? String(asset.yearModel) : '',
  ].filter(Boolean);

  return parts.join(' • ') || 'No asset details saved';
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
  }

  return fallback;
}

export default function AssetRegistersClient() {
  const router = useRouter();
  const [registers, setRegisters] = useState<AssetRegisterSummary[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<AssetRegisterSummary | null>(null);
  const [createDraft, setCreateDraft] = useState<RegisterDraft>(emptyRegisterDraft);
  const [editDraft, setEditDraft] = useState<RegisterDraft>(emptyRegisterDraft);
  const [managedRegisterId, setManagedRegisterId] = useState('');
  const [managedAssets, setManagedAssets] = useState<RegisterAsset[]>([]);
  const [assetMoveTargets, setAssetMoveTargets] = useState<Record<string, string>>({});
  const [removeTargets, setRemoveTargets] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isLoadingManagedAssets, setIsLoadingManagedAssets] = useState(false);
  const [selectingRegisterId, setSelectingRegisterId] = useState<string | null>(null);
  const [movingAssetId, setMovingAssetId] = useState<string | null>(null);
  const [removingRegisterId, setRemovingRegisterId] = useState<string | null>(null);

  const managedRegister = useMemo(
    () => registers.find((register) => register.id === managedRegisterId) ?? null,
    [managedRegisterId, registers],
  );
  const selectedRegisterFromList = useMemo(
    () => registers.find((register) => register.isSelected) ?? selectedRegister,
    [registers, selectedRegister],
  );
  const managedMoveTargets = useMemo(
    () => managedRegister ? registers.filter((register) => register.id !== managedRegister.id) : [],
    [managedRegister, registers],
  );

  async function refreshRegisters(showLoading = false): Promise<AssetRegisterSummary[]> {
    if (showLoading) setIsLoading(true);

    try {
      const response = await fetch('/api/asset-registers', {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.registers)) {
        throw new Error(extractErrorMessage(payload, 'Failed to load asset registers.'));
      }

      setRegisters(data.registers);
      setSelectedRegister(data.selectedRegister ?? data.registers.find((register) => register.isSelected) ?? data.registers[0] ?? null);
      return data.registers;
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to load asset registers.',
      });
      return [];
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshRegisters(true);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadManagedAssets(register: AssetRegisterSummary) {
    setIsLoadingManagedAssets(true);
    setManagedAssets([]);
    setAssetMoveTargets({});

    try {
      const params = new URLSearchParams({ registerId: register.id });
      const response = await fetch(`/api/asset-register?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegisterItemsApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to load register assets.'));
      }

      setManagedAssets(Array.isArray(data.items) ? data.items : Array.isArray(data.assets) ? data.assets : []);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to load register assets.',
      });
    } finally {
      setIsLoadingManagedAssets(false);
    }
  }

  function openManagePanel(register: AssetRegisterSummary) {
    setManagedRegisterId(register.id);
    setEditDraft(draftFromRegister(register));
    void loadManagedAssets(register);
  }

  function closeManagePanel() {
    setManagedRegisterId('');
    setEditDraft(emptyRegisterDraft);
    setManagedAssets([]);
    setAssetMoveTargets({});
  }

  async function handleCreateRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createDraft.businessName.trim()) {
      setNotice({ tone: 'error', message: 'Business name is required.' });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/asset-registers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createDraft),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !data.register || !Array.isArray(data.registers)) {
        throw new Error(extractErrorMessage(payload, 'Failed to create asset register.'));
      }

      setRegisters(data.registers);
      setSelectedRegister(data.selectedRegister ?? data.registers.find((register) => register.isSelected) ?? null);
      setCreateDraft(emptyRegisterDraft);
      setNotice({ tone: 'success', message: 'Asset register created. Select it when you want to view or save assets there.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to create asset register.',
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSelectRegister(register: AssetRegisterSummary, openAfterSelect: boolean) {
    setSelectingRegisterId(register.id);

    try {
      const response = await fetch('/api/asset-registers', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', registerId: register.id }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !data.register || !Array.isArray(data.registers)) {
        throw new Error(extractErrorMessage(payload, 'Failed to select asset register.'));
      }

      setRegisters(data.registers);
      setSelectedRegister(data.selectedRegister ?? data.register);
      setNotice({ tone: 'success', message: `${data.register.businessName} selected. You will only see this asset register until you select another one.` });

      if (openAfterSelect) {
        router.push(buildOpenHref(data.register.id));
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to select asset register.',
      });
    } finally {
      setSelectingRegisterId(null);
    }
  }

  async function handleUpdateRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!managedRegister) return;

    if (!editDraft.businessName.trim()) {
      setNotice({ tone: 'error', message: 'Business name is required.' });
      return;
    }

    setIsSavingDetails(true);

    try {
      const response = await fetch('/api/asset-registers', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId: managedRegister.id, ...editDraft }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !data.register || !Array.isArray(data.registers)) {
        throw new Error(extractErrorMessage(payload, 'Failed to update asset register.'));
      }

      setRegisters(data.registers);
      setSelectedRegister(data.selectedRegister ?? data.registers.find((register) => register.isSelected) ?? null);
      setEditDraft(draftFromRegister(data.register));
      setNotice({ tone: 'success', message: 'Asset register details saved.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update asset register.',
      });
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function handleMoveAsset(asset: RegisterAsset) {
    if (!managedRegister) return;

    const targetRegisterId = assetMoveTargets[asset.id] ?? '';
    if (!targetRegisterId) {
      setNotice({ tone: 'error', message: 'Choose the target asset register first.' });
      return;
    }

    setMovingAssetId(asset.id);

    try {
      const response = await fetch('/api/asset-registers/move-assets', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, targetRegisterId }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to move asset.'));
      }

      setManagedAssets((current) => current.filter((entry) => entry.id !== asset.id));
      setAssetMoveTargets((current) => {
        const next = { ...current };
        delete next[asset.id];
        return next;
      });
      await refreshRegisters(false);
      setNotice({ tone: 'success', message: 'Asset moved to the selected register.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to move asset.',
      });
    } finally {
      setMovingAssetId(null);
    }
  }

  async function handleRemoveRegister(register: AssetRegisterSummary) {
    if (registers.length <= 1) {
      setNotice({ tone: 'error', message: 'You must keep at least one asset register.' });
      return;
    }

    const targetRegisterId = removeTargets[register.id] ?? '';
    if (register.assetCount > 0 && !targetRegisterId) {
      setNotice({ tone: 'error', message: 'Choose where the assets must move before removing this register.' });
      return;
    }

    const confirmed = window.confirm(
      register.assetCount > 0
        ? `Remove ${register.businessName}? Its ${register.assetCount} asset${register.assetCount === 1 ? '' : 's'} will be moved to the selected target register.`
        : `Remove ${register.businessName}?`,
    );

    if (!confirmed) return;

    setRemovingRegisterId(register.id);

    try {
      const response = await fetch('/api/asset-registers', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId: register.id, targetRegisterId: targetRegisterId || null }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.registers)) {
        throw new Error(extractErrorMessage(payload, 'Failed to remove asset register.'));
      }

      setRegisters(data.registers);
      setSelectedRegister(data.selectedRegister ?? data.registers.find((entry) => entry.isSelected) ?? null);
      setRemoveTargets((current) => {
        const next = { ...current };
        delete next[register.id];
        return next;
      });

      if (managedRegisterId === register.id) {
        closeManagePanel();
      }

      setNotice({ tone: 'success', message: 'Asset register removed.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove asset register.',
      });
    } finally {
      setRemovingRegisterId(null);
    }
  }

  const selected = selectedRegisterFromList;

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <section className={styles.heroPanel}>
          <div>
            <span className={styles.eyebrow}>Asset register selection</span>
            <h1>Choose the asset register you want to work in</h1>
            <p>
              This page controls which asset register is active. Once a register is selected, the Asset Register page will only show that register until you select another one here.
            </p>
          </div>

          <div className={styles.heroActions}>
            {selected ? (
              <Link className={styles.primaryButton} href={buildOpenHref(selected.id)}>
                Open selected register
              </Link>
            ) : null}
            <Link className={styles.secondaryButton} href="/account">
              Back to account
            </Link>
          </div>
        </section>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.selectedPanel}>
          <div>
            <span>Currently selected</span>
            <strong>{selected?.businessName || 'Loading selected register...'}</strong>
            <p>
              You will only see this asset register in the Asset Register page, exports, manual asset saves and valuation saves unless you change the selected register.
            </p>
          </div>
          {selected ? <span className={styles.selectedBadge}>Active selection</span> : null}
        </section>

        <section className={styles.layoutGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Add asset register</h2>
                <p>Create a separate register for another company, trust, farm or legal entity.</p>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleCreateRegister}>
              <label className={styles.field}>
                <span>Business name</span>
                <input
                  value={createDraft.businessName}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, businessName: event.target.value }))}
                  placeholder="Example: Bashan Boerdery Pty Ltd"
                />
              </label>

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={createDraft.email}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
                  placeholder="accounts@example.co.za"
                />
              </label>

              <label className={styles.field}>
                <span>Phone</span>
                <input
                  type="tel"
                  value={createDraft.phone}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="082 000 0000"
                />
              </label>

              <label className={styles.field}>
                <span>Address</span>
                <textarea
                  value={createDraft.addressLine1}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, addressLine1: event.target.value }))}
                  placeholder="Farm, town, province"
                />
              </label>

              <button type="submit" className={styles.primaryButton} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create asset register'}
              </button>
            </form>
          </section>

          <section className={`${styles.card} ${styles.registerListCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Your asset registers</h2>
                <p>Select one register to make it active, or manage details and asset movement.</p>
              </div>
            </div>

            {isLoading ? (
              <p className={styles.loading}>Loading asset registers...</p>
            ) : registers.length ? (
              <div className={styles.registerGrid}>
                {registers.map((register) => {
                  const targets = registers.filter((entry) => entry.id !== register.id);
                  const isBusySelecting = selectingRegisterId === register.id;
                  const isBusyRemoving = removingRegisterId === register.id;

                  return (
                    <article key={register.id} className={`${styles.registerCard} ${register.isSelected ? styles.registerCardSelected : ''}`}>
                      <div className={styles.registerCardHeader}>
                        <div>
                          <h3>{register.businessName}</h3>
                          <p>{contactLine(register)}</p>
                        </div>
                        <div className={styles.badgeStack}>
                          {register.isSelected ? <span className={styles.selectedBadge}>Selected</span> : null}
                          {register.isPrimary ? <span className={styles.primaryBadge}>Primary</span> : null}
                        </div>
                      </div>

                      <div className={styles.statGrid}>
                        <div>
                          <span>Assets</span>
                          <strong>{register.assetCount}</strong>
                        </div>
                        <div>
                          <span>Register value</span>
                          <strong>{money(register.totalValue)}</strong>
                        </div>
                        <div>
                          <span>Replacement value</span>
                          <strong>{money(register.totalReplacementPrice)}</strong>
                        </div>
                      </div>

                      {register.assetCount > 0 && registers.length > 1 ? (
                        <label className={`${styles.field} ${styles.removeTargetField}`}>
                          <span>Move assets here before removing</span>
                          <select
                            value={removeTargets[register.id] ?? ''}
                            onChange={(event) => setRemoveTargets((current) => ({ ...current, [register.id]: event.target.value }))}
                          >
                            <option value="">Choose target register</option>
                            {targets.map((target) => (
                              <option key={target.id} value={target.id}>
                                {target.businessName}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => handleSelectRegister(register, true)}
                          disabled={isBusySelecting}
                        >
                          {isBusySelecting ? 'Selecting...' : register.isSelected ? 'Open' : 'Select & open'}
                        </button>
                        {!register.isSelected ? (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => handleSelectRegister(register, false)}
                            disabled={isBusySelecting}
                          >
                            Select only
                          </button>
                        ) : null}
                        <button type="button" className={styles.secondaryButton} onClick={() => openManagePanel(register)}>
                          Manage
                        </button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          onClick={() => handleRemoveRegister(register)}
                          disabled={registers.length <= 1 || isBusyRemoving}
                        >
                          {isBusyRemoving ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className={styles.loading}>No asset registers found yet.</p>
            )}
          </section>
        </section>

        {managedRegister ? (
          <section className={`${styles.card} ${styles.managePanel}`}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Manage {managedRegister.businessName}</h2>
                <p>Update business details or move assets from this register to another register on the same account.</p>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={closeManagePanel}>
                Close manage panel
              </button>
            </div>

            <form className={styles.editForm} onSubmit={handleUpdateRegister}>
              <label className={styles.field}>
                <span>Business name</span>
                <input
                  value={editDraft.businessName}
                  onChange={(event) => setEditDraft((current) => ({ ...current, businessName: event.target.value }))}
                  placeholder="Business name"
                />
              </label>

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={editDraft.email}
                  onChange={(event) => setEditDraft((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Email"
                />
              </label>

              <label className={styles.field}>
                <span>Phone</span>
                <input
                  type="tel"
                  value={editDraft.phone}
                  onChange={(event) => setEditDraft((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Phone"
                />
              </label>

              <label className={styles.field}>
                <span>Address</span>
                <textarea
                  value={editDraft.addressLine1}
                  onChange={(event) => setEditDraft((current) => ({ ...current, addressLine1: event.target.value }))}
                  placeholder="Address"
                />
              </label>

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryButton} disabled={isSavingDetails}>
                  {isSavingDetails ? 'Saving...' : 'Save details'}
                </button>
                <Link className={styles.secondaryButton} href={buildOpenHref(managedRegister.id)}>
                  Open register
                </Link>
              </div>
            </form>

            <div className={styles.assetMovePanel}>
              <div className={styles.subHeader}>
                <h3>Move assets</h3>
                <p>Move assets out of this register without duplicating them.</p>
              </div>

              {isLoadingManagedAssets ? (
                <p className={styles.loading}>Loading assets...</p>
              ) : managedAssets.length ? (
                <div className={styles.assetMoveList}>
                  {managedAssets.map((asset) => (
                    <div key={asset.id} className={styles.assetMoveRow}>
                      <div className={styles.assetMoveCopy}>
                        <strong>{asset.title}</strong>
                        <span>{compactAssetMeta(asset)}</span>
                        <small>{money(asset.value)} current value</small>
                      </div>

                      <div className={styles.assetMoveControls}>
                        <select
                          value={assetMoveTargets[asset.id] ?? ''}
                          onChange={(event) => setAssetMoveTargets((current) => ({ ...current, [asset.id]: event.target.value }))}
                          disabled={!managedMoveTargets.length || movingAssetId === asset.id}
                        >
                          <option value="">Choose target register</option>
                          {managedMoveTargets.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.businessName}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => handleMoveAsset(asset)}
                          disabled={!assetMoveTargets[asset.id] || movingAssetId === asset.id}
                        >
                          {movingAssetId === asset.id ? 'Moving...' : 'Move'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.loading}>No assets saved in this register yet.</p>
              )}

              {!managedMoveTargets.length ? (
                <p className={styles.muted}>Create another asset register before moving assets.</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
