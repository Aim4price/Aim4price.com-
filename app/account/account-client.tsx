'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import { useGlobalLoading } from '../../lib/use-global-loading';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';

type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
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

function buildProfileDraft(profile: AccountProfile | null): ProfileDraft {
  if (!profile) {
    return initialProfileDraft;
  }

  const displayName = profile.displayName || profile.name;
  const fallbackLocation = buildProfileLocation(profile);

  return {
    displayName,
    logoUrl: profile.logoUrl,
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
      result ? resolve(result) : reject(new Error('Failed to read logo file.'));
    };

    reader.onerror = () => reject(new Error('Failed to read logo file.'));
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
  useGlobalLoading(isLoading || isLoadingScanPin, 'account-page-data');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingScanPin, setIsSavingScanPin] = useState(false);
  const [isDisablingScanPin, setIsDisablingScanPin] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isReadingLogo, setIsReadingLogo] = useState(false);
  const partnerMapElementRef = useRef<HTMLDivElement | null>(null);
  const partnerLeafletMapRef = useRef<any>(null);
  const partnerPinMarkerRef = useRef<any>(null);
  const partnerRadiusCircleRef = useRef<any>(null);

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
  const marketplaceSellerName =
    profileDraft.marketplaceSellerName.trim() || profileDraft.businessName.trim() || accountDisplayName;
  const marketplacePhone = profileDraft.marketplacePhone.trim() || profileDraft.phone.trim() || 'No phone saved yet';
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
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to read logo file.' });
    } finally {
      setIsReadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    const nextDraft = { ...profileDraft, logoUrl: '' };
    setProfileDraft(nextDraft);
    await saveProfileDraft(nextDraft, 'Logo removed.');
  }

  async function saveProfileDraft(nextDraft: ProfileDraft, successMessage = 'Account details saved.') {
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
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save account details.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveProfileDraft(profileDraft);
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
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroLogoUploader}>
              <div
                className={`${styles.heroLogoPreview} ${!logoUrl ? styles.logoEmpty : ''}`}
                aria-label="Business logo preview"
                tabIndex={0}
              >
                {logoUrl ? <img src={logoUrl} alt="Business logo" /> : <span>{profileInitials}</span>}

                <div className={styles.heroLogoOverlay}>
                  <label className={`${styles.heroLogoOverlayButton} ${styles.uploadButton}`}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleLogoFileChange}
                      disabled={isReadingLogo || isSavingProfile}
                    />
                    {isReadingLogo ? 'Reading...' : logoUrl ? 'Change logo' : 'Upload logo'}
                  </label>

                  {logoUrl ? (
                    <button
                      type="button"
                      className={styles.heroLogoOverlayButton}
                      onClick={handleRemoveLogo}
                      disabled={isSavingProfile}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroAside}>
            <div className={styles.heroProfileCard}>
              <div className={styles.profileSummary}>
                <span>Profile</span>
                <strong>{accountDisplayName}</strong>
                <small>{profile?.email || 'Loading email'}</small>
              </div>
            </div>

            <div className={styles.heroStat}>
              <span>Profile</span>
              <strong>{completedFields}/{PROFILE_COMPLETION_TOTAL}</strong>
              <div className={styles.progressTrack} aria-hidden="true">
                <span style={{ width: `${completionPercentage}%` }} />
              </div>
              <small>{completionLabel}</small>
            </div>

            <div className={`${styles.heroStatGrid} ${!isOwnerAccount ? styles.heroStatGridSingle : ''}`}>
              <div className={styles.heroStat}>
                <span>Account type</span>
                <strong>{accountTypeLabel}</strong>
              </div>
              {isOwnerAccount ? (
                <div className={styles.heroStat}>
                  <span>QR PIN</span>
                  <strong>{scanPinStatusLabel}</strong>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={`${styles.layout} ${!showScanPinControls ? styles.layoutNoSidebar : ''}`}>
          <div className={styles.mainColumn}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Business details</h2>
                </div>
              </div>

              {isLoading ? (
                <p className={styles.loading}>Loading account details...</p>
              ) : (
                <form className={styles.form} onSubmit={handleProfileSubmit}>
                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Full name</span>
                    <input
                      value={profileDraft.displayName}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, displayName: event.target.value }))
                      }
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
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, businessName: event.target.value }))
                      }
                      placeholder="Business name"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Phone</span>
                    <input
                      type="tel"
                      value={profileDraft.phone}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Phone number"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.thirdField}`}>
                    <span>Account type</span>
                    <div className={styles.readOnlyValue}>{accountTypeLabel}</div>
                    <small className={styles.fieldHint}>
                      Account type is locked after signup.
                    </small>
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
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, addressLine1: event.target.value }))
                      }
                      placeholder="Address line 1"
                    />
                  </label>
                  <div className={styles.actionsRow}>
                    <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo}>
                      {isSavingProfile ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {showPartnerDirectory ? (
              <section className={`${styles.card} ${styles.partnerDirectoryCard}`}>
                <div className={`${styles.cardHeader} ${styles.partnerDirectoryHeader}`}>
                  <div>
                    <span className={styles.sectionEyebrow}>Partner directory</span>
                    <h2>Partner directory</h2>
                    <p>Owners use this information when selecting a partner for shared registers and quote leads.</p>
                  </div>
                  <span
                    className={`${styles.directoryStatusPill} ${
                      profileDraft.partnerDirectoryEnabled ? styles.directoryStatusOn : styles.directoryStatusOff
                    }`}
                  >
                    {profileDraft.partnerDirectoryEnabled ? 'Visible' : 'Hidden'}
                  </span>
                </div>

                <form className={styles.form} onSubmit={handleProfileSubmit}>
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
                      <small>Owners can select this account when sharing a register or lead.</small>
                    </span>
                  </label>

                  <label className={`${styles.field} ${styles.fullWidth}`}>
                    <span>Partner description</span>
                    <textarea
                      value={profileDraft.partnerDescription}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, partnerDescription: event.target.value }))
                      }
                      placeholder="Example: Finance partner for agricultural machinery, asset-backed finance and refinancing discussions."
                    />
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
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, partnerServiceRadiusKm: event.target.value }))
                      }
                      placeholder="250"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Brand focus</span>
                    <input
                      value={profileDraft.partnerBrandFocus}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, partnerBrandFocus: event.target.value }))
                      }
                      placeholder="John Deere, Case IH, New Holland"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Services</span>
                    <input
                      value={profileDraft.partnerServices}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, partnerServices: event.target.value }))
                      }
                      placeholder="Finance, insurance, replacements, trade-ins"
                    />
                  </label>

                  <div className={styles.actionsRow}>
                    <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo}>
                      {isSavingProfile ? 'Saving...' : 'Save directory'}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {showMarketplaceContact ? (
              <section className={`${styles.card} ${styles.marketplaceCard}`}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Marketplace contact</h2>
                </div>
              </div>

              {isLoading ? (
                <p className={styles.loading}>Loading marketplace contact...</p>
              ) : (
                <form className={styles.marketplaceFields} onSubmit={handleProfileSubmit}>
                  <label className={styles.field}>
                    <span>Seller name</span>
                    <input
                      value={profileDraft.marketplaceSellerName}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, marketplaceSellerName: event.target.value }))
                      }
                      placeholder={marketplaceSellerName}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Phone</span>
                    <input
                      type="tel"
                      value={profileDraft.marketplacePhone}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, marketplacePhone: event.target.value }))
                      }
                      placeholder={marketplacePhone}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Email</span>
                    <input
                      type="email"
                      value={profileDraft.marketplaceEmail}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, marketplaceEmail: event.target.value }))
                      }
                      placeholder={marketplaceEmail}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Location</span>
                    <input
                      value={profileDraft.marketplaceLocation}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, marketplaceLocation: event.target.value }))
                      }
                      placeholder={marketplaceLocation}
                    />
                  </label>

                  <div className={styles.marketplaceActions}>
                    <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo}>
                      {isSavingProfile ? 'Saving...' : 'Save marketplace'}
                    </button>
                  </div>
                </form>
              )}
              </section>
            ) : null}
          </div>

          {showScanPinControls ? (
          <aside className={styles.sidebar}>
            <section className={styles.sidebarCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>QR scan PIN</h2>
                </div>
              </div>

              {isLoadingScanPin ? (
                <p className={styles.loading}>Loading scan PIN...</p>
              ) : (
                <>
                  <div className={styles.summaryStack}>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Status</span>
                      <strong className={styles.summaryValue}>{scanPinStatusLabel}</strong>
                    </div>

                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Last changed</span>
                      <span className={styles.summaryValue}>{formatDate(scanPinStatus.updatedAtIso)}</span>
                    </div>
                  </div>

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
                </>
              )}
            </section>
          </aside>
          ) : null}
        </div>

        <section className={`${styles.card} ${styles.dangerCard} ${styles.accountDeleteCard}`}>
          <div>
            <h2>Delete account</h2>
            <p className={styles.deletePrompt}>Want to delete your account?</p>
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
