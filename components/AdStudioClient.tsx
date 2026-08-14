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
    if (selected) setDraft(editableKit(selected));
  }

  function startNewKit() {
    setDraft({ ...kitFromDefaults(profileDefaults), name: `Advert style ${kits.length + 1}`, isDefault: kits.length === 0 });
    setFeedback('New Brand Kit ready to customise.');
    setError('');
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
          <p className={styles.eyebrow}>Aim4price Ad Studio</p>
          <h1>Build your advert style once. Reuse it on every valuation.</h1>
          <p>
            Save your logo, contact details, colours and preferred layout as a Brand Kit. When you choose
            <strong> Create Ad</strong> after a valuation, Aim4price applies the kit and publishes the listing to Marketplace.
          </p>
        </div>
        <Link className={styles.valuationLink} href={dealerAppMode ? '/dealer/valuation' : '/valuation'}>
          Start a valuation
        </Link>
      </header>

      {loading ? <div className={styles.notice}>Loading your Brand Kits…</div> : null}
      {error ? <div className={`${styles.notice} ${styles.error}`} role="alert">{error}</div> : null}
      {feedback ? <div className={`${styles.notice} ${styles.success}`} role="status">{feedback}</div> : null}
      {!canManage && !loading ? (
        <div className={styles.notice}>You can use the company Brand Kits when creating adverts. Only the Dealer Owner can edit them.</div>
      ) : null}

      {!loading ? (
        <div className={styles.workspace}>
          <form className={styles.formPanel} onSubmit={saveKit}>
            <div className={styles.formToolbar}>
              <label>
                Saved Brand Kit
                <select value={draft.id} onChange={(event) => chooseKit(event.target.value)} disabled={!kits.length}>
                  {!kits.length ? <option value="">No saved Brand Kits</option> : null}
                  {kits.map((kit) => (
                    <option key={kit.id} value={kit.id}>{kit.name}{kit.isDefault ? ' — default' : ''}</option>
                  ))}
                </select>
              </label>
              {canManage ? <button className={styles.secondaryButton} type="button" onClick={startNewKit}>New kit</button> : null}
            </div>

            <fieldset disabled={!canManage || saving}>
              <legend>Brand details</legend>
              <div className={styles.fieldGrid}>
                <label>
                  Brand Kit name
                  <input value={draft.name} onChange={(event) => update('name', event.target.value)} maxLength={100} required />
                </label>
                <label>
                  Business name
                  <input value={draft.businessName} onChange={(event) => update('businessName', event.target.value)} maxLength={160} />
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
                <label>
                  Logo
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} />
                </label>
                {draft.logoUrl ? (
                  <div className={styles.logoThumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.logoUrl} alt="Uploaded business logo" />
                    <button type="button" onClick={() => update('logoUrl', '')}>Remove</button>
                  </div>
                ) : <span className={styles.fieldHint}>PNG, JPEG or WebP, up to 2 MB.</span>}
              </div>
            </fieldset>

            <fieldset disabled={!canManage || saving}>
              <legend>Choose a layout</legend>
              <div className={styles.templateGrid}>
                {AD_TEMPLATE_OPTIONS.map((template) => (
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
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={!canManage || saving}>
              <legend>Colours and wording</legend>
              <div className={styles.fieldGrid}>
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
                  Use as my default Brand Kit
                </label>
              </div>
            </fieldset>

            {canManage ? (
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Brand Kit'}</button>
                {draft.id ? <button className={styles.dangerButton} type="button" onClick={deleteKit} disabled={saving}>Delete</button> : null}
              </div>
            ) : null}
          </form>

          <aside className={styles.previewPanel}>
            <div className={styles.previewHeading}>
              <div>
                <span>Live preview</span>
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
            <p className={styles.previewNote}>The advert uses the valuation photo, equipment details, price and deal rating automatically.</p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
