'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  assetGroupMemberCountsTowardTotal,
  type AssetGroup,
  type AssetGroupSaveInput,
} from '../../lib/asset-groups-shared';
import registerStyles from '../../app/asset-register/page.module.css';
import styles from './AssetGroupManagerModal.module.css';

type IconProps = { className?: string };
type AssetGroupModalView = 'menu' | 'members' | 'reports' | 'delete' | 'create';
type AssetGroupReportStep = 'options' | 'format' | 'filters';
type AssetGroupEditorStep = 1 | 2 | 3;

export type AssetGroupReportKind = 'valuation' | 'maintenance' | 'fuel' | 'depreciation' | 'ownership';
export type AssetGroupReportFormat = 'pdf' | 'xlsx';
export type AssetGroupReportFilters = {
  year?: string;
  month?: string;
  maintenanceType?: string;
};

type ReportSelectOption = {
  value: string;
  label: string;
};

function MembersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M2.75 20v-2.1A5.25 5.25 0 0 1 8 12.65a5.25 5.25 0 0 1 5.25 5.25V20M14.25 13.05a4.6 4.6 0 0 1 7 3.92V20" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v11M7.5 10.5 12 15l4.5-4.5M4 20h16" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ReportSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: ReportSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: MouseEvent | TouchEvent) {
      if (event.target instanceof Node && rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`${registerStyles.reportSelectField} ${open ? registerStyles.reportSelectFieldOpen : ''} ${disabled ? registerStyles.reportSelectFieldDisabled : ''}`}
    >
      <span className={registerStyles.reportSelectLabel}>{label}</span>
      <button
        type="button"
        className={registerStyles.reportSelectButton}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{selected?.label ?? 'Choose option'}</span>
        <ChevronDownIcon className={registerStyles.reportSelectChevron} />
      </button>
      {open ? (
        <div className={registerStyles.reportSelectMenu} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`${registerStyles.reportSelectOption} ${option.value === value ? registerStyles.reportSelectOptionActive : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssetGroupMemberSelect({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: ReportSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const button = rootRef.current?.querySelector('button');
    if (!(button instanceof HTMLButtonElement)) return;
    const rect = button.getBoundingClientRect();
    const estimatedMenuHeight = Math.min(240, options.length * 48 + 14);
    const roomBelow = window.innerHeight - rect.bottom;
    const openUpward = roomBelow < estimatedMenuHeight + 16 && rect.top > roomBelow;
    const width = Math.min(rect.width, window.innerWidth - 24);

    setMenuStyle({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: openUpward
        ? Math.max(12, rect.top - estimatedMenuHeight - 8)
        : Math.min(window.innerHeight - estimatedMenuHeight - 12, rect.bottom + 8),
      width,
    });

    function handleOutside(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    function closeOnViewportChange() {
      setOpen(false);
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [open, options.length]);

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
        <div ref={menuRef} className={styles.memberSelectMenu} role="listbox" aria-label={label} style={menuStyle}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`${styles.memberSelectOption} ${option.value === value ? styles.memberSelectOptionActive : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className={`${styles.memberSelect} ${open ? styles.memberSelectOpen : ''}`}>
      <span className={styles.memberSelectLabel}>{label}</span>
      <button
        type="button"
        className={styles.memberSelectButton}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{selected?.label ?? 'Choose option'}</span>
        <ChevronDownIcon className={styles.memberSelectChevron} />
      </button>
      {menu}
    </div>
  );
}

function DocumentIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

function SpreadsheetIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h8M12 7v8" />
    </svg>
  );
}

function PdfIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7zM14 3v5h5M9 15h6M9 18h5" />
    </svg>
  );
}

type ReportGraphicProps = {
  src: string;
  alt: string;
  icon: JSX.Element;
};

function ReportGraphic({ src, alt, icon }: ReportGraphicProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className={registerStyles.exportGraphicFallback}>{icon}</span>;
  }

  return <img src={src} alt={alt} className={registerStyles.exportGraphicImage} onError={() => setHasError(true)} />;
}

export type AssetGroupModalAsset = {
  id: string;
  title: string;
  registerId: string | null;
  registerName?: string | null;
  value: number;
  categoryLabel?: string | null;
  serialNumber?: string | null;
  registrationNumber?: string | null;
  notes?: string | null;
  searchableText?: string | null;
};

type Props = {
  open: boolean;
  anchorAsset: AssetGroupModalAsset | null;
  group: AssetGroup | null;
  assets: AssetGroupModalAsset[];
  groups: AssetGroup[];
  combinedMode?: boolean;
  busy?: boolean;
  reportBusy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: AssetGroupSaveInput) => void | Promise<void>;
  onDelete: (group: AssetGroup) => void | Promise<void>;
  onDownloadPdf?: (group: AssetGroup) => void | Promise<void>;
  onDownloadXlsx?: (group: AssetGroup) => void | Promise<void>;
  onDownloadReport?: (
    group: AssetGroup,
    reportKind: AssetGroupReportKind,
    format: AssetGroupReportFormat,
    filters: AssetGroupReportFilters,
  ) => void | Promise<void>;
};

const PRIMARY_MEMBER_VALUE_OPTIONS: ReportSelectOption[] = [
  { value: 'primary', label: 'Primary asset: add to total' },
  { value: 'included', label: 'Independent asset: add to total' },
  { value: 'linked', label: 'Linked to primary: do not add again' },
];

const GROUPED_MEMBER_VALUE_OPTIONS: ReportSelectOption[] = [
  { value: 'included', label: 'Add to umbrella total' },
  { value: 'excluded', label: 'Do not add to umbrella total' },
];

const ASSET_GROUP_EDITOR_STEP_LABELS = ['Umbrella name', 'Structure', 'Choose assets'] as const;

function AssetGroupEditorProgress({ currentStep }: { currentStep: AssetGroupEditorStep }) {
  return (
    <ol className={styles.wizardProgress} aria-label="Umbrella setup progress">
      {ASSET_GROUP_EDITOR_STEP_LABELS.map((label, index) => {
        const step = (index + 1) as AssetGroupEditorStep;
        const isCurrent = step === currentStep;
        const isComplete = step < currentStep;

        return (
          <li
            key={label}
            className={`${styles.wizardProgressStep} ${isCurrent ? styles.wizardProgressStepCurrent : ''} ${isComplete ? styles.wizardProgressStepComplete : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span>{isComplete ? '✓' : step}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function defaultGroupName(asset: AssetGroupModalAsset | null): string {
  const title = String(asset?.title ?? '').trim();
  return title ? `${title} umbrella` : 'Asset umbrella';
}

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0)).replace('ZAR', 'R');
}

function normalizeAssetSearch(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function assetMatchesSearch(asset: AssetGroupModalAsset, search: string): boolean {
  const normalizedQuery = normalizeAssetSearch(search);
  if (!normalizedQuery) return true;

  const searchableText = normalizeAssetSearch([
    asset.title,
    asset.categoryLabel,
    asset.serialNumber,
    asset.registrationNumber,
    asset.notes,
    asset.registerName,
    asset.searchableText,
  ].filter(Boolean).join(' '));
  const compactQuery = normalizedQuery.replace(/\s+/g, '');
  const compactSearchableText = searchableText.replace(/\s+/g, '');

  return normalizedQuery.split(' ').every((term) => searchableText.includes(term))
    || (compactQuery.length > 1 && compactSearchableText.includes(compactQuery));
}

export default function AssetGroupManagerModal({
  open,
  anchorAsset,
  group,
  assets,
  groups,
  combinedMode = false,
  busy = false,
  reportBusy = false,
  error,
  onClose,
  onSave,
  onDelete,
  onDownloadPdf,
  onDownloadXlsx,
  onDownloadReport,
}: Props) {
  const [name, setName] = useState('');
  const [hasPrimaryAsset, setHasPrimaryAsset] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [primaryAssetId, setPrimaryAssetId] = useState('');
  const [countsTowardTotalByAssetId, setCountsTowardTotalByAssetId] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AssetGroupModalView>('create');
  const [editorStep, setEditorStep] = useState<AssetGroupEditorStep>(1);
  const [reportFormat, setReportFormat] = useState<AssetGroupReportFormat>('pdf');
  const [reportStep, setReportStep] = useState<AssetGroupReportStep>('options');
  const [reportKind, setReportKind] = useState<AssetGroupReportKind>('valuation');
  const [reportYear, setReportYear] = useState('all');
  const [reportMonth, setReportMonth] = useState('all');
  const [maintenanceType, setMaintenanceType] = useState('all');

  const membershipByAssetId = useMemo(() => {
    const result = new Map<string, AssetGroup>();
    groups.forEach((entry) => entry.members.forEach((member) => result.set(member.assetId, entry)));
    return result;
  }, [groups]);

  useEffect(() => {
    if (!open) return;

    const initialMemberIds = group?.members.map((member) => member.assetId)
      ?? (anchorAsset ? [anchorAsset.id] : []);
    const initialPrimaryAssetId = group?.members.find((member) => member.role === 'primary')?.assetId ?? '';
    const initialCountsTowardTotal = group
      ? Object.fromEntries(group.members.map((member) => [
          member.assetId,
          assetGroupMemberCountsTowardTotal(group, member),
        ]))
      : Object.fromEntries(initialMemberIds.map((assetId) => [assetId, true]));

    setName(group?.name ?? defaultGroupName(anchorAsset));
    setHasPrimaryAsset(Boolean(initialPrimaryAssetId));
    setSelectedAssetIds(initialMemberIds);
    setPrimaryAssetId(initialPrimaryAssetId);
    setCountsTowardTotalByAssetId(initialCountsTowardTotal);
    setSearch('');
    setView(group ? 'menu' : 'create');
    setEditorStep(1);
    setReportFormat('pdf');
    setReportStep('options');
    setReportKind('valuation');
    setReportYear('all');
    setReportMonth('all');
    setMaintenanceType('all');
  }, [anchorAsset, combinedMode, group, open]);

  const visibleAssets = useMemo(() => {
    return assets
      .filter((asset) => assetMatchesSearch(asset, search))
      .sort((left, right) => {
        const titleDifference = left.title.localeCompare(right.title, 'en-ZA', { sensitivity: 'base', numeric: true });
        return titleDifference || String(left.categoryLabel ?? '').localeCompare(String(right.categoryLabel ?? ''), 'en-ZA', { sensitivity: 'base', numeric: true });
      });
  }, [assets, search]);

  const selectedAssets = useMemo(
    () => selectedAssetIds.map((assetId) => assets.find((asset) => asset.id === assetId)).filter(Boolean) as AssetGroupModalAsset[],
    [assets, selectedAssetIds],
  );

  const countedValue = selectedAssets.reduce((sum, asset) => {
    if (countsTowardTotalByAssetId[asset.id] === false) return sum;
    return sum + Math.round(Number(asset.value) || 0);
  }, 0);
  const countedAssetCount = selectedAssetIds.filter((assetId) => countsTowardTotalByAssetId[assetId] !== false).length;

  if (!open) return null;

  function toggleAsset(asset: AssetGroupModalAsset) {
    setSelectedAssetIds((current) => {
      if (current.includes(asset.id)) {
        if (!group && asset.id === anchorAsset?.id) return current;
        const next = current.filter((assetId) => assetId !== asset.id);
        setCountsTowardTotalByAssetId((currentCounts) => {
          const nextCounts = { ...currentCounts };
          delete nextCounts[asset.id];
          return nextCounts;
        });
        if (primaryAssetId === asset.id) {
          const nextPrimaryAssetId = hasPrimaryAsset
            ? anchorAsset?.id && next.includes(anchorAsset.id)
              ? anchorAsset.id
              : next[0] ?? ''
            : '';
          setPrimaryAssetId(nextPrimaryAssetId);
          if (nextPrimaryAssetId) {
            setCountsTowardTotalByAssetId((currentCounts) => ({ ...currentCounts, [nextPrimaryAssetId]: true }));
          }
        }
        return next;
      }

      setCountsTowardTotalByAssetId((currentCounts) => ({ ...currentCounts, [asset.id]: true }));
      if (hasPrimaryAsset && !primaryAssetId) {
        setPrimaryAssetId(asset.id);
      }

      return [...current, asset.id];
    });
  }

  function handlePrimaryModeChange(nextHasPrimaryAsset: boolean) {
    setHasPrimaryAsset(nextHasPrimaryAsset);
    if (!nextHasPrimaryAsset) {
      setPrimaryAssetId('');
      return;
    }

    const nextPrimaryAssetId = selectedAssetIds.includes(primaryAssetId)
      ? primaryAssetId
      : selectedAssetIds[0] ?? '';
    setPrimaryAssetId(nextPrimaryAssetId);
    if (nextPrimaryAssetId) {
      setCountsTowardTotalByAssetId((current) => ({ ...current, [nextPrimaryAssetId]: true }));
    }
  }

  function handleMemberValueChange(assetId: string, nextValue: string) {
    if (nextValue === 'primary') {
      setPrimaryAssetId(assetId);
      setCountsTowardTotalByAssetId((current) => ({ ...current, [assetId]: true }));
      return;
    }

    if (assetId === primaryAssetId) {
      const replacementPrimaryAssetId = selectedAssetIds.find((selectedAssetId) => selectedAssetId !== assetId);
      if (!replacementPrimaryAssetId) return;
      setPrimaryAssetId(replacementPrimaryAssetId);
      setCountsTowardTotalByAssetId((current) => ({ ...current, [replacementPrimaryAssetId]: true }));
    }

    setCountsTowardTotalByAssetId((current) => ({
      ...current,
      [assetId]: nextValue === 'included',
    }));
  }

  function handleEditorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (editorStep === 1) {
      if (!name.trim()) return;
      setEditorStep(2);
      return;
    }

    if (editorStep === 2) {
      setEditorStep(3);
      return;
    }

    if (selectedAssetIds.length < 1 || countedAssetCount < 1 || (hasPrimaryAsset && !primaryAssetId) || !name.trim()) return;

    const valueMode = hasPrimaryAsset
      && selectedAssetIds.every((assetId) => assetId === primaryAssetId || countsTowardTotalByAssetId[assetId] === false)
      ? 'included_in_primary'
      : 'separate';

    void onSave({
      groupId: group?.id,
      registerId: group?.registerId ?? anchorAsset?.registerId ?? selectedAssets[0]?.registerId ?? null,
      name: name.trim(),
      valueMode,
      primaryAssetId: hasPrimaryAsset ? primaryAssetId : null,
      memberIds: selectedAssetIds,
      countsTowardTotalByAssetId: Object.fromEntries(selectedAssetIds.map((assetId) => [
        assetId,
        countsTowardTotalByAssetId[assetId] !== false,
      ])),
    });
  }

  function handleDownloadSelectedReport() {
    if (!group || busy || reportBusy) return;

    if (onDownloadReport) {
      void onDownloadReport(group, reportKind, reportFormat, {
        year: reportYear,
        month: reportYear === 'all' ? 'all' : reportMonth,
        maintenanceType: reportKind === 'maintenance' ? maintenanceType : undefined,
      });
      return;
    }

    if (reportFormat === 'pdf') {
      void onDownloadPdf?.(group);
      return;
    }

    void onDownloadXlsx?.(group);
  }

  function chooseReport(nextReportKind: AssetGroupReportKind) {
    setReportKind(nextReportKind);
    setReportFormat('pdf');
    setReportYear('all');
    setReportMonth('all');
    setMaintenanceType('all');

    if (nextReportKind === 'valuation') {
      if (group) {
        if (onDownloadReport) {
          void onDownloadReport(group, 'valuation', 'pdf', {});
        } else {
          void onDownloadPdf?.(group);
        }
      }
      return;
    }

    setReportStep('format');
  }

  const currentYear = new Date().getFullYear();
  const reportYears = Array.from({ length: 16 }, (_, index) => String(currentYear - index));
  const reportYearOptions: ReportSelectOption[] = [
    { value: 'all', label: 'All years' },
    ...reportYears.map((year) => ({ value: year, label: year })),
  ];
  const reportMonthOptions: ReportSelectOption[] = [
    { value: 'all', label: 'All months' },
    ...Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1),
      label: new Intl.DateTimeFormat('en-ZA', { month: 'long' }).format(new Date(2024, index, 1)),
    })),
  ];
  const maintenanceOptions: ReportSelectOption[] = [
    { value: 'all', label: 'All maintenance' },
    { value: 'upcoming', label: 'Upcoming maintenance' },
    { value: 'done', label: 'Completed maintenance' },
    { value: 'service', label: 'Services only' },
    { value: 'checkup', label: 'Check-ups only' },
  ];

  const groupSummary = group
    ? `${group.members.length} grouped ${group.members.length === 1 ? 'asset' : 'assets'} · ${money(countedValue)} counted value`
    : '';
  const modalTitle = !group
    ? 'Create an umbrella'
    : view === 'menu' || view === 'reports'
      ? group.name
      : view === 'members'
        ? 'Edit umbrella'
        : 'Remove umbrella';
  const modalSubtitle = !group
    ? 'Group related assets while keeping every record independent.'
    : view === 'menu' || view === 'reports'
      ? groupSummary
      : view === 'members'
        ? `Update the name, structure and assets in ${group.name}.`
        : `Remove the grouping without deleting its assets.`;
  const useManageModalDesign = Boolean(group && view === 'menu');
  const useReportModalDesign = Boolean(group && view === 'reports');
  const useSharedAssetModalDesign = useManageModalDesign || useReportModalDesign;

  return (
    <div className={useSharedAssetModalDesign ? registerStyles.modalOverlay : styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy && !reportBusy) onClose();
    }}>
      {useSharedAssetModalDesign ? (
        <div className={registerStyles.modalBackdrop} onClick={() => {
          if (!busy && !reportBusy) onClose();
        }} />
      ) : null}
      <section
        className={useManageModalDesign
          ? `${registerStyles.optionsModal} ${styles.manageModal}`
          : useReportModalDesign
            ? `${registerStyles.modalCard} ${registerStyles.assetReportModal}`
            : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-group-title"
      >
        <header className={useManageModalDesign
          ? `${registerStyles.modalHeader} ${registerStyles.optionsModalHeader} ${styles.manageHeader}`
          : useReportModalDesign
            ? `${registerStyles.modalHeader} ${registerStyles.assetReportModalHeader}`
            : styles.header}>
          <div className={useSharedAssetModalDesign ? registerStyles.modalHeaderText : styles.headerText}>
            {useSharedAssetModalDesign
              ? <h3 id="asset-group-title">{modalTitle}</h3>
              : <h2 id="asset-group-title">{modalTitle}</h2>}
            <p>{modalSubtitle}</p>
          </div>
          <button
            type="button"
            className={useManageModalDesign
              ? `${registerStyles.modalCloseButton} ${styles.manageCloseButton}`
              : useSharedAssetModalDesign
                ? registerStyles.modalCloseButton
                : styles.closeButton}
            onClick={onClose}
            disabled={busy || reportBusy}
            aria-label="Close umbrella manager"
          >
            {useSharedAssetModalDesign ? <CloseIcon className={registerStyles.buttonIcon} /> : '×'}
          </button>
        </header>

        {group && view === 'menu' ? (
          <div className={`${registerStyles.modalScrollBody} ${registerStyles.optionsScrollBody} ${styles.manageMenuBody}`}>
            <div className={`${registerStyles.optionsContent} ${styles.manageMenuContent}`}>
              <div className={`${registerStyles.optionsGrid} ${registerStyles.assetOptionsGrid} ${styles.manageMenuGrid}`}>
                <button type="button" className={`${registerStyles.optionActionButton} ${registerStyles.optionFeaturedButton} ${styles.manageMenuAction}`} onClick={() => {
                  setEditorStep(1);
                  setView('members');
                }}>
                  <MembersIcon className={`${registerStyles.buttonIcon} ${styles.manageMenuIcon}`} />
                  <span>
                    <strong>Manage umbrella</strong>
                    <small className={styles.menuOptionSubtitle}>Name, structure and assets.</small>
                  </span>
                </button>
                <button type="button" className={`${registerStyles.optionActionButton} ${styles.manageMenuAction} ${styles.manageMenuReport}`} onClick={() => {
                  setReportStep('options');
                  setView('reports');
                }} disabled={!onDownloadReport && !onDownloadPdf && !onDownloadXlsx}>
                  <DownloadIcon className={`${registerStyles.buttonIcon} ${styles.manageMenuIcon}`} />
                  <span>
                    <strong>Download reports</strong>
                    <small className={styles.menuOptionSubtitle}>Reports for grouped assets.</small>
                  </span>
                </button>
                <button type="button" className={`${registerStyles.optionActionButton} ${registerStyles.optionDangerButton} ${styles.manageMenuAction} ${styles.manageMenuDanger}`} onClick={() => setView('delete')}>
                  <TrashIcon className={`${registerStyles.buttonIcon} ${styles.manageMenuIcon}`} />
                  <span>
                    <strong>Remove umbrella</strong>
                    <small className={styles.menuOptionSubtitle}>Ungroup without deleting assets.</small>
                  </span>
                </button>
              </div>
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </div>
        ) : group && view === 'reports' ? (
          <div className={`${registerStyles.modalScrollBody} ${registerStyles.assetReportModalBody}`}>
            {reportStep === 'options' ? (
              <div className={registerStyles.assetReportOptionsGrid}>
                <button type="button" className={registerStyles.assetReportOptionButton} onClick={() => chooseReport('valuation')}>
                  <PdfIcon className={registerStyles.buttonIcon} />
                  <span><strong>Download umbrella valuation</strong><small>PDF values, notes and grouped assets.</small></span>
                </button>
                <button type="button" className={registerStyles.assetReportOptionButton} onClick={() => chooseReport('maintenance')}>
                  <DocumentIcon className={registerStyles.buttonIcon} />
                  <span><strong>Download maintenance report</strong><small>Combined service and repair history.</small></span>
                </button>
                <button type="button" className={registerStyles.assetReportOptionButton} onClick={() => chooseReport('fuel')}>
                  <DocumentIcon className={registerStyles.buttonIcon} />
                  <span><strong>Download fuel report</strong><small>Combined fuel records by month.</small></span>
                </button>
                <button type="button" className={registerStyles.assetReportOptionButton} onClick={() => chooseReport('depreciation')}>
                  <DocumentIcon className={registerStyles.buttonIcon} />
                  <span><strong>Download depreciation log</strong><small>Combined saved value changes.</small></span>
                </button>
                <button type="button" className={registerStyles.assetReportOptionButton} onClick={() => chooseReport('ownership')}>
                  <DocumentIcon className={registerStyles.buttonIcon} />
                  <span><strong>Download cost of ownership report</strong><small>Combined expenses, costs and VAT.</small></span>
                </button>
              </div>
            ) : reportStep === 'format' ? (
              <>
                <div className={registerStyles.assetTimelineStageHeading}>
                  <strong>Choose export format</strong>
                  <span>Select PDF or Excel, then continue to the report timeline.</span>
                </div>

                <div className={registerStyles.assetTimelineFormatGrid} aria-label={`${group.name} report format`}>
                  <button type="button" className={`${registerStyles.assetTimelineFormatOption} ${reportFormat === 'pdf' ? registerStyles.assetTimelineFormatOptionActive : ''}`} onClick={() => setReportFormat('pdf')} aria-pressed={reportFormat === 'pdf'}>
                    <span className={registerStyles.assetTimelineFormatGraphic}>
                      <ReportGraphic src="/brand/pdf.png" alt="PDF report" icon={<PdfIcon className={registerStyles.assetTimelineFormatFallbackIcon} />} />
                    </span>
                    <span className={registerStyles.assetTimelineFormatCopy}><strong>PDF report</strong><small>Open a clear combined umbrella report.</small></span>
                  </button>
                  <button type="button" className={`${registerStyles.assetTimelineFormatOption} ${reportFormat === 'xlsx' ? registerStyles.assetTimelineFormatOptionActive : ''}`} onClick={() => setReportFormat('xlsx')} aria-pressed={reportFormat === 'xlsx'}>
                    <span className={registerStyles.assetTimelineFormatGraphic}>
                      <ReportGraphic src="/brand/sheet.png" alt="Excel workbook" icon={<SpreadsheetIcon className={registerStyles.assetTimelineFormatFallbackIcon} />} />
                    </span>
                    <span className={registerStyles.assetTimelineFormatCopy}><strong>XLSX workbook</strong><small>Download combined records in Excel.</small></span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={registerStyles.assetTimelineStageHeading}>
                  <strong>Report timeline</strong>
                  <span>{reportKind === 'maintenance' ? 'Choose the maintenance type, year and month to include.' : 'Choose the year and month to include.'}</span>
                </div>
                <div className={`${styles.reportFilters} ${reportKind === 'maintenance' ? styles.reportFiltersMaintenance : ''}`}>
                  {reportKind === 'maintenance' ? (
                    <ReportSelect label="Maintenance" value={maintenanceType} options={maintenanceOptions} onChange={setMaintenanceType} />
                  ) : null}
                  <ReportSelect label="Year" value={reportYear} options={reportYearOptions} onChange={(value) => { setReportYear(value); setReportMonth('all'); }} />
                  <ReportSelect label="Month" value={reportMonth} options={reportMonthOptions} disabled={reportYear === 'all'} onChange={setReportMonth} />
                </div>
              </>
            )}

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            {reportStep === 'options' ? null : (
              <div className={`${registerStyles.formActions} ${registerStyles.exportActions} ${registerStyles.assetFuelReportActions} ${styles.reportActions}`}>
                <button type="button" className={`${registerStyles.secondaryButton} ${registerStyles.assetTimelineSecondaryButton}`} onClick={() => setReportStep(reportStep === 'filters' ? 'format' : 'options')} disabled={busy || reportBusy}>Back</button>
                <button type="button" className={`${registerStyles.secondaryButton} ${registerStyles.assetTimelineSecondaryButton}`} onClick={onClose} disabled={busy || reportBusy}>Cancel</button>
                <button type="button" className={registerStyles.primaryButton} onClick={() => reportStep === 'format' ? setReportStep('filters') : handleDownloadSelectedReport()} disabled={busy || reportBusy}>
                  <span>{reportStep === 'format' ? 'Next' : reportBusy ? 'Preparing…' : reportFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}</span>
                </button>
              </div>
            )}
          </div>
        ) : group && view === 'delete' ? (
          <>
            <div className={styles.subviewBody}>
              <section className={styles.deleteNotice}>
                <TrashIcon className={styles.deleteNoticeIcon} />
                <div>
                  <strong>Remove {group.name}?</strong>
                  <p>The umbrella will be removed, but all {group.members.length} grouped asset records, values, maintenance history, documents and photos will remain unchanged.</p>
                </div>
              </section>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>
            <footer className={styles.footer}>
              <button type="button" className={styles.cancelButton} onClick={() => setView('menu')} disabled={busy}>Cancel</button>
              <button type="button" className={styles.deleteButton} onClick={() => void onDelete(group)} disabled={busy}>
                {busy ? 'Removing…' : 'Remove umbrella'}
              </button>
            </footer>
          </>
        ) : (
          <form onSubmit={handleEditorSubmit}>
            <div className={styles.body}>
              <p className={styles.intro}>Complete one short step at a time. Your umbrella is saved on the final step.</p>
              <AssetGroupEditorProgress currentStep={editorStep} />

              <div className={styles.wizardBody}>
                {editorStep === 1 ? (
                <section className={`${styles.stepCard} ${styles.wizardPanel}`} aria-labelledby="umbrella-step-name">
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>1</span>
                    <div className={styles.stepCopy}>
                      <strong id="umbrella-step-name">Umbrella name</strong>
                      <small>Use a short name that makes this group easy to recognise.</small>
                    </div>
                  </div>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value.slice(0, 80))}
                      placeholder="Example: Farm transport set"
                      autoFocus
                      required
                    />
                  </label>
                </section>
                ) : null}

                {editorStep === 2 ? (
                <section className={`${styles.stepCard} ${styles.wizardPanel}`} aria-labelledby="umbrella-step-values">
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>2</span>
                    <div className={styles.stepCopy}>
                      <strong id="umbrella-step-values">Choose the umbrella structure</strong>
                      <small>Most umbrellas are simple groups. Choose a primary asset only when another asset's value is already included in it.</small>
                    </div>
                  </div>

                  <fieldset className={styles.valueModeFieldset} aria-label="Choose whether the umbrella has a primary asset">
                    <legend className={styles.srOnly}>Choose whether the umbrella has a primary asset</legend>
                    <label className={!hasPrimaryAsset ? styles.choiceActive : styles.choice}>
                      <input type="radio" name="asset-group-primary-mode" checked={!hasPrimaryAsset} onChange={() => handlePrimaryModeChange(false)} />
                      <span>
                        <strong>No primary asset</strong>
                        <small>Use this for tractors or other assets grouped for convenience. Every asset is added to the total by default.</small>
                      </span>
                    </label>
                    <label className={hasPrimaryAsset ? styles.choiceActive : styles.choice}>
                      <input type="radio" name="asset-group-primary-mode" checked={hasPrimaryAsset} onChange={() => handlePrimaryModeChange(true)} />
                      <span>
                        <strong>Choose a primary asset</strong>
                        <small>Use this when the primary value already includes one or more linked assets. Choose the primary in Step 3.</small>
                      </span>
                    </label>
                  </fieldset>
                </section>
                ) : null}

                {editorStep === 3 ? (
                <section className={`${styles.stepCard} ${styles.assetSection} ${styles.wizardPanel}`} aria-labelledby="umbrella-step-assets">
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>3</span>
                    <div className={styles.stepCopy}>
                      <strong id="umbrella-step-assets">Choose assets</strong>
                      <small>{combinedMode
                        ? 'Choose one or more assets from any of your Asset Registers.'
                        : 'Choose one or more assets from this Asset Register.'}</small>
                    </div>
                    <strong className={styles.selectedCount}>{selectedAssetIds.length} selected</strong>
                  </div>

                  <label className={styles.searchField}>
                    <span className={styles.srOnly}>Search assets</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name, category, serial, registration or notes"
                      autoFocus
                    />
                  </label>

                  <div className={styles.assetList}>
                    {visibleAssets.map((asset) => {
                      const existingGroup = membershipByAssetId.get(asset.id);
                      const movingFromAnotherGroup = Boolean(existingGroup && existingGroup.id !== group?.id);
                      const selected = selectedAssetIds.includes(asset.id);

                      return (
                        <div className={selected ? styles.assetRowSelected : styles.assetRow} key={asset.id}>
                          <label>
                            <input type="checkbox" checked={selected} disabled={!group && asset.id === anchorAsset?.id} onChange={() => toggleAsset(asset)} />
                            <span>
                              <strong>{asset.title}</strong>
                              <small>{[
                                movingFromAnotherGroup ? `Currently in ${existingGroup?.name} — select to move` : '',
                                asset.categoryLabel,
                                asset.serialNumber ? `Serial: ${asset.serialNumber}` : '',
                                asset.registrationNumber ? `Reg: ${asset.registrationNumber}` : '',
                                combinedMode ? asset.registerName : '',
                                money(asset.value),
                              ].filter(Boolean).join(' · ')}</small>
                            </span>
                          </label>

                          {selected ? (
                            <div className={styles.memberControls}>
                              <AssetGroupMemberSelect
                                label={hasPrimaryAsset ? 'Role and value' : 'Value in total'}
                                value={hasPrimaryAsset
                                  ? asset.id === primaryAssetId
                                    ? 'primary'
                                    : countsTowardTotalByAssetId[asset.id] === false
                                      ? 'linked'
                                      : 'included'
                                  : countsTowardTotalByAssetId[asset.id] === false
                                    ? 'excluded'
                                    : 'included'}
                                options={hasPrimaryAsset ? PRIMARY_MEMBER_VALUE_OPTIONS : GROUPED_MEMBER_VALUE_OPTIONS}
                                disabled={hasPrimaryAsset && selectedAssetIds.length === 1}
                                onChange={(nextValue) => handleMemberValueChange(asset.id, nextValue)}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <aside className={styles.summary}>
                    <span>{combinedMode ? 'Combined value represented by this umbrella' : 'Register value represented by this umbrella'}</span>
                    <strong>{money(countedValue)}</strong>
                    <small>{countedAssetCount} of {selectedAssetIds.length} selected asset {selectedAssetIds.length === 1 ? 'value is' : 'values are'} added to the total.</small>
                  </aside>
                </section>
                ) : null}
              </div>

              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>

            <footer className={`${styles.footer} ${styles.wizardFooter}`}>
              <button type="button" className={styles.cancelButton} onClick={() => group ? setView('menu') : onClose()} disabled={busy}>
                Cancel
              </button>
              {editorStep > 1 ? (
                <button type="button" className={styles.cancelButton} onClick={() => setEditorStep((editorStep - 1) as AssetGroupEditorStep)} disabled={busy}>
                  Back
                </button>
              ) : null}
              <button
                type="submit"
                className={styles.saveButton}
                disabled={busy || (editorStep === 1 && !name.trim()) || (editorStep === 3 && (selectedAssetIds.length < 1 || countedAssetCount < 1 || (hasPrimaryAsset && !primaryAssetId)))}
              >
                {editorStep < 3 ? 'Next' : busy ? 'Saving…' : group ? 'Save changes' : 'Create umbrella'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
