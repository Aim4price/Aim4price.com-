'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';

type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: number | null;
  partnerLongitude: number | null;
  partnerServiceRadiusKm: number | null;
  partnerBrandFocus: string;
  partnerServices: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type AccountScanPinStatus = {
  enabled: boolean;
  hasPin: boolean;
  updatedAtIso: string | null;
};

type ProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

type ScanPinApiResponse = {
  ok: boolean;
  scanPin?: AccountScanPinStatus;
  error?: string;
};

type ProfileDraft = {
  displayName: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: string;
  partnerLongitude: string;
  partnerServiceRadiusKm: string;
  partnerBrandFocus: string;
  partnerServices: string;
};

const initialProfileDraft: ProfileDraft = {
  displayName: '',
  logoUrl: '',
  websiteUrl: '',
  extraPhotoUrls: [],
  businessName: '',
  phone: '',
  accountType: 'owner',
  vatNumber: '',
  province: '',
  townCity: '',
  addressLine1: '',
  addressLine2: '',
  notes: '',
  marketplaceSellerName: '',
  marketplacePhone: '',
  marketplaceEmail: '',
  marketplaceLocation: '',
  partnerDirectoryEnabled: false,
  partnerDirectoryStatus: 'approved',
  partnerDescription: '',
  partnerLatitude: '',
  partnerLongitude: '',
  partnerServiceRadiusKm: '',
  partnerBrandFocus: '',
  partnerServices: '',
};

const initialScanPinStatus: AccountScanPinStatus = {
  enabled: false,
  hasPin: false,
  updatedAtIso: null,
};

const PROFILE_COMPLETION_TOTAL = 6;
const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_BUSINESS_EXTRA_PHOTOS = 6;
const MAX_BUSINESS_PHOTO_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const DEFAULT_PARTNER_MAP_CENTER: [number, number] = [-29.0, 24.0];
const DEFAULT_PARTNER_MAP_ZOOM = 5;
const SELECTED_PARTNER_MAP_ZOOM = 11;
const LEAFLET_SCRIPT_ID = 'aim4price-leaflet-script';
const LEAFLET_CSS_ID = 'aim4price-leaflet-css';

let leafletLoaderPromise: Promise<any> | null = null;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  owner: 'Owner',
  dealer: 'Dealer',
  finance: 'Finance',
  insurance: 'Insurance',
  broker: 'Insurance',
  insurer: 'Insurance',
  bank: 'Finance',
};

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only load in the browser.'));
  }

  const existingLeaflet = (window as any).L;

  if (existingLeaflet) {
    return Promise.resolve(existingLeaflet);
  }

  if (leafletLoaderPromise) {
    return leafletLoaderPromise;
  }

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const resolveIfReady = () => {
      const nextLeaflet = (window as any).L;

      if (nextLeaflet) {
        resolve(nextLeaflet);
        return true;
      }

      return false;
    };

    if (resolveIfReady()) {
      return;
    }

    let script = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = LEAFLET_SCRIPT_ID;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      document.body.appendChild(script);
    }

    script.addEventListener('load', () => {
      if (!resolveIfReady()) {
        reject(new Error('Leaflet did not initialise correctly.'));
      }
    });
    script.addEventListener('error', () => reject(new Error('Failed to load the map.')));
  });

  return leafletLoaderPromise;
}

function parseCoordinate(value: string): number | null {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function readPartnerPin(profile: ProfileDraft): { lat: number; lng: number } | null {
  const lat = parseCoordinate(profile.partnerLatitude);
  const lng = parseCoordinate(profile.partnerLongitude);

  if (lat === null || lng === null) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  // South African partner locations should never have a zero latitude or longitude.
  // Treat a zero coordinate as an incomplete stale/manual value instead of centering the map in the ocean.
  if (Math.abs(lat) < 0.000001 || Math.abs(lng) < 0.000001) {
    return null;
  }

  return { lat, lng };
}

function formatCoordinate(value: number): string {
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function readServiceRadiusKm(value: string): number | null {
  const numeric = Number(String(value ?? '').trim());

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.min(Math.round(numeric), 2500);
}

function buildProfileLocation(profile: AccountProfile): string {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function normalizeImageUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const entry of value) {
    const url = String(entry ?? '').trim();

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);

    if (urls.length >= MAX_BUSINESS_EXTRA_PHOTOS) {
      break;
    }
  }

  return urls;
}

function formatWebsiteLabel(value: string): string {
  const text = String(value ?? '').trim();

  if (!text) {
    return 'No website saved yet';
  }

  return text.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function buildProfileDraft(profile: AccountProfile | null): ProfileDraft {
  if (!profile) {
    return initialProfileDraft;
  }

  const displayName = profile.displayName || profile.name;
  const fallbackLocation = buildProfileLocation(profile);

  return {
    displayName,
    logoUrl: profile.logoUrl,
    websiteUrl: profile.websiteUrl,
    extraPhotoUrls: normalizeImageUrlList(profile.extraPhotoUrls),
    businessName: profile.businessName,
    phone: profile.phone,
    accountType: profile.accountType || 'owner',
    vatNumber: profile.vatNumber,
    province: profile.province,
    townCity: profile.townCity,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    notes: profile.notes,
    marketplaceSellerName: profile.marketplaceSellerName || profile.businessName || displayName,
    marketplacePhone: profile.marketplacePhone || profile.phone,
    marketplaceEmail: profile.marketplaceEmail || profile.email,
    marketplaceLocation: profile.marketplaceLocation || fallbackLocation,
    partnerDirectoryEnabled: Boolean(profile.partnerDirectoryEnabled),
    partnerDirectoryStatus: profile.partnerDirectoryStatus || 'approved',
    partnerDescription: profile.partnerDescription,
    partnerLatitude: profile.partnerLatitude === null ? '' : String(profile.partnerLatitude),
    partnerLongitude: profile.partnerLongitude === null ? '' : String(profile.partnerLongitude),
    partnerServiceRadiusKm: profile.partnerServiceRadiusKm === null ? '' : String(profile.partnerServiceRadiusKm),
    partnerBrandFocus: profile.partnerBrandFocus,
    partnerServices: profile.partnerServices,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatMemberSince(value?: string | null): string {
  if (!value) return 'Member since —';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Member since —';

  return `Member since ${new Intl.DateTimeFormat('en-ZA', {
    month: 'long',
    year: 'numeric',
  }).format(parsed)}`;
}

function formatUploadSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function countCompletedFields(profile: ProfileDraft): number {
  return [
    profile.displayName,
    profile.businessName,
    profile.phone,
    profile.province,
    profile.townCity,
    profile.addressLine1,
  ].filter((value) => String(value ?? '').trim()).length;
}

function buildAddressLines(profile: ProfileDraft): string[] {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function normalizePinInput(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 8);
}

function formatAccountTypeLabel(value: string): string {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return 'Owner';
  }

  return ACCOUNT_TYPE_LABELS[normalized] ?? normalized;
}

function buildInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return 'A4';
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      result ? resolve(result) : reject(new Error('Failed to read image file.'));
    };

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => '');
  return text.trim() ? { message: text } : null;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const errorRecord =
    typeof record.error === 'object' && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;

  const candidates = [record.message, record.error, record.reason, errorRecord?.message, errorRecord?.error];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

export default function AccountClient() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(initialProfileDraft);
  const [scanPinStatus, setScanPinStatus] = useState<AccountScanPinStatus>(initialScanPinStatus);
  const [scanPinDraft, setScanPinDraft] = useState('');
  const [scanPinConfirmDraft, setScanPinConfirmDraft] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingScanPin, setIsLoadingScanPin] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingScanPin, setIsSavingScanPin] = useState(false);
  const [isDisablingScanPin, setIsDisablingScanPin] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isReadingLogo, setIsReadingLogo] = useState(false);
  const [isReadingBusinessPhotos, setIsReadingBusinessPhotos] = useState(false);
  const partnerMapElementRef = useRef<HTMLDivElement | null>(null);
  const partnerLeafletMapRef = useRef<any>(null);
  const partnerPinMarkerRef = useRef<any>(null);
  const partnerRadiusCircleRef = useRef<any>(null);
  const businessDetailsSectionRef = useRef<HTMLElement | null>(null);
  const scanPinSectionRef = useRef<HTMLElement | null>(null);
  const marketplaceSectionRef = useRef<HTMLElement | null>(null);
  const partnerDirectorySectionRef = useRef<HTMLElement | null>(null);
  const [isBusinessEditorOpen, setIsBusinessEditorOpen] = useState(false);
  const [isMarketplaceEditorOpen, setIsMarketplaceEditorOpen] = useState(false);
  const [isScanPinEditorOpen, setIsScanPinEditorOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setIsLoading(true);

      try {
        const response = await fetch('/api/account-profile', {
          cache: 'no-store',
          credentials: 'include',
        });

        const data = (await response.json()) as ProfileApiResponse;

        if (!response.ok || !data.ok || !data.profile) {
          throw new Error(data.error ?? 'Failed to load account profile.');
        }

        if (!mounted) {
          return;
        }

        setProfile(data.profile);
        setProfileDraft(buildProfileDraft(data.profile));
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load account profile.',
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    async function loadScanPin() {
      setIsLoadingScanPin(true);

      try {
        const response = await fetch('/api/account-profile/scan-pin', {
          cache: 'no-store',
          credentials: 'include',
        });

        const data = (await response.json()) as ScanPinApiResponse;

        if (!response.ok || !data.ok || !data.scanPin) {
          throw new Error(data.error ?? 'Failed to load scan PIN settings.');
        }

        if (!mounted) {
          return;
        }

        setScanPinStatus(data.scanPin);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load scan PIN settings.',
        });
      } finally {
        if (mounted) {
          setIsLoadingScanPin(false);
        }
      }
    }

    void loadProfile();
    void loadScanPin();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeletingAccount) {
        setIsDeleteDialogOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDeleteDialogOpen, isDeletingAccount]);

  const completedFields = useMemo(() => countCompletedFields(profileDraft), [profileDraft]);
  const completionPercentage = Math.round((completedFields / PROFILE_COMPLETION_TOTAL) * 100);
  const completionLabel =
    completedFields >= PROFILE_COMPLETION_TOTAL
      ? 'Complete'
      : `${PROFILE_COMPLETION_TOTAL - completedFields} left`;
  const addressLines = useMemo(() => buildAddressLines(profileDraft), [profileDraft]);
  const accountTypeLabel = useMemo(() => formatAccountTypeLabel(profileDraft.accountType), [profileDraft.accountType]);
  const normalizedAccountType = String(profile?.accountType || profileDraft.accountType || 'owner')
    .trim()
    .toLowerCase();
  const isOwnerAccount = normalizedAccountType === 'owner';
  const isDealerAccount = normalizedAccountType === 'dealer';
  const isPartnerAccount = !isOwnerAccount;
  const showScanPinControls = !isLoading && isOwnerAccount;
  const showPartnerDirectory = !isLoading && isPartnerAccount;
  const showMarketplaceContact = isLoading || isOwnerAccount || isDealerAccount;
  const accountDisplayName = profileDraft.displayName.trim() || profile?.name || 'Aim4price user';
  const profileInitials = useMemo(
    () => buildInitials(accountDisplayName || profileDraft.businessName || 'Aim4price'),
    [accountDisplayName, profileDraft.businessName],
  );
  const scanPinStatusLabel = scanPinStatus.enabled ? 'Active' : 'Disabled';
  const logoUrl = profileDraft.logoUrl.trim();
  const extraPhotoUrls = useMemo(
    () => normalizeImageUrlList(profileDraft.extraPhotoUrls),
    [profileDraft.extraPhotoUrls],
  );
  const websiteUrl = profileDraft.websiteUrl.trim();
  const websiteDisplayLabel = formatWebsiteLabel(websiteUrl);
  const marketplaceSellerName =
    profileDraft.marketplaceSellerName.trim() || profileDraft.businessName.trim() || accountDisplayName;
  const marketplacePhone = profileDraft.marketplacePhone.trim() || profileDraft.phone.trim() || 'No contact details saved yet';
  const marketplaceEmail = profileDraft.marketplaceEmail.trim() || profile?.email || 'No email found';
  const marketplaceLocation =
    profileDraft.marketplaceLocation.trim() || (addressLines.length ? addressLines.join(', ') : 'No location saved yet');
  const partnerDirectoryPin = useMemo(
    () => readPartnerPin(profileDraft),
    [profileDraft.partnerLatitude, profileDraft.partnerLongitude],
  );
  const partnerDirectoryPinLabel = partnerDirectoryPin
    ? `${formatCoordinate(partnerDirectoryPin.lat)}, ${formatCoordinate(partnerDirectoryPin.lng)}`
    : 'No map pin selected yet';
  const memberSinceLabel = formatMemberSince(profile?.createdAtIso);
  const updatedLabel = formatDate(profile?.updatedAtIso || profile?.createdAtIso);
  const businessNameLabel = profileDraft.businessName.trim() || 'No business name saved yet';
  const businessContactDetailsLabel = profileDraft.phone.trim() || 'No contact details saved yet';
  const businessEmailLabel = profile?.email || 'No email found';
  const businessLocationLabel = addressLines.length ? addressLines.join(', ') : 'No location saved yet';
  const marketplaceProfileComplete = Boolean(
    (profileDraft.marketplaceSellerName.trim() || profileDraft.businessName.trim() || accountDisplayName) &&
      (profileDraft.marketplacePhone.trim() || profileDraft.phone.trim()) &&
      (profileDraft.marketplaceEmail.trim() || profile?.email) &&
      (profileDraft.marketplaceLocation.trim() || addressLines.length),
  );
  const directoryStatusLabel = profileDraft.partnerDirectoryEnabled ? 'Visible' : 'Hidden';
  const scanPinDisplayLabel = isLoadingScanPin ? 'Loading' : scanPinStatus.hasPin ? scanPinStatusLabel : 'Not set';

  useEffect(() => {
    if (isLoading || !isPartnerAccount || !partnerMapElementRef.current) {
      return undefined;
    }

    let cancelled = false;

    async function renderPartnerMap() {
      try {
        const L = await loadLeaflet();

        if (cancelled || !partnerMapElementRef.current) {
          return;
        }

        const selectedPin = readPartnerPin(profileDraft);
        const center = selectedPin ? [selectedPin.lat, selectedPin.lng] : DEFAULT_PARTNER_MAP_CENTER;
        const zoom = selectedPin ? SELECTED_PARTNER_MAP_ZOOM : DEFAULT_PARTNER_MAP_ZOOM;

        if (!partnerLeafletMapRef.current) {
          partnerLeafletMapRef.current = L.map(partnerMapElementRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
          }).setView(center, zoom);

          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
            detectRetina: true,
          }).addTo(partnerLeafletMapRef.current);

          partnerLeafletMapRef.current.on('click', (event: any) => {
            setPartnerMapPin(event.latlng.lat, event.latlng.lng);
          });
        }

        if (partnerPinMarkerRef.current) {
          partnerPinMarkerRef.current.remove();
          partnerPinMarkerRef.current = null;
        }

        if (partnerRadiusCircleRef.current) {
          partnerRadiusCircleRef.current.remove();
          partnerRadiusCircleRef.current = null;
        }

        if (selectedPin) {
          const icon = L.divIcon({
            className: 'accountPartnerMapMarker',
            html: '<span class="accountPartnerMapMarkerPin"><b>PIN</b></span>',
            iconSize: [46, 46],
            iconAnchor: [23, 46],
            popupAnchor: [0, -40],
          });

          const marker = L.marker([selectedPin.lat, selectedPin.lng], {
            draggable: true,
            icon,
            title: 'Partner directory pin',
          }).addTo(partnerLeafletMapRef.current);

          marker.on('dragend', () => {
            const next = marker.getLatLng();
            setPartnerMapPin(next.lat, next.lng);
          });

          marker.bindPopup(
            `<strong>${accountDisplayName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong><br />Partner directory pin`,
          );

          partnerPinMarkerRef.current = marker;

          const radiusKm = readServiceRadiusKm(profileDraft.partnerServiceRadiusKm);

          if (radiusKm) {
            partnerRadiusCircleRef.current = L.circle([selectedPin.lat, selectedPin.lng], {
              radius: radiusKm * 1000,
              color: '#1f8a66',
              fillColor: '#1f8a66',
              fillOpacity: 0.08,
              opacity: 0.38,
              weight: 2,
            }).addTo(partnerLeafletMapRef.current);
          }

          partnerLeafletMapRef.current.setView([selectedPin.lat, selectedPin.lng], Math.max(partnerLeafletMapRef.current.getZoom(), 8));
        }

        window.requestAnimationFrame(() => partnerLeafletMapRef.current?.invalidateSize());
        window.setTimeout(() => partnerLeafletMapRef.current?.invalidateSize(), 80);
        window.setTimeout(() => partnerLeafletMapRef.current?.invalidateSize(), 320);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : 'Failed to load the map.',
          });
        }
      }
    }

    void renderPartnerMap();

    return () => {
      cancelled = true;
    };
  }, [
    accountDisplayName,
    isLoading,
    isPartnerAccount,
    profileDraft.partnerLatitude,
    profileDraft.partnerLongitude,
    profileDraft.partnerServiceRadiusKm,
  ]);

  useEffect(() => {
    return () => {
      if (partnerLeafletMapRef.current) {
        partnerLeafletMapRef.current.remove();
        partnerLeafletMapRef.current = null;
        partnerPinMarkerRef.current = null;
        partnerRadiusCircleRef.current = null;
      }
    };
  }, []);

  function setPartnerMapPin(lat: number, lng: number) {
    setProfileDraft((current) => ({
      ...current,
      partnerLatitude: lat.toFixed(6),
      partnerLongitude: lng.toFixed(6),
    }));
  }

  function clearPartnerMapPin() {
    setProfileDraft((current) => ({
      ...current,
      partnerLatitude: '',
      partnerLongitude: '',
    }));
  }

  function handleUseCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNotice({ tone: 'error', message: 'Current location is not available in this browser.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPartnerMapPin(position.coords.latitude, position.coords.longitude);
        setNotice({ tone: 'success', message: 'Map pin set to your current location. Click Save directory to store it.' });
      },
      () => {
        setNotice({ tone: 'error', message: 'Could not read your current location. Drop the pin manually on the map.' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      return;
    }

    const fileType = String(file.type ?? '').trim().toLowerCase();

    if (!ALLOWED_LOGO_TYPES.has(fileType)) {
      setNotice({ tone: 'error', message: 'Upload a JPG, PNG or WEBP logo.' });
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      setNotice({ tone: 'error', message: `Logo must be ${formatUploadSize(MAX_LOGO_UPLOAD_BYTES)} or smaller.` });
      return;
    }

    setIsReadingLogo(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const nextDraft = { ...profileDraft, logoUrl: dataUrl };
      setProfileDraft(nextDraft);
      await saveProfileDraft(nextDraft, 'Logo saved.');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to read image file.' });
    } finally {
      setIsReadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    const nextDraft = { ...profileDraft, logoUrl: '' };
    setProfileDraft(nextDraft);
    await saveProfileDraft(nextDraft, 'Logo removed.');
  }

  async function handleBusinessPhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length) {
      return;
    }

    const currentPhotoUrls = normalizeImageUrlList(profileDraft.extraPhotoUrls);
    const availableSlots = MAX_BUSINESS_EXTRA_PHOTOS - currentPhotoUrls.length;

    if (availableSlots <= 0) {
      setNotice({ tone: 'error', message: `You can upload up to ${MAX_BUSINESS_EXTRA_PHOTOS} extra photos.` });
      return;
    }

    if (files.length > availableSlots) {
      setNotice({
        tone: 'error',
        message: `You can add ${availableSlots} more photo${availableSlots === 1 ? '' : 's'}. Remove an existing photo first.`,
      });
      return;
    }

    for (const file of files) {
      const fileType = String(file.type ?? '').trim().toLowerCase();

      if (!ALLOWED_LOGO_TYPES.has(fileType)) {
        setNotice({ tone: 'error', message: 'Upload JPG, PNG or WEBP business photos.' });
        return;
      }

      if (file.size > MAX_BUSINESS_PHOTO_UPLOAD_BYTES) {
        setNotice({
          tone: 'error',
          message: `Each business photo must be ${formatUploadSize(MAX_BUSINESS_PHOTO_UPLOAD_BYTES)} or smaller.`,
        });
        return;
      }
    }

    setIsReadingBusinessPhotos(true);

    try {
      const dataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
      const nextDraft = {
        ...profileDraft,
        extraPhotoUrls: normalizeImageUrlList([...currentPhotoUrls, ...dataUrls]),
      };
      setProfileDraft(nextDraft);
      await saveProfileDraft(nextDraft, dataUrls.length === 1 ? 'Business photo saved.' : 'Business photos saved.');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to read business photos.' });
    } finally {
      setIsReadingBusinessPhotos(false);
    }
  }

  async function handleRemoveBusinessPhoto(photoIndex: number) {
    const currentPhotoUrls = normalizeImageUrlList(profileDraft.extraPhotoUrls);
    const nextDraft = {
      ...profileDraft,
      extraPhotoUrls: currentPhotoUrls.filter((_, index) => index !== photoIndex),
    };
    setProfileDraft(nextDraft);
    await saveProfileDraft(nextDraft, 'Business photo removed.');
  }

  async function saveProfileDraft(nextDraft: ProfileDraft, successMessage = 'Account details saved.'): Promise<boolean> {
    setIsSavingProfile(true);

    try {
      const response = await fetch('/api/account-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nextDraft),
      });

      const data = (await response.json()) as ProfileApiResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.error ?? 'Failed to save account details.');
      }

      setProfile(data.profile);
      setProfileDraft(buildProfileDraft(data.profile));
      setNotice({ tone: 'success', message: successMessage });
      return true;
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save account details.',
      });
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const didSave = await saveProfileDraft(profileDraft);

    if (didSave) {
      setIsBusinessEditorOpen(false);
      setIsMarketplaceEditorOpen(false);
    }
  }

  async function handleScanPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedPin = normalizePinInput(scanPinDraft);
    const normalizedConfirmPin = normalizePinInput(scanPinConfirmDraft);

    if (!normalizedPin) {
      setNotice({ tone: 'error', message: 'Enter a scan PIN.' });
      return;
    }

    if (normalizedPin.length < 4 || normalizedPin.length > 8) {
      setNotice({ tone: 'error', message: 'Scan PIN must be 4 to 8 digits.' });
      return;
    }

    if (normalizedPin !== normalizedConfirmPin) {
      setNotice({ tone: 'error', message: 'Scan PINs do not match.' });
      return;
    }

    setIsSavingScanPin(true);

    try {
      const response = await fetch('/api/account-profile/scan-pin', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pin: normalizedPin,
          confirmPin: normalizedConfirmPin,
        }),
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(extractErrorMessage(payload, 'Failed to save scan PIN.'));
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft('');
      setScanPinConfirmDraft('');
      setIsScanPinEditorOpen(false);
      setNotice({ tone: 'success', message: 'Scan PIN saved. QR scan access is now active.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save scan PIN.',
      });
    } finally {
      setIsSavingScanPin(false);
    }
  }

  async function handleDisableScanPin() {
    setIsDisablingScanPin(true);

    try {
      const response = await fetch('/api/account-profile/scan-pin', {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(extractErrorMessage(payload, 'Failed to disable scan PIN.'));
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft('');
      setScanPinConfirmDraft('');
      setIsScanPinEditorOpen(false);
      setNotice({ tone: 'success', message: 'Scan PIN disabled.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to disable scan PIN.',
      });
    } finally {
      setIsDisablingScanPin(false);
    }
  }

  function closeDeleteDialog() {
    if (isDeletingAccount) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDeletePassword('');
    setDeleteConfirmText('');
  }

  function scrollToSection(ref: { current: HTMLElement | null }) {
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openBusinessEditor() {
    setIsBusinessEditorOpen(true);
    scrollToSection(businessDetailsSectionRef);
  }

  function openAssetRegistersPage() {
    window.location.assign('/asset-registers');
  }

  function openMarketplaceEditor() {
    setIsMarketplaceEditorOpen(true);
    scrollToSection(marketplaceSectionRef);
  }

  function openScanPinEditor() {
    setIsBusinessEditorOpen(false);
    setIsScanPinEditorOpen(true);
    scrollToSection(scanPinSectionRef);
  }

  function openPartnerDirectory() {
    scrollToSection(partnerDirectorySectionRef);
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deletePassword.trim()) {
      setNotice({ tone: 'error', message: 'Enter your password to delete this account.' });
      return;
    }

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setNotice({ tone: 'error', message: 'Type DELETE to confirm account removal.' });
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword,
          callbackURL: '/',
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to delete account.'));
      }

      setNotice({
        tone: 'success',
        message: 'Your account and saved workspace data were deleted. Redirecting…',
      });
      setIsDeleteDialogOpen(false);
      setDeletePassword('');
      setDeleteConfirmText('');

      window.setTimeout(() => {
        window.location.assign('/');
      }, 700);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete account.',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <section className={styles.accountHero}>
          <div className={styles.heroIdentityGroup}>
            <label
              className={`${styles.heroAvatar} ${logoUrl ? styles.heroAvatarWithLogo : ''}`}
              title="Upload account logo"
              aria-label="Upload account logo"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoFileChange}
                disabled={isReadingLogo || isSavingProfile || isReadingBusinessPhotos}
              />
              {logoUrl ? <img src={logoUrl} alt="Business logo" /> : <span>{profileInitials}</span>}
            </label>

            <div className={styles.heroCopy}>
              <h1>{accountDisplayName}</h1>
              <p>{profile?.email || 'Loading email'}</p>
              <small>{accountTypeLabel} account&nbsp; • &nbsp;{memberSinceLabel}</small>
            </div>
          </div>

          <span className={styles.statusBadge}>Active</span>
        </section>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.topGrid}>
          <section className={`${styles.card} ${styles.overviewCard}`}>
            <div className={styles.compactCardHeader}>
              <h2>Account overview</h2>
              <p>Your account at a glance</p>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricTile}>
                <span>Account type</span>
                <strong>{accountTypeLabel}</strong>
              </div>

              <div className={styles.metricTile}>
                <span>Profile progress</span>
                <strong>{completedFields}/{PROFILE_COMPLETION_TOTAL}</strong>
                <small>{completionPercentage}% complete</small>
                <div className={styles.progressTrack} aria-hidden="true">
                  <span style={{ width: `${completionPercentage}%` }} />
                </div>
              </div>

              <div className={styles.metricTile}>
                <span>{isOwnerAccount ? 'QR PIN status' : 'Directory status'}</span>
                <strong>{isOwnerAccount ? scanPinDisplayLabel : directoryStatusLabel}</strong>
              </div>

              <div className={styles.metricTile}>
                <span>Last updated</span>
                <strong>{updatedLabel}</strong>
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.quickActionsCard}`}>
            <div className={styles.compactCardHeader}>
              <h2>Quick actions</h2>
              <p>Frequently used actions</p>
            </div>

            <div className={styles.quickActionList}>
              <button type="button" className={styles.quickActionButton} onClick={openBusinessEditor}>
                <span className={styles.quickActionIcon}>✎</span>
                <strong>Edit business details</strong>
                <span className={styles.quickActionChevron}>›</span>
              </button>

              {isOwnerAccount ? (
                <button type="button" className={styles.quickActionButton} onClick={openAssetRegistersPage}>
                  <span className={styles.quickActionIcon}>▤</span>
                  <strong>Manage asset registers</strong>
                  <span className={styles.quickActionChevron}>›</span>
                </button>
              ) : null}

              {showScanPinControls ? (
                <button type="button" className={styles.quickActionButton} onClick={openScanPinEditor}>
                  <span className={styles.quickActionIcon}>⌘</span>
                  <strong>Update QR PIN</strong>
                  <span className={styles.quickActionChevron}>›</span>
                </button>
              ) : null}

              {showMarketplaceContact ? (
                <button type="button" className={styles.quickActionButton} onClick={openMarketplaceEditor}>
                  <span className={styles.quickActionIcon}>▣</span>
                  <strong>Marketplace contact</strong>
                  <span className={styles.quickActionChevron}>›</span>
                </button>
              ) : null}

              {showPartnerDirectory ? (
                <button type="button" className={styles.quickActionButton} onClick={openPartnerDirectory}>
                  <span className={styles.quickActionIcon}>◎</span>
                  <strong>Partner directory</strong>
                  <span className={styles.quickActionChevron}>›</span>
                </button>
              ) : null}

              <button type="button" className={`${styles.quickActionButton} ${styles.quickActionDanger}`} onClick={() => setIsDeleteDialogOpen(true)}>
                <span className={styles.quickActionIcon}>!</span>
                <strong>Delete account</strong>
                <span className={styles.quickActionChevron}>›</span>
              </button>
            </div>
          </section>
        </section>

        <section ref={businessDetailsSectionRef} className={`${styles.card} ${styles.detailCard}`}>
          <div className={styles.cardTitleRow}>
            <div>
              <h2>Business details</h2>
            </div>
            <button type="button" className={styles.sectionActionButton} onClick={() => setIsBusinessEditorOpen((current) => !current)}>
              {isBusinessEditorOpen ? 'Close' : 'Edit'}
            </button>
          </div>

          {isLoading ? (
            <p className={styles.loading}>Loading account details...</p>
          ) : isBusinessEditorOpen ? (
            <form className={`${styles.form} ${styles.compactEditForm}`} onSubmit={handleProfileSubmit}>
              <label className={`${styles.field} ${styles.halfField}`}>
                <span>Full name</span>
                <input
                  value={profileDraft.displayName}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="Full name"
                />
              </label>

              <label className={`${styles.field} ${styles.halfField}`}>
                <span>Email</span>
                <input value={profile?.email ?? ''} disabled />
              </label>

              <label className={`${styles.field} ${styles.halfField}`}>
                <span>Business name</span>
                <input
                  value={profileDraft.businessName}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, businessName: event.target.value }))}
                  placeholder="Business name"
                />
              </label>

              <label className={`${styles.field} ${styles.halfField}`}>
                <span>Contact details</span>
                <input
                  type="text"
                  value={profileDraft.phone}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Phone, WhatsApp or office contact details"
                />
              </label>

              {isPartnerAccount ? (
                <label className={`${styles.field} ${styles.halfField}`}>
                  <span>Website link</span>
                  <input
                    inputMode="url"
                    value={profileDraft.websiteUrl}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, websiteUrl: event.target.value }))}
                    placeholder="https://your-business.co.za"
                  />
                </label>
              ) : null}

              {isPartnerAccount ? (
                <div className={`${styles.mediaUploadField} ${styles.fullWidth}`}>
                  <div className={styles.mediaUploadHeader}>
                    <div>
                      <span>Business media</span>
                      <strong>Logo and extra photos</strong>
                      <p>Upload a logo plus up to {MAX_BUSINESS_EXTRA_PHOTOS} extra photos for your business profile.</p>
                    </div>
                  </div>

                  <div className={styles.businessMediaEditorGrid}>
                    <section className={styles.businessLogoPanel}>
                      <div className={styles.businessLogoPreview}>
                        {logoUrl ? <img src={logoUrl} alt="Business logo preview" /> : <span>{profileInitials}</span>}
                      </div>

                      <div className={styles.businessMediaControls}>
                        <label className={styles.uploadButton}>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleLogoFileChange}
                            disabled={isReadingLogo || isSavingProfile || isReadingBusinessPhotos}
                          />
                          {logoUrl ? 'Replace logo' : 'Upload logo'}
                        </label>

                        {logoUrl ? (
                          <button
                            type="button"
                            className={styles.ghostButton}
                            onClick={handleRemoveLogo}
                            disabled={isSavingProfile || isReadingLogo || isReadingBusinessPhotos}
                          >
                            Remove logo
                          </button>
                        ) : null}
                      </div>

                      <small>JPG, PNG or WEBP. Maximum {formatUploadSize(MAX_LOGO_UPLOAD_BYTES)}.</small>
                    </section>

                    <section className={styles.businessPhotosPanel}>
                      <div className={styles.businessPhotosToolbar}>
                        <div>
                          <strong>Extra photos</strong>
                          <small>{extraPhotoUrls.length}/{MAX_BUSINESS_EXTRA_PHOTOS} uploaded</small>
                        </div>

                        <label className={styles.uploadButton}>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={handleBusinessPhotoFileChange}
                            disabled={
                              isReadingBusinessPhotos ||
                              isSavingProfile ||
                              isReadingLogo ||
                              extraPhotoUrls.length >= MAX_BUSINESS_EXTRA_PHOTOS
                            }
                          />
                          {isReadingBusinessPhotos ? 'Uploading...' : 'Upload photos'}
                        </label>
                      </div>

                      {extraPhotoUrls.length ? (
                        <div className={styles.businessPhotoGrid}>
                          {extraPhotoUrls.map((photoUrl, index) => (
                            <figure key={`${photoUrl}-${index}`} className={styles.businessPhotoThumb}>
                              <img src={photoUrl} alt={`Business extra photo ${index + 1}`} />
                              <button
                                type="button"
                                onClick={() => handleRemoveBusinessPhoto(index)}
                                aria-label={`Remove business photo ${index + 1}`}
                                disabled={isSavingProfile || isReadingBusinessPhotos}
                              >
                                ×
                              </button>
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.businessPhotoEmpty}>No extra photos uploaded yet.</div>
                      )}

                      <small>JPG, PNG or WEBP. Maximum {formatUploadSize(MAX_BUSINESS_PHOTO_UPLOAD_BYTES)} each.</small>
                    </section>
                  </div>
                </div>
              ) : null}

              <label className={`${styles.field} ${styles.thirdField}`}>
                <span>Account type</span>
                <div className={styles.readOnlyValue}>{accountTypeLabel}</div>
                <small className={styles.fieldHint}>Account type is locked after signup.</small>
              </label>

              <label className={`${styles.field} ${styles.thirdField}`}>
                <span>Province</span>
                <input
                  value={profileDraft.province}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, province: event.target.value }))}
                  placeholder="Province"
                />
              </label>

              <label className={`${styles.field} ${styles.thirdField}`}>
                <span>Town / city</span>
                <input
                  value={profileDraft.townCity}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, townCity: event.target.value }))}
                  placeholder="Town or city"
                />
              </label>

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Address line 1</span>
                <input
                  value={profileDraft.addressLine1}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, addressLine1: event.target.value }))}
                  placeholder="Address line 1"
                />
              </label>

              <div className={styles.actionsRow}>
                <button type="button" className={styles.ghostButton} onClick={() => setIsBusinessEditorOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo || isReadingBusinessPhotos}>
                  {isSavingProfile ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div className={`${styles.detailGrid} ${!showScanPinControls ? styles.detailGridSingle : ''}`}>
              <div className={styles.detailList}>
                <div className={styles.detailRow}>
                  <span>Business name</span>
                  <strong>{businessNameLabel}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Contact details</span>
                  <strong>{businessContactDetailsLabel}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Email</span>
                  <strong>{businessEmailLabel}</strong>
                </div>
                {isPartnerAccount ? (
                  <div className={styles.detailRow}>
                    <span>Website</span>
                    <strong>
                      {websiteUrl ? (
                        <a className={styles.websiteLink} href={websiteUrl} target="_blank" rel="noopener noreferrer">
                          {websiteDisplayLabel}
                        </a>
                      ) : (
                        websiteDisplayLabel
                      )}
                    </strong>
                  </div>
                ) : null}
                <div className={styles.detailRow}>
                  <span>Location</span>
                  <strong>{businessLocationLabel}</strong>
                </div>

                {isPartnerAccount ? (
                  <div className={styles.businessMediaSummary}>
                    <div className={styles.businessMediaSummaryHeader}>
                      <span>Extra photos</span>
                      <strong>{extraPhotoUrls.length ? `${extraPhotoUrls.length} uploaded` : 'No extra photos uploaded yet'}</strong>
                    </div>

                    {extraPhotoUrls.length ? (
                      <div className={styles.businessPhotoStrip}>
                        {extraPhotoUrls.slice(0, MAX_BUSINESS_EXTRA_PHOTOS).map((photoUrl, index) => (
                          <img key={`${photoUrl}-${index}`} src={photoUrl} alt={`Business photo ${index + 1}`} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {showScanPinControls ? (
                <aside ref={scanPinSectionRef} className={styles.pinSummaryCard}>
                  <h3>QR Code PIN</h3>
                  <p>Create your PIN to receive QR updates</p>
                  <strong>{scanPinDisplayLabel}</strong>
                  <small>4 to 8 digits</small>
                  <button type="button" className={styles.primaryButton} onClick={() => setIsScanPinEditorOpen((current) => !current)}>
                    {isScanPinEditorOpen ? 'Close PIN' : 'Manage PIN'}
                  </button>

                  {isScanPinEditorOpen ? (
                    <form className={styles.pinForm} onSubmit={handleScanPinSubmit}>
                      <div className={styles.pinGrid}>
                        <label className={styles.field}>
                          <span>New scan PIN</span>
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="new-password"
                            value={scanPinDraft}
                            onChange={(event) => setScanPinDraft(normalizePinInput(event.target.value))}
                            placeholder="4 to 8 digits"
                          />
                        </label>

                        <label className={styles.field}>
                          <span>Confirm scan PIN</span>
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="new-password"
                            value={scanPinConfirmDraft}
                            onChange={(event) => setScanPinConfirmDraft(normalizePinInput(event.target.value))}
                            placeholder="Repeat PIN"
                          />
                        </label>
                      </div>

                      <div className={styles.inlineActions}>
                        <button type="submit" className={styles.primaryButton} disabled={isSavingScanPin}>
                          {isSavingScanPin ? 'Saving...' : scanPinStatus.hasPin ? 'Update PIN' : 'Save PIN'}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={handleDisableScanPin}
                          disabled={isDisablingScanPin || !scanPinStatus.hasPin}
                        >
                          {isDisablingScanPin ? 'Disabling...' : 'Disable PIN'}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </aside>
              ) : null}
            </div>
          )}
        </section>

        {showPartnerDirectory ? (
          <section ref={partnerDirectorySectionRef} className={`${styles.card} ${styles.partnerDirectoryCard}`}>
            <div className={`${styles.cardTitleRow} ${styles.partnerDirectoryHeader}`}>
              <div>
                <h2>Partner directory</h2>
                <p>Owners use this information when selecting a partner for quote leads.</p>
              </div>
              <span className={`${styles.directoryStatusPill} ${profileDraft.partnerDirectoryEnabled ? styles.directoryStatusOn : styles.directoryStatusOff}`}>
                {directoryStatusLabel}
              </span>
            </div>

            <form className={`${styles.form} ${styles.directoryForm}`} onSubmit={handleProfileSubmit}>
              <label className={`${styles.toggleField} ${styles.partnerVisibilityToggle} ${styles.fullWidth}`}>
                <input
                  type="checkbox"
                  checked={profileDraft.partnerDirectoryEnabled}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      partnerDirectoryEnabled: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Show in Aim4price partner directory</strong>
                  <small>Owners can select this account when sending a quote lead.</small>
                </span>
              </label>

              <div className={`${styles.partnerMapField} ${styles.fullWidth}`}>
                <div className={styles.partnerMapHeader}>
                  <div>
                    <span>Partner map pin</span>
                    <strong>Set your public map pin</strong>
                    <p>Click anywhere on the map, drag the pin, or use your current location.</p>
                  </div>

                  <div className={styles.partnerMapActions}>
                    <button type="button" className={styles.secondaryButton} onClick={handleUseCurrentLocation}>
                      Use current location
                    </button>
                    {partnerDirectoryPin ? (
                      <button type="button" className={styles.ghostButton} onClick={clearPartnerMapPin}>
                        Clear pin
                      </button>
                    ) : null}
                  </div>
                </div>

                <div ref={partnerMapElementRef} className={styles.partnerMapCanvas} aria-label="Partner directory map pin" />

                <div className={styles.partnerMapFooter}>
                  <span>{partnerDirectoryPinLabel}</span>
                  <strong>{partnerDirectoryPin ? 'Ready to save' : 'Click the map to place your pin'}</strong>
                </div>
              </div>

              <label className={`${styles.field} ${styles.thirdField}`}>
                <span>Service radius km</span>
                <input
                  inputMode="numeric"
                  value={profileDraft.partnerServiceRadiusKm}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, partnerServiceRadiusKm: event.target.value }))}
                  placeholder="250"
                />
              </label>

              <label className={`${styles.field} ${styles.halfField}`}>
                <span>Brand focus</span>
                <input
                  value={profileDraft.partnerBrandFocus}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, partnerBrandFocus: event.target.value }))}
                  placeholder="John Deere, Case IH, New Holland"
                />
              </label>

              <label className={`${styles.field} ${styles.halfField}`}>
                <span>Services</span>
                <input
                  value={profileDraft.partnerServices}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, partnerServices: event.target.value }))}
                  placeholder="Finance, insurance, replacements, trade-ins"
                />
              </label>

              <label className={`${styles.field} ${styles.fullWidth} ${styles.partnerDescriptionField}`}>
                <span>Partner description</span>
                <textarea
                  value={profileDraft.partnerDescription}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, partnerDescription: event.target.value }))}
                  placeholder="Example: Finance partner for agricultural machinery, asset-backed finance and refinancing discussions."
                />
              </label>

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo || isReadingBusinessPhotos}>
                  {isSavingProfile ? 'Saving...' : 'Save directory'}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {showMarketplaceContact ? (
          <section ref={marketplaceSectionRef} className={`${styles.card} ${styles.marketplaceContactCard}`}>
            <div className={styles.cardTitleRow}>
              <div>
                <h2>Marketplace contact</h2>
              </div>
              <button type="button" className={styles.sectionActionButton} onClick={() => setIsMarketplaceEditorOpen((current) => !current)}>
                {isMarketplaceEditorOpen ? 'Close' : 'Edit'}
              </button>
            </div>

            {isLoading ? (
              <p className={styles.loading}>Loading marketplace contact...</p>
            ) : isMarketplaceEditorOpen ? (
              <form className={`${styles.marketplaceFields} ${styles.compactEditForm}`} onSubmit={handleProfileSubmit}>
                <label className={styles.field}>
                  <span>Seller name</span>
                  <input
                    value={profileDraft.marketplaceSellerName}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, marketplaceSellerName: event.target.value }))}
                    placeholder={marketplaceSellerName}
                  />
                </label>

                <label className={styles.field}>
                  <span>Contact details</span>
                  <input
                    type="text"
                    value={profileDraft.marketplacePhone}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, marketplacePhone: event.target.value }))}
                    placeholder={marketplacePhone}
                  />
                </label>

                <label className={styles.field}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={profileDraft.marketplaceEmail}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, marketplaceEmail: event.target.value }))}
                    placeholder={marketplaceEmail}
                  />
                </label>

                <label className={styles.field}>
                  <span>Location</span>
                  <input
                    value={profileDraft.marketplaceLocation}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, marketplaceLocation: event.target.value }))}
                    placeholder={marketplaceLocation}
                  />
                </label>

                <div className={styles.marketplaceActions}>
                  <button type="button" className={styles.ghostButton} onClick={() => setIsMarketplaceEditorOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo || isReadingBusinessPhotos}>
                    {isSavingProfile ? 'Saving...' : 'Save marketplace'}
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.marketplaceGrid}>
                <div className={styles.detailList}>
                  <div className={styles.detailRow}>
                    <span>Contact name</span>
                    <strong>{marketplaceSellerName}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Contact details</span>
                    <strong>{marketplacePhone}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Email</span>
                    <strong>{marketplaceEmail}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Location</span>
                    <strong>{marketplaceLocation}</strong>
                  </div>
                </div>

                <aside className={styles.profileStatusCard}>
                  <h3>Your marketplace profile</h3>
                  <p>You are visible in the Aim4price marketplace</p>
                  <ul>
                    <li>Visible to customers</li>
                    <li>Receiving quote leads</li>
                    <li>{marketplaceProfileComplete ? 'Profile is up to date' : 'Profile needs contact details'}</li>
                  </ul>
                  <button type="button" className={styles.ghostButton} onClick={openMarketplaceEditor}>
                    View marketplace
                  </button>
                </aside>
              </div>
            )}
          </section>
        ) : null}

        <section className={`${styles.card} ${styles.accountDeleteCard}`}>
          <div>
            <h2>Delete account</h2>
            <p>This action cannot be undone. All your data will be permanently removed.</p>
          </div>
          <button type="button" className={styles.dangerButton} onClick={() => setIsDeleteDialogOpen(true)}>
            Delete account
          </button>
        </section>
      </section>

      {isDeleteDialogOpen ? (
        <div className={styles.modalBackdrop} onClick={closeDeleteDialog}>
          <section className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Confirm permanent removal</h2>
              <p>
                This removes your full Aim4price workspace, including saved valuations, asset register
                items and account details.
              </p>
            </div>

            <form className={styles.modalForm} onSubmit={handleDeleteAccount}>
              <div className={styles.confirmBox}>
                <strong>This action cannot be undone.</strong>
                <p>Enter your password and type DELETE below to confirm.</p>
              </div>

              <label className={styles.modalField}>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Enter your password"
                />
              </label>

              <label className={styles.modalField}>
                <span>Type DELETE to confirm</span>
                <input
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  placeholder="DELETE"
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.ghostButton} onClick={closeDeleteDialog}>
                  Cancel
                </button>
                <button type="submit" className={styles.dangerButton} disabled={isDeletingAccount}>
                  {isDeletingAccount ? 'Deleting account...' : 'Delete account'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}