'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
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

type PreviewPhoto = {
  id: string;
  name: string;
  previewUrl: string;
};

const MAX_PREVIEW_PHOTOS = 4;
const MAX_PREVIEW_PHOTO_BYTES = 10_000_000;
const SUPPORTED_PREVIEW_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type StudioIconName =
  | 'styles'
  | 'plus'
  | 'edit'
  | 'star'
  | 'delete'
  | 'details'
  | 'layout'
  | 'palette'
  | 'review'
  | 'check'
  | 'back'
  | 'next'
  | 'preview'
  | 'image'
  | 'language'
  | 'price'
  | 'chevron';

function StudioIcon({ name }: { name: StudioIconName }) {
  const svgProps = {
    'aria-hidden': true,
    focusable: 'false',
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  } as const;
  const strokeProps = {
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
  } as const;

  return (
    <svg {...svgProps} className={styles.studioIcon}>
      {name === 'styles' ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" opacity="0.12" />
          <path {...strokeProps} d="M8 8h8M8 12h5M8 16h3" />
          <path {...strokeProps} d="m16.2 13.8.55 1.1 1.2.18-.87.85.2 1.2-1.08-.57-1.08.57.2-1.2-.87-.85 1.2-.18.55-1.1Z" />
        </>
      ) : null}
      {name === 'plus' ? <path {...strokeProps} d="M12 5v14M5 12h14" /> : null}
      {name === 'edit' ? (
        <>
          <path {...strokeProps} d="M5 19h4l9.6-9.6a2.2 2.2 0 0 0-3.1-3.1L5.9 15.9 5 19Z" />
          <path {...strokeProps} d="m14.2 7.6 3.1 3.1" />
        </>
      ) : null}
      {name === 'star' ? <path {...strokeProps} d="m12 4 2.35 4.75 5.25.76-3.8 3.7.9 5.23L12 16l-4.7 2.44.9-5.23-3.8-3.7 5.25-.76L12 4Z" /> : null}
      {name === 'delete' ? (
        <>
          <path {...strokeProps} d="M5 7h14M9 7V4.8h6V7M7.2 7l.7 12h8.2l.7-12M10 10.5v5M14 10.5v5" />
        </>
      ) : null}
      {name === 'details' ? (
        <>
          <circle cx="9" cy="8" r="3" fill="currentColor" opacity="0.12" />
          <circle {...strokeProps} cx="9" cy="8" r="3" />
          <path {...strokeProps} d="M4.5 19c.4-3.2 2-5 4.5-5s4.1 1.8 4.5 5M15.5 7h4M15.5 11h4M15.5 15h3" />
        </>
      ) : null}
      {name === 'layout' ? (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2.5" fill="currentColor" opacity="0.1" />
          <rect {...strokeProps} x="4" y="5" width="16" height="14" rx="2.5" />
          <path {...strokeProps} d="M13 5v14M13 10h7" />
        </>
      ) : null}
      {name === 'palette' ? (
        <>
          <path {...strokeProps} d="M12 4.2a7.8 7.8 0 1 0 0 15.6h1.3a1.8 1.8 0 0 0 0-3.6h-.5a1.4 1.4 0 0 1 0-2.8H15a4.8 4.8 0 0 0 0-9.2h-3Z" />
          <circle cx="8" cy="9" r="1" fill="currentColor" />
          <circle cx="11.5" cy="7" r="1" fill="currentColor" />
          <circle cx="7.5" cy="13" r="1" fill="currentColor" />
        </>
      ) : null}
      {name === 'review' ? (
        <>
          <rect x="5" y="4" width="14" height="16" rx="2.5" fill="currentColor" opacity="0.1" />
          <rect {...strokeProps} x="5" y="4" width="14" height="16" rx="2.5" />
          <path {...strokeProps} d="m8.5 10 1.4 1.4 2.5-2.8M8.5 15h7" />
        </>
      ) : null}
      {name === 'check' ? <path {...strokeProps} d="m5 12.5 4.2 4.2L19 7" /> : null}
      {name === 'back' ? <path {...strokeProps} d="m14.5 6-6 6 6 6" /> : null}
      {name === 'next' ? <path {...strokeProps} d="m9.5 6 6 6-6 6" /> : null}
      {name === 'preview' ? (
        <>
          <path {...strokeProps} d="M3.8 12s3-5 8.2-5 8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" />
          <circle {...strokeProps} cx="12" cy="12" r="2.2" />
        </>
      ) : null}
      {name === 'image' ? (
        <>
          <rect {...strokeProps} x="4" y="5" width="16" height="14" rx="2.5" />
          <circle cx="9" cy="10" r="1.4" fill="currentColor" />
          <path {...strokeProps} d="m6.5 17 4.1-4.2 2.6 2.5 1.7-1.7 2.6 3.4" />
        </>
      ) : null}
      {name === 'language' ? (
        <>
          <circle {...strokeProps} cx="12" cy="12" r="8" />
          <path {...strokeProps} d="M4.5 9h15M4.5 15h15M12 4c2.1 2.2 3.1 4.9 3.1 8s-1 5.8-3.1 8c-2.1-2.2-3.1-4.9-3.1-8S9.9 6.2 12 4Z" />
        </>
      ) : null}
      {name === 'price' ? (
        <>
          <path {...strokeProps} d="M4.5 6.5v5.1L12.9 20l7.1-7.1-8.4-8.4H6.5a2 2 0 0 0-2 2Z" />
          <circle cx="8.3" cy="8.3" r="1.25" fill="currentColor" />
        </>
      ) : null}
      {name === 'chevron' ? <path {...strokeProps} d="m7 9.5 5 5 5-5" /> : null}
    </svg>
  );
}

const STUDIO_STEPS: Array<{ id: StudioStep; label: string }> = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Layout' },
  { id: 3, label: 'Style' },
  { id: 4, label: 'Review' },
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
  if (label === 'vat-included') return language === 'af' ? 'BTW ingesluit' : 'VAT included';
  if (label === 'no-vat') return language === 'af' ? 'Geen BTW' : 'No VAT';
  return language === 'af' ? '+ BTW' : '+ VAT';
}

function createPreviewPhotoId(): string {
  return `studio-preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  const [previewPhotos, setPreviewPhotos] = useState<PreviewPhoto[]>([]);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [previewDropActive, setPreviewDropActive] = useState(false);
  const [draggedPreviewPhotoId, setDraggedPreviewPhotoId] = useState('');
  const editorRef = useRef<HTMLFormElement | null>(null);
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
    imageUrls: previewPhotos.map((photo) => photo.previewUrl),
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
  }, [previewContent]);

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
      const response = await fetch('/api/ad-studio/brand-kits', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as BrandKitResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Brand kits could not be loaded.');

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
      setError(nextError instanceof Error ? nextError.message : 'Brand kits could not be loaded.');
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
    setFeedback('New brand kit ready to customise.');
    setError('');
    revealEditor();
  }

  function moveToStep(step: StudioStep) {
    if (step > 1 && !draft.name.trim()) {
      setActiveStep(1);
      setError('Give this brand kit a name before continuing.');
      return;
    }

    setActiveStep(step);
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
      setFeedback('Logo ready. It will be saved with this brand kit.');
    };
    reader.onerror = () => setError('The logo could not be read.');
    reader.readAsDataURL(file);
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    applyLogoFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleLogoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setLogoDragActive(false);
    applyLogoFile(Array.from(event.dataTransfer.files)[0]);
  }

  function addPreviewPhotos(files: File[]) {
    const imageFiles = files.filter((file) => SUPPORTED_PREVIEW_IMAGE_TYPES.has(file.type));
    if (!imageFiles.length) {
      setError('Drop PNG, JPEG or WebP photos into the preview.');
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

  function handlePreviewPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    addPreviewPhotos(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handlePreviewPhotoDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setPreviewDropActive(false);
    if (event.dataTransfer.files.length) addPreviewPhotos(Array.from(event.dataTransfer.files));
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
      setError('Give this brand kit a name.');
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
      if (!response.ok || !payload?.ok || !payload.kit) throw new Error(payload?.error || 'Brand kit could not be saved.');
      setFeedback('Brand kit saved. It is now available when you create an advert from a valuation.');
      await loadBrandKits(payload.kit.id, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Brand kit could not be saved.');
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
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Brand kit could not be removed.');
      setFeedback('Brand kit removed.');
      await loadBrandKits(undefined, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Brand kit could not be removed.');
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
      if (!response.ok || !payload?.ok || !payload.kit) throw new Error(payload?.error || 'The default brand kit could not be changed.');
      setFeedback(`“${kit.name}” is now the default brand kit.`);
      await loadBrandKits(payload.kit.id, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The default brand kit could not be changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.page} ${dealerAppMode ? styles.dealerPage : ''} ${middlemanMode ? styles.middlemanPage : ''}`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>Create adverts that look like your business</h1>
          <p>Add your details, logo and colours once. Aim4price will use them on every advert.</p>
        </div>
        {canManage && !loading ? (
          <button className={styles.primaryButton} type="button" onClick={startNewKit}>
            {kits.length ? 'Create another advert style' : 'Create my advert style'}
          </button>
        ) : null}
      </header>

      {loading ? <div className={styles.notice}>Loading your brand kits…</div> : null}
      {error ? <div className={`${styles.notice} ${styles.error}`} role="alert">{error}</div> : null}
      {feedback ? <div className={`${styles.notice} ${styles.success}`} role="status">{feedback}</div> : null}
      {!canManage && !loading ? (
        <div className={styles.notice}>You can review and use the company brand kits. Only the Dealer Owner can change them.</div>
      ) : null}

      {!loading ? (
        <>
          {kits.length ? (
            <section className={styles.libraryPanel} aria-labelledby="brand-kit-library-title">
              <div className={styles.sectionHeader}>
                <div>
                  <h2 id="brand-kit-library-title">Saved brand kits</h2>
                  <p>Choose a style to edit or make your default.</p>
                </div>
                {canManage ? <button className={styles.primaryButton} type="button" onClick={startNewKit}>New advert style</button> : null}
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
            <div className={styles.editorHeader}>
              <div>
                <h2>{draft.id ? draft.name : 'Set up your advert style'}</h2>
                <p>{draft.id ? 'Update the details, layout or colours below.' : 'Add your details, choose a layout and save.'}</p>
              </div>
              {draft.id && canManage ? <button className={styles.ghostButton} type="button" onClick={startNewKit}>New advert style</button> : null}
            </div>

            <nav className={styles.stepper} aria-label="Brand kit setup steps">
              {STUDIO_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className={`${styles.stepButton} ${activeStep === step.id ? styles.stepButtonActive : ''} ${activeStep > step.id ? styles.stepButtonComplete : ''}`}
                  onClick={() => moveToStep(step.id)}
                  aria-current={activeStep === step.id ? 'step' : undefined}
                >
                  <span aria-hidden="true">{activeStep > step.id ? <StudioIcon name="check" /> : step.id}</span>
                  <strong>{step.label}</strong>
                  <span className={styles.srOnly}>{activeStep > step.id ? 'Complete' : `Step ${step.id} of 4`}</span>
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
                        Brand kit name
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
                        <div>
                          <strong>Your logo</strong>
                          <span>Your logo appears in a dedicated white space without cropping. Choose a PNG, JPEG or WebP file up to 2 MB. Transparent logos work best; without one, we use your business name.</span>
                        </div>
                      </div>
                      <div className={styles.logoControls}>
                        <div
                          className={`${styles.logoPreviewCard} ${draft.logoUrl ? styles.logoPreviewReady : ''} ${logoDragActive ? styles.logoPreviewDragging : ''}`}
                          onClick={() => {
                            if (canManage && !saving) logoInputRef.current?.click();
                          }}
                          onKeyDown={(event) => {
                            if (canManage && !saving && (event.key === 'Enter' || event.key === ' ')) {
                              event.preventDefault();
                              logoInputRef.current?.click();
                            }
                          }}
                          onDragEnter={(event) => {
                            if (!canManage || saving) return;
                            event.preventDefault();
                            setLogoDragActive(true);
                          }}
                          onDragOver={(event) => {
                            if (!canManage || saving) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                            setLogoDragActive(true);
                          }}
                          onDragLeave={(event) => {
                            if (!canManage || saving) return;
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setLogoDragActive(false);
                          }}
                          onDrop={handleLogoDrop}
                          role="button"
                          tabIndex={canManage && !saving ? 0 : -1}
                          aria-disabled={!canManage || saving}
                          aria-label={draft.logoUrl ? 'Replace logo by choosing or dropping an image' : 'Choose or drop a logo image'}
                        >
                          {draft.logoUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={draft.logoUrl} alt={`${draft.businessName || 'Business'} logo preview`} />
                              <small className={styles.logoDropHint}>Drop to replace</small>
                            </>
                          ) : (
                            <span className={styles.logoPreviewEmpty}>
                              <StudioIcon name="image" />
                              <small>Drop logo here</small>
                            </span>
                          )}
                        </div>
                        <div className={styles.logoButtons}>
                          <label className={styles.logoUpload}>
                            <StudioIcon name="image" />
                            <span>{draft.logoUrl ? 'Replace logo' : 'Choose logo'}</span>
                            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} />
                          </label>
                          {draft.logoUrl ? (
                            <button className={styles.logoRemove} type="button" onClick={() => update('logoUrl', '')}>
                              <StudioIcon name="delete" />Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </fieldset>
                </section>
              ) : null}

              {activeStep === 2 ? (
                <section aria-labelledby="studio-layout-title">
                  <div className={styles.stepIntro}>
                    <h2 id="studio-layout-title">Choose your advert layout</h2>
                    <p>Pick the design you prefer. If a listing has fewer photos, Aim4price adapts the layout automatically.</p>
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
                    <h2 id="studio-style-title">Choose your colours and wording</h2>
                    <p>Make each advert feel like your business.</p>
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
                      <label className={styles.selectField}>
                        <span className={styles.fieldLabel}>Advert language</span>
                        <span className={styles.selectControl}>
                          <span className={styles.selectLeadingIcon} aria-hidden="true"><StudioIcon name="language" /></span>
                          <select value={draft.language} onChange={(event) => update('language', event.target.value as AdLanguage)}>
                            <option value="en">English</option>
                            <option value="af">Afrikaans</option>
                          </select>
                          <span className={styles.selectChevron} aria-hidden="true"><StudioIcon name="chevron" /></span>
                        </span>
                      </label>
                      <label className={styles.selectField}>
                        <span className={styles.fieldLabel}>Price wording</span>
                        <span className={styles.selectControl}>
                          <span className={styles.selectLeadingIcon} aria-hidden="true"><StudioIcon name="price" /></span>
                          <select value={draft.vatLabel} onChange={(event) => update('vatLabel', event.target.value as AdVatLabel)}>
                            <option value="plus-vat">Plus VAT / + BTW</option>
                            <option value="vat-included">VAT included / BTW ingesluit</option>
                            <option value="no-vat">No VAT / Geen BTW</option>
                          </select>
                          <span className={styles.selectChevron} aria-hidden="true"><StudioIcon name="chevron" /></span>
                        </span>
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
                    <h2 id="studio-review-title">Check and save</h2>
                    <p>Make sure everything looks right before saving.</p>
                  </div>
                  <div className={styles.reviewGrid}>
                    <article className={styles.reviewBrand}>
                      <span>Brand</span>
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
                      <small>{draft.logoUrl ? 'Logo contained in its dedicated white space without cropping.' : 'No logo added. Your business name will appear on its own.'}</small>
                    </article>
                    <article>
                      <span>Layout</span>
                      <strong>{selectedTemplate.name}</strong>
                      <small>{selectedTemplate.description} Uses up to {selectedTemplate.photoCount} photo{selectedTemplate.photoCount === 1 ? '' : 's'}.</small>
                    </article>
                    <article>
                      <span>Wording</span>
                      <strong>{draft.language === 'af' ? 'Afrikaans' : 'English'} · {vatPreview(draft.language, draft.vatLabel)}</strong>
                      <small>{draft.isDefault ? 'Default brand kit' : 'Optional brand kit'}</small>
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
                    <strong>Ready to create adverts</strong>
                    <p>Save this style, then choose it after any valuation. Aim4price will create and download the matching advert.</p>
                  </div>
                </section>
              ) : null}
            </div>

            <div className={styles.actions}>
              <div>
                {activeStep > 1 ? <button className={styles.backButton} type="button" onClick={() => moveToStep((activeStep - 1) as StudioStep)}><StudioIcon name="back" />Back</button> : null}
                {draft.id && activeStep === 4 && canManage ? <button className={styles.dangerButton} type="button" onClick={() => void deleteKit()} disabled={saving}><StudioIcon name="delete" />Delete kit</button> : null}
              </div>
              <div>
                {activeStep < 4 ? (
                  <button className={styles.primaryButton} type="button" onClick={() => moveToStep((activeStep + 1) as StudioStep)}>Continue<StudioIcon name="next" /></button>
                ) : (
                  <>
                    {draft.id ? <Link className={styles.secondaryButton} href={dealerAppMode ? '/dealer/valuation' : '/valuation'}>Start a valuation<StudioIcon name="next" /></Link> : null}
                    {canManage ? <button className={styles.primaryButton} type="submit" disabled={saving}><StudioIcon name="check" />{saving ? 'Saving…' : 'Save brand kit'}</button> : null}
                  </>
                )}
              </div>
            </div>
          </form>

          <aside className={styles.previewPanel}>
            <div className={styles.previewHeading}>
              <div className={styles.previewTitle}>
                <strong>Advert preview</strong>
              </div>
            </div>
            <div
              className={`${styles.previewPhotoLab} ${previewDropActive ? styles.previewPhotoLabActive : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                if (event.dataTransfer.types.includes('Files')) setPreviewDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (event.dataTransfer.types.includes('Files')) {
                  event.dataTransfer.dropEffect = 'copy';
                  setPreviewDropActive(true);
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreviewDropActive(false);
              }}
              onDrop={handlePreviewPhotoDrop}
            >
              <input
                ref={previewPhotoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={handlePreviewPhotoChange}
              />
              <div className={styles.previewPhotoHeader}>
                <div>
                  <strong>Preview with your photos</strong>
                  <span>Add up to four photos. Drag them to change the order. Preview photos are not saved.</span>
                </div>
                <div>
                  <button type="button" onClick={() => previewPhotoInputRef.current?.click()}>
                    <StudioIcon name="plus" />{previewPhotos.length ? 'Add photos' : 'Choose photos'}
                  </button>
                  {previewPhotos.length ? <button type="button" onClick={clearPreviewPhotos}>Clear</button> : null}
                </div>
              </div>

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
              ) : (
                <button className={styles.previewPhotoEmpty} type="button" onClick={() => previewPhotoInputRef.current?.click()}>
                  <StudioIcon name="image" />
                  <span><strong>Drop photos here</strong><small>Or choose photos from your device.</small></span>
                </button>
              )}
            </div>
            <canvas
              ref={previewCanvasRef}
              className={styles.adCanvasPreview}
              width="1600"
              height="900"
              aria-label={`${selectedTemplate.name} advert preview with ${previewRating.label.toLowerCase()} rating`}
            />
            <div className={styles.previewNote}>
              <p><strong>This is how your downloaded advert will look.</strong>{previewPhotos.length ? ' Preview photos are not saved.' : ' Listing photos and valuation details will be added automatically.'}</p>
            </div>
          </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
