'use client';

import { useState } from 'react';
import type { MarketplaceListing } from '../lib/marketplace';
import { marketplaceListingToAdContent } from '../lib/marketplace-ad-renderer';
import styles from './FacebookAdvertActions.module.css';

export default function FacebookAdvertActions({ listing }: { listing: MarketplaceListing }) {
  const [feedback, setFeedback] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const content = marketplaceListingToAdContent(listing);
  const price = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(content.askingPriceExVat);
  const vat = content.brand.vatLabel === 'vat-included' ? 'VAT included' : content.brand.vatLabel === 'no-vat' ? 'No VAT' : '+ VAT';
  const caption = [
    content.title,
    `${price} ${vat}`,
    [content.year, content.usage, content.condition].filter(Boolean).join(' · '),
    content.location,
    listing.description?.trim(),
    [content.sellerCompany, content.sellerName, content.sellerPhone, content.brand.email].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n\n');

  async function copyText() {
    try {
      await navigator.clipboard.writeText(caption);
      setManualCopy(false);
      setFeedback('Advert text copied. Paste it into your Facebook advert.');
    } catch {
      setManualCopy(true);
      setFeedback('Select and copy the advert text below.');
    }
  }

  return <section className={styles.panel} aria-label="Advertise on Facebook">
    <div className={styles.heading}>
      <strong>Advertise on Facebook</strong>
      <button type="button" onClick={() => void copyText()}>Copy advert text</button>
    </div>
    <p>Save your JPEG and copy the text, then open Facebook to upload your photo and create your advert.</p>
    <div className={styles.destinations}>
      <a href="https://www.facebook.com/marketplace/" target="_blank" rel="noopener noreferrer" aria-label="Facebook Marketplace (opens in a new tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6" /></svg>
        <span>Marketplace</span>
      </a>
      <a href="https://www.facebook.com/groups/" target="_blank" rel="noopener noreferrer" aria-label="Facebook Groups (opens in a new tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" /></svg>
        <span>Groups</span>
      </a>
    </div>
    <small>Sign in to Facebook if asked. For groups, choose a group you can post in.</small>
    {feedback ? <p role="status">{feedback}</p> : null}
    {manualCopy ? <textarea aria-label="Advert text to copy" value={caption} readOnly rows={6} onFocus={(event) => event.currentTarget.select()} /> : null}
  </section>;
}
