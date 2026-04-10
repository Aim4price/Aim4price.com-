'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  clearItems,
  deleteItem,
  loadItems,
  saveItem,
  type SavedItem,
  type SavedItemKind,
  type SavedItemMethod,
} from '../../lib/register';
import {
  clearPublishedMarketplaceListings,
  loadPublishedMarketplaceListings,
  publishRegisterItemToMarketplace,
  removeMarketplaceListing,
  type MarketplaceListing,
} from '../../lib/marketplace';
import { money } from '../../lib/tractor-logic';

type NoticeTone = 'success' | 'error';
type AssetFilter = 'all' | 'tractor' | 'manual' | 'property' | 'live';
type EditorMode = 'add' | 'edit';

type RegisterAsset = SavedItem;

type AssetDraft = {
  kind: SavedItemKind;
  title: string;
  value: string;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  financeNote: string;
  photos: string[];
};

const MAX_PHOTOS = 8;

function createAssetDraft(kind: SavedItemKind = 'manual'): AssetDraft {
  return {
    kind,
    title: '',
    value: '',
    note: '',
    serialNumber: '',
    isFinanced: false,
    financeNote: '',
    photos: [],
  };
}

function parseMoney(value: string): number {
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function formatMoney(value: number): string {
  try {
    return money(value);
  } catch {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
}

function methodLabel(value?: SavedItemMethod): string {
  return (
    {
      aim4price: 'Aim4price',
      market: 'Market',
      department: 'Department',
      manual: 'Manual Override',
    }[value ?? 'manual'] ?? 'Manual Override'
  );
}

function typeShortLabel(value: SavedItemKind): string {
  return (
    {
      tractor: 'Equipment',
      manual: 'Manual',
      property: 'Property',
    }[value] ?? 'Manual'
  );
}

function filterLabel(value: AssetFilter): string {
  return (
    {
      all: 'All Assets',
      tractor: 'Equipment',
      property: 'Property',
      manual: 'Manual Assets',
      live: 'Marketplace Live',
    }[value] ?? 'All Assets'
  );
}

function normaliseRegisterItem(item: SavedItem): RegisterAsset {
  return {
    ...item,
    value: Number(item.value ?? item.selectedValueExVat ?? 0),
    selectedMethod: item.selectedMethod ?? item.method ?? 'manual',
    method: item.method ?? item.selectedMethod ?? 'manual',
    createdAtIso: item.createdAtIso ?? new Date().toISOString(),
    updatedAtIso: item.updatedAtIso ?? item.createdAtIso ?? new Date().toISOString(),
    isFinanced: Boolean(item.isFinanced),
    photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : [],
  };
}

function formatItemMeta(item: RegisterAsset): string {
  if (item.kind !== 'tractor') {
    return item.note || 'Added manually to the register';
  }

  const parts = [
    item.brandName,
    item.modelName,
    item.yearModel ? String(item.yearModel) : undefined,
  ];

  if (item.hours) {
    parts.push(`${item.hours.toLocaleString('en-ZA')} hours`);
  }

  return parts.filter(Boolean).join(' · ') || 'Saved from valuation';
}

function formatDateLabel(value?: string): string {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function timeAgo(value?: string): string {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  const elapsed = Date.now() - parsed.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < hour) {
    const minutes = Math.max(1, Math.round(elapsed / minute));
    return `${minutes} min ago`;
  }

  if (elapsed < day) {
    const hours = Math.max(1, Math.round(elapsed / hour));
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.max(1, Math.round(elapsed / day));
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function matchesSearch(item: RegisterAsset, query: string): boolean {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  const haystack = [
    item.title,
    item.brandName,
    item.modelName,
    item.note,
    item.kind,
    item.tractorType,
    item.drive,
    item.serialNumber,
    item.financeNote,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

async function filesToDataUrls(files: FileList | null): Promise<string[]> {
  if (!files?.length) {
    return [];
  }

  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
              return;
            }

            reject(new Error('Could not read the image.'));
          };

          reader.onerror = () => reject(new Error('Could not read the image.'));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function getListingId(listing: MarketplaceListing): string {
  return listing.id;
}

function getListingAssetId(listing: MarketplaceListing): string | undefined {
  const record = listing as MarketplaceListing & Record<string, unknown>;
  const candidates = [
    listing.sourceAssetId,
    record.registerItemId,
    record.assetId,
    record.itemId,
    record.savedItemId,
    record.sourceId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return undefined;
}

function assetDetails(item: RegisterAsset, isLive: boolean) {
  const base = [
    { label: 'Serial', value: item.serialNumber || '—' },
    { label: 'Finance', value: item.isFinanced ? 'Financed' : 'Not financed' },
    { label: 'Photos', value: String(item.photos?.length ?? 0) },
    { label: 'Marketplace', value: isLive ? 'Live' : 'Not live' },
  ];

  if (item.kind !== 'tractor') {
    return [
      ...base,
      { label: 'Type', value: typeShortLabel(item.kind) },
      { label: 'Added', value: formatDateLabel(item.createdAtIso) },
    ];
  }

  return [
    ...base,
    { label: 'Brand', value: item.brandName || '—' },
    { label: 'Model', value: item.modelName || '—' },
    { label: 'Year', value: item.yearModel ? String(item.yearModel) : '—' },
    {
      label: 'Hours',
      value: typeof item.hours === 'number' ? item.hours.toLocaleString('en-ZA') : '—',
    },
    { label: 'Drive', value: item.drive || '—' },
    {
      label: 'Cab',
      value: item.cab === 'open-station' ? 'Open station' : item.cab === 'cab' ? 'Cab' : '—',
    },
    { label: 'Added', value: formatDateLabel(item.createdAtIso) },
  ];
}

export default function AssetRegisterPage() {
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetDraft>(createAssetDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);

  const refreshData = async () => {
    const loadedItems = await Promise.resolve(loadItems());
    const loadedListings = await Promise.resolve(loadPublishedMarketplaceListings());

    setAssets((loadedItems ?? []).map(normaliseRegisterItem));
    setListings(Array.isArray(loadedListings) ? loadedListings : []);
  };

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const liveAssetIds = useMemo(() => {
    return new Set(
      listings
        .map((listing) => getListingAssetId(listing))
        .filter((value): value is string => Boolean(value)),
    );
  }, [listings]);

  const filteredAssets = useMemo(() => {
    return assets.filter((item) => {
      if (!matchesSearch(item, searchQuery)) {
        return false;
      }

      if (filter === 'all') {
        return true;
      }

      if (filter === 'live') {
        return liveAssetIds.has(item.id);
      }

      return item.kind === filter;
    });
  }, [assets, filter, liveAssetIds, searchQuery]);

  const totalValue = useMemo(() => {
    return assets.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  }, [assets]);

  const liveCount = useMemo(() => {
    return assets.filter((item) => liveAssetIds.has(item.id)).length;
  }, [assets, liveAssetIds]);

  const filterCounts = useMemo(() => {
    return {
      all: assets.length,
      tractor: assets.filter((item) => item.kind === 'tractor').length,
      manual: assets.filter((item) => item.kind === 'manual').length,
      property: assets.filter((item) => item.kind === 'property').length,
      live: liveCount,
    };
  }, [assets, liveCount]);

  const resetEditor = () => {
    setDraft(createAssetDraft());
    setEditorMode('add');
    setEditingId(null);
  };

  const handleDraftChange = <K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const urls = await filesToDataUrls(event.target.files);
      setDraft((current) => ({
        ...current,
        photos: [...current.photos, ...urls].slice(0, MAX_PHOTOS),
      }));
      event.target.value = '';
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not add the photos.',
      });
    }
  };

  const handleRemovePhoto = (index: number) => {
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleEdit = (item: RegisterAsset) => {
    setEditorMode('edit');
    setEditingId(item.id);
    setDraft({
      kind: item.kind,
      title: item.title,
      value: item.value ? String(item.value) : '',
      note: item.note ?? '',
      serialNumber: item.serialNumber ?? '',
      isFinanced: Boolean(item.isFinanced),
      financeNote: item.financeNote ?? '',
      photos: item.photos ?? [],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const existing = assets.find((item) => item.id === editingId);
      const nowIso = new Date().toISOString();
      const parsedValue = parseMoney(draft.value);

      const nextItem = normaliseRegisterItem({
        ...(existing ?? {
          id: `asset-${Date.now()}`,
          selectedMethod: 'manual',
          selectedValueExVat: parsedValue,
          value: parsedValue,
          createdAtIso: nowIso,
        }),
        kind: draft.kind,
        title: draft.title.trim(),
        value: parsedValue,
        selectedMethod: existing?.selectedMethod ?? 'manual',
        method: existing?.method ?? existing?.selectedMethod ?? 'manual',
        selectedValueExVat: parsedValue,
        note: draft.note.trim(),
        serialNumber: draft.serialNumber.trim(),
        isFinanced: draft.isFinanced,
        financeNote: draft.financeNote.trim(),
        photos: draft.photos,
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso,
      });

      await Promise.resolve(saveItem(nextItem));
      await refreshData();
      resetEditor();

      setNotice({
        tone: 'success',
        message: existing ? 'Asset updated successfully.' : 'Asset added to your register.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save the asset.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: RegisterAsset) => {
    const approved = window.confirm(`Delete “${item.title || 'this asset'}” from the register?`);

    if (!approved) {
      return;
    }

    try {
      setBusyAssetId(item.id);
      const linkedListing = listings.find((listing) => getListingAssetId(listing) === item.id);
      if (linkedListing) {
        await Promise.resolve(removeMarketplaceListing(getListingId(linkedListing)));
      }
      await Promise.resolve(deleteItem(item.id));
      await refreshData();
      setNotice({ tone: 'success', message: 'Asset removed from the register.' });

      if (editingId === item.id) {
        resetEditor();
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not delete the asset.',
      });
    } finally {
      setBusyAssetId(null);
    }
  };

  const handleClearAll = async () => {
    const approved = window.confirm('Clear the entire asset register? This will also remove locally published marketplace items.');

    if (!approved) {
      return;
    }

    try {
      setBusyAssetId('all');
      await Promise.resolve(clearItems());
      await Promise.resolve(clearPublishedMarketplaceListings());
      await refreshData();
      resetEditor();
      setNotice({ tone: 'success', message: 'The asset register was cleared.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not clear the register.',
      });
    } finally {
      setBusyAssetId(null);
    }
  };

  const handlePublish = async (item: RegisterAsset) => {
    try {
      setBusyAssetId(item.id);
      await Promise.resolve(
        publishRegisterItemToMarketplace(item, {
          askingPriceExVat: Number(item.value ?? item.selectedValueExVat ?? 0),
          description: item.marketplaceNotes || item.note,
          sellerPhone: item.sellerPhone,
          imageSrc: item.photos?.[0],
          imageUrls: item.photos,
        }),
      );
      await refreshData();
      setNotice({ tone: 'success', message: 'Asset published to marketplace.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not publish the asset.',
      });
    } finally {
      setBusyAssetId(null);
    }
  };

  const handleUnpublish = async (item: RegisterAsset) => {
    const linkedListing = listings.find((listing) => getListingAssetId(listing) === item.id);
    const listingId = linkedListing ? getListingId(linkedListing) : undefined;

    if (!listingId) {
      setNotice({ tone: 'error', message: 'Could not locate the marketplace listing.' });
      return;
    }

    try {
      setBusyAssetId(item.id);
      await Promise.resolve(removeMarketplaceListing(listingId));
      await refreshData();
      setNotice({ tone: 'success', message: 'Marketplace listing removed.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not remove the listing.',
      });
    } finally {
      setBusyAssetId(null);
    }
  };

  return (
    <div className={styles.page}>
      <AppHeader active="asset-register" />

      <main className={styles.content}>
        <section className={styles.heroShell}>
          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>Asset Register</span>
              <h1>Keep every asset in one clean working register.</h1>
              <p>
                Track values, save important notes, keep finance references together, and move selected
                assets into the marketplace when you are ready.
              </p>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span>Total assets</span>
                <strong>{assets.length}</strong>
              </div>
              <div className={styles.heroStat}>
                <span>Register value</span>
                <strong>{formatMoney(totalValue)}</strong>
              </div>
              <div className={styles.heroStat}>
                <span>Marketplace live</span>
                <strong>{liveCount}</strong>
              </div>
            </div>
          </div>

          {notice ? (
            <div
              className={`${styles.notice} ${
                notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError
              }`}
            >
              {notice.message}
            </div>
          ) : null}
        </section>

        <section className={styles.dashboard}>
          <div className={styles.mainColumn}>
            <section className={`${styles.surface} ${styles.controlSurface}`}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.eyebrow}>Register editor</span>
                  <h2>{editorMode === 'edit' ? 'Edit asset' : 'Add asset'}</h2>
                  <p>
                    Save manual assets, property, or equipment records. You can update values at any time.
                  </p>
                </div>

                <div className={styles.panelActions}>
                  <button className={styles.ghostButton} type="button" onClick={resetEditor}>
                    Reset form
                  </button>
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={handleClearAll}
                    disabled={busyAssetId === 'all' || assets.length === 0}
                  >
                    Clear register
                  </button>
                </div>
              </div>

              <form className={styles.formGrid} onSubmit={handleSubmit}>
                <label>
                  <span>Asset type</span>
                  <select
                    value={draft.kind}
                    onChange={(event) => handleDraftChange('kind', event.target.value as SavedItemKind)}
                  >
                    <option value="manual">Manual asset</option>
                    <option value="tractor">Equipment</option>
                    <option value="property">Property</option>
                  </select>
                </label>

                <label>
                  <span>Title</span>
                  <input
                    value={draft.title}
                    onChange={(event) => handleDraftChange('title', event.target.value)}
                    placeholder="Example: John Deere 6155M / Main workshop / Baler stock"
                    required
                  />
                </label>

                <label>
                  <span>Value</span>
                  <input
                    inputMode="decimal"
                    value={draft.value}
                    onChange={(event) => handleDraftChange('value', event.target.value)}
                    placeholder="850000"
                  />
                </label>

                <label>
                  <span>Serial / reference</span>
                  <input
                    value={draft.serialNumber}
                    onChange={(event) => handleDraftChange('serialNumber', event.target.value)}
                    placeholder="Serial number, unit reference, internal code"
                  />
                </label>

                <label className={styles.fullWidth}>
                  <span>Notes</span>
                  <textarea
                    value={draft.note}
                    onChange={(event) => handleDraftChange('note', event.target.value)}
                    placeholder="Important condition notes, attachments, ownership detail, usage, or sale notes"
                  />
                </label>

                <label className={styles.checkboxRow}>
                  <input
                    checked={draft.isFinanced}
                    onChange={(event) => handleDraftChange('isFinanced', event.target.checked)}
                    type="checkbox"
                  />
                  <span>Asset is financed</span>
                </label>

                <label className={styles.fullWidth}>
                  <span>Finance note</span>
                  <input
                    value={draft.financeNote}
                    onChange={(event) => handleDraftChange('financeNote', event.target.value)}
                    placeholder="Bank, agreement note, outstanding balance reference"
                  />
                </label>

                <label className={styles.fullWidth}>
                  <span>Photos</span>
                  <input accept="image/*" multiple onChange={handlePhotoChange} type="file" />
                </label>

                {draft.photos.length ? (
                  <div className={`${styles.photoStrip} ${styles.fullWidth}`}>
                    {draft.photos.map((photo, index) => (
                      <div className={styles.photoThumb} key={`${photo.slice(0, 20)}-${index}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={`Asset photo ${index + 1}`} src={photo} />
                        <button
                          className={styles.removePhotoButton}
                          onClick={() => handleRemovePhoto(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className={`${styles.modalActions} ${styles.fullWidth}`}>
                  <button className={styles.primaryButton} disabled={isSaving} type="submit">
                    {isSaving ? 'Saving...' : editorMode === 'edit' ? 'Save changes' : 'Add to register'}
                  </button>
                </div>
              </form>
            </section>

            <section className={`${styles.surface} ${styles.listSurface}`}>
              <div className={styles.sectionRow}>
                <div>
                  <span className={styles.eyebrow}>Register assets</span>
                  <h2>{filterLabel(filter)}</h2>
                  <p>Search, filter, edit, remove, or publish assets from a single place.</p>
                </div>

                <div className={styles.panelActions}>
                  <Link className={styles.secondaryButton} href="/valuation">
                    Open valuation
                  </Link>
                  <Link className={styles.secondaryButton} href="/marketplace">
                    Open marketplace
                  </Link>
                </div>
              </div>

              <div className={styles.filterBar}>
                <label className={styles.searchField}>
                  <span>Search assets</span>
                  <input
                    placeholder="Search by title, brand, model, note, serial, drive or finance note"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>

                <div className={styles.filterChips}>
                  {(
                    [
                      ['all', filterCounts.all],
                      ['tractor', filterCounts.tractor],
                      ['manual', filterCounts.manual],
                      ['property', filterCounts.property],
                      ['live', filterCounts.live],
                    ] as Array<[AssetFilter, number]>
                  ).map(([value, count]) => (
                    <button
                      key={value}
                      className={`${styles.filterChip} ${filter === value ? styles.filterChipActive : ''}`}
                      onClick={() => setFilter(value)}
                      type="button"
                    >
                      <span>{filterLabel(value)}</span>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.assetGrid}>
                {filteredAssets.length ? (
                  filteredAssets.map((item) => {
                    const isLive = liveAssetIds.has(item.id);
                    const isBusy = busyAssetId === item.id;

                    return (
                      <article className={styles.assetCard} key={item.id}>
                        <div className={styles.assetTop}>
                          <div>
                            <div className={styles.badgeRow}>
                              <span className={styles.badge}>{typeShortLabel(item.kind)}</span>
                              <span className={styles.badge}>{methodLabel(item.method ?? item.selectedMethod)}</span>
                              {isLive ? <span className={styles.liveBadge}>Marketplace live</span> : null}
                            </div>
                            <h3 className={styles.assetTitle}>{item.title || 'Untitled asset'}</h3>
                            <p className={styles.assetMeta}>{formatItemMeta(item)}</p>
                          </div>

                          <div className={styles.priceRow}>
                            <span className={styles.valueLabel}>Value</span>
                            <strong>{formatMoney(Number(item.value ?? 0))}</strong>
                            <small>Updated {timeAgo(item.updatedAtIso || item.createdAtIso)}</small>
                          </div>
                        </div>

                        {item.photos?.length ? (
                          <div className={styles.photoStrip}>
                            {item.photos.map((photo, index) => (
                              <div className={styles.photoThumb} key={`${photo.slice(0, 20)}-${index}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img alt={`Saved asset ${index + 1}`} src={photo} />
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className={styles.detailsGrid}>
                          {assetDetails(item, isLive).map((detail) => (
                            <div className={styles.detailItem} key={`${item.id}-${detail.label}`}>
                              <span className={styles.detailLabel}>{detail.label}</span>
                              <strong className={styles.detailValue}>{detail.value}</strong>
                            </div>
                          ))}
                        </div>

                        {item.note ? <p className={styles.noteText}>{item.note}</p> : null}

                        <div className={styles.cardActions}>
                          <button className={styles.ghostButton} onClick={() => handleEdit(item)} type="button">
                            Edit
                          </button>

                          {item.kind === 'tractor' ? (
                            isLive ? (
                              <button
                                className={styles.secondaryButton}
                                disabled={isBusy}
                                onClick={() => handleUnpublish(item)}
                                type="button"
                              >
                                {isBusy ? 'Working...' : 'Remove from marketplace'}
                              </button>
                            ) : (
                              <button
                                className={styles.primaryInlineButton}
                                disabled={isBusy}
                                onClick={() => handlePublish(item)}
                                type="button"
                              >
                                {isBusy ? 'Working...' : 'Publish to marketplace'}
                              </button>
                            )
                          ) : null}

                          <button
                            className={styles.dangerButton}
                            disabled={isBusy}
                            onClick={() => handleDelete(item)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>
                    <h3>No assets found</h3>
                    <p>Try another search term or filter, or add your first asset to the register.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className={styles.rail}>
            <section className={`${styles.surface} ${styles.summarySurface}`}>
              <div className={styles.summaryTop}>
                <span className={styles.summaryLabel}>Register summary</span>
                <h2>Keep the high-level numbers visible.</h2>
                <p>Use this view to understand value concentration and what is already live to market.</p>
              </div>

              <div className={styles.summaryCards}>
                <div className={styles.summaryCard}>
                  <span>Total register value</span>
                  <strong>{formatMoney(totalValue)}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Equipment assets</span>
                  <strong>{filterCounts.tractor}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Manual + property assets</span>
                  <strong>{filterCounts.manual + filterCounts.property}</strong>
                </div>
              </div>
            </section>

            <section className={`${styles.surface} ${styles.quickSurface}`}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.eyebrow}>Quick links</span>
                  <h2>Move faster</h2>
                  <p>Jump straight to the pages most often used with the register.</p>
                </div>
              </div>

              <div className={styles.quickLinks}>
                <Link className={styles.quickLink} href="/valuation">
                  Start valuation
                </Link>
                <Link className={styles.quickButton} href="/marketplace">
                  Open marketplace
                </Link>
                <Link className={styles.quickButton} href="/">
                  Back to home
                </Link>
              </div>
            </section>

            <section className={`${styles.surface} ${styles.quickSurface}`}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.eyebrow}>Live register feed</span>
                  <h2>Recently updated</h2>
                  <p>Quick scan of the newest assets in the register.</p>
                </div>
              </div>

              <div className={styles.liveList}>
                {assets
                  .slice()
                  .sort((a, b) => {
                    const aTime = new Date(a.updatedAtIso || a.createdAtIso || 0).getTime();
                    const bTime = new Date(b.updatedAtIso || b.createdAtIso || 0).getTime();
                    return bTime - aTime;
                  })
                  .slice(0, 5)
                  .map((item) => (
                    <div className={styles.liveStrip} key={`recent-${item.id}`}>
                      <strong>{item.title || 'Untitled asset'}</strong>
                      <span>{formatMoney(Number(item.value ?? 0))}</span>
                      <small className={styles.liveMeta}>{timeAgo(item.updatedAtIso || item.createdAtIso)}</small>
                    </div>
                  ))}

                {assets.length === 0 ? (
                  <div className={styles.emptyState}>
                    <h3>No recent activity</h3>
                    <p>Your saved assets will start appearing here once you add them.</p>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
