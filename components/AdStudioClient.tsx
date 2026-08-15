'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import {
  AD_TEMPLATE_OPTIONS,
  DEFAULT_AD_BRAND_COLORS,
  type AdBrandKit,
  type AdBrandSnapshot,
  type AdLanguage,
  type AdTemplateId,
  type AdVatLabel,
} from '../lib/ad-studio';
import {
  getMarketplaceAdRating,
  renderMarketplaceAdCanvas,
  type MarketplaceAdContent,
} from '../lib/marketplace-ad-renderer';
import styles from './AdStudioClient.module.css';

type AdStudioClientProps = {
  dealerAppMode?: boolean;
  middlemanMode?: boolean;
};

type ProfileDefaults = {
  logoUrl?: string;
  businessName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
};

type BrandKitResponse = {
  ok?: boolean;
  kits?: AdBrandKit[];
  selectedBrandKitId?: string | null;
  canManage?: boolean;
  profileDefaults?: ProfileDefaults;
  error?: string;
};

type EditableBrandKit = AdBrandSnapshot & {
  id: string;
  isDefault: boolean;
};

type StudioStep = 1 | 2 | 3 | 4;

const STUDIO_STEPS: Array<{ id: StudioStep; label: string; helper: string }> = [
  { id: 1, label: 'Details', helper: 'Logo and contact details' },
  { id: 2, label: 'Layout', helper: 'Choose the advert structure' },
  { id: 3, label: 'Style', helper: 'Colours and wording' },
  { id: 4, label: 'Review', helper: 'Check and save' },
];

const TEMPLATE_CLASS_NAMES: Record<AdTemplateId, string> = {
  showcase: styles.templateShowcase,
  'price-focus': styles.templatePriceFocus,
  'photo-first': styles.templatePhotoFirst,
  classic: styles.templateClassic,
  minimal: styles.templateMinimal,
  'duo-split': styles.templateDuoSplit,
  'gallery-three': styles.templateGalleryThree,
  'catalogue-grid': styles.templateCatalogueGrid,
};

const EMPTY_KIT: EditableBrandKit = {
  id: '',
  name: 'My advert style',
  templateId: 'showcase',
  logoUrl: '',
  primaryColor: DEFAULT_AD_BRAND_COLORS.primary,
  secondaryColor: DEFAULT_AD_BRAND_COLORS.secondary,
  accentColor: DEFAULT_AD_BRAND_COLORS.accent,
  businessName: '',
  contactName: '',
  phone: '',
  email: '',
  website: '',
  language: 'en',
  vatLabel: 'plus-vat',
  isDefault: true,
};

function kitFromDefaults(defaults: ProfileDefaults = {}): EditableBrandKit {
  return {
    ...EMPTY_KIT,
    logoUrl: defaults.logoUrl ?? '',
    businessName: defaults.businessName ?? '',
    contactName: defaults.contactName ?? '',
    phone: defaults.phone ?? '',
    email: defaults.email ?? '',
    website: defaults.website ?? '',
  };
}

function editableKit(kit: AdBrandKit): EditableBrandKit {
  return {
    id: kit.id,
    name: kit.name,
    templateId: kit.templateId,
    logoUrl: kit.logoUrl,
    primaryColor: kit.primaryColor,
    secondaryColor: kit.secondaryColor,
    accentColor: kit.accentColor,
    businessName: kit.businessName,
    contactName: kit.contactName,
    phone: kit.phone,
    email: kit.email,
    website: kit.website,
    language: kit.language,
    vatLabel: kit.vatLabel,
    isDefault: kit.isDefault,
  };
}

function vatPreview(language: AdLanguage, label: AdVatLabel): string {
  if (label === 'vat-included') return language === 'af' ? 'BTW INGESLUIT' : 'VAT INCLUDED';
  if (label === 'no-vat') return language === 'af' ? 'GEEN BTW' : 'NO VAT';
  return language === 'af' ? '+ BTW' : '+ VAT';
}

export default function AdStudioClient({ dealerAppMode = false, middlemanMode = false }: AdStudioClientProps) {
  const [kits, setKits] = useState<AdBrandKit[]>([]);
  const [draft, setDraft] = useState<EditableBrandKit>(EMPTY_KIT);
  const [profileDefaults, setProfileDefaults] = useState<ProfileDefaults>({});
  const [canManage, setCanManage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState<StudioStep>(1);
  const editorRef = useRef<HTMLFormElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewName = draft.businessName || draft.contactName || 'Your business';
  const selectedTemplate = useMemo(
    () => AD_TEMPLATE_OPTIONS.find((option) => option.id === draft.templateId) ?? AD_TEMPLATE_OPTIONS[0],
    [draft.templateId],
  );
  const previewContent = useMemo<MarketplaceAdContent>(() => ({
    title: '2019 Example 110 Tractor',
    year: '2019',
    usage: '3 450 hours',
    condition: 'Good',
    familyLabel: 'Tractors',
    askingPriceExVat: 685_000,
    aim4priceValueExVat: 700_000,
    dealRating: 'fair',
    sellerName: draft.contactName || 'Sales contact',
    sellerPhone: draft.phone || '082 000 0000',
    sellerCompany: previewName,
    imageUrls: Array.from({ length: selectedTemplate.photoCount }, () => '/brand/Tractor.png'),
    brand: {
      name: draft.name,
      templateId: draft.templateId,
      logoUrl: draft.logoUrl,
      primaryColor: draft.primaryColor,
      secondaryColor: draft.secondaryColor,
      accentColor: draft.accentColor,
      businessName: draft.businessName,
      contactName: draft.contactName,
      phone: draft.phone,
      email: draft.email,
      website: draft.website,
      language: draft.language,
      vatLabel: draft.vatLabel,
    },
  }), [draft, previewName, selectedTemplate.photoCount]);
  const previewRating = getMarketplaceAdRating(previewContent);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    void renderMarketplaceAdCanvas(canvas, previewContent, {
      includeImages: true,
      useBestPhotoFit: false,
    });
  }, [previewContent]);

  async function loadBrandKits(preferredId?: string, showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ad-studio/brand-kits', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as BrandKitResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Brand Kits could not be loaded.');

      const nextKits = payload.kits ?? [];
      const nextDefaults = payload.profileDefaults ?? {};
      const selected = nextKits.find((kit) => kit.id === preferredId)
        ?? nextKits.find((kit) => kit.id === payload.selectedBrandKitId)
        ?? nextKits[0];
      setKits(nextKits);
      setProfileDefaults(nextDefaults);
      setCanManage(payload.canManage !== false);
      setDraft(selected ? editableKit(selected) : kitFromDefaults(nextDefaults));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Brand Kits could not be loaded.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void loadBrandKits();
  }, []);

  function update<K extends keyof EditableBrandKit>(key: K, value: EditableBrandKit[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFeedback('');
    setError('');
  }

  function revealEditor() {
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function chooseKit(kitId: string, shouldReveal = true) {
    const selected = kits.find((kit) => kit.id === kitId);
    if (selected) {
      setDraft(editableKit(selected));
      setActiveStep(1);
      setFeedback('');
      setError('');
      if (shouldReveal) revealEditor();
    }
  }

  function startNewKit() {
    setDraft({ ...kitFromDefaults(profileDefaults), name: `Advert style ${kits.length + 1}`, isDefault: kits.length === 0 });
    setActiveStep(1);
    setFeedback('New Brand Kit ready to customise.');
    setError('');
    revealEditor();
  }

  function moveToStep(step: StudioStep) {
    if (step > 1 && !draft.name.trim()) {
      setActiveStep(1);
      setError('Give this Brand Kit a name before continuing.');
      return;
    }

    setActiveStep(step);
    setError('');
    setFeedback('');
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a PNG, JPEG or WebP logo.');
      return;
    }
    if (file.size > 2_000_000) {
      setError('Keep the logo below 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => update('logoUrl', typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setError('The logo could not be read.');
    reader.readAsDataURL(file);
  }

  async function saveKit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    if (!draft.name.trim()) {
      setError('Give this Brand Kit a name.');
      return;
    }

    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/ad-studio/brand-kits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; kit?: AdBrandKit; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.kit) throw new Error(payload?.error || 'Brand Kit could not be saved.');
      setFeedback('Brand Kit saved. It is now available when you create an advert from a valuation.');
      await loadBrandKits(payload.kit.id, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Brand Kit could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteKit(target: AdBrandKit | EditableBrandKit = draft) {
    if (!canManage || !target.id || saving) return;
    if (!window.confirm(`Remove “${target.name}”? Existing adverts will keep their saved branding.`)) return;

    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(`/api/ad-studio/brand-kits?brandKitId=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Brand Kit could not be removed.');
      setFeedback('Brand Kit removed.');
      await loadBrandKits(undefined, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Brand Kit could not be removed.');
    } finally {
      setSaving(false);
    }
  }

  async function setDefaultKit(kit: AdBrandKit) {
    if (!canManage || kit.isDefault || saving) return;
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/ad-studio/brand-kits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editableKit(kit), isDefault: true }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; kit?: AdBrandKit; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.kit) throw new Error(payload?.error || 'The default Brand Kit could not be changed.');
      setFeedback(`“${kit.name}” is now the default Brand Kit.`);
      await loadBrandKits(payload.kit.id, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The default Brand Kit could not be changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.page} ${dealerAppMode ? styles.dealerPage : ''} ${middlemanMode ? styles.middlemanPage : ''}`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{middlemanMode ? 'Middleman Ad Studio' : 'Dealer Ad Studio'}</span>
          <h1>Build adverts that look like your business</h1>
          <p>Create, save and manage reusable Brand Kits for every Marketplace advert.</p>
        </div>
        <div className={styles.heroMetric}>
          <strong>{kits.length}</strong>
          <span>saved Brand Kit{kits.length === 1 ? '' : 's'}</span>
        </div>
      </header>

      {loading ? <div className={styles.notice}>Loading your Brand Kits…</div> : null}
      {error ? <div className={`${styles.notice} ${styles.error}`} role="alert">{error}</div> : null}
      {feedback ? <div className={`${styles.notice} ${styles.success}`} role="status">{feedback}</div> : null}
      {!canManage && !loading ? (
        <div className={styles.notice}>You can review and use the company Brand Kits. Only the Dealer Owner can change them.</div>
      ) : null}

      {!loading ? (
        <>
          <section className={styles.libraryPanel} aria-labelledby="brand-kit-library-title">
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Your saved styles</span>
                <h2 id="brand-kit-library-title">My Brand Kits</h2>
                <p>Select a kit to edit it, make it the default or remove it.</p>
              </div>
              {canManage ? <button className={styles.primaryButton} type="button" onClick={startNewKit}>Create Brand Kit</button> : null}
            </div>

            {kits.length ? (
              <div className={styles.kitGrid}>
                {kits.map((kit) => {
                  const template = AD_TEMPLATE_OPTIONS.find((option) => option.id === kit.templateId) ?? AD_TEMPLATE_OPTIONS[0];
                  return (
                    <article key={kit.id} className={`${styles.kitCard} ${draft.id === kit.id ? styles.kitCardSelected : ''}`}>
                      <div
                        className={styles.kitVisual}
                        style={{
                          '--brand-primary': kit.primaryColor,
                          '--brand-secondary': kit.secondaryColor,
                          '--brand-accent': kit.accentColor,
                        } as CSSProperties}
                      >
                        <span className={`${styles.miniTemplate} ${TEMPLATE_CLASS_NAMES[kit.templateId]}`} aria-hidden="true">
                          <i /><b /><em /><u />
                        </span>
                        <span className={styles.kitColourStrip}>
                          <i style={{ backgroundColor: kit.primaryColor }} />
                          <i style={{ backgroundColor: kit.secondaryColor }} />
                          <i style={{ backgroundColor: kit.accentColor }} />
                        </span>
                      </div>
                      <div className={styles.kitCardBody}>
                        <div className={styles.kitCardTitle}>
                          <div>
                            <strong>{kit.name}</strong>
                            <span>{template.name} · up to {template.photoCount} photo{template.photoCount === 1 ? '' : 's'}</span>
                          </div>
                          {kit.isDefault ? <b>Default</b> : null}
                        </div>
                        <div className={styles.kitCardActions}>
                          <button type="button" className={styles.smallButton} onClick={() => chooseKit(kit.id)}>{canManage ? 'Edit' : 'View'}</button>
                          {canManage && !kit.isDefault ? <button type="button" className={styles.ghostButton} onClick={() => void setDefaultKit(kit)} disabled={saving}>Set default</button> : null}
                          {canManage ? <button type="button" className={styles.iconDangerButton} onClick={() => void deleteKit(kit)} disabled={saving} aria-label={`Delete ${kit.name}`}>Delete</button> : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyLibrary}>
                <span aria-hidden="true">Aa</span>
                <div><strong>No Brand Kits yet</strong><p>Create your first reusable advert style. It will appear here for quick editing.</p></div>
                {canManage ? <button type="button" className={styles.secondaryButton} onClick={startNewKit}>Create the first kit</button> : null}
              </div>
            )}
          </section>

          <div className={styles.workspace} id="ad-studio-workspace">
          <form className={styles.formPanel} onSubmit={saveKit} ref={editorRef}>
            <div className={styles.editorHeader}>
              <div>
                <span className={styles.sectionEyebrow}>{draft.id ? 'Editing saved kit' : 'New Brand Kit'}</span>
                <h2>{draft.id ? draft.name : 'Create a Brand Kit'}</h2>
                <p>Complete the four short steps. Your preview updates while you work.</p>
              </div>
              {draft.id && canManage ? <button className={styles.ghostButton} type="button" onClick={startNewKit}>Start another</button> : null}
            </div>

            <nav className={styles.stepper} aria-label="Brand Kit setup steps">
              {STUDIO_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className={`${styles.stepButton} ${activeStep === step.id ? styles.stepButtonActive : ''} ${activeStep > step.id ? styles.stepButtonComplete : ''}`}
                  onClick={() => moveToStep(step.id)}
                  aria-current={activeStep === step.id ? 'step' : undefined}
                >
                  <span>{activeStep > step.id ? '✓' : step.id}</span>
                  <span><strong>{step.label}</strong><small>{step.helper}</small></span>
                </button>
              ))}
            </nav>

            <div className={styles.stepContent}>
              {activeStep === 1 ? (
                <section aria-labelledby="studio-details-title">
                  <div className={styles.stepIntro}>
                    <span>Step 1 of 4</span>
                    <h2 id="studio-details-title">Add the details customers should see</h2>
                    <p>These details are saved for future adverts, so you will not need to enter them again.</p>
                  </div>
                  <fieldset className={styles.stepFieldset} disabled={!canManage || saving}>
                    <legend className={styles.srOnly}>Business and contact details</legend>
                    <div className={styles.fieldGrid}>
                      <label>
                        Brand Kit name
                        <input value={draft.name} onChange={(event) => update('name', event.target.value)} maxLength={100} required placeholder="e.g. Main dealer style" />
                      </label>
                      <label>
                        Business name
                        <input value={draft.businessName} onChange={(event) => update('businessName', event.target.value)} maxLength={160} placeholder="Shown at the top of the advert" />
                      </label>
                      <label>
                        Contact person
                        <input value={draft.contactName} onChange={(event) => update('contactName', event.target.value)} maxLength={120} />
                      </label>
                      <label>
                        Phone / WhatsApp
                        <input value={draft.phone} onChange={(event) => update('phone', event.target.value)} maxLength={80} />
                      </label>
                      <label>
                        Email
                        <input type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} maxLength={220} />
                      </label>
                      <label>
                        Website
                        <input value={draft.website} onChange={(event) => update('website', event.target.value)} maxLength={300} placeholder="www.example.co.za" />
                      </label>
                    </div>
                    <div className={styles.logoField}>
                      <div className={styles.logoCopy}>
                        <strong>Business logo</strong>
                        <span>PNG, JPEG or WebP, up to 2 MB.</span>
                      </div>
                      <label className={styles.logoUpload}>
                        <span>{draft.logoUrl ? 'Replace logo' : 'Choose logo'}</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} />
                      </label>
                      {draft.logoUrl ? (
                        <div className={styles.logoThumb}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={draft.logoUrl} alt="Uploaded business logo" />
                          <button type="button" onClick={() => update('logoUrl', '')}>Remove</button>
                        </div>
                      ) : <span className={styles.logoPlaceholderBox}>Logo preview</span>}
                    </div>
                  </fieldset>
                </section>
              ) : null}

              {activeStep === 2 ? (
                <section aria-labelledby="studio-layout-title">
                  <div className={styles.stepIntro}>
                    <span>Step 2 of 4</span>
                    <h2 id="studio-layout-title">Choose a layout</h2>
                    <p>Choose how many listing photos should appear. Missing photo spaces are filled automatically.</p>
                  </div>
                  <fieldset className={styles.stepFieldset} disabled={!canManage || saving}>
                    <legend className={styles.srOnly}>Advert layout</legend>
                    <div className={styles.templateGrid}>
                      {AD_TEMPLATE_OPTIONS.map((template, index) => (
                        <button
                          key={template.id}
                          type="button"
                          className={`${styles.templateChoice} ${draft.templateId === template.id ? styles.templateChoiceActive : ''}`}
                          onClick={() => update('templateId', template.id)}
                          aria-pressed={draft.templateId === template.id}
                        >
                          <span className={`${styles.miniTemplate} ${TEMPLATE_CLASS_NAMES[template.id]}`} aria-hidden="true">
                            <i /><b /><em /><u />
                          </span>
                          <span className={styles.templateTitle}>
                            <strong>{template.name}</strong>
                            <b>{draft.templateId === template.id ? 'Selected' : `Style ${index + 1}`}</b>
                          </span>
                          <small>{template.description}</small>
                          <span className={styles.photoCountBadge}>{template.photoCount} photo{template.photoCount === 1 ? '' : 's'}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </section>
              ) : null}

              {activeStep === 3 ? (
                <section aria-labelledby="studio-style-title">
                  <div className={styles.stepIntro}>
                    <span>Step 3 of 4</span>
                    <h2 id="studio-style-title">Match the advert to your business</h2>
                    <p>Choose colours and wording. The live preview updates immediately.</p>
                  </div>
                  <fieldset className={styles.stepFieldset} disabled={!canManage || saving}>
                    <legend className={styles.srOnly}>Advert colours and wording</legend>
                    <div className={styles.styleGrid}>
                      <label className={styles.colorField}>
                        Primary colour
                        <span><input type="color" value={draft.primaryColor} onChange={(event) => update('primaryColor', event.target.value)} /><code>{draft.primaryColor}</code></span>
                      </label>
                      <label className={styles.colorField}>
                        Secondary colour
                        <span><input type="color" value={draft.secondaryColor} onChange={(event) => update('secondaryColor', event.target.value)} /><code>{draft.secondaryColor}</code></span>
                      </label>
                      <label className={styles.colorField}>
                        Accent colour
                        <span><input type="color" value={draft.accentColor} onChange={(event) => update('accentColor', event.target.value)} /><code>{draft.accentColor}</code></span>
                      </label>
                      <label>
                        Advert language
                        <select value={draft.language} onChange={(event) => update('language', event.target.value as AdLanguage)}>
                          <option value="en">English</option>
                          <option value="af">Afrikaans</option>
                        </select>
                      </label>
                      <label>
                        Price wording
                        <select value={draft.vatLabel} onChange={(event) => update('vatLabel', event.target.value as AdVatLabel)}>
                          <option value="plus-vat">Plus VAT / + BTW</option>
                          <option value="vat-included">VAT included / BTW ingesluit</option>
                          <option value="no-vat">No VAT / Geen BTW</option>
                        </select>
                      </label>
                      <label className={styles.checkField}>
                        <input type="checkbox" checked={draft.isDefault} onChange={(event) => update('isDefault', event.target.checked)} />
                        <span><strong>Use as the default</strong><small>Preselect this kit whenever you create an advert.</small></span>
                      </label>
                    </div>
                  </fieldset>
                </section>
              ) : null}

              {activeStep === 4 ? (
                <section aria-labelledby="studio-review-title">
                  <div className={styles.stepIntro}>
                    <span>Step 4 of 4</span>
                    <h2 id="studio-review-title">Review and save</h2>
                    <p>Check the essentials below. You can return to any step to make a change.</p>
                  </div>
                  <div className={styles.reviewGrid}>
                    <article>
                      <span>Brand</span>
                      <strong>{draft.businessName || 'Business name not added'}</strong>
                      <small>{draft.contactName || 'No contact person'} · {draft.phone || 'No phone number'}</small>
                    </article>
                    <article>
                      <span>Layout</span>
                      <strong>{selectedTemplate.name}</strong>
                      <small>{selectedTemplate.description} Uses up to {selectedTemplate.photoCount} photo{selectedTemplate.photoCount === 1 ? '' : 's'}.</small>
                    </article>
                    <article>
                      <span>Wording</span>
                      <strong>{draft.language === 'af' ? 'Afrikaans' : 'English'} · {vatPreview(draft.language, draft.vatLabel)}</strong>
                      <small>{draft.isDefault ? 'Default Brand Kit' : 'Optional Brand Kit'}</small>
                    </article>
                    <article className={styles.reviewColours}>
                      <span>Colours</span>
                      <div>
                        {[draft.primaryColor, draft.secondaryColor, draft.accentColor].map((color, index) => (
                          <i key={`${color}-${index}`} style={{ backgroundColor: color }} title={color} />
                        ))}
                      </div>
                      <small>Primary, secondary and accent</small>
                    </article>
                  </div>
                  <div className={styles.reviewCallout}>
                    <strong>What happens next?</strong>
                    <p>After a valuation, choose <b>Create Advert</b>. Aim4price applies this Brand Kit, publishes the listing in the background and downloads the matching JPEG to your device.</p>
                  </div>
                </section>
              ) : null}
            </div>

            <div className={styles.actions}>
              <div>
                {activeStep > 1 ? <button className={styles.backButton} type="button" onClick={() => moveToStep((activeStep - 1) as StudioStep)}>Back</button> : null}
                {draft.id && activeStep === 4 && canManage ? <button className={styles.dangerButton} type="button" onClick={() => void deleteKit()} disabled={saving}>Delete kit</button> : null}
              </div>
              <div>
                {activeStep < 4 ? (
                  <button className={styles.primaryButton} type="button" onClick={() => moveToStep((activeStep + 1) as StudioStep)}>Continue</button>
                ) : (
                  <>
                    {draft.id ? <Link className={styles.secondaryButton} href={dealerAppMode ? '/dealer/valuation' : '/valuation'}>Start a valuation</Link> : null}
                    {canManage ? <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Brand Kit'}</button> : null}
                  </>
                )}
              </div>
            </div>
          </form>

          <aside className={styles.previewPanel}>
            <div className={styles.previewHeading}>
              <div>
                <span>Live advert preview</span>
                <strong>{selectedTemplate.name}</strong>
              </div>
              <div className={styles.previewPills}>
                <span className={styles.previewPill}>{selectedTemplate.photoCount} photo{selectedTemplate.photoCount === 1 ? '' : 's'}</span>
                <span className={styles.previewPill}>{draft.language === 'af' ? 'Afrikaans' : 'English'}</span>
              </div>
            </div>
            <canvas
              ref={previewCanvasRef}
              className={styles.adCanvasPreview}
              width="1600"
              height="900"
              aria-label={`${selectedTemplate.name} advert preview with ${previewRating.label.toLowerCase()} rating`}
            />
            <div className={styles.previewNote}>
              <span aria-hidden="true">✓</span>
              <p><strong>The downloaded JPEG matches this preview</strong>The first {selectedTemplate.photoCount} listing photo{selectedTemplate.photoCount === 1 ? ' is' : 's are'} placed into the design with valuation details, asking price and the {previewRating.label.toLowerCase()} rating.</p>
            </div>
          </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
