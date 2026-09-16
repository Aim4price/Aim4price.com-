'use client';
import { downloadCanonicalReportFile } from '../../lib/report-open';
import ReportDownloadFlow from '../../components/ReportDownloadFlow';
import downloadStyles from "../../components/ReportDownload.module.css";
import ListPagination, { type ListPageSize } from '../../components/ListPagination';

import MaintenanceChecklistBrowser from '../../components/MaintenanceChecklistBrowser';
import FilterFlow, { FilterQuestion } from '../../components/FilterFlow';

import pickerStyles from '../../components/AssetPicker.module.css';
import AssetSerialNumber from '../../components/AssetSerialNumber';

import DropdownOverlay from '../../components/DropdownOverlay';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { openCanonicalReportUrl } from '../../lib/report-open';
import type { MaintenanceIdentity } from '../../lib/maintenance-catalogue';
import DesktopServiceModal, { type DesktopServiceCompletion } from '../../components/DesktopServiceModal';
import styles from './page.module.css';
import accountStyles from '../account/page.module.css';
import fuelStyles from '../fuel/page.module.css';
import chooserStyles from '../../components/MaintenanceDownloadChooser.module.css';
import dialogStyles from '../../components/MaintenanceDialog.module.css';

type MaintenanceType = 'service' | 'checkup';
type TriggerType = 'date' | 'usage';
type MaintenanceStatus = 'upcoming' | 'done' | 'cancelled';
type UsageMetric = 'hours' | 'km' | 'percentage';
type ComputedStatus = 'upcoming' | 'due_soon' | 'due' | 'overdue' | 'done' | 'cancelled';
type DateIntervalUnit = 'days' | 'weeks' | 'months';
type UsageIntervalUnit = 'hours' | 'km' | 'percentage';
type IntervalUnit = DateIntervalUnit | UsageIntervalUnit;

type AssetOption = {
  maintenanceIdentity?: MaintenanceIdentity;
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
  serialNumber?: string;
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
  maintenanceIdentity?: MaintenanceIdentity;
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
  type: 'all' | MaintenanceType | 'repair';
  status: 'all' | 'upcoming' | 'done';
  assignedTo: 'all' | 'unassigned' | string;
};

type MaintenanceClientProps = {
  initialAssetId?: string;
  initialOpenAdd?: boolean;
  initialReturnTo?: string;
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

type ModalMode = 'checklists' | 'timing' | 'record-work' | 'asset-picker' | 'maintenance-type' | 'trigger-type' | 'form' | 'filter' | 'download' | 'complete' | 'quick-clear' | 'delete' | null;
type QuickClearStep = 'confirm' | 'completion';

type DownloadScope = 'total' | 'asset' | 'upcoming' | 'done';
type DownloadFormat = 'pdf' | 'xlsx';
type MaintenanceReportRouteFormat = DownloadFormat | 'html';

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

function filtersForInitialAsset(assetId: string): MaintenanceFilters {
  const normalizedAssetId = assetId.trim();
  return normalizedAssetId
    ? { ...EMPTY_FILTERS, assetId: normalizedAssetId }
    : { ...EMPTY_FILTERS };
}

function ScheduleIcon() {
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 2v6m10-6v6M3 10h18M7 14h3m4 0h3M7 17h3" /></svg>;
}
function ChecklistIcon() {
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m7 8 1 1 2-2m-3 6 1 1 2-2m-3 6 1 1 2-2M13 8h4m-4 5h4m-4 5h4" /></svg>;
}

function ManageIcon() {
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></svg>;
}
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
    <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16M7 12h10M10 19h4" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
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

function buildMaintenanceAssetMeta(record: MaintenanceRecord, includeFamily = true): string[] {
  const usageLabel = formatAssetUsage(record.assetUsageReading, record.assetUsageMetric);
  const familyLabel = record.assetCategoryLabel || titleCase(record.assetKind || 'asset');
  const details = [
    typeof record.assetYearModel === 'number' && Number.isFinite(record.assetYearModel) && record.assetYearModel > 0
      ? `${assetYearLabelFromCategory(record.assetCategoryLabel)}: ${record.assetYearModel}`
      : '',
    usageLabel ? `Usage: ${usageLabel}` : '',
    record.assetCondition ? `Condition: ${record.assetCondition}` : '',
    includeFamily && familyLabel ? `Family: ${familyLabel}` : '',
  ].filter(Boolean);

  return details.length ? details : record.assetMeta ? [record.assetMeta] : [];
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
  if (record.status !== 'done') return (record.triggerType === 'date' ? 'Scheduled date' : 'Scheduled usage');
  return record.triggerType === 'date' ? 'Completed On' : 'Completed At';
}

function maintenanceTimingLabel(record: MaintenanceRecord): string {
  if (record.status !== 'upcoming') return '';
  const remaining = record.triggerType === 'date' ? record.daysUntilDue : record.remainingUsage;
  if (remaining === null || !Number.isFinite(remaining)) return '';
  if (remaining === 0) return record.triggerType === 'date' ? 'Due today' : 'Due now';
  const amount = record.triggerType === 'date'
    ? `${numberText(Math.abs(remaining))} ${Math.abs(remaining) === 1 ? 'day' : 'days'}`
    : formatUsage(Math.abs(remaining), record.usageMetric ?? record.assetUsageMetric);
  return `${amount} ${remaining < 0 ? 'overdue' : 'remaining'}`;
}

function cleanMaintenanceAssetTitle(title: string): string {
  return title.replace(/^year\s+unknown\s*[-–:·]?\s*/i, '').trim() || 'Asset';
}

function maintenanceDisplayTitle(record: MaintenanceRecord): string {
  const title = record.title?.trim();
  if (record.status === 'done' && ((!title && record.maintenanceType === 'service') || /^(next|scheduled) service$/i.test(title || ''))) return 'Completed service';
  if (record.status === 'done' && (!title || /^(next|scheduled) check[- ]?up$/i.test(title))) return 'Completed check-up';
  if (record.status === 'upcoming' && (!title || /^(next|scheduled) (service|check[- ]?up)$/i.test(title)) && record.recurringEnabled && record.recurringIntervalValue && record.recurringIntervalUnit) {
    const unit = record.recurringIntervalUnit === 'hours' ? 'hour' : record.recurringIntervalUnit === 'percentage' ? '% life' : record.recurringIntervalUnit.replace(/s$/, '');
    return `${numberText(record.recurringIntervalValue)}-${unit} ${record.maintenanceType === 'checkup' ? 'check-up' : 'service'}`;
  }
  return title || (record.maintenanceType === 'checkup' ? 'Maintenance check-up' : 'Scheduled service');
}

function arrangeMaintenanceTimeline(records: MaintenanceRecord[]): MaintenanceRecord[] {
  const priority = (record: MaintenanceRecord) => {
    if (record.status === 'cancelled') return 5;
    if (record.status === 'done') return 4;
    if (record.computedStatus === 'overdue') return 0;
    if (record.computedStatus === 'due') return 1;
    if (record.computedStatus === 'due_soon') return 2;
    return 3;
  };
  // Stable sorting retains the server's ordering within each urgency group.
  return [...records].sort((a, b) => priority(a) - priority(b));
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

function buildReportUrl(scope: DownloadScope, format: MaintenanceReportRouteFormat, filters: MaintenanceFilters, assetId?: string): string {
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
  { value: 'repair', label: 'Repair' },
];

const FILTER_STATUS_OPTIONS: DropdownOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done', label: 'Done' },
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
          <DropdownOverlay className={styles.customFilterSelectMenu} role="listbox" aria-label={label}>
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
          </DropdownOverlay>
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

export default function MaintenanceClient({
  initialAssetId = '',
  initialOpenAdd = false,
  initialReturnTo = '',
}: MaintenanceClientProps = {}) {
  const initialFilters = filtersForInitialAsset(initialAssetId);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [fieldManagers, setFieldManagers] = useState<FieldManagerOption[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary>(EMPTY_SUMMARY);
  const [notice, setNotice] = useState<Notice>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [search, setSearch] = useState('');
  const [scheduleView, setScheduleView] = useState<'all' | 'upcoming' | 'recurring'>('all');
  const previousFilters = useRef<MaintenanceFilters | null>(null);
  const [checklistAssetId, setChecklistAssetId] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<MaintenanceFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<MaintenanceFilters>(initialFilters);
  const [entryTiming, setEntryTiming] = useState<'done' | 'upcoming'>('upcoming');
  const [draft, setDraft] = useState<MaintenanceDraft | null>(null);
  const [initialLaunchHandled, setInitialLaunchHandled] = useState(!initialOpenAdd);
  const [quickLaunchActive, setQuickLaunchActive] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordPendingDelete, setRecordPendingDelete] = useState<MaintenanceRecord | null>(null);
  const [recordPendingComplete, setRecordPendingComplete] = useState<MaintenanceRecord | null>(null);
  const [recordPendingQuickClear, setRecordPendingQuickClear] = useState<MaintenanceRecord | null>(null);
  const [quickClearStep, setQuickClearStep] = useState<QuickClearStep>('confirm');
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [busyCompleteId, setBusyCompleteId] = useState<string | null>(null);
  const completeRequestInFlight = useRef(false);

  const [pageSize, setPageSize] = useState<ListPageSize>(6);
  const [page, setPage] = useState(1);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [managedRecord, setManagedRecord] = useState<MaintenanceRecord | null>(null);
  const manageRef = useRef<HTMLElement>(null);
  const manageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pageRef = useRef<HTMLElement>(null);

  function closeManage() {
    setManagedRecord(null);
    window.requestAnimationFrame(() => manageTriggerRef.current?.focus());
  }

  useEffect(() => {
    if (!managedRecord) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const pageElement = pageRef.current;
    pageElement?.setAttribute('inert', '');
    const frame = requestAnimationFrame(() => manageRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeManage(); }
      if (event.key !== 'Tab') return;
      const buttons = manageRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      pageElement?.removeAttribute('inert');
    };
  }, [managedRecord]);

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedDraftAsset = draft ? assetById.get(draft.assetId) : undefined;
  const quickLaunchReturnTo = initialOpenAdd && initialAssetId ? initialReturnTo : '';
  const assetEntryLocked = quickLaunchActive && Boolean(initialAssetId && assetById.has(initialAssetId));
  const filteredAssetReturnTo = !initialOpenAdd && initialAssetId && assetById.has(initialAssetId)
    ? initialReturnTo
    : '';

  const refreshVersion = useRef(0);
  useEffect(() => () => { refreshVersion.current += 1; }, []);

  const applyPayload = useCallback((payload: MaintenancePayload) => {
    refreshVersion.current += 1; // A saved change invalidates older background reads.
    setAssets(Array.isArray(payload.assets) ? payload.assets : []);
    setFieldManagers(Array.isArray(payload.fieldManagers) ? payload.fieldManagers : []);
    setRecords(Array.isArray(payload.records) ? payload.records : []);
    setSummary(payload.summary ?? EMPTY_SUMMARY);
  }, []);

  const loadData = useCallback(
    async (filters = activeFilters, options: { silent?: boolean } = {}) => {
      const requestVersion = ++refreshVersion.current;
      const silent = options.silent === true;
      if (!silent) setIsLoading(true);
      try {
        const response = await fetch(buildListUrl(filters), { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as MaintenancePayload;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || 'Maintenance data could not be loaded.');
        }

        if (requestVersion !== refreshVersion.current) return;
        applyPayload(payload);
        setIsLoading(false);
      } catch (error) {
        if (!silent && requestVersion === refreshVersion.current) {
          setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Maintenance data could not be loaded.' });
        }
      } finally {
        if (requestVersion === refreshVersion.current) setIsLoading(false);
      }
    },
    [activeFilters, applyPayload],
  );

  useEffect(() => {
    void loadData(activeFilters);
  }, [activeFilters, loadData]);

  useEffect(() => {
    if (initialLaunchHandled || isLoading) return;
    setInitialLaunchHandled(true);

    const requestedAssetId = initialAssetId.trim();
    const requestedAsset = assets.find((asset) => asset.id === requestedAssetId);
    if (requestedAsset) {
      setNotice(null);
      setEditingRecordId(null);
      setDraft(emptyDraftForAsset(requestedAsset));
      setPickerSearch('');
      setQuickLaunchActive(true);
      setModalMode('timing');
      return;
    }

    if (requestedAssetId) {
      setNotice({ type: 'error', text: 'This asset is not available for maintenance.' });
    }
  }, [assets, initialAssetId, initialLaunchHandled, isLoading]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void loadData(activeFilters, { silent: true });
      }
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('aim4price:asset-register-updated', refresh);
    window.addEventListener('aim4price:asset-register-refreshed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('aim4price:asset-register-updated', refresh);
      window.removeEventListener('aim4price:asset-register-refreshed', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activeFilters, loadData]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchingRecords = query
      ? records.filter((record) => recordSearchText(record).includes(query))
      : records;
    return arrangeMaintenanceTimeline(matchingRecords.filter((record) => scheduleView === 'all' || (record.status === 'upcoming' && (scheduleView === 'upcoming' || record.recurringEnabled || Boolean(record.generatedFromMaintenanceId)))));
  }, [records, search, scheduleView]);

  const pageLimit = pageSize === 'all' ? Math.max(1, filteredRecords.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageLimit));
  const safePage = Math.min(page, totalPages);
  const pagedRecords = filteredRecords.slice((safePage - 1) * pageLimit, safePage * pageLimit);
  const filtersCount = activeFilterCount(activeFilters);

  useEffect(() => {
    setPage(1);
  }, [search, activeFilters, scheduleView]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const filteredAssets = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => [asset.title, asset.serialNumber, asset.meta, asset.kind, asset.categoryLabel].join(' ').toLowerCase().includes(query));
  }, [assets, pickerSearch]);

  const filterAssetOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'all', label: 'All saved assets' },
      ...assets.map((asset) => ({ value: asset.id, label: asset.title })),
    ],
    [assets],
  );

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
    const shouldReturn = quickLaunchActive && quickLaunchReturnTo;
    setModalMode(null);
    setPickerSearch('');
    setEditingRecordId(null);
    setRecordPendingDelete(null);
    setRecordPendingComplete(null);
    setRecordPendingQuickClear(null);
    setQuickClearStep('confirm');
    setDraft(null);
    setQuickLaunchActive(false);

    if (shouldReturn) {
      window.location.assign(shouldReturn);
    }
  }

  function showSchedules(view: 'upcoming' | 'recurring') {
    if (scheduleView === 'all') previousFilters.current = activeFilters;
    setScheduleView(view);
    setActiveFilters((filters) => ({ ...filters, status: 'upcoming' }));
    setExpandedRecordId(null);
  }

  function showAllMaintenance() {
    setScheduleView('all');
    setActiveFilters(previousFilters.current ?? EMPTY_FILTERS);
    previousFilters.current = null;
    setExpandedRecordId(null);
  }

  function startChecklistWork(assetId: string, timing: 'done' | 'upcoming') {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    setNotice(null);
    setEditingRecordId(null);
    setQuickLaunchActive(false);
    setDraft(emptyDraftForAsset(asset));
    setEntryTiming(timing);
    setModalMode('maintenance-type');
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
    setModalMode('timing');
  }

  function chooseMaintenanceType(type: MaintenanceType) {
    updateDraft({ maintenanceType: type });
    setModalMode(entryTiming === 'done' ? 'record-work' : 'trigger-type');
  }

  async function savePastWork(completion: DesktopServiceCompletion) {
    if (!draft || completeRequestInFlight.current) return;
    completeRequestInFlight.current = true;
    setIsSaving(true);
    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...completion, assetId: draft.assetId, maintenanceType: draft.maintenanceType, status: 'done' }),
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || 'Could not save completed work.');
      await loadData(activeFilters, { silent: true });
      closeModal();
      setNotice({ type: 'success', text: 'Completed work saved to maintenance history.' });
    } finally {
      completeRequestInFlight.current = false;
      setIsSaving(false);
    }
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
          : completion.continueSchedule === false
          ? 'Maintenance saved. The recurring schedule has ended.'
          : 'Maintenance marked done.',
      });
      closeModal();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Maintenance record could not be marked done.',
      });
      throw error;
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
    setActiveFilters(scheduleView === 'all' ? draftFilters : { ...draftFilters, status: 'upcoming' });
    setModalMode(null);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setActiveFilters(scheduleView === 'all' ? EMPTY_FILTERS : { ...EMPTY_FILTERS, status: 'upcoming' });
    setModalMode(null);
  }

  function openDownload() {
    const defaultAssetId = activeFilters.assetId !== 'all' ? activeFilters.assetId : 'all';

    setModalMode('download');
  }

  return (
    <div className={styles.page}>
      <AppHeader active="maintenance" />
      <main ref={pageRef} className={styles.shell}>
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
            {filteredAssetReturnTo ? (
              <p className={styles.helperText}>
                <a className={styles.secondaryButton} href={filteredAssetReturnTo}>← Back to asset</a>
              </p>
            ) : null}
          </div>
        </section>

        <section className={styles.maintenanceActions} aria-label="Maintenance actions">
          <button className={`${styles.toolbarButton} ${styles.toolbarAddButton}`} type="button" onClick={openAddService}>
            <span className={styles.plusMark}>+</span><span>Add Maintenance</span>
          </button>
          <button className={`${styles.toolbarButton} ${styles.toolbarSchedulesButton}`} type="button" onClick={() => showSchedules('upcoming')} aria-pressed={scheduleView !== 'all'}>
            <ScheduleIcon /><span>Scheduled</span>
          </button>
          <button className={`${styles.toolbarButton} ${styles.toolbarChecklistsButton}`} type="button" onClick={() => { setChecklistAssetId(activeFilters.assetId === 'all' ? '' : activeFilters.assetId); setModalMode('checklists'); }}>
            <ChecklistIcon /><span>Checklists</span>
          </button>
          <button className={`${styles.toolbarButton} ${styles.primaryButton} ${styles.toolbarDownloadButton}`} type="button" onClick={openDownload}>
            <DownloadIcon /><span>Download</span>
          </button>
        </section>
        <section className={`${styles.invoiceToolbar} ${styles.maintenanceSearchToolbar}`} aria-label="Maintenance toolbar">
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
          <button className={`${styles.toolbarButton} ${styles.toolbarFilterButton}`} type="button" onClick={openFilters}>
            <FilterIcon />Filter{filtersCount ? <strong>{filtersCount}</strong> : null}
          </button>
        </section>
        {scheduleView !== 'all' ? <section className={styles.scheduleOverview} aria-label="Maintenance schedules">
          <div><h2>Maintenance schedules</h2><p>Due dates, usage intervals and assigned managers.</p></div>
          <div className={styles.scheduleTabs}>
            <button type="button" aria-pressed={scheduleView === 'upcoming'} onClick={() => showSchedules('upcoming')}>All upcoming</button>
            <button type="button" aria-pressed={scheduleView === 'recurring'} onClick={() => showSchedules('recurring')}>Recurring</button>
            <button type="button" onClick={showAllMaintenance}>Back to all maintenance</button>
          </div>
        </section> : null}

        <section className={styles.invoicePanel}>
          {isLoading ? (
            <div className={styles.emptyState}>Loading maintenance records...</div>
          ) : pagedRecords.length ? (
            <div className={styles.invoiceList}>
              {pagedRecords.map((record) => {
                const isDone = record.status === 'done';
                const canComplete = record.status === 'upcoming';
                const expanded = expandedRecordId === record.id;
                const detailsId = `maintenance-details-${record.id}`;
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
                    : isDueSoon
                      ? styles.maintenanceStatusWarning
                      : record.status === 'cancelled' ? styles.maintenanceStatusNeutral : styles.maintenanceStatusWarning;
                const statusText = isDone ? 'Completed' : record.status === 'cancelled' ? 'Cancelled' : record.computedStatusLabel || 'Upcoming';

                return (
                  <article
                    className={`${styles.invoiceRow} ${styles.ledgerCard} ${cardStatusClass} ${isUpcomingRecurringFollowUp && isDueSoon && !needsAttention ? styles.maintenanceRecurringFollowUp : ''}`}
                    key={record.id}
                    data-maintenance-status={record.status === 'done' ? 'completed' : record.status === 'cancelled' ? 'cancelled' : needsAttention ? 'attention' : isDueSoon ? 'due-soon' : 'upcoming'}
                  >
                    <div className={styles.invoiceHeader}>
                      <div className={styles.invoiceTitleBlock}>
                        <h2 className={styles.invoiceTitle}>{cleanMaintenanceAssetTitle(record.assetTitle)}</h2>
                        {buildMaintenanceAssetMeta(record, false).length ? <p className={styles.ledgerMeta}>
                          {buildMaintenanceAssetMeta(record, false).join(' · ')}
                        </p> : null}
                        {scheduleView !== 'all' ? <p className={styles.scheduleRecordMeta}>
                          <span>{record.recurringEnabled && record.recurringIntervalValue && record.recurringIntervalUnit ? `Every ${record.recurringIntervalValue} ${record.recurringIntervalUnit}` : 'Once-off'}</span>
                          <span>Assigned to: {record.assignedName || 'Unassigned'}</span>
                        </p> : null}
                        <div className={styles.ledgerBadges}>
                          <span className={`${styles.maintenanceStatusPill} ${statusPillClass}`}><span aria-hidden="true" className={styles.statusSymbol}>{isDone ? '✓' : record.status === 'cancelled' ? '−' : needsAttention ? '!' : '◷'}</span>{statusText}</span>
                          {maintenanceTimingLabel(record) ? <span className={styles.timingLabel}>{maintenanceTimingLabel(record)}</span> : null}
                        </div>
                      </div>

                      <div className={styles.invoiceHeaderAside}>
                        <div className={styles.invoiceValueBlock}>
                          <strong className={styles.invoicePrice}>{maintenanceCardValue(record)}</strong>
                          <span className={styles.invoiceVatLabel}>{maintenanceCardCaption(record)}</span>
                        </div>

                        <div className={styles.rowActions}>
                          <button
                            className={`${styles.secondaryButtonSmall} ${styles.invoiceOpenButton} ${isDone ? styles.invoiceCompletedButton : ''}`}
                            type="button"
                            onClick={() => {
                              if (canComplete) openComplete(record);
                            }}
                            disabled={!canComplete || busyCompleteId !== null}
                            aria-pressed={isDone}
                            aria-label={isDone ? `${record.assetTitle} maintenance completed` : !canComplete ? `${record.assetTitle} maintenance cancelled` : `Record ${record.maintenanceType} for ${record.assetTitle}`}
                          >
                            <CheckIcon />
                            <span>{busyCompleteId === record.id ? 'Saving...' : isDone ? 'Completed' : !canComplete ? 'Cancelled' : record.maintenanceType === 'checkup' ? 'Record check-up' : 'Record service'}</span>
                          </button>
                          <button className={`${styles.secondaryButtonSmall} ${styles.invoiceEditButton}`} type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedRecordId(expanded ? null : record.id)}>
                            <ChevronDownIcon className={styles.detailsChevron} /><span>{expanded ? 'Hide details' : 'View details'}</span>
                          </button>
                          <button className={`${styles.secondaryButtonSmall} ${styles.ledgerManageButton}`} type="button" aria-haspopup="dialog" onClick={(event) => { manageTriggerRef.current = event.currentTarget; setManagedRecord(record); }} disabled={deletingRecordId === record.id || busyCompleteId !== null}>
                            <ManageIcon /><span>Manage</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <section id={detailsId} hidden={!expanded} className={styles.ledgerDetails} aria-label="Maintenance details">
                      <h3>Maintenance details</h3>
                      <dl className={styles.ledgerDetailsGrid}>
                        <div><dt>Asset</dt><dd>{cleanMaintenanceAssetTitle(record.assetTitle)}<span className={styles.ledgerAssetMeta}>{buildMaintenanceAssetMeta(record).map((line, index) => <span className={styles.assetDetailsLine} key={index}>{line}</span>)}</span></dd></div>
                        <div><dt>Work</dt><dd>{maintenanceDisplayTitle(record)}</dd></div>
                        <div><dt>Type</dt><dd>{typeLabel(record.maintenanceType)}</dd></div>
                        {isDone ? <>
                          {record.completedAtIso ? <div><dt>Completed on</dt><dd>{dateOnly(record.completedAtIso)}</dd></div> : null}
                          {record.completedUsage !== null ? <div><dt>Usage at completion</dt><dd>{formatUsage(record.completedUsage, record.usageMetric ?? record.assetUsageMetric)}</dd></div> : null}
                          {record.completedBy ? <div><dt>Completed by</dt><dd>{record.completedBy}</dd></div> : null}
                        </> : canComplete ? <>
                          <div><dt>{maintenanceCardCaption(record)}</dt><dd>{maintenanceDueValue(record)}</dd></div>
                          <div><dt>Assigned to</dt><dd>{record.assignedName || 'Unassigned'}</dd></div>
                          {record.alertBeforeValue !== null && record.alertBeforeUnit ? <div><dt>Reminder</dt><dd>{maintenanceAlertLabel(record)}</dd></div> : null}
                        </> : null}
                        {record.recurringEnabled && record.recurringIntervalValue && record.recurringIntervalUnit ? <div><dt>Interval</dt><dd>Every {record.recurringIntervalValue} {record.recurringIntervalUnit}</dd></div> : null}
                        <div><dt>Updated</dt><dd>{dateOnly(record.updatedAtIso)}</dd></div>
                        {canComplete && record.alertNotedAtIso ? <div><dt>Alert noted</dt><dd>{dateOnly(record.alertNotedAtIso)}</dd></div> : null}
                      </dl>
                      {record.notes ? <div className={styles.ledgerNotes}><h4>Notes</h4><p>{record.notes}</p></div> : null}
                      {record.completedNotes ? <div className={styles.ledgerNotes}><h4>Completion notes</h4><p>{record.completedNotes}</p></div> : null}
                    </section>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>No maintenance records match the current view.</div>
          )}

          {!isLoading && filteredRecords.length > 0 ? (
            <ListPagination
              label="Maintenance record pages"
              page={safePage}
              pageCount={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          ) : null}
        </section>
      </main>

      {managedRecord ? (
        <div className={`${styles.modalBackdrop} ${styles.ledgerManageBackdrop}`} data-website-overlay onClick={closeManage}>
          <section ref={manageRef} className={`${styles.schedulingDialog} ${styles.ledgerManageModal}`} role="dialog" aria-modal="true" aria-labelledby="maintenance-manage-title" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <div><h2 id="maintenance-manage-title">Manage maintenance</h2><p>{managedRecord.assetTitle}</p></div>
              <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={closeManage} aria-label="Close manage maintenance"><CloseIcon /></button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.ledgerManageActions}>
              <button className={`${styles.secondaryButtonSmall} ${styles.invoiceEditButton}`} type="button" onClick={() => { setManagedRecord(null); openEdit(managedRecord); }}><EditIcon /><span>Edit</span></button>
              {managedRecord.status === 'upcoming' ? <button className={`${styles.secondaryButtonSmall} ${styles.maintenanceQuickClearButton}`} type="button" onClick={() => { setManagedRecord(null); openQuickClear(managedRecord); }} disabled={busyCompleteId !== null}><CheckIcon /><span>Clear</span></button> : null}
              <button className={`${styles.dangerButtonSmall} ${styles.invoiceDeleteButton}`} type="button" onClick={() => { setManagedRecord(null); openDelete(managedRecord); }} disabled={deletingRecordId === managedRecord.id}><TrashIcon /><span>Delete</span></button>
            </div>
          </section>
        </div>
      ) : null}

      {modalMode === 'asset-picker' ? (
        <div className={`${styles.modalBackdrop} ${pickerStyles.overlay}`} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
          <section className={`${styles.assetModal} ${pickerStyles.modal}`} data-asset-choice-surface="true" data-asset-choice-modal="true">
            <header className={styles.modalHeader} data-asset-choice-header="true">
              <div>
                <h2 id="asset-picker-title">Choose asset for maintenance</h2>
                <p>Choose a saved asset.</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Close asset picker">
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar} data-asset-choice-toolbar="true">
              <input
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Search assets..."
                aria-label="Search saved assets"
              />
              <button className={styles.secondaryButton} type="button" onClick={() => setPickerSearch('')}>Clear</button>
            </div>
            <div className={styles.assetList} data-asset-choice-list="true">
              {filteredAssets.length ? (
                filteredAssets.map((asset) => (
                  <button key={asset.id} className={styles.assetRow} type="button" onClick={() => selectAsset(asset)} data-asset-choice-row="true">
                    <span className={styles.assetInfo} data-asset-choice-copy="true">
                      <strong>{asset.title}</strong>
                      <small data-asset-choice-meta="true">{asset.meta}</small>
                      <small data-asset-choice-secondary="true">{asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</small>
                      <AssetSerialNumber value={asset.serialNumber} />
                    </span>
                    <span className={styles.assetValue} data-asset-choice-value="true">
                      <span className={pickerStyles.select}><i aria-hidden="true" />Select</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className={styles.emptyState}>No saved assets found.</div>
              )}
            </div>
            <footer className={styles.modalFooter} data-asset-choice-footer="true">
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'timing' && draft ? (
        <div className={styles.modalBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="maintenance-timing-title">
          <section className={`${styles.formModal} ${styles.maintenanceStepModal} ${styles.schedulingDialog}`}>
            <header className={styles.modalHeader}>
              <div><h2 id="maintenance-timing-title">Already done or upcoming?</h2><p>{selectedDraftAsset?.title}</p></div>
              <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={closeModal} aria-label="Close maintenance"><CloseIcon /></button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.maintenanceChoiceBody}>
              <div className={styles.maintenanceChoiceGrid}>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => { setEntryTiming('done'); setModalMode('maintenance-type'); }}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true"><CheckIcon /></span>
                  <strong>Already done</strong><small>Record past services, repairs or checks.</small>
                </button>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => { setEntryTiming('upcoming'); setModalMode('maintenance-type'); }}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true">31</span>
                  <strong>Upcoming</strong><small>Schedule work and reminders.</small>
                </button>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              {!assetEntryLocked ? <button className={styles.secondaryButton} type="button" onClick={returnToAssetPicker}>Back</button> : null}
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'record-work' && draft && selectedDraftAsset ? (
        <DesktopServiceModal
          record={{ id: selectedDraftAsset.id, assetId: selectedDraftAsset.id, assetTitle: selectedDraftAsset.title,
            maintenanceIdentity: selectedDraftAsset.maintenanceIdentity,
            assetKind: selectedDraftAsset.kind, assetCategoryLabel: selectedDraftAsset.categoryLabel,
            assetYearModel: selectedDraftAsset.yearModel, assetCondition: selectedDraftAsset.condition,
            maintenanceType: draft.maintenanceType, title: 'Completed work',
            currentUsage: selectedDraftAsset.usageReading, usageMetric: selectedDraftAsset.usageMetric }}
          standalone
          busy={isSaving}
          onBack={() => setModalMode('maintenance-type')}
          onClose={closeModal}
          onSubmit={savePastWork}
        />
      ) : null}

      {modalMode === 'maintenance-type' && draft ? (
        <div className={styles.modalBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="maintenance-type-title">
          <section className={`${styles.formModal} ${styles.maintenanceStepModal} ${styles.schedulingDialog}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-type-title">{entryTiming === 'done' ? 'What was done?' : 'What needs doing?'}</h2>
                <p>{selectedAssetLabel(selectedDraftAsset)}</p>
              </div>
              <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={closeModal} aria-label="Close maintenance type selection">
                <CloseIcon />
              </button>
            </header>
            <div className={styles.modalDivider} />
            <div className={styles.maintenanceChoiceBody}>
              <div className={styles.maintenanceChoiceGrid}>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => chooseMaintenanceType('service')}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true"><ServiceGearIcon /></span>
                  <strong>Service</strong>
                  <small>Servicing, repairs or maintenance.</small>
                </button>
                <button className={styles.maintenanceChoiceCard} type="button" onClick={() => chooseMaintenanceType('checkup')}>
                  <span className={styles.maintenanceChoiceIcon} aria-hidden="true">✓</span>
                  <strong>Checkup</strong>
                  <small>Inspection or condition check.</small>
                </button>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={() => setModalMode('timing')}>Back</button>
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'trigger-type' && draft ? (
        <div className={styles.modalBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="maintenance-trigger-title">
          <section className={`${styles.formModal} ${styles.maintenanceStepModal} ${styles.schedulingDialog}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-trigger-title">Due by date or usage?</h2>
                <p>{typeLabel(draft.maintenanceType)} · {selectedAssetLabel(selectedDraftAsset)}</p>
              </div>
              <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={closeModal} aria-label="Close maintenance trigger selection">
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
        <div className={styles.modalBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="maintenance-form-title">
          <section className={`${styles.formModal} ${styles.schedulingDialog}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-form-title">{`Schedule ${draft.maintenanceType}`}</h2>
                <p>{`${triggerLabel(draft.triggerType)} · ${selectedAssetLabel(selectedDraftAsset)}`}</p>
              </div>
              <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={closeModal} aria-label="Close maintenance form">
                <CloseIcon />
              </button>
            </header>

            <div className={`${styles.formModalScrollBody} ${dialogStyles.body}`}>
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
                  <textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Add notes or reminders..." />
                </label>
              </div>
            </div>
            <footer className={styles.modalFooter}>
              {!editingRecordId ? <button className={styles.secondaryButton} type="button" onClick={() => setModalMode('trigger-type')}>Back</button> : null}
              <button className={styles.secondaryButton} type="button" onClick={closeModal}>Cancel</button>
              <button className={styles.primaryButton} data-primary-action type="button" onClick={() => void submitDraft()} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingRecordId ? 'Save changes' : `Add ${draft.maintenanceType}`}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'quick-clear' && recordPendingQuickClear ? (
        <div className={styles.modalBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="maintenance-quick-clear-title" aria-describedby="maintenance-quick-clear-description">
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
        <div className={styles.modalBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="maintenance-delete-title">
          <section className={`${styles.deleteConfirmModal} ${styles.schedulingDialog}`}>
            <header className={styles.modalHeader}>
              <div>
                <h2 id="maintenance-delete-title">Are you sure you want to delete this?</h2>
              </div>
              <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={closeModal} aria-label="Close delete confirmation">
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
                {deletingRecordId === recordPendingDelete.id ? 'Deleting...' : 'Delete record'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {modalMode === 'checklists' ? <MaintenanceChecklistBrowser assets={assets.map((asset) => ({ ...asset, title: cleanMaintenanceAssetTitle(asset.title) }))} initialAssetId={checklistAssetId} onClose={closeModal} onStartWork={startChecklistWork} /> : null}

      {modalMode === 'filter' ? (
        <FilterFlow title="Filter maintenance records" onClose={closeModal} onClear={clearFilters} onApply={applyFilters}>
          <FilterQuestion
            assetPicker={{title: "Choose asset for maintenance filters", assets: assets}}
            label="Which asset?"
            value={draftFilters.assetId}
            options={filterAssetOptions}
            searchable
            searchPlaceholder="Search saved assets"
            noMatchesLabel="No saved assets found"
            onChange={(value) => setDraftFilters((current) => ({ ...current, assetId: value }))}
          />
          <FilterQuestion
            label="Which type?"
            value={draftFilters.type}
            options={FILTER_TYPE_OPTIONS}
            onChange={(value) => setDraftFilters((current) => ({ ...current, type: value as MaintenanceFilters['type'] }))}
          />
          {scheduleView === 'all' ? <FilterQuestion
            label="Which status?"
            value={draftFilters.status}
            options={FILTER_STATUS_OPTIONS}
            onChange={(value) => setDraftFilters((current) => ({ ...current, status: value as MaintenanceFilters['status'] }))}
          /> : null}
          <FilterQuestion
            label="Assigned to whom?"
            value={draftFilters.assignedTo}
            options={filterAssigneeOptions}
            onChange={(value) => setDraftFilters((current) => ({ ...current, assignedTo: value }))}
          />
        </FilterFlow>
      ) : null}

      {modalMode === 'download' ? <ReportDownloadFlow title="Maintenance reports" allLabel="All maintenance" assets={assets} years={records.flatMap(record=>[record.dueDate,record.completedAtIso].filter(Boolean).map(date=>String(date).slice(0,4)))}
        scopes={[{label:'Upcoming maintenance',description:'Open and overdue work.',field:'status',value:'upcoming'},{label:'Completed maintenance',description:'Completed services and checks.',field:'status',value:'done'}]}
        fields={[{key:'status',label:'Maintenance status',initial:'all',options:[{value:'all',label:'All maintenance'},{value:'upcoming',label:'Upcoming maintenance'},{value:'done',label:'Completed maintenance'}]}]}
        onClose={closeModal} onDownload={async selection => {
          const scope = selection.fields.status === 'upcoming' ? 'upcoming' : selection.fields.status === 'done' ? 'done' : selection.assetId !== 'all' ? 'asset' : 'total';
          const url = new URL(buildReportUrl(scope, selection.format === 'pdf' ? 'html' : 'xlsx', {...EMPTY_FILTERS, assetId:selection.assetId}, selection.assetId), window.location.origin);
          if(selection.year !== 'all') url.searchParams.set('year', selection.year);
          if(selection.year !== 'all' && selection.month !== 'all') url.searchParams.set('month', selection.month);
          if(selection.format === 'xlsx') await downloadCanonicalReportFile(url.toString());
          else if(!openCanonicalReportUrl(url.toString())) throw new Error('Allow pop-ups to open your report.');
        }} /> : null}

    </div>
  );
}
