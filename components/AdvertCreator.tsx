'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AD_TEMPLATE_OPTIONS, type AdBrandKit, type AdBrandSnapshot, type AdTemplateId } from '../lib/ad-studio';
import { advertDetailsError, advertStepErrors, type AdvertFieldErrors, estimateMatchesAdvert, type AdvertDetails, type AdvertEstimate } from '../lib/advert-creator';
import { downloadMarketplaceAd, getMarketplaceAdRating, renderMarketplaceAdCanvas, type MarketplaceAdContent } from '../lib/marketplace-ad-renderer';
import type { AdvertSourceAsset } from '../lib/advert-source';
import styles from './AdvertCreator.module.css';
import studioStyles from './AdStudioClient.module.css';
import StudioIcon, { type StudioIconName } from './StudioIcon';
import marketplaceStyles from '../app/asset-register/page.module.css';
import MarketplacePriceInput from './MarketplacePriceInput';
import MarketplacePhotoEditor from './MarketplacePhotoEditor';
import { pricingVatAmount } from '../lib/pricing-vat';
import { calculateMarketplaceDealRating } from '../lib/marketplace';



const TEMPLATE_CLASSES: Record<AdTemplateId, string> = {
  showcase: studioStyles.templateShowcase, 'price-focus': studioStyles.templatePriceFocus,
  'photo-first': studioStyles.templatePhotoFirst, classic: studioStyles.templateClassic,
  minimal: studioStyles.templateMinimal, 'duo-split': studioStyles.templateDuoSplit,
  'gallery-three': studioStyles.templateGalleryThree, 'catalogue-grid': studioStyles.templateCatalogueGrid,
};
const STEP_ICONS: StudioIconName[] = ['details', 'image', 'review'];

export default function AdvertCreator({ kits, fallbackBrand, estimateHref, estimatesEndpoint }: {
  kits: AdBrandKit[]; fallbackBrand: AdBrandSnapshot; estimateHref: string; estimatesEndpoint: string;
}) {
  const defaultKit = kits.find(kit => kit.isDefault) ?? kits[0];
  const [brandId, setBrandId] = useState(defaultKit?.id ?? '');
  const brand = kits.find(kit => kit.id === brandId) ?? fallbackBrand;
  const [template, setTemplate] = useState<AdTemplateId>(defaultKit?.templateId ?? 'showcase');
  const [details, setDetails] = useState<AdvertDetails>(() => ({
    title: '', year: '', usage: '', usageUnit: 'hours', condition: 'good', askingPrice: '',
    vatLabel: (defaultKit ?? fallbackBrand).vatLabel, location: '', description: '',
    contactName: (defaultKit ?? fallbackBrand).contactName, phone: (defaultKit ?? fallbackBrand).phone,
    email: (defaultKit ?? fallbackBrand).email, businessName: (defaultKit ?? fallbackBrand).businessName,
  }));
  const [step, setStep] = useState(0);
  const [advertSource, setAdvertSource] = useState<'manual' | 'asset' | 'estimate'>('manual');
  const [source, setSource] = useState<'asset' | 'estimate' | null>(null);
  const [assets, setAssets] = useState<AdvertSourceAsset[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceStatus, setSourceStatus] = useState('');
  const [search, setSearch] = useState('');
  const [furthestStep, setFurthestStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<AdvertFieldErrors>({});
  const fieldError = (key: keyof AdvertFieldErrors) => fieldErrors[key] ? <small id={`advert-error-${key}`} className={styles.fieldError} role="alert">{fieldErrors[key]}</small> : null;
  const fieldA11y = (key: keyof AdvertFieldErrors) => ({ 'aria-invalid': Boolean(fieldErrors[key]), 'aria-describedby': fieldErrors[key] ? `advert-error-${key}` : undefined });
  const [photos, setPhotos] = useState<string[]>([]);
  const photosRef = useRef(photos);
  const [estimates, setEstimates] = useState<AdvertEstimate[]>([]);
  const [estimate, setEstimate] = useState<AdvertEstimate | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [estimateStatus, setEstimateStatus] = useState('');
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [step, source]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [province, setProvince] = useState('');
  const [area, setArea] = useState('');
  const hasEstimate = estimateMatchesAdvert(estimate, details);
  const hasEnoughPhotos = photos.length >= (AD_TEMPLATE_OPTIONS.find(item => item.id === template)?.photoCount ?? 1);
  const content = useMemo<MarketplaceAdContent>(() => ({
    title: details.title, year: details.year,
    usage: details.usage && details.usageUnit !== 'none' ? `${Number(details.usage).toLocaleString('en-ZA')}${details.usageUnit === 'percent' ? '% worked' : ` ${details.usageUnit}`}` : '',
    condition: details.condition === 'serious' ? 'Needs repairs' : details.condition.charAt(0).toUpperCase() + details.condition.slice(1), familyLabel: 'Equipment',
    askingPriceExVat: pricingVatAmount(Number(details.askingPrice), details.vatLabel === 'vat-included'),
    ratingAskingPriceExVat: Number(details.askingPrice),
    realisticSellingPriceExVat: hasEstimate ? estimate?.realisticSellingPriceExVat : null,
    sellingPriceNeedsReview: hasEstimate ? estimate?.sellingPriceNeedsReview : false,
    dealRating: calculateMarketplaceDealRating({ askingPriceExVat: Number(details.askingPrice), aim4priceValueExVat: hasEstimate ? estimate?.valueExVat : null }).rating,
    aim4priceValueExVat: hasEstimate ? estimate?.valueExVat : null,
    showDealRating: hasEstimate && showRating,
    sellerName: details.contactName, sellerPhone: details.phone, sellerCompany: details.businessName,
    location: [area, province].filter(Boolean).join(', '), imageUrls: photos,
    brand: { ...brand, templateId: template, vatLabel: details.vatLabel, contactName: details.contactName, phone: details.phone, email: details.email, businessName: details.businessName },
  }), [details, brand, template, photos, hasEstimate, estimate, showRating, area, province]);
  const rating = getMarketplaceAdRating(content);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => { if (!hasEstimate) setShowRating(false); }, [hasEstimate]);
  useEffect(() => {
    if (step !== 3 || !canvasRef.current) return;
    let active = true;
    setRendering(true);
    const scratch = document.createElement('canvas');
    renderMarketplaceAdCanvas(scratch, content, { useBestPhotoFit: false, requireImages: true }).then(() => {
      if (!active || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = scratch.width; canvas.height = scratch.height;
      canvas.getContext('2d')?.drawImage(scratch, 0, 0);
      if (dialogRef.current?.open && largeCanvasRef.current) largeCanvasRef.current.getContext('2d')?.drawImage(scratch, 0, 0);
    }).catch(() => { if (active) setError('Could not render a photo. Remove it and upload it again.'); })
      .finally(() => { if (active) setRendering(false); });
    return () => { active = false; };
  }, [content, step]);

  function update<K extends keyof AdvertDetails>(key: K, value: AdvertDetails[K]) {
    setDetails(current => ({ ...current, [key]: value })); setFieldErrors(current => ({ ...current, [key]: undefined })); setError(''); setStatus('');
    if (['title', 'year', 'usage', 'usageUnit', 'condition'].includes(key)) { setEstimate(null); setShowRating(false); }
  }
  function chooseStyle(id: string) {
    setBrandId(id);
    const chosen = kits.find(kit => kit.id === id) ?? fallbackBrand;
    setDetails(current => ({ ...current, contactName: chosen.contactName, phone: chosen.phone, email: chosen.email, businessName: chosen.businessName, vatLabel: chosen.vatLabel }));
    setTemplate(AD_TEMPLATE_OPTIONS.find(item => item.id === chosen.templateId)!.photoCount <= photos.length ? chosen.templateId : 'photo-first');
  }
  function goTo(next: number) {
    if (uploading) return;
    setError(''); setStatus(''); setFieldErrors({});
    if (next > step) {
      for (const prerequisite of [1, 2] as const) {
        if (prerequisite >= next) break;
        const errors = advertStepErrors(details, prerequisite, photos.length);
        if (Object.keys(errors).length) {
          setStep(prerequisite); setFieldErrors(errors);
          requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="Advert Creator"] [aria-invalid="true"]')?.focus());
          return;
        }
      }
    }
    if (next === 3 && !hasEnoughPhotos) setTemplate('photo-first');
    setFurthestStep(current => Math.max(current, next));
    setStep(next);
  }
  async function loadEstimates() {
    setEstimateLoading(true); setEstimateStatus('');
    try {
      const response = await fetch(estimatesEndpoint, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not load estimates.');
      setEstimates(payload.estimates);
      if (!payload.estimates.length) setEstimateStatus('No saved estimates yet. You can create your advert without one.');
    } catch (e) { setEstimateStatus(e instanceof Error ? e.message : 'Could not load estimates.'); }
    finally { setEstimateLoading(false); }
  }
  function useEstimate(id: string) {
    const selected = estimates.find(item => item.id === id) ?? null;
    setEstimate(selected); setShowRating(false); setFieldErrors({});
    if (selected) setDetails(current => ({ ...current, title: selected.title, year: selected.year, usage: selected.usage, usageUnit: selected.usageUnit, condition: selected.condition }));
  }
  async function chooseSource(next: 'asset' | 'estimate') {
    setSource(next); setSearch(''); setSourceStatus('');
    if (next === 'estimate') { await loadEstimates(); return; }
    setSourceLoading(true);
    try {
      const response = await fetch(estimatesEndpoint.replace(/\/estimates$/, '/assets'), { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not load assets.');
      setAssets(payload.assets);
      if (!payload.assets.length) setSourceStatus('No assets yet. Start manually to create your advert.');
    } catch (cause) { setSourceStatus(cause instanceof Error ? cause.message : 'Could not load assets.'); }
    finally { setSourceLoading(false); }
  }
  function startAdvert(asset?: AdvertSourceAsset, savedEstimate?: AdvertEstimate) {
    setAdvertSource(asset ? 'asset' : savedEstimate ? 'estimate' : 'manual');
    const chosen = kits.find(kit => kit.id === brandId) ?? fallbackBrand;
    setDetails({ title: '', year: '', usage: '', usageUnit: 'hours', condition: 'good', askingPrice: '',
      vatLabel: chosen.vatLabel, location: '', description: '', contactName: chosen.contactName,
      phone: chosen.phone, email: chosen.email, businessName: chosen.businessName,
      ...(asset?.details ?? {}), ...(savedEstimate ? { title: savedEstimate.title, year: savedEstimate.year,
        usage: savedEstimate.usage, usageUnit: savedEstimate.usageUnit, condition: savedEstimate.condition } : {}),
    });
    changePhotos(asset?.photos ?? []); setProvince(asset?.province ?? ''); setArea(asset?.area ?? '');
    setEstimate(asset?.estimate ?? savedEstimate ?? null); setShowRating(false);
    setFieldErrors({}); setError(''); setStatus(''); setFurthestStep(1); setStep(1);
  }
  async function uploadPhotos(files: File[]): Promise<string[]> {
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10_000_000)) throw new Error('Choose JPG, PNG or WebP photos, up to 10 MB each.');
    const added: string[] = [];
    try {
      for (const file of files) {
        const bitmap = await createImageBitmap(file); bitmap.close();
        added.push(URL.createObjectURL(file));
      }
      return added;
    } catch (cause) { added.forEach(url => URL.revokeObjectURL(url)); throw new Error('One of these photos could not be opened. Choose another image.'); }
  }
  function changePhotos(next: string[]) {
    photos.filter(url => !next.includes(url)).forEach(url => URL.revokeObjectURL(url));
    photosRef.current = next;
    setPhotos(next); setFieldErrors(current => ({ ...current, photos: undefined })); setError('');
  }
  function openPreview() {
    if (!canvasRef.current || !largeCanvasRef.current || rendering) return;
    largeCanvasRef.current.getContext('2d')?.drawImage(canvasRef.current, 0, 0);
    dialogRef.current?.showModal(); dialogRef.current?.querySelector<HTMLButtonElement>('[data-modal-close]')?.focus();
  }
  const shareText = [details.title, [details.year, content.usage, content.condition].filter(Boolean).join(' · '), `R ${pricingVatAmount(Number(details.askingPrice), details.vatLabel === 'vat-included').toLocaleString('en-ZA')} ${details.vatLabel === 'plus-vat' ? '+ VAT' : details.vatLabel === 'vat-included' ? 'VAT included' : 'No VAT'}`, details.description, content.location, `${details.contactName} · ${details.phone}`, details.email].filter(Boolean).join('\n');
  async function exportPng(share = false) {
    const message = advertDetailsError(details);
    if (message || !hasEnoughPhotos) { setError(message || 'Add the photos required by this layout.'); return; }
    setBusy(true); setError(''); setStatus('');
    try {
      const canvas = document.createElement('canvas');
      await renderMarketplaceAdCanvas(canvas, content, { useBestPhotoFit: false, requireImages: true });
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png'));
      const name = `${details.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'advert'}-aim4price.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: details.title, text: shareText });
        setStatus('Share sheet closed.');
      } else {
        downloadMarketplaceAd(blob, name);
        setStatus(share ? 'PNG downloaded. Attach it in WhatsApp, Facebook or email. You can also copy the advert text below.' : 'Your PNG has been downloaded.');
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError('Could not export or share the advert. Please try Download PNG.');
    } finally { setBusy(false); }
  }

  return <section className={styles.creator} aria-label="Advert Creator">
    {step > 0 ? <nav className={`${studioStyles.stepper} ${styles.studioStepper}`} aria-label="Create advert steps">{['Advert details', 'Photos & contact', 'Preview & share'].map((label, index) => <button type="button" key={label} className={`${studioStyles.stepButton} ${step === index + 1 ? studioStyles.stepButtonActive : ''}`} aria-current={step === index + 1 ? 'step' : undefined} disabled={index + 1 > furthestStep || uploading} onClick={() => goTo(index + 1)}><span aria-hidden="true"><StudioIcon name={index + 1 < furthestStep && index + 1 !== step ? 'check' : STEP_ICONS[index]} /></span><strong>{label}</strong><span className={studioStyles.srOnly}>Step {index + 1} of 3</span></button>)}</nav> : null}
    {error ? <p className={styles.status} role="alert">{error}</p> : null}
    {status ? <p className={styles.status} role="status">{status}</p> : null}
    {step === 0 ? <div className={`${styles.card} ${styles.sourceIntro}`}>
      <h2 ref={headingRef} tabIndex={-1}>{source ? source === 'asset' ? 'Choose an asset' : 'Choose a saved estimate' : 'How would you like to start?'}</h2>
      <p className={styles.help}>{details.title ? 'Choosing a new source replaces this advert’s details. You can also continue your current advert below.' : 'Start fresh or reuse saved details. You can edit everything before previewing.'}</p>
      <div className={styles.sourceGrid}>
        {([{ id: 'manual', label: 'Manual', icon: 'edit', note: 'Add details and photos from scratch.' },
          { id: 'asset', label: 'Asset Register', icon: 'box', note: 'Reuse an asset and its photos.' },
          { id: 'estimate', label: 'Saved Estimate', icon: 'price', note: 'Start with an existing valuation.' }] as const).map(item =>
          <button type="button" key={item.id} className={styles.sourceCard} aria-pressed={source === item.id} onClick={() => item.id === 'manual' ? startAdvert() : void chooseSource(item.id)}>
            <span className={styles.optionIcon}><StudioIcon name={item.icon} /></span><strong>{item.label}</strong><span>{item.note}</span>
          </button>)}
      </div>
      {source ? <div className={styles.sourcePicker}>
        <label className={styles.field}>Search {source === 'asset' ? 'assets' : 'estimates'}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or year" /></label>
        {(source === 'asset' ? sourceLoading : estimateLoading) ? <p role="status">Loading…</p> : <>
          {(source === 'asset' ? sourceStatus : estimateStatus) ? <p role="status">{source === 'asset' ? sourceStatus : estimateStatus}<button type="button" className={styles.secondary} onClick={() => void chooseSource(source)}>Refresh</button></p> : null}
          <div className={styles.sourceResults}>{(source === 'asset' ? assets.map(asset => ({ id: asset.id, title: asset.details.title, year: asset.details.year, asset })) : estimates.map(savedEstimate => ({ id: savedEstimate.id, title: savedEstimate.title, year: savedEstimate.year, savedEstimate }))).filter(item => `${item.title} ${item.year}`.toLowerCase().includes(search.trim().toLowerCase())).map(item =>
            <button type="button" className={styles.sourceResult} key={item.id} onClick={() => startAdvert('asset' in item ? item.asset : undefined, 'savedEstimate' in item ? item.savedEstimate : undefined)}><span><strong>{item.title || 'Untitled asset'}</strong><small>{item.year || 'Year not specified'}{'savedEstimate' in item ? ` · ${new Date(item.savedEstimate.createdAt).toLocaleDateString('en-ZA')}` : ''}</small></span><span>Use {source === 'asset' ? 'asset' : 'estimate'}<StudioIcon name="next" /></span></button>)}</div>
          {search && !(source === 'asset' ? assets.map(item => `${item.details.title} ${item.details.year}`) : estimates.map(item => `${item.title} ${item.year}`)).some(text => text.toLowerCase().includes(search.trim().toLowerCase())) ? <p role="status">No matches. Try another name or start manually.</p> : null}
        </>}
        <p className={styles.help}>Imported details are copied into this advert. Your saved records stay unchanged.</p>
      </div> : <p className={styles.help}>Choose an asset or saved estimate to include a value comparison.</p>}
      {furthestStep > 0 && details.title ? <button type="button" className={styles.secondary} onClick={() => setStep(1)}>Continue current advert</button> : null}
    </div> : null}
    {step === 1 ? <div className={styles.card}>
      <h2 ref={headingRef} tabIndex={-1}>Advert details</h2><p className={styles.help}>Describe your machinery and set your asking price.</p>
      <form noValidate className={marketplaceStyles.marketplaceForm} onSubmit={event => { event.preventDefault(); goTo(2); }}>
        <section className={styles.titleSummary}>
          <label className={marketplaceStyles.marketplaceTitlePreview}><span>Listing title</span><input className={marketplaceStyles.marketplaceTitleInput} aria-label="Listing title" {...fieldA11y('title')} value={details.title} maxLength={160} required onChange={e => update('title', e.target.value)} />{fieldError('title')}<small>Shown on your advert.</small></label>

        </section>
<div className={styles.optionsGrid}>        <section className={styles.optionCard} aria-labelledby="machinery-details-title">
          <div className={styles.optionHeading}><span className={styles.optionIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9" /></svg></span><div><h3 id="machinery-details-title">Machinery details</h3><p>Add details buyers will want to know.</p></div></div>
          <div className={styles.fields}>
        <label>Year<input inputMode="numeric" value={details.year} placeholder="Optional" onChange={e => update('year',e.target.value)} {...fieldA11y('year')} />{fieldError('year')}</label>
        <label>Condition<span className={`${studioStyles.selectControl} ${styles.studioSelect}`}><span className={studioStyles.selectLeadingIcon}><StudioIcon name="review" /></span><select value={details.condition} onChange={e => update('condition',e.target.value)}>{['excellent','good','fair','used','serious'].map(value => <option key={value} value={value}>{value === 'serious' ? 'Needs repairs' : value.charAt(0).toUpperCase()+value.slice(1)}</option>)}</select><span className={studioStyles.selectChevron}><StudioIcon name="chevron" /></span></span></label>
        <label>Usage<input inputMode="decimal" value={details.usage} disabled={details.usageUnit === 'none'} placeholder="Optional" onChange={e => update('usage',e.target.value)} {...fieldA11y('usage')} />{fieldError('usage')}</label>
        <label>Usage unit<span className={`${studioStyles.selectControl} ${styles.studioSelect}`}><span className={studioStyles.selectLeadingIcon}><StudioIcon name="details" /></span><select value={details.usageUnit} onChange={e => update('usageUnit',e.target.value as AdvertDetails['usageUnit'])}><option value="hours">Hours</option><option value="km">Kilometres</option><option value="percent">Life worked (%)</option><option value="none">Not applicable</option></select><span className={studioStyles.selectChevron}><StudioIcon name="chevron" /></span></span></label>
        <label>VAT label on advert<span className={`${studioStyles.selectControl} ${styles.studioSelect}`}><span className={studioStyles.selectLeadingIcon}><StudioIcon name="price" /></span><select value={details.vatLabel} onChange={e => update('vatLabel',e.target.value as AdvertDetails['vatLabel'])}><option value="plus-vat">+ VAT</option><option value="vat-included">VAT included</option><option value="no-vat">No VAT</option></select><span className={studioStyles.selectChevron}><StudioIcon name="chevron" /></span></span></label>
        </div></section>
<div className={styles.priceColumn}>            <section className={marketplaceStyles.marketplacePricePanel} tabIndex={-1} {...fieldA11y('askingPrice')}><MarketplacePriceInput value={details.askingPrice} onChange={value => update('askingPrice', value)} vatIncluded={details.vatLabel === 'vat-included'} onVatIncludedChange={included => update('vatLabel', included ? 'vat-included' : 'plus-vat')} />{fieldError('askingPrice')}</section>{advertSource !== 'manual' && <details className={styles.estimateDisclosure} open={hasEstimate || undefined}><summary>{hasEstimate ? 'Aim4price value rating' : 'Add a valuation'} <span>— optional</span></summary>      <section className={styles.optionCard} aria-labelledby="price-rating-title">
        <p id="price-rating-title" className={styles.help}>Reuse an estimate to show a value comparison. Your advert can also be created without one.</p>
        <div className={styles.actions}><a className={styles.secondary} href={estimateHref} target="_blank" rel="noreferrer">Value an asset</a><button type="button" className={styles.secondary} disabled={estimateLoading} onClick={loadEstimates}>{estimateLoading ? 'Loading…' : estimates.length ? 'Refresh estimates' : 'Choose saved estimate'}</button></div>
        {estimateStatus ? <p role="status">{estimateStatus}</p> : null}
        {estimates.length ? <label className={styles.field}>Use an estimate<span className={`${studioStyles.selectControl} ${styles.studioSelect}`}><span className={studioStyles.selectLeadingIcon}><StudioIcon name="price" /></span><select value={estimate?.id ?? ''} onChange={e => useEstimate(e.target.value)}><option value="">Without an estimate</option>{estimates.map(item => <option value={item.id} key={item.id}>{item.title} · {item.year || 'Year not specified'} · {new Date(item.createdAt).toLocaleDateString('en-ZA')}</option>)}</select><span className={studioStyles.selectChevron}><StudioIcon name="chevron" /></span></span><small>Loads the estimated machinery details. Editing those details removes the rating link.</small></label> : null}
      <div className={styles.ratingPanel}>
      <label className={styles.toggle}><input type="checkbox" role="switch" aria-describedby="price-rating-help" checked={hasEstimate && showRating} disabled={!hasEstimate} onChange={e => setShowRating(e.target.checked)} />Show value rating</label>
      <p id="price-rating-help" className={styles.help}>{hasEstimate ? `Aim4price estimate: R ${estimate!.valueExVat.toLocaleString('en-ZA')} excluding VAT · ${new Date(estimate!.createdAt).toLocaleDateString('en-ZA')}. ${showRating ? `Rating: ${rating.label}.` : 'The rating strip is hidden on your advert.'}` : 'Link an estimate above to enable this switch.'}</p>
      </div></section>
</details>}</div></div>
      <div className={styles.formFooter}><button type="button" className={styles.secondary} onClick={() => { setSource(null); setStep(0); }}>Change source</button><button type="submit" className={styles.primary}>Next: Photos &amp; contact<StudioIcon name="next" /></button></div>
      </form></div> : null}
    {step === 2 ? <div className={styles.card}>
      <h2 ref={headingRef} tabIndex={-1}>Photos &amp; contact</h2><p className={styles.help}>Add your photos and confirm how buyers can contact you.</p>
      <form noValidate className={marketplaceStyles.marketplaceForm} onSubmit={event => { event.preventDefault(); goTo(3); }}>
        <div className={marketplaceStyles.marketplaceBodyGrid}><div className={styles.photoColumn}>
            <div tabIndex={-1} {...fieldA11y('photos')}><MarketplacePhotoEditor compact photos={photos} onChange={changePhotos} busy={uploading} onBusyChange={setUploading} uploadPhotos={uploadPhotos} maxPhotos={4} hint="Add up to four photos. The main photo appears first on your advert." />{fieldError('photos')}</div>
            <label className={marketplaceStyles.marketplaceNotesField}><span>Listing notes</span><textarea value={details.description} maxLength={2000} placeholder="Add important buyer notes, extras, service history or known issues." onChange={e => update('description', e.target.value)} /></label>
          </div>
          <section className={`${marketplaceStyles.marketplaceSellerPanel} ${styles.sellerPanel}`}>
            <div className={marketplaceStyles.marketplaceSellerHeader}><h4>Edit seller details</h4><span>Shown on your advert and shared text</span></div>
            <div className={marketplaceStyles.marketplaceSellerGrid}>
              {([['businessName','Business name','text',true], ['contactName','Contact name','text',false], ['phone','Phone','tel',false], ['email','Business email','email',true]] as const).map(([key,label,type,wide]) => <label key={key} className={`${marketplaceStyles.marketplaceContactField} ${wide ? marketplaceStyles.marketplaceWideField : ''}`}><span>{label}</span><input aria-label={label} {...fieldA11y(key)} type={type} value={details[key]} required={key === 'contactName' || key === 'phone'} maxLength={160} onChange={e => update(key,e.target.value)} />{fieldError(key)}</label>)}
              <label className={marketplaceStyles.marketplaceContactField}><span>Province</span><input aria-label="Province" value={province} maxLength={80} onChange={e => setProvince(e.target.value)} /></label>
              <label className={marketplaceStyles.marketplaceContactField}><span>Area</span><input aria-label="Area" value={area} maxLength={80} onChange={e => setArea(e.target.value)} /></label>
            </div>
          </section>
        </div>
      <div className={styles.formFooter}><button type="button" className={styles.secondary} onClick={() => goTo(1)} disabled={uploading}><StudioIcon name="back" />Back</button><button type="submit" className={styles.primary} disabled={uploading}>Next: Preview advert<StudioIcon name="next" /></button></div>
      </form></div> : null}
    {step === 3 ? <div className={styles.card}>
      <h2 ref={headingRef} tabIndex={-1}>Preview &amp; share</h2><p className={styles.help}>Choose a design, then download or share. This does not publish a Marketplace listing.</p>
      <div className={styles.preview}><div>
        <label className={styles.field}>Advert template<span className={`${studioStyles.selectControl} ${styles.studioSelect}`}><span className={studioStyles.selectLeadingIcon}><StudioIcon name="palette" /></span><select value={brandId} onChange={e => chooseStyle(e.target.value)}><option value="">Account branding</option>{kits.map(kit => <option key={kit.id} value={kit.id}>{kit.name}</option>)}</select><span className={studioStyles.selectChevron}><StudioIcon name="chevron" /></span></span></label>
        <div className={styles.layoutGrid} aria-label="Advert layouts">{AD_TEMPLATE_OPTIONS.map(item => <button type="button" key={item.id} className={`${studioStyles.templateChoice} ${styles.layoutChoice} ${template === item.id ? studioStyles.templateChoiceActive : ''}`} aria-pressed={template === item.id} disabled={item.photoCount > photos.length} onClick={() => setTemplate(item.id)} style={{ '--brand-primary': brand.primaryColor, '--brand-secondary': brand.secondaryColor, '--brand-accent': brand.accentColor } as CSSProperties}><span className={`${studioStyles.miniTemplate} ${TEMPLATE_CLASSES[item.id]}`} aria-hidden="true"><i /><b /><em /><u /></span><strong>{item.name}</strong><small>{item.photoCount > photos.length ? `Needs ${item.photoCount} photos` : `${item.photoCount} photo${item.photoCount === 1 ? '' : 's'}`}</small></button>)}</div>
        <p className={styles.layoutHelp}>{AD_TEMPLATE_OPTIONS.find(item => item.id === template)?.description}</p>
      </div><div className={styles.previewPanel}><div className={styles.previewToolbar}><h3>Advert preview</h3><button type="button" className={styles.secondary} disabled={rendering} onClick={openPreview}><StudioIcon name="preview" />Enlarge</button></div><button className={styles.canvasButton} disabled={rendering} onClick={openPreview} aria-label="Open advert preview"><canvas ref={canvasRef} className={styles.canvas} width={1600} height={900} aria-label="Your advert preview" /></button>
        {rendering ? <p role="status">Updating preview…</p> : <p className={styles.help}>Click the advert to enlarge.</p>}
        <div className={styles.actions}><button className={styles.primary} disabled={busy || rendering} onClick={() => exportPng()}><StudioIcon name="download" />{busy ? 'Preparing…' : 'Download PNG'}</button><button className={styles.secondary} disabled={busy || rendering} onClick={() => exportPng(true)}><StudioIcon name="share" />Share advert</button><button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(shareText); setStatus('Advert text copied.'); } catch { setError('Clipboard access is unavailable. Download the PNG to share your advert.'); } }}><StudioIcon name="copy" />Copy advert text</button></div>
      </div></div><div className={styles.formFooter}><button className={styles.secondary} onClick={() => goTo(2)}><StudioIcon name="back" />Back</button><span className={styles.help}>Step 3 of 3</span></div>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="creator-preview-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className={styles.dialogHeader}><h2 id="creator-preview-title">Advert preview</h2><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => exportPng()}>Download PNG</button><button data-modal-close="true" aria-label="Close advert preview" onClick={() => dialogRef.current?.close()}>×</button></div></div>
        {error ? <p role="alert">{error}</p> : null}{status ? <p role="status">{status}</p> : null}
        <div className={styles.dialogBody}><canvas ref={largeCanvasRef} width={1600} height={900} aria-label="Enlarged advert" /></div>
      </dialog>
    </div> : null}
  </section>;
}
