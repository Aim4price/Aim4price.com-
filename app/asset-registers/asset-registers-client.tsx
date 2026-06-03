'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent, type SVGProps } from 'react';
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

function IconBase(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

function OpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </IconBase>
  );
}

function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.15 2.15 0 1 1-3.04 3.04l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65v.09a2.15 2.15 0 1 1-4.3 0v-.09a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.04.04a2.15 2.15 0 1 1-3.04-3.04l.04-.04A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.08h-.1a2.15 2.15 0 1 1 0-4.3h.1A1.8 1.8 0 0 0 4.6 8.54a1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.15 2.15 0 1 1 3.04-3.04l.04.04a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 10.34 2.2V2.1a2.15 2.15 0 1 1 4.3 0v.1a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.15 2.15 0 1 1 3.04 3.04l-.04.04a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.08h.1a2.15 2.15 0 1 1 0 4.3h-.1A1.8 1.8 0 0 0 19.4 15Z" />
    </IconBase>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </IconBase>
  );
}

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

function matchesRegisterSearch(register: AssetRegisterSummary, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableText = [
    register.businessName,
    register.email,
    register.phone,
    register.addressLine1,
    register.isSelected ? 'selected active current' : '',
    register.isPrimary ? 'primary main' : '',
  ].join(' ').toLowerCase();

  return searchableText.includes(normalizedSearch);
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
  const [registerSearchTerm, setRegisterSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [managedRegisterId, setManagedRegisterId] = useState('');
  const [managedAssets, setManagedAssets] = useState<RegisterAsset[]>([]);
  const [assetMoveTargets, setAssetMoveTargets] = useState<Record<string, string>>({});
  const [deleteCandidateRegister, setDeleteCandidateRegister] = useState<AssetRegisterSummary | null>(null);
  const [deleteTargetRegisterId, setDeleteTargetRegisterId] = useState('');
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
  const visibleRegisters = useMemo(
    () => registers.filter((register) => matchesRegisterSearch(register, registerSearchTerm)),
    [registerSearchTerm, registers],
  );
  const deleteMoveTargets = useMemo(
    () => deleteCandidateRegister ? registers.filter((register) => register.id !== deleteCandidateRegister.id) : [],
    [deleteCandidateRegister, registers],
  );
  const selected = selectedRegisterFromList;
  const isBlockingModalOpen = isCreateModalOpen || Boolean(deleteCandidateRegister);

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

  useEffect(() => {
    if (!isBlockingModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isCreateModalOpen && !isCreating) {
          closeCreateModal();
        }
        if (deleteCandidateRegister && !removingRegisterId) {
          closeDeleteRegisterDialog();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [deleteCandidateRegister, isBlockingModalOpen, isCreateModalOpen, isCreating, removingRegisterId]);

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

  function openCreateModal() {
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (isCreating) return;
    setIsCreateModalOpen(false);
    setCreateDraft(emptyRegisterDraft);
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

  function openRegister(register: AssetRegisterSummary) {
    if (register.isSelected) {
      router.push(buildOpenHref(register.id));
      return;
    }

    void handleSelectRegister(register, true);
  }

  function openDeleteRegisterDialog(register: AssetRegisterSummary) {
    if (registers.length <= 1) {
      setNotice({ tone: 'error', message: 'You must keep at least one asset register.' });
      return;
    }

    setDeleteCandidateRegister(register);
    setDeleteTargetRegisterId('');
  }

  function closeDeleteRegisterDialog() {
    if (removingRegisterId) return;
    setDeleteCandidateRegister(null);
    setDeleteTargetRegisterId('');
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
      setIsCreateModalOpen(false);
      setNotice({ tone: 'success', message: 'Asset register created. Open it from this page when you want to work in it.' });
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
      setNotice({ tone: 'success', message: `${data.register.businessName} selected. The Asset Register page will show only this register until you select another one here.` });

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

  async function handleConfirmRemoveRegister() {
    if (!deleteCandidateRegister) return;

    if (registers.length <= 1) {
      setNotice({ tone: 'error', message: 'You must keep at least one asset register.' });
      return;
    }

    const targetRegisterId = deleteTargetRegisterId;
    if (deleteCandidateRegister.assetCount > 0 && !targetRegisterId) {
      setNotice({ tone: 'error', message: 'Choose where the assets must move before deleting this register.' });
      return;
    }

    setRemovingRegisterId(deleteCandidateRegister.id);

    try {
      const response = await fetch('/api/asset-registers', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId: deleteCandidateRegister.id, targetRegisterId: targetRegisterId || null }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.registers)) {
        throw new Error(extractErrorMessage(payload, 'Failed to delete asset register.'));
      }

      setRegisters(data.registers);
      setSelectedRegister(data.selectedRegister ?? data.registers.find((entry) => entry.isSelected) ?? null);

      if (managedRegisterId === deleteCandidateRegister.id) {
        closeManagePanel();
      }

      setDeleteCandidateRegister(null);
      setDeleteTargetRegisterId('');
      setNotice({ tone: 'success', message: 'Asset register deleted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete asset register.',
      });
    } finally {
      setRemovingRegisterId(null);
    }
  }

  return (
    <>
      <main className={styles.page}>
        <AppHeader active="none" />

        <section className={styles.shell}>
          {notice ? (
            <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
              {notice.message}
            </div>
          ) : null}

          <section className={styles.managementPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.pageTitleBlock}>
                <h1>MANAGE OR ADD MORE ASSET REGISTERS</h1>
              </div>

              <div className={styles.toolbar}>
                <label className={styles.searchWrap}>
                  <SearchIcon className={styles.searchIcon} />
                  <input
                    className={styles.searchInput}
                    value={registerSearchTerm}
                    onChange={(event) => setRegisterSearchTerm(event.target.value)}
                    placeholder="Search by register, email, phone or address"
                  />
                  {registerSearchTerm.trim() ? (
                    <button type="button" className={styles.clearSearchButton} onClick={() => setRegisterSearchTerm('')} aria-label="Clear search">
                      ×
                    </button>
                  ) : null}
                </label>

                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.toolbarPrimaryButton} ${styles.topAddButton}`}
                  onClick={openCreateModal}
                >
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Asset Register</span>
                </button>
              </div>
            </div>

            {selected ? (
              <div className={styles.activeSelectionBanner}>
                <div>
                  <span>Active asset register</span>
                  <strong>{selected.businessName}</strong>
                  <p>The Asset Register page, exports, manual asset saves and valuation saves will use this register until another one is opened from this page.</p>
                </div>
                <Link className={styles.secondaryButton} href={buildOpenHref(selected.id)}>
                  Open active register
                </Link>
              </div>
            ) : null}

            {isLoading ? (
              <div className={styles.emptyState}>
                <strong>Loading asset registers...</strong>
              </div>
            ) : !registers.length ? (
              <div className={styles.emptyState}>
                <strong>No asset registers found yet.</strong>
                <span>Add your first register for the account.</span>
                <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Asset Register</span>
                </button>
              </div>
            ) : visibleRegisters.length ? (
              <div className={styles.registerList}>
                {visibleRegisters.map((register) => {
                  const isBusySelecting = selectingRegisterId === register.id;
                  const isBusyRemoving = removingRegisterId === register.id;

                  return (
                    <article key={register.id} className={`${styles.registerCard} ${register.isSelected ? styles.registerCardSelected : ''}`}>
                      <div className={styles.registerInfo}>
                        <div className={styles.registerTitleBlock}>
                          <h2>{register.businessName}</h2>
                          <div className={styles.registerDetails}>
                            <span>{contactLine(register)}</span>
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
                      </div>

                      <div className={styles.registerAside}>
                        <div className={styles.badgeStack}>
                          {register.isSelected ? <span className={styles.selectedBadge}>Selected</span> : null}
                          {register.isPrimary ? <span className={styles.primaryBadge}>Primary</span> : null}
                        </div>

                        <div className={styles.unitActions}>
                          <button
                            type="button"
                            className={`${styles.unitButton} ${styles.openRegisterButton}`}
                            onClick={() => openRegister(register)}
                            disabled={isBusySelecting}
                          >
                            <OpenIcon className={styles.buttonIcon} />
                            <span>{isBusySelecting ? 'Opening...' : 'Open'}</span>
                          </button>
                          <button type="button" className={styles.unitButton} onClick={() => openManagePanel(register)} disabled={isLoadingManagedAssets}>
                            <GearIcon className={styles.buttonIcon} />
                            <span>Manage</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.unitButton} ${styles.deleteUnitButton}`}
                            onClick={() => openDeleteRegisterDialog(register)}
                            disabled={registers.length <= 1 || isBusyRemoving}
                          >
                            <TrashIcon className={styles.buttonIcon} />
                            <span>{isBusyRemoving ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>No asset register matches the search.</strong>
                <button type="button" className={styles.secondaryButton} onClick={() => setRegisterSearchTerm('')}>
                  Clear search
                </button>
              </div>
            )}
          </section>

          {managedRegister ? (
            <section className={styles.managePanel}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.modalEyebrow}>Manage register</span>
                  <h2>{managedRegister.businessName}</h2>
                  <p>Update register details or move assets from this register to another register on the same account.</p>
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

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="add-register-title">
          <form className={styles.modalCard} onSubmit={handleCreateRegister}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Add asset register</span>
                <h2 id="add-register-title">Create a new asset register</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeCreateModal} disabled={isCreating} aria-label="Close add asset register modal">
                ×
              </button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Business name</span>
                <input
                  value={createDraft.businessName}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, businessName: event.target.value }))}
                  placeholder="Example: Bashan Boerdery Pty Ltd"
                  required
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

              <label className={`${styles.field} ${styles.fullField}`}>
                <span>Address</span>
                <textarea
                  value={createDraft.addressLine1}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, addressLine1: event.target.value }))}
                  placeholder="Farm, town, province"
                />
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.modalCancelButton} onClick={closeCreateModal} disabled={isCreating}>
                Cancel
              </button>
              <button type="submit" className={styles.modalPrimaryButton} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create asset register'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteCandidateRegister ? (
        <div className={`${styles.modalOverlay} ${styles.deleteConfirmOverlay}`} role="alertdialog" aria-modal="true" aria-labelledby="delete-register-title" aria-describedby="delete-register-copy">
          <div className={styles.deleteConfirmModal}>
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={closeDeleteRegisterDialog}
              aria-label="Close delete confirmation"
              disabled={removingRegisterId === deleteCandidateRegister.id}
            >
              ×
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="delete-register-title">Delete this asset register?</h3>
              <p id="delete-register-copy">
                This removes <strong>{deleteCandidateRegister.businessName}</strong> from your account. Assets can be moved to another register before the register is deleted.
              </p>

              <div className={styles.deleteConfirmAsset}>
                <span>Selected register</span>
                <strong>{deleteCandidateRegister.businessName}</strong>
                <small>{deleteCandidateRegister.assetCount} asset{deleteCandidateRegister.assetCount === 1 ? '' : 's'} · {money(deleteCandidateRegister.totalValue)} register value</small>
              </div>

              {deleteCandidateRegister.assetCount > 0 ? (
                <label className={`${styles.field} ${styles.deleteMoveField}`}>
                  <span>Move assets to</span>
                  <select value={deleteTargetRegisterId} onChange={(event) => setDeleteTargetRegisterId(event.target.value)} disabled={removingRegisterId === deleteCandidateRegister.id}>
                    <option value="">Choose target register</option>
                    {deleteMoveTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.businessName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeDeleteRegisterDialog} disabled={removingRegisterId === deleteCandidateRegister.id}>
                  Cancel
                </button>

                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.deleteConfirmButton}`}
                  onClick={() => void handleConfirmRemoveRegister()}
                  disabled={removingRegisterId === deleteCandidateRegister.id || (deleteCandidateRegister.assetCount > 0 && !deleteTargetRegisterId)}
                >
                  <span>{removingRegisterId === deleteCandidateRegister.id ? 'Deleting...' : 'Yes, delete register'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
