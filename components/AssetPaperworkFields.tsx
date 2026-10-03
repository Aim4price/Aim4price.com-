'use client';
import {useState,useEffect,type ReactNode} from 'react';
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
type Props = {
 assetStatusDraft: AssetStatusDraft; assetStatusEditView: Section | 'hub'; assetLicenseApplicable: boolean;
 openAssetStatusEditView: (section:Section)=>void;
 updateAssetStatusDraftField: <K extends keyof AssetStatusDraft>(key:K,value:AssetStatusDraft[K])=>void;
 setAssetFinanceStatus:(value:FinanceStatusChoice)=>void; setAssetFinanceType:(value:string)=>void;
 setAssetInsuranceStatus:(value:AssetStatusChoice)=>void; setAssetLicenseStatus:(value:AssetStatusChoice)=>void;
 handleInsuredValueChange:(value:string)=>void; formatRegisterValueInput:(value:unknown)=>string;
 finishAssetStatusSection:(section:Section)=>void|Promise<void>; isSavingAssetStatus:boolean; assetStatusError:string;
 summaries:Record<Section,string>; documentControls?:Partial<Record<Section,ReactNode>>; bulkFinanceControl?:ReactNode;
};

export default function AssetPaperworkFields({assetStatusDraft,assetStatusEditView,assetLicenseApplicable,openAssetStatusEditView,updateAssetStatusDraftField,setAssetFinanceStatus,setAssetFinanceType,setAssetInsuranceStatus,setAssetLicenseStatus,handleInsuredValueChange,formatRegisterValueInput,finishAssetStatusSection,isSavingAssetStatus,assetStatusError,summaries,documentControls,bulkFinanceControl}:Props) {
 const [assetStatusAdvancedOpen,setAssetStatusAdvancedOpen]=useState(false);
 useEffect(()=>setAssetStatusAdvancedOpen(false),[assetStatusEditView]);
 return <section data-asset-paperwork className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.assetUpdateStageCard} ${styles.fullWidth} ${styles.assetStatusStageCard}`}>
                    {assetStatusEditView === 'hub' ? (
                      <div className={styles.assetStatusHubGrid}>
                        <button
                          type="button"
                          className={styles.assetStatusHubCard}
                          onClick={() => openAssetStatusEditView('finance')}
                        >
                          <strong>Finance</strong>
                          <small>{summaries.finance}</small>
                        </button>

                        <button
                          type="button"
                          className={styles.assetStatusHubCard}
                          onClick={() => openAssetStatusEditView('insurance')}
                        >
                          <strong>Insurance</strong>
                          <small>{summaries.insurance}</small>
                        </button>

                        {assetLicenseApplicable ? (
                          <button
                            type="button"
                            className={styles.assetStatusHubCard}
                            onClick={() => openAssetStatusEditView('license')}
                          >
                            <strong>License</strong>
                            <small>{summaries.license}</small>
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {assetStatusEditView === 'finance' ? (
                      <div className={styles.assetStatusFocusedForm}>
                        <div data-paperwork-header className={styles.assetStatusFocusedHeader}>
                          <strong>Finance</strong>
                        </div>

                        <div className={styles.assetStatusEditGrid}>
                          <ModalSelect<FinanceStatusChoice>
                            label="Finance status"
                            value={assetStatusDraft.financeStatus}
                            options={QUICK_FINANCE_STATUS_OPTIONS}
                            onChange={setAssetFinanceStatus}
                            showDescriptions={false}
                            usePortal
                          />

                          <div className={`${styles.assetStatusAcquisitionPanel} ${styles.assetStatusWideField}`}>
                            <div className={styles.assetStatusAcquisitionHeader}>
                              <strong>Acquisition details</strong>
                              <small>Kept with finance and paperwork.</small>
                            </div>
                            <div className={styles.assetStatusAcquisitionGrid}>
                              <label className={styles.field}>
                                <span>Acquisition date <small>(optional)</small></span>
                                <DateInput value={assetStatusDraft.financeBoughtWhen} onValueChange={(value) => updateAssetStatusDraftField('financeBoughtWhen', value)} />
                              </label>
                              <label className={styles.field}>
                                <span>Acquisition amount excl. VAT <small>(optional)</small></span>
                                <input type="text" inputMode="numeric" value={assetStatusDraft.financeBoughtForExVat} onChange={(event) => updateAssetStatusDraftField('financeBoughtForExVat', formatRegisterValueInput(event.target.value))} placeholder="Optional" />
                              </label>
                            </div>
                          </div>

                          {assetStatusDraft.financeStatus === 'yes' || assetStatusDraft.financeStatus === 'paid' ? (
                            <>
                              <ModalSelect<string>
                                label="Finance type"
                                value={assetStatusDraft.financeType}
                                options={FINANCE_TYPE_OPTIONS}
                                onChange={setAssetFinanceType}
                                placeholder="Select finance type"
                                showDescriptions={false}
                                usePortal
                              />

{bulkFinanceControl}

                              {assetStatusDraft.financeStatus === 'yes' ? <label className={styles.field}>
                                <span>Current outstanding amount excl. VAT <small>(optional)</small></span>
                                <input type="text" inputMode="numeric" value={assetStatusDraft.financeCurrentOutstandingExVat} onChange={(event) => updateAssetStatusDraftField('financeCurrentOutstandingExVat', formatRegisterValueInput(event.target.value))} placeholder="Optional" />
                              </label> : null}

                              <label className={styles.field}>
                                <span>Financier <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.financierName}
                                  onChange={(event) => updateAssetStatusDraftField('financierName', event.target.value)}
                                  placeholder="Example: Bank or finance house"
                                />
                              </label>

                              <label className={`${styles.field} ${styles.assetStatusWideField}`}>
                                <span>Finance note <small>(optional)</small></span>
                                <textarea
                                  value={assetStatusDraft.financeNote}
                                  onChange={(event) => updateAssetStatusDraftField('financeNote', event.target.value)}
                                  placeholder="Optional"
                                  rows={3}
                                />
                              </label>

{documentControls?.finance}
                            </>
                          ) : null}
                        </div>

                        {assetStatusDraft.financeStatus === 'yes' || assetStatusDraft.financeStatus === 'paid' ? (
                          <>
                            <button
                              type="button"
                              className={styles.assetStatusAdvancedToggle}
                              onClick={() => setAssetStatusAdvancedOpen((current) => !current)}
                              aria-expanded={assetStatusAdvancedOpen}
                            >
                              <span>Advanced details</span>
                              <strong>{assetStatusAdvancedOpen ? 'Hide' : 'Show'}</strong>
                            </button>

                            {assetStatusAdvancedOpen ? (
                              <div className={styles.assetStatusAdvancedGrid}>
                                <label className={styles.field}>
                                  <span>Original financed amount excl. VAT <small>(optional)</small></span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assetStatusDraft.financeOriginalAmountExVat}
                                    onChange={(event) => updateAssetStatusDraftField('financeOriginalAmountExVat', formatRegisterValueInput(event.target.value))}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Monthly payment <small>(optional)</small></span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assetStatusDraft.financeMonthlyPaymentExVat}
                                    onChange={(event) => updateAssetStatusDraftField('financeMonthlyPaymentExVat', formatRegisterValueInput(event.target.value))}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Interest rate % <small>(optional)</small></span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={assetStatusDraft.financeInterestRatePercent}
                                    onChange={(event) => updateAssetStatusDraftField('financeInterestRatePercent', event.target.value)}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Finance term months <small>(optional)</small></span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={assetStatusDraft.financeTermMonths}
                                    onChange={(event) => updateAssetStatusDraftField('financeTermMonths', event.target.value)}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Balloon / residual amount excl. VAT <small>(optional)</small></span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assetStatusDraft.financeBalloonPaymentExVat}
                                    onChange={(event) => updateAssetStatusDraftField('financeBalloonPaymentExVat', formatRegisterValueInput(event.target.value))}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Settlement / expiry date <small>(optional)</small></span>
                                  <DateInput
                                    value={assetStatusDraft.financeSettlementDate}
                                    onValueChange={(value) => updateAssetStatusDraftField('financeSettlementDate', value)}
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Agreement / reference number <small>(optional)</small></span>
                                  <input
                                    value={assetStatusDraft.financeReferenceNumber}
                                    onChange={(event) => updateAssetStatusDraftField('financeReferenceNumber', event.target.value)}
                                    placeholder="Optional"
                                  />
                                </label>
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        {assetStatusError ? <p className={styles.assetStatusError}>{assetStatusError}</p> : null}

                        <div className={styles.assetStatusSubActions}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void finishAssetStatusSection('finance')}
                            disabled={isSavingAssetStatus}
                          >
                            {isSavingAssetStatus ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {assetStatusEditView === 'insurance' ? (
                      <div className={styles.assetStatusFocusedForm}>
                        <div data-paperwork-header className={styles.assetStatusFocusedHeader}>
                          <strong>Insurance</strong>
                        </div>

                        <div className={styles.assetStatusEditGrid}>
                          <ModalSelect<AssetStatusChoice>
                            label="Insurance status"
                            value={assetStatusDraft.insuranceStatus}
                            options={QUICK_INSURANCE_STATUS_OPTIONS}
                            onChange={setAssetInsuranceStatus}
                            showDescriptions={false}
                            usePortal
                          />

                          {assetStatusDraft.insuranceStatus === 'yes' ? (
                            <>
                              <label className={styles.field}>
                                <span>Insured amount excl. VAT <small>(optional)</small></span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={assetStatusDraft.insuredValueExVat}
                                  onChange={(event) => handleInsuredValueChange(event.target.value)}
                                  placeholder="Optional"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Insurer name <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.insuranceInsurerName}
                                  onChange={(event) => updateAssetStatusDraftField('insuranceInsurerName', event.target.value)}
                                  placeholder="Optional"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Policy number <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.insurancePolicyNumber}
                                  onChange={(event) => updateAssetStatusDraftField('insurancePolicyNumber', event.target.value)}
                                  placeholder="Optional"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Renewal / expiry date <small>(optional)</small></span>
                                <DateInput
                                  value={assetStatusDraft.insuranceRenewalDate}
                                  onValueChange={(value) => updateAssetStatusDraftField('insuranceRenewalDate', value)}
                                />
                              </label>

                              <label className={`${styles.field} ${styles.assetStatusWideField}`}>
                                <span>Insurance note <small>(optional)</small></span>
                                <textarea
                                  value={assetStatusDraft.insuranceNote}
                                  onChange={(event) => updateAssetStatusDraftField('insuranceNote', event.target.value)}
                                  placeholder="Optional"
                                  rows={3}
                                />
                              </label>

{documentControls?.insurance}
                            </>
                          ) : null}
                        </div>

                        {assetStatusError ? <p className={styles.assetStatusError}>{assetStatusError}</p> : null}

                        <div className={styles.assetStatusSubActions}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void finishAssetStatusSection('insurance')}
                            disabled={isSavingAssetStatus}
                          >
                            {isSavingAssetStatus ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {assetStatusEditView === 'license' && assetLicenseApplicable ? (
                      <div className={styles.assetStatusFocusedForm}>
                        <div data-paperwork-header className={styles.assetStatusFocusedHeader}>
                          <strong>License</strong>
                        </div>

                        <div className={styles.assetStatusEditGrid}>
                          <ModalSelect<AssetStatusChoice>
                            label="License status"
                            value={assetStatusDraft.licenseStatus}
                            options={QUICK_LICENSE_STATUS_OPTIONS}
                            onChange={setAssetLicenseStatus}
                            showDescriptions={false}
                            usePortal
                          />

                          {assetStatusDraft.licenseStatus === 'yes' ? (
                            <>
                              <label className={styles.field}>
                                <span>Registration number <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.licenseRegistrationNumber}
                                  onChange={(event) => updateAssetStatusDraftField('licenseRegistrationNumber', event.target.value.toUpperCase())}
                                  placeholder="Example: CAW 124120"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Renewal / expiry date <small>(optional)</small></span>
                                <DateInput
                                  value={assetStatusDraft.licenseRenewalDate}
                                  onValueChange={(value) => updateAssetStatusDraftField('licenseRenewalDate', value)}
                                />
                              </label>

                              <label className={`${styles.field} ${styles.assetStatusWideField}`}>
                                <span>License note <small>(optional)</small></span>
                                <textarea
                                  value={assetStatusDraft.licenseNote}
                                  onChange={(event) => updateAssetStatusDraftField('licenseNote', event.target.value)}
                                  placeholder="Optional"
                                  rows={3}
                                />
                              </label>

{documentControls?.license}
                            </>
                          ) : null}
                        </div>

                        {assetStatusError ? <p className={styles.assetStatusError}>{assetStatusError}</p> : null}

                        <div className={styles.assetStatusSubActions}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void finishAssetStatusSection('license')}
                            disabled={isSavingAssetStatus}
                          >
                            {isSavingAssetStatus ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>;
}
