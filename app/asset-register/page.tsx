'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
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
  loadPublishedMarketplaceListings,
  publishRegisterItemToMarketplace,
  removeMarketplaceListing,
  type MarketplaceListing,
} from '../../lib/marketplace';
import { money } from '../../lib/tractor-logic';

type NoticeTone = 'success' | 'error';
type AssetFilter = 'all' | 'tractor' | 'manual' | 'property' | 'live';

const DEFAULT_MARKETPLACE_SELLER = 'Aim4price Seller';
const DEFAULT_MARKETPLACE_AREA = 'Seller Location';
const DEFAULT_MARKETPLACE_PROVINCE = 'South Africa';

function parseMoney(value: string): number {
  return Number(String(value).replace(/[^0-9.]/g, ''));
}

function methodLabel(value: SavedItemMethod): string {
  return (
    {
      aim4price: 'Aim4price',
      market: 'Market',
      department: 'Department',
      manual: 'Manual Override',
    }[value] ?? 'Manual Override'
  );
}

function typeLabel(value: SavedItemKind): string {
  return (
    {
      tractor: 'Equipment',
      manual: 'Manual Asset',
      property: 'Property',
    }[value] ?? 'Manual Asset'
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

function formatItemMeta(item: SavedItem): string {
  if (item.kind !== 'tractor') {
    return item.note || 'Added manually to the register';
  }

  const parts = [item.brandName, item.modelName, item.yearModel ? String(item.yearModel) : undefined];

  if (item.hours) {
    parts.push(`${item.hours.toLocaleString('en-ZA')} hours`);
  }

  return parts.filter(Boolean).join(' · ') || 'Saved from valuation';
}

function formatDateLabel(value: string): string {
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

function timeAgo(value: string): string {
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

function matchesSearch(item: SavedItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    item.title,
    item.brandName,
    item.modelName,
    item.note,
    item.kind,
    item.tractorType,
    item.drive,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
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

export default function RegisterPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [publishedListings, setPublishedListings] = useState<MarketplaceListing[]>([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<NoticeTone>('success');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AssetFilter>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKind, setNewKind] = useState<SavedItemKind>('manual');
  const [newTitle, setNewTitle] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newNote, setNewNote] = useState('');

  const [overrideItem, setOverrideItem] = useState<SavedItem | null>(null);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideNote, setOverrideNote] = useState('');

  const [sellItem, setSellItem] = useState<SavedItem | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellNotes, setSellNotes] = useState('');
  const [sellPhone, setSellPhone] = useState('');

  const [deleteItemState, setDeleteItemState] = useState<SavedItem | null>(null);
  const [isClearOpen, setIsClearOpen] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const publishedAssetIds = useMemo(() => {
    return new Set(
      publishedListings
        .map((listing) => listing.sourceAssetId)
        .filter((value): value is string => Boolean(value)),
    );
  }, [publishedListings]);

  const summary = useMemo(() => {
    const tractors = items.filter((item) => item.kind === 'tractor').length;
    const properties = items.filter((item) => item.kind === 'property').length;
    const manualAssets = items.filter((item) => item.kind === 'manual').length;
    const liveListings = items.filter((item) => publishedAssetIds.has(item.id)).length;

    return {
      totalAssets: items.length,
      tractors,
      properties,
      manualAssets,
      liveListings,
    };
  }, [items, publishedAssetIds]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!matchesSearch(item, search)) return false;

      if (filter === 'all') return true;
      if (filter === 'live') return publishedAssetIds.has(item.id);
      return item.kind === filter;
    });
  }, [filter, items, publishedAssetIds, search]);

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.selectedValueExVat || 0), 0);
  }, [items]);

  const filterOptions: { key: AssetFilter; count: number }[] = useMemo(
    () => [
      { key: 'all', count: summary.totalAssets },
      { key: 'tractor', count: summary.tractors },
      { key: 'property', count: summary.properties },
      { key: 'manual', count: summary.manualAssets },
      { key: 'live', count: summary.liveListings },
    ],
    [summary],
  );

  function refresh() {
    setItems(loadItems());
    setPublishedListings(
      loadPublishedMarketplaceListings().filter((listing) => listing.publishedBy === 'asset-register'),
    );
  }

  function setNotice(text: string, tone: NoticeTone = 'success') {
    setMessage(text);
    setMessageTone(tone);
  }

  function closeAddModal() {
    setIsAddOpen(false);
    setNewKind('manual');
    setNewTitle('');
    setNewValue('');
    setNewNote('');
  }

  function openOverrideModal(item: SavedItem) {
    setOverrideItem(item);
    setOverrideValue(String(Math.round(item.selectedValueExVat || 0)));
    setOverrideNote(item.note ?? '');
  }

  function closeOverrideModal() {
    setOverrideItem(null);
    setOverrideValue('');
    setOverrideNote('');
  }

  function openSellModal(item: SavedItem) {
    if (item.kind !== 'tractor') {
      setNotice('Only valuation equipment can be sent to marketplace.', 'error');
      return;
    }

    setSellItem(item);
    setSellPrice(String(Math.round(item.selectedValueExVat || 0)));
    setSellNotes(item.note ?? '');
    setSellPhone('');
  }

  function closeSellModal() {
    setSellItem(null);
    setSellPrice('');
    setSellNotes('');
    setSellPhone('');
  }

  function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseMoney(newValue);

    if (!newTitle.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setNotice('Give the asset a title and a value greater than zero.', 'error');
      return;
    }

    saveItem({
      id: `${newKind}-${Date.now()}-${newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      kind: newKind,
      title: newTitle.trim(),
      selectedMethod: 'manual',
      selectedValueExVat: Math.round(parsed),
      note: newNote.trim() || (newKind === 'property' ? 'Property asset' : 'Manual asset'),
      createdAtIso: new Date().toISOString(),
    });

    refresh();
    closeAddModal();
    setNotice(`${newTitle.trim()} added to the register.`);
  }

  function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!overrideItem) {
      return;
    }

    const parsed = parseMoney(overrideValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setNotice('Enter a valid override value greater than zero.', 'error');
      return;
    }

    saveItem({
      ...overrideItem,
      selectedMethod: 'manual',
      selectedValueExVat: Math.round(parsed),
      note: overrideNote.trim() || overrideItem.note,
    });

    refresh();
    closeOverrideModal();
    setNotice(`${overrideItem.title} updated.`);
  }

  function submitSell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sellItem) {
      return;
    }

    const askingPriceExVat = parseMoney(sellPrice);

    if (!Number.isFinite(askingPriceExVat) || askingPriceExVat <= 0) {
      setNotice('Enter a valid selling price greater than zero.', 'error');
      return;
    }

    if (!sellPhone.trim()) {
      setNotice('Primary contact number is required.', 'error');
      return;
    }

    try {
      publishRegisterItemToMarketplace(sellItem, {
        askingPriceExVat: Math.round(askingPriceExVat),
        description: sellNotes.trim() || undefined,
        sellerName: DEFAULT_MARKETPLACE_SELLER,
        sellerPhone: sellPhone.trim(),
        area: DEFAULT_MARKETPLACE_AREA,
        province: DEFAULT_MARKETPLACE_PROVINCE,
      });

      refresh();
      closeSellModal();
      setNotice(`${sellItem.title} sent to marketplace.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Unable to publish this asset to marketplace.',
        'error',
      );
    }
  }

  function confirmDelete() {
    if (!deleteItemState) {
      return;
    }

    deleteItem(deleteItemState.id);

    if (deleteItemState.kind === 'tractor') {
      removeMarketplaceListing(`market-${deleteItemState.id}`);
    }

    refresh();
    setNotice(`${deleteItemState.title} deleted.`);
    setDeleteItemState(null);
  }

  function confirmClear() {
    clearItems();
    refresh();
    setIsClearOpen(false);
    setNotice('Asset register cleared.');
  }

  function handleRefreshValue(item: SavedItem) {
    setNotice(`Wire “Refresh Value” for ${item.title} to rerun the saved valuation inputs.`);
  }

  function closeBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    closeAddModal();
    closeOverrideModal();
    closeSellModal();
    setDeleteItemState(null);
    setIsClearOpen(false);
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <div className={styles.content}>
        <section className={styles.heroShell}>
          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>Stored values and key assets</span>
              <h1>Asset Register</h1>
              <p>
                Keep equipment, property, and manual assets in one simple register. Save from
                valuation, update values when needed, and move the right machine to marketplace.
              </p>
            </div>

            <div className={styles.heroStats}>
              <article className={styles.heroStat}>
                <span>Portfolio value</span>
                <strong>{money(totalValue)}</strong>
              </article>
              <article className={styles.heroStat}>
                <span>Total assets</span>
                <strong>{summary.totalAssets}</strong>
              </article>
              <article className={styles.heroStat}>
                <span>Marketplace live</span>
                <strong>{summary.liveListings}</strong>
              </article>
            </div>
          </div>

          {message ? (
            <div
              className={`${styles.notice} ${
                messageTone === 'error' ? styles.noticeError : styles.noticeSuccess
              }`}
              role="status"
            >
              {message}
            </div>
          ) : null}
        </section>

        <section className={styles.dashboard}>
          <div className={styles.mainColumn}>
            <article className={`${styles.surface} ${styles.controlSurface}`}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.eyebrow}>My assets</span>
                  <h2>Saved assets</h2>
                  <p>
                    Search, filter, and manage saved assets without digging through clutter.
                  </p>
                </div>

                <div className={styles.panelActions}>
                  {items.length ? (
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={() => setIsClearOpen(true)}
                    >
                      Clear register
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => setIsAddOpen(true)}
                  >
                    + Add Asset
                  </button>
                </div>
              </div>

              <div className={styles.filterBar}>
                <label className={styles.searchField}>
                  <span>Search</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title, brand, model, note, or type..."
                  />
                </label>
              </div>

              <div className={styles.filterChips}>
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.filterChip} ${filter === option.key ? styles.filterChipActive : ''}`}
                    onClick={() => setFilter(option.key)}
                    aria-pressed={filter === option.key}
                  >
                    <span>{filterLabel(option.key)}</span>
                    <strong>{option.count}</strong>
                  </button>
                ))}
              </div>
            </article>

            <article className={`${styles.surface} ${styles.listSurface}`}>
              <div className={styles.sectionRow}>
                <div>
                  <span className={styles.eyebrow}>Register view</span>
                  <h2>{filterLabel(filter)}</h2>
                  <p>
                    {filteredItems.length} {filteredItems.length === 1 ? 'asset' : 'assets'} visible in
                    the current view.
                  </p>
                </div>
              </div>

              {filteredItems.length ? (
                <div className={styles.assetGrid}>
                  {filteredItems.map((item) => {
                    const isLive = publishedAssetIds.has(item.id);

                    return (
                      <article key={item.id} className={styles.assetCard}>
                        <div className={styles.assetTop}>
                          <div className={styles.assetIdentity}>
                            <div className={styles.assetBadges}>
                              <span className={styles.kindBadge}>{typeShortLabel(item.kind)}</span>
                              <span className={styles.methodBadge}>{methodLabel(item.selectedMethod)}</span>
                              {isLive ? (
                                <span className={`${styles.stateBadge} ${styles.stateBadgeLive}`}>
                                  Marketplace live
                                </span>
                              ) : null}
                            </div>

                            <h3>{item.title}</h3>
                            <p>{formatItemMeta(item)}</p>
                          </div>

                          <div className={styles.valuePanel}>
                            <span className={styles.valueLabel}>Current value</span>
                            <strong>{money(item.selectedValueExVat)}</strong>
                            <small>
                              Added {timeAgo(item.createdAtIso)} · {formatDateLabel(item.createdAtIso)}
                            </small>
                          </div>
                        </div>

                        <div className={styles.assetFooter}>
                          <div className={styles.assetHint}>
                            {item.kind === 'tractor'
                              ? 'Saved from valuation and ready for value refresh or marketplace publishing.'
                              : 'Manually tracked inside the same register for a single portfolio view.'}
                          </div>

                          <div className={styles.assetActions}>
                            {item.kind === 'tractor' ? (
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => handleRefreshValue(item)}
                              >
                                Refresh Value
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => openOverrideModal(item)}
                            >
                              Override Value
                            </button>

                            {item.kind === 'tractor' ? (
                              <button
                                type="button"
                                className={styles.primaryInlineButton}
                                onClick={() => openSellModal(item)}
                              >
                                {isLive ? 'Update Listing' : 'Send to Marketplace'}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className={styles.dangerButton}
                              onClick={() => setDeleteItemState(item)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <strong>No assets found.</strong>
                  <span>
                    Save equipment from Valuation, or add a manual asset such as a house, workshop,
                    trailer, or storeroom.
                  </span>
                </div>
              )}
            </article>
          </div>

          <aside className={styles.rail}>
            <article className={`${styles.surface} ${styles.summarySurface}`}>
              <div className={styles.summaryTop}>
                <span className={styles.summaryLabel}>Register overview</span>
                <strong>{money(totalValue)}</strong>
                <p>A single view across equipment, property, and manual assets.</p>
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span>Total assets</span>
                  <strong>{summary.totalAssets}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Equipment</span>
                  <strong>{summary.tractors}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Property</span>
                  <strong>{summary.properties}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Manual</span>
                  <strong>{summary.manualAssets}</strong>
                </div>
              </div>

              <div className={styles.liveStrip}>
                <div>
                  <span>Marketplace live</span>
                  <strong>{summary.liveListings} assets</strong>
                </div>
                <span className={styles.livePill}>Tracked</span>
              </div>
            </article>

            <article className={`${styles.surface} ${styles.quickSurface}`}>
              <div className={styles.sectionRow}>
                <div>
                  <span className={styles.eyebrow}>Quick actions</span>
                  <h2>Quick actions</h2>
                  <p>The most common register actions, kept close and easy to use.</p>
                </div>
              </div>

              <div className={styles.quickActions}>
                <Link href="/valuation" className={styles.quickLink}>
                  Save from Valuation
                </Link>

                <button type="button" className={styles.quickButton} onClick={() => setIsAddOpen(true)}>
                  Add Manual Asset
                </button>

                <button
                  type="button"
                  className={styles.quickButton}
                  onClick={() =>
                    setNotice('Wire “Refresh All Values” once the revaluation inputs are stored.')
                  }
                >
                  Refresh All Values
                </button>

                <button
                  type="button"
                  className={styles.quickButton}
                  onClick={() =>
                    setNotice('Connect this button to your PDF asset register export when ready.')
                  }
                >
                  Generate Asset Report
                </button>
              </div>
            </article>
          </aside>
        </section>
      </div>

      {isAddOpen ? (
        <div className={styles.modalBackdrop} onClick={closeBackdrop}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="add-asset-title">
            <div className={styles.modalHeader}>
              <div>
                <h3 id="add-asset-title">Add Asset</h3>
                <p>Add manual equipment, property, or another non-valuation asset.</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeAddModal}
                aria-label="Close add asset modal"
              >
                ×
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={submitAdd}>
              <label>
                <span>Asset type</span>
                <select value={newKind} onChange={(event) => setNewKind(event.target.value as SavedItemKind)}>
                  <option value="manual">Manual Asset</option>
                  <option value="property">Property / House</option>
                </select>
              </label>

              <label>
                <span>Title</span>
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder={newKind === 'property' ? 'Farm house' : 'Workshop trailer'}
                />
              </label>

              <label>
                <span>Value (VAT excluded)</span>
                <input
                  value={newValue}
                  onChange={(event) => setNewValue(event.target.value)}
                  inputMode="numeric"
                  placeholder="2500000"
                />
              </label>

              <label>
                <span>Notes</span>
                <textarea
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Optional notes about the asset"
                  rows={4}
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalSecondary} onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalPrimary}>
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {overrideItem ? (
        <div className={styles.modalBackdrop} onClick={closeBackdrop}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="override-title">
            <div className={styles.modalHeader}>
              <div>
                <h3 id="override-title">Override Value</h3>
                <p>{overrideItem.title}</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeOverrideModal}
                aria-label="Close override modal"
              >
                ×
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={submitOverride}>
              <label>
                <span>New register value</span>
                <input
                  value={overrideValue}
                  onChange={(event) => setOverrideValue(event.target.value)}
                  inputMode="numeric"
                  placeholder="845000"
                />
              </label>

              <label>
                <span>Notes</span>
                <textarea
                  value={overrideNote}
                  onChange={(event) => setOverrideNote(event.target.value)}
                  placeholder="Optional override note"
                  rows={4}
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalSecondary} onClick={closeOverrideModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalPrimary}>
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {sellItem ? (
        <div className={styles.modalBackdrop} onClick={closeBackdrop}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="sell-title">
            <div className={styles.modalHeader}>
              <div>
                <h3 id="sell-title">Send to Marketplace</h3>
                <p>{sellItem.title}</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeSellModal}
                aria-label="Close marketplace modal"
              >
                ×
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={submitSell}>
              <label>
                <span>What do you want to sell it for?</span>
                <input
                  value={sellPrice}
                  onChange={(event) => setSellPrice(event.target.value)}
                  inputMode="numeric"
                  placeholder="925000"
                />
              </label>

              <label>
                <span>Notes</span>
                <textarea
                  value={sellNotes}
                  onChange={(event) => setSellNotes(event.target.value)}
                  placeholder="Short selling notes for the listing"
                  rows={4}
                />
              </label>

              <label>
                <span>Primary contact number</span>
                <input
                  value={sellPhone}
                  onChange={(event) => setSellPhone(event.target.value)}
                  inputMode="tel"
                  placeholder="082 123 4567"
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalSecondary} onClick={closeSellModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalPrimary}>
                  {publishedAssetIds.has(sellItem.id) ? 'Update Listing' : 'Send to Marketplace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteItemState ? (
        <div className={styles.modalBackdrop} onClick={closeBackdrop}>
          <div className={styles.confirmCard} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">Delete asset?</h3>
            <p>
              Remove <strong>{deleteItemState.title}</strong> from the asset register.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalSecondary} onClick={() => setDeleteItemState(null)}>
                Cancel
              </button>
              <button type="button" className={styles.modalDanger} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isClearOpen ? (
        <div className={styles.modalBackdrop} onClick={closeBackdrop}>
          <div className={styles.confirmCard} role="dialog" aria-modal="true" aria-labelledby="clear-title">
            <h3 id="clear-title">Clear asset register?</h3>
            <p>This removes all saved assets from local storage in the current prototype.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalSecondary} onClick={() => setIsClearOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.modalDanger} onClick={confirmClear}>
                Clear register
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
