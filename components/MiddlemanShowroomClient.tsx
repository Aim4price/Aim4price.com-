'use client';

import Link from 'next/link';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import MarketplaceClient from '../app/marketplace/marketplace-client';
import MarketplaceOutcomeModal from './MarketplaceOutcomeModal';
import type { MarketplaceDealRating, MarketplaceListing } from '../lib/marketplace';
import {
  createMarketplaceAdJpeg,
  downloadMarketplaceAd,
  marketplaceAdFilename,
  type MarketplaceAdDesign,
} from '../lib/marketplace-ad-renderer';
import type { MiddlemanShowroom, PublicMiddlemanShowroomData } from '../lib/middleman-showroom-db';
import styles from './MiddlemanShowroomClient.module.css';

type ManagerProps = {
  initialShowroom: MiddlemanShowroom;
  initialListings: MarketplaceListing[];
  dealerAppMode?: boolean;
  advertDesign?: MarketplaceAdDesign;
  advertDesignHref?: string | null;
};

const SHOWROOM_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SHOWROOM_LOGO_BYTES = 2_000_000;
const MAX_SHOWROOM_LOGO_DIMENSION = 4_096;

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value || 0).replace('ZAR', 'R');
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
  return { value, label: labels[value] };
}

function listingDetails(listing: MarketplaceListing): string {
  const usage = listing.usageUnit === 'percent'
    ? `${Math.round(Number(listing.lifeWorkedPercent) || 0)}% worked`
    : `${Math.round(Number(listing.hours) || 0).toLocaleString('en-ZA')} ${listing.usageUnit}`;
  return [listing.yearModel, usage, listing.conditionLabel].filter(Boolean).join(' · ');
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

type ShowroomDetailIconName = 'location' | 'phone' | 'email' | 'website';
type ShowroomManageActionIconName = 'edit' | 'download' | 'marketplace' | 'remove';

function ShowroomDetailIcon({ name }: { name: ShowroomDetailIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
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

function ShowroomManageActionArrow({ direction = 'right' }: { direction?: 'right' | 'down' }) {
  return (
    <svg className={styles.listingManagerActionArrow} viewBox="0 0 24 24" aria-hidden="true">
      {direction === 'down' ? (
        <>
          <path d="M12 4v14" />
          <path d="m7 13 5 5 5-5" />
        </>
      ) : (
        <>
          <path d="M5 12h14" />
          <path d="m14 7 5 5-5 5" />
        </>
      )}
    </svg>
  );
}

export function MiddlemanShowroomManager({
  initialShowroom,
  initialListings,
  dealerAppMode = false,
  advertDesign = 'aim4price-marketplace',
  advertDesignHref = null,
}: ManagerProps) {
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
  const valuationHref = dealerAppMode ? '/dealer/valuation' : '/valuation';
  const usesSavedBrandDesign = advertDesign === 'saved-brand';
  const logoPreviewUrl = showroomLogoUrl || showroom.inheritedLogoUrl;
  const hasUnsavedShowroomChanges = slug !== showroom.slug
    || bio !== showroom.bio
    || isPublic !== showroom.isPublic
    || showroomLogoUrl !== showroom.showroomLogoUrl;

  useEffect(() => {
    if (!manageListingTarget || typeof window === 'undefined') return undefined;

    const dialog = manageDialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      dialog?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setManageListingTarget(null);
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
  }, [manageListingTarget]);

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
        body: JSON.stringify({ slug, bio, isPublic, logoUrl: showroomLogoUrl }),
      });
      const data = await response.json() as { ok?: boolean; showroom?: MiddlemanShowroom; error?: string };
      if (!response.ok || !data.ok || !data.showroom) throw new Error(data.error || 'Failed to save your showroom.');
      setShowroom(data.showroom);
      setSlug(data.showroom.slug);
      setBio(data.showroom.bio);
      setIsPublic(data.showroom.isPublic);
      setShowroomLogoUrl(data.showroom.showroomLogoUrl);
      setMessage('Showroom saved. Your public page is up to date.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save your showroom.');
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicLink() {
    const url = `${window.location.origin}${publicHref(showroom.slug)}`;
    await navigator.clipboard.writeText(url);
    setMessage('Public showroom link copied.');
  }

  async function downloadAdvert(listing: MarketplaceListing) {
    setBusyListingId(listing.id);
    setMessage('');
    try {
      const { blob } = await createMarketplaceAdJpeg(listing, {
        design: usesSavedBrandDesign && listing.adBrand ? 'saved-brand' : 'aim4price-marketplace',
      });
      downloadMarketplaceAd(blob, marketplaceAdFilename(listing.title));
      setMessage('JPEG advert downloaded.');
    } catch {
      setMessage('The JPEG could not be created. Please try again.');
    } finally {
      setBusyListingId('');
    }
  }

  function handleListingOutcomeRemoved(listing: MarketplaceListing) {
    setListings((current) => current.filter((item) => item.id !== listing.id));
    setOutcomeListingTarget(null);
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
      window.location.assign(dealerAppMode ? '/dealer' : '/account');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete your showroom.');
      setDeletingShowroom(false);
      setDeleteDialogOpen(false);
    }
  }

  return (
    <div className={`${styles.managerPage} ${dealerAppMode ? styles.managerPageMobile : ''}`}>
      <section className={styles.managerHero}>
        <div className={styles.managerHeroCopy}>
          <h1>A professional home for your machinery adverts</h1>
          <p>Keep your adverts together and share one polished link with customers.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href={valuationHref}><span aria-hidden="true">+</span> Value and create advert</Link>
          {showroom.isPublic ? <Link className={styles.secondaryButton} href={publicHref(showroom.slug)} target="_blank" rel="noreferrer">Open public showroom <span aria-hidden="true">↗</span></Link> : null}
        </div>
      </section>

      <div className={styles.managerGrid}>
        <section className={styles.settingsCard}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Showroom details</h2>
              <p>Choose how customers see and find your showroom.</p>
            </div>
            <span className={`${styles.statusText} ${isPublic ? styles.statusLive : ''}`}>{isPublic ? 'Live' : 'Hidden'}</span>
          </div>
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
                  ? 'This custom logo appears only on your public showroom.'
                  : showroom.inheritedLogoUrl
                    ? 'Using your saved brand logo. Drop a different logo here if needed.'
                    : 'Add a logo to personalise your public showroom.'}
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
          <div className={styles.advertDesignField}>
            <div>
              <strong>Advert design</strong>
              <span>
                {usesSavedBrandDesign
                  ? 'Downloads use your saved Brand Kit.'
                  : 'Downloads use the Aim4price Marketplace design.'}
              </span>
            </div>
            {advertDesignHref ? (
              <Link className={styles.advertDesignButton} href={advertDesignHref}>Edit advert design</Link>
            ) : null}
          </div>
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
                disabled={!showroom.isPublic || hasUnsavedShowroomChanges || saving}
                title={hasUnsavedShowroomChanges ? 'Save your changes before copying the public link.' : undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="8" y="8" width="11" height="11" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
                Copy link
              </button>
            </div>
          </div>
          <label>
            <span>Short introduction</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell customers which machinery, regions or services you specialise in."
            />
            <small>{bio.length} of 500 characters</small>
          </label>
          <label className={styles.switchRow}>
            <span><strong>Showroom visible to the public</strong><small>Anyone with the link can view your live adverts and contact details.</small></span>
            <span className={styles.switchControl}>
              <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
              <span aria-hidden="true" />
            </span>
          </label>
          <div className={styles.settingsActions}>
            <button className={styles.primaryButton} type="button" onClick={saveShowroom} disabled={saving || readingLogo}>{saving ? 'Saving...' : readingLogo ? 'Reading logo...' : 'Save changes'}</button>
          </div>
          {message ? <p className={styles.feedback} role="status">{message}</p> : null}
          <div className={styles.dangerZone}>
            <div>
              <strong>Delete showroom</strong>
              <small>{listings.length ? 'Remove each live advert and record its outcome first.' : 'Advert history, valuations and assets stay saved.'}</small>
            </div>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={listings.length > 0}
              title={listings.length ? 'Remove each live advert first.' : 'Delete showroom'}
            >
              Delete showroom
            </button>
          </div>
        </section>

        <section className={styles.stockCard}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Your live adverts</h2>
              <p>Manage the machinery currently shown to customers.</p>
            </div>
            <span className={styles.stockCount}>{listings.length} {listings.length === 1 ? 'advert' : 'adverts'}</span>
          </div>
          {listings.length ? (
            <div className={styles.managerListings}>
              {listings.map((listing) => {
                const rating = listingRating(listing);
                return (
                  <article className={styles.managerListing} key={listing.id}>
                    <img src={listing.imageSrc || '/brand/Tractor.png'} alt="" />
                    <div>
                      <div className={styles.listingTitleRow}>
                        <strong>{listing.title}</strong>
                        {rating ? <span className={`${styles.rating} ${styles[`rating_${rating.value}`]}`}>{rating.label}</span> : null}
                      </div>
                      <small>{listingDetails(listing)}</small>
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
              <h3>Your showroom is ready</h3>
              <p>Create your first advert and it will appear here automatically.</p>
              <Link className={styles.primaryButton} href={valuationHref}><span aria-hidden="true">+</span> Create an advert</Link>
            </div>
          )}
        </section>
      </div>

      {manageListingTarget ? (
        <div
          className={styles.listingManagerBackdrop} data-website-overlay
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setManageListingTarget(null);
          }}
        >
          <section
            ref={manageDialogRef}
            className={styles.listingManagerDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="showroom-listing-manager-title"
            aria-describedby="showroom-listing-manager-description"
            tabIndex={-1}
          >
            <header className={styles.listingManagerHeader}>
              <div>
                <h2 id="showroom-listing-manager-title">Manage advert</h2>
                <p id="showroom-listing-manager-description">Update, share or remove this advert from one place.</p>
              </div>
              <button
                className={styles.listingManagerClose}
                type="button"
                onClick={() => setManageListingTarget(null)}
                aria-label="Close advert manager"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className={styles.listingManagerSummary}>
              <img src={manageListingTarget.imageSrc || '/brand/Tractor.png'} alt="" />
              <div>
                <strong>{manageListingTarget.title}</strong>
                <span>{money(manageListingTarget.askingPriceExVat)} excl. VAT · {listingDetails(manageListingTarget)}</span>
              </div>
            </div>

            <div className={styles.listingManagerActions}>
              {manageListingTarget.sourceAssetId ? (
                <Link
                  className={styles.listingManagerPrimary}
                  href={dealerAppMode
                    ? `/dealer/marketplace?listing=${encodeURIComponent(manageListingTarget.id)}&manage=1`
                    : `/asset-register?assetId=${encodeURIComponent(manageListingTarget.sourceAssetId)}&action=marketplace-edit`}
                >
                  <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="edit" /></span>
                  <span className={styles.listingManagerActionCopy}><strong>Edit advert</strong><small>Update the price, description and seller details.</small></span>
                  <ShowroomManageActionArrow />
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
                  <ShowroomManageActionArrow />
                </button>
              )}
              <button
                type="button"
                onClick={() => void downloadAdvert(manageListingTarget)}
                disabled={busyListingId === manageListingTarget.id}
              >
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="download" /></span>
                <span className={styles.listingManagerActionCopy}>
                  <strong>Download JPEG</strong>
                  <small>{usesSavedBrandDesign && manageListingTarget.adBrand ? 'Use the Brand Kit saved with this advert.' : 'Use the standard Aim4price Marketplace advert design.'}</small>
                </span>
                <ShowroomManageActionArrow direction="down" />
              </button>
              <Link
                href={`${dealerAppMode ? '/dealer/marketplace' : '/marketplace'}?listing=${encodeURIComponent(manageListingTarget.id)}&manage=1`}
              >
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="marketplace" /></span>
                <span className={styles.listingManagerActionCopy}><strong>Open in Marketplace</strong><small>View the advert and continue managing it in Marketplace.</small></span>
                <ShowroomManageActionArrow />
              </Link>
              <button
                type="button"
                className={styles.listingManagerRemove}
                onClick={() => {
                  setOutcomeListingTarget(manageListingTarget);
                  setManageListingTarget(null);
                }}
              >
                <span className={styles.listingManagerActionIcon}><ShowroomManageActionIcon name="remove" /></span>
                <span className={styles.listingManagerActionCopy}><strong>Remove advert</strong><small>Record the outcome and withdraw it everywhere.</small></span>
                <ShowroomManageActionArrow />
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
          <section className={styles.deleteDialog} role="dialog" aria-modal="true" aria-labelledby="delete-showroom-title" onClick={(event) => event.stopPropagation()}>
            <span className={styles.deleteIcon}>!</span>
            <h2 id="delete-showroom-title">Delete showroom?</h2>
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
      <header className={styles.publicTopbar}>
        <div className={styles.publicTopbarInner}>
          <Link href="/" className={styles.aim4priceMark} aria-label="Aim4price home">
            <img src="/brand/Aim4price_Home_Logo.png" alt="Aim4price" />
          </Link>
          <Link className={styles.publicTopbarAction} href="/valuation">Value your machinery</Link>
        </div>
      </header>
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
                  : <p className={styles.publicTrustLine}>Clear equipment details and direct seller contact.</p>}
              </div>
            </div>
            <div className={styles.publicContactActions} role="group" aria-label={`${showroom.name} contact options`}>
              {showroom.phone ? <a className={styles.whatsappButton} href={whatsappHref(showroom.phone)} target="_blank" rel="noreferrer" aria-label={`Chat with ${showroom.name} on WhatsApp`}>Chat on WhatsApp</a> : null}
              {showroom.phone ? <a className={styles.secondaryButton} href={`tel:${showroom.phone}`} aria-label={`Call ${showroom.name} at ${showroom.phone}`}>Call business</a> : null}
              {showroom.email ? <a className={styles.secondaryButton} href={`mailto:${showroom.email}`} aria-label={`Email ${showroom.name} at ${showroom.email}`}>Email business</a> : null}
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
          <div><strong>Hosted on Aim4price.com</strong><span>Professional machinery advertising and direct seller contact.</span></div>
          <Link href="/valuation">Value your machinery</Link>
        </div>
      </footer>
    </div>
  );
}

