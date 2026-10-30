'use client';

import Link from 'next/link';
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
import AdvertShareSheet from './AdvertShareSheet';
import type { MarketplaceListing } from '../lib/marketplace';
import AssetModalSelect from './AssetModalSelect';
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

export default function AdvertCreator({ kits, fallbackBrand, estimateHref, estimatesEndpoint, assetRegisterHref = '/asset-register', middlemanMode = false, initialBrandId, initialManual = false, publishEndpoint = '/api/ad-studio/publish', includeShowroom = true, marketplaceHref = '/marketplace/browse', onEditBranding }: {
  kits: AdBrandKit[]; fallbackBrand: AdBrandSnapshot; estimateHref: string; estimatesEndpoint: string; assetRegisterHref?: string; middlemanMode?: boolean; initialBrandId?: string; initialManual?: boolean; publishEndpoint?: string; includeShowroom?: boolean; marketplaceHref?: string; onEditBranding?: () => void;
}) {
  const defaultKit = kits.find(kit => kit.id === initialBrandId) ?? kits.find(kit => kit.isDefault) ?? kits[0];
  const [brandId, setBrandId] = useState(defaultKit?.id ?? '');
  const selectedKit = kits.find(kit => kit.id === brandId) ?? defaultKit;
  const brand = selectedKit ?? fallbackBrand;
  const [template, setTemplate] = useState<AdTemplateId>(defaultKit?.templateId ?? fallbackBrand.templateId);
  const [details, setDetails] = useState<AdvertDetails>(() => ({
    title: '', year: '', usage: '', usageUnit: 'hours', condition: 'good', askingPrice: '',
    vatLabel: (defaultKit ?? fallbackBrand).vatLabel, location: '', description: '',
    contactName: (defaultKit ?? fallbackBrand).contactName, phone: (defaultKit ?? fallbackBrand).phone,
    email: (defaultKit ?? fallbackBrand).email, businessName: (defaultKit ?? fallbackBrand).businessName,
  }));
  const [step, setStep] = useState(initialManual ? 1 : 0);
  const [advertSource, setAdvertSource] = useState<'manual' | 'asset' | 'estimate'>('manual');
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
  useEffect(() => { headingRef.current?.focus(); }, [step]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const brandingDialogRef = useRef<HTMLDialogElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [published, setPublished] = useState<{listing: MarketplaceListing; showroomUrl: string; showroomPublic: boolean} | null>(null);
  const [publishing, setPublishing] = useState(false);
  const publishLock = useRef(false);
  const publicationId = useRef('');
  const uploadedPhotos = useRef(new Map<string,string>());
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
  const availableLayouts = AD_TEMPLATE_OPTIONS.filter(item => item.photoCount <= photos.length);
  const additionalLayouts = AD_TEMPLATE_OPTIONS.filter(item => item.photoCount > photos.length);
  function layoutChoice(item: (typeof AD_TEMPLATE_OPTIONS)[number]) {
    const missingPhotos = Math.max(0, item.photoCount - photos.length);
    return <button type="button" key={item.id}
      className={`${studioStyles.templateChoice} ${styles.layoutChoice}`}
      aria-pressed={template === item.id} disabled={missingPhotos > 0 || publishing}
      onClick={() => setTemplate(item.id)}
      style={{ '--brand-primary': brand.primaryColor, '--brand-secondary': brand.secondaryColor, '--brand-accent': brand.accentColor } as CSSProperties}>
      <span className={`${studioStyles.miniTemplate} ${TEMPLATE_CLASSES[item.id]}`} aria-hidden="true"><i /><b /><em /><u /></span>
      <strong>{item.name}</strong>
      <small>{missingPhotos ? `Add ${missingPhotos} photo${missingPhotos === 1 ? '' : 's'}` : `${item.photoCount} photo${item.photoCount === 1 ? '' : 's'}`}</small>
      {template === item.id ? <span className={styles.layoutSelected} aria-hidden="true"><StudioIcon name="check" /></span> : null}
    </button>;
  }

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
    const chosen = kits.find(kit => kit.id === id);
    if (!chosen) return;
    setBrandId(chosen.id);
    setDetails(current => ({ ...current, contactName: chosen.contactName, phone: chosen.phone, email: chosen.email, businessName: chosen.businessName, vatLabel: chosen.vatLabel }));
    setTemplate(AD_TEMPLATE_OPTIONS.find(item => item.id === chosen.templateId)!.photoCount <= photos.length ? chosen.templateId : 'photo-first');
  }
  function goTo(next: number) {
    if (uploading || publishLock.current) return;
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
  function startAdvert(asset?: AdvertSourceAsset, savedEstimate?: AdvertEstimate) {
    if (publishLock.current) return;
    publicationId.current = ''; setPublished(null);
    setAdvertSource(asset ? 'asset' : savedEstimate ? 'estimate' : 'manual');
    const chosen = brand;
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

  const shareListing: MarketplaceListing = {
    id: published?.listing.id ?? 'draft', title:details.title,brandName:'',brandSlug:'',modelName:details.title,
    tractorType:'field',drive:'4wd',cab:'cab',powerKw:0,powerHp:0,horsepowerHp:0,
    yearModel:Number(details.year)||0,year:Number(details.year)||0,hours:details.usageUnit === 'none' ? 0 : Number(details.usage)||0,
    usageUnit:details.usageUnit === 'none' ? 'hours' : details.usageUnit,lifeWorkedPercent:details.usageUnit === 'percent' ? Number(details.usage)||0 : null,
    province,area,location:content.location||'',description:details.description,sellerName:details.contactName,
    sellerCompany:details.businessName,sellerPhone:details.phone,sellerEmail:details.email,dateAdvertised:'',publishedAtIso:'',
    askingPriceExVat:Number(details.askingPrice),advertisedPriceExVat:Number(details.askingPrice),
    priceExVat:Number(details.askingPrice),price:Number(details.askingPrice),imageSrc:photos[0]||'',imageUrls:photos,
    publishedBy:'asset-register',assetKind:'manual',conditionKey:details.condition,conditionLabel:content.condition,
    adBrand:content.brand,showDealRating:false,
  };
  async function prepareAdvertFile() {
    const canvas = document.createElement('canvas');
    await renderMarketplaceAdCanvas(canvas, content, {useBestPhotoFit:false,requireImages:true});
    const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value ? resolve(value) : reject(new Error('Could not prepare advert.')),'image/png'));
    return new File([blob], 'aim4price-advert.png', {type:'image/png'});
  }
  async function publishAdvert() {
    if (publishLock.current) return;
    const errors = {...advertStepErrors(details,1),...advertStepErrors(details,2,photos.length)};
    if (Object.keys(errors).length) {setError(Object.values(errors)[0] || 'Check your advert.');return;}
    publishLock.current = true; setPublishing(true);setError('');setStatus('');
    try {
      publicationId.current ||= crypto.randomUUID();
      const stored = [];
      for (const url of photos) {
        if (url.startsWith('/api/asset-register/uploads/')) {stored.push(url);continue;}
        let saved = uploadedPhotos.current.get(url);
        if (!saved) {
          const blob = await (await fetch(url)).blob();
          const body = new FormData();body.append('uploadType','photo');body.append('files',new File([blob],'advert-photo.'+(blob.type.split('/')[1]||'png'),{type:blob.type}));
          const response = await fetch('/api/asset-register/uploads',{method:'POST',body});
          const data = await response.json();
          if (!response.ok || !data.ok || !data.uploads?.[0]?.url) throw new Error(data.error || 'Could not upload advert photos.');
          saved = data.uploads[0].url as string;uploadedPhotos.current.set(url,saved);
        }
        stored.push(saved);
      }
      const response = await fetch(publishEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:publicationId.current,details,photos:stored,province,area,brand:content.brand})});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not publish your advert.');
      setPublished(data);setStatus(includeShowroom ? 'Advert published. Marketplace and your showroom use the same listing.' : 'Advert published to Marketplace.');
    } catch (error) {setError(error instanceof Error ? error.message : 'Could not publish your advert. Please try again.');}
    finally {publishLock.current=false;setPublishing(false);}
  }
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

  return <section className={`${styles.creator} ${marketplaceStyles.managementAccountModal}`} aria-label="Advert Creator">
    {step > 0 ? <nav className={`${studioStyles.stepper} ${styles.studioStepper}`} aria-label="Create advert steps">{['Advert details', 'Photos & contact', 'Preview & share'].map((label, index) => <button type="button" key={label} className={`${studioStyles.stepButton} ${step === index + 1 ? studioStyles.stepButtonActive : ''}`} aria-current={step === index + 1 ? 'step' : undefined} disabled={index + 1 > furthestStep || uploading} onClick={() => goTo(index + 1)}><span aria-hidden="true"><StudioIcon name={index + 1 < furthestStep && index + 1 !== step ? 'check' : STEP_ICONS[index]} /></span><strong>{label}</strong><span className={studioStyles.srOnly}>Step {index + 1} of 3</span></button>)}</nav> : null}
    {error ? <p className={styles.status} role="alert">{error}</p> : null}
    {status ? <p className={styles.status} role="status">{status}</p> : null}
    {step === 0 ? <div className={`${styles.card} ${styles.sourceIntro}`}>
      <h2 ref={headingRef} tabIndex={-1}>How would you like to start?</h2>
      <p className={styles.help}>Create an advert manually, or start with {middlemanMode ? 'an estimate' : 'your asset register or an estimate'}.</p>
      <div className={`${styles.sourceGrid} ${middlemanMode ? styles.sourceGridTwo : ''}`}>
        <button type="button" className={styles.sourceCard} data-source="manual" onClick={() => startAdvert()}>
          <span className={styles.optionIcon}><StudioIcon name="edit" /></span><strong>Manual</strong><span>Add details and photos from scratch.</span>
        </button>
        {!middlemanMode ? <Link href={assetRegisterHref} className={styles.sourceCard} data-source="asset">
          <span className={styles.optionIcon}><StudioIcon name="box" /></span><strong>Asset Register</strong><span>Choose an asset you have saved.</span>
        </Link> : null}
        <Link href={estimateHref} className={styles.sourceCard} data-source="estimate">
          <span className={styles.optionIcon}><StudioIcon name="price" /></span><strong>Estimate</strong><span>Value an asset to create your advert.</span>
        </Link>
      </div>
      {furthestStep > 0 && details.title ? <button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} onClick={() => setStep(1)}>Continue current advert</button> : null}
    </div> : null}
    {step === 1 ? <div className={styles.card}>
      <h2 ref={headingRef} tabIndex={-1}>Advert details</h2><p className={styles.help}>Add your asset details and asking price.</p>
      <form noValidate className={marketplaceStyles.marketplaceForm} onSubmit={event => { event.preventDefault(); goTo(2); }}>
        <section className={styles.titleSummary}>
          <label className={marketplaceStyles.marketplaceTitlePreview}><span>Listing title</span><input className={marketplaceStyles.marketplaceTitleInput} aria-label="Listing title" {...fieldA11y('title')} value={details.title} maxLength={160} required onChange={e => update('title', e.target.value)} />{fieldError('title')}<small>Shown on your advert.</small></label>

        </section>
<div className={styles.optionsGrid}>        <section className={`${styles.optionCard} ${marketplaceStyles.marketplaceSellerPanel} ${styles.sellerPanel}`} aria-labelledby="machinery-details-title">
          <div className={styles.optionHeading}><span className={styles.optionIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9" /></svg></span><div className={marketplaceStyles.marketplaceSellerHeader}><h4 id="machinery-details-title">Asset details</h4><span>Add details buyers will want to know.</span></div></div>
          <div className={styles.fields}>
        <label className={marketplaceStyles.marketplaceContactField}><span>Year</span><input inputMode="numeric" value={details.year} placeholder="Optional" onChange={e => update('year',e.target.value)} {...fieldA11y('year')} />{fieldError('year')}</label>
        <AssetModalSelect label="Condition" buttonLabel="Condition" className={styles.detailsSelect} menuClassName={styles.detailsMenu} usePortal={false} showDescriptions={false} value={details.condition} onChange={value => update('condition', value)} options={['excellent','good','fair','used','serious'].map(value => ({value, label: value === 'serious' ? 'Needs repairs' : value.charAt(0).toUpperCase()+value.slice(1)}))} />
        <AssetModalSelect<AdvertDetails['usageUnit']> label="Usage unit" buttonLabel="Usage unit" className={styles.detailsSelect} menuClassName={styles.detailsMenu} usePortal={false} showDescriptions={false} value={details.usageUnit} onChange={value => update('usageUnit', value)} options={[{value:'hours',label:'Hours'},{value:'km',label:'Kilometres'},{value:'percent',label:'Life worked (%)'},{value:'none',label:'Not applicable'}]} />
        <label className={`${marketplaceStyles.marketplaceContactField} ${styles.usageField}`}><span>Usage</span><input aria-label={details.usageUnit === 'none' ? 'Usage not applicable' : `Usage (${details.usageUnit === 'percent' ? 'percentage' : details.usageUnit})`} inputMode="decimal" value={details.usageUnit === 'none' ? '' : details.usage} disabled={details.usageUnit === 'none'} placeholder={details.usageUnit === 'none' ? 'Not applicable' : 'Optional'} onChange={e => update('usage',e.target.value)} {...fieldA11y('usage')} />{details.usageUnit !== 'none' ? <em className={styles.usageUnitBadge} aria-hidden="true">{details.usageUnit === 'percent' ? '%' : details.usageUnit}</em> : null}{fieldError('usage')}</label>
        <AssetModalSelect<AdvertDetails['vatLabel']> label="VAT label on advert" buttonLabel="VAT label on advert" className={styles.detailsSelect} menuClassName={styles.detailsMenu} usePortal={false} showDescriptions={false} value={details.vatLabel} onChange={value => update('vatLabel', value)} options={[{value:'plus-vat',label:'+ VAT'},{value:'vat-included',label:'VAT included'},{value:'no-vat',label:'No VAT'}]} />
        </div></section>
<div className={styles.priceColumn}>            <section className={marketplaceStyles.marketplacePricePanel} tabIndex={-1} {...fieldA11y('askingPrice')}><MarketplacePriceInput value={details.askingPrice} onChange={value => update('askingPrice', value)} vatIncluded={details.vatLabel === 'vat-included'} onVatIncludedChange={included => update('vatLabel', included ? 'vat-included' : 'plus-vat')} />{fieldError('askingPrice')}</section>{advertSource !== 'manual' && <details className={styles.estimateDisclosure} open={hasEstimate || undefined}><summary>{hasEstimate ? 'Aim4price value rating' : 'Add a valuation'} <span>— optional</span></summary>      <section className={styles.optionCard} aria-labelledby="price-rating-title">
        <p id="price-rating-title" className={styles.help}>Reuse an estimate to show a value comparison. Your advert can also be created without one.</p>
        <div className={styles.actions}><a className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} href={estimateHref} target="_blank" rel="noreferrer">Value an asset</a><button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} disabled={estimateLoading} onClick={loadEstimates}>{estimateLoading ? 'Loading…' : estimates.length ? 'Refresh estimates' : 'Choose saved estimate'}</button></div>
        {estimateStatus ? <p role="status">{estimateStatus}</p> : null}
        {estimates.length ? <label className={styles.field}>Use an estimate<span className={`${studioStyles.selectControl} ${styles.studioSelect}`}><span className={studioStyles.selectLeadingIcon}><StudioIcon name="price" /></span><select value={estimate?.id ?? ''} onChange={e => useEstimate(e.target.value)}><option value="">Without an estimate</option>{estimates.map(item => <option value={item.id} key={item.id}>{item.title} · {item.year || 'Year not specified'} · {new Date(item.createdAt).toLocaleDateString('en-ZA')}</option>)}</select><span className={studioStyles.selectChevron}><StudioIcon name="chevron" /></span></span><small>Loads the estimated machinery details. Editing those details removes the rating link.</small></label> : null}
      <div className={styles.ratingPanel}>
      <label className={styles.toggle}><input type="checkbox" role="switch" aria-describedby="price-rating-help" checked={hasEstimate && showRating} disabled={!hasEstimate} onChange={e => setShowRating(e.target.checked)} />Show value rating</label>
      <p id="price-rating-help" className={styles.help}>{hasEstimate ? `Aim4price estimate: R ${estimate!.valueExVat.toLocaleString('en-ZA')} excluding VAT · ${new Date(estimate!.createdAt).toLocaleDateString('en-ZA')}. ${showRating ? `Rating: ${rating.label}.` : 'The rating strip is hidden on your advert.'}` : 'Link an estimate above to enable this switch.'}</p>
      </div></section>
</details>}</div></div>
      <div className={`${styles.formFooter} ${marketplaceStyles.marketplaceActions}`}><button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} onClick={() => { setStep(0); }}>Change source</button><button type="submit" className={`${styles.primary} ${marketplaceStyles.primaryButton}`}>Continue</button></div>
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
      <div className={`${styles.formFooter} ${marketplaceStyles.marketplaceActions}`}><button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} onClick={() => goTo(1)} disabled={uploading}>Back</button><button type="submit" className={`${styles.primary} ${marketplaceStyles.primaryButton}`} disabled={uploading}>Preview advert</button></div>
      </form></div> : null}
    {step === 3 ? <div className={styles.card}>
      <h2 ref={headingRef} tabIndex={-1}>Preview &amp; share</h2><p className={styles.help}>{includeShowroom ? 'Choose your layout, then share or publish to Marketplace and your showroom.' : 'Choose your layout, then share or publish to Marketplace.'}</p>
      <div className={styles.preview}><div>
        {kits.length > 0 || onEditBranding ? <section className={styles.brandingPanel}>
          {kits.length > 1 ? <AssetModalSelect label="Advert template" buttonLabel="Advert template" value={selectedKit?.id ?? ''} onChange={chooseStyle} options={kits.map(kit=>({value:kit.id,label:kit.name}))} usePortal={false} showDescriptions={false} /> : selectedKit ? <p><strong>Template:</strong><span>{selectedKit.name}</span></p> : null}
          {onEditBranding ? <button type="button" className={styles.secondary} disabled={publishing} onClick={() => {
            if (publishLock.current) return;
            brandingDialogRef.current?.showModal();
            brandingDialogRef.current?.querySelector<HTMLButtonElement>('[data-stay-in-creator]')?.focus();
          }}><StudioIcon name="edit" />Edit branding</button> : null}
        </section> : null}
        <h3 className={styles.layoutHeading}>Layout</h3>
        <div className={styles.layoutGrid} aria-label="Advert layouts">{availableLayouts.map(layoutChoice)}</div>
        {additionalLayouts.length ? <details className={styles.moreLayouts}>
          <summary>More layouts <span>({additionalLayouts.length})</span></summary>
          <p>These layouts need more photos.</p>
          <div className={styles.layoutGrid} aria-label="Layouts needing more photos">{additionalLayouts.map(layoutChoice)}</div>
          <button type="button" className={styles.secondary} disabled={publishing} onClick={() => goTo(2)}><StudioIcon name="image" />Add photos</button>
        </details> : null}
        <p className={styles.layoutHelp}>{AD_TEMPLATE_OPTIONS.find(item => item.id === template)?.description}</p>
      </div><div className={styles.previewPanel}><div className={styles.previewToolbar}><h3>Advert preview</h3><button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} disabled={rendering} onClick={openPreview}><StudioIcon name="preview" />Enlarge</button></div><button className={styles.canvasButton} disabled={rendering} onClick={openPreview} aria-label="Open advert preview"><canvas ref={canvasRef} className={styles.canvas} width={1600} height={900} aria-label="Your advert preview" /></button>
        {rendering ? <p className={styles.previewStatus} role="status">Updating preview…</p> : null}
      </div></div>
      <div className={`${styles.formFooter} ${styles.previewFooter}`}>
        <button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} disabled={publishing} onClick={() => goTo(2)}>Back</button>
        <div className={styles.previewFooterActions}>
          <button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} disabled={busy || rendering || publishing} onClick={() => exportPng()}><StudioIcon name="download" />{busy ? 'Preparing…' : 'Download PNG'}</button>
          <button type="button" className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} disabled={busy || rendering || publishing} onClick={() => setShareOpen(true)}><StudioIcon name="share" />Share advert</button>
          <button type="button" className={`${styles.primary} ${marketplaceStyles.primaryButton}`} disabled={publishing || rendering || uploading || busy} onClick={() => void publishAdvert()}><StudioIcon name="check" />{publishing ? (published ? 'Updating…' : 'Publishing…') : published ? 'Update advert' : 'Publish advert'}</button>
        </div>
        <p className={styles.publishHint}>{includeShowroom ? 'Publishes to Marketplace and your showroom.' : 'Publishes to Marketplace.'}</p>
      </div>
      {published ? <div className={styles.publishSuccess}>
        <div><strong><StudioIcon name="check" />Advert published</strong><p>{!includeShowroom ? 'Live in Marketplace.' : published.showroomPublic ? 'Live in Marketplace and your showroom.' : 'Live in Marketplace. Your showroom is currently private.'}</p></div>
        <a className={styles.secondary} href={`${marketplaceHref}?listing=${published.listing.id}&preview=photo`} target="_blank" rel="noreferrer">View listing</a>
      </div> : null}
      {shareOpen ? <AdvertShareSheet listing={shareListing} shareUrl={published ? `${window.location.origin}/marketplace/browse?listing=${published.listing.id}&preview=photo` : ''} caption={shareText} prepareAdvert={prepareAdvertFile} onClose={()=>setShareOpen(false)} /> : null}
      <dialog ref={brandingDialogRef} className={`${styles.dialog} ${styles.brandingDialog}`} aria-labelledby="edit-branding-title" aria-describedby="edit-branding-description" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <div className={styles.dialogHeader}>
          <h2 id="edit-branding-title">Leave this advert?</h2>
          <button type="button" data-modal-close="true" aria-label="Close edit branding confirmation" onClick={() => brandingDialogRef.current?.close()}>×</button>
        </div>
        <p id="edit-branding-description">You’ll go to the Advert Template page to edit your branding. Your unsaved advert work will be lost. Published adverts won’t be affected.</p>
        <div className={styles.actions}>
          <button type="button" data-stay-in-creator className={`${styles.secondary} ${marketplaceStyles.secondaryButton}`} onClick={() => brandingDialogRef.current?.close()}>Stay here</button>
          <button type="button" className={`${styles.primary} ${marketplaceStyles.primaryButton}`} disabled={publishing} onClick={() => {
            if (publishLock.current) return;
            brandingDialogRef.current?.close();
            onEditBranding?.();
          }}>Leave & edit branding</button>
        </div>
      </dialog>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="creator-preview-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className={styles.dialogHeader}><h2 id="creator-preview-title">Advert preview</h2><div className={styles.actions}><button className={`${styles.primary} ${marketplaceStyles.primaryButton}`} disabled={busy} onClick={() => exportPng()}>Download PNG</button><button data-modal-close="true" aria-label="Close advert preview" onClick={() => dialogRef.current?.close()}>×</button></div></div>
        {error ? <p role="alert">{error}</p> : null}{status ? <p role="status">{status}</p> : null}
        <div className={styles.dialogBody}><canvas ref={largeCanvasRef} width={1600} height={900} aria-label="Enlarged advert" /></div>
      </dialog>
    </div> : null}
  </section>;
}
