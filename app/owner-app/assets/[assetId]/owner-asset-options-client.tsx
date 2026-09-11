'use client';

import BusinessInvite from '../../../../components/business-network/BusinessInvite';
import BusinessFilters from '../../../../components/business-network/BusinessFilters';
import BusinessSharePreview from '../../../../components/business-network/BusinessSharePreview';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import AssetExternalShare, {
  AssetShareDestinationPicker,
  type ExternalShareFileSource,
} from '../../../../components/asset-register/AssetExternalShare';
import {
  DEFAULT_DEALER_MAINTENANCE_PERMISSIONS,
  DealerMaintenancePermissionPicker,
} from '../../../../components/DealerMaintenanceAccessSettings';
import BalancedHeadingText from '../../balanced-heading';
import OwnerAppNav from '../../owner-app-nav';
import type { DealerMaintenancePermissions } from '../../../../lib/dealer-maintenance-tracker';
import type { ExternalAssetShareItem } from '../../../../lib/asset-external-share';
import styles from '../../owner-app.module.css';
import OwnerAssetReportPicker, { type OwnerAssetReportPickerAsset } from './owner-asset-report-picker';

type PartnerType = 'dealer' | 'finance' | 'insurance' | 'licensing';
type AssetLeadType = 'finance' | 'insurance' | 'replacement_quote' | 'license_renewal';
type OptionsStage = 'destination' | 'inside' | 'outside' | 'partners' | 'message' | 'consent' | 'sent';
type IconProps = { className?: string };

type Partner = {
  isExternalBusiness?: boolean;
  googleMapsUrl?: string;
  userId: string;
  masterAccountUserId?: string;
  partnerType: PartnerType;
  displayName: string;
  businessName: string;
  phone: string;
  email: string;
  province: string;
  townCity: string;
  addressLine1: string;
  logoUrl: string;
  websiteUrl: string;
  description: string;
  serviceRadiusKm: number | null;
  brandFocus: string;
  services: string;
  isAim4priceManaged?: boolean;
  assistanceLocationId?: string;
  serviceAreaNotice?: string;
};

type QuoteOption = {
  leadType: AssetLeadType;
  partnerType: PartnerType;
  title: string;
  shortTitle: string;
  description: string;
  pickerTitle: string;
  emptyText: string;
};

const QUOTE_OPTIONS: QuoteOption[] = [
  {
    leadType: 'finance',
    partnerType: 'finance',
    title: 'Get finance help',
    shortTitle: 'Finance help',
    description: 'Send this asset to a finance provider and request finance or refinance.',
    pickerTitle: 'Choose a finance provider',
    emptyText: 'No listed finance providers were found.',
  },
  {
    leadType: 'insurance',
    partnerType: 'insurance',
    title: 'Get insurance help',
    shortTitle: 'Insurance help',
    description: 'Send this asset to an insurer or broker and request cover or a value review.',
    pickerTitle: 'Choose an insurer or broker',
    emptyText: 'No listed insurers or brokers were found.',
  },
  {
    leadType: 'replacement_quote',
    partnerType: 'dealer',
    title: 'Get dealership help',
    shortTitle: 'Dealership help',
    description: 'Send this asset to a dealer and request a replacement price.',
    pickerTitle: 'Choose a dealer',
    emptyText: 'No listed dealers were found.',
  },
  {
    leadType: 'license_renewal',
    partnerType: 'licensing',
    title: 'Licence renewal',
    shortTitle: 'Licence renewal',
    description: 'Share renewal details and licence documents.',
    pickerTitle: 'Choose a renewal expert',
    emptyText: 'No listed licence renewal experts were found.',
  },
];

function FinanceHelpIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.2 4.2c.55 1.35 1.7 2.1 3.8 2.1s3.25-.75 3.8-2.1" />
      <path d="M9.15 3.2h5.7l1.55 2.25-1.85 1.85h-5.1L7.6 5.45z" />
      <path d="M7.35 8.05c-2.65 2.2-4.1 5.15-4.1 8.25 0 3.15 2.5 4.5 8.75 4.5s8.75-1.35 8.75-4.5c0-3.1-1.45-6.05-4.1-8.25" />
      <path d="M12 10.1v7.1" />
      <path d="M14.4 11.65h-3.2c-.9 0-1.55.52-1.55 1.25s.58 1.12 1.55 1.32l1.6.34c.97.2 1.55.6 1.55 1.32s-.65 1.25-1.55 1.25H9.45" />
    </svg>
  );
}

function InsuranceHelpIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 20 6v5c0 5.2-3.3 8.7-8 10-4.7-1.3-8-4.8-8-10V6z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}

function DealershipHelpIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 9 5 4h14l2 5" />
      <path d="M4 9h16v3a3 3 0 0 1-3 3h-1a3 3 0 0 1-2-1 3 3 0 0 1-4 0 3 3 0 0 1-2 1H7a3 3 0 0 1-3-3z" />
      <path d="M5 15v5h14v-5" />
    </svg>
  );
}

function LicenceRenewalIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h5M10 16h5" />
    </svg>
  );
}

function money(value: number) {
  return value > 0 ? `R ${Math.round(value).toLocaleString('en-ZA')}` : 'Not saved';
}

function partnerName(partner: Partner) {
  return partner.businessName || partner.displayName || 'Aim4price business';
}

function partnerLocation(partner: Partner) {
  return [partner.townCity, partner.province].filter(Boolean).join(', ') || 'Location not saved';
}

function partnerTypeLabel(type: PartnerType) {
  if (type === 'finance') return 'Finance provider';
  if (type === 'insurance') return 'Insurer or broker';
  if (type === 'licensing') return 'Licence renewal expert';
  return 'Dealer';
}

function optionTone(type: AssetLeadType) {
  if (type === 'finance') return styles.ownerOptionFinance;
  if (type === 'insurance') return styles.ownerOptionInsurance;
  if (type === 'license_renewal') return styles.ownerOptionLicensing;
  return styles.ownerOptionDealer;
}

function renderOptionIcon(type: AssetLeadType) {
  if (type === 'finance') return <FinanceHelpIcon className={styles.ownerOptionChoiceIcon} />;
  if (type === 'insurance') return <InsuranceHelpIcon className={styles.ownerOptionChoiceIcon} />;
  if (type === 'license_renewal') return <LicenceRenewalIcon className={styles.ownerOptionChoiceIcon} />;
  return <DealershipHelpIcon className={styles.ownerOptionChoiceIcon} />;
}

export default function OwnerAssetOptionsClient({ assetId, asset, reportAsset, valuationReportHtml, assetKind, assetIsLicensed, licenceRenewalDate }: {
  assetId: string;
  asset: ExternalAssetShareItem;
  reportAsset: OwnerAssetReportPickerAsset;
  valuationReportHtml: string;
  assetKind: string;
  assetIsLicensed: boolean;
  licenceRenewalDate: string;
}) {
  const [stage, setStage] = useState<OptionsStage>('destination');
  const [selectedLeadType, setSelectedLeadType] = useState<AssetLeadType | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [additionalContact, setAdditionalContact] = useState('');
  const [businessPreviewReady, setBusinessPreviewReady] = useState(false);
  const [requestKey, setRequestKey] = useState('');
  const [businessHeading, setBusinessHeading] = useState('');
  const [businessService, setBusinessService] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [trackMaintenance, setTrackMaintenance] = useState(false);
  const [trackingPermissions, setTrackingPermissions] = useState<DealerMaintenancePermissions>(() => ({
    ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS,
  }));
  const [isTrackingPermissionsOpen, setIsTrackingPermissionsOpen] = useState(false);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [reportFiles, setReportFiles] = useState<ExternalShareFileSource[]>([]);
  const [reportPickerOpen, setReportPickerOpen] = useState(false);

  const availableOptions = useMemo(
    () => assetKind === 'property' ? QUOTE_OPTIONS.filter((option) => option.leadType !== 'replacement_quote') : QUOTE_OPTIONS,
    [assetKind],
  );
  const selectedOption = useMemo(
    () => QUOTE_OPTIONS.find((option) => option.leadType === selectedLeadType) ?? null,
    [selectedLeadType],
  );
  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.userId === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );
  const assetHref = `/owner-app/assets/${encodeURIComponent(assetId)}`;
  const assetTitle = asset.title;

  function returnToStage(nextStage: OptionsStage) {
    setNotice(null);
    setStage(nextStage);
  }

  const topBackLabel = stage === 'inside' || stage === 'outside'
    ? 'Share'
    : stage === 'partners'
      ? 'Inside Aim4price'
    : stage === 'message'
      ? 'Companies'
      : stage === 'consent'
        ? 'Message'
        : 'Asset';
  const topBackAction = stage === 'inside' || stage === 'outside'
    ? () => returnToStage('destination')
    : stage === 'partners'
      ? () => returnToStage('inside')
    : stage === 'message'
      ? () => returnToStage('partners')
      : stage === 'consent'
        ? () => returnToStage('message')
        : undefined;

  async function loadPartners(option: QuoteOption, searchValue = '', heading = businessHeading, service = businessService) {
    setLoadingPartners(true);
    setNotice(null);
    try {
      const params = new URLSearchParams({ type: option.partnerType });
      if (heading) params.set('category', heading);
      if (service) params.set('service', service);
      if (searchValue.trim()) params.set('search', searchValue.trim());
      const response = await fetch(`/api/partners?${params.toString()}`, { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as { ok?: boolean; partners?: Partner[]; error?: string } | null;
      if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!response.ok || !payload?.ok || !Array.isArray(payload.partners)) throw new Error(payload?.error || 'Failed to load available companies.');
      setPartners(payload.partners);
      setSelectedPartnerId((current) => payload.partners?.some((partner) => partner.userId === current) ? current : '');
    } catch (cause) {
      setPartners([]);
      setSelectedPartnerId('');
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to load available companies.' });
    } finally {
      setLoadingPartners(false);
    }
  }

  async function chooseOption(option: QuoteOption) {
    if (option.leadType === 'license_renewal' && (!assetIsLicensed || !licenceRenewalDate)) {
      window.location.assign(`${assetHref}/manage/licence`);
      return;
    }
    setBusinessHeading('');
    setBusinessService('');
    setAdditionalContact('');
    setSelectedLeadType(option.leadType);
    setSelectedPartnerId('');
    setSearch('');
    setMessage('');
    setConsentAccepted(false);
    setTrackMaintenance(false);
    setTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    setIsTrackingPermissionsOpen(false);
    setStage('partners');
    await loadPartners(option, '', '', '');
  }

  function addReport(source: ExternalShareFileSource) {
    setReportFiles((current) => current.some((report) => report.id === source.id)
      ? current
      : [...current, source]);
    setReportPickerOpen(false);
    setNotice({ tone: 'success', message: `${source.label} added to your share.` });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedOption) void loadPartners(selectedOption, search);
  }

  function choosePartner(partner: Partner) {
    setSelectedPartnerId(partner.userId);
    setTrackMaintenance(false);
    setRequestKey(crypto.randomUUID());
    setConsentAccepted(false);
    setStage('message');
    setNotice(null);
  }

  function openTrackingPermissions() {
    if (!trackMaintenance) {
      setTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    }
    setIsTrackingPermissionsOpen(true);
  }

  function cancelTrackingPermissions() {
    if (!trackMaintenance) {
      setTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    }
    setIsTrackingPermissionsOpen(false);
  }

  function confirmTrackingPermissions() {
    setTrackMaintenance(true);
    setIsTrackingPermissionsOpen(false);
  }

  function disableTracking() {
    setTrackMaintenance(false);
    setTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    setIsTrackingPermissionsOpen(false);
  }

  async function sendRequest() {
    if (!selectedOption || !selectedPartner || !consentAccepted || sending || (selectedPartner.isExternalBusiness && !businessPreviewReady)) return;
    setSending(true);
    setNotice(null);
    try {
      const response = await fetch('/api/asset-leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          partnerUserId: selectedPartner.masterAccountUserId || selectedPartner.userId,
          assistanceLocationId: selectedPartner.assistanceLocationId,
          leadType: selectedOption.leadType,
          ownerMessage: message,
          additionalContact, requestKey,
          includedSections: {
            assetDetails: true,
            valuationSummary: selectedOption.leadType !== 'license_renewal',
            mainPhoto: true,
            photos: true,
            documents: true,
            scanHistory: false,
            source: 'asset_register_options',
          },
          trackMaintenance: !selectedPartner.isExternalBusiness && selectedOption.leadType === 'replacement_quote' && trackMaintenance,
          trackingPermissions: selectedOption.leadType === 'replacement_quote' && trackMaintenance
            ? trackingPermissions
            : undefined,
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; confirmation?: string | null; error?: string } | null;
      if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to send this request.');
      setStage('sent');
      setNotice({
        tone: 'success',
        message: selectedPartner.isAim4priceManaged
          ? payload.confirmation || 'Aim4price will help locate a suitable provider. Your asset will not be shared with an external provider without your further approval.'
          : `${selectedOption.shortTitle} request sent to ${partnerName(selectedPartner)}.`,
      });
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to send this request.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <OwnerAppNav backHref={assetHref} backLabel={topBackLabel} backAction={topBackAction} />
      <div className={styles.wideContent}>
        <section className={styles.ownerOptionsIdentity}>
          <h1>{stage === 'inside'
            ? 'Share inside Aim4price'
            : stage === 'outside'
              ? 'Share outside Aim4price'
              : 'Share'}</h1>
          <strong><BalancedHeadingText text={assetTitle} /></strong>
          <p>{money(asset.valueExVat ?? 0)} excl. VAT</p>
        </section>

      {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}

      {stage === 'destination' ? (
        <section className={`${styles.section} ${styles.ownerOptionsSection} ${styles.ownerShareDestinationSection}`}>
          <AssetShareDestinationPicker
            onInside={() => returnToStage('inside')}
            onOutside={() => returnToStage('outside')}
          />
        </section>
      ) : null}

      {stage === 'inside' ? (
        <section className={`${styles.section} ${styles.ownerOptionsSection}`}>
          <div className={styles.ownerOptionChoiceList}>
            {availableOptions.map((option) => {
              const needsLicenceDetails = option.leadType === 'license_renewal' && (!assetIsLicensed || !licenceRenewalDate);
              return (
              <button key={option.leadType} type="button" className={`${styles.ownerOptionChoice} ${optionTone(option.leadType)} ${needsLicenceDetails ? styles.ownerOptionChoiceNeedsSetup : ''}`} onClick={() => void chooseOption(option)}>
                <span className={styles.ownerOptionChoiceIconTile}>{renderOptionIcon(option.leadType)}</span>
                <span className={styles.ownerOptionChoiceCopy}><strong>{option.title}</strong><small>{needsLicenceDetails ? 'Add a renewal date before sharing.' : option.description}</small></span>
              </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {stage === 'outside' ? (
        <section className={styles.ownerExternalShareSection} aria-hidden={reportPickerOpen || undefined}>
          <AssetExternalShare
            shareName={assetTitle}
            assets={[asset]}
            reportFiles={reportFiles}
            onAddAim4priceReport={() => { setNotice(null); setReportPickerOpen(true); }}
            onRemoveAim4priceReport={(reportId) => setReportFiles((current) => current.filter((report) => report.id !== reportId))}
          />
        </section>
      ) : null}

      {stage === 'partners' && selectedOption ? (
        <section className={`${styles.section} ${styles.ownerOptionsSection}`}>
          <div className={styles.ownerOptionsFlowHeader}>
            <div><h2><BalancedHeadingText text={selectedOption.pickerTitle} /></h2></div>
          </div>

          <form className={styles.ownerPartnerSearch} onSubmit={submitSearch}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business, town or province" aria-label="Search available companies" />
            <button type="submit" disabled={loadingPartners}>{loadingPartners ? 'Searching…' : 'Search'}</button>
          </form>

          <BusinessInvite />
          <BusinessFilters heading={businessHeading} service={businessService} onChange={(heading, service) => { setBusinessHeading(heading); setBusinessService(service); void loadPartners(selectedOption, search, heading, service); }} />
          <div className={styles.ownerPartnerList}>
            {loadingPartners ? <p className={styles.ownerOptionsEmpty}>Loading available companies…</p> : partners.length ? partners.map((partner) => (
              <button type="button" className={styles.ownerPartnerCard} key={partner.userId} onClick={() => choosePartner(partner)}>
                <span className={styles.ownerPartnerLogo}>
                  {partner.logoUrl ? <img src={partner.logoUrl} alt="" /> : <b>{partnerName(partner).charAt(0).toUpperCase()}</b>}
                </span>
                <span className={styles.ownerPartnerCopy}>
                  <strong>{partnerName(partner)}</strong>
                  {partner.isAim4priceManaged ? <em className={styles.ownerManagedBadge}>Aim4price managed</em> : null}
                  <small>{partnerLocation(partner)}</small>
                  <small>{partner.services || partnerTypeLabel(partner.partnerType)}</small>
                  {partner.isAim4priceManaged ? <small className={styles.ownerManagedCopy}>Service area — not a physical branch.</small> : null}
                </span>
                <b aria-hidden="true">›</b>
              </button>
            )) : <p className={styles.ownerOptionsEmpty}>{selectedOption.emptyText}</p>}
          </div>
        </section>
      ) : null}

      {stage === 'message' && selectedOption && selectedPartner ? (
        <section className={`${styles.section} ${styles.ownerOptionsSection}`}>
          <div className={styles.ownerOptionsFlowHeader}>
            <div>
              <h2><BalancedHeadingText text="Send message" /></h2>
              <p>Add an optional note before reviewing the request.</p>
            </div>
          </div>

          <div className={styles.ownerSelectedPartner}>
            <span className={styles.ownerPartnerLogo}>
              {selectedPartner.logoUrl ? <img src={selectedPartner.logoUrl} alt="" /> : <b>{partnerName(selectedPartner).charAt(0).toUpperCase()}</b>}
            </span>
            <div>
              <small>{selectedPartner.isAim4priceManaged ? 'Selected service area' : 'Selected company'}</small>
              <strong>{partnerName(selectedPartner)}</strong>
              {selectedPartner.isAim4priceManaged ? <em className={styles.ownerManagedBadge}>Aim4price managed</em> : null}
              <span>{partnerLocation(selectedPartner)}</span>
            </div>
          </div>

          <div className={styles.ownerPartnerContacts}>
            {selectedPartner.googleMapsUrl ? <a href={selectedPartner.googleMapsUrl} target="_blank" rel="noreferrer">View business on Google</a> : null}
            {selectedPartner.email ? <a href={`mailto:${selectedPartner.email}`}><small>Email</small><span>{selectedPartner.email}</span></a> : null}
            {selectedPartner.phone ? <a href={`tel:${selectedPartner.phone.replace(/[^+\d]/g, '')}`}><small>Phone</small><span>{selectedPartner.phone}</span></a> : null}
            {selectedPartner.websiteUrl ? (
              <a href={/^https?:\/\//i.test(selectedPartner.websiteUrl) ? selectedPartner.websiteUrl : `https://${selectedPartner.websiteUrl}`} target="_blank" rel="noreferrer">
                <small>Website</small>
                <span>{selectedPartner.isAim4priceManaged && selectedPartner.partnerType === 'dealer'
                  ? 'www.aim4price.com'
                  : selectedPartner.websiteUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</span>
              </a>
            ) : null}
            <span><small>Address</small><b>{selectedPartner.isAim4priceManaged ? 'Service area — not a physical branch' : [selectedPartner.addressLine1, selectedPartner.townCity, selectedPartner.province].filter(Boolean).join(', ') || 'Not saved'}</b></span>
          </div>

          <p className={styles.ownerShareNotice}>{selectedPartner.isAim4priceManaged
            ? 'Aim4price will help locate a suitable provider. Your asset will remain with the Aim4price master assistance account unless you later approve sharing it with an external provider.'
            : 'This sends this asset only. It does not share the full asset register.'}</p>
          <label className={styles.ownerOptionMessageField}>
            <span>Your message <small>Optional</small></span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Please contact me about this asset." />
          </label>
          {selectedPartner.isExternalBusiness ? <label className={styles.ownerOptionMessageField}><span>Add contact · optional</span><textarea value={additionalContact} onChange={e => setAdditionalContact(e.target.value)} maxLength={500} placeholder="Phone number or another contact person" /></label> : null}
          {selectedOption.leadType === 'replacement_quote' && !selectedPartner.isExternalBusiness ? (
            <button
              type="button"
              className={styles.ownerTrackingChoice}
              onClick={openTrackingPermissions}
              aria-pressed={trackMaintenance}
            >
              <span className={`${styles.ownerTrackingCheckbox} ${trackMaintenance ? styles.ownerTrackingCheckboxActive : ''}`} aria-hidden="true">
                {trackMaintenance ? '✓' : ''}
              </span>
              <span className={styles.ownerTrackingChoiceCopy}>
                <strong>Enable dealer tracking</strong>
                <small>The dealer can download maintenance reports and create schedules. New schedules only enter your Asset Register after you approve them.</small>
                <em>{trackMaintenance ? 'Permissions selected. Tap to review.' : 'Choose what the dealer can see and update.'}</em>
              </span>
            </button>
          ) : null}
          <div className={`${styles.ownerOptionsFooter} ${styles.ownerOptionsFooterSingle}`}>
            <button type="button" className={styles.primaryButton} onClick={() => { setConsentAccepted(false); setBusinessPreviewReady(false); setRequestKey(crypto.randomUUID()); setStage('consent'); }}>Review request</button>
          </div>
        </section>
      ) : null}

      {stage === 'consent' && selectedOption && selectedPartner ? (
        <section className={`${styles.section} ${styles.ownerOptionsSection}`}>
          <div className={styles.ownerOptionsFlowHeader}>
            <div><h2><BalancedHeadingText text="Confirm and send request" /></h2></div>
          </div>

          {selectedPartner.isExternalBusiness ? <BusinessSharePreview onReady={setBusinessPreviewReady} payload={{assetId,partnerUserId:selectedPartner.userId,ownerMessage:message,additionalContact,includedSections:{assetDetails:true,valuationSummary:selectedOption.leadType!=='license_renewal',mainPhoto:true,photos:true}}} /> : null}
          <div className={styles.ownerPopiaBox}>
            <strong>Disclaimer and POPIA note</strong>
            {selectedPartner.isAim4priceManaged ? (
              <p>By sending this request, you allow Aim4price to share this asset and your saved business contact details with the relevant Aim4price master assistance account. Aim4price will not share it with an external provider without your further approval.</p>
            ) : selectedOption.leadType === 'license_renewal' ? (
              <p>By sending this request, you allow Aim4price to share this asset's basic details, renewal date, saved photos, licence documents and your saved business contact details with {partnerName(selectedPartner)}.</p>
            ) : (
              <p>By sending this request, you allow Aim4price to share this selected asset, its saved valuation details and your saved business contact details with {partnerName(selectedPartner)}.</p>
            )}
            <p>This is a lead request only. It does not create a finance, insurance, licence renewal, valuation or sales agreement. {selectedPartner.isAim4priceManaged ? 'The selected town is a service area, not a physical Aim4price branch.' : 'The selected company may contact you outside Aim4price.'}</p>
            {selectedOption.leadType === 'replacement_quote' && trackMaintenance ? <p>The dealer will receive ongoing Maintenance Tracker access with the permissions you selected. Proposed schedules and asset changes still require your approval.</p> : null}
          </div>
          <label className={styles.ownerConsentField}>
            <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
            <span>I accept the disclaimer and POPIA permission note.</span>
          </label>
          <div className={`${styles.ownerOptionsFooter} ${styles.ownerOptionsFooterSingle}`}>
            <button type="button" className={styles.primaryButton} onClick={() => void sendRequest()} disabled={sending || !consentAccepted || (selectedPartner.isExternalBusiness && !businessPreviewReady)}>{sending ? 'Sending…' : `Send to ${partnerName(selectedPartner)}`}</button>
          </div>
        </section>
      ) : null}

      {stage === 'sent' ? (
        <section className={`${styles.section} ${styles.ownerOptionsSent}`}>
          <h2>Request sent</h2>
          <p>{selectedPartner?.isAim4priceManaged
            ? 'Aim4price will help locate a suitable provider. No external provider will receive your asset without your further approval.'
            : 'The selected company can now review the saved asset details and contact you.'}</p>
          <Link className={styles.primaryButton} href={assetHref} prefetch={false}>Back to asset</Link>
        </section>
      ) : null}
      </div>

      {isTrackingPermissionsOpen && selectedOption?.leadType === 'replacement_quote' ? (
        <div className={styles.ownerTrackingPickerOverlay}>
          <button
            type="button"
            className={styles.ownerTrackingPickerBackdrop}
            onClick={cancelTrackingPermissions}
            aria-label="Close dealer tracking settings"
          />
          <section
            className={styles.ownerTrackingPickerModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-tracking-picker-title"
          >
            <header className={styles.ownerTrackingPickerHeader}>
              <div>
                <h2 id="owner-tracking-picker-title">Dealer tracking settings</h2>
                <p>{assetTitle}</p>
              </div>
              <button type="button" onClick={cancelTrackingPermissions} aria-label="Close dealer tracking settings">×</button>
            </header>
            <div className={styles.ownerTrackingPickerBody}>
              <div className={styles.ownerTrackingPickerIntro}>
                <strong>Choose what this dealer can access</strong>
                <p>Select the permissions to activate as soon as the asset is shared.</p>
              </div>
              <DealerMaintenancePermissionPicker
                value={trackingPermissions}
                onChange={setTrackingPermissions}
              />
            </div>
            <footer className={styles.ownerTrackingPickerFooter}>
              <button type="button" className={styles.secondaryButton} onClick={cancelTrackingPermissions}>Cancel</button>
              {trackMaintenance ? (
                <button type="button" className={styles.secondaryButton} onClick={disableTracking}>Disable tracking</button>
              ) : null}
              <button type="button" className={styles.primaryButton} onClick={confirmTrackingPermissions}>Save tracking settings</button>
            </footer>
          </section>
        </div>
      ) : null}

      {stage === 'outside' && reportPickerOpen ? (
        <OwnerAssetReportPicker
          asset={reportAsset}
          mode="attach"
          valuationReportHtml={valuationReportHtml}
          onAttach={addReport}
          onDismiss={() => setReportPickerOpen(false)}
        />
      ) : null}
    </>
  );
}
