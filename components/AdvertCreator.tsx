'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AD_TEMPLATE_OPTIONS, type AdBrandKit, type AdBrandSnapshot, type AdTemplateId } from '../lib/ad-studio';
import { advertDetailsError, estimateMatchesAdvert, type AdvertDetails, type AdvertEstimate } from '../lib/advert-creator';
import { downloadMarketplaceAd, getMarketplaceAdRating, renderMarketplaceAdCanvas, type MarketplaceAdContent } from '../lib/marketplace-ad-renderer';
import styles from './AdvertCreator.module.css';
import { pricingVatAmount } from '../lib/pricing-vat';
import { calculateMarketplaceDealRating } from '../lib/marketplace';

type Photo = { id: string; url: string; name: string };

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
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasEstimate = estimateMatchesAdvert(estimate, details);
  const hasEnoughPhotos = photos.length >= (AD_TEMPLATE_OPTIONS.find(item => item.id === template)?.photoCount ?? 1);
  const content = useMemo<MarketplaceAdContent>(() => ({
    title: details.title, year: details.year,
    usage: details.usage && details.usageUnit !== 'none' ? `${Number(details.usage).toLocaleString('en-ZA')}${details.usageUnit === 'percent' ? '% worked' : ` ${details.usageUnit}`}` : '',
    condition: details.condition === 'serious' ? 'Needs repairs' : details.condition.charAt(0).toUpperCase() + details.condition.slice(1), familyLabel: 'Equipment',
    askingPriceExVat: pricingVatAmount(Number(details.askingPrice), details.vatLabel === 'vat-included'),
    dealRating: calculateMarketplaceDealRating({ askingPriceExVat: Number(details.askingPrice), aim4priceValueExVat: hasEstimate ? estimate?.valueExVat : null }).rating,
    aim4priceValueExVat: hasEstimate ? estimate?.valueExVat : null,
    showDealRating: hasEstimate && showRating,
    sellerName: details.contactName, sellerPhone: details.phone, sellerCompany: details.businessName,
    location: details.location, imageUrls: photos.map(photo => photo.url),
    brand: { ...brand, templateId: template, vatLabel: details.vatLabel, contactName: details.contactName, phone: details.phone, email: details.email, businessName: details.businessName },
  }), [details, brand, template, photos, hasEstimate, estimate, showRating]);
  const rating = getMarketplaceAdRating(content);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url)), []);
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
    setDetails(current => ({ ...current, [key]: value })); setError(''); setStatus('');
    if (['title', 'year', 'usage', 'usageUnit', 'condition'].includes(key)) { setEstimate(null); setShowRating(false); }
  }
  function chooseStyle(id: string) {
    setBrandId(id);
    const chosen = kits.find(kit => kit.id === id) ?? fallbackBrand;
    setDetails(current => ({ ...current, contactName: chosen.contactName, phone: chosen.phone, email: chosen.email, businessName: chosen.businessName, vatLabel: chosen.vatLabel }));
    setTemplate(AD_TEMPLATE_OPTIONS.find(item => item.id === chosen.templateId)!.photoCount <= photos.length ? chosen.templateId : 'photo-first');
  }
  function goTo(next: number) {
    setError(''); setStatus('');
    if (next > 1) { const message = advertDetailsError(details); if (message) { setError(message); return; } }
    if (next === 3 && !photos.length) { setError('Add at least one photo to preview your advert.'); return; }
    if (next === 3 && !hasEnoughPhotos) setTemplate('photo-first');
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
    setEstimate(selected); setShowRating(false);
    if (selected) setDetails(current => ({ ...current, title: selected.title, year: selected.year, usage: selected.usage, usageUnit: selected.usageUnit, condition: selected.condition }));
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = '';
    if (!files.length) return;
    if (files.length + photos.length > 4) { setError('Choose up to four photos.'); return; }
    if (files.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10_000_000)) { setError('Choose JPG, PNG or WebP photos, up to 10 MB each.'); return; }
    setUploading(true); setError('');
    const added: Photo[] = [];
    try {
      for (const file of files) {
        const bitmap = await createImageBitmap(file); bitmap.close();
        added.push({ id: crypto.randomUUID(), url: URL.createObjectURL(file), name: file.name });
      }
      setPhotos(current => [...current, ...added]);
    } catch { added.forEach(photo => URL.revokeObjectURL(photo.url)); setError('One of these photos could not be opened. Choose another image.'); }
    finally { setUploading(false); }
  }
  function removePhoto(id: string) {
    const photo = photos.find(item => item.id === id); if (photo) URL.revokeObjectURL(photo.url);
    setPhotos(current => current.filter(item => item.id !== id));
  }
  function movePhoto(index: number, offset: number) {
    setPhotos(current => { const next = [...current]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; });
  }
  function openPreview() {
    if (!canvasRef.current || !largeCanvasRef.current || rendering) return;
    largeCanvasRef.current.getContext('2d')?.drawImage(canvasRef.current, 0, 0);
    dialogRef.current?.showModal(); dialogRef.current?.querySelector<HTMLButtonElement>('[data-modal-close]')?.focus();
  }
  const shareText = [details.title, [details.year, content.usage, content.condition].filter(Boolean).join(' · '), `R ${pricingVatAmount(Number(details.askingPrice), details.vatLabel === 'vat-included').toLocaleString('en-ZA')} ${details.vatLabel === 'plus-vat' ? '+ VAT' : details.vatLabel === 'vat-included' ? 'VAT included' : 'No VAT'}`, details.description, details.location, `${details.contactName} · ${details.phone}`, details.email].filter(Boolean).join('\n');
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
    <nav className={styles.steps} aria-label="Create advert steps">{['Advert details','Photos','Preview & share'].map((label,index) => <button type="button" key={label} aria-current={step === index + 1 ? 'step' : undefined} onClick={() => goTo(index + 1)}>{label}</button>)}</nav>
    {error ? <p className={styles.status} role="alert">{error}</p> : null}
    {status ? <p className={styles.status} role="status">{status}</p> : null}
    {step === 1 ? <div className={styles.card}>
      <h2>Create your advert</h2><p className={styles.help}>Add your machinery details and asking price. An estimate is optional.</p>
      <div className={styles.fields}>
        <label className={styles.full}>Machinery title<input value={details.title} maxLength={160} placeholder="e.g. John Deere 6155M tractor" onChange={e => update('title',e.target.value)} /></label>
        <label>Year<input inputMode="numeric" value={details.year} placeholder="Optional" onChange={e => update('year',e.target.value)} /></label>
        <label>Condition<select value={details.condition} onChange={e => update('condition',e.target.value)}>{['excellent','good','fair','used','serious'].map(value => <option key={value} value={value}>{value === 'serious' ? 'Needs repairs' : value.charAt(0).toUpperCase()+value.slice(1)}</option>)}</select></label>
        <label>Usage<input inputMode="decimal" value={details.usage} disabled={details.usageUnit === 'none'} placeholder="Optional" onChange={e => update('usage',e.target.value)} /></label>
        <label>Usage unit<select value={details.usageUnit} onChange={e => update('usageUnit',e.target.value as AdvertDetails['usageUnit'])}><option value="hours">Hours</option><option value="km">Kilometres</option><option value="percent">Life worked (%)</option><option value="none">Not applicable</option></select></label>
        <label>Asking price (R, excluding VAT)<input inputMode="decimal" value={details.askingPrice} onChange={e => update('askingPrice',e.target.value)} /></label>
        <label>VAT display<select value={details.vatLabel} onChange={e => update('vatLabel',e.target.value as AdvertDetails['vatLabel'])}><option value="plus-vat">+ VAT</option><option value="vat-included">VAT included</option><option value="no-vat">No VAT</option></select></label>
        <label className={styles.full}>Location<input value={details.location} maxLength={160} placeholder="Town, province" onChange={e => update('location',e.target.value)} /></label>
        <label className={styles.full}>Description for sharing<textarea value={details.description} maxLength={2000} onChange={e => update('description',e.target.value)} /></label>
      </div>
      <h3>Contact details</h3><div className={styles.fields}>
        <label>Business name<input value={details.businessName} maxLength={120} onChange={e => update('businessName',e.target.value)} /></label>
        <label>Contact person<input value={details.contactName} maxLength={120} onChange={e => update('contactName',e.target.value)} /></label>
        <label>Phone / WhatsApp<input type="tel" value={details.phone} maxLength={40} onChange={e => update('phone',e.target.value)} /></label>
        <label>Email<input type="email" value={details.email} maxLength={160} onChange={e => update('email',e.target.value)} /></label>
      </div>
      <details className={styles.estimate}>
        <summary>Want guidance on your asking price?</summary><p className={styles.help}>Use a saved Aim4price estimate to enable a price rating, or get an estimate in a new tab. Your advert stays here.</p>
        <div className={styles.actions}><a className={styles.secondary} href={estimateHref} target="_blank" rel="noreferrer">Get an estimate</a><button className={styles.secondary} disabled={estimateLoading} onClick={loadEstimates}>{estimateLoading ? 'Loading…' : 'Load / refresh saved estimates'}</button></div>
        {estimateStatus ? <p role="status">{estimateStatus}</p> : null}
        {estimates.length ? <label className={styles.field}>Use an estimate<select value={estimate?.id ?? ''} onChange={e => useEstimate(e.target.value)}><option value="">Without an estimate</option>{estimates.map(item => <option value={item.id} key={item.id}>{item.title} · {item.year || 'Year not specified'} · {new Date(item.createdAt).toLocaleDateString('en-ZA')}</option>)}</select><small>Loads the estimated machinery details. Editing those details removes the rating link.</small></label> : null}
      </details>
      <label className={styles.toggle}><input type="checkbox" checked={hasEstimate && showRating} disabled={!hasEstimate} onChange={e => setShowRating(e.target.checked)} />Show price rating</label>
      <p className={styles.help}>{hasEstimate ? `Aim4price estimate: R ${estimate!.valueExVat.toLocaleString('en-ZA')} excluding VAT · ${new Date(estimate!.createdAt).toLocaleDateString('en-ZA')}. ${showRating ? `Rating: ${rating.label}.` : 'The rating is hidden on your advert.'}` : 'Get an estimate or select a saved estimate to enable a price rating.'}</p>
      <div className={styles.actions}><button className={styles.primary} onClick={() => goTo(2)}>Continue to photos</button></div>
    </div> : null}
    {step === 2 ? <div className={styles.card}>
      <h2>Advert photos</h2><p className={styles.help}>Add up to four photos. Put your best photo first.</p>
      <input ref={inputRef} type="file" hidden accept="image/jpeg,image/png,image/webp" multiple onChange={upload} />
      <button className={styles.secondary} disabled={uploading || photos.length >= 4} onClick={() => inputRef.current?.click()}>{uploading ? 'Opening photos…' : 'Upload photos'}</button>
      <div className={styles.photos}>{photos.map((photo,index) => <div className={styles.photo} key={photo.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo.url} alt={`${index === 0 ? 'Main photo' : `Photo ${index+1}`}: ${photo.name}`} />
        <strong>{index === 0 ? 'Main photo' : `Photo ${index+1}`}</strong><div className={styles.actions}>
          <button disabled={index === 0} aria-label={`Move photo ${index+1} earlier`} onClick={() => movePhoto(index,-1)}>←</button>
          <button disabled={index === photos.length-1} aria-label={`Move photo ${index+1} later`} onClick={() => movePhoto(index,1)}>→</button>
          <button aria-label={`Remove photo ${index+1}`} onClick={() => removePhoto(photo.id)}>Remove</button>
        </div></div>)}</div>
      <div className={styles.actions}><button className={styles.secondary} onClick={() => goTo(1)}>Back to details</button><button className={styles.primary} disabled={uploading} onClick={() => goTo(3)}>Preview designs</button></div>
    </div> : null}
    {step === 3 ? <div className={styles.card}>
      <h2>Preview your advert</h2><p className={styles.help}>Choose a design, then download or share. This does not publish a Marketplace listing.</p>
      <div className={styles.preview}><div>
        <label className={styles.field}>Advert style<select value={brandId} onChange={e => chooseStyle(e.target.value)}><option value="">Account branding</option>{kits.map(kit => <option key={kit.id} value={kit.id}>{kit.name}</option>)}</select></label>
        <div className={styles.templates}>{AD_TEMPLATE_OPTIONS.map(item => <button key={item.id} aria-pressed={template === item.id} disabled={item.photoCount > photos.length} onClick={() => setTemplate(item.id)}><strong>{item.name}</strong><small>{item.photoCount > photos.length ? `Add ${item.photoCount} photos to use this layout.` : item.description}</small></button>)}</div>
      </div><div><button className={styles.canvasButton} disabled={rendering} onClick={openPreview} aria-label="Open advert preview"><canvas ref={canvasRef} className={styles.canvas} width={1600} height={900} aria-label="Your advert preview" /></button>
        {rendering ? <p role="status">Updating preview…</p> : <p className={styles.help}>Click the advert to enlarge.</p>}
        <div className={styles.actions}><button className={styles.primary} disabled={busy || rendering} onClick={() => exportPng()}>{busy ? 'Preparing…' : 'Download PNG'}</button><button className={styles.secondary} disabled={busy || rendering} onClick={() => exportPng(true)}>Share advert</button><button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(shareText); setStatus('Advert text copied.'); } catch { setError('Clipboard access is unavailable. Download the PNG to share your advert.'); } }}>Copy advert text</button></div>
      </div></div><div className={styles.actions}><button className={styles.secondary} onClick={() => goTo(2)}>Edit photos</button><button className={styles.secondary} onClick={() => goTo(1)}>Edit details</button></div>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="creator-preview-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className={styles.dialogHeader}><h2 id="creator-preview-title">Advert preview</h2><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => exportPng()}>Download PNG</button><button data-modal-close="true" aria-label="Close advert preview" onClick={() => dialogRef.current?.close()}>×</button></div></div>
        {error ? <p role="alert">{error}</p> : null}{status ? <p role="status">{status}</p> : null}
        <div className={styles.dialogBody}><canvas ref={largeCanvasRef} width={1600} height={900} aria-label="Enlarged advert" /></div>
      </dialog>
    </div> : null}
  </section>;
}
