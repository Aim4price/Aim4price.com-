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

type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  atIso: string;
  tone: 'default' | 'success';
};

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

  const activity = useMemo<ActivityEntry[]>(() => {
    const addedEvents: ActivityEntry[] = items.map((item) => ({
      id: `added-${item.id}`,
      title: item.title,
      detail:
        item.kind === 'tractor'
          ? 'Saved from valuation into the register'
          : item.kind === 'property'
            ? 'Property asset added manually'
            : 'Manual asset added to the register',
      atIso: item.createdAtIso,
      tone: 'default',
    }));

    const listingEvents: ActivityEntry[] = publishedListings
      .filter((listing) => listing.sourceAssetId)
      .map((listing) => {
        const sourceItem = items.find((item) => item.id === listing.sourceAssetId);

        return {
          id: `published-${listing.id}`,
          title: sourceItem?.title ?? listing.title,
          detail: `Sent to marketplace at ${money(listing.askingPriceExVat)}`,
          atIso: listing.publishedAtIso,
          tone: 'success' as const,
        };
      });

    return [...listingEvents, ...addedEvents]
      .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
      .slice(0, 8);
  }, [items, publishedListings]);

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
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.kicker}>Stored equipment, property, and manual assets</span>
            <h1>Asset Register</h1>
            <p>
              Save valuation rows, add manual assets such as houses, override values anytime, and
              push tractors straight to marketplace when they are ready to sell.
            </p>
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
            <article className={styles.surface}>
              <div className={styles.panelTop}>
                <div>
                  <h2>My Assets</h2>
                  <p>
                    Each row can be refreshed, manually overridden, or sent to marketplace. Manual
                    assets and property stay fully editable in the same register.
                  </p>
                </div>

                <div className={styles.panelTopActions}>
                  {items.length ? (
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={() => setIsClearOpen(true)}
                    >
                      Clear register
                    </button>
                  ) : null}

                  <button type="button" className={styles.primaryButton} onClick={() => setIsAddOpen(true)}>
                    + Add Asset
                  </button>
                </div>
              </div>

              <div className={styles.toolbar}>
                <label className={styles.searchField}>
                  <span className={styles.searchLabel}>Search</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search assets, brands, models, or notes..."
                  />
                </label>

                <label className={styles.filterField}>
                  <span className={styles.searchLabel}>Filter</span>
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as AssetFilter)}
                  >
                    <option value="all">All Assets</option>
                    <option value="tractor">Equipment</option>
                    <option value="property">Property</option>
                    <option value="manual">Manual Assets</option>
                    <option value="live">Marketplace Live</option>
                  </select>
                </label>
              </div>

              <div className={styles.tableWrap}>
                <div className={styles.tableHead}>
                  <span>Asset</span>
                  <span>Type</span>
                  <span>Current Value</span>
                  <span>Last Added</span>
                  <span className={styles.actionsHead}>Actions</span>
                </div>

                {filteredItems.length ? (
                  filteredItems.map((item) => {
                    const isLive = publishedAssetIds.has(item.id);

                    return (
                      <div key={item.id} className={styles.row}>
                        <div className={styles.assetCell}>
                          <div className={styles.assetTitleLine}>
                            <strong>{item.title}</strong>
                            <span
                              className={`${styles.statusBadge} ${
                                isLive ? styles.statusLive : styles.statusIdle
                              }`}
                            >
                              {isLive
                                ? 'Marketplace live'
                                : item.kind === 'tractor'
                                  ? 'Ready to sell'
                                  : 'Manual entry'}
                            </span>
                          </div>
                          <span className={styles.assetMeta}>{formatItemMeta(item)}</span>
                        </div>

                        <div className={styles.typeCell}>
                          <span className={styles.typeBadge}>{typeLabel(item.kind)}</span>
                        </div>

                        <div className={styles.valueCell}>
                          <strong>{money(item.selectedValueExVat)}</strong>
                          <span className={styles.methodBadge}>{methodLabel(item.selectedMethod)}</span>
                        </div>

                        <div className={styles.dateCell}>
                          <strong>{timeAgo(item.createdAtIso)}</strong>
                          <span>{formatDateLabel(item.createdAtIso)}</span>
                        </div>

                        <div className={styles.rowActions}>
                          {item.kind === 'tractor' ? (
                            <button
                              type="button"
                              className={styles.inlineButton}
                              onClick={() => handleRefreshValue(item)}
                            >
                              Refresh Value
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className={styles.inlineButton}
                            onClick={() => openOverrideModal(item)}
                          >
                            Override Value
                          </button>

                          {item.kind === 'tractor' ? (
                            <button
                              type="button"
                              className={styles.inlineButtonPrimary}
                              onClick={() => openSellModal(item)}
                            >
                              {isLive ? 'Update Listing' : 'Sell'}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className={styles.inlineButtonDanger}
                            onClick={() => setDeleteItemState(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>
                    <strong>No assets found.</strong>
                    <span>
                      Save equipment from Valuation, or add a manual asset such as a house,
                      workshop, trailer, or store room.
                    </span>
                  </div>
                )}
              </div>
            </article>

            <article className={styles.surface}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Recent Activity</h2>
                  <p>The register should feel alive even before the full database logic is wired in.</p>
                </div>
              </div>

              <div className={styles.activityList}>
                {activity.length ? (
                  activity.map((entry) => (
                    <div key={entry.id} className={styles.activityItem}>
                      <div
                        className={`${styles.activityDot} ${
                          entry.tone === 'success' ? styles.activityDotSuccess : ''
                        }`}
                      />
                      <div className={styles.activityText}>
                        <strong>{entry.title}</strong>
                        <span>{entry.detail}</span>
                      </div>
                      <time className={styles.activityTime} dateTime={entry.atIso}>
                        {timeAgo(entry.atIso)}
                      </time>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <strong>No activity yet.</strong>
                    <span>Your first saved asset or marketplace listing will appear here.</span>
                  </div>
                )}
              </div>
            </article>
          </div>

          <aside className={styles.rail}>
            <article className={styles.surface}>
              <div className={styles.summaryHeader}>
                <span className={styles.summaryLabel}>Portfolio Value</span>
                <strong>{money(totalValue)}</strong>
              </div>

              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span>Total assets</span>
                  <strong>{summary.totalAssets}</strong>
                </div>
                <div className={styles.statCard}>
                  <span>Equipment</span>
                  <strong>{summary.tractors}</strong>
                </div>
                <div className={styles.statCard}>
                  <span>Property</span>
                  <strong>{summary.properties}</strong>
                </div>
                <div className={styles.statCard}>
                  <span>Manual assets</span>
                  <strong>{summary.manualAssets}</strong>
                </div>
              </div>

              <div className={styles.highlightCard}>
                <div>
                  <span className={styles.highlightLabel}>Marketplace live</span>
                  <strong>{summary.liveListings} assets</strong>
                </div>
                <span className={styles.highlightPill}>Tracked</span>
              </div>
            </article>

            <article className={styles.surface}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Quick Actions</h2>
                  <p>Keep the most common asset workflows obvious.</p>
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
                  onClick={() => setNotice('Wire “Refresh All Values” once the revaluation inputs are stored.')}
                >
                  Refresh All Values
                </button>

                <button
                  type="button"
                  className={styles.quickButton}
                  onClick={() => setNotice('Connect this button to your PDF asset register export when ready.')}
                >
                  Generate Asset Report
                </button>
              </div>
            </article>

            <article className={styles.surface}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Register Rules</h2>
                  <p>Keep the product logic simple and obvious to the user.</p>
                </div>
              </div>

              <ul className={styles.rulesList}>
                <li>Saved valuation rows stay ready for future refresh logic.</li>
                <li>Every row can be manually overridden at any time.</li>
                <li>Property and manual assets belong in the same register.</li>
                <li>Selling should remain a fast three-field handoff.</li>
              </ul>
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
              <button type="button" className={styles.modalClose} onClick={closeAddModal} aria-label="Close add asset modal">
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
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="override-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 id="override-title">Override Value</h3>
                <p>{overrideItem.title}</p>
              </div>
              <button type="button" className={styles.modalClose} onClick={closeOverrideModal} aria-label="Close override modal">
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
              <button type="button" className={styles.modalClose} onClick={closeSellModal} aria-label="Close marketplace modal">
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
