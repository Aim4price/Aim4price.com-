'use client';

import Link from 'next/link';
import { type DragEvent, useRef, useState } from 'react';
import MarketplaceClient from '../app/marketplace/marketplace-client';
import type { MarketplaceDealRating, MarketplaceListing } from '../lib/marketplace';
import {
  createMarketplaceAdJpeg,
  downloadMarketplaceAd,
  marketplaceAdFilename,
} from '../lib/marketplace-ad-renderer';
import type { MiddlemanShowroom, PublicMiddlemanShowroomData } from '../lib/middleman-showroom-db';
import styles from './MiddlemanShowroomClient.module.css';

type ManagerProps = {
  initialShowroom: MiddlemanShowroom;
  initialListings: MarketplaceListing[];
  dealerAppMode?: boolean;
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

export function MiddlemanShowroomManager({
  initialShowroom,
  initialListings,
  dealerAppMode = false,
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
  const [message, setMessage] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const valuationHref = dealerAppMode ? '/dealer/valuation' : '/valuation';
  const logoPreviewUrl = showroomLogoUrl || showroom.inheritedLogoUrl;
  const hasUnsavedShowroomChanges = slug !== showroom.slug
    || bio !== showroom.bio
    || isPublic !== showroom.isPublic
    || showroomLogoUrl !== showroom.showroomLogoUrl;

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
      const { blob } = await createMarketplaceAdJpeg(listing);
      downloadMarketplaceAd(blob, marketplaceAdFilename(listing.title));
      setMessage('JPEG advert downloaded.');
    } catch {
      setMessage('The JPEG could not be created. Please try again.');
    } finally {
      setBusyListingId('');
    }
  }

  async function hideListing(listing: MarketplaceListing) {
    if (!listing.sourceAssetId || !window.confirm('Remove this advert from Marketplace and your showroom?')) return;
    setBusyListingId(listing.id);
    setMessage('');
    try {
      const response = await fetch(`/api/marketplace?assetId=${encodeURIComponent(listing.sourceAssetId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to hide the advert.');
      setListings((current) => current.filter((item) => item.id !== listing.id));
      setMessage('Advert removed from Marketplace and your showroom.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to hide the advert.');
    } finally {
      setBusyListingId('');
    }
  }

  async function deleteShowroom() {
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
      setListings([]);
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
          <p>Keep your live stock together, share one simple link and give every customer a polished view backed by Aim4price valuations.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href={valuationHref}><span aria-hidden="true">+</span> Value and create advert</Link>
          {showroom.isPublic ? <Link className={styles.secondaryButton} href={publicHref(showroom.slug)} target="_blank">Open public showroom <span aria-hidden="true">↗</span></Link> : null}
        </div>
      </section>

      <div className={styles.managerGrid}>
        <section className={styles.settingsCard}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Showroom details</h2>
              <p>Choose how customers see and find your showroom.</p>
            </div>
            <span className={`${styles.statusPill} ${isPublic ? styles.statusLive : ''}`}>{isPublic ? 'Live' : 'Hidden'}</span>
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
              <small>Permanently removes the public showroom and withdraws all its adverts from Marketplace. Saved valuations and assets remain available.</small>
            </div>
            <button type="button" onClick={() => setDeleteDialogOpen(true)}>Delete showroom</button>
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
                      <button type="button" onClick={() => downloadAdvert(listing)} disabled={busyListingId === listing.id}>Download JPEG</button>
                      <button className={styles.dangerButton} type="button" onClick={() => hideListing(listing)} disabled={busyListingId === listing.id}>Remove</button>
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

      {deleteDialogOpen ? (
        <div className={styles.deleteBackdrop} onClick={() => !deletingShowroom && setDeleteDialogOpen(false)}>
          <section className={styles.deleteDialog} role="dialog" aria-modal="true" aria-labelledby="delete-showroom-title" onClick={(event) => event.stopPropagation()}>
            <span className={styles.deleteIcon}>!</span>
            <h2 id="delete-showroom-title">Delete showroom and every advert?</h2>
            <p>This withdraws all {listings.length} live {listings.length === 1 ? 'advert' : 'adverts'} from the normal Aim4price Marketplace and permanently deletes the public showroom. Your valuations and saved asset records are not deleted.</p>
            <label>
              <span>Type DELETE to confirm</span>
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} placeholder="DELETE" autoComplete="off" />
            </label>
            <div>
              <button type="button" className={styles.secondaryButton} onClick={() => setDeleteDialogOpen(false)} disabled={deletingShowroom}>Cancel</button>
              <button type="button" className={styles.deleteConfirmButton} onClick={deleteShowroom} disabled={deleteConfirmation !== 'DELETE' || deletingShowroom}>{deletingShowroom ? 'Deleting...' : 'Delete showroom & adverts'}</button>
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
              {showroom.logoUrl ? <img src={showroom.logoUrl} alt={`${showroom.name} logo`} /> : <span>{showroom.name.slice(0, 2).toUpperCase()}</span>}
              <div>
                <h1>{showroom.name}</h1>
                <p className={styles.publicAdvertSummary}>{listings.length} live {listings.length === 1 ? 'advert' : 'adverts'}</p>
                {showroom.bio ? <p className={styles.publicBio}>{showroom.bio}</p> : null}
              </div>
            </div>
            <div className={styles.publicContactActions}>
              {showroom.phone ? <a className={styles.whatsappButton} href={whatsappHref(showroom.phone)} target="_blank" rel="noreferrer">Chat on WhatsApp</a> : null}
              {showroom.phone ? <a className={styles.secondaryButton} href={`tel:${showroom.phone}`}>Call business</a> : null}
              {showroom.email ? <a className={styles.secondaryButton} href={`mailto:${showroom.email}`}>Email business</a> : null}
            </div>
          </div>
          {showroom.location || showroom.phone || showroom.email || showroom.websiteUrl ? (
            <div className={styles.publicBusinessDetails}>
              {showroom.location ? (
                <div><span>Location</span><strong>{showroom.location}</strong></div>
              ) : null}
              {showroom.phone ? (
                <a href={`tel:${showroom.phone}`}><span>Phone</span><strong>{showroom.phone}</strong></a>
              ) : null}
              {showroom.email ? (
                <a href={`mailto:${showroom.email}`}><span>Email</span><strong>{showroom.email}</strong></a>
              ) : null}
              {showroom.websiteUrl ? (
                <a href={showroom.websiteUrl} target="_blank" rel="noreferrer"><span>Website</span><strong>{websiteLabel(showroom.websiteUrl)}</strong></a>
              ) : null}
            </div>
          ) : null}
          <p className={styles.publicTrustLine}>Every advert is backed by an Aim4price valuation.</p>
        </div>
      </section>

      <section className={styles.marketplaceInventory} aria-label={`${showroom.name} showroom inventory`}>
        <div className={styles.inventoryIntro}>
          <div>
            <h2>Available equipment</h2>
            <p>Browse valuation-backed equipment from {showroom.name} and contact the business directly.</p>
          </div>
          <span className={styles.inventorySummary}>{listings.length} live {listings.length === 1 ? 'advert' : 'adverts'}</span>
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
          <div><strong>Hosted on Aim4price.com</strong><span>Professional machinery advertising backed by valuations.</span></div>
          <Link href="/valuation">Value your machinery</Link>
        </div>
      </footer>
    </div>
  );
}
