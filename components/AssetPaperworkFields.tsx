'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import AssetActionIcon from './asset-register/AssetActionIcon';
import actionStyles from './leads/ManageActionGrid.module.css';
import { createPortal } from './WebsitePortal';
import ui from './AssetPaperworkFields.module.css';
import DateInput from './DateInput';
import ModalSelect from './AssetModalSelect';
import styles from '../app/asset-register/page.module.css';
export type AssetStatusChoice = 'yes'|'no'|'unknown'|'not_applicable';
export type FinanceStatusChoice = AssetStatusChoice|'paid';
export type AssetStatusDraft = {
  financeStatus: FinanceStatusChoice;
  financeType: string;
  financeCurrentOutstandingExVat: string;
  financierName: string;
  financeNote: string;
  financeBoughtWhen: string;
  financeBoughtForExVat: string;
  financeOriginalAmountExVat: string;
  financeMonthlyPaymentExVat: string;
  financeInterestRatePercent: string;
  financeTermMonths: string;
  financeBalloonPaymentExVat: string;
  financeSettlementDate: string;
  financeReferenceNumber: string;
  insuranceStatus: AssetStatusChoice;
  insuredValueExVat: string;
  insuranceInsurerName: string;
  insurancePolicyNumber: string;
  insuranceRenewalDate: string;
  insuranceNote: string;
  licenseStatus: AssetStatusChoice;
  licenseRegistrationNumber: string;
  licenseRenewalDate: string;
  licenseNote: string;
};
const QUICK_FINANCE_STATUS_OPTIONS: Array<{ value: FinanceStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Financed', description: 'This asset has active finance or forms part of financed group debt.' },
  { value: 'paid', label: 'Paid off', description: 'Finance has been settled and is retained as history.' },
  { value: 'no', label: 'Not financed', description: 'This asset is not currently financed.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the finance status later.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Finance status does not apply to this asset.' },
];

const QUICK_INSURANCE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Insured', description: 'This asset is covered on an insurance policy.' },
  { value: 'no', label: 'Not insured', description: 'This asset is not currently insured.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the insurance status later.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Insurance status does not apply to this asset.' },
];

const QUICK_LICENSE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Licensed', description: 'This asset has an active licence or registration.' },
  { value: 'no', label: 'Not licensed', description: 'This asset is not currently licensed.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the licence status later.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Licensing does not apply to this asset.' },
];

const FINANCE_TYPE_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: '', label: 'Select finance type', description: 'Optional.' },
  { value: 'asset_specific', label: 'Asset-specific finance', description: 'Finance is linked to this specific asset.' },
  { value: 'bulk_group', label: 'Bulk / group finance', description: 'Finance covers more than one asset.' },
  { value: 'unknown', label: 'Not sure', description: 'Confirm the finance type later.' },
];

type Section = 'finance' | 'insurance' | 'license';
const PAPERWORK_LABELS: Record<Section, string> = { finance: 'Finance', insurance: 'Insurance', license: 'Licence' };

type Props = {
  assetStatusDraft: AssetStatusDraft;
  assetStatusEditView: Section | 'hub';
  assetLicenseApplicable: boolean;
  openAssetStatusEditView: (section: Section) => void;
  updateAssetStatusDraftField: <K extends keyof AssetStatusDraft>(key: K, value: AssetStatusDraft[K]) => void;
  setAssetFinanceStatus: (value: FinanceStatusChoice) => void;
  setAssetFinanceType: (value: string) => void;
  setAssetInsuranceStatus: (value: AssetStatusChoice) => void;
  setAssetLicenseStatus: (value: AssetStatusChoice) => void;
  handleInsuredValueChange: (value: string) => void;
  formatRegisterValueInput: (value: unknown) => string;
  finishAssetStatusSection: (section: Section) => void | Promise<void>;
  isSavingAssetStatus: boolean;
  assetStatusError: string;
  summaries: Record<Section, string>;
  documentControls?: Partial<Record<Section, ReactNode>>;
  bulkFinanceControl?: ReactNode;
  showReturnAction?: boolean;
  onReturn?: () => void;
  footerHost?: HTMLElement | null;
};

export default function AssetPaperworkFields(props: Props) {
  const { assetStatusEditView, assetStatusError, openAssetStatusEditView, assetLicenseApplicable, isSavingAssetStatus, summaries } = props;
  return (
    <section data-asset-paperwork className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.assetUpdateStageCard} ${styles.fullWidth} ${styles.assetStatusStageCard} ${styles.paperworkPanel}`}>
      {assetStatusError && <p role="alert" className={styles.assetStatusError}>{assetStatusError}</p>}
      {assetStatusEditView === 'hub' ? (
        <div className={`${styles.assetUpdateMenuBody} ${styles.ownerCommandModal} ${actionStyles.paperworkHub}`}>
          <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid} ${styles.ownerCommandGrid} ${actionStyles.grid}`} data-manage-actions>
            {(['finance', 'insurance', 'license'] as const)
              .filter(section => section !== 'license' || assetLicenseApplicable)
              .map(section => (
                <button key={section} type="button" className={`${styles.optionActionButton} ${styles.ownerCommandAction}`}
                  data-manage-action={section} onClick={() => openAssetStatusEditView(section)} disabled={isSavingAssetStatus}>
                  {section === 'insurance' ? (
                    <svg className={styles.buttonIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 3 8 3v5c0 5-3.1 8.4-8 10-4.9-1.6-8-5-8-10V6z" />
                      <path d="m9 12 2 2 4-5" />
                    </svg>
                  ) : <AssetActionIcon action={section === 'finance' ? 'addCosts' : 'serialNumber'} className={styles.buttonIcon} />}
                  <span><strong>{PAPERWORK_LABELS[section]}</strong><small>{summaries[section]}</small></span>
                </button>
              ))}
          </div>
        </div>
      ) : (assetStatusEditView !== 'license' || assetLicenseApplicable) && (
        <PaperworkEditor key={assetStatusEditView} {...props} section={assetStatusEditView} />
      )}
    </section>
  );
}

type TextFieldKey = Exclude<keyof AssetStatusDraft, 'financeStatus' | 'insuranceStatus' | 'licenseStatus' | 'financeType'>;
type FieldOptions = { kind?: 'amount' | 'percent' | 'months' | 'registration'; placeholder?: string };
type PaperworkPage = { title: string; fields: ReactNode };

function PaperworkEditor({
  section, assetStatusDraft: draft, updateAssetStatusDraftField: update, setAssetFinanceStatus,
  setAssetFinanceType, setAssetInsuranceStatus, setAssetLicenseStatus, formatRegisterValueInput,
  handleInsuredValueChange, documentControls, bulkFinanceControl, isSavingAssetStatus, footerHost,
  finishAssetStatusSection, onReturn, showReturnAction,
}: Props & { section: Section }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [includeTerms, setIncludeTerms] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [pageIndex]);

  function field(key: TextFieldKey, label: string, { kind, placeholder = 'Optional' }: FieldOptions = {}) {
    const numeric = kind === 'percent' || kind === 'months';
    function change(value: string) {
      if (key === 'insuredValueExVat') handleInsuredValueChange(value);
      else if (kind === 'amount') update(key, formatRegisterValueInput(value));
      else if (kind === 'registration') update(key, value.toUpperCase());
      else update(key, value);
    }
    return (
      <label className={`${styles.field} ${ui.field}`}>
        <span>{label} <small>(optional)</small></span>
        <input value={draft[key]} onChange={event => change(event.target.value)} placeholder={placeholder}
          type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined}
          step={numeric ? (kind === 'months' ? 1 : 0.01) : undefined} inputMode={kind === 'amount' ? 'numeric' : undefined} />
      </label>
    );
  }

  function date(key: TextFieldKey, label: string) {
    return (
      <label className={`${styles.field} ${ui.field}`}>
        <span>{label} <small>(optional)</small></span>
        <DateInput value={draft[key]} onValueChange={value => update(key, value)} />
      </label>
    );
  }

  const pages: PaperworkPage[] = [];
  let showNotes = false;
  if (section === 'finance') {
    pages.push({
      title: 'Finance',
      fields: <>
        <ModalSelect className={ui.field} label="Finance status" buttonLabel="Finance status" value={draft.financeStatus}
          options={QUICK_FINANCE_STATUS_OPTIONS} onChange={setAssetFinanceStatus} showDescriptions={false} usePortal />
        {date('financeBoughtWhen', 'Acquisition date')}
        {field('financeBoughtForExVat', 'Acquisition amount excl. VAT', { kind: 'amount' })}
      </>,
    });
    showNotes = draft.financeStatus === 'yes' || draft.financeStatus === 'paid';
    if (showNotes) {
      pages.push({
        title: 'Finance agreement',
        fields: <>
          <ModalSelect className={ui.field} label="Finance type" buttonLabel="Finance type" value={draft.financeType}
            options={FINANCE_TYPE_OPTIONS} onChange={setAssetFinanceType} placeholder="Select finance type" showDescriptions={false} usePortal />
          {field('financierName', 'Financier', { placeholder: 'Example: Bank or finance house' })}
          {draft.financeStatus === 'yes' && field('financeCurrentOutstandingExVat', 'Current outstanding amount excl. VAT', { kind: 'amount' })}
          {bulkFinanceControl}
          <label className={ui.advanced}>
            <input type="checkbox" checked={includeTerms} onChange={event => setIncludeTerms(event.target.checked)} />
            Include advanced finance details
          </label>
        </>,
      });
      if (includeTerms) {
        pages.push({
          title: 'Payment details',
          fields: <>
            {field('financeOriginalAmountExVat', 'Original financed amount excl. VAT', { kind: 'amount' })}
            {field('financeMonthlyPaymentExVat', 'Monthly payment', { kind: 'amount' })}
            {field('financeInterestRatePercent', 'Interest rate %', { kind: 'percent' })}
          </>,
        }, {
          title: 'Agreement terms',
          fields: <>
            {field('financeTermMonths', 'Finance term months', { kind: 'months' })}
            {field('financeBalloonPaymentExVat', 'Balloon / residual amount excl. VAT', { kind: 'amount' })}
            {date('financeSettlementDate', 'Settlement / expiry date')}
            {field('financeReferenceNumber', 'Agreement / reference number')}
          </>,
        });
      }
    }
  } else if (section === 'insurance') {
    showNotes = draft.insuranceStatus === 'yes';
    pages.push({
      title: 'Insurance',
      fields: <>
        <ModalSelect className={ui.field} label="Insurance status" buttonLabel="Insurance status" value={draft.insuranceStatus}
          options={QUICK_INSURANCE_STATUS_OPTIONS} onChange={setAssetInsuranceStatus} showDescriptions={false} usePortal />
        {showNotes && <>
          {field('insuredValueExVat', 'Insured amount excl. VAT', { kind: 'amount' })}
          {field('insuranceInsurerName', 'Insurer name')}
        </>}
      </>,
    });
    if (showNotes) pages.push({
      title: 'Policy details',
      fields: <>
        {field('insurancePolicyNumber', 'Policy number')}
        {date('insuranceRenewalDate', 'Renewal / expiry date')}
      </>,
    });
  } else {
    showNotes = draft.licenseStatus === 'yes';
    pages.push({
      title: 'Licence',
      fields: <>
        <ModalSelect className={ui.field} label="Licence status" buttonLabel="Licence status" value={draft.licenseStatus}
          options={QUICK_LICENSE_STATUS_OPTIONS} onChange={setAssetLicenseStatus} showDescriptions={false} usePortal />
        {showNotes && <>
          {field('licenseRegistrationNumber', 'Registration number', { kind: 'registration', placeholder: 'Example: CAW 124120' })}
          {date('licenseRenewalDate', 'Renewal / expiry date')}
        </>}
      </>,
    });
  }

  if (showNotes) {
    const noteKey = `${section}Note` as const;
    const label = PAPERWORK_LABELS[section];
    pages.push({
      title: documentControls?.[section] ? `${label} notes and documents` : `${label} notes`,
      fields: <>
        <label className={`${styles.field} ${ui.field} ${ui.wide}`}>
          <span>{label} note <small>(optional)</small></span>
          <textarea rows={3} value={draft[noteKey]} onChange={event => update(noteKey, event.target.value)} placeholder="Optional" />
        </label>
        {documentControls?.[section]}
      </>,
    });
  }

  const current = Math.min(pageIndex, pages.length - 1);
  const page = pages[current];
  const finish = () => void finishAssetStatusSection(section);
  const navigation = (
    <div className={styles.assetUpdateFooterActions}>
      {current > 0 ? (
        <button type="button" className={styles.secondaryButton} disabled={isSavingAssetStatus} onClick={() => setPageIndex(current - 1)}>Back</button>
      ) : (showReturnAction || onReturn) && (
        <button type="button" className={styles.secondaryButton} disabled={isSavingAssetStatus} onClick={onReturn ?? finish}>Back to paperwork</button>
      )}
      {current < pages.length - 1 ? (
        <button type="button" className={styles.primaryButton} disabled={isSavingAssetStatus} onClick={() => setPageIndex(current + 1)}>Next</button>
      ) : (
        <button type="button" className={styles.primaryButton} disabled={isSavingAssetStatus} onClick={finish}>{isSavingAssetStatus ? 'Saving…' : 'Done'}</button>
      )}
    </div>
  );
  return (
    <>
      <div className={ui.editor}>
        <h4 ref={heading} tabIndex={-1} className={ui.heading}>{page.title}</h4>
        <fieldset className={ui.fields} disabled={isSavingAssetStatus} aria-label={page.title}>{page.fields}</fieldset>
      </div>
      {footerHost ? createPortal(navigation, footerHost) : navigation}
    </>
  );
}
