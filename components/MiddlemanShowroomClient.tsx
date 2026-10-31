'use client';
import { sellingPriceComparison } from '../lib/selling-price';

import AdvertShareSheet from './AdvertShareSheet';
import AssetModalSelect from './AssetModalSelect';
import { showroomListingTitle, showroomListingDetails } from '../lib/showroom-presentation';
import { useDealerAppRoot } from '../lib/use-dealer-app-root';

import Link from 'next/link';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import MarketplaceClient from '../app/marketplace/marketplace-client';
import MarketplaceOutcomeModal from './MarketplaceOutcomeModal';
import type { MarketplaceDealRating, MarketplaceListing } from '../lib/marketplace';
import {
  marketplaceListingToAdContent,
  renderMarketplaceAdCanvas,
  downloadMarketplaceAd,
  marketplaceAdFilename,
  type MarketplaceAdDesign,
} from '../lib/marketplace-ad-renderer';
import type { MiddlemanShowroom, PublicMiddlemanShowroomData } from '../lib/middleman-showroom-db';
import styles from './MiddlemanShowroomClient.module.css';
import dialogStyles from './AccountDialog.module.css';
import managementStyles from '../app/account/owner-login-sections.module.css';
import { WorkspaceTitlePanel } from './WorkspacePrimitives';

type ManagerProps = {
  initialShowroom: MiddlemanShowroom;
  initialListings: MarketplaceListing[];
  dealerAppMode?: boolean;
  ownerAccount?: boolean;
  middlemanMode?: boolean;
  advertDesign?: MarketplaceAdDesign;
  advertDesignHref?: string | null;
};

const SHOWROOM_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SHOWROOM_LOGO_BYTES = 2_000_000;
const MAX_SHOWROOM_LOGO_DIMENSION = 4_096;

function money(value: number): string {
  return `R ${Math.round(Number.isFinite(value) ? value : 0).toLocaleString('en-US').replace(/,/g, ' ')}`;
}

function listingRating(listing: MarketplaceListing): { value: MarketplaceDealRating; label: string } | null {
  if (listing.showDealRating === false) return null;
  const value = listing.dealRating ?? 'none';
  const labels: Record<MarketplaceDealRating, string> = {
    low: 'Low price',
    great: 'Great price',
    fair: 'Fair price',
    high: 'High price',
    none: 'No rating',
  };
  const comparison=sellingPriceComparison(listing);
  return comparison ? {value,label:comparison.basis==='realistic' ? `${comparison.label} · ${comparison.difference}` : comparison.difference} : null;
}

function ShowroomDialog({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`${styles.nativeDialog} ${wide ? styles.wideDialog : ''} ${dialogStyles.surface}`} aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={dialogStyles.header}><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button type="button" className={dialogStyles.close} data-modal-close="true" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}

function publicHref(slug: string): string {
  return `/showroom/${encodeURIComponent(slug)}`;
}

function whatsappHref(phone: string, listing?: MarketplaceListing): string {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '27');
  const message = listing
    ? `Hi, I am interested in the ${listing.title} advertised on your Aim4price showroom.`
    : 'Hi, I found your machinery showroom on Aim4price.';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function websiteLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch {
    return value;
  }
}

type ShowroomDetailIconName = 'location' | 'phone' | 'email' | 'website' | 'whatsapp';
type ShowroomManageActionIconName = 'edit' | 'download' | 'marketplace' | 'remove' | 'calculator' | 'link' | 'controls' | 'assets';

function ShowroomDetailIcon({ name }: { name: ShowroomDetailIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'whatsapp' ? <><path d="M12 3.25a8.55 8.55 0 0 0-7.26 13.05l-1.06 3.9 4.04-1.02A8.55 8.55 0 1 0 12 3.25Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.55 7.65c.22-.48.45-.5.68-.5h.6c.2 0 .43.05.57.38l.78 1.82c.1.27.08.5-.08.72l-.42.53c-.1.12-.13.28-.05.43.48.9 1.35 1.78 2.34 2.34.15.08.3.05.43-.05l.53-.42c.22-.17.45-.2.72-.08l1.82.78c.33.13.38.37.38.57v.6c0 .23-.02.47-.5.68-.5.22-1.14.34-1.9.24-2.28-.32-5.83-3.86-6.15-6.15-.1-.76.02-1.4.25-1.9Z" fill="currentColor" stroke="none" /></> : null}
      {name === 'location' ? (
        <>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.6" />
        </>
      ) : null}
      {name === 'phone' ? (
        <path d="M8.4 3.7 6.1 4.8c-.8.4-1.2 1.3-.9 2.2 1.8 5.5 6.3 10 11.8 11.8.9.3 1.8-.1 2.2-.9l1.1-2.3-4.1-2.1-1.1 1.8a14.7 14.7 0 0 1-6.4-6.4l1.8-1.1-2.1-4.1Z" />
      ) : null}
      {name === 'email' ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </>
      ) : null}
      {name === 'website' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.4 2.5 3.7 5.5 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.5-3.7-9S9.6 5.5 12 3Z" />
        </>
      ) : null}
    </svg>
  );
}

function ShowroomManageActionIcon({ name }: { name: ShowroomManageActionIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'assets' ? <path d="M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10" /> : null}
      {name === 'calculator' ? <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8v4H8zM8 14h1M12 14h1M16 14h.01M8 18h1M12 18h1M16 18h.01" /></> : null}
      {name === 'link' ? <><path d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M13 17a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1" /></> : null}
      {name === 'controls' ? <><path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="18" r="2" /></> : null}
      {name === 'edit' ? (
        <>
          <path d="m4 16.5-.5 4 4-.5L19 8.5 15.5 5 4 16.5Z" />
          <path d="m13.8 6.7 3.5 3.5" />
        </>
      ) : null}
      {name === 'download' ? (
        <>
          <path d="M12 3v11" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 18v2h14v-2" />
        </>
      ) : null}
      {name === 'marketplace' ? (
        <>
          <path d="M4 9.5V20h16V9.5" />
          <path d="M3 9.5 5.2 4h13.6L21 9.5" />
          <path d="M8 20v-6h8v6" />
          <path d="M3 9.5c0 1.4 1 2.5 2.3 2.5S8 10.9 8 9.5c0 1.4.9 2.5 2.2 2.5s2.3-1.1 2.3-2.5c0 1.4.9 2.5 2.2 2.5s2.3-1.1 2.3-2.5c0 1.4.9 2.5 2.2 2.5S21 10.9 21 9.5" />
        </>
      ) : null}
      {name === 'remove' ? (
        <>
          <path d="M4 7h16" />
          <path d="m9 7 .6-2h4.8l.6 2" />
          <path d="m6.5 7 .8 13h9.4l.8-13" />
          <path d="M10 11v5M14 11v5" />
        </>
      ) : null}
    </svg>
  );
}

export function MiddlemanShowroomManager({
  initialShowroom,
  initialListings,
  dealerAppMode = false,
  ownerAccount = false,
  middlemanMode = false,
  advertDesign = 'aim4price-marketplace',
  advertDesignHref = null,
}: ManagerProps) {
  const dealerAppRoot = useDealerAppRoot();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'overview' | 'details' | 'link' | 'template' | 'visibility'>('overview');
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null);
  const [shareShowroomOpen, setShareShowroomOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<MarketplaceListing | null>(null);
  const [previewTarget, setPreviewTarget] = useState<MarketplaceListing | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [showroom, setShowroom] = useState(initialShowroom);
  const [listings, setListings] = useState(initialListings);
  const [slug, setSlug] = useState(initialShowroom.slug);
  const [bio, setBio] = useState(initialShowroom.bio);
  const [isPublic, setIsPublic] = useState(initialShowroom.isPublic);
  const [showroomLogoUrl, setShowroomLogoUrl] = useState(initialShowroom.showroomLogoUrl);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [readingLogo, setReadingLogo] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showroomIntroOpen, setShowroomIntroOpen] = useState(false);
  const [showroomIntroSeen, setShowroomIntroSeen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingShowroom, setDeletingShowroom] = useState(false);
  const [busyListingId, setBusyListingId] = useState('');
  const [manageListingTarget, setManageListingTarget] = useState<MarketplaceListing | null>(null);
  const [outcomeListingTarget, setOutcomeListingTarget] = useState<MarketplaceListing | null>(null);
  const [message, setMessage] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const manageDialogRef = useRef<HTMLElement | null>(null);
  const manageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const valuationHref = dealerAppMode ? `${dealerAppRoot}/valuation` : '/valuation';
  const manualHref = dealerAppMode ? `${dealerAppRoot}/marketplace/create` : '/marketplace/create';
  const registerHref = dealerAppMode ? `${dealerAppRoot}/inventory` : '/asset-register';
  const visibleListings = listings.filter(listing => `${listing.title} ${showroomListingDetails(listing)}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === 'price-low' ? a.askingPriceExVat - b.askingPriceExVat : sort === 'price-high' ? b.askingPriceExVat - a.askingPriceExVat : (Date.parse(b.publishedAtIso) || 0) - (Date.parse(a.publishedAtIso) || 0));
  const usesSavedBrandDesign = advertDesign === 'saved-brand';
  const logoPreviewUrl = showroomLogoUrl || showroom.inheritedLogoUrl;
  const hasUnsavedShowroomChanges = slug !== showroom.slug
    || bio !== showroom.bio
    || isPublic !== showroom.isPublic
    || showroomLogoUrl !== showroom.showroomLogoUrl;

  const detailsChanged = bio !== showroom.bio || showroomLogoUrl !== showroom.showroomLogoUrl;
  const linkChanged = slug !== showroom.slug;
  const visibilityChanged = isPublic !== showroom.isPublic;
  const sectionChanged = settingsSection === 'details' ? detailsChanged : settingsSection === 'link' ? linkChanged : settingsSection === 'visibility' && visibilityChanged;
  useEffect(() => { if (settingsOpen) settingsHeadingRef.current?.focus({ preventScroll: true }); }, [settingsOpen, settingsSection]);

  useEffect(() => {
    if ((!manageListingTarget && !createDialogOpen && !showroomIntroOpen) || typeof window === 'undefined') return undefined;

    const dialog = manageDialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      dialog?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (!dialog?.getClientRects().length || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setManageListingTarget(null);
        setCreateDialogOpen(false);
        setShowroomIntroOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      );
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      manageTriggerRef.current?.focus();
    };
  }, [manageListingTarget, createDialogOpen, showroomIntroOpen]);

  function applyShowroomLogoFile(file?: File) {
    if (!file || saving || readingLogo) return;
    setLogoFeedback(null);
    if (!SHOWROOM_LOGO_TYPES.has(file.type)) {
      setLogoFeedback({ text: 'Choose a PNG, JPEG or WebP logo.', error: true });
      return;
    }
    if (file.size > MAX_SHOWROOM_LOGO_BYTES) {
      setLogoFeedback({ text: 'Keep the showroom logo below 2 MB.', error: true });
      return;
    }

    setReadingLogo(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setLogoFeedback({ text: 'The showroom logo could not be read.', error: true });
        setReadingLogo(false);
        return;
      }
      const logoDataUrl = reader.result;
      const image = new Image();
      image.onload = () => {
        if (
          image.naturalWidth > MAX_SHOWROOM_LOGO_DIMENSION
          || image.naturalHeight > MAX_SHOWROOM_LOGO_DIMENSION
        ) {
          setLogoFeedback({ text: 'Keep the showroom logo dimensions below 4096 × 4096 pixels.', error: true });
        } else {
          setShowroomLogoUrl(logoDataUrl);
          setLogoFeedback({ text: 'Logo ready. Save your changes to update the public showroom.', error: false });
        }
        setReadingLogo(false);
      };
      image.onerror = () => {
        setLogoFeedback({ text: 'Choose a valid PNG, JPEG or WebP logo.', error: true });
        setReadingLogo(false);
      };
      image.src = logoDataUrl;
    };
    reader.onerror = () => {
      setLogoFeedback({ text: 'The showroom logo could not be read.', error: true });
      setReadingLogo(false);
    };
    reader.readAsDataURL(file);
  }

  function handleShowroomLogoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setLogoDragActive(false);
    applyShowroomLogoFile(event.dataTransfer.files?.[0]);
  }

  async function saveShowroom() {
    if (readingLogo) return;
    setSaving(true);
    setMessage('');
    setLogoFeedback(null);
    try {
      const response = await fetch('/api/middleman-showroom', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: settingsSection === 'link' ? slug : showroom.slug,
          bio: settingsSection === 'details' ? bio : showroom.bio,
          isPublic: settingsSection === 'visibility' ? isPublic : showroom.isPublic,
          logoUrl: settingsSection === 'details' ? showroomLogoUrl : showroom.showroomLogoUrl,
        }),
      });
      const data = await response.json() as { ok?: boolean; showroom?: MiddlemanShowroom; error?: string };
      if (!response.ok || !data.ok || !data.showroom) throw new Error(data.error || 'Failed to save your showroom.');
      setShowroom(data.showroom);
      if (settingsSection === 'link') setSlug(data.showroom.slug);
      if (settingsSection === 'visibility') setIsPublic(data.showroom.isPublic);
      if (settingsSection === 'details') {
        setBio(data.showroom.bio);
        setShowroomLogoUrl(data.showroom.showroomLogoUrl);
      }
      setMessage('Changes saved.');
      setSettingsSection('overview');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save your showroom.');
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicLink() {
    const url = `${window.location.origin}${publicHref(showroom.slug)}`;
    try { await navigator.clipboard.writeText(url); setMessage('Showroom link copied.'); }
    catch { setMessage('Could not copy the link. Select and copy the address instead.'); }
  }

  async function prepareAdvert(listing: MarketplaceListing) {
    const canvas = document.createElement('canvas');
    const content = marketplaceListingToAdContent({ ...listing, title: showroomListingTitle(listing) }, {
      design: usesSavedBrandDesign && listing.adBrand ? 'saved-brand' : 'aim4price-marketplace',
    });
    await renderMarketplaceAdCanvas(canvas, content, { requireImages: true });
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare advert.')), 'image/png'));
    return new File([blob], marketplaceAdFilename(listing.title).replace(/\.jpe?g$/i, '.png'), { type: 'image/png' });
  }
  useEffect(() => {
    if (!previewTarget) return;
    let active = true;
    let url = '';
    setPreviewUrl(''); setPreviewError('');
    void prepareAdvert(previewTarget).then(file => {
      if (!active) return;
      url = URL.createObjectURL(file); setPreviewUrl(url);
    }).catch(() => { if (active) setPreviewError('Could not prepare the preview. Please close it and try again.'); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [previewTarget, usesSavedBrandDesign]);
  async function downloadAdvert(listing: MarketplaceListing) {
    setBusyListingId(listing.id); setMessage('');
    try {
      const file = await prepareAdvert(listing);
      downloadMarketplaceAd(file, file.name);
      setMessage('PNG advert downloaded.');
    } catch { setMessage('The PNG could not be created. Please try again.'); }
    finally { setBusyListingId(''); }
  }

  function handleListingOutcomeRemoved(listing: MarketplaceListing) {
    setListings((current) => current.filter((item) => item.id !== listing.id));
    setOutcomeListingTarget(null);
    setManageListingTarget(null);
    setMessage('Outcome saved. The advert was removed from Marketplace and your showroom.');
  }

  async function deleteShowroom() {
    if (listings.length) {
      setMessage('Remove each live advert and record its outcome first.');
      setDeleteDialogOpen(false);
      return;
    }
    if (deleteConfirmation !== 'DELETE') return;
    setDeletingShowroom(true);
    setMessage('');
    try {
      const response = await fetch('/api/middleman-showroom', {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json() as { ok?: boolean; deletedAdvertCount?: number; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to delete your showroom.');
      window.location.assign(dealerAppMode ? dealerAppRoot : '/account');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete your showroom.');
      setDeletingShowroom(false);
      setDeleteDialogOpen(false);
    }
  }

  return (
    <div className={`${styles.managerPage} ${dealerAppMode ? styles.managerPageMobile : ''}`}>
      <div className={styles.managerTitle}>
        <WorkspaceTitlePanel title="MY ADVERT SHOWROOM" />
      </div>
      <section className={styles.managerToolbar} aria-label="Showroom actions">
        <p>Your adverts, hosted by Aim4price. One link to share.</p>
        <div className={styles.heroActions}>
          <button type="button" className={styles.primaryButton} onClick={(event) => { manageTriggerRef.current = event.currentTarget; setCreateDialogOpen(true); }}><span aria-hidden="true">+</span> Create advert</button>
          <button type="button" className={styles.secondaryButton} disabled={!showroom.isPublic} title={showroom.isPublic ? 'Share showroom' : 'Make your showroom public in Edit showroom to share it'} onClick={() => { setMessage(''); setShareShowroomOpen(true); }}><ShowroomManageActionIcon name="link" />Share showroom</button>
          {showroom.isPublic ? (
            <button type="button" className={`${styles.secondaryButton} ${styles.openShowroomButton} ${showroomIntroSeen ? '' : styles.showroomPulse}`} aria-haspopup="dialog" onClick={(event) => {
              manageTriggerRef.current = event.currentTarget;
              setShowroomIntroSeen(true);
              setShowroomIntroOpen(true);
            }}>
              <ShowroomManageActionIcon name="marketplace" /> Open showroom
            </button>
          ) : null}
        </div>
      </section>

      <div className={styles.managerGrid}>
        <section className={styles.showroomSummary} aria-label="Showroom summary">
          <div className={styles.summaryIdentity}>
            {(showroom.showroomLogoUrl || showroom.inheritedLogoUrl) ? <img src={showroom.showroomLogoUrl || showroom.inheritedLogoUrl} alt="Showroom logo" /> : <span className={styles.summaryPlaceholder}><ShowroomManageActionIcon name="marketplace" /></span>}
            <div><h2>{showroom.name}</h2><p>{listings.length} {listings.length === 1 ? 'advert' : 'adverts'} · {showroom.isPublic ? 'Public' : 'Private'}</p>{showroom.bio ? <p>{showroom.bio}</p> : null}</div>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={() => { setMessage(''); setSettingsSection('overview'); setSettingsOpen(true); }}><ShowroomManageActionIcon name="controls" />Manage showroom{hasUnsavedShowroomChanges ? ' · Unsaved' : ''}</button>
        </section>
        {message ? <p className={styles.feedback} role="status">{message}</p> : null}

        <section className={styles.stockCard}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Your live adverts</h2>
              <p>Manage the machinery currently shown to customers.</p>
            </div>
            <span className={styles.stockCount}>{listings.length} {listings.length === 1 ? 'advert' : 'adverts'}</span>
          </div>
          {listings.length ? <div className={styles.inventoryTools}>
            <label><span>Search adverts</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by asset or details" /></label>
            <AssetModalSelect className={styles.inventorySort} label="Sort adverts" value={sort} onChange={setSort} usePortal={false} options={[{ value: 'newest', label: 'Newest first' }, { value: 'price-low', label: 'Price: low to high' }, { value: 'price-high', label: 'Price: high to low' }]} />
          </div> : null}
          {listings.length > 0 && !visibleListings.length ? <div className={styles.emptyStock}><h3>No matching adverts</h3><button type="button" className={styles.secondaryButton} onClick={() => setQuery('')}>Clear search</button></div> : null}
          {listings.length ? (
            <div className={styles.managerListings}>
              {visibleListings.map((listing) => {
                const rating = listingRating(listing);
                return (
                  <article className={styles.managerListing} key={listing.id}>
                    <img src={listing.imageSrc || '/brand/Tractor.png'} alt="" />
                    <div>
                      <div className={styles.listingTitleRow}>
                        <strong>{showroomListingTitle(listing)}</strong>
                        {rating ? <span className={`${styles.rating} ${styles[`rating_${rating.value}`]}`}>{rating.label}</span> : null}
                      </div>
                      <small>{showroomListingDetails(listing)}</small>
                      <b>{money(listing.askingPriceExVat)} excl. VAT</b>
                    </div>
                    <div className={styles.listingActions}>
                      <button
                        type="button"
                        onClick={(event) => {
                          manageTriggerRef.current = event.currentTarget;
                          setManageListingTarget(listing);
                        }}
                        disabled={busyListingId === listing.id}
                      >
                        Manage advert
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyStock}>
              <h3>No adverts yet</h3>
              <p>Create your first advert and it will appear here automatically.</p>
              <button type="button" className={styles.primaryButton} onClick={(event) => { manageTriggerRef.current = event.currentTarget; setCreateDialogOpen(true); }}><span aria-hidden="true">+</span> Create advert</button>
            </div>
          )}
        </section>
      </div>

      {settingsOpen ? <ShowroomDialog title="Manage showroom" subtitle={showroom.name} wide onClose={() => setSettingsOpen(false)}>
        <section className={`${styles.settingsCard} ${styles.settingsManager} ${managementStyles.manager} ${managementStyles.ownerManager}`}>
          <div className={managementStyles.toolbar}>
            {settingsSection !== 'overview' ? <button type="button" disabled={saving || readingLogo} onClick={() => { setMessage(''); setSettingsSection('overview'); }}>Back</button> : <span />}
            <span className={managementStyles.status} data-active={showroom.isPublic}>{showroom.isPublic ? 'Public' : 'Private'}</span>
          </div>
          <h3 ref={settingsHeadingRef} tabIndex={-1} className={managementStyles.sectionTitle}>{({ overview: 'Manage your showroom', details: 'Showroom details', link: 'Public link', template: 'Advert template', visibility: 'Visibility' })[settingsSection]}</h3>
          {settingsSection === 'overview' ? <>
            <div className={managementStyles.grid}>
              {([
                { key: 'details', icon: 'marketplace', title: 'Showroom details', text: 'Update your logo and introduction.', value: detailsChanged ? 'Unsaved changes' : showroom.showroomLogoUrl ? 'Custom logo' : showroom.inheritedLogoUrl ? 'Saved brand logo' : 'Add your logo' },
                { key: 'link', icon: 'link', title: 'Public link', text: 'Edit your address or copy the link.', value: linkChanged ? 'Unsaved changes' : showroom.slug },
                { key: 'template', icon: 'edit', title: 'Advert template', text: 'View the design used for your adverts.', value: usesSavedBrandDesign ? 'My advert template' : 'Aim4price Marketplace' },
                { key: 'visibility', icon: 'controls', title: 'Visibility', text: 'Choose who can see your showroom.', value: visibilityChanged ? 'Unsaved changes' : showroom.isPublic ? 'Public' : 'Private' },
              ] as const).map(item => <button type="button" key={item.key} className={managementStyles.card} onClick={() => { setMessage(''); setSettingsSection(item.key); }}>
                <span className={managementStyles.icon}><ShowroomManageActionIcon name={item.icon} /></span>
                <span className={managementStyles.copy}><strong>{item.title}</strong><span>{item.text}</span><small>{item.value}</small></span>
              </button>)}
            </div>
            <div className={styles.dangerZone}>
              <div>
                <strong>Delete showroom</strong>
                <small>{listings.length ? 'Remove each live advert and record its outcome first.' : 'Advert history, valuations and assets stay saved.'}</small>
              </div>
              <button
                type="button"
                onClick={() => { setSettingsOpen(false); setDeleteConfirmation(''); setDeleteDialogOpen(true); }}
                disabled={listings.length > 0}
                title={listings.length ? 'Remove each live advert first.' : 'Delete showroom'}
              >
                Delete showroom
              </button>
            </div>

          </> : <>
            <div className={styles.settingsEditor}>
              {settingsSection === 'details' ? <>
          <div
            className={`${styles.showroomLogoField} ${logoDragActive ? styles.showroomLogoDragging : ''}`}
            onDragEnter={(event) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              if (!saving && !readingLogo) setLogoDragActive(true);
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setLogoDragActive(false);
            }}
            onDrop={handleShowroomLogoDrop}
          >
            <div className={styles.showroomLogoPreview}>
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Showroom logo preview" />
              ) : (
                <span>Logo</span>
              )}
              {logoDragActive ? <small>Drop logo</small> : null}
            </div>
            <div className={styles.showroomLogoCopy}>
              <strong>Showroom logo</strong>
              <span>
                {showroomLogoUrl
                  ? 'Custom showroom logo.'
                  : showroom.inheritedLogoUrl
                    ? 'Using your saved brand logo.'
                    : 'Add your showroom logo.'}
              </span>
              <small id="showroom-logo-help">PNG, JPEG or WebP · Maximum 2 MB</small>
              {showroomLogoUrl ? (
                <button
                  className={styles.showroomLogoReset}
                  type="button"
                  onClick={() => {
                    setShowroomLogoUrl('');
                    setLogoFeedback({
                      text: showroom.inheritedLogoUrl
                        ? 'Your saved brand logo will be used after you save your changes.'
                        : 'The showroom logo will be removed after you save your changes.',
                      error: false,
                    });
                  }}
                  disabled={saving || readingLogo}
                >
                  {showroom.inheritedLogoUrl ? 'Use saved brand logo' : 'Remove logo'}
                </button>
              ) : null}
              {logoFeedback ? (
                <small
                  id="showroom-logo-feedback"
                  className={`${styles.showroomLogoFeedback} ${logoFeedback.error ? styles.showroomLogoFeedbackError : ''}`}
                  role="status"
                >
                  {logoFeedback.text}
                </small>
              ) : null}
            </div>
            <div className={styles.showroomLogoActions}>
              <button
                className={styles.showroomLogoButton}
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={saving || readingLogo}
                aria-describedby={logoFeedback ? 'showroom-logo-help showroom-logo-feedback' : 'showroom-logo-help'}
              >
                {readingLogo ? 'Reading logo...' : logoPreviewUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              <input
                ref={logoInputRef}
                className={styles.showroomLogoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  applyShowroomLogoFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = '';
                }}
                tabIndex={-1}
              />
            </div>
          </div>
          <label className={styles.introductionField}>
            <span>Short introduction</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell customers which machinery, regions or services you specialise in."
            />
            <small>{bio.length} of 500 characters</small>
          </label>
              </> : null}
              {settingsSection === 'link' ? <>
          <div className={styles.publicLinkField}>
            <label htmlFor="showroom-public-link">Public link</label>
            <div className={styles.slugField}>
              <span className={styles.slugPrefix}>aim4price.com/showroom/</span>
              <input
                id="showroom-public-link"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                maxLength={60}
                autoCapitalize="none"
                aria-label="Public showroom address"
              />
              <button
                className={styles.copyLinkButton}
                type="button"
                onClick={copyPublicLink}
                disabled={!showroom.isPublic || linkChanged || saving}
                title={linkChanged ? 'Save your changes before copying the public link.' : undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="8" y="8" width="11" height="11" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
                Copy link
              </button>
            </div>
          </div>
              </> : null}
              {settingsSection === 'template' ? <>
          <div className={styles.advertDesignField}>
            <div>
              <strong>Advert design</strong>
              <span>
                {usesSavedBrandDesign
                  ? 'Downloads use your advert template.'
                  : 'Downloads use the Aim4price Marketplace design.'}
              </span>
            </div>
            {advertDesignHref ? (
              <Link className={styles.advertDesignButton} href={advertDesignHref}>Edit advert template</Link>
            ) : null}
          </div>
                {advertDesignHref ? <p className={managementStyles.hint}>Opens Advert Studio on a different page. Save any showroom changes before leaving.</p> : null}
              </> : null}
              {settingsSection === 'visibility' ? <>
          <label className={styles.switchRow}>
            <span><strong>Showroom visible to the public</strong><small>Anyone with the link can view your live adverts and contact details.</small></span>
            <span className={styles.switchControl}>
              <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
              <span aria-hidden="true" />
            </span>
          </label>
              </> : null}
            </div>
            {settingsSection !== 'template' ? <footer className={styles.settingsActions}>
              <button className={`${styles.primaryButton} ${managementStyles.primary}`} type="button" onClick={saveShowroom} disabled={saving || readingLogo || !sectionChanged}>{saving ? 'Saving...' : readingLogo ? 'Reading logo...' : 'Save changes'}</button>
            </footer> : null}
          </>}
          {message ? <p className={styles.feedback} role="status">{message}</p> : null}
        </section>
      </ShowroomDialog> : null}
      {shareShowroomOpen ? <ShowroomDialog title="Share showroom" onClose={() => setShareShowroomOpen(false)}>
        <div className={styles.dialogContent}>
          <p>One link to all your live adverts.</p>
          <label className={styles.shareAddress}>Showroom link<input readOnly value={`${window.location.origin}${publicHref(showroom.slug)}`} onFocus={event => event.currentTarget.select()} /></label>
          <div className={styles.heroActions}>
            <a className={styles.secondaryButton} href={`https://wa.me/?text=${encodeURIComponent(`${showroom.name}
${window.location.origin}${publicHref(showroom.slug)}`)}`} target="_blank" rel="noreferrer"><ShowroomDetailIcon name="whatsapp" />WhatsApp</a>
            <a className={styles.secondaryButton} href={`mailto:?subject=${encodeURIComponent(showroom.name)}&body=${encodeURIComponent(`${window.location.origin}${publicHref(showroom.slug)}`)}`}><ShowroomDetailIcon name="email" />Email</a>
            <button type="button" className={styles.secondaryButton} onClick={() => void copyPublicLink()}><ShowroomManageActionIcon name="link" />Copy link</button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </div>
      </ShowroomDialog> : null}
      {previewTarget ? <ShowroomDialog title="Advert preview" wide onClose={() => setPreviewTarget(null)}>
        <div className={styles.dialogContent}>
          {previewError ? <p role="alert">{previewError}</p> : previewUrl ? <img className={styles.advertPreviewImage} src={previewUrl} alt={showroomListingTitle(previewTarget)} /> : <p role="status">Preparing preview…</p>}
          <div className={styles.heroActions}><button type="button" className={styles.primaryButton} disabled={!previewUrl || busyListingId === previewTarget.id} onClick={() => void downloadAdvert(previewTarget)}><ShowroomManageActionIcon name="download" />Download PNG</button></div>
          {message ? <p role="status">{message}</p> : null}
        </div>
      </ShowroomDialog> : null}
      {shareTarget ? <AdvertShareSheet listing={shareTarget} shareUrl={`${window.location.origin}/marketplace/browse?listing=${encodeURIComponent(shareTarget.id)}&preview=photo`} caption={[showroomListingTitle(shareTarget), showroomListingDetails(shareTarget), `${money(shareTarget.askingPriceExVat)} excl. VAT`, shareTarget.description, shareTarget.sellerName, shareTarget.sellerPhone].filter(Boolean).join('\n')} prepareAdvert={() => prepareAdvert(shareTarget)} onClose={() => setShareTarget(null)} /> : null}

      {showroomIntroOpen ? (
        <div className={styles.listingManagerBackdrop} data-website-overlay onClick={(event) => { if (event.target === event.currentTarget) setShowroomIntroOpen(false); }}>
          <section ref={manageDialogRef} className={`${styles.listingManagerDialog} ${styles.showroomIntroDialog} ${dialogStyles.surface}`} role="dialog" aria-modal="true" aria-labelledby="showroom-intro-title" aria-describedby="showroom-intro-description" tabIndex={-1}>
            <header className={`${styles.listingManagerHeader} ${dialogStyles.header}`}>
              <div>
                <h2 id="showroom-intro-title">Your advert showroom</h2>
                <p id="showroom-intro-description">Hosted by Aim4price. Ready to share.</p>
              </div>
              <button type="button" className={dialogStyles.close} aria-label="Close showroom introduction" onClick={() => setShowroomIntroOpen(false)} data-modal-close="true">×</button>
            </header>
            <div className={styles.showroomIntroBody}>
              <div className={styles.showroomBenefits}>
                <div><span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="marketplace" /></span><div><strong>All your adverts</strong><p>Your live machinery listings in one place.</p></div></div>
                <div><span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="link" /></span><div><strong>One link to share</strong><p>Send it on WhatsApp, social media or email.</p></div></div>
                <div><span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="controls" /></span><div><strong>You stay in control</strong><p>Update adverts and manage visibility.</p></div></div>
              </div>
              <div className={styles.showroomAddress}><span>Your showroom link</span><strong>aim4price.com/showroom/{showroom.slug}</strong></div>
              {hasUnsavedShowroomChanges ? <p className={styles.showroomIntroNote}>This opens your saved showroom. Save your changes here to update the public page.</p> : null}
              <div className={styles.showroomIntroActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setShowroomIntroOpen(false)}>Keep managing</button>
                <Link className={styles.primaryButton} href={publicHref(showroom.slug)} target="_blank" rel="noreferrer" onClick={() => setShowroomIntroOpen(false)} aria-label="Open showroom (opens in a new tab)">Open showroom</Link>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {createDialogOpen ? (
        <div className={styles.listingManagerBackdrop} data-website-overlay onClick={(event) => { if (event.target === event.currentTarget) setCreateDialogOpen(false); }}>
          <section ref={manageDialogRef} className={`${styles.listingManagerDialog} ${dialogStyles.surface}`} role="dialog" aria-modal="true" aria-labelledby="create-advert-title" tabIndex={-1}>
            <header className={`${styles.listingManagerHeader} ${dialogStyles.header}`}>
              <div><h2 id="create-advert-title">Create advert</h2><p>Choose where to start.</p></div>
              <button type="button" className={dialogStyles.close} aria-label="Close create advert" onClick={() => setCreateDialogOpen(false)} data-modal-close="true">×</button>
            </header>
            <div className={`${styles.listingManagerActions} ${styles.createAdvertActions}`}>
              <Link href={manualHref}><span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="edit" /></span><span className={styles.listingManagerActionCopy}><strong>Manual</strong><small>Add details and photos. No valuation needed.</small></span></Link>
              <Link href={`${valuationHref}?marketplace=1`}>
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="calculator" /></span>
                <span className={styles.listingManagerActionCopy}><strong>Value Asset</strong><small>Value an asset and create an advert.</small></span>
              </Link>
              {!middlemanMode ? <Link href={registerHref}>
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="assets" /></span>
                <span className={styles.listingManagerActionCopy}><strong>Asset Register</strong><small>Choose a saved asset.</small></span>
              </Link> : null}
            </div>
          </section>
        </div>
      ) : null}

      {manageListingTarget ? (
        <div
          className={styles.listingManagerBackdrop} style={outcomeListingTarget ? { display: 'none' } : undefined} data-website-overlay
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setManageListingTarget(null);
          }}
        >
          <section
            ref={manageDialogRef}
            className={`${styles.listingManagerDialog} ${styles.compactAdvertDialog} ${dialogStyles.surface}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="showroom-listing-manager-title"
            aria-describedby="showroom-listing-manager-description"
            tabIndex={-1}
          >
            <header className={`${styles.listingManagerHeader} ${dialogStyles.header}`}>
              <div>
                <h2 id="showroom-listing-manager-title">Manage advert</h2>
                <p id="showroom-listing-manager-description">Update, share or remove this advert from one place.</p>
              </div>
              <button
                className={`${styles.listingManagerClose} ${dialogStyles.close}`}
                type="button"
                onClick={() => setManageListingTarget(null)}
                aria-label="Close advert manager"
                data-modal-close="true"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className={styles.listingManagerSummary}>
              <img src={manageListingTarget.imageSrc || '/brand/Tractor.png'} alt="" />
              <div>
                <strong>{showroomListingTitle(manageListingTarget)}</strong>
                <span>{money(manageListingTarget.askingPriceExVat)} excl. VAT · {showroomListingDetails(manageListingTarget)}</span>
              </div>
            </div>

            <div className={styles.listingManagerActions}>
              {manageListingTarget.sourceAssetId ? (
                <Link
                  className={styles.listingManagerPrimary}
                  href={dealerAppMode
                    ? `${dealerAppRoot}/marketplace?listing=${encodeURIComponent(manageListingTarget.id)}&manage=1`
                    : `/asset-register?assetId=${encodeURIComponent(manageListingTarget.sourceAssetId)}&action=marketplace-edit`}
                >
                  <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="edit" /></span>
                  <span className={styles.listingManagerActionCopy}><strong>Edit advert</strong><small>Price, description and seller details.</small></span>
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.listingManagerPrimary}
                  disabled
                  title="Editing requires a saved asset."
                >
                  <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="edit" /></span>
                  <span className={styles.listingManagerActionCopy}><strong>Edit advert</strong><small>Editing requires a saved asset.</small></span>
                </button>
              )}
              <button
                type="button"
                onClick={() => { setMessage(''); setPreviewTarget(manageListingTarget); }}
                disabled={busyListingId === manageListingTarget.id}
              >
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="download" /></span>
                <span className={styles.listingManagerActionCopy}>
                  <strong>Preview &amp; download</strong>
                  <small>View your advert and download PNG.</small>
                </span>
              </button>
              <Link
                href={`${dealerAppMode ? `${dealerAppRoot}/marketplace` : '/marketplace'}?listing=${encodeURIComponent(manageListingTarget.id)}&manage=1`}
              >
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="marketplace" /></span>
                <span className={styles.listingManagerActionCopy}><strong>Open in Marketplace</strong><small>View your live marketplace advert.</small></span>
              </Link>
              <button type="button" onClick={() => setShareTarget(manageListingTarget)}><span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="link" /></span><span className={styles.listingManagerActionCopy}><strong>Share advert</strong><small>WhatsApp, Facebook or copy the link.</small></span></button>
            </div>
            <div className={`${styles.listingManagerActions} ${styles.removeActions}`}>
              <button
                type="button"
                className={styles.listingManagerRemove}
                onClick={() => {
                  setOutcomeListingTarget(manageListingTarget);
                }}
              >
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="remove" /></span>
                <span className={styles.listingManagerActionCopy}><strong>Remove advert</strong><small>Record the outcome and withdraw the advert.</small></span>
              </button>
            </div>

          </section>
        </div>
      ) : null}

      <MarketplaceOutcomeModal
        listing={outcomeListingTarget}
        source="showroom"
        onClose={() => setOutcomeListingTarget(null)}
        onRemoved={handleListingOutcomeRemoved}
      />

      {deleteDialogOpen ? (
        <div className={styles.deleteBackdrop} data-website-overlay onClick={() => !deletingShowroom && setDeleteDialogOpen(false)}>
          <section className={`${styles.deleteDialog} ${dialogStyles.surface}`} role="dialog" aria-modal="true" aria-labelledby="delete-showroom-title" onClick={(event) => event.stopPropagation()}>
            <span className={styles.deleteIcon}>!</span>
            <div data-modal-close-row>
              <h2 id="delete-showroom-title">Delete showroom?</h2>
              <button type="button" data-modal-close="true" aria-label="Close dialog" onClick={() => setDeleteDialogOpen(false)} disabled={deletingShowroom} />
            </div>
            <p>This removes the public showroom. Advert history, valuations and assets stay saved.</p>
            <label>
              <span>Type DELETE to confirm</span>
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} placeholder="DELETE" autoComplete="off" />
            </label>
            <div>
              <button type="button" className={styles.secondaryButton} onClick={() => setDeleteDialogOpen(false)} disabled={deletingShowroom}>Cancel</button>
              <button type="button" className={styles.deleteConfirmButton} onClick={deleteShowroom} disabled={deleteConfirmation !== 'DELETE' || deletingShowroom}>{deletingShowroom ? 'Deleting...' : 'Delete showroom'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function PublicMiddlemanShowroom({ showroom, listings }: {
  showroom: PublicMiddlemanShowroomData;
  listings: MarketplaceListing[];
}) {
  const liveAdvertLabel = `${listings.length} live ${listings.length === 1 ? 'advert' : 'adverts'}`;

  return (
    <div className={styles.publicPage}>
      <section className={styles.publicHero}>
        <div className={styles.publicHeroInner}>
          <div className={styles.publicHeroMain}>
            <div className={styles.profileIdentity}>
              {showroom.logoUrl ? <img src={showroom.logoUrl} alt={`${showroom.name} logo`} /> : <span aria-hidden="true">{showroom.name.slice(0, 2).toUpperCase()}</span>}
              <div>
                <h1>{showroom.name}</h1>
                <p className={styles.publicAdvertSummary}>{liveAdvertLabel}</p>
                {showroom.bio
                  ? <p className={styles.publicBio}>{showroom.bio}</p>
                  : <p className={styles.publicTrustLine}>Browse our available machinery.</p>}
              </div>
            </div>
            <div className={styles.publicContactActions} role="group" aria-label={`${showroom.name} contact options`}>
              {showroom.phone ? <a className={styles.whatsappButton} href={whatsappHref(showroom.phone)} target="_blank" rel="noreferrer" aria-label={`Chat with ${showroom.name} on WhatsApp`}><ShowroomDetailIcon name="whatsapp" />Chat on WhatsApp</a> : null}
              {showroom.phone ? <a className={styles.secondaryButton} href={`tel:${showroom.phone}`} aria-label={`Call ${showroom.name} at ${showroom.phone}`}><ShowroomDetailIcon name="phone" />Call business</a> : null}
              {showroom.email ? <a className={styles.secondaryButton} href={`mailto:${showroom.email}`} aria-label={`Email ${showroom.name} at ${showroom.email}`}><ShowroomDetailIcon name="email" />Email business</a> : null}
            </div>
          </div>
          {showroom.location || showroom.phone || showroom.email || showroom.websiteUrl ? (
            <div className={styles.publicBusinessDetails}>
              {showroom.location ? (
                <div>
                  <ShowroomDetailIcon name="location" />
                  <span className={styles.publicBusinessDetailCopy}><span>Location</span><strong>{showroom.location}</strong></span>
                </div>
              ) : null}
              {showroom.phone ? (
                <a href={`tel:${showroom.phone}`}>
                  <ShowroomDetailIcon name="phone" />
                  <span className={styles.publicBusinessDetailCopy}><span>Phone</span><strong>{showroom.phone}</strong></span>
                </a>
              ) : null}
              {showroom.email ? (
                <a href={`mailto:${showroom.email}`}>
                  <ShowroomDetailIcon name="email" />
                  <span className={styles.publicBusinessDetailCopy}><span>Email</span><strong>{showroom.email}</strong></span>
                </a>
              ) : null}
              {showroom.websiteUrl ? (
                <a href={showroom.websiteUrl} target="_blank" rel="noreferrer">
                  <ShowroomDetailIcon name="website" />
                  <span className={styles.publicBusinessDetailCopy}><span>Website</span><strong>{websiteLabel(showroom.websiteUrl)}</strong></span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.marketplaceInventory} aria-labelledby="showroom-inventory-title">
        <div className={styles.inventoryIntro}>
          <div>
            <h2 id="showroom-inventory-title">Available equipment</h2>
            <p>Browse equipment listed by {showroom.name} and contact the seller directly.</p>
          </div>
        </div>
        <MarketplaceClient
          initialFilters={{ brand: '', model: '', drive: '', type: '' }}
          initialListings={listings}
          isSignedIn={false}
          accountType="public"
          embeddedMode
          showroomMode
          exposeSellerContact
        />
      </section>

      <footer className={styles.publicFooter}>
        <div className={styles.publicFooterInner}>
          <div className={styles.footerBrand}><img src="/brand/Aim4price_Home_Logo.png" alt="Aim4price" /><div><strong>Hosted on Aim4price.com</strong><span>Machinery advertising. Direct seller contact.</span></div></div>
          <Link href="/valuation">Value your machinery</Link>
        </div>
      </footer>
    </div>
  );
}


