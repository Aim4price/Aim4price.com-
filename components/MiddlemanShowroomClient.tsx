'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { MarketplaceDealRating, MarketplaceListing } from '../lib/marketplace';
import {
  createMarketplaceAdJpeg,
  downloadMarketplaceAd,
  marketplaceAdFilename,
} from '../lib/marketplace-ad-renderer';
import type { MiddlemanShowroom } from '../lib/middleman-showroom-db';
import styles from './MiddlemanShowroomClient.module.css';

type ManagerProps = {
  initialShowroom: MiddlemanShowroom;
  initialListings: MarketplaceListing[];
  dealerAppMode?: boolean;
};

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
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingShowroom, setDeletingShowroom] = useState(false);
  const [busyListingId, setBusyListingId] = useState('');
  const [message, setMessage] = useState('');
  const valuationHref = dealerAppMode ? '/dealer/valuation' : '/valuation';

  async function saveShowroom() {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/middleman-showroom', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, bio, isPublic }),
      });
      const data = await response.json() as { ok?: boolean; showroom?: MiddlemanShowroom; error?: string };
      if (!response.ok || !data.ok || !data.showroom) throw new Error(data.error || 'Failed to save your showroom.');
      setShowroom(data.showroom);
      setSlug(data.showroom.slug);
      setBio(data.showroom.bio);
      setIsPublic(data.showroom.isPublic);
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
        <div>
          <span className={styles.eyebrow}>My showroom</span>
          <h1>Your professional machinery window.</h1>
          <p>Every advert shown here comes from an Aim4price valuation. Share one link instead of rebuilding a stock list for every customer.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href={valuationHref}>+ Value & create advert</Link>
          {showroom.isPublic ? <Link className={styles.secondaryButton} href={publicHref(showroom.slug)} target="_blank">View public showroom</Link> : null}
        </div>
      </section>

      <div className={styles.managerGrid}>
        <section className={styles.settingsCard}>
          <div className={styles.sectionHeading}>
            <div>
              <span>Public profile</span>
              <h2>Showroom details</h2>
            </div>
            <span className={`${styles.statusPill} ${isPublic ? styles.statusLive : ''}`}>{isPublic ? 'Live' : 'Hidden'}</span>
          </div>
          <label>
            <span>Public showroom link</span>
            <div className={styles.slugField}>
              <b>aim4price.com/showroom/</b>
              <input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={60} autoCapitalize="none" />
            </div>
          </label>
          <label>
            <span>Short introduction</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell customers which machinery, regions or services you specialise in."
            />
            <small>{bio.length}/500</small>
          </label>
          <label className={styles.switchRow}>
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
            <span><strong>Public showroom</strong><small>Anyone with your link can see your live adverts and contact details. Hiding this page does not remove adverts from Marketplace.</small></span>
          </label>
          <div className={styles.settingsActions}>
            <button className={styles.primaryButton} type="button" onClick={saveShowroom} disabled={saving}>{saving ? 'Saving...' : 'Save showroom'}</button>
            <button className={styles.secondaryButton} type="button" onClick={copyPublicLink} disabled={!showroom.isPublic}>Copy link</button>
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
              <span>Valuation-backed stock</span>
              <h2>{listings.length} live {listings.length === 1 ? 'advert' : 'adverts'}</h2>
            </div>
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
              <span>A4P</span>
              <h3>No live adverts yet</h3>
              <p>Start a valuation, confirm the asking price and choose Create advert. It will appear here automatically.</p>
              <Link className={styles.primaryButton} href={valuationHref}>Start first valuation</Link>
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
  showroom: MiddlemanShowroom;
  listings: MarketplaceListing[];
}) {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const families = useMemo(() => Array.from(new Set(listings.map((listing) => listing.familyLabel).filter(Boolean) as string[])).sort(), [listings]);
  const filtered = useMemo(() => listings.filter((listing) => {
    const matchesFamily = family === 'all' || listing.familyLabel === family;
    const haystack = `${listing.title} ${listing.brandName} ${listing.modelName} ${listing.familyLabel} ${listing.location}`.toLowerCase();
    return matchesFamily && haystack.includes(query.trim().toLowerCase());
  }), [family, listings, query]);

  return (
    <main className={styles.publicPage}>
      <header className={styles.publicTopbar}>
        <Link href="/" className={styles.aim4priceMark}>AIM4PRICE</Link>
        <span>Valuation-backed machinery</span>
      </header>
      <section className={styles.publicHero}>
        <div className={styles.profileIdentity}>
          {showroom.logoUrl ? <img src={showroom.logoUrl} alt={`${showroom.name} logo`} /> : <span>{showroom.name.slice(0, 2).toUpperCase()}</span>}
          <div>
            <small>Professional machinery showroom</small>
            <h1>{showroom.name}</h1>
            {showroom.location ? <p>{showroom.location}</p> : null}
          </div>
        </div>
        <div className={styles.publicContactActions}>
          {showroom.phone ? <a className={styles.whatsappButton} href={whatsappHref(showroom.phone)} target="_blank" rel="noreferrer">WhatsApp</a> : null}
          {showroom.phone ? <a className={styles.secondaryButton} href={`tel:${showroom.phone}`}>Call {showroom.phone}</a> : null}
        </div>
        {showroom.bio ? <p className={styles.publicBio}>{showroom.bio}</p> : null}
        <div className={styles.trustStrip}>
          <strong>Every advert starts with an Aim4price valuation</strong>
          <span>Clear equipment details · Consistent pricing context · Direct seller contact</span>
        </div>
      </section>

      <section className={styles.publicInventory}>
        <div className={styles.inventoryHeading}>
          <div><span>Available machinery</span><h2>{filtered.length} {filtered.length === 1 ? 'listing' : 'listings'}</h2></div>
          <div className={styles.publicFilters}>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search make, model or location" />
            <select value={family} onChange={(event) => setFamily(event.target.value)} aria-label="Filter by machinery type">
              <option value="all">All machinery</option>
              {families.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {filtered.length ? (
          <div className={styles.publicGrid}>
            {filtered.map((listing) => {
              const rating = listingRating(listing);
              return (
                <article className={styles.publicCard} key={listing.id}>
                  <div className={styles.publicImage}>
                    <img src={listing.imageSrc || '/brand/Tractor.png'} alt={listing.title} />
                    {rating ? <span className={`${styles.rating} ${styles[`rating_${rating.value}`]}`}>{rating.label}</span> : null}
                    {listing.imageUrls.length > 1 ? <small>{listing.imageUrls.length} photos</small> : null}
                  </div>
                  <div className={styles.publicCardBody}>
                    <span>{listing.familyLabel || 'Machinery'} · {listing.location}</span>
                    <h3>{listing.title}</h3>
                    <p>{listingDetails(listing)}</p>
                    <strong>{money(listing.askingPriceExVat)} <small>excl. VAT</small></strong>
                    {showroom.phone ? <a href={whatsappHref(showroom.phone, listing)} target="_blank" rel="noreferrer">Enquire on WhatsApp</a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.publicEmpty}><h3>No matching machinery</h3><p>Try a different search or choose All machinery.</p></div>
        )}
      </section>

      <footer className={styles.publicFooter}>
        <div><strong>Created with Aim4price</strong><span>Machinery valuation and professional advertising in one flow.</span></div>
        <Link href="/valuation">Value your machinery</Link>
      </footer>
    </main>
  );
}
