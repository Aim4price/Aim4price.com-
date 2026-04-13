'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import { hasMarketplaceListingForAsset, publishRegisterItemToMarketplace } from '../../lib/marketplace';
import { openAssetSheetPrint, type ReportMethodCard } from '../../lib/report-print';
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

function buildSavedItemFromAsset(asset: RegisterAsset) {
  return {
    id: String(asset.id),
    valuationRunId: asset.valuationRunId ?? undefined,
    kind: asset.kind,
    title: asset.title,
    value: asset.value,
    selectedMethod: asset.selectedMethod,
    method: asset.selectedMethod,
    selectedValueExVat: asset.selectedValueExVat,
    brandName: asset.brandName || undefined,
    modelName: asset.modelName || undefined,
    drive: asset.drive || undefined,
    tractorType: asset.tractorType || undefined,
    cab: asset.cab || undefined,
    powerKw: asset.powerKw ?? undefined,
    yearModel: asset.yearModel ?? undefined,
    hours: asset.hours ?? undefined,
    aim4priceValueExVat: asset.aim4priceValueExVat,
    marketMidExVat: asset.marketMidExVat,
    departmentValueExVat: asset.departmentValueExVat,
    note: asset.note || undefined,
    createdAtIso: asset.createdAtIso,
    updatedAtIso: asset.updatedAtIso,
    serialNumber: asset.serialNumber || undefined,
    isFinanced: asset.isFinanced,
    financeNote: asset.financeNote || undefined,
    photos: asset.photos,
  };
}

function buildAssetMeta(asset: RegisterAsset): string {
  const parts = [
    asset.tractorType,
    asset.drive,
    asset.cab,
    asset.powerKw ? `${asset.powerKw} kW` : '',
    asset.yearModel ? `${asset.yearModel} model` : '',
    asset.hours ? `${asset.hours.toLocaleString('en-ZA')} hours` : '',
  ].filter(Boolean);

  if (parts.length) {
    return parts.join(' • ');
  }

  return [asset.brandName, asset.modelName].filter(Boolean).join(' • ') || 'Manual asset';
}

function toAbsoluteUrl(value?: string | null): string | null {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(text)) {
    return text;
  }

  if (typeof window === 'undefined') {
    return text;
  }

  try {
    return new URL(text, window.location.origin).toString();
  } catch {
    return text;
  }
}

function buildAssetSheetMethodCards(asset: RegisterAsset): ReportMethodCard[] {
  const cards: ReportMethodCard[] = [];

  if (asset.aim4priceValueExVat !== null) {
    cards.push({
      label: 'Aim4price',
      value: money(asset.aim4priceValueExVat),
      note: 'Pricing engine output.',
      selected: asset.selectedMethod === 'aim4price',
    });
  }

  if (asset.marketMidExVat !== null) {
    cards.push({
      label: 'Market',
      value: money(asset.marketMidExVat),
      note: 'Saved market midpoint.',
      selected: asset.selectedMethod === 'market',
    });
  }

  if (asset.departmentValueExVat !== null) {
    cards.push({
      label: 'DALRRD',
      value: money(asset.departmentValueExVat),
      note: 'Reference guide value.',
      selected: asset.selectedMethod === 'department',
    });
  }

  if (!cards.length || asset.selectedMethod === 'manual') {
    cards.unshift({
      label: 'Register',
      value: money(asset.value),
      note: 'Saved register value.',
      selected: asset.selectedMethod === 'manual' || !cards.length,
    });
  }

  return cards;
}

export default function AssetRegisterClient() {
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(initialAssetDraft);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [activeAsset, setActiveAsset] = useState<RegisterAsset | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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

        if (!mounted) return;

        setAssets(Array.isArray(assetsData.items) ? assetsData.items : []);
      } catch (error) {
        if (!mounted) return;

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

  useEffect(() => {
    const anyModalOpen = isAssetModalOpen || Boolean(activeAsset);
    if (!anyModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (activeAsset) {
        setActiveAsset(null);
        return;
      }

      setIsAssetModalOpen(false);
      setEditingAssetId(null);
      setAssetDraft(initialAssetDraft);
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeAsset, isAssetModalOpen]);

  const totalValue = useMemo(() => {
    return assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0);
  }, [assets]);

  const equipmentCount = useMemo(() => {
    return assets.filter((asset) => isTractorAsset(asset)).length;
  }, [assets]);

  const editingAsset = useMemo(() => {
    return editingAssetId === null ? null : assets.find((asset) => asset.id === editingAssetId) ?? null;
  }, [assets, editingAssetId]);

  function resetEditor() {
    setEditingAssetId(null);
    setAssetDraft(initialAssetDraft);

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }

  function openCreateModal() {
    resetEditor();
    setIsAssetModalOpen(true);
  }

  function closeAssetModal() {
    setIsAssetModalOpen(false);
    resetEditor();
  }

  function openEditor(asset: RegisterAsset) {
    setEditingAssetId(asset.id);
    setAssetDraft(buildDraftFromAsset(asset));
    setIsAssetModalOpen(true);
  }

  function openActionDialog(asset: RegisterAsset) {
    setActiveAsset(asset);
  }

  function closeActionDialog() {
    setActiveAsset(null);
  }

  function handleOpenEditorFromDialog(asset: RegisterAsset) {
    closeActionDialog();
    openEditor(asset);
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

        if (activeAsset?.id === data.item.id) {
          setActiveAsset(data.item);
        }

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

      closeAssetModal();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save asset.',
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

      if (editingAssetId === assetId) {
        resetEditor();
      }

      if (activeAsset?.id === assetId) {
        setActiveAsset(null);
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

  function handleDeleteFromDialog(asset: RegisterAsset) {
    closeActionDialog();
    void handleDeleteAsset(asset.id);
  }

  function handlePublishAsset(asset: RegisterAsset) {
    try {
      const normalizedAsset = buildSavedItemFromAsset(asset);
      const publishableAsset = isTractorAsset(asset)
        ? { ...normalizedAsset, kind: 'tractor' as const }
        : normalizedAsset;

      publishRegisterItemToMarketplace(publishableAsset, {
        askingPriceExVat: asset.selectedValueExVat || asset.value,
        imageUrls: asset.photos,
        imageSrc: asset.photos[0],
      });

      setNotice({
        tone: 'success',
        message: `${asset.title} was sent to the marketplace.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send asset to marketplace.',
      });
    }
  }

  function handlePublishFromDialog(asset: RegisterAsset) {
    handlePublishAsset(asset);
    closeActionDialog();
  }

  function handlePrintAssetSheet(asset: RegisterAsset) {
    const didOpen = openAssetSheetPrint({
      logoUrl: toAbsoluteUrl('/brand/aim4price-mark-white.png') ?? '',
      generatedAt: formatDate(new Date().toISOString()),
      assetBadge: kindLabel(isTractorAsset(asset) ? 'tractor' : asset.kind),
      heroTitle: asset.title,
      heroMeta: buildAssetMeta(asset),
      valueLabel: `${methodLabel(asset.selectedMethod)} value`,
      value: money(asset.value),
      valueNote: 'Saved asset register snapshot.',
      statusLabel: assetStatusDateLabel(asset),
      photoUrl: toAbsoluteUrl(asset.photos[0]) ?? null,
      facts: [
        { label: 'Asset type', value: kindLabel(isTractorAsset(asset) ? 'tractor' : asset.kind) },
        { label: 'Method', value: methodLabel(asset.selectedMethod) },
        { label: 'Brand', value: asset.brandName || '—' },
        { label: 'Model', value: asset.modelName || '—' },
        { label: 'Drive', value: asset.drive || '—' },
        { label: 'Cab', value: asset.cab || '—' },
        { label: 'Power', value: asset.powerKw ? `${asset.powerKw} kW` : '—' },
        { label: 'Year', value: asset.yearModel ? String(asset.yearModel) : '—' },
        { label: 'Hours', value: asset.hours ? asset.hours.toLocaleString('en-ZA') : '—' },
        { label: 'Serial', value: asset.serialNumber || '—' },
        { label: 'Finance', value: asset.isFinanced ? 'Financed' : 'Not financed' },
        { label: 'Saved', value: formatDate(asset.createdAtIso) },
      ],
      notes: [
        ...(asset.note ? [{ label: 'Notes', value: asset.note }] : []),
        ...(asset.financeNote ? [{ label: 'Finance note', value: asset.financeNote }] : []),
      ],
      methodCards: buildAssetSheetMethodCards(asset),
      footerNote: 'Aim4price asset sheet. All register values shown exclude VAT.',
    });

    if (!didOpen) {
      setNotice({
        tone: 'error',
        message: 'Unable to open the asset sheet PDF window. Please allow pop-ups and try again.',
      });
      return;
    }

    closeActionDialog();
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.registerPanel}>
          <div className={styles.registerHeader}>
            <div className={styles.registerTitleBlock}>
              <span className={styles.eyebrow}>Asset Register</span>
              <h1>Saved assets</h1>
              <p>Clean register view with actions tucked away in a single options modal.</p>
            </div>

            <div className={styles.headerActions}>
              <Link href="/valuation" className={styles.secondaryButton}>
                Valuation
              </Link>

              <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
                Add manual asset
              </button>
            </div>
          </div>

          <div className={styles.summaryRow}>
            <div className={styles.summaryTile}>
              <span>Register value</span>
              <strong>{money(totalValue)}</strong>
            </div>

            <div className={styles.summaryTile}>
              <span>Total assets</span>
              <strong>{assets.length}</strong>
            </div>

            <div className={styles.summaryTile}>
              <span>Equipment assets</span>
              <strong>{equipmentCount}</strong>
            </div>
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>Loading assets...</div>
          ) : assets.length ? (
            <div className={styles.assetList}>
              {assets.map((asset) => {
                const previewPhoto = asset.photos[0];
                const displayKind = kindLabel(isTractorAsset(asset) ? 'tractor' : asset.kind);
                const isLive = isTractorAsset(asset) && hasMarketplaceListingForAsset(String(asset.id));

                return (
                  <article className={styles.assetCard} key={asset.id}>
                    <div className={styles.assetHeader}>
                      <div className={styles.assetTitleBlock}>
                        <div className={styles.badgeRow}>
                          <span className={`${styles.badge} ${styles.badgeNeutral}`}>{displayKind}</span>
                          <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                            {methodLabel(asset.selectedMethod)}
                          </span>
                          {asset.valuationRunId ? (
                            <span className={`${styles.badge} ${styles.badgeNeutral}`}>Saved valuation</span>
                          ) : null}
                          {isLive ? (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`}>Live on marketplace</span>
                          ) : null}
                          {asset.photos.length ? (
                            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                              {asset.photos.length} photo{asset.photos.length === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>

                        <h2>{asset.title}</h2>
                        <p>{buildAssetMeta(asset)}</p>
                      </div>

                      <div className={styles.valueBlock}>
                        <small>Register value</small>
                        <strong>{money(asset.value)}</strong>
                        <span>Excl. VAT • {formatDate(asset.createdAtIso)}</span>
                      </div>
                    </div>

                    <div className={styles.assetBody}>
                      <div className={styles.previewWrap}>
                        {previewPhoto ? (
                          <img
                            src={previewPhoto}
                            alt={`${asset.title} preview`}
                            className={styles.previewImage}
                          />
                        ) : (
                          <div className={styles.previewFallback}>No photo</div>
                        )}
                      </div>

                      <div className={styles.assetContent}>
                        <div className={styles.infoGrid}>
                          <div className={styles.infoTile}>
                            <span>Serial</span>
                            <strong>{asset.serialNumber || '—'}</strong>
                          </div>

                          <div className={styles.infoTile}>
                            <span>Finance</span>
                            <strong>{asset.isFinanced ? 'Financed' : 'Not financed'}</strong>
                          </div>

                          <div className={styles.infoTile}>
                            <span>Hours</span>
                            <strong>{asset.hours ? asset.hours.toLocaleString('en-ZA') : '—'}</strong>
                          </div>

                          <div className={styles.infoTile}>
                            <span>Saved</span>
                            <strong>{formatDate(asset.createdAtIso)}</strong>
                          </div>
                        </div>

                        {asset.note ? <p className={styles.note}>{asset.note}</p> : null}
                        {asset.financeNote ? <p className={styles.note}>Finance: {asset.financeNote}</p> : null}

                        <div className={styles.assetFooter}>
                          <button
                            type="button"
                            className={styles.optionsButton}
                            onClick={() => openActionDialog(asset)}
                          >
                            Options
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>No assets saved yet</h3>
              <p>Run a valuation or add a manual asset to start your register.</p>
            </div>
          )}
        </section>
      </section>

      {isAssetModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAssetModal} />

          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-form-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>
                  {editingAsset ? 'Edit asset' : 'Add manual asset'}
                </span>
                <h3 id="asset-form-title">
                  {editingAsset ? 'Update asset details' : 'Add another asset'}
                </h3>
                <p>
                  {editingAsset
                    ? 'Update the saved asset without cluttering the register screen.'
                    : 'Add a manual asset through a modal, so the main asset register stays clean.'}
                </p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAssetModal}
                aria-label="Close asset form"
              >
                ×
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAssetSubmit}>
              <label className={styles.field}>
                <span>Asset type</span>
                <select
                  value={editingAsset?.valuationRunId ? editingAsset.kind : assetDraft.kind}
                  disabled={Boolean(editingAsset?.valuationRunId)}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      kind: event.target.value as AssetKind,
                    }))
                  }
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
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Example: Main workshop"
                />
              </label>

              <label className={styles.field}>
                <span>Value</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={assetDraft.value}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </label>

              <label className={styles.field}>
                <span>Serial / reference</span>
                <input
                  value={assetDraft.serialNumber}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      serialNumber: event.target.value,
                    }))
                  }
                  placeholder="Serial number or internal reference"
                />
              </label>

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Notes</span>
                <textarea
                  rows={4}
                  value={assetDraft.note}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Extra details about the asset"
                />
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={assetDraft.isFinanced}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      isFinanced: event.target.checked,
                    }))
                  }
                />
                <span>This asset is financed</span>
              </label>

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Finance note</span>
                <input
                  value={assetDraft.financeNote}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      financeNote: event.target.value,
                    }))
                  }
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

                  <div className={styles.uploadRow}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhotos || assetDraft.photos.length >= MAX_PHOTOS}
                    >
                      {isUploadingPhotos ? 'Uploading...' : 'Choose image files'}
                    </button>

                    <span className={styles.uploadCount}>
                      {assetDraft.photos.length} / {MAX_PHOTOS} photos
                    </span>
                  </div>
                </div>
              </div>

              {assetDraft.photos.length ? (
                <div className={styles.photoGrid}>
                  {assetDraft.photos.map((photo, index) => (
                    <div className={styles.photoThumb} key={`${photo}-${index}`}>
                      <img src={photo} alt={`Asset photo ${index + 1}`} />
                      <button
                        type="button"
                        className={styles.photoRemoveButton}
                        onClick={() => removeDraftPhoto(photo)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSavingAsset || isUploadingPhotos}
                >
                  {isSavingAsset ? 'Saving...' : editingAsset ? 'Update asset' : 'Add asset'}
                </button>

                <button type="button" className={styles.secondaryButton} onClick={closeAssetModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeAsset ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeActionDialog} />

          <div
            className={styles.optionsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-options-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Asset options</span>
                <h3 id="asset-options-title">{activeAsset.title}</h3>
                <p>{buildAssetMeta(activeAsset)}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeActionDialog}
                aria-label="Close asset options"
              >
                ×
              </button>
            </div>

            <div className={styles.optionsMeta}>
              <div className={styles.optionMetaTile}>
                <span>Value</span>
                <strong>{money(activeAsset.value)}</strong>
              </div>

              <div className={styles.optionMetaTile}>
                <span>Status</span>
                <strong>{assetStatusDateLabel(activeAsset)}</strong>
              </div>
            </div>

            <div className={styles.optionsGrid}>
              <button
                type="button"
                className={styles.optionActionButton}
                onClick={() => handleOpenEditorFromDialog(activeAsset)}
              >
                Edit asset
              </button>

              <button
                type="button"
                className={styles.optionActionButton}
                onClick={() => handlePrintAssetSheet(activeAsset)}
              >
                Asset sheet PDF
              </button>

              {isTractorAsset(activeAsset) ? (
                <button
                  type="button"
                  className={styles.optionActionButton}
                  onClick={() => handlePublishFromDialog(activeAsset)}
                >
                  {hasMarketplaceListingForAsset(String(activeAsset.id))
                    ? 'Update marketplace'
                    : 'Send to marketplace'}
                </button>
              ) : null}

              <button
                type="button"
                className={`${styles.optionActionButton} ${styles.optionDangerButton}`}
                disabled={busyDeleteId === activeAsset.id}
                onClick={() => handleDeleteFromDialog(activeAsset)}
              >
                {busyDeleteId === activeAsset.id ? 'Removing...' : 'Delete asset'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
