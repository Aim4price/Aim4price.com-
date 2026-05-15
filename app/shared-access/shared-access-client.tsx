'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type PartnerType = 'dealer' | 'finance' | 'insurance';
type GrantStatus = 'pending' | 'active' | 'revoked' | 'declined';
type NoticeTone = 'success' | 'error';

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

const PARTNER_TYPES: Array<{ value: PartnerType; title: string; description: string }> = [
  {
    value: 'dealer',
    title: 'Dealer',
    description: 'Share with a machinery dealer for fleet planning, trade-ins and replacement support.',
  },
  {
    value: 'finance',
    title: 'Finance',
    description: 'Share with a bank or finance partner for asset-backed finance and refinancing reviews.',
  },
  {
    value: 'insurance',
    title: 'Insurance',
    description: 'Share with an insurer or broker for insured-value checks and annual policy updates.',
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

  const [grants, setGrants] = useState<SharedAccessGrant[]>([]);
  const [partners, setPartners] = useState<PartnerDirectoryEntry[]>([]);
  const [selectedPartnerType, setSelectedPartnerType] = useState<PartnerType>('dealer');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [search, setSearch] = useState('');
  const [pin, setPin] = useState('');
  const [ownerMessage, setOwnerMessage] = useState('');
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeScanHistory, setIncludeScanHistory] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingGrants, setIsLoadingGrants] = useState(true);
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.userId === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );

  const grantStats = useMemo(() => {
    const active = grants.filter((grant) => grant.status === 'active').length;
    const pending = grants.filter((grant) => grant.status === 'pending').length;
    return { total: grants.length, active, pending };
  }, [grants]);

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

      setPartners(data.partners);
      setSelectedPartnerId((current) => (data.partners?.some((partner) => partner.userId === current) ? current : ''));
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
    if (!isModalOpen) return;
    void loadPartners();
  }, [isModalOpen, loadPartners]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isModalOpen || !mapElementRef.current) return undefined;

    let cancelled = false;

    async function setupMap() {
      const partnersWithCoords = partners.filter(hasCoordinates);

      if (!partnersWithCoords.length || !mapElementRef.current) {
        return;
      }

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

        const bounds = L.latLngBounds([]);

        partnersWithCoords.forEach((partner) => {
          const lat = Number(partner.latitude);
          const lng = Number(partner.longitude);
          const marker = L.marker([lat, lng]).addTo(markerLayerRef.current);
          marker.bindPopup(`<strong>${partnerName(partner)}</strong><br />${partnerLocation(partner)}`);
          marker.on('click', () => setSelectedPartnerId(partner.userId));
          bounds.extend([lat, lng]);
        });

        if (bounds.isValid()) {
          leafletMapRef.current.fitBounds(bounds.pad(0.2));
        }
      } catch (error) {
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load map.' });
      }
    }

    void setupMap();

    return () => {
      cancelled = true;
    };
  }, [isModalOpen, partners]);

  useEffect(() => {
    if (isModalOpen) return undefined;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      markerLayerRef.current = null;
    }

    return undefined;
  }, [isModalOpen]);

  function openShareModal(partnerType: PartnerType = 'dealer') {
    setSelectedPartnerType(partnerType);
    setSelectedPartnerId('');
    setSearch('');
    setPin('');
    setOwnerMessage('');
    setIncludeDocuments(true);
    setIncludeScanHistory(true);
    setIsModalOpen(true);
  }

  function closeShareModal() {
    if (isSharing) return;
    setIsModalOpen(false);
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
      setIsModalOpen(false);
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
        <div className={styles.hero}>
          <div>
            <h1>Shared access</h1>
            <p>
              Give selected dealers, finance partners or insurance partners permission to view your live Asset Register.
              Access stays controlled by you and can be revoked at any time.
            </p>
          </div>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryButton} onClick={() => openShareModal()}>
              Share Asset Register
            </button>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <span>Total shared</span>
            <strong>{grantStats.total}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Active</span>
            <strong>{grantStats.active}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Pending</span>
            <strong>{grantStats.pending}</strong>
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Register access</h2>
              <p>These partners have been invited to view your Asset Register.</p>
            </div>
          </div>

          {isLoadingGrants ? (
            <p className={styles.emptyState}>Loading shared access...</p>
          ) : grants.length ? (
            <div className={styles.grantList}>
              {grants.map((grant) => (
                <article key={grant.id} className={styles.grantCard}>
                  <div className={styles.cardTitleRow}>
                    <strong>{grant.partnerBusinessName || grant.partnerName}</strong>
                    <span className={`${styles.statusPill} ${statusClass(grant.status)}`}>{formatStatus(grant.status)}</span>
                  </div>
                  <div className={styles.cardMetaRow}>
                    <span>{formatPartnerType(grant.partnerType)}</span>
                    <span>{[grant.partnerTownCity, grant.partnerProvince].filter(Boolean).join(', ') || 'Location not saved'}</span>
                    <span>Shared {formatDate(grant.createdAtIso)}</span>
                    {grant.lastViewedAtIso ? <span>Last viewed {formatDate(grant.lastViewedAtIso)}</span> : null}
                  </div>
                  {grant.ownerMessage ? <p>{grant.ownerMessage}</p> : null}
                  {grant.status === 'active' || grant.status === 'pending' ? (
                    <div className={styles.inlineActions}>
                      <button type="button" className={styles.dangerButton} onClick={() => void handleRevoke(grant.id)}>
                        Revoke access
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>No shared access yet. Use “Share Asset Register” to invite a partner.</p>
          )}
        </section>
      </section>

      {isModalOpen ? (
        <div className={styles.modalBackdrop} onClick={closeShareModal}>
          <section className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Share Asset Register</h2>
              <p>Choose a partner type, select an approved partner, then confirm with your Account PIN.</p>
            </div>

            <div className={styles.modalScroll}>
              <div className={styles.stack}>
                <div className={styles.partnerTypeGrid}>
                  {PARTNER_TYPES.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      className={`${styles.typeButton} ${selectedPartnerType === entry.value ? styles.typeButtonActive : ''}`}
                      onClick={() => {
                        setSelectedPartnerType(entry.value);
                        setSelectedPartnerId('');
                      }}
                    >
                      <span>
                        <strong>{entry.title}</strong>
                        <small>{entry.description}</small>
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.filters}>
                  <label className={styles.field}>
                    <span>Search partner directory</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by business, town, province, service or brand"
                    />
                  </label>
                  <button type="button" className={styles.secondaryButton} onClick={() => void loadPartners()}>
                    Search
                  </button>
                </div>

                <div className={styles.grid}>
                  <div className={styles.partnerList}>
                    {isLoadingPartners ? (
                      <p className={styles.emptyState}>Loading partners...</p>
                    ) : partners.length ? (
                      partners.map((partner) => (
                        <button
                          key={partner.userId}
                          type="button"
                          className={`${styles.partnerCard} ${selectedPartnerId === partner.userId ? styles.partnerCardActive : ''}`}
                          onClick={() => setSelectedPartnerId(partner.userId)}
                        >
                          <div className={styles.cardTitleRow}>
                            <strong>{partnerName(partner)}</strong>
                            <span className={styles.statusPill}>{formatPartnerType(partner.partnerType)}</span>
                          </div>
                          <div className={styles.cardMetaRow}>
                            <span>{partnerLocation(partner)}</span>
                            {partner.serviceRadiusKm ? <span>{partner.serviceRadiusKm} km radius</span> : null}
                          </div>
                          {partner.description ? <p>{partner.description}</p> : null}
                          {partner.brandFocus ? <p>Brands: {partner.brandFocus}</p> : null}
                        </button>
                      ))
                    ) : (
                      <p className={styles.emptyState}>
                        No listed {formatPartnerType(selectedPartnerType).toLowerCase()} partners found yet. Partner accounts must enable their directory listing under Account details.
                      </p>
                    )}
                  </div>

                  <div className={styles.mapShell}>
                    {partners.some(hasCoordinates) ? (
                      <div ref={mapElementRef} className={styles.mapCanvas} aria-label="Partner map" />
                    ) : (
                      <div className={styles.mapFallback}>
                        <p>Partners with saved latitude and longitude will appear on this map.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.disclaimer}>
                  You are giving the selected partner view access to your Asset Register, including asset details,
                  saved values, photos and selected history. This does not create a finance, insurance, valuation or
                  sales agreement. You can revoke access at any time.
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
                  <span>Message to partner</span>
                  <textarea
                    value={ownerMessage}
                    onChange={(event) => setOwnerMessage(event.target.value)}
                    placeholder="Optional note explaining why you are sharing this register."
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
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} onClick={closeShareModal} disabled={isSharing}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => void handleShare()} disabled={isSharing}>
                {isSharing ? 'Sharing...' : selectedPartner ? `Share with ${partnerName(selectedPartner)}` : 'Choose partner'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
