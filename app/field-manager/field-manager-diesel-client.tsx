'use client';

import { useEffect, useMemo, useState } from 'react';
import FieldManagerNavLink from './field-manager-nav-link';
import styles from './page.module.css';

type FieldManagerSession = {
  id: string;
  displayName: string;
  username: string;
};

type FieldManagerFuelStorageSummary = {
  id: string;
  ownerUserId: string;
  name: string;
  fuelType: string;
  publicFuelStorageCode: string;
  capacityLitres: number | null;
  currentLitres: number;
  stockPercent: number | null;
  locationLabel: string;
  updatedAtIso: string | null;
};

type SessionApiResponse = {
  ok: boolean;
  manager?: FieldManagerSession;
  error?: string;
};

type DieselApiResponse = {
  ok: boolean;
  storages?: FieldManagerFuelStorageSummary[];
  error?: string;
};

type OpenDieselApiResponse = {
  ok: boolean;
  redirectTo?: string;
  error?: string;
};

function extractError(payload: { error?: string } | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

function normalizeSearchText(storage: FieldManagerFuelStorageSummary): string {
  return [storage.name, storage.fuelType, storage.locationLabel, storage.publicFuelStorageCode]
    .join(' ')
    .toLowerCase();
}

function formatLitres(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
}

function formatStock(storage: FieldManagerFuelStorageSummary): string {
  if (storage.stockPercent !== null && Number.isFinite(storage.stockPercent)) {
    return `${Math.round(storage.stockPercent)}% full`;
  }

  if (storage.capacityLitres !== null && storage.capacityLitres > 0) {
    return `${formatLitres(storage.currentLitres)} of ${formatLitres(storage.capacityLitres)}`;
  }

  return `${formatLitres(storage.currentLitres)} available`;
}

function formatDate(value: string | null): string {
  if (!value) return 'No update yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No update yet';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
  }).format(parsed);
}

function formatLocationLabel(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No location saved';

  const parts = cleaned.split(/,\s*/).filter(Boolean);
  if (parts.length >= 3) {
    const head = parts.slice(0, 2).join(', ');
    const tail = parts.slice(2).join(', ').replace(/\s+/g, '\u00a0');
    return `${head}, ${tail}`;
  }

  return cleaned.replace(/\s+(\S+)$/, '\u00a0$1');
}

export default function FieldManagerDieselClient() {
  const [storages, setStorages] = useState<FieldManagerFuelStorageSummary[]>([]);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openingStorageId, setOpeningStorageId] = useState<string | null>(null);

  const filteredStorages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return storages;
    return storages.filter((storage) => normalizeSearchText(storage).includes(query));
  }, [search, storages]);

  useEffect(() => {
    void loadDieselStorages();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadDieselStorages() {
    setIsLoading(true);
    setNotice(null);

    try {
      const sessionResponse = await fetch('/api/field-manager/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      const sessionPayload = (await sessionResponse.json().catch(() => null)) as SessionApiResponse | null;

      if (sessionResponse.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!sessionResponse.ok || !sessionPayload?.ok || !sessionPayload.manager) {
        throw new Error(extractError(sessionPayload, 'Field Manager login is required.'));
      }

      const dieselResponse = await fetch('/api/field-manager/diesel', {
        credentials: 'include',
        cache: 'no-store',
      });
      const dieselPayload = (await dieselResponse.json().catch(() => null)) as DieselApiResponse | null;

      if (dieselResponse.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!dieselResponse.ok || !dieselPayload?.ok) {
        throw new Error(extractError(dieselPayload, 'Failed to load fuel storage units.'));
      }

      setStorages(dieselPayload.storages ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load fuel storage units.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenStorage(storage: FieldManagerFuelStorageSummary) {
    setOpeningStorageId(storage.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/field-manager/diesel/${encodeURIComponent(storage.id)}/open`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as OpenDieselApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!response.ok || !payload?.ok || !payload.redirectTo) {
        throw new Error(extractError(payload, 'This fuel storage unit cannot be opened.'));
      }

      window.location.assign(payload.redirectTo);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This fuel storage unit cannot be opened.');
      setOpeningStorageId(null);
    }
  }

  return (
    <main className={styles.mobilePage}>
      <section className={styles.assetsShell}>
        <header className={styles.assetsHeader} aria-label="Field Manager account controls">
          <FieldManagerNavLink href="/field-manager" label="Home" />
        </header>

        {notice ? <div className={styles.errorNotice}>{notice}</div> : null}

        <section className={styles.searchCard}>
          <div className={styles.searchField}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tank, fuel type, location or code"
              aria-label="Search fuel storage units"
              autoComplete="off"
            />
          </div>
        </section>

        {isLoading ? <p className={styles.mobileEmpty}>Loading available fuel storage units…</p> : null}

        {!isLoading && !storages.length ? (
          <p className={styles.mobileEmpty}>No fuel storage units are available for this Field Manager login.</p>
        ) : null}

        {!isLoading && storages.length > 0 && !filteredStorages.length ? (
          <p className={styles.mobileEmpty}>No fuel storage units match this search.</p>
        ) : null}

        <section className={styles.assetList} aria-label="Field Manager fuel storage units">
          {filteredStorages.map((storage) => {
            const isOpening = openingStorageId === storage.id;

            return (
              <article key={storage.id} className={styles.assetCard}>
                <div className={styles.assetTopRow}>
                  <div>
                    <h2>{storage.name}</h2>
                    <p>{formatLocationLabel(storage.locationLabel)}</p>
                  </div>
                </div>

                <div className={styles.assetMetaGrid}>
                  <div>
                    <span>Current level</span>
                    <strong>{formatLitres(storage.currentLitres)}</strong>
                  </div>
                  <div>
                    <span>Capacity</span>
                    <strong>{formatLitres(storage.capacityLitres)}</strong>
                  </div>
                  <div>
                    <span>Stock</span>
                    <strong>{formatStock(storage)}</strong>
                  </div>
                  <div>
                    <span>Last update</span>
                    <strong>{formatDate(storage.updatedAtIso)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={`${styles.mobilePrimaryButton} ${styles.assetOpenButton}`}
                  onClick={() => void handleOpenStorage(storage)}
                  disabled={Boolean(openingStorageId)}
                >
                  {isOpening ? 'Opening…' : 'Open'}
                </button>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
