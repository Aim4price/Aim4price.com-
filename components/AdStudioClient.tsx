'use client';
import { useDealerAppRoot } from '../lib/use-dealer-app-root';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react';
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
  downloadMarketplaceAd,
  renderMarketplaceAdCanvas,
  type MarketplaceAdContent,
} from '../lib/marketplace-ad-renderer';
import styles from './AdStudioClient.module.css';
import AdvertCreator from './AdvertCreator';
import StudioIcon, { type StudioIconName } from './StudioIcon';
import registerStyles from '../app/asset-register/page.module.css';
import valuationStyles from '../app/valuation/page.module.css';
import entryStyles from '../app/marketplace/marketplace-entry.module.css';
import SettingsDetailIcon from './SettingsDetailIcon';

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

type PreviewPhoto = {
  id: string;
  name: string;
  previewUrl: string;
};

const MAX_PREVIEW_PHOTOS = 4;
const MAX_PREVIEW_PHOTO_BYTES = 10_000_000;
const SUPPORTED_PREVIEW_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const STUDIO_STEPS: Array<{ id: StudioStep; label: string; icon: StudioIconName }> = [
  { id: 1, label: 'Details', icon: 'details' },
  { id: 2, label: 'Layout', icon: 'layout' },
  { id: 3, label: 'Style', icon: 'palette' },
  { id: 4, label: 'Review', icon: 'review' },
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
  name: 'My advert template',
  templateId: 'showcase',
  logoUrl: '',
  logoBackground: true,
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
    logoBackground: kit.logoBackground !== false,
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
  if (label === 'vat-included') return language === 'af' ? 'BTW ingesluit' : 'VAT included';
  if (label === 'no-vat') return language === 'af' ? 'Geen BTW' : 'No VAT';
  return language === 'af' ? '+ BTW' : '+ VAT';
}

function createPreviewPhotoId(): string {
  return `studio-preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AdStudioClient({ dealerAppMode = false, middlemanMode = false }: AdStudioClientProps) {
  const dealerAppRoot = useDealerAppRoot();
  const brandKitsEndpoint = dealerAppMode ? `/api${dealerAppRoot}/ad-studio/brand-kits` : '/api/ad-studio/brand-kits';
  const [studioMode, setStudioMode] = useState<'home' | 'style' | 'creator'>('home');
  const [creatorStarted, setCreatorStarted] = useState(false);
  const [kits, setKits] = useState<AdBrandKit[]>([]);
  const [draft, setDraft] = useState<EditableBrandKit>(EMPTY_KIT);
  const [profileDefaults, setProfileDefaults] = useState<ProfileDefaults>({});
  const [canManage, setCanManage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPreview, setDownloadingPreview] = useState(false);
  const [previewDownloadError, setPreviewDownloadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState<StudioStep>(1);
  const [previewPhotos, setPreviewPhotos] = useState<PreviewPhoto[]>([]);
  const [draggedPreviewPhotoId, setDraggedPreviewPhotoId] = useState('');
  const photoHelpDialogRef = useRef<HTMLDialogElement | null>(null);
  const editorRef = useRef<HTMLFormElement | null>(null);
  const previewDialogRef = useRef<HTMLDialogElement | null>(null);
  const enlargedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const previewPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const previewPhotosRef = useRef<PreviewPhoto[]>([]);

  const previewName = draft.businessName || draft.contactName || 'Your business';
  const selectedTemplate = useMemo(
    () => AD_TEMPLATE_OPTIONS.find((option) => option.id === draft.templateId) ?? AD_TEMPLATE_OPTIONS[0],
    [draft.templateId],
  );
  const previewContent = useMemo<MarketplaceAdContent>(() => ({
    title: '2019 Example Asset',
    year: '2019',
    usage: '3 450 hours',
    condition: 'Good',
    familyLabel: 'Assets',
    askingPriceExVat: 685_000,
    aim4priceValueExVat: 700_000,
    dealRating: 'fair',
    sellerName: draft.contactName || 'Sales contact',
    sellerPhone: draft.phone || '082 000 0000',
    sellerCompany: previewName,
    imageUrls: previewPhotos.map((photo) => photo.previewUrl),
    brand: {
      name: draft.name,
      templateId: draft.templateId,
      logoUrl: draft.logoUrl,
      logoBackground: draft.logoBackground !== false,
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
  }), [draft, previewName, previewPhotos]);
  const previewRating = getMarketplaceAdRating(previewContent);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let active = true;
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = canvas.width;
    renderCanvas.height = canvas.height;

    void renderMarketplaceAdCanvas(renderCanvas, previewContent, {
      includeImages: true,
      useBestPhotoFit: false,
    })
      .then(() => {
        if (!active) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(renderCanvas, 0, 0, canvas.width, canvas.height);
      })
      .catch(() => {
        // A newer render will replace a photo that was removed while loading.
      });

    return () => {
      active = false;
    };
  }, [previewContent, loading, studioMode]);

  useEffect(() => {
    previewPhotosRef.current = previewPhotos;
  }, [previewPhotos]);

  useEffect(() => () => {
    previewPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  async function loadBrandKits(preferredId?: string, showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');

    try {
      const response = await fetch(brandKitsEndpoint, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as BrandKitResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Advert templates could not be loaded.');

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
      setError(nextError instanceof Error ? nextError.message : 'Advert templates could not be loaded.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void loadBrandKits();
  }, [brandKitsEndpoint]);

  function update<K extends keyof EditableBrandKit>(key: K, value: EditableBrandKit[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFeedback('');
    setError('');
  }

  async function downloadPreviewPng() {
    if (downloadingPreview) return;
    setDownloadingPreview(true);
    setPreviewDownloadError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 900;
      await renderMarketplaceAdCanvas(canvas, previewContent, { includeImages: true, useBestPhotoFit: false });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG export failed.')), 'image/png');
      });
      downloadMarketplaceAd(blob, 'aim4price-advert-preview.png');
    } catch {
      setPreviewDownloadError('Could not download the PNG. Please try again.');
    } finally {
      setDownloadingPreview(false);
    }
  }

  function openPreview() {
    const source = previewCanvasRef.current;
    const target = enlargedCanvasRef.current;
    if (!source || !target) return;
    target.getContext('2d')?.drawImage(source, 0, 0);
    previewDialogRef.current?.showModal();
    previewDialogRef.current?.querySelector<HTMLButtonElement>('[data-modal-close]')?.focus();
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
    setDraft({ ...kitFromDefaults(profileDefaults), name: `Advert template ${kits.length + 1}`, isDefault: kits.length === 0 });
    setActiveStep(1);
    setFeedback('New advert template ready to customise.');
    setError('');
    revealEditor();
  }

  function moveToStep(step: StudioStep) {
    if (step > 1 && !draft.name.trim()) {
      setActiveStep(1);
      setError('Give this advert template a name before continuing.');
      return;
    }

    setActiveStep(step);
    editorRef.current?.querySelector(`.${styles.stepContent}`)?.scrollTo({ top: 0 });
    revealEditor();
    setError('');
    setFeedback('');
  }

  function applyLogoFile(file?: File) {
    if (!file || !canManage || saving) return;
    if (!SUPPORTED_PREVIEW_IMAGE_TYPES.has(file.type)) {
      setError('Choose a PNG, JPEG or WebP logo.');
      return;
    }
    if (file.size > 2_000_000) {
      setError('Keep the logo below 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      update('logoUrl', typeof reader.result === 'string' ? reader.result : '');
      setFeedback('Logo ready. It will be saved with this advert template.');
    };
    reader.onerror = () => setError('The logo could not be read.');
    reader.readAsDataURL(file);
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    applyLogoFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function addPreviewPhotos(files: File[]) {
    const imageFiles = files.filter((file) => SUPPORTED_PREVIEW_IMAGE_TYPES.has(file.type));
    if (!imageFiles.length) {
      setError('Choose PNG, JPEG or WebP photos for the preview.');
      return;
    }

    const oversized = imageFiles.find((file) => file.size > MAX_PREVIEW_PHOTO_BYTES);
    if (oversized) {
      setError(`Keep each sample photo below 10 MB. “${oversized.name}” is too large.`);
      return;
    }

    const available = Math.max(0, MAX_PREVIEW_PHOTOS - previewPhotos.length);
    if (!available) {
      setError(`The preview can show up to ${MAX_PREVIEW_PHOTOS} sample photos.`);
      return;
    }

    const accepted = imageFiles.slice(0, available);
    setPreviewPhotos((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: createPreviewPhotoId(),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    setError('');
    setFeedback(imageFiles.length > available
      ? `Added ${accepted.length} sample photos. The preview uses a maximum of ${MAX_PREVIEW_PHOTOS}.`
      : 'Sample photos added to the live preview.');
  }

  function requestPreviewPhotos() {
    photoHelpDialogRef.current?.showModal();
  }

  function handlePreviewPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    addPreviewPhotos(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function removePreviewPhoto(photoId: string) {
    setPreviewPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  function clearPreviewPhotos() {
    previewPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPreviewPhotos([]);
    setFeedback('Sample photos cleared.');
  }

  function movePreviewPhoto(photoId: string, direction: -1 | 1) {
    setPreviewPhotos((current) => {
      const index = current.findIndex((photo) => photo.id === photoId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function reorderPreviewPhoto(targetPhotoId: string) {
    if (!draggedPreviewPhotoId || draggedPreviewPhotoId === targetPhotoId) return;
    setPreviewPhotos((current) => {
      const sourceIndex = current.findIndex((photo) => photo.id === draggedPreviewPhotoId);
      const targetIndex = current.findIndex((photo) => photo.id === targetPhotoId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedPreviewPhotoId('');
  }

  async function saveKit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    if (!draft.name.trim()) {
      setError('Give this advert template a name.');
      return;
    }

    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(brandKitsEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; kit?: AdBrandKit; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.kit) throw new Error(payload?.error || 'Advert template could not be saved.');
      setFeedback('Advert template saved. It is now available in Create Advert.');
      await loadBrandKits(payload.kit.id, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Advert template could not be saved.');
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
      const response = await fetch(`${brandKitsEndpoint}?brandKitId=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Advert template could not be removed.');
      setFeedback('Advert template removed.');
      await loadBrandKits(undefined, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Advert template could not be removed.');
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
      const response = await fetch(brandKitsEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editableKit(kit), isDefault: true }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; kit?: AdBrandKit; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.kit) throw new Error(payload?.error || 'The default advert template could not be changed.');
      setFeedback(`“${kit.name}” is now the default advert template.`);
      await loadBrandKits(payload.kit.id, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The default advert template could not be changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={studioMode === 'home' ? valuationStyles.page : `${styles.page} ${dealerAppMode ? styles.dealerPage : ''} ${middlemanMode ? styles.middlemanPage : ''}`}>
      {studioMode !== 'home' ? <div className={styles.titlePanel}>
        <section className={registerStyles.businessRegisterTitleBlock}>
          <div className={registerStyles.businessRegisterTitleCard}>
            <h1>{studioMode === 'creator' ? 'CREATE ADVERT' : 'ADVERT TEMPLATE'}</h1>
            <button
              type="button"
              className={`${registerStyles.registerChangeButton} ${registerStyles.controlTooltip}`}
              disabled={loading}
              aria-label={studioMode === 'creator' ? 'Switch to Advert Template' : 'Switch to Create Advert'}
              data-tooltip={studioMode === 'creator' ? 'Switch to Advert Template' : 'Switch to Create Advert'}
              onClick={() => {
                if (studioMode === 'creator') setStudioMode('style');
                else { setCreatorStarted(true); setStudioMode('creator'); }
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={registerStyles.registerChangeIcon} aria-hidden="true">
                <path d="M7 7h10" /><path d="m14 4 3 3-3 3" />
                <path d="M17 17H7" /><path d="m10 14-3 3 3 3" />
              </svg>
            </button>
          </div>
        </section>
      </div> : null}

      {loading ? <div className={styles.notice}>Loading your advert templates…</div> : null}
      {error ? <div className={`${styles.notice} ${styles.error}`} role="alert">{error}</div> : null}
      {feedback ? <div className={`${styles.notice} ${styles.success}`} role="status">{feedback}</div> : null}
      {!canManage && !loading ? (
        <div className={styles.notice}>Your Dealer login does not have permission to edit advert templates.</div>
      ) : null}

      {!loading && studioMode === 'home' ? (
        <div className={`${valuationStyles.container} ${entryStyles.entryContainer}`}>
          <section className={`${valuationStyles.wizardShell} ${valuationStyles.sectorWizardShell} ${entryStyles.entryShell}`}>
            <div className={`${valuationStyles.wizardCard} ${valuationStyles.sectorWizardCard} ${entryStyles.entryCard}`}>
              <div className={`${valuationStyles.stepContent} ${valuationStyles.sectorStepContent} ${entryStyles.entryContent}`}>
                <div className={`${valuationStyles.sectorStart} ${entryStyles.entryStart}`}>
                  <div className={`${valuationStyles.sectorIntro} ${entryStyles.entryIntro}`}>
                    <h1 className={`${valuationStyles.stepTitle} ${entryStyles.entryTitle}`}>Advert Studio</h1>
                    <p className={`${valuationStyles.stepText} ${entryStyles.entryText}`}>Create your advert template or design an advert to share.</p>
                  </div>
                  <nav className={`${valuationStyles.sectorLargeGrid} ${entryStyles.entryGrid}`} aria-label="Advert Studio options">
                    <button type="button" className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive} ${entryStyles.entryChoiceCard}`} onClick={() => setStudioMode('style')}>
                      <span className={valuationStyles.sectorVideoOverlay} aria-hidden="true" />
                      <span className={`${valuationStyles.sectorBigCardContent} ${entryStyles.entryChoiceContent}`}>
                        <span className={valuationStyles.sectorLabelWrap}>
                          <strong className={valuationStyles.sectorLabel}>Advert Template</strong>
                          <span className={valuationStyles.sectorCardHint}>Set your branding and default layout.</span>
                        </span>
                      </span>
                    </button>
                    <button type="button" className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive} ${entryStyles.entryChoiceCard}`} onClick={() => { setCreatorStarted(true); setStudioMode('creator'); }}>
                      <span className={valuationStyles.sectorVideoOverlay} aria-hidden="true" />
                      <span className={`${valuationStyles.sectorBigCardContent} ${entryStyles.entryChoiceContent}`}>
                        <span className={valuationStyles.sectorLabelWrap}>
                          <strong className={valuationStyles.sectorLabel}>Create Advert</strong>
                          <span className={valuationStyles.sectorCardHint}>Create, preview and share your advert.</span>
                        </span>
                      </span>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {!loading && creatorStarted ? <div style={studioMode === 'creator' ? undefined : { display: 'none' }}>
        <AdvertCreator kits={kits} fallbackBrand={kitFromDefaults(profileDefaults)} estimateHref={dealerAppMode ? `${dealerAppRoot}/valuation` : '/valuation'} estimatesEndpoint={dealerAppMode ? `/api${dealerAppRoot}/ad-studio/estimates` : '/api/ad-studio/estimates'} />
      </div> : null}
      {!loading ? (
        <div style={studioMode === 'style' ? undefined : { display: 'none' }}>
          {kits.length ? (
            <section className={styles.libraryPanel} aria-labelledby="brand-kit-library-title">
              <div className={styles.sectionHeader}>
                <div>
                  <h2 id="brand-kit-library-title">Saved advert templates</h2>
                  <p>Choose a style to edit or make your default.</p>
                </div>
                {canManage ? <button className={styles.primaryButton} type="button" onClick={startNewKit}>New advert template</button> : null}
              </div>

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
                          <button type="button" className={styles.smallButton} onClick={() => chooseKit(kit.id)}><StudioIcon name={canManage ? 'edit' : 'preview'} />{canManage ? 'Edit' : 'View'}</button>
                          {canManage && !kit.isDefault ? <button type="button" className={styles.ghostButton} onClick={() => void setDefaultKit(kit)} disabled={saving}><StudioIcon name="star" />Set as default</button> : null}
                          {canManage ? <button type="button" className={styles.iconDangerButton} onClick={() => void deleteKit(kit)} disabled={saving} aria-label={`Delete ${kit.name}`}><StudioIcon name="delete" />Delete</button> : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className={styles.workspace} id="ad-studio-workspace">
          <form className={styles.formPanel} onSubmit={saveKit} ref={editorRef}>
            <nav className={styles.stepper} aria-label="Advert template setup steps">
              {STUDIO_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className={`${styles.stepButton} ${activeStep === step.id ? styles.stepButtonActive : ''}`}
                  onClick={() => moveToStep(step.id)}
                  aria-current={activeStep === step.id ? 'step' : undefined}
                >
                  <span aria-hidden="true"><StudioIcon name={step.icon} /></span>
                  <strong>{step.label}</strong>
                  <span className={styles.srOnly}>Step {step.id} of 4</span>
                </button>
              ))}
            </nav>

            <div className={styles.stepContent}>
              {activeStep === 1 ? (
                <section aria-labelledby="studio-details-title">
                  <div className={styles.stepIntro}>
                    <h2 id="studio-details-title">Your business details</h2>
                    <p>These details will appear on your adverts.</p>
                  </div>
                  <fieldset className={styles.stepFieldset} disabled={!canManage || saving}>
                    <legend className={styles.srOnly}>Business and contact details</legend>
                    <div className={styles.fieldGrid}>
                      <label>
                        Advert template name
                        <span className={styles.settingsInput}>
                          <SettingsDetailIcon name="listings" />
                          <input value={draft.name} onChange={(event) => update('name', event.target.value)} maxLength={100} required placeholder="e.g. Main dealer style" />
                        </span>
                      </label>
                      <label>
                        Business name
                        <span className={styles.settingsInput}>
                          <SettingsDetailIcon name="business" />
                          <input value={draft.businessName} onChange={(event) => update('businessName', event.target.value)} maxLength={160} placeholder="Shown at the top of the advert" />
                        </span>
                      </label>
                      <label>
                        Contact person
                        <span className={styles.settingsInput}>
                          <SettingsDetailIcon name="person" />
                          <input value={draft.contactName} onChange={(event) => update('contactName', event.target.value)} maxLength={120} />
                        </span>
                      </label>
                      <label>
                        Phone / WhatsApp
                        <span className={styles.settingsInput}>
                          <SettingsDetailIcon name="phone" />
                          <input type="tel" value={draft.phone} onChange={(event) => update('phone', event.target.value)} maxLength={80} />
                        </span>
                      </label>
                      <label>
                        Email
                        <span className={styles.settingsInput}>
                          <SettingsDetailIcon name="email" />
                          <input type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} maxLength={220} />
                        </span>
                      </label>
                      <label>
                        Website
                        <span className={styles.settingsInput}>
                          <SettingsDetailIcon name="globe" />
                          <input value={draft.website} onChange={(event) => update('website', event.target.value)} maxLength={300} placeholder="www.example.co.za" />
                        </span>
                      </label>
                    </div>
                    <div className={styles.logoField}>
                      <div className={styles.logoCopy}>
                        <div>
                          <strong>Your logo</strong>
                          <span>PNG, JPEG or WebP · Up to 2 MB</span>
                        </div>
                      </div>
                      <div className={styles.logoControls}>
                        {draft.logoUrl ? (
                          <div className={`${styles.logoPreviewCard} ${styles.logoPreviewReady}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={draft.logoUrl} alt={`${draft.businessName || 'Business'} logo preview`} />
                          </div>
                        ) : null}
                        <div className={styles.logoButtons}>
                          <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleLogo} />
                          <button className={styles.logoUpload} type="button" onClick={() => logoInputRef.current?.click()}>
                            <StudioIcon name="image" />
                            <span>{draft.logoUrl ? 'Replace logo' : 'Add logo'}</span>
                          </button>
                          {draft.logoUrl ? (
                            <button className={styles.logoRemove} type="button" onClick={() => update('logoUrl', '')}>
                              <StudioIcon name="delete" />Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {draft.logoUrl ? <label className={styles.checkField}>
                        <input type="checkbox" checked={draft.logoBackground !== false} onChange={(event) => update('logoBackground', event.target.checked)} />
                        <span>White logo background</span>
                      </label> : null}
                    </div>
                  </fieldset>
                </section>
              ) : null}

              {activeStep === 2 ? (
                <section aria-labelledby="studio-layout-title">
                  <div className={styles.stepIntro}>
                    <h2 id="studio-layout-title">Choose a layout</h2>
                    <p>Layouts adapt to the number of listing photos.</p>
                  </div>
                  <fieldset className={styles.stepFieldset} disabled={!canManage || saving}>
                    <legend className={styles.srOnly}>Advert layout</legend>
                    <div className={styles.templateGrid}>
                      {AD_TEMPLATE_OPTIONS.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className={`${styles.templateChoice} ${draft.templateId === template.id ? styles.templateChoiceActive : ''}`}
                          onClick={() => update('templateId', template.id)}
                          aria-pressed={draft.templateId === template.id}
                          style={{
                            '--brand-primary': draft.primaryColor,
                            '--brand-secondary': draft.secondaryColor,
                            '--brand-accent': draft.accentColor,
                          } as CSSProperties}
                        >
                          <span className={`${styles.miniTemplate} ${TEMPLATE_CLASS_NAMES[template.id]}`} aria-hidden="true">
                            <i /><b /><em /><u />
                          </span>
                          <span className={styles.templateTitle}>
                            <strong>{template.name}</strong>
                            <b>{draft.templateId === template.id ? 'Selected' : template.recommended ? 'Recommended' : template.purpose}</b>
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
                    <h2 id="studio-style-title">Colours and wording</h2>
                    <p>Make each advert feel like your business.</p>
                  </div>
                  <fieldset className={styles.stepFieldset} disabled={!canManage || saving}>
                    <legend className={styles.srOnly}>Advert colours and wording</legend>
                    <div className={styles.styleGrid}>
                      <div className={styles.colourRow}>
                        {([
                          ['primaryColor', 'Primary', 'Main advert panel'],
                          ['secondaryColor', 'Secondary', 'Supporting areas and text'],
                          ['accentColor', 'Accent', 'Price highlight'],
                        ] as const).map(([key, label, helper]) => (
                          <div className={styles.colourControl} key={key}>
                            <label htmlFor={`studio-${key}`}>{label}</label>
                            <div>
                              <input id={`studio-${key}`} type="color" value={draft[key]} onChange={(event) => update(key, event.target.value)} />
                              <input key={draft[key]} aria-label={`${label} colour code`} defaultValue={draft[key]} maxLength={7}
                                onBlur={(event) => {
                                  const value = event.target.value.trim();
                                  if (/^#[0-9a-f]{6}$/i.test(value)) update(key, value);
                                  else event.target.value = draft[key];
                                }} />
                            </div>
                            <small>{helper}</small>
                          </div>
                        ))}
                      </div>
                      <fieldset className={styles.choiceField}>
                        <legend><StudioIcon name="language" />Advert language</legend>
                        <div className={styles.choices}>
                          {(['en', 'af'] as const).map((language) => (
                            <button type="button" key={language} aria-pressed={draft.language === language} onClick={() => update('language', language)}>
                              {language === 'en' ? 'English' : 'Afrikaans'}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset className={styles.choiceField}>
                        <legend><StudioIcon name="price" />Price wording</legend>
                        <div className={styles.choices}>
                          {(['plus-vat', 'vat-included', 'no-vat'] as const).map((label) => (
                            <button type="button" key={label} aria-pressed={draft.vatLabel === label} onClick={() => update('vatLabel', label)}>
                              {vatPreview(draft.language, label)}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <label className={styles.checkField}>
                        <input type="checkbox" checked={draft.isDefault} onChange={(event) => update('isDefault', event.target.checked)} />
                        <span><strong>Use as the default</strong><small>Use this style for new adverts.</small></span>
                      </label>
                    </div>
                  </fieldset>
                </section>
              ) : null}

              {activeStep === 4 ? (
                <section aria-labelledby="studio-review-title">
                  <div className={styles.stepIntro}>
                    <h2 id="studio-review-title">Check and save</h2>
                    <p>Make sure everything looks right before saving.</p>
                  </div>
                  <div className={styles.reviewGrid}>
                    <article className={styles.reviewBrand}>
                      <span>Details</span>
                      <button className={styles.reviewEdit} type="button" onClick={() => moveToStep(1)} aria-label="Edit brand"><StudioIcon name="edit" /></button>
                      <div className={styles.reviewBrandSummary}>
                        {draft.logoUrl ? (
                          <span className={styles.reviewLogo}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={draft.logoUrl} alt="" />
                          </span>
                        ) : null}
                        <div>
                          <strong>{draft.businessName || 'Business name not added'}</strong>
                          <small>{draft.contactName || 'No contact person'} · {draft.phone || 'No phone number'}</small>
                        </div>
                      </div>
                      <small>{draft.logoUrl ? 'Logo added' : 'No logo added'}</small>
                    </article>
                    <article>
                      <span>Layout</span>
                      <button className={styles.reviewEdit} type="button" onClick={() => moveToStep(2)} aria-label="Edit layout"><StudioIcon name="edit" /></button>
                      <strong>{selectedTemplate.name}</strong>
                      <small>Up to {selectedTemplate.photoCount} photo{selectedTemplate.photoCount === 1 ? '' : 's'}.</small>
                    </article>
                    <article>
                      <span>Wording</span>
                      <button className={styles.reviewEdit} type="button" onClick={() => moveToStep(3)} aria-label="Edit wording"><StudioIcon name="edit" /></button>
                      <strong>{draft.language === 'af' ? 'Afrikaans' : 'English'} · {vatPreview(draft.language, draft.vatLabel)}</strong>
                      <small>{draft.isDefault ? 'Default advert template' : 'Optional advert template'}</small>
                    </article>
                    <article className={styles.reviewColours}>
                      <span>Colours</span>
                      <button className={styles.reviewEdit} type="button" onClick={() => moveToStep(3)} aria-label="Edit colours"><StudioIcon name="edit" /></button>
                      <div>
                        {[draft.primaryColor, draft.secondaryColor, draft.accentColor].map((color, index) => (
                          <i key={`${color}-${index}`} style={{ backgroundColor: color }} title={color} />
                        ))}
                      </div>
                      <small>Primary, secondary and accent</small>
                    </article>
                  </div>
                </section>
              ) : null}
            </div>

            <div className={styles.actions}>
              <div>
                {activeStep > 1 ? <button className={styles.backButton} type="button" onClick={() => moveToStep((activeStep - 1) as StudioStep)}><StudioIcon name="back" />Back</button> : null}
                {draft.id && activeStep === 4 && canManage ? <button className={styles.dangerButton} type="button" onClick={() => void deleteKit()} disabled={saving}><StudioIcon name="delete" />Delete style</button> : null}
              </div>
              <div>
                {activeStep < 4 ? (
                  <button className={styles.primaryButton} type="button" onClick={() => moveToStep((activeStep + 1) as StudioStep)}>Continue<StudioIcon name="next" /></button>
                ) : (
                  <>
                    {draft.id ? <Link className={styles.secondaryButton} href={dealerAppMode ? `${dealerAppRoot}/valuation` : '/valuation'}>Start a valuation<StudioIcon name="next" /></Link> : null}
                    {canManage ? <button className={styles.primaryButton} type="submit" disabled={saving}><StudioIcon name="check" />{saving ? 'Saving…' : 'Save advert template'}</button> : null}
                  </>
                )}
              </div>
            </div>
          </form>

          <aside className={styles.previewPanel}>
            <div className={styles.previewHeading}>
              <div className={styles.previewTitle}>
                <strong>Template preview</strong>
              </div>
              <div className={styles.previewTools}>
                <button className={styles.secondaryButton} type="button" title="Up to four photos · Preview only" onClick={requestPreviewPhotos}><StudioIcon name="image-add" />Add photo</button>
                {previewPhotos.length ? <button className={styles.ghostButton} type="button" onClick={clearPreviewPhotos}><StudioIcon name="delete" />Clear</button> : null}
                <button className={styles.primaryButton} type="button" onClick={downloadPreviewPng} disabled={downloadingPreview}><StudioIcon name="download" />{downloadingPreview ? 'Downloading…' : 'Download PNG'}</button>
              </div>
            </div>
            {previewDownloadError ? <p role="alert">{previewDownloadError}</p> : null}
            <div className={styles.previewPhotoLab}>
              <input
                ref={previewPhotoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={handlePreviewPhotoChange}
              />
              {previewPhotos.length ? (
                <div className={styles.previewPhotoTray} aria-label="Sample advert photo order">
                  {previewPhotos.map((photo, index) => (
                    <article
                      key={photo.id}
                      className={`${styles.previewPhotoThumb} ${draggedPreviewPhotoId === photo.id ? styles.previewPhotoDragging : ''}`}
                      draggable
                      onDragStart={(event) => {
                        setDraggedPreviewPhotoId(photo.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', photo.id);
                      }}
                      onDragEnd={() => setDraggedPreviewPhotoId('')}
                      onDragOver={(event) => {
                        if (!event.dataTransfer.files.length) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }
                      }}
                      onDrop={(event) => {
                        if (event.dataTransfer.files.length) return;
                        event.preventDefault();
                        event.stopPropagation();
                        reorderPreviewPhoto(photo.id);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.previewUrl} alt={`Sample advert photo ${index + 1}: ${photo.name}`} />
                      <span>{index === 0 ? 'Main photo' : `Photo ${index + 1}`}</span>
                      <div className={styles.previewPhotoActions}>
                        <button type="button" onClick={() => movePreviewPhoto(photo.id, -1)} disabled={index === 0} aria-label={`Move ${photo.name} earlier`}>←</button>
                        <button type="button" onClick={() => movePreviewPhoto(photo.id, 1)} disabled={index === previewPhotos.length - 1} aria-label={`Move ${photo.name} later`}>→</button>
                        <button type="button" onClick={() => removePreviewPhoto(photo.id)} aria-label={`Remove ${photo.name}`}>×</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="button" className={styles.expandPreview} onClick={openPreview} aria-label="Enlarge template preview">
            <canvas
              ref={previewCanvasRef}
              className={styles.adCanvasPreview}
              width="1600"
              height="900"
              aria-label={`${selectedTemplate.name} template preview with ${previewRating.label.toLowerCase()} rating`}
            />
            </button>
            <div className={styles.previewNote}>
              <p>Sample details for testing your template. Click to enlarge.</p>
            </div>
            <dialog ref={photoHelpDialogRef} className={styles.photoHelpDialog} aria-labelledby="template-photo-help-title" aria-describedby="template-photo-help-description" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
              <div className={styles.dialogHeading}>
                <div className={styles.photoHelpTitle}><span className={styles.photoHelpIcon}><StudioIcon name="image-add" /></span><h2 id="template-photo-help-title">Test your template</h2></div>
                <button type="button" data-modal-close="true" aria-label="Close photo guidance" onClick={() => photoHelpDialogRef.current?.close()}>×</button>
              </div>
              <p id="template-photo-help-description">Add a sample photo to see how your design looks. Use Create Advert to add your actual listing photos.</p>
              <button type="button" className={styles.primaryButton} autoFocus onClick={() => { photoHelpDialogRef.current?.close(); previewPhotoInputRef.current?.click(); }}><StudioIcon name="image-add" />Choose photo</button>
            </dialog>
            <dialog ref={previewDialogRef} className={styles.previewDialog} aria-labelledby="studio-large-preview-title" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
              <div className={styles.dialogHeading}>
                <h2 id="studio-large-preview-title">Template preview</h2>
                <div className={styles.dialogTools}>
                  <button className={styles.primaryButton} type="button" onClick={downloadPreviewPng} disabled={downloadingPreview}><StudioIcon name="download" />{downloadingPreview ? 'Downloading…' : 'Download PNG'}</button>
                  <button type="button" data-modal-close="true" aria-label="Close template preview" autoFocus title="Close template preview (Esc)" onClick={() => previewDialogRef.current?.close()}>×</button>
                </div>
              </div>
              {previewDownloadError ? <p role="alert">{previewDownloadError}</p> : null}
              <div className={styles.previewDialogBody}>
                <canvas ref={enlargedCanvasRef} width="1600" height="900" aria-label="Enlarged template preview" />
              </div>
            </dialog>
          </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}

