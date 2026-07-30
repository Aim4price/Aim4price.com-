'use client';

import { useEffect, useMemo, useState } from 'react';
import DealerCostOfOwnershipReportModal from './DealerCostOfOwnershipReportModal';
import DealerMaintenanceReportModal from './DealerMaintenanceReportModal';
import DealerMaintenanceScheduleModal from './DealerMaintenanceScheduleModal';
import LeadPhotoViewerModal from './LeadPhotoViewerModal';
import {
  WorkspaceTitlePanel,
  workspaceStyles,
} from './WorkspacePrimitives';
import type {
  DealerMaintenanceRecordSummary,
  DealerMaintenanceScheduleProposal,
  DealerMaintenanceTrackedAsset,
  DealerMaintenanceTrackerStatus,
} from '../lib/dealer-maintenance-tracker';
import assetStyles from '../app/asset-register/page.module.css';
import leadStyles from '../app/leads/page.module.css';
import styles from './DealerMaintenanceTrackerClient.module.css';

type TrackerStatusFilter = 'all' | 'attention' | 'upcoming' | 'no_open';
type FilterDropdownKey = 'owner' | 'status';
type HistoryRecordType = 'all' | 'maintenance' | 'issues';
type Option = { value: string; label: string };

type Props = {
  initialAssets: DealerMaintenanceTrackedAsset[];
  dealerAppMode?: boolean;
  initialOpenAccessId?: string | null;
};

type TrackerResponse = {
  ok?: boolean;
  assets?: DealerMaintenanceTrackedAsset[];
  error?: string;
};

type TrackerPhotoModal = {
  accessId: string;
  title: string;
  urls: string[];
  index: number;
};

const statusOptions: Option[] = [
  { value: 'all', label: 'All tracked assets' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'no_open', label: 'No open maintenance' },
];

const historyRecordTypeOptions: Option[] = [
  { value: 'all', label: 'All records' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'issues', label: 'Problems and notes' },
];

function SearchIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4.4 4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M19.2 8.2A8 8 0 1 0 20 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19.4 3.8v5.1h-5.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function FilterIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CloseIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ManageIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.87 2.87-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1.03 1.56V21H10v-.04A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.87-2.87.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3V10h.04A1.7 1.7 0 0 0 4.6 8.97a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.87-2.87.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3H14v.04A1.7 1.7 0 0 0 15.03 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.87 2.87-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.03H21V14h-.04A1.7 1.7 0 0 0 19.4 15Z" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function EmailIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v11H4v-11Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="m5 8 7 5 7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PhoneIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.2 6.7 6.7c-.8.8-.9 2.1-.3 3.3 1.4 2.7 4.9 6.2 7.6 7.6 1.2.6 2.5.5 3.3-.3l1.5-1.5-3.3-3.3-1.4 1.4c-1.7-.9-3.1-2.3-4-4l1.4-1.4-3.3-3.3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function WhatsAppIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.25a8.55 8.55 0 0 0-7.26 13.05l-1.06 3.9 4.04-1.02A8.55 8.55 0 1 0 12 3.25Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.55 7.65c.22-.48.45-.5.68-.5h.6c.2 0 .43.05.57.38l.78 1.82c.1.27.08.5-.08.72l-.42.53c-.1.12-.13.28-.05.43.48.9 1.35 1.78 2.34 2.34.15.08.3.05.43-.05l.53-.42c.22-.17.45-.2.72-.08l1.82.78c.33.13.38.37.38.57v.6c0 .23-.02.47-.5.68-.5.22-1.14.34-1.9.24-2.28-.32-5.83-3.86-6.15-6.15-.1-.76.02-1.4.25-1.9Z" fill="currentColor" /></svg>;
}

function MaintenanceIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h12M7 12h12M7 19h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="4" cy="5" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="19" r="1" fill="currentColor" /></svg>;
}

function formatUsage(value: number | null, metric: string | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  if (metric === 'percentage') return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric === 'km' ? 'km' : 'hours'}`;
}

function trackingAssetMeta(asset: DealerMaintenanceTrackedAsset): string {
  return [
    `Year Model: ${asset.yearModel ?? 'Not recorded'}`,
    `Usage: ${formatUsage(asset.currentUsage, asset.usageMetric)}`,
    `Condition: ${asset.condition || 'Not recorded'}`,
  ].join(' • ');
}

function trackingDeleteAssetMeta(asset: DealerMaintenanceTrackedAsset): string {
  const details: string[] = [];
  const usage = formatUsage(asset.currentUsage, asset.usageMetric);
  const condition = asset.condition?.trim();

  if (usage !== 'Not recorded') details.push(usage);
  if (condition) {
    const conditionLabel = `${condition.charAt(0).toUpperCase()}${condition.slice(1)}`;
    details.push(/condition$/i.test(conditionLabel) ? conditionLabel : `${conditionLabel} condition`);
  }

  return details.length ? details.join(' · ') : 'Shared maintenance tracking';
}

function cleanPhoneForTel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const prefix = trimmed.startsWith('+') ? '+' : '';
  return `${prefix}${trimmed.replace(/\D/g, '')}`;
}

function cleanPhoneForWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('27')) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `27${digits.slice(1)}`;
  return digits;
}

function cleanEmail(value: string): string {
  const firstAddress = value.split(/[;,]/)[0]?.trim() ?? '';
  const bracketMatch = firstAddress.match(/<([^>]+)>/);
  const email = (bracketMatch?.[1] ?? firstAddress).replace(/\s+/g, '');
  return email.includes('@') ? email : '';
}

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return 'Not set';
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: value.includes('T') ? 'Africa/Johannesburg' : 'UTC',
  }).format(parsed);
}

function dueLabel(record: DealerMaintenanceRecordSummary, fallbackMetric: string): string {
  return record.triggerType === 'usage'
    ? formatUsage(record.dueUsage, record.usageMetric || fallbackMetric)
    : formatDate(record.dueDate);
}

function remainingLabel(record: DealerMaintenanceRecordSummary, fallbackMetric: string): string {
  if (record.status === 'done') return record.completedAtIso ? `Completed ${formatDate(record.completedAtIso)}` : 'Completed';
  if (record.triggerType === 'date') {
    if (!record.dueDate) return 'Not set';
    const days = Math.ceil((new Date(`${record.dueDate}T00:00:00`).getTime() - Date.now()) / 86_400_000);
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `${days} days`;
  }
  if (record.remainingUsage === null) return 'Usage needed';
  if (record.remainingUsage < 0) return `${formatUsage(Math.abs(record.remainingUsage), record.usageMetric || fallbackMetric)} overdue`;
  return formatUsage(record.remainingUsage, record.usageMetric || fallbackMetric);
}

function recurringLabel(record: DealerMaintenanceRecordSummary): string {
  if (!record.recurringEnabled) return 'Not recurring';
  if (record.recurringIntervalValue === null || !record.recurringIntervalUnit) return 'Recurring';
  return `Every ${record.recurringIntervalValue.toLocaleString('en-ZA')} ${record.recurringIntervalUnit}`;
}

function needsAttention(status: DealerMaintenanceTrackerStatus): boolean {
  return ['overdue', 'due', 'due_soon', 'usage_needed'].includes(status);
}

function trackerCardStatusClass(
  status: DealerMaintenanceTrackerStatus,
): string {
  if (needsAttention(status)) return leadStyles.leadThreadNew;
  if (status === 'no_open') return leadStyles.leadThreadDone;
  return leadStyles.leadThreadActive;
}

function matchesSearch(asset: DealerMaintenanceTrackedAsset, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    asset.ownerName,
    asset.assetTitle,
    asset.assetKind,
    asset.brandName,
    asset.modelName,
    asset.serialNumber,
    asset.statusLabel,
    asset.nextMaintenance?.title,
    ...asset.maintenanceRecords.map((record) => `${record.title} ${record.notes} ${record.completedNotes}`),
    ...asset.loggedProblems.map((problem) => `${problem.summary} ${problem.note} ${problem.operatorName} ${problem.notedAtIso ? 'resolved noted' : 'open active'}`),
    ...asset.scheduleProposals.map((proposal) => `${proposal.title} ${proposal.notes} ${proposal.status} ${proposal.maintenanceType}`),
  ].some((value) => String(value || '').toLowerCase().includes(query));
}

function matchesMaintenanceSearch(record: DealerMaintenanceRecordSummary, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    record.title,
    record.maintenanceType,
    record.computedStatusLabel,
    record.assignedName,
    record.notes,
    record.completedNotes,
    record.completedBy,
  ].some((value) => String(value || '').toLowerCase().includes(query));
}

function matchesProblemSearch(
  problem: DealerMaintenanceTrackedAsset['loggedProblems'][number],
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    problem.summary,
    problem.note,
    problem.operatorName,
    problem.actorType,
    problem.notedAtIso ? 'resolved noted completed' : 'open active',
  ].some((value) => String(value || '').toLowerCase().includes(query));
}

function johannesburgDateKey(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Africa/Johannesburg',
  }).formatToParts(parsed);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
}

function matchesDateRange(value: string | null | undefined, fromDate: string, toDate: string): boolean {
  const key = johannesburgDateKey(value);
  if (!key) return !fromDate && !toDate;
  if (fromDate && key < fromDate) return false;
  if (toDate && key > toDate) return false;
  return true;
}

function maintenanceHistoryDate(record: DealerMaintenanceRecordSummary): string {
  return record.completedAtIso || record.updatedAtIso || record.createdAtIso;
}

function timeValue(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function Dropdown({
  label,
  value,
  options,
  dropdownKey,
  openDropdown,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  dropdownKey: string;
  openDropdown: string | null;
  onOpenChange: (key: string | null) => void;
  onChange: (value: string) => void;
}) {
  const isOpen = openDropdown === dropdownKey;
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <label className={`${assetStyles.field} ${leadStyles.leadFilterField} ${isOpen ? leadStyles.leadFilterFieldOpen : ''}`}>
      <span>{label}</span>
      <div className={leadStyles.leadFilterDropdown}>
        <button
          type="button"
          className={`${leadStyles.leadFilterSelectButton} ${isOpen ? leadStyles.leadFilterSelectButtonOpen : ''}`}
          onClick={() => onOpenChange(isOpen ? null : dropdownKey)}
          aria-expanded={isOpen}
        >
          <span>{selected?.label || 'Choose'}</span>
          <ChevronDownIcon className={leadStyles.leadFilterSelectIcon} />
        </button>
        {isOpen ? (
          <div className={leadStyles.leadFilterSelectMenu} role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`${leadStyles.leadFilterSelectOption} ${option.value === value ? leadStyles.leadFilterSelectOptionActive : ''}`}
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(null);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function RecordCard({ record, asset }: { record: DealerMaintenanceRecordSummary; asset: DealerMaintenanceTrackedAsset }) {
  return (
    <article className={styles.recordCard}>
      <header>
        <div>
          <span>{record.maintenanceType === 'checkup' ? 'Checkup' : 'Service'}</span>
          <h4>{record.title}</h4>
        </div>
        <strong className={record.status === 'done' ? styles.recordDone : styles.recordOpen}>{record.computedStatusLabel}</strong>
      </header>
      <div className={styles.recordGrid}>
        <div><span>Due</span><strong>{dueLabel(record, asset.usageMetric)}</strong></div>
        <div><span>Current usage</span><strong>{formatUsage(record.currentUsage, record.usageMetric || asset.usageMetric)}</strong></div>
        <div><span>{record.status === 'done' ? 'Completed usage' : 'Remaining'}</span><strong>{record.status === 'done' ? formatUsage(record.completedUsage, record.usageMetric || asset.usageMetric) : remainingLabel(record, asset.usageMetric)}</strong></div>
        <div><span>Assigned to</span><strong>{record.assignedName || 'Unassigned'}</strong></div>
        <div><span>Recurring</span><strong>{recurringLabel(record)}</strong></div>
        <div><span>Updated</span><strong>{formatDate(record.updatedAtIso)}</strong></div>
      </div>
      {record.notes ? <div className={styles.note}><span>Maintenance note</span><p>{record.notes}</p></div> : null}
      {record.completedNotes ? <div className={`${styles.note} ${styles.completedNote}`}><span>Completion note</span><p>{record.completedNotes}</p>{record.completedBy ? <small>Completed by {record.completedBy}</small> : null}</div> : null}
    </article>
  );
}

function ProblemCard({
  problem,
  historical = false,
}: {
  problem: DealerMaintenanceTrackedAsset['loggedProblems'][number];
  historical?: boolean;
}) {
  const resolved = Boolean(problem.notedAtIso);
  return (
    <article className={`${styles.problemCard} ${resolved ? styles.problemCardResolved : ''}`}>
      <header>
        <div>
          <span>{historical ? 'Problem or note' : 'Active problem or note'}</span>
          <h4>{problem.summary || 'Logged problem or note'}</h4>
        </div>
        <strong className={resolved ? styles.problemResolved : styles.problemOpen}>
          {resolved ? 'Noted / resolved' : 'Open'}
        </strong>
      </header>
      <p>{problem.note}</p>
      <div className={styles.problemMetaGrid}>
        <div><span>Logged</span><strong>{formatDate(problem.createdAtIso, true)}</strong></div>
        <div><span>Logged by</span><strong>{problem.operatorName || 'Not recorded'}</strong></div>
        <div><span>Status</span><strong>{resolved ? 'Noted / resolved' : 'Open'}</strong></div>
        <div><span>Resolution</span><strong>{problem.notedAtIso ? formatDate(problem.notedAtIso, true) : 'Not resolved yet'}</strong></div>
      </div>
    </article>
  );
}

function ProposalCard({ proposal }: { proposal: DealerMaintenanceScheduleProposal }) {
  const status = proposal.status === 'approved'
    ? 'Approved'
    : proposal.status === 'declined'
      ? 'Disapproved'
      : 'Awaiting owner approval';
  const due = proposal.triggerType === 'date'
    ? formatDate(proposal.dueDate)
    : formatUsage(proposal.dueUsage, proposal.usageMetric);
  return (
    <article className={`${styles.recordCard} ${styles.proposalCard}`}>
      <header>
        <div>
          <span>Dealer-created {proposal.maintenanceType === 'checkup' ? 'checkup' : 'service'}</span>
          <h4>{proposal.title}</h4>
        </div>
        <strong className={
          proposal.status === 'approved'
            ? styles.proposalApproved
            : proposal.status === 'declined'
              ? styles.proposalDeclined
              : styles.proposalPending
        }>
          {status}
        </strong>
      </header>
      <div className={styles.recordGrid}>
        <div><span>Due</span><strong>{due}</strong></div>
        <div><span>Created</span><strong>{formatDate(proposal.createdAtIso)}</strong></div>
        <div><span>Visibility</span><strong>{proposal.status === 'declined' ? 'Dealer only' : proposal.status === 'approved' ? 'Dealer and owner' : 'Owner decision pending'}</strong></div>
      </div>
      {proposal.notes ? <div className={styles.note}><span>Proposal note</span><p>{proposal.notes}</p></div> : null}
    </article>
  );
}

export default function DealerMaintenanceTrackerClient({ initialAssets, dealerAppMode = false, initialOpenAccessId = null }: Props) {
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<TrackerStatusFilter>('all');
  const [draftOwnerFilter, setDraftOwnerFilter] = useState('all');
  const [draftStatusFilter, setDraftStatusFilter] = useState<TrackerStatusFilter>('all');
  const [openFilterDropdown, setOpenFilterDropdown] = useState<FilterDropdownKey | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [photoIndexes, setPhotoIndexes] = useState<Record<string, number>>({});
  const [photoModal, setPhotoModal] = useState<TrackerPhotoModal | null>(null);
  const [openAccessId, setOpenAccessId] = useState<string | null>(
    initialAssets.some((asset) => asset.accessId === initialOpenAccessId) ? initialOpenAccessId : null,
  );
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [maintenanceViewAccessId, setMaintenanceViewAccessId] = useState<string | null>(null);
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [historyRecordType, setHistoryRecordType] = useState<HistoryRecordType>('all');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [openHistoryDropdown, setOpenHistoryDropdown] = useState<string | null>(null);
  const [historyAccessCheckId, setHistoryAccessCheckId] = useState<string | null>(null);
  const [reportAccessId, setReportAccessId] = useState<string | null>(null);
  const [costReportAccessId, setCostReportAccessId] = useState<string | null>(null);
  const [scheduleAccessId, setScheduleAccessId] = useState<string | null>(null);
  const [managedAccessId, setManagedAccessId] = useState<string | null>(null);
  const [deleteTrackingTarget, setDeleteTrackingTarget] = useState<DealerMaintenanceTrackedAsset | null>(null);
  const [isDeletingTracking, setIsDeletingTracking] = useState(false);

  useEffect(() => setAssets(initialAssets), [initialAssets]);

  useEffect(() => {
    let cancelled = false;

    async function revalidateVisibleAccess() {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/dealer/maintenance', { credentials: 'include', cache: 'no-store' });
        const payload = await response.json().catch(() => null) as TrackerResponse | null;
        if (!cancelled && response.ok && payload?.ok && Array.isArray(payload.assets)) {
          setAssets(payload.assets);
        }
      } catch {
        // Keep the last successful view during a temporary network failure.
      }
    }

    const intervalId = window.setInterval(() => void revalidateVisibleAccess(), 30_000);
    const handleFocus = () => void revalidateVisibleAccess();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const ownerOptions = useMemo<Option[]>(() => [
    { value: 'all', label: 'All asset owners' },
    ...Array.from(new Map(assets.map((asset) => [asset.ownerUserId, asset.ownerName])).entries())
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([value, label]) => ({ value, label })),
  ], [assets]);

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    if (!matchesSearch(asset, search)) return false;
    if (ownerFilter !== 'all' && asset.ownerUserId !== ownerFilter) return false;
    if (statusFilter === 'attention' && !needsAttention(asset.status)) return false;
    if (statusFilter === 'upcoming' && asset.status !== 'upcoming') return false;
    if (statusFilter === 'no_open' && asset.status !== 'no_open') return false;
    return true;
  }), [assets, ownerFilter, search, statusFilter]);

  const attentionCount = assets.filter((asset) => needsAttention(asset.status)).length;
  const noOpenCount = assets.filter((asset) => asset.status === 'no_open').length;
  const hasActiveFilter = ownerFilter !== 'all' || statusFilter !== 'all';
  const activeFilterLabel = hasActiveFilter ? 'Filtered' : 'Filter';
  const managedAsset = managedAccessId
    ? assets.find((asset) => asset.accessId === managedAccessId) ?? null
    : null;
  const costReportAsset = costReportAccessId
    ? assets.find((asset) => asset.accessId === costReportAccessId) ?? null
    : null;

  async function refresh() {
    if (loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/dealer/maintenance', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as TrackerResponse | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.assets)) {
        throw new Error(payload?.error || 'Failed to refresh the Maintenance Tracker.');
      }
      setAssets(payload.assets);
      setNotice({ tone: 'success', text: 'Maintenance Tracker refreshed.' });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Failed to refresh the Maintenance Tracker.' });
    } finally {
      setLoading(false);
    }
  }

  function openFilters() {
    setDraftOwnerFilter(ownerFilter);
    setDraftStatusFilter(statusFilter);
    setOpenFilterDropdown(null);
    setFilterOpen(true);
  }

  function clearFilters() {
    setOwnerFilter('all');
    setStatusFilter('all');
    setDraftOwnerFilter('all');
    setDraftStatusFilter('all');
    setFilterOpen(false);
  }

  function openAsset(asset: DealerMaintenanceTrackedAsset) {
    setOpenAccessId(asset.accessId);
    if (maintenanceViewAccessId !== asset.accessId) {
      setMaintenanceViewAccessId(null);
      clearHistoryFilters();
    }
  }

  function closeAsset() {
    setOpenAccessId(null);
    setMaintenanceViewAccessId(null);
    setManagedAccessId(null);
    clearHistoryFilters();
  }

  function clearHistoryFilters() {
    setMaintenanceSearch('');
    setHistoryRecordType('all');
    setHistoryFromDate('');
    setHistoryToDate('');
    setOpenHistoryDropdown(null);
  }

  async function toggleMaintenance(asset: DealerMaintenanceTrackedAsset) {
    if (maintenanceViewAccessId === asset.accessId) {
      setMaintenanceViewAccessId(null);
      clearHistoryFilters();
      return;
    }

    if (historyAccessCheckId) return;
    setHistoryAccessCheckId(asset.accessId);
    setNotice(null);
    try {
      const response = await fetch('/api/dealer/maintenance', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as TrackerResponse | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.assets)) {
        throw new Error(payload?.error || 'Failed to confirm maintenance tracking access.');
      }
      setAssets(payload.assets);
      if (!payload.assets.some((entry) => entry.accessId === asset.accessId)) {
        setOpenAccessId(null);
        setMaintenanceViewAccessId(null);
        throw new Error('This asset is no longer shared with your dealership.');
      }
      clearHistoryFilters();
      setMaintenanceViewAccessId(asset.accessId);
    } catch (cause) {
      setNotice({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Failed to confirm maintenance tracking access.',
      });
    } finally {
      setHistoryAccessCheckId(null);
    }
  }

  function selectedPhotoIndex(asset: DealerMaintenanceTrackedAsset): number {
    if (!asset.photoUrls.length) return 0;
    return Math.min(
      Math.max(photoIndexes[asset.accessId] ?? 0, 0),
      asset.photoUrls.length - 1,
    );
  }

  function selectPhoto(asset: DealerMaintenanceTrackedAsset, index: number) {
    if (!asset.photoUrls.length) return;
    setPhotoIndexes((current) => ({
      ...current,
      [asset.accessId]: Math.min(
        Math.max(index, 0),
        asset.photoUrls.length - 1,
      ),
    }));
  }

  function cyclePhoto(asset: DealerMaintenanceTrackedAsset, direction: -1 | 1) {
    if (asset.photoUrls.length <= 1) return;
    const currentIndex = selectedPhotoIndex(asset);
    selectPhoto(
      asset,
      (currentIndex + direction + asset.photoUrls.length) %
        asset.photoUrls.length,
    );
  }

  function openPhotoModal(
    asset: DealerMaintenanceTrackedAsset,
    index: number,
  ) {
    if (!asset.photoUrls.length) return;
    setPhotoModal({
      accessId: asset.accessId,
      title: asset.assetTitle,
      urls: [...asset.photoUrls],
      index: Math.min(Math.max(index, 0), asset.photoUrls.length - 1),
    });
  }

  function openWhatsApp(asset: DealerMaintenanceTrackedAsset) {
    const phone = cleanPhoneForWhatsApp(asset.ownerPhone);
    if (!phone) {
      setNotice({ tone: 'error', text: 'No owner cellphone number is saved for this tracked asset.' });
      return;
    }
    const message = encodeURIComponent(`Good day ${asset.ownerName}, I am following up about maintenance tracking for ${asset.assetTitle} on Aim4price.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
    setManagedAccessId(null);
  }

  function callOwner(asset: DealerMaintenanceTrackedAsset) {
    const phone = cleanPhoneForTel(asset.ownerPhone);
    if (!phone) {
      setNotice({ tone: 'error', text: 'No owner contact number is saved for this tracked asset.' });
      return;
    }
    setManagedAccessId(null);
    window.location.href = `tel:${phone}`;
  }

  function emailOwner(asset: DealerMaintenanceTrackedAsset) {
    const email = cleanEmail(asset.ownerEmail);
    if (!email) {
      setNotice({ tone: 'error', text: 'No owner email address is saved for this tracked asset.' });
      return;
    }
    const subject = `Aim4price maintenance tracking: ${asset.assetTitle}`;
    const body = `Good day ${asset.ownerName},\n\nI am following up about maintenance tracking for ${asset.assetTitle} on Aim4price.\n\nKind regards`;
    setManagedAccessId(null);
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function closeDeleteTrackingModal() {
    if (isDeletingTracking) return;
    setDeleteTrackingTarget(null);
  }

  async function confirmDeleteTracking() {
    if (!deleteTrackingTarget || isDeletingTracking) return;
    const accessId = deleteTrackingTarget.accessId;
    setIsDeletingTracking(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/dealer/maintenance/${encodeURIComponent(accessId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null) as TrackerResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to delete the tracked asset.');
      }

      setAssets((current) => current.filter((asset) => asset.accessId !== accessId));
      setOpenAccessId((current) => (current === accessId ? null : current));
      setMaintenanceViewAccessId((current) => (current === accessId ? null : current));
      setManagedAccessId((current) => (current === accessId ? null : current));
      setReportAccessId((current) => (current === accessId ? null : current));
      setScheduleAccessId((current) => (current === accessId ? null : current));
      setPhotoIndexes((current) => {
        const next = { ...current };
        delete next[accessId];
        return next;
      });
      setDeleteTrackingTarget(null);
      clearHistoryFilters();
      setNotice({ tone: 'success', text: 'Asset removed from Maintenance Tracker.' });
    } catch (cause) {
      setNotice({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Failed to delete the tracked asset.',
      });
    } finally {
      setIsDeletingTracking(false);
    }
  }

  return (
    <main className={`${assetStyles.page} ${workspaceStyles.page} ${leadStyles.leadsPage} ${leadStyles.dealerOwnerParity} ${styles.trackerPage} ${dealerAppMode ? styles.dealerApp : ''}`}>
      <section className={`${assetStyles.shell} ${workspaceStyles.shell}`}>
        {notice ? <div className={`${assetStyles.notice} ${notice.tone === 'success' ? assetStyles.noticeSuccess : assetStyles.noticeError}`}>{notice.text}</div> : null}

        <section className={`${assetStyles.registerPanel} ${leadStyles.leadsRegisterPanel}`}>
          <WorkspaceTitlePanel title="Maintenance Tracker" />

          <section className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${leadStyles.leadSummaryRow}`} aria-label="Maintenance Tracker summary">
            <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardNew}`}>
              <div className={assetStyles.heroSummaryHead}><span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>Needs attention</span></div>
              <div className={assetStyles.heroSummaryValueRow}><strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>{attentionCount}</strong></div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}><small className={leadStyles.leadOwnerSummaryText}>Due, overdue, due soon or awaiting usage.</small></div>
            </article>
            <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardOpen}`}>
              <div className={assetStyles.heroSummaryHead}><span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>Tracked equipment</span></div>
              <div className={assetStyles.heroSummaryValueRow}><strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>{assets.length}</strong></div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}><small className={leadStyles.leadOwnerSummaryText}>Actively shared by owners or Field Managers.</small></div>
            </article>
            <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardDone}`}>
              <div className={assetStyles.heroSummaryHead}><span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>No open maintenance</span></div>
              <div className={assetStyles.heroSummaryValueRow}><strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>{noOpenCount}</strong></div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}><small className={leadStyles.leadOwnerSummaryText}>Still tracked with completed history retained.</small></div>
            </article>
          </section>

          <div className={`${assetStyles.toolbar} ${workspaceStyles.controlsRow} ${leadStyles.leadSearchToolbar}`}>
            <label className={`${assetStyles.searchWrap} ${workspaceStyles.searchField}`}>
              <SearchIcon className={assetStyles.searchIcon} />
              <input className={assetStyles.searchInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owner, equipment, serial or maintenance" aria-label="Search tracked equipment" />
              {search ? <button type="button" className={assetStyles.clearSearchButton} onClick={() => setSearch('')} aria-label="Clear search"><CloseIcon className={assetStyles.buttonIcon} /></button> : null}
            </label>
            <div className={leadStyles.leadToolbarActions}>
              <button type="button" className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${leadStyles.leadRefreshButton}`} onClick={() => void refresh()} disabled={loading}>
                <RefreshIcon className={`${assetStyles.buttonIcon} ${loading ? leadStyles.leadRefreshIconActive : ''}`} /><span>Refresh</span>
              </button>
              <button type="button" className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionMint} ${leadStyles.leadFilterButton} ${hasActiveFilter ? assetStyles.filterTriggerButtonActive : ''}`} onClick={openFilters} disabled={loading}>
                <FilterIcon className={assetStyles.buttonIcon} /><span>{activeFilterLabel}</span><ChevronDownIcon className={assetStyles.filterChevron} />
              </button>
            </div>
          </div>

          <div className={`${leadStyles.leadResultSummary} ${leadStyles.leadResultSummaryDealer}`}>
            <span>Showing</span><strong>{filteredAssets.length}</strong><span>of {assets.length} tracked assets</span>
          </div>

          {!filteredAssets.length ? <div className={`${assetStyles.emptyState} ${workspaceStyles.emptyState}`}>{assets.length ? 'No tracked assets match this search or filter.' : 'No tracked assets yet. Assets appear here after an owner or Field Manager enables dealer maintenance tracking.'}</div> : null}

          <div className={leadStyles.leadStack}>
            {filteredAssets.map((asset) => {
              const isOpen = openAccessId === asset.accessId;
              const photoIndex = selectedPhotoIndex(asset);
              const activePhotoUrl = asset.photoUrls[photoIndex] ?? '';
              const hasMultiplePhotos = asset.photoUrls.length > 1;
              const isMaintenanceOpen = maintenanceViewAccessId === asset.accessId;
              const activeProblems = asset.loggedProblems.filter((problem) => !problem.notedAtIso);
              const historyItems = [
                ...asset.completedMaintenanceRecords.map((record) => ({
                  kind: 'maintenance' as const,
                  id: record.id,
                  dateIso: maintenanceHistoryDate(record),
                  record,
                })),
                ...asset.loggedProblems.map((problem) => ({
                  kind: 'issue' as const,
                  id: problem.id,
                  dateIso: problem.createdAtIso,
                  problem,
                })),
              ]
                .filter((item) => {
                  if (historyRecordType === 'maintenance' && item.kind !== 'maintenance') return false;
                  if (historyRecordType === 'issues' && item.kind !== 'issue') return false;
                  if (!matchesDateRange(item.dateIso, historyFromDate, historyToDate)) return false;
                  return item.kind === 'maintenance'
                    ? matchesMaintenanceSearch(item.record, maintenanceSearch)
                    : matchesProblemSearch(item.problem, maintenanceSearch);
                })
                .sort((left, right) => timeValue(right.dateIso) - timeValue(left.dateIso));
              const totalHistoryCount = asset.completedMaintenanceRecords.length + asset.loggedProblems.length;
              const historyFiltersActive = Boolean(
                maintenanceSearch
                || historyRecordType !== 'all'
                || historyFromDate
                || historyToDate,
              );
              const isHistoryChecking = historyAccessCheckId === asset.accessId;
              return (
                <article key={asset.accessId} className={`${workspaceStyles.card} ${leadStyles.leadThread} ${trackerCardStatusClass(asset.status)} ${isOpen ? leadStyles.leadThreadOpen : ''}`}>
                  <div className={leadStyles.clientPanel}>
                    <div className={leadStyles.clientPanelHeader}>
                      <div className={leadStyles.clientIdentity}>
                        <div className={leadStyles.leadCardTitleRow}><h3>{asset.ownerName}</h3></div>
                        <strong className={leadStyles.leadAssetName}>{asset.assetTitle}</strong>
                        <span className={leadStyles.clientKicker}>{[asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind} · {asset.statusLabel}</span>
                      </div>
                      <div className={leadStyles.clientDecisionArea}>
                        <div className={leadStyles.clientActionRow}>
                          {isOpen ? (
                            <>
                              <button
                                type="button"
                                className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionDanger} ${leadStyles.deleteLeadButton}`}
                                onClick={() => setDeleteTrackingTarget(asset)}
                              >
                                Delete
                              </button>
                              <button type="button" className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${leadStyles.closeLeadButton}`} onClick={closeAsset}>Close</button>
                            </>
                          ) : (
                            <button type="button" className={`${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${leadStyles.openLeadButton}`} onClick={() => openAsset(asset)}>Open</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className={`${assetStyles.assetCard} ${leadStyles.leadAssetCard} ${assetStyles.assetCardExpanded}`}>
                      <div className={`${assetStyles.assetHeader} ${leadStyles.leadAssetHeader}`}>
                        <div className={assetStyles.assetTitleBlock}>
                          <h2>{asset.assetTitle}</h2>
                          <p>{trackingAssetMeta(asset)}</p>
                          <div className={assetStyles.assetMetaRow}><span className={assetStyles.assetSavedDateLabel}>Tracking shared by {asset.grantedByName || 'the asset owner'}</span></div>
                        </div>
                        <div className={`${assetStyles.assetHeaderAside} ${leadStyles.leadAssetHeaderAside}`}>
                          <div className={`${assetStyles.valueBlock} ${leadStyles.leadValueBlock} ${styles.trackerStatusValue}`}>
                            <strong>{asset.statusLabel}</strong>
                            <span>Maintenance status</span>
                          </div>

                          <div className={`${assetStyles.assetHeaderActions} ${leadStyles.leadAssetHeaderActions} ${styles.trackerHeaderActions}`}>
                            <button
                              type="button"
                              className={`${assetStyles.optionsButton} ${assetStyles.sharedNoteActionButton} ${styles.maintenanceViewButton}`}
                              onClick={() => void toggleMaintenance(asset)}
                              disabled={Boolean(historyAccessCheckId)}
                              aria-expanded={isMaintenanceOpen}
                              aria-controls={`maintenance-view-${asset.accessId}`}
                              aria-label="View maintenance history"
                            >
                              <MaintenanceIcon className={assetStyles.buttonIcon} />
                              <span>
                                {isHistoryChecking
                                  ? 'Checking…'
                                  : 'History'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`${assetStyles.optionsButton} ${leadStyles.leadManageButton} ${styles.manageButton}`}
                              onClick={() => setManagedAccessId(asset.accessId)}
                              aria-label={`Manage ${asset.assetTitle}`}
                            >
                              <ManageIcon className={assetStyles.buttonIcon} />
                              <span>Manage</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className={`${assetStyles.assetBody} ${leadStyles.leadAssetBody} ${styles.trackerAssetBody}`}>
                        <div className={`${assetStyles.previewWrap} ${leadStyles.leadPreviewWrap}`}>
                          <div className={`${assetStyles.previewStage} ${leadStyles.leadPreviewStage}`}>
                            {activePhotoUrl ? (
                              <>
                                <button
                                  type="button"
                                  className={leadStyles.leadPreviewOpenButton}
                                  onClick={() => openPhotoModal(asset, photoIndex)}
                                  aria-label={`Open ${asset.assetTitle} photo ${photoIndex + 1}`}
                                >
                                  <img
                                    src={activePhotoUrl}
                                    alt={`${asset.assetTitle} photo ${photoIndex + 1}`}
                                    className={`${assetStyles.previewImage} ${leadStyles.leadPreviewImage}`}
                                  />
                                  <span className={leadStyles.leadPreviewOpenLabel}>Open photo</span>
                                </button>

                                {hasMultiplePhotos ? (
                                  <>
                                    <button
                                      type="button"
                                      className={`${assetStyles.previewNavButton} ${assetStyles.previewNavPrev}`}
                                      onClick={() => cyclePhoto(asset, -1)}
                                      aria-label="Show previous photo"
                                    >
                                      <ChevronLeftIcon className={assetStyles.buttonIcon} />
                                    </button>
                                    <button
                                      type="button"
                                      className={`${assetStyles.previewNavButton} ${assetStyles.previewNavNext}`}
                                      onClick={() => cyclePhoto(asset, 1)}
                                      aria-label="Show next photo"
                                    >
                                      <ChevronRightIcon className={assetStyles.buttonIcon} />
                                    </button>
                                    <div className={assetStyles.previewCounter}>
                                      {photoIndex + 1} / {asset.photoUrls.length}
                                    </div>
                                  </>
                                ) : null}
                              </>
                            ) : (
                              <div className={`${assetStyles.previewPlaceholder} ${leadStyles.leadPreviewPlaceholder}`}>
                                <div className={assetStyles.previewPlaceholderBadges}>
                                  <span className={`${assetStyles.badge} ${assetStyles.badgeNeutral} ${assetStyles.previewPlaceholderBadge}`}>
                                    {asset.assetKind || 'Tracked asset'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {hasMultiplePhotos ? (
                            <div className={`${assetStyles.previewThumbRow} ${leadStyles.leadPreviewThumbRow}`}>
                              {asset.photoUrls.map((url, index) => (
                                <button
                                  type="button"
                                  key={`${asset.accessId}-tracking-photo-${index}`}
                                  className={`${assetStyles.previewThumbButton} ${leadStyles.leadPreviewThumbButton} ${index === photoIndex ? assetStyles.previewThumbButtonActive : ''}`}
                                  onClick={() => {
                                    selectPhoto(asset, index);
                                    openPhotoModal(asset, index);
                                  }}
                                  aria-label={`Open photo ${index + 1}`}
                                >
                                  <img
                                    src={url}
                                    alt={`${asset.assetTitle} thumbnail ${index + 1}`}
                                    className={`${assetStyles.previewThumbImage} ${leadStyles.leadPreviewThumbImage}`}
                                  />
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className={assetStyles.assetDetailDivider} aria-hidden="true" />

                        <div className={assetStyles.assetDetailsPanel}>
                          <div className={assetStyles.assetDetailsGrid}>
                            <div className={assetStyles.assetPrimaryDetails}>
                              <div className={assetStyles.assetDetailRow}><span>Serial</span><strong>{asset.serialNumber || 'Not saved'}</strong></div>
                              <div className={assetStyles.assetDetailRow}><span>Year</span><strong>{asset.yearModel || 'Not saved'}</strong></div>
                              <div className={assetStyles.assetDetailRow}><span>Usage</span><strong>{formatUsage(asset.currentUsage, asset.usageMetric)}</strong></div>
                              <div className={assetStyles.assetDetailRow}><span>Status</span><strong>{asset.statusLabel}</strong></div>
                            </div>

                            <div className={assetStyles.assetPrimaryDetails}>
                              <div className={assetStyles.assetDetailRow}><span>Next</span><strong>{asset.nextMaintenance?.title || 'No open maintenance'}</strong></div>
                              <div className={assetStyles.assetDetailRow}><span>Due</span><strong>{asset.nextMaintenance ? dueLabel(asset.nextMaintenance, asset.usageMetric) : 'Not scheduled'}</strong></div>
                              <div className={assetStyles.assetDetailRow}><span>Remaining</span><strong>{asset.nextMaintenance ? remainingLabel(asset.nextMaintenance, asset.usageMetric) : 'No open schedule'}</strong></div>
                              <div className={assetStyles.assetDetailRow}><span>Shared by</span><strong>{asset.grantedByName || 'Asset owner'}</strong></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.trackerSections}>
                        <details className={styles.section}>
                          <summary>
                            <div><span>Current schedule</span><h3>Upcoming maintenance</h3></div>
                            <strong>
                              {asset.openMaintenanceRecords.length}
                              <ChevronDownIcon className={styles.sectionChevron} />
                            </strong>
                          </summary>
                          {asset.openMaintenanceRecords.length ? (
                            <div className={styles.recordList}>
                              {asset.openMaintenanceRecords.map((record) => (
                                <RecordCard key={record.id} record={record} asset={asset} />
                              ))}
                            </div>
                          ) : (
                            <div className={styles.sectionEmpty}>No upcoming maintenance is scheduled for this asset.</div>
                          )}
                        </details>

                        {asset.permissions.canViewLoggedProblems ? (
                          <section className={styles.section}>
                            <header>
                              <div><span>Needs attention</span><h3>Active problems and notes</h3></div>
                              <strong>{activeProblems.length}</strong>
                            </header>
                            {activeProblems.length ? (
                              <div className={styles.problemList}>
                                {activeProblems.map((problem) => (
                                  <ProblemCard key={problem.id} problem={problem} />
                                ))}
                              </div>
                            ) : (
                              <div className={styles.sectionEmpty}>No active problems or notes have been logged for this asset.</div>
                            )}
                          </section>
                        ) : null}

                        {asset.scheduleProposals.length ? (
                          <section className={styles.section}>
                            <header>
                              <div><span>Dealer-created schedules</span><h3>Schedule proposals</h3></div>
                              <strong>{asset.scheduleProposals.length}</strong>
                            </header>
                            <div className={styles.recordList}>
                              {asset.scheduleProposals.map((proposal) => (
                                <ProposalCard key={proposal.id} proposal={proposal} />
                              ))}
                            </div>
                          </section>
                        ) : null}

                        {isMaintenanceOpen ? (
                          <section id={`maintenance-view-${asset.accessId}`} className={styles.maintenanceViewPanel}>
                            <header className={styles.maintenanceViewHeader}>
                              <div>
                                <span>Saved records</span>
                                <h3>Maintenance history</h3>
                                <p>Search completed maintenance, logged problems and notes by text or saved date.</p>
                              </div>
                              <strong>{historyFiltersActive ? `${historyItems.length} of ${totalHistoryCount}` : totalHistoryCount}</strong>
                            </header>

                            <div className={styles.historyToolbar}>
                              <label className={styles.maintenanceSearchField}>
                                <SearchIcon className={styles.maintenanceSearchIcon} />
                                <input
                                  type="search"
                                  value={maintenanceSearch}
                                  onChange={(event) => setMaintenanceSearch(event.target.value)}
                                  placeholder="Search maintenance, problems, notes, people or status"
                                  aria-label={`Search maintenance history for ${asset.assetTitle}`}
                                />
                                {maintenanceSearch ? (
                                  <button type="button" onClick={() => setMaintenanceSearch('')} aria-label="Clear history search">
                                    <CloseIcon className={assetStyles.buttonIcon} />
                                  </button>
                                ) : null}
                              </label>

                              <div className={styles.historyRecordTypeField}>
                                <Dropdown
                                  label="Record type"
                                  value={historyRecordType}
                                  options={historyRecordTypeOptions}
                                  dropdownKey="history-record-type"
                                  openDropdown={openHistoryDropdown}
                                  onOpenChange={setOpenHistoryDropdown}
                                  onChange={(value) => setHistoryRecordType(value as HistoryRecordType)}
                                />
                              </div>

                              <label className={styles.historyDateField}>
                                <span>From date</span>
                                <input
                                  type="date"
                                  value={historyFromDate}
                                  onChange={(event) => setHistoryFromDate(event.target.value)}
                                  aria-label={`Maintenance history from date for ${asset.assetTitle}`}
                                />
                              </label>

                              <label className={styles.historyDateField}>
                                <span>To date</span>
                                <input
                                  type="date"
                                  value={historyToDate}
                                  onChange={(event) => setHistoryToDate(event.target.value)}
                                  aria-label={`Maintenance history to date for ${asset.assetTitle}`}
                                />
                              </label>

                              <button
                                type="button"
                                className={`${assetStyles.secondaryButton} ${styles.historyClearButton}`}
                                onClick={clearHistoryFilters}
                                disabled={!historyFiltersActive}
                              >
                                Clear filters
                              </button>
                            </div>

                            {historyItems.length ? (
                              <div className={styles.historyResults}>
                                {historyItems.map((item) => item.kind === 'maintenance'
                                  ? <RecordCard key={`maintenance-${item.id}`} record={item.record} asset={asset} />
                                  : <ProblemCard key={`issue-${item.id}`} problem={item.problem} historical />)}
                              </div>
                            ) : (
                              <div className={styles.sectionEmpty}>
                                {historyFiltersActive
                                  ? 'No maintenance, problems or notes match these history filters.'
                                  : 'No completed maintenance, problems or notes have been saved yet.'}
                              </div>
                            )}
                          </section>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </section>

      {deleteTrackingTarget ? (
        <div className={`${assetStyles.modalOverlay} ${assetStyles.confirmDeleteOverlay} ${workspaceStyles.modalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeDeleteTrackingModal} />
          <div
            className={`${assetStyles.deleteConfirmModal} ${workspaceStyles.modal} ${leadStyles.leadDeleteModal} ${styles.trackerDeleteModal}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-tracking-title"
            aria-describedby="delete-tracking-copy"
          >
            <div className={`${assetStyles.deleteConfirmContent} ${leadStyles.leadDeleteContent}`}>
              <div className={`${assetStyles.deleteConfirmHeader} ${workspaceStyles.modalHeader} ${leadStyles.leadDeleteHeader}`}>
                <div>
                  <h3 id="delete-tracking-title">Delete tracking?</h3>
                  <p id="delete-tracking-copy">This removes the asset from your Maintenance Tracker.</p>
                </div>
                <button
                  type="button"
                  className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose} ${leadStyles.leadDeleteCloseButton}`}
                  onClick={closeDeleteTrackingModal}
                  aria-label="Close tracking delete confirmation"
                  disabled={isDeletingTracking}
                >
                  <CloseIcon className={assetStyles.buttonIcon} />
                </button>
              </div>

              <div className={`${assetStyles.deleteConfirmAsset} ${leadStyles.leadDeleteSummary}`}>
                <span>Selected tracking</span>
                <strong>{deleteTrackingTarget.ownerName}</strong>
                <small>{deleteTrackingTarget.assetTitle} · {trackingDeleteAssetMeta(deleteTrackingTarget)}</small>
              </div>

              <div className={leadStyles.leadDeleteWarning}>
                <strong>Maintenance tracking access will stop.</strong>
                <span>The owner’s records stay saved and they can share this asset with you again.</span>
              </div>

              <div className={`${assetStyles.deleteConfirmActions} ${workspaceStyles.modalFooter} ${leadStyles.leadDeleteActions}`}>
                <button type="button" className={assetStyles.secondaryButton} onClick={closeDeleteTrackingModal} disabled={isDeletingTracking}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${assetStyles.primaryButton} ${assetStyles.deleteConfirmButton} ${leadStyles.leadDeleteConfirmButton}`}
                  onClick={() => void confirmDeleteTracking()}
                  disabled={isDeletingTracking}
                >
                  <span>{isDeletingTracking ? 'Deleting...' : 'Delete tracking'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {managedAsset ? (
        <div className={`${assetStyles.modalOverlay} ${workspaceStyles.modalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={() => setManagedAccessId(null)} />
          <div className={`${assetStyles.optionsModal} ${workspaceStyles.modal} ${leadStyles.leadManageModal} ${styles.trackerManageModal}`} role="dialog" aria-modal="true" aria-labelledby="tracking-manage-title">
            <div className={`${assetStyles.modalHeader} ${assetStyles.optionsModalHeader} ${workspaceStyles.modalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="tracking-manage-title">{managedAsset.assetTitle}</h3>
                <p>{trackingAssetMeta(managedAsset)}</p>
              </div>
              <button type="button" className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose}`} onClick={() => setManagedAccessId(null)} aria-label="Close tracking management">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${assetStyles.modalScrollBody} ${assetStyles.optionsScrollBody} ${workspaceStyles.modalBody} ${styles.trackerManageBody}`}>
              <div className={assetStyles.optionsContent}>
                <div className={`${assetStyles.optionsGrid} ${assetStyles.assetOptionsGrid} ${leadStyles.manageOptionsGrid}`}>
                  <button
                    type="button"
                    className={`${assetStyles.optionActionButton} ${assetStyles.optionFeaturedButton} ${leadStyles.whatsAppActionButton}`}
                    onClick={() => openWhatsApp(managedAsset)}
                    disabled={!cleanPhoneForWhatsApp(managedAsset.ownerPhone)}
                    title={!cleanPhoneForWhatsApp(managedAsset.ownerPhone) ? 'No owner cellphone number is saved.' : undefined}
                  >
                    <WhatsAppIcon className={`${assetStyles.buttonIcon} ${leadStyles.whatsAppIcon}`} />
                    <span>
                      <strong>WhatsApp owner</strong>
                      <small>{managedAsset.ownerPhone ? 'Open a WhatsApp message to the owner.' : 'No owner cellphone number saved.'}</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={assetStyles.optionActionButton}
                    onClick={() => {
                      setManagedAccessId(null);
                      setCostReportAccessId(managedAsset.accessId);
                    }}
                    disabled={!managedAsset.permissions.canViewCostOfOwnership}
                    title={!managedAsset.permissions.canViewCostOfOwnership
                      ? 'The asset owner has not granted Cost of Ownership access.'
                      : undefined}
                  >
                    <DownloadIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Cost of ownership</strong>
                      <small>{managedAsset.permissions.canViewCostOfOwnership ? 'Choose a timeline and download the report.' : 'Owner permission is required.'}</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={assetStyles.optionActionButton}
                    onClick={() => {
                      setManagedAccessId(null);
                      setReportAccessId(managedAsset.accessId);
                    }}
                    disabled={!managedAsset.permissions.canViewMaintenanceReports}
                    title={!managedAsset.permissions.canViewMaintenanceReports ? 'The asset owner has not granted maintenance report access.' : undefined}
                  >
                    <DownloadIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>PDF reports</strong>
                      <small>{managedAsset.permissions.canViewMaintenanceReports ? 'Choose and download a maintenance report.' : 'Owner permission is required.'}</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={assetStyles.optionActionButton}
                    onClick={() => {
                      setManagedAccessId(null);
                      setScheduleAccessId(managedAsset.accessId);
                    }}
                    disabled={!managedAsset.permissions.canCreateMaintenanceSchedules}
                    title={!managedAsset.permissions.canCreateMaintenanceSchedules
                      ? 'The asset owner has not granted permission to create maintenance schedules.'
                      : undefined}
                  >
                    <MaintenanceIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Propose schedule</strong>
                      <small>{managedAsset.permissions.canCreateMaintenanceSchedules ? 'The owner can approve or disapprove it.' : 'Owner permission is required.'}</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={assetStyles.optionActionButton}
                    onClick={() => callOwner(managedAsset)}
                    disabled={!cleanPhoneForTel(managedAsset.ownerPhone)}
                    title={!cleanPhoneForTel(managedAsset.ownerPhone) ? 'No owner contact number is saved.' : undefined}
                  >
                    <PhoneIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Call owner</strong>
                      <small>{managedAsset.ownerPhone ? 'Start a phone call from the saved number.' : 'No owner contact number saved.'}</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={assetStyles.optionActionButton}
                    onClick={() => emailOwner(managedAsset)}
                    disabled={!cleanEmail(managedAsset.ownerEmail)}
                    title={!cleanEmail(managedAsset.ownerEmail) ? 'No owner email address is saved.' : undefined}
                  >
                    <EmailIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Email owner</strong>
                      <small>{cleanEmail(managedAsset.ownerEmail) ? 'Open an email draft with asset context.' : 'No owner email address saved.'}</small>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {filterOpen ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={() => setFilterOpen(false)} />
          <div className={`${assetStyles.modalCard} ${workspaceStyles.modal} ${leadStyles.leadFilterModal} ${styles.trackerFilterModal}`} role="dialog" aria-modal="true" aria-labelledby="tracker-filter-title">
            <div className={`${assetStyles.modalHeader} ${leadStyles.leadFilterHeader} ${styles.trackerFilterHeader}`}>
              <div><h3 id="tracker-filter-title">Filter tracked equipment</h3><p className={leadStyles.leadFilterIntro}>Filter by asset owner and current maintenance position.</p></div>
              <button type="button" className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose}`} onClick={() => setFilterOpen(false)} aria-label="Close filters"><CloseIcon className={assetStyles.buttonIcon} /></button>
            </div>
            <div className={`${workspaceStyles.modalBody} ${leadStyles.leadFilterForm} ${styles.trackerFilterForm}`}>
              <Dropdown label="Asset owner" value={draftOwnerFilter} options={ownerOptions} dropdownKey="owner" openDropdown={openFilterDropdown} onOpenChange={(key) => setOpenFilterDropdown(key as FilterDropdownKey | null)} onChange={setDraftOwnerFilter} />
              <Dropdown label="Maintenance status" value={draftStatusFilter} options={statusOptions} dropdownKey="status" openDropdown={openFilterDropdown} onOpenChange={(key) => setOpenFilterDropdown(key as FilterDropdownKey | null)} onChange={(value) => setDraftStatusFilter(value as TrackerStatusFilter)} />
            </div>
            <div className={`${assetStyles.formActions} ${workspaceStyles.modalFooter} ${leadStyles.leadFilterActions} ${styles.trackerFilterActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={clearFilters}>Clear filters</button>
              <button type="button" className={assetStyles.primaryButton} onClick={() => { setOwnerFilter(draftOwnerFilter); setStatusFilter(draftStatusFilter); setOpenFilterDropdown(null); setFilterOpen(false); }}>Apply filters</button>
            </div>
          </div>
        </div>
      ) : null}

      {reportAccessId ? (
        <DealerMaintenanceReportModal
          accessId={reportAccessId}
          onClose={() => setReportAccessId(null)}
          onError={(message) => setNotice({ tone: 'error', text: message })}
        />
      ) : null}

      {costReportAsset ? (
        <DealerCostOfOwnershipReportModal
          accessId={costReportAsset.accessId}
          assetTitle={costReportAsset.assetTitle}
          assetMeta={trackingAssetMeta(costReportAsset)}
          createdAtIso={costReportAsset.createdAtIso}
          updatedAtIso={costReportAsset.updatedAtIso}
          onClose={() => setCostReportAccessId(null)}
          onError={(message) => setNotice({ tone: 'error', text: message })}
        />
      ) : null}

      {scheduleAccessId ? (
        <DealerMaintenanceScheduleModal
          accessId={scheduleAccessId}
          onClose={() => setScheduleAccessId(null)}
          onCreated={(proposals) => {
            setAssets((current) => current.map((asset) => asset.accessId === scheduleAccessId
              ? { ...asset, scheduleProposals: proposals }
              : asset));
            setNotice({ tone: 'success', text: 'Proposed schedule sent to the owner for approval.' });
          }}
          onError={(message) => setNotice({ tone: 'error', text: message })}
        />
      ) : null}

      {photoModal ? (
        <LeadPhotoViewerModal
          assetKey={`tracking-${photoModal.accessId}`}
          title={photoModal.title}
          urls={photoModal.urls}
          initialIndex={photoModal.index}
          onClose={() => setPhotoModal(null)}
        />
      ) : null}

    </main>
  );
}
