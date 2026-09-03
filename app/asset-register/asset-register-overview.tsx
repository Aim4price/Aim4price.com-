'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import registerStyles from './page.module.css';
import styles from './asset-register-overview.module.css';

type OverviewCategory = 'problem' | 'maintenance' | 'licence' | 'note';
type OverviewSection = 'needs_attention' | 'coming_up' | 'recent';
type RegisterContentView = 'overview' | 'assets';

type IssueNoteStatus = {
  id: string;
  note: string;
  summary: string;
  operatorName: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

type MaintenanceStatus = {
  id: string;
  kind: 'checked' | 'serviced' | 'repaired';
  summary: string;
  note: string;
  operatorName: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

type MaintenanceAlert = {
  id: string;
  maintenanceType: 'service' | 'checkup';
  triggerType: 'date' | 'usage';
  computedStatus: 'upcoming' | 'due_soon' | 'due' | 'overdue' | 'done' | 'cancelled';
  computedStatusLabel: string;
  heading: string;
  body: string;
  dueDate: string | null;
  dueUsage: number | null;
  currentUsage: number | null;
  usageMetric: 'hours' | 'km' | 'percentage' | null;
  createdAtIso: string;
};

type LicenseAlert = {
  id: string;
  renewalDate: string;
  registrationNumber: string;
  computedStatus: 'due_soon' | 'due' | 'overdue';
  computedStatusLabel: string;
  heading: string;
  body: string;
};

type PartnerNote = {
  id: string;
  noteText: string;
  partnerName: string;
  partnerBusinessName: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

type OverviewAsset = {
  id: string;
  title: string;
  serialNumber?: string;
  registerName?: string;
  latestIssueNoteStatus?: IssueNoteStatus | null;
  latestMaintenanceStatus?: MaintenanceStatus | null;
  maintenanceAlert?: MaintenanceAlert | null;
  licenseRenewalAlert?: LicenseAlert | null;
  openPartnerNote?: PartnerNote | null;
};

type OverviewGroup = {
  id: string;
  name: string;
  members: Array<{ assetId: string }>;
};

type AssetRegisterOverviewResponse = {
  ok: boolean;
  items?: OverviewAsset[];
  assets?: OverviewAsset[];
  groups?: OverviewGroup[];
  error?: string;
};

type OverviewItem = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetIdentifier: string;
  registerName: string;
  umbrellaName: string;
  category: OverviewCategory;
  section: OverviewSection;
  status: string;
  headline: string;
  detail: string;
  meta: string;
  sortPriority: number;
  sortTime: number;
};

const INITIAL_VISIBLE_ITEMS = 6;
const REGISTER_VIEW_STORAGE_KEY = 'aim4price:asset-register:content-view';

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return text(value);
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(parsed);
}

function usageLabel(value: number | null, metric: MaintenanceAlert['usageMetric']): string {
  if (value === null || !Number.isFinite(value)) return '';
  if (metric === 'percentage') return `${value}%`;
  return `${value.toLocaleString('en-ZA')} ${metric === 'km' ? 'km' : 'hours'}`;
}

function maintenanceMeta(alert: MaintenanceAlert): string {
  if (alert.triggerType === 'date') {
    const due = dateLabel(alert.dueDate);
    return due ? `Due ${due}` : '';
  }

  const due = usageLabel(alert.dueUsage, alert.usageMetric);
  const current = usageLabel(alert.currentUsage, alert.usageMetric);
  return [due ? `Due at ${due}` : '', current ? `Current ${current}` : ''].filter(Boolean).join(' • ');
}

function sectionForAlert(status: MaintenanceAlert['computedStatus'] | LicenseAlert['computedStatus']): OverviewSection {
  return status === 'overdue' || status === 'due' ? 'needs_attention' : 'coming_up';
}

function priorityForStatus(status: string, fallback: number): number {
  if (status === 'problem') return 0;
  if (status === 'overdue') return 1;
  if (status === 'due') return 2;
  if (status === 'note') return 3;
  if (status === 'due_soon') return 4;
  if (status === 'upcoming') return 5;
  return fallback;
}

function buildOverviewItems(assets: OverviewAsset[], groups: OverviewGroup[]): OverviewItem[] {
  const umbrellaByAssetId = new Map<string, string>();
  groups.forEach((group) => {
    group.members.forEach((member) => {
      umbrellaByAssetId.set(member.assetId, group.name);
    });
  });

  const items: OverviewItem[] = [];

  assets.forEach((asset) => {
    const umbrellaName = umbrellaByAssetId.get(asset.id) ?? '';
    const base = {
      assetId: asset.id,
      assetTitle: text(asset.title) || 'Untitled asset',
      assetIdentifier: text(asset.serialNumber),
      registerName: text(asset.registerName),
      umbrellaName,
    };

    const problem = asset.latestIssueNoteStatus;
    if (problem && !problem.notedAtIso) {
      const reported = dateLabel(problem.createdAtIso);
      items.push({
        ...base,
        id: `problem:${problem.id}`,
        category: 'problem',
        section: 'needs_attention',
        status: 'Needs attention',
        headline: 'Problem reported',
        detail: text(problem.note) || text(problem.summary) || 'A problem note was reported for this asset.',
        meta: [text(problem.operatorName) ? `Reported by ${text(problem.operatorName)}` : '', reported ? `Reported ${reported}` : ''].filter(Boolean).join(' • '),
        sortPriority: 0,
        sortTime: new Date(problem.createdAtIso || 0).getTime() || 0,
      });
    }

    const partnerNote = asset.openPartnerNote;
    if (partnerNote && !partnerNote.notedAtIso) {
      const partner = text(partnerNote.partnerBusinessName) || text(partnerNote.partnerName);
      const received = dateLabel(partnerNote.createdAtIso);
      items.push({
        ...base,
        id: `note:${partnerNote.id}`,
        category: 'note',
        section: 'needs_attention',
        status: 'New note',
        headline: partner ? `Note from ${partner}` : 'Partner note',
        detail: text(partnerNote.noteText) || 'A new partner note is waiting for review.',
        meta: received ? `Received ${received}` : '',
        sortPriority: 3,
        sortTime: new Date(partnerNote.createdAtIso || 0).getTime() || 0,
      });
    }

    const maintenance = asset.maintenanceAlert;
    if (maintenance && maintenance.computedStatus !== 'done' && maintenance.computedStatus !== 'cancelled') {
      items.push({
        ...base,
        id: `maintenance:${maintenance.id}`,
        category: 'maintenance',
        section: sectionForAlert(maintenance.computedStatus),
        status: text(maintenance.computedStatusLabel) || 'Upcoming',
        headline: text(maintenance.heading) || (maintenance.maintenanceType === 'checkup' ? 'Check-up due' : 'Service due'),
        detail: text(maintenance.body) || `${maintenance.maintenanceType === 'checkup' ? 'Check-up' : 'Service'} is scheduled for this asset.`,
        meta: maintenanceMeta(maintenance),
        sortPriority: priorityForStatus(maintenance.computedStatus, 6),
        sortTime: new Date(maintenance.dueDate || maintenance.createdAtIso || 0).getTime() || 0,
      });
    }

    const licence = asset.licenseRenewalAlert;
    if (licence) {
      const registration = text(licence.registrationNumber);
      const renewalDate = dateLabel(licence.renewalDate);
      items.push({
        ...base,
        id: `licence:${licence.id}`,
        category: 'licence',
        section: sectionForAlert(licence.computedStatus),
        status: text(licence.computedStatusLabel) || 'Due soon',
        headline: text(licence.heading) || 'Licence renewal',
        detail: text(licence.body) || 'Licence renewal needs attention.',
        meta: [registration ? `Registration ${registration}` : '', renewalDate ? `Renews ${renewalDate}` : ''].filter(Boolean).join(' • '),
        sortPriority: priorityForStatus(licence.computedStatus, 6),
        sortTime: new Date(licence.renewalDate || 0).getTime() || 0,
      });
    }

    const maintenanceStatus = asset.latestMaintenanceStatus;
    if (maintenanceStatus && !maintenanceStatus.notedAtIso) {
      const performed = dateLabel(maintenanceStatus.createdAtIso);
      const kindLabel = maintenanceStatus.kind === 'repaired'
        ? 'Repair recorded'
        : maintenanceStatus.kind === 'serviced'
          ? 'Service recorded'
          : 'Check-up recorded';
      items.push({
        ...base,
        id: `maintenance-update:${maintenanceStatus.id}`,
        category: 'maintenance',
        section: 'recent',
        status: 'Recent update',
        headline: kindLabel,
        detail: text(maintenanceStatus.note) || text(maintenanceStatus.summary) || 'Maintenance activity was recorded for this asset.',
        meta: [text(maintenanceStatus.operatorName) ? `By ${text(maintenanceStatus.operatorName)}` : '', performed].filter(Boolean).join(' • '),
        sortPriority: 7,
        sortTime: new Date(maintenanceStatus.createdAtIso || 0).getTime() || 0,
      });
    }
  });

  return items.sort((left, right) => {
    const sectionPriority: Record<OverviewSection, number> = {
      needs_attention: 0,
      coming_up: 1,
      recent: 2,
    };
    const sectionDifference = sectionPriority[left.section] - sectionPriority[right.section];
    if (sectionDifference) return sectionDifference;
    const priorityDifference = left.sortPriority - right.sortPriority;
    if (priorityDifference) return priorityDifference;
    if (left.section === 'recent') return right.sortTime - left.sortTime;
    if (left.sortTime && right.sortTime) return left.sortTime - right.sortTime;
    return left.assetTitle.localeCompare(right.assetTitle);
  });
}

function categoryLabel(category: OverviewCategory): string {
  if (category === 'maintenance') return 'Maintenance';
  if (category === 'licence') return 'Licensing';
  if (category === 'problem') return 'Problem';
  return 'Note';
}

function categoryClassName(category: OverviewCategory): string {
  if (category === 'problem') return styles.categoryProblem;
  if (category === 'licence') return styles.categoryLicence;
  if (category === 'note') return styles.categoryNote;
  return styles.categoryMaintenance;
}

function categoryIcon(category: OverviewCategory) {
  if (category === 'maintenance') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 6.2a5.2 5.2 0 0 0-6.5 6.5L3.6 17.4a2.1 2.1 0 1 0 3 3l4.7-4.7a5.2 5.2 0 0 0 6.5-6.5l-3 3-3-3 3-3Z" /></svg>
    );
  }
  if (category === 'licence') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3" /></svg>
    );
  }
  if (category === 'problem') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4M12 16.5h.01" /></svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v12H9l-4 4V4Z" /><path d="M8 8h8M8 12h5" /></svg>
  );
}

function buildAssetHref(assetId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('assetId', assetId);
  url.hash = `asset-card-${encodeURIComponent(assetId)}`;
  return `${url.pathname}${url.search}${url.hash}`;
}

function assetMeta(item: OverviewItem): string {
  return [
    item.registerName,
    item.assetIdentifier ? `Serial / VIN · ${item.assetIdentifier}` : '',
  ].filter(Boolean).join(' • ');
}

function restoreManagedAssetViewSiblings(host: HTMLDivElement | null) {
  if (!host?.parentElement) return;

  let sibling = host.nextElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement && sibling.dataset.assetRegisterOverviewManaged === 'true') {
      sibling.hidden = sibling.dataset.assetRegisterOverviewWasHidden === 'true';
      delete sibling.dataset.assetRegisterOverviewManaged;
      delete sibling.dataset.assetRegisterOverviewWasHidden;
    }
    sibling = sibling.nextElementSibling;
  }
}

function syncAssetViewSiblings(host: HTMLDivElement | null, showAssets: boolean) {
  if (!host?.parentElement) return;

  let sibling = host.nextElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement) {
      if (showAssets) {
        if (sibling.dataset.assetRegisterOverviewManaged === 'true') {
          sibling.hidden = sibling.dataset.assetRegisterOverviewWasHidden === 'true';
          delete sibling.dataset.assetRegisterOverviewManaged;
          delete sibling.dataset.assetRegisterOverviewWasHidden;
        }
      } else {
        if (sibling.dataset.assetRegisterOverviewManaged !== 'true') {
          sibling.dataset.assetRegisterOverviewManaged = 'true';
          sibling.dataset.assetRegisterOverviewWasHidden = sibling.hidden ? 'true' : 'false';
        }
        sibling.hidden = true;
      }
    }
    sibling = sibling.nextElementSibling;
  }
}

export default function AssetRegisterOverview() {
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  const [activeView, setActiveView] = useState<RegisterContentView>('assets');
  const [assets, setAssets] = useState<OverviewAsset[]>([]);
  const [groups, setGroups] = useState<OverviewGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const storedView = window.sessionStorage.getItem(REGISTER_VIEW_STORAGE_KEY);
      if (storedView === 'overview' || storedView === 'assets') {
        setActiveView(storedView);
      }
    } catch {
      // Session storage is optional. Defaulting to Assets keeps the register usable.
    }
  }, []);

  useEffect(() => {
    let host: HTMLDivElement | null = null;

    const attachHost = () => {
      const toolbar = document.querySelector<HTMLElement>(`.${registerStyles.toolbar}`);
      if (host?.isConnected) return true;
      if (host && !host.isConnected) host = null;

      const parent = toolbar?.parentElement ?? null;
      if (!toolbar || !parent) return false;

      host = document.createElement('div');
      host.dataset.assetRegisterOverview = 'true';
      parent.insertBefore(host, toolbar);
      setPortalHost(host);
      return true;
    };

    const observer = new MutationObserver(() => {
      void attachHost();
    });

    void attachHost();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      restoreManagedAssetViewSiblings(host);
      host?.remove();
    };
  }, []);

  useEffect(() => {
    if (!portalHost?.parentElement) return undefined;

    const parent = portalHost.parentElement;
    const sync = () => syncAssetViewSiblings(portalHost, activeView === 'assets');
    const observer = new MutationObserver(sync);

    sync();
    observer.observe(parent, { childList: true });

    return () => {
      observer.disconnect();
      if (activeView === 'overview') restoreManagedAssetViewSiblings(portalHost);
    };
  }, [activeView, portalHost]);

  const selectView = useCallback((nextView: RegisterContentView) => {
    setActiveView(nextView);
    if (nextView === 'assets') setExpanded(false);

    try {
      window.sessionStorage.setItem(REGISTER_VIEW_STORAGE_KEY, nextView);
    } catch {
      // Ignore storage failures and keep the in-memory view selection.
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const current = new URL(window.location.href);
      const params = new URLSearchParams();
      const registerId = text(current.searchParams.get('registerId'));
      const scope = text(current.searchParams.get('scope'));
      if (registerId) params.set('registerId', registerId);
      if (scope === 'combined') params.set('scope', 'combined');
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/asset-register${suffix}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json() as AssetRegisterOverviewResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'The Asset Register overview could not be loaded.');
      }
      setAssets(payload.items ?? payload.assets ?? []);
      setGroups(payload.groups ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The Asset Register overview could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const refreshOnFocus = () => void loadOverview();
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [loadOverview]);

  const overviewItems = useMemo(() => buildOverviewItems(assets, groups), [assets, groups]);
  const visibleItems = expanded ? overviewItems : overviewItems.slice(0, INITIAL_VISIBLE_ITEMS);
  const hiddenCount = Math.max(0, overviewItems.length - visibleItems.length);
  const counts = useMemo(() => ({
    attention: overviewItems.filter((item) => item.section === 'needs_attention').length,
    maintenance: overviewItems.filter((item) => item.category === 'maintenance').length,
    licence: overviewItems.filter((item) => item.category === 'licence').length,
    problem: overviewItems.filter((item) => item.category === 'problem').length,
    note: overviewItems.filter((item) => item.category === 'note').length,
  }), [overviewItems]);

  if (!portalHost) return null;

  return createPortal(
    <div className={styles.registerViewArea}>
      <div className={styles.viewSwitch} role="group" aria-label="Choose Asset Register view">
        <button
          type="button"
          className={`${styles.viewSwitchButton} ${activeView === 'overview' ? styles.viewSwitchButtonActive : ''}`}
          aria-pressed={activeView === 'overview'}
          onClick={() => selectView('overview')}
        >
          <span>Overview</span>
          {!loading && !error ? <span className={styles.viewSwitchCount}>{overviewItems.length}</span> : null}
        </button>
        <button
          type="button"
          className={`${styles.viewSwitchButton} ${activeView === 'assets' ? styles.viewSwitchButtonActive : ''}`}
          aria-pressed={activeView === 'assets'}
          onClick={() => selectView('assets')}
        >
          <span>Assets</span>
          {!loading && !error ? <span className={styles.viewSwitchCount}>{assets.length}</span> : null}
        </button>
      </div>

      {activeView === 'overview' ? (
        <section className={styles.overview} aria-labelledby="asset-register-overview-title">
          <div className={styles.overviewHeader}>
            <div className={styles.overviewTitleBlock}>
              <h2 id="asset-register-overview-title">Needs attention &amp; coming up</h2>
              <p>Maintenance, licence renewals and notes across standalone assets and assets inside umbrellas.</p>
            </div>

            {!loading && !error && overviewItems.length ? (
              <p className={styles.overviewSummary}>
                <strong>{counts.attention} need attention</strong>
                <span aria-hidden="true">•</span>
                <span>{counts.maintenance} maintenance</span>
                <span aria-hidden="true">•</span>
                <span>{counts.licence} licensing</span>
                <span aria-hidden="true">•</span>
                <span>{counts.problem + counts.note} problems / notes</span>
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className={`${styles.stateCard} ${styles.loadingCard}`} role="status">
              <span className={styles.loadingDot} aria-hidden="true" />
              <div><strong>Checking the register</strong><p>Loading maintenance, licensing and problem notes.</p></div>
            </div>
          ) : error ? (
            <div className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
              <div><strong>Overview unavailable</strong><p>{error}</p></div>
              <button type="button" className={styles.retryButton} onClick={() => void loadOverview()}>Retry</button>
            </div>
          ) : overviewItems.length === 0 ? (
            <div className={`${styles.stateCard} ${styles.clearCard}`}>
              <span className={styles.clearIcon} aria-hidden="true">✓</span>
              <div><strong>Nothing needs attention right now</strong><p>No open maintenance alerts, licence renewals, problem notes or partner notes were found.</p></div>
            </div>
          ) : (
            <>
              <div className={styles.overviewList}>
                {visibleItems.map((item) => (
                  <article
                    key={item.id}
                    className={`${registerStyles.assetCard} ${styles.overviewCard} ${item.section === 'needs_attention' ? styles.cardAttention : item.section === 'coming_up' ? styles.cardUpcoming : styles.cardRecent}`}
                  >
                    <div className={`${styles.categoryIcon} ${categoryClassName(item.category)}`}>
                      {categoryIcon(item.category)}
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.cardContext}>
                        <strong className={categoryClassName(item.category)}>{categoryLabel(item.category)}</strong>
                        <span aria-hidden="true">•</span>
                        <span>{item.umbrellaName || 'Standalone asset'}</span>
                        <span aria-hidden="true">•</span>
                        <span className={item.section === 'needs_attention' ? styles.statusAttention : item.section === 'coming_up' ? styles.statusUpcoming : styles.statusRecent}>
                          {item.status}
                        </span>
                      </div>
                      <h3 className={styles.assetTitle}>{item.assetTitle}</h3>
                      <strong className={styles.headline}>{item.headline}</strong>
                      <p className={styles.detail}>{item.detail}</p>
                      <div className={styles.metaRow}>
                        {assetMeta(item) ? <span>{assetMeta(item)}</span> : null}
                        {item.meta ? <span>{item.meta}</span> : null}
                      </div>
                    </div>

                    <a
                      className={styles.viewAssetButton}
                      href={buildAssetHref(item.assetId)}
                      onClick={() => selectView('assets')}
                    >
                      View asset
                      <span aria-hidden="true">→</span>
                    </a>
                  </article>
                ))}
              </div>

              {overviewItems.length > INITIAL_VISIBLE_ITEMS ? (
                <div className={styles.overviewFooter}>
                  <button type="button" className={styles.showMoreButton} onClick={() => setExpanded((value) => !value)}>
                    {expanded ? 'Show less' : `Show ${hiddenCount} more`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>,
    portalHost,
  );
}
