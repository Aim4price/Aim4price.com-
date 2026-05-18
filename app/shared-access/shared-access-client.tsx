'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type PartnerType = 'dealer' | 'finance' | 'insurance';
type GrantStatus = 'pending' | 'active' | 'revoked' | 'declined';
type NoticeTone = 'success' | 'error';
type IconProps = { className?: string };

type PartnerDirectoryEntry = {
  userId: string;
  partnerType: PartnerType;
  displayName: string;
  businessName: string;
  phone: string;
  province: string;
  townCity: string;
  addressLine1: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
  brandFocus: string;
  services: string;
};

type SharedAccessGrant = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  partnerType: PartnerType;
  status: GrantStatus;
  permissionLevel: string;
  includeDocuments: boolean;
  includeScanHistory: boolean;
  ownerMessage: string;
  partnerName: string;
  partnerBusinessName: string;
  partnerPhone: string;
  partnerProvince: string;
  partnerTownCity: string;
  createdAtIso: string;
  acceptedAtIso: string | null;
  revokedAtIso: string | null;
  declinedAtIso: string | null;
  lastViewedAtIso: string | null;
};

type GrantsResponse = {
  ok: boolean;
  grants?: SharedAccessGrant[];
  grant?: SharedAccessGrant;
  error?: string;
};

type PartnersResponse = {
  ok: boolean;
  partners?: PartnerDirectoryEntry[];
  error?: string;
};

type ShareOption = {
  value: PartnerType;
  title: string;
  actionTitle: string;
  description: string;
  mapTitle: string;
  emptyText: string;
};

declare global {
  interface Window {
    L?: any;
  }
}

let leafletLoaderPromise: Promise<any> | null = null;

const LEAFLET_SCRIPT_ID = 'aim4price-leaflet-script';
const LEAFLET_CSS_ID = 'aim4price-leaflet-css';
const DEFAULT_CENTER: [number, number] = [-29.0, 24.0];
const DEFAULT_ZOOM = 5;

const SHARE_OPTIONS: ShareOption[] = [
  {
    value: 'dealer',
    title: 'Dealer',
    actionTitle: 'Share with dealer',
    description: 'Give a machinery dealer live register access for replacements, trade-ins and fleet support.',
    mapTitle: 'Choose a dealer partner.',
    emptyText: 'No listed dealer partners found yet. Dealer accounts must enable their directory listing under Account details.',
  },
  {
    value: 'finance',
    title: 'Finance',
    actionTitle: 'Share with finance partner',
    description: 'Give a bank or finance partner live register access for asset-backed finance and refinancing reviews.',
    mapTitle: 'Choose a finance partner.',
    emptyText: 'No listed finance partners found yet. Finance partners must enable their directory listing under Account details.',
  },
  {
    value: 'insurance',
    title: 'Insurance',
    actionTitle: 'Share with insurance partner',
    description: 'Give an insurer or broker live register access for insured-value checks and annual policy updates.',
    mapTitle: 'Choose an insurance partner.',
    emptyText: 'No listed insurance partners found yet. Insurance partners must enable their directory listing under Account details.',
  },
];

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only load in the browser.'));
  }

  if (window.L) {
    return Promise.resolve(window.L);
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
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (window.L) {
        resolve(window.L);
        return;
      }

      reject(new Error('Leaflet did not initialise correctly.'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load the map renderer.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.crossOrigin = '';
    script.addEventListener('load', handleLoaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load the map renderer.')), { once: true });
    document.body.appendChild(script);
  });

  return leafletLoaderPromise;
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="m20 20-4.2-4.2M18 10.8a7.2 7.2 0 1 1-14.4 0 7.2 7.2 0 0 1 14.4 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DealerIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4 18h16M6 18V8l6-3 6 3v10M9 18v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FinanceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M6.5 10.5h11M8 14h8M12 3l8 4.2v2.3H4V7.2L12 3ZM6 20h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsuranceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 3 5 6v5.2c0 4.6 2.9 8 7 9.8 4.1-1.8 7-5.2 7-9.8V6l-7-3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9.3 12.1 1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function renderShareOptionIcon(value: PartnerType, className: string) {
  if (value === 'finance') return <FinanceIcon className={className} />;
  if (value === 'insurance') return <InsuranceIcon className={className} />;
  return <DealerIcon className={className} />;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function formatPartnerType(value: PartnerType): string {
  if (value === 'dealer') return 'Dealer';
  if (value === 'finance') return 'Finance';
  return 'Insurance';
}

function formatStatus(value: GrantStatus): string {
  if (value === 'active') return 'Active';
  if (value === 'pending') return 'Pending';
  if (value === 'revoked') return 'Revoked';
  return 'Declined';
}

function statusClass(value: GrantStatus): string {
  if (value === 'active') return styles.statusActive;
  if (value === 'pending') return styles.statusPending;
  if (value === 'revoked') return styles.statusRevoked;
  return styles.statusDeclined;
}

function partnerName(partner: PartnerDirectoryEntry): string {
  return partner.businessName || partner.displayName || 'Aim4price partner';
}

function partnerLocation(partner: PartnerDirectoryEntry): string {
  return [partner.townCity, partner.province].filter(Boolean).join(', ') || 'Location not saved';
}

function grantPartnerName(grant: SharedAccessGrant): string {
  return grant.partnerBusinessName || grant.partnerName || 'Aim4price partner';
}

function grantPartnerLocation(grant: SharedAccessGrant): string {
  return [grant.partnerTownCity, grant.partnerProvince].filter(Boolean).join(', ') || 'Location not saved';
}

function hasCoordinates(partner: PartnerDirectoryEntry): boolean {
  return (
    partner.latitude !== null &&
    partner.longitude !== null &&
    Number.isFinite(partner.latitude) &&
    Number.isFinite(partner.longitude) &&
    Math.abs(partner.latitude) <= 90 &&
    Math.abs(partner.longitude) <= 180
  );
}

function escapePopupText(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return replacements[character] ?? character;
  });
}

function buildPartnerPopupHtml(partner: PartnerDirectoryEntry, markerNumber: number): string {
  const name = escapePopupText(partnerName(partner));
  const location = escapePopupText(partnerLocation(partner));
  const type = escapePopupText(formatPartnerType(partner.partnerType));
  const radius = partner.serviceRadiusKm ? escapePopupText(`${partner.serviceRadiusKm} km radius`) : '';
  const radiusLine = radius ? `<br /><small>${radius}</small>` : '';

  return `<strong>${markerNumber}. ${name}</strong><br /><span>${type}</span><br /><small>${location}</small>${radiusLine}`;
}

function extractError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
  }

  return fallback;
}

export default function SharedAccessClient() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const partnerMarkersByIdRef = useRef<Map<string, any>>(new Map());

  const [grants, setGrants] = useState<SharedAccessGrant[]>([]);
  const [partners, setPartners] = useState<PartnerDirectoryEntry[]>([]);
  const [selectedPartnerType, setSelectedPartnerType] = useState<PartnerType>('dealer');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [grantSearch, setGrantSearch] = useState('');
  const [search, setSearch] = useState('');
  const [pin, setPin] = useState('');
  const [ownerMessage, setOwnerMessage] = useState('');
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeScanHistory, setIncludeScanHistory] = useState(true);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isShareConfirmOpen, setIsShareConfirmOpen] = useState(false);
  const [isLoadingGrants, setIsLoadingGrants] = useState(true);
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const selectedShareOption = useMemo(
    () => SHARE_OPTIONS.find((option) => option.value === selectedPartnerType) ?? SHARE_OPTIONS[0],
    [selectedPartnerType],
  );

  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.userId === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );

  const partnersWithCoordinates = useMemo(() => partners.filter(hasCoordinates), [partners]);

  const grantStats = useMemo(() => {
    const active = grants.filter((grant) => grant.status === 'active').length;
    const pending = grants.filter((grant) => grant.status === 'pending').length;
    return { total: grants.length, active, pending };
  }, [grants]);

  const visibleGrants = useMemo(() => {
    const query = grantSearch.trim().toLowerCase();
    if (!query) return grants;

    return grants.filter((grant) => {
      const haystack = [
        grantPartnerName(grant),
        grant.partnerName,
        grant.partnerBusinessName,
        grant.partnerTownCity,
        grant.partnerProvince,
        formatPartnerType(grant.partnerType),
        formatStatus(grant.status),
        grant.ownerMessage,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [grants, grantSearch]);

  const loadGrants = useCallback(async () => {
    setIsLoadingGrants(true);

    try {
      const response = await fetch('/api/shared-access', { cache: 'no-store', credentials: 'include' });
      const data = (await response.json()) as GrantsResponse;

      if (!response.ok || !data.ok || !data.grants) {
        throw new Error(data.error ?? 'Failed to load shared access.');
      }

      setGrants(data.grants);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load shared access.' });
    } finally {
      setIsLoadingGrants(false);
    }
  }, []);

  const loadPartners = useCallback(async () => {
    setIsLoadingPartners(true);

    try {
      const params = new URLSearchParams({ type: selectedPartnerType });
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`/api/partners?${params.toString()}`, { cache: 'no-store', credentials: 'include' });
      const data = (await response.json()) as PartnersResponse;

      if (!response.ok || !data.ok || !data.partners) {
        throw new Error(data.error ?? 'Failed to load partners.');
      }

      const nextPartners = data.partners;
      setPartners(nextPartners);
      setSelectedPartnerId((current) => (nextPartners.some((partner) => partner.userId === current) ? current : ''));
    } catch (error) {
      setPartners([]);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load partners.' });
    } finally {
      setIsLoadingPartners(false);
    }
  }, [search, selectedPartnerType]);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);

  useEffect(() => {
    if (!isMapModalOpen) return;
    void loadPartners();
  }, [isMapModalOpen, loadPartners]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isMapModalOpen || !mapElementRef.current) return undefined;

    let cancelled = false;

    async function setupMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElementRef.current) return;

        if (!leafletMapRef.current) {
          leafletMapRef.current = L.map(mapElementRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(leafletMapRef.current);
        }

        if (markerLayerRef.current) {
          markerLayerRef.current.clearLayers();
        } else {
          markerLayerRef.current = L.layerGroup().addTo(leafletMapRef.current);
        }

        partnerMarkersByIdRef.current.clear();
        const bounds = L.latLngBounds([]);

        partnersWithCoordinates.forEach((partner, index) => {
          const lat = Number(partner.latitude);
          const lng = Number(partner.longitude);
          const markerNumber = index + 1;
          const isActive = selectedPartnerId === partner.userId;
          const icon = L.divIcon({
            className: `shareMapMarker${isActive ? ' shareMapMarkerActive' : ''}`,
            html: `<span class="shareMapMarkerPin"><b>${markerNumber}</b></span>`,
            iconSize: [42, 48],
            iconAnchor: [21, 44],
            popupAnchor: [0, -38],
          });
          const marker = L.marker([lat, lng], { icon, title: partnerName(partner) }).addTo(markerLayerRef.current);
          marker.bindPopup(buildPartnerPopupHtml(partner, markerNumber));
          marker.on('click', () => {
            setSelectedPartnerId(partner.userId);
            setIsShareConfirmOpen(true);
          });
          partnerMarkersByIdRef.current.set(partner.userId, marker);
          bounds.extend([lat, lng]);
        });

        if (bounds.isValid()) {
          leafletMapRef.current.fitBounds(bounds.pad(0.18), { maxZoom: 12 });
        } else {
          leafletMapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        }

        const selectedMarker = selectedPartnerId ? partnerMarkersByIdRef.current.get(selectedPartnerId) : null;
        if (selectedMarker) {
          window.setTimeout(() => {
            if (!cancelled) {
              selectedMarker.openPopup();
              leafletMapRef.current?.panTo(selectedMarker.getLatLng(), { animate: true, duration: 0.35 });
            }
          }, 120);
        }

        window.setTimeout(() => leafletMapRef.current?.invalidateSize(), 80);
      } catch (error) {
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load map.' });
      }
    }

    void setupMap();

    return () => {
      cancelled = true;
    };
  }, [isMapModalOpen, partnersWithCoordinates, selectedPartnerId]);

  useEffect(() => {
    if (isMapModalOpen) return undefined;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      markerLayerRef.current = null;
      partnerMarkersByIdRef.current.clear();
    }

    return undefined;
  }, [isMapModalOpen]);

  function resetShareFields() {
    setSelectedPartnerId('');
    setSearch('');
    setPin('');
    setOwnerMessage('');
    setIncludeDocuments(true);
    setIncludeScanHistory(true);
    setIsShareConfirmOpen(false);
  }

  function openShareOptions() {
    if (isSharing) return;
    resetShareFields();
    setIsMapModalOpen(false);
    setIsOptionsModalOpen(true);
  }

  function closeShareOptions() {
    if (isSharing) return;
    setIsOptionsModalOpen(false);
  }

  function openPartnerMap(partnerType: PartnerType) {
    if (isSharing) return;
    resetShareFields();
    setPartners([]);
    setSelectedPartnerType(partnerType);
    setIsOptionsModalOpen(false);
    setIsMapModalOpen(true);
  }

  function closePartnerMap() {
    if (isSharing) return;
    setIsShareConfirmOpen(false);
    setIsMapModalOpen(false);
  }

  function goBackToShareOptions() {
    if (isSharing) return;
    setIsShareConfirmOpen(false);
    setIsMapModalOpen(false);
    setIsOptionsModalOpen(true);
  }

  function openShareConfirm(partner: PartnerDirectoryEntry) {
    setSelectedPartnerId(partner.userId);
    setIsShareConfirmOpen(true);
  }

  function closeShareConfirm() {
    if (isSharing) return;
    setIsShareConfirmOpen(false);
  }

  async function handleShare() {
    if (!selectedPartner) {
      setNotice({ tone: 'error', message: 'Choose a partner first.' });
      return;
    }

    if (!pin.trim()) {
      setNotice({ tone: 'error', message: 'Enter your Account PIN to confirm sharing.' });
      return;
    }

    setIsSharing(true);

    try {
      const response = await fetch('/api/shared-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerUserId: selectedPartner.userId,
          partnerType: selectedPartnerType,
          pin,
          ownerMessage,
          includeDocuments,
          includeScanHistory,
        }),
      });
      const payload = await response.json().catch(() => null);
      const data = payload as GrantsResponse | null;

      if (!response.ok || !data?.ok || !data.grant) {
        throw new Error(extractError(payload, 'Failed to share register.'));
      }

      setGrants((current) => {
        const withoutDuplicate = current.filter((grant) => grant.id !== data.grant?.id);
        return [data.grant as SharedAccessGrant, ...withoutDuplicate];
      });
      setNotice({ tone: 'success', message: `Access request sent to ${partnerName(selectedPartner)}.` });
      setIsShareConfirmOpen(false);
      setIsMapModalOpen(false);
      setIsOptionsModalOpen(false);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to share register.' });
    } finally {
      setIsSharing(false);
    }
  }

  async function handleRevoke(grantId: string) {
    try {
      const response = await fetch(`/api/shared-access/${grantId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await response.json()) as GrantsResponse;

      if (!response.ok || !data.ok || !data.grant) {
        throw new Error(data.error ?? 'Failed to revoke access.');
      }

      setGrants((current) => current.map((grant) => (grant.id === grantId ? data.grant as SharedAccessGrant : grant)));
      setNotice({ tone: 'success', message: 'Access revoked.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to revoke access.' });
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <div className={styles.registerPanel}>
          <header className={styles.registerHeader}>
            <div className={styles.registerTitleBlock}>
              <h1>Shared access</h1>
              <p>
                Give selected dealers, finance partners or insurance partners permission to view your live Asset Register.
                Access stays controlled by you and can be revoked at any time.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button type="button" className={styles.primaryButton} onClick={openShareOptions}>
                Share Asset Register
              </button>
            </div>
          </header>

          {notice ? (
            <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
              {notice.message}
            </div>
          ) : null}

          <div className={styles.summaryRow}>
            <div className={`${styles.summaryTile} ${styles.summaryTileMain}`}>
              <span>Total shared</span>
              <strong>{grantStats.total}</strong>
            </div>
            <div className={styles.summaryTile}>
              <span>Active</span>
              <strong>{grantStats.active}</strong>
            </div>
            <div className={styles.summaryTile}>
              <span>Pending</span>
              <strong>{grantStats.pending}</strong>
            </div>
          </div>

          <div className={styles.accessToolbar}>
            <label className={styles.searchBox}>
              <SearchIcon className={styles.searchIcon} />
              <input
                value={grantSearch}
                onChange={(event) => setGrantSearch(event.target.value)}
                placeholder="Search by partner, type, town, province or status"
                aria-label="Search shared access grants"
              />
            </label>
          </div>

          <section className={styles.accessCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Register access</h2>
                <p>These partners have been invited to view your Asset Register.</p>
              </div>
            </div>

            {isLoadingGrants ? (
              <p className={styles.emptyState}>Loading shared access...</p>
            ) : grants.length ? (
              visibleGrants.length ? (
                <div className={styles.grantList}>
                  {visibleGrants.map((grant) => (
                    <article key={grant.id} className={styles.grantCard}>
                      <div className={styles.grantMain}>
                        <div className={styles.grantTitleRow}>
                          <h3>{grantPartnerName(grant)}</h3>
                          <span className={`${styles.statusPill} ${statusClass(grant.status)}`}>{formatStatus(grant.status)}</span>
                        </div>

                        <div className={styles.grantMetaGrid}>
                          <div className={styles.grantMetaItem}>
                            <span>Partner type</span>
                            <strong>{formatPartnerType(grant.partnerType)}</strong>
                          </div>
                          <div className={styles.grantMetaItem}>
                            <span>Partner address</span>
                            <strong>{grantPartnerLocation(grant)}</strong>
                          </div>
                          <div className={styles.grantMetaItem}>
                            <span>Shared</span>
                            <strong>{formatDate(grant.createdAtIso)}</strong>
                          </div>
                          <div className={styles.grantMetaItem}>
                            <span>Last viewed</span>
                            <strong>{formatDate(grant.lastViewedAtIso)}</strong>
                          </div>
                        </div>

                        {grant.ownerMessage ? <p className={styles.grantMessage}>{grant.ownerMessage}</p> : null}
                      </div>

                      {grant.status === 'active' || grant.status === 'pending' ? (
                        <div className={styles.grantActions}>
                          <button type="button" className={styles.dangerButton} onClick={() => void handleRevoke(grant.id)}>
                            Revoke access
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>No shared access matches your search.</p>
              )
            ) : (
              <p className={styles.emptyState}>No shared access yet. Use “Share Asset Register” to invite a partner.</p>
            )}
          </section>
        </div>
      </section>

      {isOptionsModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeShareOptions} />

          <section className={styles.optionsModal} role="dialog" aria-modal="true" aria-labelledby="share-register-options-title">
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="share-register-options-title">Shared access</h3>
                <p>Choose which partner type should receive live access to your Asset Register.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeShareOptions} aria-label="Close shared access options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody}`}>
              <div className={styles.optionsContent}>
                <div className={styles.optionsGrid}>
                  {SHARE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.optionActionButton} ${styles.shareChoiceCard}`}
                      onClick={() => openPartnerMap(option.value)}
                    >
                      <span className={styles.optionIconTile}>{renderShareOptionIcon(option.value, styles.buttonIcon)}</span>
                      <span className={styles.shareChoiceText}>
                        <strong>{option.actionTitle}</strong>
                        <small>{option.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isMapModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closePartnerMap} />

          <section className={`${styles.optionsModal} ${styles.shareMapModal}`} role="dialog" aria-modal="true" aria-labelledby="share-partner-map-title">
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${styles.shareMapModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="share-partner-map-title">{selectedShareOption.mapTitle}</h3>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closePartnerMap} aria-label="Close partner map" disabled={isSharing}>
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.shareMapScrollBody}`}>
              <form
                className={styles.shareSearchBar}
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadPartners();
                }}
              >
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by business, town, province, service or brand"
                  aria-label="Search partner directory"
                />
                <button type="submit" className={styles.secondaryButton} disabled={isLoadingPartners}>
                  <SearchIcon className={styles.buttonIcon} />
                  <span>{isLoadingPartners ? 'Searching...' : 'Search'}</span>
                </button>
              </form>

              <div className={styles.shareMapStage}>
                <aside className={styles.shareSidebar} aria-label="Share register partner options">
                  <div className={styles.shareSidebarHeader}>
                    <button type="button" className={styles.shareBackButton} onClick={goBackToShareOptions} disabled={isSharing}>
                      <ChevronLeftIcon className={styles.buttonIcon} />
                      <span>Back</span>
                    </button>
                    <strong>Partners</strong>
                  </div>

                  <div className={styles.sharePartnerList}>
                    {isLoadingPartners ? (
                      <p className={styles.shareEmptyState}>Loading partners...</p>
                    ) : partners.length ? (
                      partners.map((partner, index) => (
                        <button
                          key={partner.userId}
                          type="button"
                          className={`${styles.sharePartnerCard} ${selectedPartnerId === partner.userId ? styles.sharePartnerCardActive : ''}`}
                          onClick={() => openShareConfirm(partner)}
                        >
                          <span className={styles.sharePartnerNumber}>{index + 1}</span>
                          <span className={styles.sharePartnerBody}>
                            <span className={styles.sharePartnerHeader}>
                              <strong>{partnerName(partner)}</strong>
                              <small>{formatPartnerType(partner.partnerType)}</small>
                            </span>
                            <span className={styles.sharePartnerMeta}>
                              <span>{partnerLocation(partner)}</span>
                              {partner.serviceRadiusKm ? <span>{partner.serviceRadiusKm} km radius</span> : null}
                            </span>
                            {partner.description ? <span className={styles.sharePartnerCopy}>{partner.description}</span> : null}
                            {partner.brandFocus ? <span className={styles.sharePartnerCopy}>Brands: {partner.brandFocus}</span> : null}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className={styles.shareEmptyState}>{selectedShareOption.emptyText}</p>
                    )}
                  </div>
                </aside>

                <div className={styles.shareMapShell}>
                  <div ref={mapElementRef} className={styles.shareMapCanvas} aria-label="Partner map" />
                  {!partnersWithCoordinates.length ? (
                    <div className={styles.shareMapFallback}>
                      <p>Partners with saved latitude and longitude will appear on this map.</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {isShareConfirmOpen && selectedPartner ? (
                <div className={styles.shareConfirmOverlay}>
                  <button
                    type="button"
                    className={styles.shareConfirmBackdrop}
                    onClick={closeShareConfirm}
                    aria-label="Close share confirmation"
                    disabled={isSharing}
                  />

                  <section className={styles.shareConfirmModal} aria-live="polite">
                    <div className={styles.shareConfirmHeader}>
                      <div>
                        <span>{partnerName(selectedPartner)}</span>
                        <h4>Confirm register access</h4>
                      </div>
                      <button type="button" className={styles.modalCloseButton} onClick={closeShareConfirm} aria-label="Close share confirmation" disabled={isSharing}>
                        <CloseIcon className={styles.buttonIcon} />
                      </button>
                    </div>

                    <div className={styles.shareConfirmBody}>
                      <div className={styles.disclaimer}>
                        <strong>Live Asset Register access</strong>
                        <p>
                          You are giving this partner view access to your Asset Register, including asset details, saved values, photos and selected history. This does not create a finance, insurance, valuation or sales agreement. You can revoke access at any time.
                        </p>
                      </div>

                      <label className={styles.checkboxField}>
                        <input
                          type="checkbox"
                          checked={includeDocuments}
                          onChange={(event) => setIncludeDocuments(event.target.checked)}
                        />
                        <span>Include asset documents where saved</span>
                      </label>

                      <label className={styles.checkboxField}>
                        <input
                          type="checkbox"
                          checked={includeScanHistory}
                          onChange={(event) => setIncludeScanHistory(event.target.checked)}
                        />
                        <span>Include QR scan and update history where available</span>
                      </label>

                      <label className={styles.field}>
                        <span>
                          Message to partner
                          <small>Optional</small>
                        </span>
                        <textarea
                          value={ownerMessage}
                          onChange={(event) => setOwnerMessage(event.target.value)}
                          placeholder="Example: Please review my live asset register for cover, finance or replacement support."
                        />
                      </label>

                      <label className={styles.field}>
                        <span>Account PIN</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          value={pin}
                          onChange={(event) => setPin(event.target.value.replace(/\D+/g, '').slice(0, 8))}
                          placeholder="Enter your 4 to 8 digit Account PIN"
                        />
                      </label>
                    </div>

                    <div className={styles.shareConfirmActions}>
                      <button type="button" className={styles.secondaryButton} onClick={closeShareConfirm} disabled={isSharing}>
                        Back
                      </button>
                      <button type="button" className={styles.primaryButton} onClick={() => void handleShare()} disabled={isSharing}>
                        {isSharing ? 'Sharing...' : `Share with ${partnerName(selectedPartner)}`}
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
