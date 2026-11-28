'use client';

import { saleabilityEaseLabel, validSaleabilityEase, type SavedSaleability } from '../lib/asset-saleability';
import { marketplaceDealComparison } from '../lib/selling-price';
import StudioIcon from './StudioIcon';
import styles from './MarketplacePublishReview.module.css';

type Draft = { title: string; photos: string[]; description: string; sellerName: string; sellerCompany: string; sellerPhone: string; sellerEmail: string; province: string; area: string; showDealRating: boolean };
export default function MarketplacePublishReview({ draft, price, vatIncluded, idealValue, assessment, saved, stale, loading, loadError, busy, onRatingChange, onCalculate }: {
  draft: Draft; price: number; vatIncluded: boolean; idealValue?: number | null;
  assessment?: { priceExVat: number; needsReview: boolean } | null;
  saved?: SavedSaleability; stale: boolean; loading: boolean; loadError: boolean; busy: boolean;
  onRatingChange: (show: boolean) => void; onCalculate: () => void;
}) {
  const comparison = loading || loadError ? null : marketplaceDealComparison({ askingPriceExVat: price, aim4priceValueExVat: idealValue, realisticSellingPriceExVat: assessment?.priceExVat, sellingPriceNeedsReview: assessment?.needsReview });
  const ease = !loading && !loadError && !stale && validSaleabilityEase(saved?.ease) ? saved!.ease! : null;
  const answers = saved?.answers;
  const demand = {strong:'Strong demand',normal:'Normal demand',weak:'Weak demand',unknown:'Demand not confirmed'};
  const buyers = {many:'Broad buyer pool',moderate:'Moderate buyer pool',few:'Small buyer pool',specialist:'Specialist buyers',unknown:'Buyer pool not confirmed'};
  return <div className={styles.review}>
    <article className={styles.preview} aria-label="Listing preview">
      {draft.photos[0] ? <img className={styles.photo} src={draft.photos[0]} alt={draft.title} /> : <div className={styles.noPhoto}><StudioIcon name="image" /><span>No listing photo</span></div>}
      <div className={styles.details}><small>Listing preview</small><h4>{draft.title}</h4>
        <strong className={styles.price}>R {(price * (vatIncluded ? 1.15 : 1)).toLocaleString('en-ZA', {maximumFractionDigits: 0})} <small>{vatIncluded ? 'Incl. VAT' : 'Excl. VAT'}</small></strong>
        {draft.showDealRating && comparison ? <div className={styles.rating} aria-live="polite"><strong>{comparison.label}</strong><span>{comparison.difference}</span></div> : null}
        <p>{Array.from(new Set([draft.area, draft.province].filter(Boolean))).join(', ')}</p>
        {draft.description ? <p className={styles.notes}>{draft.description}</p> : null}
        <div className={styles.seller}><strong>{draft.sellerCompany || draft.sellerName}</strong><span>{draft.sellerName} · {draft.sellerPhone}</span>{draft.sellerEmail ? <span>{draft.sellerEmail}</span> : null}<small>Contact details are shown to signed-in buyers.</small></div>
      </div>
    </article>
    <aside className={styles.options}>
      <section className={styles.panel} aria-labelledby="marketplace-rating-heading">
        <div className={styles.heading}><span className={styles.icon}><StudioIcon name="price" /></span><h4 id="marketplace-rating-heading">Value rating</h4></div>
        <div className={styles.switchRow}><span id="marketplace-rating-label">Show value rating</span><button type="button" role="switch" aria-labelledby="marketplace-rating-label" aria-describedby="marketplace-rating-help" aria-checked={draft.showDealRating && !!comparison} disabled={busy || !comparison} className={styles.switch} onClick={() => onRatingChange(!draft.showDealRating)}><span /></button></div>
        <p id="marketplace-rating-help">{loading ? 'Loading your saved assessment…' : loadError ? 'Assessment unavailable. You can publish without a rating.' : comparison ? 'Compare your asking price with the estimate.' : 'No current estimate. Publish without a rating.'}</p>
        {comparison ? <small>{comparison.basis === 'realistic' ? 'Based on your saved realistic selling price.' : 'Based on the ideal selling price, not a market assessment.'}</small> : null}
      </section>
      <section className={styles.panel} aria-labelledby="marketplace-saleability-heading">
        <div className={styles.heading}><span className={`${styles.icon} ${styles.saleIcon}`}><StudioIcon name="review" /></span><h4 id="marketplace-saleability-heading">How easy is it to sell?</h4></div>
        <small className={styles.private}>Only you can see this</small>
        {ease ? <><div className={styles.score}><strong>{saleabilityEaseLabel(ease.score)}</strong><span>{ease.score}/100</span></div><meter min={0} max={100} value={ease.score} aria-label="Ease of selling" />
          <p>{[answers && demand[answers.currentDemand], answers && buyers[answers.realisticBuyerPool]].filter(Boolean).join(' · ')}</p>
          <small>{ease.provisional ? 'Provisional assessment. ' : ''}Based on your saved answers and selling plan. Not a guarantee of sale.</small>
        </> : <p>{loading ? 'Loading your assessment…' : loadError ? 'Your assessment could not be loaded.' : stale ? 'Your asset has changed. Calculate a fresh realistic price.' : 'Calculate a realistic price to see your selling assessment.'}</p>}
        <button type="button" className={styles.calculate} disabled={busy || loading} onClick={onCalculate}><StudioIcon name="price" />Calculate realistic price</button>
      </section>
      <p className={styles.help}>Use Back to adjust your asking price or listing details before publishing.</p>
    </aside>
  </div>;
}
