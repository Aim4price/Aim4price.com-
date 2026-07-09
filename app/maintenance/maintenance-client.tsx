'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type MaintenanceType = 'service' | 'checkup';
type TriggerType = 'date' | 'usage';
type MaintenanceStatus = 'upcoming' | 'done' | 'cancelled';
type UsageMetric = 'hours' | 'km' | 'percentage';
type ComputedStatus = 'upcoming' | 'due_soon' | 'due' | 'overdue' | 'done' | 'cancelled';
type DateIntervalUnit = 'days' | 'weeks' | 'months';
type UsageIntervalUnit = 'hours' | 'km' | 'percentage';
type IntervalUnit = DateIntervalUnit | UsageIntervalUnit;

type AssetOption = {
  id: string;
  title: string;
  kind: string;
  categoryLabel: string;
  yearModel: number | null;
  usageReading: number | null;
  usageMetric: UsageMetric;
  condition: string;
  value: number;
  selectedMethod: string;
  meta: string;
};

type FieldManagerOption = {
  id: string;
  displayName: string;
  username: string;
  isActive: boolean;
};

type MaintenanceRecord = {
  id: string;
  userId: string;
  assetId: string;
  assetTitle: string;
  assetKind: string;
  assetCategoryLabel: string;
  assetYearModel: number | null;
  assetUsageReading: number | null;
  assetUsageMetric: UsageMetric;
  assetCondition: string;
  assetValue: number;
  assetMeta: string;
  maintenanceType: MaintenanceType;
  triggerType: TriggerType;
  status: MaintenanceStatus;
  computedStatus: ComputedStatus;
  computedStatusLabel: string;
  title: string;
  notes: string;
  assignedFieldManagerId: string | null;
  assignedName: string;
  dueDate: string | null;
  dueUsage: number | null;
  usageMetric: UsageMetric | null;
  currentUsage: number | null;
  remainingUsage: number | null;
  daysUntilDue: number | null;
  alertBeforeValue: number | null;
  alertBeforeUnit: IntervalUnit | null;
  recurringEnabled: boolean;
  recurringIntervalValue: number | null;
  recurringIntervalUnit: IntervalUnit | null;
  completedAtIso: string | null;
  completedUsage: number | null;
  completedNotes: string;
  completedBy: string;
  alertNotedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type MaintenanceSummary = {
  totalCount: number;
  openCount: number;
  doneCount: number;
  dueSoonCount: number;
  dueCount: number;
  overdueCount: number;
};

type MaintenancePayload = {
  ok?: boolean;
  error?: string;
  assets?: AssetOption[];
  fieldManagers?: FieldManagerOption[];
  records?: MaintenanceRecord[];
  summary?: MaintenanceSummary;
};

type Notice = {
  type: 'success' | 'error';
  text: string;
} | null;

type MaintenanceFilters = {
  assetId: string;
  type: 'all' | MaintenanceType;
  status: 'all' | 'upcoming' | 'done';
  assignedTo: 'all' | 'unassigned' | string;
};

type MaintenanceDraft = {
  assetId: string;
  maintenanceType: MaintenanceType;
  triggerType: TriggerType;
  title: string;
  notes: string;
  assignedFieldManagerId: string;
  assignedName: string;
  dueDate: string;
  dueUsage: string;
  usageMetric: UsageMetric;
  alertBeforeValue: string;
  alertBeforeUnit: IntervalUnit;
  recurringEnabled: boolean;
  recurringIntervalValue: string;
  recurringIntervalUnit: IntervalUnit;
};

type ModalMode = 'asset-picker' | 'form' | 'filter' | 'download' | 'complete' | null;

type DownloadScope = 'total' | 'asset' | 'upcoming' | 'done';

const EMPTY_SUMMARY: MaintenanceSummary = {
  totalCount: 0,
  openCount: 0,
  doneCount: 0,
  dueSoonCount: 0,
  dueCount: 0,
  overdueCount: 0,
};

const EMPTY_FILTERS: MaintenanceFilters = {
  assetId: 'all',
  type: 'all',
  status: 'all',
  assignedTo: 'all',
};

const PAGE_SIZE = 10;

function SearchIcon() {
  return (
    <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="m20.5 19.1-4.3-4.3a7.2 7.2 0 1 0-1.4 1.4l4.3 4.3a1 1 0 0 0 1.4-1.4ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className={styles.buttonIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M5 7a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Zm3 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm3 5a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className={styles.buttonIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M11 4a1 1 0 1 1 2 0v8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l2.3 2.3V4Zm-5 14a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className={styles.buttonIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M5 17.2V20h2.8L18.1 9.7l-2.8-2.8L5 17.2ZM20.3 7.5a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.6 1.6 3.8 3.8 1.6-1.6Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className={styles.buttonIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M9.2 16.6 4.9 12.3a1 1 0 1 1 1.4-1.4l2.9 2.9 8.5-8.5a1 1 0 0 1 1.4 1.4l-9.2 9.9a1 1 0 0 1-1.4 0Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className={styles.buttonIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 10a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor" d="M5.2 7.5 10 12.3l4.8-4.8 1.1 1.1-5.3 5.3a.9.9 0 0 1-1.2 0L4.1 8.6l1.1-1.1Z" />
    </svg>
  );
}

function money(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'R 0';
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

function numberText(value: number | string | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
  }
  return '';
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: value.includes('T') ? 'Africa/Johannesburg' : 'UTC',
  }).format(parsed);
}

function todayInputDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function isoToInputDate(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function typeLabel(value: MaintenanceType | string): string {
  return titleCase(value || 'service');
}

function triggerLabel(value: TriggerType | string): string {
  return value === 'date' ? 'Specific Date' : 'Usage';
}

function statusLabel(value: ComputedStatus | string): string {
  if (value === 'due_soon') return 'Due soon';
  return titleCase(value || 'upcoming');
}

function usageUnitLabel(metric: UsageMetric | string | null | undefined): string {
  if (metric === 'km') return 'km';
  if (metric === 'percentage') return '%';
  return 'hours';
}

function intervalUnitLabel(unit: IntervalUnit | string | null | undefined): string {
  if (unit === 'percentage') return '%';
  if (unit === 'km') return 'km';
  if (unit === 'hours') return 'hours';
  if (unit === 'days') return 'days';
  if (unit === 'weeks') return 'weeks';
  if (unit === 'months') return 'months';
  return '';
}

function formatUsage(value: number | null | undefined, metric: UsageMetric | string | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} ${usageUnitLabel(metric)}`;
}

function defaultUsageInterval(metric: UsageMetric): number {
  if (metric === 'km') return 10_000;
  if (metric === 'percentage') return 10;
  return 250;
}

function defaultUsageAlert(metric: UsageMetric): number {
  if (metric === 'km') return 1_000;
  if (metric === 'percentage') return 5;
  return 20;
}

function defaultDueUsage(asset: AssetOption): string {
  const current = typeof asset.usageReading === 'number' && Number.isFinite(asset.usageReading) ? asset.usageReading : 0;
  return String(Math.round((current + defaultUsageInterval(asset.usageMetric)) * 100) / 100);
}

function emptyDraftForAsset(asset: AssetOption): MaintenanceDraft {
  return {
    assetId: asset.id,
    maintenanceType: 'service',
    triggerType: 'date',
    title: '',
    notes: '',
    assignedFieldManagerId: 'unassigned',
    assignedName: '',
    dueDate: todayInputDate(),
    dueUsage: defaultDueUsage(asset),
    usageMetric: asset.usageMetric,
    alertBeforeValue: '7',
    alertBeforeUnit: 'days',
    recurringEnabled: false,
    recurringIntervalValue: String(asset.usageMetric === 'km' ? 10000 : asset.usageMetric === 'percentage' ? 10 : 250),
    recurringIntervalUnit: asset.usageMetric,
  };
}

function draftFromRecord(record: MaintenanceRecord): MaintenanceDraft {
  const usageMetric = record.usageMetric ?? record.assetUsageMetric;
  return {
    assetId: record.assetId,
    maintenanceType: record.maintenanceType,
    triggerType: record.triggerType,
    title: record.title || '',
    notes: record.notes || '',
    assignedFieldManagerId: record.assignedFieldManagerId || 'unassigned',
    assignedName: record.assignedName || '',
    dueDate: isoToInputDate(record.dueDate),
    dueUsage: record.dueUsage !== null ? String(record.dueUsage) : '',
    usageMetric,
    alertBeforeValue: record.alertBeforeValue !== null ? String(record.alertBeforeValue) : record.triggerType === 'usage' ? String(defaultUsageAlert(usageMetric)) : '7',
    alertBeforeUnit: record.alertBeforeUnit ?? (record.triggerType === 'usage' ? usageMetric : 'days'),
    recurringEnabled: record.recurringEnabled,
    recurringIntervalValue: record.recurringIntervalValue !== null ? String(record.recurringIntervalValue) : String(defaultUsageInterval(usageMetric)),
    recurringIntervalUnit: record.recurringIntervalUnit ?? (record.triggerType === 'usage' ? usageMetric : 'months'),
  };
}

function activeFilterCount(filters: MaintenanceFilters): number {
  return [filters.assetId !== 'all', filters.type !== 'all', filters.status !== 'all', filters.assignedTo !== 'all'].filter(Boolean).length;
}

function selectedAssetLabel(asset: AssetOption | undefined): string {
  if (!asset) return 'Selected asset';
  return asset.meta || `${asset.title} • ${asset.categoryLabel || asset.kind}`;
}

function draftPayload(draft: MaintenanceDraft) {
  const isUsage = draft.triggerType === 'usage';
  return {
    assetId: draft.assetId,
    maintenanceType: draft.maintenanceType,
    triggerType: draft.triggerType,
    title: draft.title,
    notes: draft.notes,
    assignedFieldManagerId: draft.assignedFieldManagerId === 'unassigned' ? null : draft.assignedFieldManagerId,
    assignedName: draft.assignedName,
    dueDate: isUsage ? null : draft.dueDate,
    dueUsage: isUsage ? draft.dueUsage : null,
    usageMetric: isUsage ? draft.usageMetric : null,
    alertBeforeValue: draft.alertBeforeValue,
    alertBeforeUnit: draft.alertBeforeUnit,
    recurringEnabled: draft.recurringEnabled,
    recurringIntervalValue: draft.recurringEnabled ? draft.recurringIntervalValue : null,
    recurringIntervalUnit: draft.recurringEnabled ? draft.recurringIntervalUnit : null,
  };
}

function buildListUrl(filters: MaintenanceFilters): string {
  const params = new URLSearchParams();
  if (filters.assetId !== 'all') params.set('assetId', filters.assetId);
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.assignedTo !== 'all') params.set('assignedTo', filters.assignedTo);
  const query = params.toString();
  return query ? `/api/maintenance?${query}` : '/api/maintenance';
}

function buildReportUrl(scope: DownloadScope, format: 'pdf' | 'xlsx', filters: MaintenanceFilters, assetId?: string): string {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('format', format);
  const resolvedAssetId = scope === 'asset' ? assetId || filters.assetId : filters.assetId;
  if (resolvedAssetId && resolvedAssetId !== 'all') params.set('assetId', resolvedAssetId);
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.assignedTo !== 'all') params.set('assignedTo', filters.assignedTo);
  if (scope !== 'upcoming' && scope !== 'done' && filters.status !== 'all') params.set('status', filters.status);
  return `/api/maintenance/report?${params.toString()}`;
}

function recordSearchText(record: MaintenanceRecord): string {
  return [
    record.assetTitle,
    record.assetMeta,
    record.assetCategoryLabel,
    record.maintenanceType,
    record.triggerType,
    record.computedStatusLabel,
    record.assignedName,
    record.notes,
    record.title,
    record.dueDate,
    record.dueUsage,
    record.currentUsage,
    record.usageMetric,
  ]
    .filter((value) => value !== null && typeof value !== 'undefined')
    .join(' ')
    .toLowerCase();
}

export default function MaintenanceClient() {
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [fieldManagers, setFieldManagers] = useState<FieldManagerOption[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary>(EMPTY_SUMMARY);
  const [notice, setNotice] = useState<Notice>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [search, setSearch] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<MaintenanceFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<MaintenanceFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<MaintenanceDraft | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [completingRecord, setCompletingRecord] = useState<MaintenanceRecord | null>(null);
  const [completeUsage, setCompleteUsage] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [busyCompleteId, setBusyCompleteId] = useState<string | null>(null);
  const [downloadAssetId, setDownloadAssetId] = useState('all');
  const [page, setPage] = useState(1);

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedDraftAsset = draft ? assetById.get(draft.assetId) : undefined;

  const applyPayload = useCallback((payload: MaintenancePayload) => {
    setAssets(Array.isArray(payload.assets) ? payload.assets : []);
    setFieldManagers(Array.isArray(payload.fieldManagers) ? payload.fieldManagers : []);
    setRecords(Array.isArray(payload.records) ? payload.records : []);
    setSummary(payload.summary ?? EMPTY_SUMMARY);
  }, []);

  const loadData = useCallback(
    async (filters = activeFilters) => {
      setIsLoading(true);
      try {
        const response = await fetch(buildListUrl(filters), { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || 'Maintenance data could not be loaded.');
        }

        applyPayload(payload);
      } catch (error) {
        setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Maintenance data could not be loaded.' });
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilters, applyPayload],
  );

  useEffect(() => {
    void loadData(activeFilters);
  }, [activeFilters, loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, records.length]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => recordSearchText(record).includes(query));
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersCount = activeFilterCount(activeFilters);

  const filteredAssets = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => [asset.title, asset.meta, asset.kind, asset.categoryLabel].join(' ').toLowerCase().includes(query));
  }, [assets, pickerSearch]);

  function closeModal() {
    setModalMode(null);
    setPickerSearch('');
    setEditingRecordId(null);
    setCompletingRecord(null);
    setCompleteUsage('');
    setCompleteNotes('');
    setDraft(null);
  }

  function openAddService() {
    setNotice(null);
    setEditingRecordId(null);
    setDraft(null);
    setPickerSearch('');
    setModalMode('asset-picker');
  }

  function selectAsset(asset: AssetOption) {
    setDraft(emptyDraftForAsset(asset));
    setModalMode('form');
  }

  function openEdit(record: MaintenanceRecord) {
    setNotice(null);
    setEditingRecordId(record.id);
    setDraft(draftFromRecord(record));
    setModalMode('form');
  }

  function updateDraft(update: Partial<MaintenanceDraft>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...update };

      if (update.triggerType === 'usage') {
        const metric = next.usageMetric;
        next.alertBeforeUnit = metric;
        next.recurringIntervalUnit = metric;
        if (!next.alertBeforeValue || current.triggerType !== 'usage') next.alertBeforeValue = String(defaultUsageAlert(metric));
        if (!next.recurringIntervalValue || current.triggerType !== 'usage') next.recurringIntervalValue = String(defaultUsageInterval(metric));
      }

      if (update.triggerType === 'date') {
        next.alertBeforeUnit = 'days';
        next.recurringIntervalUnit = 'months';
        if (!next.alertBeforeValue || current.triggerType !== 'date') next.alertBeforeValue = '7';
        if (!next.recurringIntervalValue || current.triggerType !== 'date') next.recurringIntervalValue = '1';
      }

      return next;
    });
  }

  async function submitDraft() {
    if (!draft) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const endpoint = editingRecordId ? `/api/maintenance/${editingRecordId}` : '/api/maintenance';
      const method = editingRecordId ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftPayload(draft)),
      });
      const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Maintenance record could not be saved.');
      }

      applyPayload(payload);
      setNotice({ type: 'success', text: editingRecordId ? 'Maintenance record updated.' : 'Maintenance record saved.' });
      closeModal();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Maintenance record could not be saved.' });
    } finally {
      setIsSaving(false);
    }
  }

  function openComplete(record: MaintenanceRecord) {
    setCompletingRecord(record);
    setCompleteUsage(
      record.triggerType === 'usage'
        ? String(record.currentUsage ?? record.dueUsage ?? '')
        : record.currentUsage !== null
          ? String(record.currentUsage)
          : '',
    );
    setCompleteNotes('');
    setModalMode('complete');
  }

  async function submitComplete() {
    if (!completingRecord) return;
    setBusyCompleteId(completingRecord.id);
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/maintenance/${completingRecord.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedUsage: completeUsage, completedNotes: completeNotes }),
      });
      const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Maintenance record could not be marked done.');
      }

      applyPayload(payload);
      setNotice({ type: 'success', text: completingRecord.recurringEnabled ? 'Maintenance marked done and the next recurring record was created.' : 'Maintenance marked done.' });
      closeModal();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Maintenance record could not be marked done.' });
    } finally {
      setBusyCompleteId(null);
      setIsSaving(false);
    }
  }

  async function deleteRecord(record: MaintenanceRecord) {
    const confirmed = window.confirm(`Delete/cancel this ${typeLabel(record.maintenanceType).toLowerCase()} record for ${record.assetTitle}?`);
    if (!confirmed) return;

    setDeletingRecordId(record.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/maintenance/${record.id}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Maintenance record could not be deleted.');
      }

      applyPayload(payload);
      setNotice({ type: 'success', text: 'Maintenance record deleted.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Maintenance record could not be deleted.' });
    } finally {
      setDeletingRecordId(null);
    }
  }

  function openFilters() {
    setDraftFilters(activeFilters);
    setModalMode('filter');
  }

  function applyFilters() {
    setActiveFilters(draftFilters);
    setModalMode(null);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
    setModalMode(null);
  }

  function openDownload() {
    const defaultAssetId = activeFilters.assetId !== 'all' ? activeFilters.assetId : assets[0]?.id ?? 'all';
    setDownloadAssetId(defaultAssetId);
    setModalMode('download');
  }

  function downloadReport(scope: DownloadScope, format: 'pdf' | 'xlsx') {
    const assetId = scope === 'asset' ? downloadAssetId : undefined;
    const url = buildReportUrl(scope, format, activeFilters, assetId);

    if (format === 'xlsx') {
      window.location.href = url;
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={styles.page}>
      <AppHeader active="maintenance" />
      <main className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${notice.type === 'success' ? styles.noticeSuccess : styles.noticeError}`}>{notice.text}</div> : null}

        <section className={styles.pageTitleBlock}>
          <div>
            <h1>ASSET MAINTENANCE</h1>
          </div>
        </section>

        <section className={styles.invoiceToolbar} aria-label="Maintenance toolbar">
          <label className={styles.searchWrap}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assets, services, checkups, assigned managers or notes..."
            />
            {search ? (
              <button className={styles.clearSearchButton} type="button" onClick={() => setSearch('')} aria-label="Clear search">
                ×
              </button>
            ) : null}
          </label>
          <div className={styles.toolbarButtons}>
            <button className={`${styles.toolbarButton} ${styles.toolbarAddButton}`} type="button" onClick={openAddService}>
              <span className={styles.plusMark}>+</span>
              Add Service
            </button>
            <button className={`${styles.toolbarButton} ${styles.toolbarFilterButton}`} type="button" onClick={openFilters}>
              <FilterIcon />
              Filter
              {filtersCount ? <strong>{filtersCount}</strong> : null}
            </button>
            <button className={`${styles.toolbarButton} ${styles.primaryButton} ${styles.toolbarDownloadButton}`} type="button" onClick={openDownload}>
              <DownloadIcon />
              Download
            </button>
          </div>
        </section>

        <section className={styles.invoicePanel}>
          {isLoading ? (
            <div className={styles.emptyState}>Loading maintenance records...</div>
          ) : pagedRecords.length ? (
            <div className={styles.invoiceList}>
              {pagedRecords.map((record) => (
                <article
                  className={`${styles.invoiceRow} ${record.status === 'done' ? styles.maintenanceCardDone : styles.maintenanceCardOpen}`}
                  key={record.id}
                >
                  <div className={styles.invoiceHeader}>
                    <div className={styles.invoiceTitleBlock}>
                      <span
                        className={`${styles.maintenanceStatusPill} ${
                          record.status === 'done'
                            ? styles.maintenanceStatusGood
                            : record.computedStatus === 'overdue' || record.computedStatus === 'due'
                              ? styles.maintenanceStatusDanger
                              : ''
                        }`}
                      >
                        {statusLabel(record.computedStatus)}
                      </span>
                      <h2 className={styles.invoiceTitle}>{typeLabel(record.maintenanceType)}: {record.assetTitle}</h2>
                      <p className={styles.maintenanceMetaLine}>{record.assetMeta || `${record.assetCategoryLabel} • ${record.assetCondition}`}</p>
                    </div>
                    <div className={styles.invoiceHeaderAside}>
                      <strong className={styles.invoicePrice}>{record.triggerType === 'date' ? dateOnly(record.dueDate) : formatUsage(record.dueUsage, record.usageMetric ?? record.assetUsageMetric)}</strong>
                      <span className={styles.invoiceVatLabel}>{triggerLabel(record.triggerType)}</span>
                    </div>
                  </div>

                  <div className={styles.maintenanceDetailsGrid}>
                    <div className={styles.maintenanceDetail}>
                      <span>Current Usage</span>
                      <strong>{formatUsage(record.currentUsage, record.usageMetric ?? record.assetUsageMetric)}</strong>
                    </div>
                    <div className={styles.maintenanceDetail}>
                      <span>Alert Before</span>
                      <strong>{record.alertBeforeValue !== null && record.alertBeforeUnit ? `${numberText(record.alertBeforeValue)} ${intervalUnitLabel(record.alertBeforeUnit)}` : '-'}</strong>
                    </div>
                    <div className={styles.maintenanceDetail}>
                      <span>Recurring</span>
                      <strong>{record.recurringEnabled && record.recurringIntervalValue !== null && record.recurringIntervalUnit ? `Every ${numberText(record.recurringIntervalValue)} ${intervalUnitLabel(record.recurringIntervalUnit)}` : 'No'}</strong>
                    </div>
                    <div className={styles.maintenanceDetail}>
                      <span>Assigned To</span>
                      <strong>{record.assignedName || 'All / unassigned'}</strong>
                    </div>
                    <div className={styles.maintenanceDetail}>
                      <span>Updated</span>
                      <strong>{dateOnly(record.updatedAtIso)}</strong>
                    </div>
                    {record.status === 'done' ? (
                      <>
                        <div className={styles.maintenanceDetail}>
                          <span>Completed</span>
                          <strong>{dateOnly(record.completedAtIso)}</strong>
                        </div>
                        <div className={styles.maintenanceDetail}>
                          <span>Completed Usage</span>
                          <strong>{formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric)}</strong>
                        </div>
                        <div className={styles.maintenanceDetailWide}>
                          <span>Completed Notes</span>
                          <strong>{record.completedNotes || '-'}</strong>
                        </div>
                      </>
                    ) : null}
                    {record.notes ? (
                      <div className={styles.maintenanceDetailWide}>
                        <span>Notes</span>
                        <strong>{record.notes}</strong>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.rowActions}>
                    {record.status !== 'done' ? (
                      <button className={styles.secondaryButtonSmall} type="button" onClick={() => openEdit(record)}>
                        <EditIcon />
                        Edit
                      </button>
                    ) : null}
                    {record.status !== 'done' ? (
                      <button className={styles.secondaryButtonSmall} type="button" onClick={() => openComplete(record)} disabled={busyCompleteId === record.id}>
                        <CheckIcon />
                        Mark Done
                      </button>
                    ) : null}
                    <button className={styles.dangerButtonSmall} type="button" onClick={() => void deleteRecord(record)} disabled={deletingRecordId === record.id}>
                      <TrashIcon />
                      {record.status === 'done' ? 'Delete' : 'Cancel'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No maintenance records match the current view.</div>
          )}

          {filteredRecords.length > PAGE_SIZE ? (
            <div className={styles.paginationRow}>
              <button className={styles.paginationButton} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
                Previous
              </button>
              <span className={styles.paginationStatus}>Page {page} of {totalPages}</span>
              <button className={styles.paginationButton} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
                Next
              </button>
            </div>
          ) : null}
        </section>
      </main>

      {modalMode === 'asset-picker' ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
          <section className={`${styles.assetModal} ${styles.formModal}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="asset-picker-title">Choose asset for maintenance</h2>
                <p>Select the saved asset this service or checkup belongs to.</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close asset picker">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar}>
              <input value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder="Search assets..." />
              <button className={styles.secondaryButton} type="button" onClick={() => setPickerSearch('')}>Clear</button>
            </div>
            <div className={styles.assetList}>
              {filteredAssets.length ? (
                filteredAssets.map((asset) => (
                  <button key={asset.id} className={styles.assetRow} type="button" onClick={() => selectAsset(asset)}>
                    <span className={styles.assetInfo}>
                      <strong>{asset.title}</strong>
                      <small>{asset.meta}</small>
                    </span>
                    <span className={styles.assetValue}>
                      <strong>{money(asset.value)}</strong>
                      <small>current value</small>
                    </span>
                  </button>
                ))
              ) : (
                <div className={styles.emptyState}>No saved assets found.</div>
              )}
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'form' && draft ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-form-title">
          <section className={styles.formModal}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-form-title">{editingRecordId ? 'Edit maintenance' : 'Schedule maintenance'}</h2>
                <p>{selectedAssetLabel(selectedDraftAsset)}</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close maintenance form">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <div className={styles.maintenanceSectionTitle}>Maintenance type</div>
              <div className={styles.maintenanceToggleGrid}>
                {(['service', 'checkup'] as MaintenanceType[]).map((type) => (
                  <button
                    key={type}
                    className={`${styles.maintenanceToggleOption} ${draft.maintenanceType === type ? styles.maintenanceToggleActive : ''}`}
                    type="button"
                    onClick={() => updateDraft({ maintenanceType: type })}
                  >
                    <strong>{typeLabel(type)}</strong>
                    <span>{type === 'service' ? 'Scheduled maintenance, replacement parts, or service interval.' : 'Inspection, condition check, or preventative checkup.'}</span>
                  </button>
                ))}
              </div>

              <div className={styles.maintenanceSectionTitle}>Trigger type</div>
              <div className={styles.maintenanceToggleGrid}>
                {(['date', 'usage'] as TriggerType[]).map((trigger) => (
                  <button
                    key={trigger}
                    className={`${styles.maintenanceToggleOption} ${draft.triggerType === trigger ? styles.maintenanceToggleActive : ''}`}
                    type="button"
                    onClick={() => updateDraft({ triggerType: trigger })}
                  >
                    <strong>{triggerLabel(trigger)}</strong>
                    <span>{trigger === 'date' ? 'Due on a specific calendar date.' : `Due at a target ${usageUnitLabel(selectedDraftAsset?.usageMetric ?? draft.usageMetric)} reading.`}</span>
                  </button>
                ))}
              </div>

              <div className={styles.maintenanceSectionTitle}>{draft.triggerType === 'date' ? 'Specific Date setup' : 'Usage setup'}</div>
              <div className={styles.maintenanceFieldGrid}>
                {draft.triggerType === 'date' ? (
                  <>
                    <label className={styles.filterField}>
                      <span>Due date</span>
                      <input type="date" value={draft.dueDate} onChange={(event) => updateDraft({ dueDate: event.target.value })} />
                    </label>
                    <label className={styles.maintenanceCheckboxRow}>
                      <input type="checkbox" checked={draft.recurringEnabled} onChange={(event) => updateDraft({ recurringEnabled: event.target.checked })} />
                      Recurring
                    </label>
                    {draft.recurringEnabled ? (
                      <label className={styles.filterField}>
                        <span>Recurring interval</span>
                        <span className={styles.maintenanceInlineFields}>
                          <input type="number" min="1" step="1" value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                          <select value={draft.recurringIntervalUnit} onChange={(event) => updateDraft({ recurringIntervalUnit: event.target.value as DateIntervalUnit })}>
                            <option value="days">days</option>
                            <option value="weeks">weeks</option>
                            <option value="months">months</option>
                          </select>
                        </span>
                      </label>
                    ) : null}
                    <label className={styles.filterField}>
                      <span>Alert before</span>
                      <span className={styles.maintenanceInlineFields}>
                        <input type="number" min="0" step="1" value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                        <select value={draft.alertBeforeUnit} onChange={(event) => updateDraft({ alertBeforeUnit: event.target.value as DateIntervalUnit })}>
                          <option value="days">days</option>
                          <option value="weeks">weeks</option>
                          <option value="months">months</option>
                        </select>
                      </span>
                    </label>
                  </>
                ) : (
                  <>
                    <div className={styles.maintenanceCurrentUsage}>
                      <span>Current usage reading</span>
                      <strong>{formatUsage(selectedDraftAsset?.usageReading ?? null, selectedDraftAsset?.usageMetric ?? draft.usageMetric)}</strong>
                    </div>
                    <div className={styles.maintenanceCurrentUsage}>
                      <span>Usage metric</span>
                      <strong>{usageUnitLabel(selectedDraftAsset?.usageMetric ?? draft.usageMetric)}</strong>
                    </div>
                    <label className={styles.filterField}>
                      <span>Next {draft.maintenanceType} target</span>
                      <input type="number" min="0" step="0.01" value={draft.dueUsage} onChange={(event) => updateDraft({ dueUsage: event.target.value })} />
                    </label>
                    <label className={styles.maintenanceCheckboxRow}>
                      <input type="checkbox" checked={draft.recurringEnabled} onChange={(event) => updateDraft({ recurringEnabled: event.target.checked })} />
                      Recurring
                    </label>
                    {draft.recurringEnabled ? (
                      <label className={styles.filterField}>
                        <span>Recurring interval</span>
                        <span className={styles.maintenanceInlineFields}>
                          <input type="number" min="0" step="0.01" value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                          <select value={draft.usageMetric} disabled>
                            <option value={draft.usageMetric}>{usageUnitLabel(draft.usageMetric)}</option>
                          </select>
                        </span>
                      </label>
                    ) : null}
                    <label className={styles.filterField}>
                      <span>Alert before</span>
                      <span className={styles.maintenanceInlineFields}>
                        <input type="number" min="0" step="0.01" value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                        <select value={draft.usageMetric} disabled>
                          <option value={draft.usageMetric}>{usageUnitLabel(draft.usageMetric)}</option>
                        </select>
                      </span>
                    </label>
                  </>
                )}

                <label className={styles.filterField}>
                  <span>Assigned to</span>
                  <select value={draft.assignedFieldManagerId} onChange={(event) => updateDraft({ assignedFieldManagerId: event.target.value })}>
                    <option value="unassigned">All / unassigned</option>
                    {fieldManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                    ))}
                  </select>
                </label>

                <label className={`${styles.filterField} ${styles.maintenanceFieldFull}`}>
                  <span>Notes</span>
                  <textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Add service/checkup notes, supplier detail or internal reminders..." />
                </label>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
              <button className={styles.primaryButton} type="button" onClick={() => void submitDraft()} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingRecordId ? 'Save changes' : 'Add service'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'filter' ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-filter-title">
          <section className={styles.filterModal}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-filter-title">Filter maintenance records</h2>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close filters">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.filterGrid}>
              <label className={styles.filterField}>
                <span>Asset</span>
                <select value={draftFilters.assetId} onChange={(event) => setDraftFilters((current) => ({ ...current, assetId: event.target.value }))}>
                  <option value="all">All saved assets</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.title}</option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Type</span>
                <select value={draftFilters.type} onChange={(event) => setDraftFilters((current) => ({ ...current, type: event.target.value as MaintenanceFilters['type'] }))}>
                  <option value="all">All</option>
                  <option value="service">Service</option>
                  <option value="checkup">Checkup</option>
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Status</span>
                <select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value as MaintenanceFilters['status'] }))}>
                  <option value="all">All</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Assigned to</span>
                <select value={draftFilters.assignedTo} onChange={(event) => setDraftFilters((current) => ({ ...current, assignedTo: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="unassigned">Unassigned</option>
                  {fieldManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                  ))}
                </select>
              </label>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Close</button>
              <button className={styles.secondaryButton} type="button" onClick={clearFilters}>Clear filters</button>
              <button className={styles.primaryButton} type="button" onClick={applyFilters}>Apply filters</button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'download' ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-download-title">
          <section className={styles.downloadModal}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-download-title">Download maintenance reports</h2>
                <p>Export total, asset-specific, upcoming or done maintenance records.</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close download reports">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <div className={styles.maintenanceFieldGrid}>
                <label className={`${styles.filterField} ${styles.maintenanceFieldFull}`}>
                  <span>Specific asset report asset</span>
                  <select value={downloadAssetId} onChange={(event) => setDownloadAssetId(event.target.value)}>
                    <option value="all">Select asset...</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.title}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.maintenanceSectionTitle}>Report options</div>
              <div className={styles.maintenanceDownloadGrid}>
                {([
                  ['total', 'Total maintenance report', 'All maintenance records matching the current filters.'],
                  ['asset', 'Specific asset maintenance report', 'Full maintenance timeline for one saved asset.'],
                  ['upcoming', 'Upcoming maintenance report', 'Open records including due soon, due and overdue.'],
                  ['done', 'Done maintenance report', 'Completed services and checkups.'],
                ] as Array<[DownloadScope, string, string]>).map(([scope, title, description]) => (
                  <div key={scope} className={styles.maintenanceDownloadCard}>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    <div className={styles.maintenanceDownloadActions}>
                      <button className={styles.secondaryButtonSmall} type="button" onClick={() => downloadReport(scope, 'pdf')} disabled={scope === 'asset' && downloadAssetId === 'all'}>
                        PDF
                      </button>
                      <button className={styles.secondaryButtonSmall} type="button" onClick={() => downloadReport(scope, 'xlsx')} disabled={scope === 'asset' && downloadAssetId === 'all'}>
                        Excel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Close</button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'complete' && completingRecord ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-complete-title">
          <section className={styles.filterModal}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-complete-title">Mark maintenance done</h2>
                <p>{typeLabel(completingRecord.maintenanceType)} for {completingRecord.assetTitle}</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close completion form">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.filterGrid}>
              <div className={`${styles.maintenanceCompleteBox} ${styles.maintenanceFieldFull}`}>
                <strong>Due: {completingRecord.triggerType === 'date' ? dateOnly(completingRecord.dueDate) : formatUsage(completingRecord.dueUsage, completingRecord.usageMetric ?? completingRecord.assetUsageMetric)}</strong>
                <span>Current: {formatUsage(completingRecord.currentUsage, completingRecord.usageMetric ?? completingRecord.assetUsageMetric)}</span>
              </div>
              <label className={styles.filterField}>
                <span>Completed usage</span>
                <input type="number" min="0" step="0.01" value={completeUsage} onChange={(event) => setCompleteUsage(event.target.value)} placeholder="Optional" />
              </label>
              <label className={`${styles.filterField} ${styles.maintenanceFieldFull}`}>
                <span>Completed notes</span>
                <textarea value={completeNotes} onChange={(event) => setCompleteNotes(event.target.value)} placeholder="Optional notes about the service/checkup completed..." />
              </label>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
              <button className={styles.primaryButton} type="button" onClick={() => void submitComplete()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Mark done'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
