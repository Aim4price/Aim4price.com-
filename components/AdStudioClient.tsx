'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import {
  AD_TEMPLATE_OPTIONS,
  DEFAULT_AD_BRAND_COLORS,
  type AdBrandKit,
  type AdBrandSnapshot,
  type AdLanguage,
  type AdTemplateId,
  type AdVatLabel,
} from '../lib/ad-studio';
import styles from './AdStudioClient.module.css';

type AdStudioClientProps = {
  dealerAppMode?: boolean;
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

export default function AdStudioClient({ dealerAppMode = false }: AdStudioClientProps) {
  const [kits, setKits] = useState<AdBrandKit[]>([]);
  const [draft, setDraft] = useState<EditableBrandKit>(EMPTY_KIT);
  const [profileDefaults, setProfileDefaults] = useState<ProfileDefaults>({});
  const [canManage, setCanManage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState<StudioStep>(1);

  const previewName = draft.businessName || draft.contactName || 'Your business';
  const selectedTemplate = useMemo(
    () => AD_TEMPLATE_OPTIONS.find((option) => option.id === draft.templateId) ?? AD_TEMPLATE_OPTIONS[0],
    [draft.templateId],
  );

  async function loadBrandKits(preferredId?: string) {
    setLoading(true);
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
      setLoading(false);
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

  function chooseKit(kitId: string) {
    const selected = kits.find((kit) => kit.id === kitId);
    if (selected) {
      setDraft(editableKit(selected));
      setActiveStep(1);
      setFeedback('');
      setError('');
    }
  }

  function startNewKit() {
    setDraft({ ...kitFromDefaults(profileDefaults), name: `Advert style ${kits.length + 1}`, isDefault: kits.length === 0 });
    setActiveStep(1);
    setFeedback('New Brand Kit ready to customise.');
    setError('');
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
      await loadBrandKits(payload.kit.id);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Brand Kit could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteKit() {
    if (!canManage || !draft.id || saving) return;
    if (!window.confirm(`Remove “${draft.name}”? Existing adverts will keep their saved branding.`)) return;

    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(`/api/ad-studio/brand-kits?brandKitId=${encodeURIComponent(draft.id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Brand Kit could not be removed.');
      setFeedback('Brand Kit removed.');
      await loadBrandKits();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Brand Kit could not be removed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.page} ${dealerAppMode ? styles.dealerPage : ''}`}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Dealer Ad Studio</p>
          <h1>Create your reusable advert style</h1>
          <p>Set it up once, then apply it when you choose <strong>Create Ad</strong> after a valuation.</p>
        </div>
        <div className={styles.heroFlow} aria-label="How Ad Studio works">
          <span>Set up</span><i aria-hidden="true">→</i><span>Value</span><i aria-hidden="true">→</i><span>Publish</span>
        </div>
      </header>

      {loading ? <div className={styles.notice}>Loading your Brand Kits…</div> : null}
      {error ? <div className={`${styles.notice} ${styles.error}`} role="alert">{error}</div> : null}
      {feedback ? <div className={`${styles.notice} ${styles.success}`} role="status">{feedback}</div> : null}
      {!canManage && !loading ? (
        <div className={styles.notice}>You can review and use the company Brand Kits. Only the Dealer Owner can change them.</div>
      ) : null}

      {!loading ? (
        <div className={styles.workspace} id="ad-studio-workspace">
          <form className={styles.formPanel} onSubmit={saveKit}>
            <div className={styles.formToolbar}>
              <label>
                <span>Saved Brand Kit</span>
                <select value={draft.id} onChange={(event) => chooseKit(event.target.value)} disabled={!kits.length}>
                  {!kits.length ? <option value="">No saved Brand Kits</option> : null}
                  {kits.map((kit) => (
                    <option key={kit.id} value={kit.id}>{kit.name}{kit.isDefault ? ' — default' : ''}</option>
                  ))}
                </select>
              </label>
              {canManage ? <button className={styles.secondaryButton} type="button" onClick={startNewKit}>+ New kit</button> : null}
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
                    <p>Every layout fills itself with the valuation photo, equipment details and asking price.</p>
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
                            <i /><b /><em />
                          </span>
                          <span className={styles.templateTitle}>
                            <strong>{template.name}</strong>
                            <b>{draft.templateId === template.id ? 'Selected' : `Option ${index + 1}`}</b>
                          </span>
                          <small>{template.description}</small>
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
                      <small>{selectedTemplate.description}</small>
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
                    <p>After a valuation, choose <b>Create Ad</b>. Aim4price applies this Brand Kit and publishes the confirmed listing to Marketplace in one step.</p>
                  </div>
                </section>
              ) : null}
            </div>

            <div className={styles.actions}>
              <div>
                {activeStep > 1 ? <button className={styles.backButton} type="button" onClick={() => moveToStep((activeStep - 1) as StudioStep)}>Back</button> : null}
                {draft.id && activeStep === 4 && canManage ? <button className={styles.dangerButton} type="button" onClick={deleteKit} disabled={saving}>Delete kit</button> : null}
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
              <span className={styles.previewPill}>{draft.language === 'af' ? 'Afrikaans' : 'English'}</span>
            </div>
            <div
              className={`${styles.adPreview} ${TEMPLATE_CLASS_NAMES[draft.templateId]}`}
              style={{
                '--brand-primary': draft.primaryColor,
                '--brand-secondary': draft.secondaryColor,
                '--brand-accent': draft.accentColor,
              } as CSSProperties}
            >
              <header className={styles.adBrand}>
                {draft.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.logoUrl} alt="" />
                ) : <span className={styles.logoPlaceholder}>YOUR LOGO</span>}
                <strong>{previewName}</strong>
              </header>
              <div className={styles.adPhoto} role="img" aria-label="Example tractor photograph" />
              <div className={styles.adInfo}>
                <div className={styles.adTitle}>2019 EXAMPLE 110 TRACTOR</div>
                <div className={styles.adDetails}>81 kW · 4WD · 3 450 hours</div>
                <div className={styles.adPrice}>R685 000 <small>{vatPreview(draft.language, draft.vatLabel)}</small></div>
                <div className={styles.adContact}>{draft.contactName || 'Sales contact'} · {draft.phone || '082 000 0000'}</div>
              </div>
              <footer className={styles.aimFooter}>Created with <strong>Aim4price</strong></footer>
            </div>
            <div className={styles.previewNote}>
              <span aria-hidden="true">✓</span>
              <p><strong>Filled automatically</strong>Valuation photos, equipment details, price and deal rating are inserted when the advert is created.</p>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
