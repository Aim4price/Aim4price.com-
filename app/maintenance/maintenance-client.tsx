'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import DesktopServiceModal, { type DesktopServiceCompletion } from '../../components/DesktopServiceModal';
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
  generatedFromMaintenanceId: string | null;
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
  nextRecord?: MaintenanceRecord | null;
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

type ModalMode = 'asset-picker' | 'maintenance-type' | 'trigger-type' | 'form' | 'filter' | 'download' | 'complete' | 'quick-clear' | 'delete' | null;
type QuickClearStep = 'confirm' | 'completion';

type DownloadScope = 'total' | 'asset' | 'upcoming' | 'done';
type DownloadFormat = 'pdf' | 'xlsx';

type DropdownOption = {
  value: string;
  label: string;
};

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


function MaintenanceReportScopeIcon({ scope }: { scope: DownloadScope }) {
  if (scope === 'asset') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2c-4.5 0-8 2.2-8 5v1h16v-1c0-2.8-3.5-5-8-5Z" />
      </svg>
    );
  }
  if (scope === 'upcoming') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9Zm-7 1.5a1 1 0 0 1 1 1v2.1l1.35.8a1 1 0 1 1-1 1.72l-1.85-1.08A1 1 0 0 1 11 15v-2.5a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }
  if (scope === 'done') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.4 5.6a1 1 0 0 1-1.43.01l-2.58-2.5a1 1 0 1 1 1.4-1.43l1.86 1.8 4.71-4.88a1 1 0 1 1 1.44 1.4Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M5 3h10a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 6v10h10V9H9Zm2 3h6v1.75h-6V12Zm0 3.25h4.5V17H11v-1.75ZM5 5v10h2V9a2 2 0 0 1 2-2h6V5H5Z" />
    </svg>
  );
}

function SelectedTickIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M9.2 16.6 4.9 12.3a1 1 0 1 1 1.4-1.4l2.9 2.9 8.5-8.5a1 1 0 0 1 1.4 1.4l-9.2 9.9a1 1 0 0 1-1.4 0Z" />
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

function ServiceGearIcon() {
  return (
    <svg className={styles.maintenanceChoiceSvg} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a8.2 8.2 0 0 0-1.7-1L15 3.3h-4L10.6 6a8.2 8.2 0 0 0-1.7 1L6.4 6 4.4 9.4 6.5 11a7.7 7.7 0 0 0-.1 1c0 .3 0 .7.1 1l-2.1 1.6 2 3.4 2.5-1a8.2 8.2 0 0 0 1.7 1l.4 2.7h4l.4-2.7a8.2 8.2 0 0 0 1.7-1l2.5 1 2-3.4-2.2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
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

function ChevronDownIcon({ className }: { className?: string } = {}) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
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
  return value === 'date' ? 'Specific date' : 'Usage';
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
  if (metric === 'percentage') return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}%`;
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} ${usageUnitLabel(metric)}`;
}

function formatAssetUsage(value: number | null | undefined, metric: UsageMetric | string | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (metric !== 'percentage' && value <= 0) return '';
  return formatUsage(value, metric);
}

function assetYearLabelFromCategory(categoryLabel: string | null | undefined): string {
  const category = String(categoryLabel ?? '').toLowerCase();
  return category.includes('property') || category.includes('building') ? 'Year Built' : 'Year Model';
}

function buildMaintenanceAssetMeta(record: MaintenanceRecord): string {
  const usageLabel = formatAssetUsage(record.assetUsageReading, record.assetUsageMetric);
  const familyLabel = record.assetCategoryLabel || titleCase(record.assetKind || 'asset');
  const details = [
    typeof record.assetYearModel === 'number' && Number.isFinite(record.assetYearModel) && record.assetYearModel > 0
      ? `${assetYearLabelFromCategory(record.assetCategoryLabel)}: ${record.assetYearModel}`
      : '',
    usageLabel ? `Usage: ${usageLabel}` : '',
    record.assetCondition ? `Condition: ${record.assetCondition}` : '',
    familyLabel ? `Family: ${familyLabel}` : '',
  ].filter(Boolean);

  return details.length ? details.join(' • ') : record.assetMeta || record.assetTitle;
}

function maintenanceDueValue(record: MaintenanceRecord): string {
  if (record.triggerType === 'date') return dateOnly(record.dueDate);
  return formatUsage(record.dueUsage, record.usageMetric ?? record.assetUsageMetric);
}

function maintenanceDueCaption(record: MaintenanceRecord): string {
  return record.triggerType === 'date' ? 'Due Date' : 'Due Usage';
}

function maintenanceCardValue(record: MaintenanceRecord): string {
  if (record.status !== 'done') return maintenanceDueValue(record);
  if (record.triggerType === 'date') return dateOnly(record.completedAtIso);
  return record.completedUsage === null
    ? 'Reading not recorded'
    : formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric);
}

function maintenanceCardCaption(record: MaintenanceRecord): string {
  if (record.status !== 'done') return maintenanceDueCaption(record);
  return record.triggerType === 'date' ? 'Completed On' : 'Completed At';
}

function arrangeMaintenanceTimeline(records: MaintenanceRecord[]): MaintenanceRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const added = new Set<string>();
  const arranged: MaintenanceRecord[] = [];

  records.forEach((record) => {
    if (added.has(record.id)) return;

    arranged.push(record);
    added.add(record.id);

    if (record.generatedFromMaintenanceId) {
      const completedParent = byId.get(record.generatedFromMaintenanceId);
      if (completedParent && completedParent.status === 'done' && !added.has(completedParent.id)) {
        arranged.push(completedParent);
        added.add(completedParent.id);
      }
    }
  });

  return arranged;
}

function maintenanceAlertLabel(record: MaintenanceRecord): string {
  if (record.alertBeforeValue !== null && record.alertBeforeUnit) {
    return `Alert before ${numberText(record.alertBeforeValue)} ${intervalUnitLabel(record.alertBeforeUnit)}`;
  }

  return 'Alert before -';
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

function buildCompletionUrl(recordId: string, filters: MaintenanceFilters): string {
  const listUrl = buildListUrl(filters);
  const queryIndex = listUrl.indexOf('?');
  const query = queryIndex >= 0 ? listUrl.slice(queryIndex) : '';
  return `/api/maintenance/${recordId}/complete${query}`;
}

function buildReportUrl(scope: DownloadScope, format: 'pdf' | 'xlsx', filters: MaintenanceFilters, assetId?: string): string {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('format', format);
  const resolvedAssetId = scope === 'asset' ? assetId || filters.assetId : filters.assetId;
  if (resolvedAssetId && resolvedAssetId !== 'all') params.set('assetId', resolvedAssetId);
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.assignedTo !== 'all') params.set('assignedTo', filters.assignedTo);
  // Total, asset, upcoming and completed reports have explicit scope semantics.
  // Do not let the current page status filter silently remove completed history.
  if (scope === 'upcoming') params.set('status', 'upcoming');
  if (scope === 'done') params.set('status', 'done');
  return `/api/maintenance/report?${params.toString()}`;
}


const DATE_UNIT_OPTIONS: DropdownOption[] = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
];

const FILTER_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'all', label: 'All types' },
  { value: 'service', label: 'Service' },
  { value: 'checkup', label: 'Checkup' },
];

const FILTER_STATUS_OPTIONS: DropdownOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done', label: 'Done' },
];

const DOWNLOAD_FORMAT_OPTIONS: Array<{ value: DownloadFormat; title: string; description: string }> = [
  { value: 'pdf', title: 'PDF report', description: 'Clean print-ready report for clients, banks or insurance partners.' },
  { value: 'xlsx', title: 'XLSX workbook', description: 'Excel-ready maintenance data for sorting, filtering and record keeping.' },
];

const DOWNLOAD_SCOPE_OPTIONS: Array<{ value: DownloadScope; title: string; description: string }> = [
  { value: 'total', title: 'Total maintenance report', description: 'All open and completed maintenance matching the selected asset and type filters.' },
  { value: 'asset', title: 'Specific asset maintenance report', description: 'Full maintenance timeline for one saved asset.' },
  { value: 'upcoming', title: 'Upcoming maintenance report', description: 'Open maintenance records, including due soon and overdue items.' },
  { value: 'done', title: 'Completed maintenance report', description: 'Every completed service and checkup retained in maintenance history.' },
];

type MaintenanceDropdownProps = {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  noMatchesLabel?: string;
};

function MaintenanceDropdown({
  label,
  value,
  options,
  onChange,
  className = '',
  disabled = false,
  hideLabel = false,
  searchable = false,
  searchPlaceholder = 'Search options',
  noMatchesLabel = 'No options found',
}: MaintenanceDropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleOptions = searchable && normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (rootRef.current && target instanceof Node && !rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  const fieldClassName = hideLabel ? styles.dropdownOnlyField : styles.filterField;

  return (
    <div className={`${fieldClassName} ${className}`.trim()}>
      {hideLabel ? null : <span>{label}</span>}
      <div
        ref={rootRef}
        className={`${styles.customFilterSelect} ${isOpen ? styles.customFilterSelectOpen : ''} ${disabled ? styles.customFilterSelectDisabled : ''}`}
      >
        <button
          type="button"
          className={`${styles.customFilterSelectButton} ${isOpen ? styles.customFilterSelectButtonOpen : ''}`}
          onClick={() => setIsOpen((open) => !open)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label}
        >
          <span className={styles.customFilterSelectButtonText}>{selectedOption?.label ?? 'Choose option'}</span>
          <ChevronDownIcon className={styles.customFilterSelectChevron} />
        </button>

        {isOpen ? (
          <div className={styles.customFilterSelectMenu} role="listbox" aria-label={label}>
            {searchable ? (
              <div className={styles.customFilterSearchRow}>
                <input
                  type="search"
                  className={styles.customFilterSearchInput}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                />
              </div>
            ) : null}

            {visibleOptions.length ? (
              visibleOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={`${label}-${option.value}`}
                    type="button"
                    className={`${styles.customFilterSelectOption} ${isSelected ? styles.customFilterSelectOptionActive : ''}`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className={styles.customFilterSelectOptionLabel}>{option.label}</span>
                  </button>
                );
              })
            ) : (
              <div className={`${styles.customFilterSelectOption} ${styles.customFilterSelectEmptyOption}`} role="option" aria-disabled="true">
                <span className={styles.customFilterSelectOptionLabel}>{noMatchesLabel}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      className={`${styles.switchField} ${checked ? styles.switchFieldActive : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchTrack}><span /></span>
      <strong>{label}</strong>
    </button>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.maintenanceCurrentUsage}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
  const [recordPendingDelete, setRecordPendingDelete] = useState<MaintenanceRecord | null>(null);
  const [recordPendingComplete, setRecordPendingComplete] = useState<MaintenanceRecord | null>(null);
  const [recordPendingQuickClear, setRecordPendingQuickClear] = useState<MaintenanceRecord | null>(null);
  const [quickClearStep, setQuickClearStep] = useState<QuickClearStep>('confirm');
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [busyCompleteId, setBusyCompleteId] = useState<string | null>(null);
  const completeRequestInFlight = useRef(false);
  const [downloadAssetId, setDownloadAssetId] = useState('all');
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('pdf');
  const [downloadScope, setDownloadScope] = useState<DownloadScope>('total');
  const [downloadStep, setDownloadStep] = useState<'scope' | 'asset' | 'format'>('scope');
  const [downloadAssetSearch, setDownloadAssetSearch] = useState('');
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
    async (filters = activeFilters, options: { silent?: boolean } = {}) => {
      const silent = options.silent === true;
      if (!silent) setIsLoading(true);
      try {
        const response = await fetch(buildListUrl(filters), { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || 'Maintenance data could not be loaded.');
        }

        applyPayload(payload);
      } catch (error) {
        if (!silent) {
          setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Maintenance data could not be loaded.' });
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [activeFilters, applyPayload],
  );

  useEffect(() => {
    void loadData(activeFilters);
  }, [activeFilters, loadData]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void loadData(activeFilters, { silent: true });
      }
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activeFilters, loadData]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchingRecords = query
      ? records.filter((record) => recordSearchText(record).includes(query))
      : records;
    return arrangeMaintenanceTimeline(matchingRecords);
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersCount = activeFilterCount(activeFilters);

  useEffect(() => {
    setPage(1);
  }, [search, activeFilters]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const filteredAssets = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => [asset.title, asset.meta, asset.kind, asset.categoryLabel].join(' ').toLowerCase().includes(query));
  }, [assets, pickerSearch]);

  const filterAssetOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'all', label: 'All saved assets' },
      ...assets.map((asset) => ({ value: asset.id, label: asset.title })),
    ],
    [assets],
  );

  const filteredDownloadAssets = useMemo(() => {
    const query = downloadAssetSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => [asset.title, asset.meta, asset.kind, asset.categoryLabel].join(' ').toLowerCase().includes(query));
  }, [assets, downloadAssetSearch]);

  const filterAssigneeOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'all', label: 'All assignees' },
      { value: 'unassigned', label: 'Unassigned' },
      ...fieldManagers.map((manager) => ({ value: manager.id, label: manager.displayName })),
    ],
    [fieldManagers],
  );

  const formAssigneeOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'unassigned', label: 'Unassigned' },
      ...fieldManagers.map((manager) => ({ value: manager.id, label: manager.displayName })),
    ],
    [fieldManagers],
  );

  function closeModal() {
    setModalMode(null);
    setPickerSearch('');
    setEditingRecordId(null);
    setRecordPendingDelete(null);
    setRecordPendingComplete(null);
    setRecordPendingQuickClear(null);
    setQuickClearStep('confirm');
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
    setModalMode('maintenance-type');
  }

  function chooseMaintenanceType(type: MaintenanceType) {
    updateDraft({ maintenanceType: type });
    setModalMode('trigger-type');
  }

  function chooseTriggerType(triggerType: TriggerType) {
    updateDraft({ triggerType });
    setModalMode('form');
  }

  function returnToAssetPicker() {
    setDraft(null);
    setPickerSearch('');
    setModalMode('asset-picker');
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
    setNotice(null);
    setRecordPendingComplete(record);
    setModalMode('complete');
  }

  function openQuickClear(record: MaintenanceRecord) {
    setNotice(null);
    setRecordPendingQuickClear(record);
    setQuickClearStep('confirm');
    setModalMode('quick-clear');
  }

  async function completeMaintenance(record: MaintenanceRecord, completion: DesktopServiceCompletion) {
    if (completeRequestInFlight.current) return;

    completeRequestInFlight.current = true;
    setBusyCompleteId(record.id);
    setNotice(null);

    try {
      const response = await fetch(buildCompletionUrl(record.id, activeFilters), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
          ...completion,
          confirmedComplete: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Maintenance record could not be marked done.');
      }

      applyPayload(payload);
      setNotice({
        type: 'success',
        text: completion.linkToScheduledMaintenance === false
          ? 'Maintenance saved. The scheduled maintenance remains open.'
          : record.recurringEnabled && payload.nextRecord
          ? `Maintenance marked done. Next recurring maintenance is due at ${maintenanceDueValue(payload.nextRecord)}.`
          : 'Maintenance marked done.',
      });
      closeModal();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Maintenance record could not be marked done.',
      });
    } finally {
      completeRequestInFlight.current = false;
      setBusyCompleteId(null);
    }
  }

  async function quickCompleteMaintenance(record: MaintenanceRecord) {
    if (completeRequestInFlight.current) return;

    completeRequestInFlight.current = true;
    setBusyCompleteId(record.id);
    setNotice(null);

    try {
      const response = await fetch(buildCompletionUrl(record.id, activeFilters), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
          confirmedComplete: true,
          quickComplete: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Maintenance could not be cleared.');
      }

      applyPayload(payload);
      setNotice({
        type: 'success',
        text: record.recurringEnabled && payload.nextRecord
          ? `Maintenance marked done with no additional information. The next recurring maintenance is due at ${maintenanceDueValue(payload.nextRecord)}.`
          : 'Maintenance marked done with no additional information.',
      });
      closeModal();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Maintenance could not be cleared.',
      });
    } finally {
      completeRequestInFlight.current = false;
      setBusyCompleteId(null);
    }
  }

  function openDelete(record: MaintenanceRecord) {
    setNotice(null);
    setRecordPendingDelete(record);
    setModalMode('delete');
  }

  async function deleteRecord() {
    if (!recordPendingDelete) return;
    const record = recordPendingDelete;

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
      closeModal();
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
    const defaultAssetId = activeFilters.assetId !== 'all' ? activeFilters.assetId : 'all';
    setDownloadAssetId(defaultAssetId);
    setDownloadFormat('pdf');
    setDownloadScope('total');
    setDownloadStep('scope');
    setDownloadAssetSearch('');
    setModalMode('download');
  }

  function downloadReport(scope: DownloadScope, format: DownloadFormat) {
    const assetId = scope === 'asset' ? downloadAssetId : undefined;
    const url = buildReportUrl(scope, format, activeFilters, assetId);

    if (format === 'xlsx') {
      window.location.href = url;
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function submitDownload() {
    if (downloadScope === 'asset' && downloadAssetId === 'all') {
      setNotice({ type: 'error', text: 'Choose a saved asset before downloading a specific asset maintenance report.' });
      return;
    }

    downloadReport(downloadScope, downloadFormat);
  }

  return (
    <div className={styles.page}>
      <AppHeader active="maintenance" />
      <main className={styles.shell}>
        {notice ? (
          <div
            className={`${styles.notice} ${notice.type === 'success' ? styles.noticeSuccess : styles.noticeError}`}
            role={notice.type === 'error' ? 'alert' : 'status'}
            aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
          >
            {notice.text}
          </div>
        ) : null}

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
              aria-label="Search maintenance records"
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
              {pagedRecords.map((record) => {
                const isDone = record.status === 'done';
                const isRecurringFollowUp = Boolean(record.generatedFromMaintenanceId);
                const isUpcomingRecurringFollowUp = isRecurringFollowUp && !isDone;
                const needsAttention = !isDone && (record.computedStatus === 'due' || record.computedStatus === 'overdue');
                const isDueSoon = !isDone && record.computedStatus === 'due_soon';
                const cardStatusClass = isDone
                  ? styles.maintenanceCardDone
                  : needsAttention
                    ? styles.maintenanceCardOpen
                    : isDueSoon
                      ? styles.maintenanceCardDueSoon
                      : styles.maintenanceCardUpcoming;
                const statusPillClass = isDone
                  ? styles.maintenanceStatusGood
                  : needsAttention
                    ? styles.maintenanceStatusDanger
                    : isDueSoon || isRecurringFollowUp
                      ? styles.maintenanceStatusWarning
                      : styles.maintenanceStatusNeutral;
                const statusText = isDone
                  ? 'Maintenance completed'
                  : isRecurringFollowUp
                    ? `Next recurring maintenance · ${record.computedStatusLabel}`
                    : record.computedStatusLabel || 'Maintenance upcoming';

                return (
                  <article
                    className={`${styles.invoiceRow} ${cardStatusClass} ${isUpcomingRecurringFollowUp && !needsAttention ? styles.maintenanceRecurringFollowUp : ''}`}
                    key={record.id}
                  >
                    <div className={styles.invoiceHeader}>
                      <div className={styles.invoiceTitleBlock}>
                        <span
                          className={`${styles.maintenanceStatusPill} ${statusPillClass}`}
                        >
                          {statusText}
                        </span>
                        <h2 className={styles.invoiceTitle} title={record.assetTitle}>{record.assetTitle}</h2>
                        <p className={styles.maintenanceServiceTitle}>
                          {record.title || (record.maintenanceType === 'checkup' ? 'Maintenance checkup' : 'Maintenance service')}
                        </p>
                        <p className={styles.invoiceAsset}>{buildMaintenanceAssetMeta(record)}</p>
                        <div className={styles.invoiceMetaList}>
                          <span className={styles.invoiceValueMethodLabel}>Assigned to {record.assignedName || 'Unassigned'}</span>
                          <span className={styles.invoiceSavedDateLabel}>{maintenanceAlertLabel(record)}</span>
                          <span className={styles.invoiceSavedDateLabel}>
                            {isDone ? `Completed ${dateOnly(record.completedAtIso || record.updatedAtIso)}` : `Updated ${dateOnly(record.updatedAtIso)}`}
                          </span>
                          {isDone && maintenanceDueValue(record) ? (
                            <span className={styles.invoiceSavedDateLabel}>Scheduled for {maintenanceDueValue(record)}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.invoiceHeaderAside}>
                        <div className={styles.invoiceValueBlock}>
                          <strong className={styles.invoicePrice}>{maintenanceCardValue(record)}</strong>
                          <span className={styles.invoiceVatLabel}>{maintenanceCardCaption(record)}</span>
                        </div>

                        <div className={`${styles.rowActions} ${!isDone ? styles.rowActionsFour : ''}`}>
                          <button
                            className={`${styles.secondaryButtonSmall} ${styles.invoiceOpenButton} ${isDone ? styles.invoiceCompletedButton : ''}`}
                            type="button"
                            onClick={() => {
                              if (!isDone) openComplete(record);
                            }}
                            disabled={isDone || busyCompleteId !== null}
                            aria-pressed={isDone}
                            aria-label={isDone ? `${record.assetTitle} maintenance completed` : `Record ${record.maintenanceType} for ${record.assetTitle}`}
                          >
                            <CheckIcon />
                            <span>{busyCompleteId === record.id ? 'Saving...' : isDone ? 'Done' : record.maintenanceType === 'checkup' ? 'Record check-up' : 'Record service'}</span>
                          </button>
                          {!isDone ? (
                            <button
                              className={`${styles.secondaryButtonSmall} ${styles.maintenanceQuickClearButton}`}
                              type="button"
                              onClick={() => openQuickClear(record)}
                              disabled={busyCompleteId !== null}
                              aria-label={`Clear ${record.maintenanceType} for ${record.assetTitle}`}
                            >
                              <CheckIcon />
                              <span>Clear</span>
                            </button>
                          ) : null}
                          <button className={`${styles.secondaryButtonSmall} ${styles.invoiceEditButton}`} type="button" onClick={() => openEdit(record)}>
                            <EditIcon />
                            <span>Edit</span>
                          </button>
                          <button
                            className={`${styles.dangerButtonSmall} ${styles.invoiceDeleteButton}`}
                            type="button"
                            onClick={() => openDelete(record)}
                            disabled={deletingRecordId === record.id}
                          >
                            <TrashIcon />
                            <span>{deletingRecordId === record.id ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>No maintenance records match the current view.</div>
          )}

          {filteredRecords.length > PAGE_SIZE ? (
            <nav className={styles.paginationRow} aria-label="Maintenance record pages">
              <button className={styles.paginationButton} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
                Previous
              </button>
              <span className={styles.paginationStatus} aria-live="polite">Page {page} of {totalPages}</span>
              <button className={styles.paginationButton} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
                Next
              </button>
            </nav>
          ) : null}
        </section>
      </main>

      {modalMode === 'asset-picker' ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
          <section className={styles.assetModal}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="asset-picker-title">Choose asset for maintenance</h2>
                <p>Choose a saved asset.</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close asset picker">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar}>
              <label className={styles.pickerSearchField}>
                <SearchIcon />
                <input
                  type="search"
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder="Search saved assets..."
                  aria-label="Search saved assets"
                />
              </label>
              <button className={`${styles.secondaryButton} ${styles.pickerClearButton}`} type="button" onClick={() => setPickerSearch('')} disabled={!pickerSearch}>Clear</button>
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


      {modalMode === 'maintenance-type' && draft ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-type-title">
          <section className={`${styles.formModal} ${styles.maintenanceStepModal}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-type-title">What are you scheduling?</h2>
                <p>{selectedAssetLabel(selectedDraftAsset)}</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close maintenance type selection">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.maintenanceChoiceBody}>
              <div className={styles.maintenanceChoiceGrid}>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => chooseMaintenanceType('service')}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true"><ServiceGearIcon /></span>
                  <strong>Service</strong>
                  <small>Routine servicing or repairs.</small>
                </button>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => chooseMaintenanceType('checkup')}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true">✓</span>
                  <strong>Checkup</strong>
                  <small>Inspection or condition check.</small>
                </button>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={returnToAssetPicker}>Back</button>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'trigger-type' && draft ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-trigger-title">
          <section className={`${styles.formModal} ${styles.maintenanceStepModal}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-trigger-title">When should it be due?</h2>
                <p>{typeLabel(draft.maintenanceType)} · {selectedAssetLabel(selectedDraftAsset)}</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close maintenance trigger selection">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.maintenanceChoiceBody}>
              <div className={styles.maintenanceChoiceGrid}>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => chooseTriggerType('date')}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true">31</span>
                  <strong>Specific date</strong>
                  <small>Choose a due date.</small>
                </button>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => chooseTriggerType('usage')}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true">↗</span>
                  <strong>Usage</strong>
                  <small>Choose a target {usageUnitLabel(selectedDraftAsset?.usageMetric ?? draft.usageMetric)} reading.</small>
                </button>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={() => setModalMode('maintenance-type')}>Back</button>
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
                <h2 id="maintenance-form-title">{`Schedule ${draft.maintenanceType}`}</h2>
                <p>{`${triggerLabel(draft.triggerType)} · ${selectedAssetLabel(selectedDraftAsset)}`}</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close maintenance form">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <div className={styles.maintenanceSectionTitle}>{draft.triggerType === 'date' ? 'Specific date setup' : 'Usage setup'}</div>
              <div className={styles.maintenanceFieldGrid}>
                {draft.triggerType === 'date' ? (
                  <>
                    <label className={styles.filterField}>
                      <span>Due date</span>
                      <input type="date" value={draft.dueDate} onChange={(event) => updateDraft({ dueDate: event.target.value })} />
                    </label>

                    <label className={styles.filterField}>
                      <span>Alert before</span>
                      <div className={styles.maintenanceInlineFields}>
                        <input type="number" min="0" step="1" value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                        <MaintenanceDropdown
                          label="Alert unit"
                          hideLabel
                          value={draft.alertBeforeUnit}
                          options={DATE_UNIT_OPTIONS}
                          onChange={(value) => updateDraft({ alertBeforeUnit: value as DateIntervalUnit })}
                        />
                      </div>
                    </label>

                    <SwitchField label="Recurring" checked={draft.recurringEnabled} onChange={(checked) => updateDraft({ recurringEnabled: checked })} />

                    {draft.recurringEnabled ? (
                      <label className={styles.filterField}>
                        <span>Recurring interval</span>
                        <div className={styles.maintenanceInlineFields}>
                          <input type="number" min="1" step="1" value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                          <MaintenanceDropdown
                            label="Recurring unit"
                            hideLabel
                            value={draft.recurringIntervalUnit}
                            options={DATE_UNIT_OPTIONS}
                            onChange={(value) => updateDraft({ recurringIntervalUnit: value as DateIntervalUnit })}
                          />
                        </div>
                      </label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <ReadOnlyField label="Current usage" value={formatUsage(selectedDraftAsset?.usageReading ?? null, selectedDraftAsset?.usageMetric ?? draft.usageMetric)} />
                    <ReadOnlyField label="Usage metric" value={usageUnitLabel(selectedDraftAsset?.usageMetric ?? draft.usageMetric)} />

                    <label className={styles.filterField}>
                      <span>Due usage</span>
                      <input type="number" min="0" step="0.01" value={draft.dueUsage} onChange={(event) => updateDraft({ dueUsage: event.target.value })} />
                    </label>

                    <label className={styles.filterField}>
                      <span>Alert before</span>
                      <div className={styles.maintenanceInlineFields}>
                        <input type="number" min="0" step="0.01" value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                        <ReadOnlyField label="Unit" value={usageUnitLabel(selectedDraftAsset?.usageMetric ?? draft.usageMetric)} />
                      </div>
                    </label>

                    <SwitchField label="Recurring" checked={draft.recurringEnabled} onChange={(checked) => updateDraft({ recurringEnabled: checked })} />

                    {draft.recurringEnabled ? (
                      <label className={styles.filterField}>
                        <span>Recurring interval</span>
                        <div className={styles.maintenanceInlineFields}>
                          <input type="number" min="0" step="0.01" value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                          <ReadOnlyField label="Unit" value={usageUnitLabel(selectedDraftAsset?.usageMetric ?? draft.usageMetric)} />
                        </div>
                      </label>
                    ) : null}
                  </>
                )}

                <MaintenanceDropdown
                  label="Assigned to"
                  value={draft.assignedFieldManagerId}
                  options={formAssigneeOptions}
                  onChange={(value) => updateDraft({ assignedFieldManagerId: value })}
                />

                <label className={`${styles.filterField} ${styles.maintenanceFieldFull}`}>
                  <span>Notes</span>
                  <textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Add service/checkup notes, supplier detail or internal reminders..." />
                </label>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              {!editingRecordId ? <button className={styles.secondaryButton} type="button" onClick={() => setModalMode('trigger-type')}>Back</button> : null}
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
              <button className={styles.primaryButton} type="button" onClick={() => void submitDraft()} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingRecordId ? 'Save changes' : `Add ${draft.maintenanceType}`}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'quick-clear' && recordPendingQuickClear ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-quick-clear-title" aria-describedby="maintenance-quick-clear-description">
          <section className={`${styles.deleteConfirmModal} ${styles.maintenanceQuickClearModal}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-quick-clear-title">
                  {quickClearStep === 'confirm' ? 'Clear maintenance?' : 'Was it completed?'}
                </h2>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={closeModal}
                disabled={busyCompleteId === recordPendingQuickClear.id}
                aria-label="Close maintenance clear confirmation"
              >
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.deleteConfirmBody}>
              {quickClearStep === 'confirm' ? (
                <p id="maintenance-quick-clear-description">
                  Clear this {typeLabel(recordPendingQuickClear.maintenanceType).toLowerCase()} for <strong>{recordPendingQuickClear.assetTitle}</strong>?
                </p>
              ) : (
                <>
                  <p id="maintenance-quick-clear-description">
                    Only choose <strong>Yes</strong> if this {typeLabel(recordPendingQuickClear.maintenanceType).toLowerCase()} was completed.
                  </p>
                  <p className={styles.maintenanceQuickClearNote}>
                    Yes saves a basic completed record. <strong>Not sure</strong> leaves it open.
                  </p>
                </>
              )}
              <div className={styles.deleteRecordSummary}>
                <span>Selected maintenance</span>
                <strong>{recordPendingQuickClear.assetTitle}</strong>
                <small>{typeLabel(recordPendingQuickClear.maintenanceType)} · {maintenanceDueValue(recordPendingQuickClear)} · {recordPendingQuickClear.assignedName || 'Unassigned'}</small>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              {quickClearStep === 'confirm' ? (
                <>
                  <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
                  <button className={styles.primaryButton} type="button" onClick={() => setQuickClearStep('completion')}>Continue</button>
                </>
              ) : (
                <>
                  <button className={styles.secondaryButton} type="button" onClick={closeModal} disabled={busyCompleteId === recordPendingQuickClear.id}>Not sure</button>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => void quickCompleteMaintenance(recordPendingQuickClear)}
                    disabled={busyCompleteId === recordPendingQuickClear.id}
                    aria-busy={busyCompleteId === recordPendingQuickClear.id}
                  >
                    {busyCompleteId === recordPendingQuickClear.id ? 'Saving...' : 'Yes, completed'}
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'complete' && recordPendingComplete ? (
        <DesktopServiceModal
          record={recordPendingComplete}
          busy={busyCompleteId === recordPendingComplete.id}
          askScheduleLink
          onClose={closeModal}
          onSubmit={(completion) => completeMaintenance(recordPendingComplete, completion)}
        />
      ) : null}

      {modalMode === 'delete' && recordPendingDelete ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="maintenance-delete-title">
          <section className={styles.deleteConfirmModal}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-delete-title">Are you sure you want to delete this?</h2>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close delete confirmation">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.deleteConfirmBody}>
              <p>This maintenance record will be permanently removed, including its saved schedule, assignment and notes.</p>
              <div className={styles.deleteRecordSummary}>
                <span>Selected maintenance record</span>
                <strong>{recordPendingDelete.assetTitle}</strong>
                <small>{typeLabel(recordPendingDelete.maintenanceType)} · {triggerLabel(recordPendingDelete.triggerType)} · {maintenanceDueValue(recordPendingDelete)} · {recordPendingDelete.assignedName || 'Unassigned'}</small>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
              <button className={styles.deleteConfirmButton} type="button" onClick={() => void deleteRecord()} disabled={deletingRecordId === recordPendingDelete.id}>
                {deletingRecordId === recordPendingDelete.id ? 'Deleting...' : 'Yes, delete maintenance record'}
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
              <MaintenanceDropdown
                label="Asset"
                value={draftFilters.assetId}
                options={filterAssetOptions}
                searchable
                searchPlaceholder="Search saved assets"
                noMatchesLabel="No saved assets found"
                onChange={(value) => setDraftFilters((current) => ({ ...current, assetId: value }))}
              />
              <MaintenanceDropdown
                label="Type"
                value={draftFilters.type}
                options={FILTER_TYPE_OPTIONS}
                onChange={(value) => setDraftFilters((current) => ({ ...current, type: value as MaintenanceFilters['type'] }))}
              />
              <MaintenanceDropdown
                label="Status"
                value={draftFilters.status}
                options={FILTER_STATUS_OPTIONS}
                onChange={(value) => setDraftFilters((current) => ({ ...current, status: value as MaintenanceFilters['status'] }))}
              />
              <MaintenanceDropdown
                label="Assigned to"
                value={draftFilters.assignedTo}
                options={filterAssigneeOptions}
                onChange={(value) => setDraftFilters((current) => ({ ...current, assignedTo: value }))}
              />
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
          <section className={`${styles.downloadModal} ${styles.maintenanceExportModal}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-download-title">
                  {downloadStep === 'scope'
                    ? 'Download maintenance reports'
                    : downloadStep === 'asset'
                      ? 'Choose asset for maintenance report'
                      : 'Choose download format'}
                </h2>
                <div className={styles.maintenanceExportHeadingRow}>
                  <p>
                    {downloadStep === 'scope'
                      ? 'Choose which maintenance records should be included in the report.'
                      : downloadStep === 'asset'
                        ? 'Select the saved asset whose maintenance history should be included.'
                        : 'Choose a PDF report or an Excel-ready maintenance workbook.'}
                  </p>
                </div>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close download reports">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />

            {downloadStep === 'scope' ? (
              <>
                <div className={`${styles.formModalScrollBody} ${styles.maintenanceExportBody}`}>
                  <div className={styles.maintenanceScopeList}>
                    {DOWNLOAD_SCOPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.maintenanceScopeOption} ${downloadScope === option.value ? styles.maintenanceScopeOptionActive : ''}`}
                        onClick={() => setDownloadScope(option.value)}
                      >
                        <span className={styles.maintenanceScopeIcon} aria-hidden="true">
                          <MaintenanceReportScopeIcon scope={option.value} />
                        </span>
                        <span className={styles.maintenanceScopeCopy}>
                          <strong>{option.title}</strong>
                          <small>{option.description}</small>
                        </span>
                        <span className={styles.maintenanceSelectionMark} aria-hidden="true">
                          <SelectedTickIcon />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <footer className={`${styles.modalFooter} ${styles.maintenanceExportFooter}`}>
                  <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => setDownloadStep(downloadScope === 'asset' ? 'asset' : 'format')}
                  >
                    Next
                  </button>
                </footer>
              </>
            ) : downloadStep === 'asset' ? (
              <>
                <div className={`${styles.formModalScrollBody} ${styles.maintenanceExportBody}`}>
                  <div className={styles.pickerToolbar}>
                    <label className={styles.pickerSearchField}>
                      <SearchIcon />
                      <input
                        type="search"
                        value={downloadAssetSearch}
                        onChange={(event) => setDownloadAssetSearch(event.target.value)}
                        placeholder="Search saved assets..."
                        aria-label="Search saved assets for maintenance report"
                      />
                    </label>
                    <button
                      className={`${styles.secondaryButton} ${styles.pickerClearButton}`}
                      type="button"
                      onClick={() => setDownloadAssetSearch('')}
                      disabled={!downloadAssetSearch}
                    >
                      Clear
                    </button>
                  </div>
                  <div className={styles.assetList}>
                    {filteredDownloadAssets.length ? (
                      filteredDownloadAssets.map((asset) => (
                        <button
                          key={asset.id}
                          className={`${styles.assetRow} ${downloadAssetId === asset.id ? styles.maintenanceScopeOptionActive : ''}`}
                          type="button"
                          onClick={() => {
                            setDownloadAssetId(asset.id);
                            setDownloadStep('format');
                          }}
                        >
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
                </div>
                <footer className={`${styles.modalFooter} ${styles.maintenanceExportFooter}`}>
                  <button className={styles.secondaryButton} type="button" onClick={() => setDownloadStep('scope')}>Back</button>
                  <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
                </footer>
              </>
            ) : (
              <>
                <div className={`${styles.formModalScrollBody} ${styles.maintenanceExportBody}`}>
                  <div className={styles.maintenanceFormatGrid}>
                    {DOWNLOAD_FORMAT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.maintenanceFormatOption} ${downloadFormat === option.value ? styles.maintenanceFormatOptionActive : ''}`}
                        onClick={() => setDownloadFormat(option.value)}
                      >
                        <span className={styles.maintenanceFormatGraphic}>
                          <img src={option.value === 'pdf' ? '/brand/pdf.png' : '/brand/sheet.png'} alt="" />
                        </span>
                        <span className={styles.maintenanceFormatCopy}>
                          <strong>{option.title}</strong>
                          <small>{option.description}</small>
                        </span>
                        <span className={styles.maintenanceSelectionMark} aria-hidden="true">
                          <SelectedTickIcon />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <footer className={`${styles.modalFooter} ${styles.maintenanceExportFooter}`}>
                  <button className={styles.secondaryButton} type="button" onClick={() => setDownloadStep(downloadScope === 'asset' ? 'asset' : 'scope')}>Back</button>
                  <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
                  <button className={styles.primaryButton} type="button" onClick={submitDownload}>
                    {downloadFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      ) : null}

    </div>
  );
}
