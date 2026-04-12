'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type AssetKind = 'tractor' | 'manual' | 'property';
type AssetMethod = 'aim4price' | 'market' | 'department' | 'manual';

type RegisterAsset = {
  id: string;
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
  sellerPhone: string;
  marketplaceNotes: string;
  marketplaceStatus: string;
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

type AssetUploadApiResponse = {
  ok: boolean;
  uploads?: Array<{
    uploadId: string;
    url: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }>;
  error?: string;
};

type AccountProfilePreview = {
  userId: string;
  name: string;
  email: string;
  businessName: string;
  phone: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
};

type ProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfilePreview;
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
  photos: string[];
};

type MarketplaceDraft = {
  assetId: string;
  assetTitle: string;
  askingPrice: string;
  sellerPhone: string;
  notes: string;
  confirmContact: boolean;
};

const MAX_PHOTOS = 12;

const initialAssetDraft: AssetDraft = {
  kind: 'manual',
  title: '',
  value: '',
  note: '',
  serialNumber: '',
  isFinanced: false,
  financeNote: '',
  photos: [],
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

function wasUpdatedAfterCreate(asset: RegisterAsset): boolean {
  const createdAt = new Date(asset.createdAtIso).getTime();
  const updatedAt = new Date(asset.updatedAtIso).getTime();

  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return false;
  }

  return updatedAt - createdAt > 1000;
}

function assetStatusDateLabel(asset: RegisterAsset): string {
  return wasUpdatedAfterCreate(asset)
    ? `Edited ${formatDate(asset.updatedAtIso)}`
    : `Saved ${formatDate(asset.createdAtIso)}`;
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

function normalizePhotos(value: string[]): string[] {
  const seen = new Set<string>();

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    })
    .slice(0, MAX_PHOTOS);
}

function isTractorAsset(asset: RegisterAsset): boolean {
  return asset.kind === 'tractor' || Boolean(asset.brandName && asset.modelName && asset.yearModel);
}

function buildDraftFromAsset(asset: RegisterAsset): AssetDraft {
  return {
    kind: asset.kind,
    title: asset.title,
    value: String(asset.value || ''),
    note: asset.note,
    serialNumber: asset.serialNumber,
    isFinanced: asset.isFinanced,
    financeNote: asset.financeNote,
    photos: normalizePhotos(asset.photos),
  };
}

function buildContactLocation(profile: AccountProfilePreview | null): string {
  return [profile?.addressLine1, profile?.addressLine2, profile?.townCity, profile?.province]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function buildSellerName(profile: AccountProfilePreview | null): string {
  return profile?.businessName?.trim() || profile?.name?.trim() || 'No seller name saved yet';
}

export default function AssetRegisterClient() {
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [profile, setProfile] = useState<AccountProfilePreview | null>(null);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(initialAssetDraft);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [marketplaceDraft, setMarketplaceDraft] = useState<MarketplaceDraft | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [busyMarketplaceAssetId, setBusyMarketplaceAssetId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);

      try {
        const [assetsResponse, profileResponse] = await Promise.all([
          fetch('/api/asset-register', {
            cache: 'no-store',
            credentials: 'include',
          }),
          fetch('/api/account-profile', {
            cache: 'no-store',
            credentials: 'include',
          }),
        ]);

        const assetsData = (await assetsResponse.json()) as AssetRegisterApiResponse;
        const profileData = (await profileResponse.json()) as ProfileApiResponse;

        if (!assetsResponse.ok || !assetsData.ok) {
          throw new Error(assetsData.error ?? 'Failed to load asset register.');
        }

        if (!mounted) {
          return;
        }

        setAssets(Array.isArray(assetsData.items) ? assetsData.items : []);

        if (profileResponse.ok && profileData.ok && profileData.profile) {
          setProfile(profileData.profile);
        }
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

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const hasModalOpen = isEditorOpen || Boolean(marketplaceDraft);

  useEffect(() => {
    if (!hasModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasModalOpen]);

  useEffect(() => {
    if (!hasModalOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (!isSavingAsset && !isUploadingPhotos) {
        setIsEditorOpen(false);
      }

      if (!busyMarketplaceAssetId) {
        setMarketplaceDraft(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [busyMarketplaceAssetId, hasModalOpen, isSavingAsset, isUploadingPhotos]);

  const totalValue = useMemo(() => assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0), [assets]);
  const equipmentCount = useMemo(() => assets.filter((asset) => isTractorAsset(asset)).length, [assets]);
  const liveCount = useMemo(
    () => assets.filter((asset) => asset.marketplaceStatus === 'live').length,
    [assets],
  );
  const editingAsset = useMemo(
    () => (editingAssetId === null ? null : assets.find((asset) => asset.id === editingAssetId) ?? null),
    [assets, editingAssetId],
  );
  const contactLocation = useMemo(() => buildContactLocation(profile), [profile]);
  const sellerName = useMemo(() => buildSellerName(profile), [profile]);

  function resetEditorDraft() {
    setEditingAssetId(null);
    setAssetDraft(initialAssetDraft);

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }

  function closeEditorModal() {
    if (isSavingAsset || isUploadingPhotos) {
      return;
    }

    setIsEditorOpen(false);
    resetEditorDraft();
  }

  function openCreateModal() {
    resetEditorDraft();
    setIsEditorOpen(true);
  }

  function openEditorModal(asset: RegisterAsset) {
    setEditingAssetId(asset.id);
    setAssetDraft(buildDraftFromAsset(asset));
    setIsEditorOpen(true);
  }

  async function handlePhotoFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const remainingSlots = MAX_PHOTOS - assetDraft.photos.length;

    if (remainingSlots <= 0) {
      setNotice({ tone: 'error', message: `You can upload a maximum of ${MAX_PHOTOS} photos per asset.` });
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    const formData = new FormData();

    filesToUpload.forEach((file) => {
      formData.append('files', file);
    });

    setIsUploadingPhotos(true);

    try {
      const response = await fetch('/api/asset-register/uploads', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = (await response.json()) as AssetUploadApiResponse;

      if (!response.ok || !data.ok || !data.uploads?.length) {
        throw new Error(data.error ?? 'Failed to upload images.');
      }

      const uploadedUrls = data.uploads.map((entry) => entry.url);

      setAssetDraft((current) => ({
        ...current,
        photos: normalizePhotos([...current.photos, ...uploadedUrls]),
      }));

      setNotice({
        tone: 'success',
        message: `${data.uploads.length} photo${data.uploads.length === 1 ? '' : 's'} uploaded.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload images.',
      });
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  function removeDraftPhoto(photoUrl: string) {
    setAssetDraft((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo !== photoUrl),
    }));
  }

  async function handleAssetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = Math.round(Number(assetDraft.value) || 0);
    const photos = normalizePhotos(assetDraft.photos);

    if (!assetDraft.title.trim() || value <= 0) {
      setNotice({ tone: 'error', message: 'Asset title and value are required.' });
      return;
    }

    setIsSavingAsset(true);

    try {
      if (editingAssetId !== null) {
        const response = await fetch('/api/asset-register', {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assetId: editingAssetId,
            kind: editingAsset?.valuationRunId ? editingAsset.kind : assetDraft.kind,
            title: assetDraft.title,
            value,
            note: assetDraft.note,
            serialNumber: assetDraft.serialNumber,
            isFinanced: assetDraft.isFinanced,
            financeNote: assetDraft.financeNote,
            photos,
          }),
        });

        const data = (await response.json()) as AssetRegisterApiResponse;

        if (!response.ok || !data.ok || !data.item) {
          throw new Error(data.error ?? 'Failed to update asset.');
        }

        setAssets((current) => current.map((asset) => (asset.id === data.item!.id ? data.item! : asset)));
        setNotice({ tone: 'success', message: 'Asset updated.' });
      } else {
        const response = await fetch('/api/asset-register', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...assetDraft,
            value,
            photos,
          }),
        });

        const data = (await response.json()) as AssetRegisterApiResponse;

        if (!response.ok || !data.ok || !data.item) {
          throw new Error(data.error ?? 'Failed to add asset.');
        }

        setAssets((current) => [data.item as RegisterAsset, ...current]);
        setNotice({ tone: 'success', message: 'Asset added to the register.' });
      }

      setIsEditorOpen(false);
      resetEditorDraft();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save asset.',
      });
    } finally {
      setIsSavingAsset(false);
    }
  }

  async function handleDeleteAsset(assetId: string) {
    if (!window.confirm('Delete this asset from your register?')) {
      return;
    }

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
      if (editingAssetId === assetId) {
        closeEditorModal();
      }
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

  function openMarketplaceModal(asset: RegisterAsset) {
    setMarketplaceDraft({
      assetId: asset.id,
      assetTitle: asset.title,
      askingPrice: String(Math.round(asset.value || asset.selectedValueExVat || 0)),
      sellerPhone: asset.sellerPhone || profile?.phone || '',
      notes: asset.marketplaceNotes || asset.note || '',
      confirmContact: false,
    });
  }

  function closeMarketplaceModal() {
    if (busyMarketplaceAssetId) {
      return;
    }

    setMarketplaceDraft(null);
  }

  async function handleMarketplaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!marketplaceDraft) {
      return;
    }

    const askingPriceExVat = Math.round(Number(marketplaceDraft.askingPrice) || 0);

    if (askingPriceExVat <= 0) {
      setNotice({ tone: 'error', message: 'Enter a valid asking price before sending to marketplace.' });
      return;
    }

    if (!marketplaceDraft.sellerPhone.trim()) {
      setNotice({ tone: 'error', message: 'Add a seller phone number before publishing.' });
      return;
    }

    if (!marketplaceDraft.confirmContact) {
      setNotice({ tone: 'error', message: 'Confirm that the contact details are correct before publishing.' });
      return;
    }

    setBusyMarketplaceAssetId(marketplaceDraft.assetId);

    try {
      const response = await fetch('/api/marketplace', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: marketplaceDraft.assetId,
          askingPriceExVat,
          marketplaceNotes: marketplaceDraft.notes,
          sellerPhone: marketplaceDraft.sellerPhone,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        assetId?: string;
        marketplaceStatus?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to send asset to marketplace.');
      }

      setAssets((current) =>
        current.map((entry) =>
          entry.id === marketplaceDraft.assetId
            ? {
                ...entry,
                marketplaceStatus: data.marketplaceStatus || 'live',
                sellerPhone: marketplaceDraft.sellerPhone.trim(),
                marketplaceNotes: marketplaceDraft.notes.trim(),
              }
            : entry,
        ),
      );
      setNotice({
        tone: 'success',
        message: `${marketplaceDraft.assetTitle} was sent to the marketplace.`,
      });
      setMarketplaceDraft(null);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send asset to marketplace.',
      });
    } finally {
      setBusyMarketplaceAssetId(null);
    }
  }

  async function handleRemoveMarketplace(asset: RegisterAsset) {
    if (!window.confirm(`Remove ${asset.title} from the marketplace?`)) {
      return;
    }

    setBusyMarketplaceAssetId(asset.id);

    try {
      const response = await fetch(`/api/marketplace?assetId=${asset.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = (await response.json()) as {
        ok: boolean;
        marketplaceStatus?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to remove marketplace listing.');
      }

      setAssets((current) =>
        current.map((entry) =>
          entry.id === asset.id
            ? {
                ...entry,
                marketplaceStatus: data.marketplaceStatus || 'draft',
              }
            : entry,
        ),
      );
      setNotice({ tone: 'success', message: `${asset.title} was removed from the marketplace.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove marketplace listing.',
      });
    } finally {
      setBusyMarketplaceAssetId(null);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Asset Register</span>
            <h1>Keep every saved asset in one clean register.</h1>
            <p>
              Manage valuation-linked machinery, add manual records only when you need them, and send
              equipment to marketplace from the same workflow.
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
            <div className={styles.statCard}>
              <span>Live listings</span>
              <strong>{liveCount}</strong>
            </div>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.toolbarCard}>
          <div className={styles.toolbarCopy}>
            <span className={styles.kicker}>Manual records</span>
            <h2>Add another asset only when you need one</h2>
            <p>
              Property and manual assets now live behind a popup so your register stays cleaner and more
              focused on saved equipment.
            </p>
          </div>

          <div className={styles.inlineActions}>
            <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
              Add another asset
            </button>
            <Link href="/valuation" className={styles.secondaryButton}>
              Open valuation
            </Link>
            <Link href="/account" className={styles.secondaryButton}>
              Account details
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.kicker}>Saved assets</span>
              <h2>Your register</h2>
              <p>Saved valuations stay as fixed snapshots. They only change when you edit that item.</p>
            </div>

            <div className={styles.inlineActions}>
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
                        <span className={styles.badge}>{kindLabel(isTractorAsset(asset) ? 'tractor' : asset.kind)}</span>
                        <span className={styles.badge}>{methodLabel(asset.selectedMethod)}</span>
                        {asset.valuationRunId ? <span className={styles.badge}>Saved valuation</span> : null}
                        {asset.marketplaceStatus === 'live' ? <span className={styles.badgeLive}>Live on marketplace</span> : null}
                        {asset.photos.length ? (
                          <span className={styles.badge}>
                            {asset.photos.length} photo{asset.photos.length === 1 ? '' : 's'}
                          </span>
                        ) : null}
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
                      <span>{assetStatusDateLabel(asset)}</span>
                    </div>
                  </div>

                  {asset.photos.length ? (
                    <div className={styles.photoGrid}>
                      {asset.photos.slice(0, 4).map((photo, index) => (
                        <div className={styles.photoThumb} key={`${asset.id}-${photo}-${index}`}>
                          <img src={photo} alt={`${asset.title} photo ${index + 1}`} />
                        </div>
                      ))}
                    </div>
                  ) : null}

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
                    <button type="button" className={styles.secondaryButton} onClick={() => openEditorModal(asset)}>
                      Edit
                    </button>
                    {isTractorAsset(asset) ? (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={busyMarketplaceAssetId === asset.id}
                        onClick={() => openMarketplaceModal(asset)}
                      >
                        {busyMarketplaceAssetId === asset.id
                          ? 'Working...'
                          : asset.marketplaceStatus === 'live'
                            ? 'Update marketplace'
                            : 'Send to marketplace'}
                      </button>
                    ) : null}
                    {asset.marketplaceStatus === 'live' ? (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={busyMarketplaceAssetId === asset.id}
                        onClick={() => void handleRemoveMarketplace(asset)}
                      >
                        Remove listing
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={busyDeleteId === asset.id}
                      onClick={() => void handleDeleteAsset(asset.id)}
                    >
                      {busyDeleteId === asset.id ? 'Removing...' : 'Delete asset'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>No assets saved yet</h3>
              <p>Start with a valuation or add a manual asset to begin your register.</p>
              <div className={styles.inlineActions}>
                <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
                  Add first asset
                </button>
                <Link href="/valuation" className={styles.secondaryButton}>
                  Open valuation
                </Link>
              </div>
            </div>
          )}
        </section>
      </section>

      {isEditorOpen ? (
        <div className={styles.modalBackdrop} onClick={closeEditorModal}>
          <section className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.kicker}>{editingAsset ? 'Edit asset' : 'Add manually'}</span>
              <h2>{editingAsset ? 'Update saved asset' : 'Add another asset'}</h2>
              <p>
                {editingAsset
                  ? 'Update title, value, finance notes and photo gallery. Valuation-linked tractor type stays locked.'
                  : 'Use this popup for property or manual records that did not come from the valuation workflow.'}
              </p>
            </div>

            <form className={styles.form} onSubmit={handleAssetSubmit}>
              <label className={styles.field}>
                <span>Asset type</span>
                <select
                  value={editingAsset?.valuationRunId ? editingAsset.kind : assetDraft.kind}
                  disabled={Boolean(editingAsset?.valuationRunId)}
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
                  onChange={(event) => setAssetDraft((current) => ({ ...current, isFinanced: event.target.checked }))}
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

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <span>Photo gallery</span>

                <div className={styles.uploadPanel}>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className={styles.fileInput}
                    onChange={handlePhotoFilesSelected}
                    disabled={isUploadingPhotos || assetDraft.photos.length >= MAX_PHOTOS}
                  />

                  <div className={styles.uploadActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhotos || assetDraft.photos.length >= MAX_PHOTOS}
                    >
                      {isUploadingPhotos ? 'Uploading...' : 'Choose image files'}
                    </button>

                    <span className={styles.uploadSummary}>
                      {assetDraft.photos.length} / {MAX_PHOTOS} photos
                    </span>
                  </div>

                  <p className={styles.helperText}>
                    Upload JPG, PNG or WEBP files. Max 5 MB per image. The first image is used as the
                    preview image in the register for now.
                  </p>
                </div>
              </div>

              {assetDraft.photos.length ? (
                <div className={`${styles.photoGrid} ${styles.fullWidth}`}>
                  {assetDraft.photos.map((photo, index) => (
                    <div className={styles.photoThumb} key={`${photo}-${index}`}>
                      <img src={photo} alt={`Asset photo ${index + 1}`} />
                      <button type="button" className={styles.photoRemoveButton} onClick={() => removeDraftPhoto(photo)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={styles.modalActions}>
                <button type="button" className={styles.ghostButton} onClick={closeEditorModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isSavingAsset || isUploadingPhotos}>
                  {isSavingAsset ? 'Saving...' : editingAsset ? 'Update asset' : 'Add asset'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {marketplaceDraft ? (
        <div className={styles.modalBackdrop} onClick={closeMarketplaceModal}>
          <section
            className={`${styles.modalCard} ${styles.marketplaceModalCard}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <span className={styles.kicker}>Marketplace</span>
              <h2>Send {marketplaceDraft.assetTitle} to marketplace</h2>
              <p>Choose the selling price, add seller notes and confirm the contact details before publishing.</p>
            </div>

            <form className={styles.form} onSubmit={handleMarketplaceSubmit}>
              <label className={styles.field}>
                <span>Asking price</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={marketplaceDraft.askingPrice}
                  onChange={(event) =>
                    setMarketplaceDraft((current) =>
                      current ? { ...current, askingPrice: event.target.value } : current,
                    )
                  }
                  placeholder="0"
                />
              </label>

              <label className={styles.field}>
                <span>Seller phone</span>
                <input
                  value={marketplaceDraft.sellerPhone}
                  onChange={(event) =>
                    setMarketplaceDraft((current) =>
                      current ? { ...current, sellerPhone: event.target.value } : current,
                    )
                  }
                  placeholder="Phone number"
                />
              </label>

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Marketplace notes</span>
                <textarea
                  rows={4}
                  value={marketplaceDraft.notes}
                  onChange={(event) =>
                    setMarketplaceDraft((current) =>
                      current ? { ...current, notes: event.target.value } : current,
                    )
                  }
                  placeholder="What should buyers know about this asset?"
                />
              </label>

              <div className={`${styles.contactPanel} ${styles.fullWidth}`}>
                <div className={styles.inlineActions}>
                  <span className={styles.badge}>Contact details</span>
                  <Link href="/account" className={styles.inlineLink}>
                    Edit account details
                  </Link>
                </div>

                <div className={styles.contactSummary}>
                  <div className={styles.contactRow}>
                    <span>Seller</span>
                    <strong>{sellerName}</strong>
                  </div>
                  <div className={styles.contactRow}>
                    <span>Email</span>
                    <strong>{profile?.email || 'No email saved yet'}</strong>
                  </div>
                  <div className={styles.contactRow}>
                    <span>Phone</span>
                    <strong>{marketplaceDraft.sellerPhone.trim() || 'No phone saved yet'}</strong>
                  </div>
                  <div className={styles.contactRow}>
                    <span>Location</span>
                    <strong>{contactLocation || 'No address saved yet'}</strong>
                  </div>
                </div>

                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={marketplaceDraft.confirmContact}
                    onChange={(event) =>
                      setMarketplaceDraft((current) =>
                        current ? { ...current, confirmContact: event.target.checked } : current,
                      )
                    }
                  />
                  <span>The contact details above are correct for this listing.</span>
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.ghostButton} onClick={closeMarketplaceModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton} disabled={busyMarketplaceAssetId === marketplaceDraft.assetId}>
                  {busyMarketplaceAssetId === marketplaceDraft.assetId ? 'Publishing...' : 'Send to marketplace'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
