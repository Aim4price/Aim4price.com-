'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type EnquiryStatus = 'pending' | 'approved' | 'temporarily_denied';

type AssetDiscoveryAsset = {
  id: string;
  type: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  province: string;
  enquiryId: string | null;
  enquiryStatus: EnquiryStatus | null;
  requestAgainAtIso: string | null;
  approvedAtIso: string | null;
};

type Option = {
  value: string;
  label: string;
  count: number;
};

type ListResponse = {
  ok: boolean;
  assets?: AssetDiscoveryAsset[];
  provinceOptions?: Option[];
  typeOptions?: Option[];
  error?: string;
};

type EnquiryResponse = {
  ok: boolean;
  enquiry?: {
    id: string;
    status: EnquiryStatus;
    requestAgainAtIso: string | null;
  };
  error?: string;
};

const SEARCH_DEBOUNCE_MS = 250;

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(time));
}

function statusLabel(asset: AssetDiscoveryAsset): string {
  if (asset.enquiryStatus === 'pending') return 'Pending owner decision';
  if (asset.enquiryStatus === 'approved') return 'Approved';
  if (asset.enquiryStatus === 'temporarily_denied') {
    const retryDate = formatDate(asset.requestAgainAtIso);
    return retryDate ? `Temporarily denied. Available again after ${retryDate}.` : 'Temporarily denied.';
  }

  return '';
}

function isEnquireDisabled(asset: AssetDiscoveryAsset): boolean {
  if (asset.enquiryStatus === 'pending' || asset.enquiryStatus === 'approved') return true;
  if (asset.enquiryStatus === 'temporarily_denied' && asset.requestAgainAtIso) {
    const retryTime = Date.parse(asset.requestAgainAtIso);
    return Number.isFinite(retryTime) && retryTime > Date.now();
  }

  return false;
}

export default function AssetDiscoveryClient() {
  const [assets, setAssets] = useState<AssetDiscoveryAsset[]>([]);
  const [provinceOptions, setProvinceOptions] = useState<Option[]>([]);
  const [typeOptions, setTypeOptions] = useState<Option[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('all');
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetDiscoveryAsset | null>(null);
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (province !== 'all') params.set('province', province);
    if (type !== 'all') params.set('type', type);

    async function loadAssets() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/asset-discovery?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await response.json()) as ListResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Failed to load Asset Discovery.');
        }

        if (!mounted) return;
        setAssets(Array.isArray(data.assets) ? data.assets : []);
        setProvinceOptions(Array.isArray(data.provinceOptions) ? data.provinceOptions : []);
        setTypeOptions(Array.isArray(data.typeOptions) ? data.typeOptions : []);
      } catch (loadError) {
        if (!mounted) return;
        setAssets([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load Asset Discovery.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadAssets();

    return () => {
      mounted = false;
    };
  }, [search, province, type]);

  const filteredSummary = useMemo(() => {
    const provinces = new Set(assets.map((asset) => asset.province).filter(Boolean));
    const types = new Set(assets.map((asset) => asset.type).filter(Boolean));
    return {
      total: assets.length,
      provinceCount: provinces.size,
      typeCount: types.size,
    };
  }, [assets]);

  function openEnquiry(asset: AssetDiscoveryAsset) {
    setSelectedAsset(asset);
    setMessage('');
    setSubmitError(null);
    setSuccessMessage(null);
  }

  function closeModal() {
    if (submitting) return;
    setSelectedAsset(null);
    setMessage('');
    setSubmitError(null);
    setSuccessMessage(null);
  }

  async function submitEnquiry() {
    if (!selectedAsset || submitting) return;

    try {
      setSubmitting(true);
      setSubmitError(null);
      setSuccessMessage(null);
      const response = await fetch('/api/asset-discovery', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          message,
        }),
      });
      const data = (await response.json()) as EnquiryResponse;

      if (!response.ok || !data.ok || !data.enquiry) {
        throw new Error(data.error || 'Failed to send enquiry.');
      }

      const nextStatus = data.enquiry.status;
      const nextRequestAgainAtIso = data.enquiry.requestAgainAtIso;
      setAssets((current) =>
        current.map((asset) =>
          asset.id === selectedAsset.id
            ? {
                ...asset,
                enquiryId: data.enquiry?.id ?? asset.enquiryId,
                enquiryStatus: nextStatus,
                requestAgainAtIso: nextRequestAgainAtIso,
              }
            : asset,
        ),
      );
      setSelectedAsset((current) =>
        current
          ? {
              ...current,
              enquiryId: data.enquiry?.id ?? current.enquiryId,
              enquiryStatus: nextStatus,
              requestAgainAtIso: nextRequestAgainAtIso,
            }
          : current,
      );
      setSuccessMessage('Enquiry sent. The owner will only see your message if they choose Yes.');
    } catch (submitErrorValue) {
      setSubmitError(submitErrorValue instanceof Error ? submitErrorValue.message : 'Failed to send enquiry.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedStatus = selectedAsset ? statusLabel(selectedAsset) : '';
  const selectedDisabled = selectedAsset ? isEnquireDisabled(selectedAsset) : false;

  return (
    <>
      <section className={styles.shell}>
        <div className={styles.heroPanel}>
          <h1>Asset Discovery</h1>
        </div>

        <section className={styles.controlsPanel} aria-label="Asset Discovery controls">
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Available assets</span>
              <strong>{filteredSummary.total}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Types</span>
              <strong>{filteredSummary.typeCount}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Provinces</span>
              <strong>{filteredSummary.provinceCount}</strong>
            </div>
          </div>

          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by type, brand, model, year, usage, condition or province"
              />
            </label>

            <select className={styles.selectBox} value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by type">
              <option value="all">All types</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>

            <select className={styles.selectBox} value={province} onChange={(event) => setProvince(event.target.value)} aria-label="Filter by province">
              <option value="all">All provinces</option>
              {provinceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>
        </section>

        {error ? <div className={styles.errorPanel}>{error}</div> : null}
        {loading ? <div className={styles.statePanel}>Loading Asset Discovery...</div> : null}

        {!loading && !error ? (
          assets.length ? (
            <section className={styles.tableCard} aria-label="Asset Discovery assets">
              <div className={styles.tableScroll}>
                <table className={styles.assetTable}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Brand</th>
                      <th>Model</th>
                      <th>Year</th>
                      <th>Usage</th>
                      <th>Condition</th>
                      <th>Province</th>
                      <th>Enquire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const disabled = isEnquireDisabled(asset);
                      const currentStatus = statusLabel(asset);

                      return (
                        <tr key={asset.id}>
                          <td data-label="Type">{asset.type}</td>
                          <td data-label="Brand">{asset.brand}</td>
                          <td data-label="Model">{asset.model}</td>
                          <td data-label="Year">{asset.year}</td>
                          <td data-label="Usage">{asset.usage}</td>
                          <td data-label="Condition">{asset.condition}</td>
                          <td data-label="Province">{asset.province}</td>
                          <td data-label="Enquire" className={styles.actionCell}>
                            <button
                              type="button"
                              className={disabled ? styles.secondaryButton : styles.primaryButton}
                              onClick={() => openEnquiry(asset)}
                            >
                              {disabled ? 'View status' : 'Enquire'}
                            </button>
                            {currentStatus ? <small>{currentStatus}</small> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <div className={styles.statePanel}>No assets available.</div>
          )
        ) : null}
      </section>

      {selectedAsset ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeModal}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="asset-discovery-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span>Asset Discovery</span>
                <h2 id="asset-discovery-modal-title">Enquire about this machine</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close enquiry">
                ×
              </button>
            </div>

            <div className={styles.assetSummaryGrid}>
              <div><span>Type</span><strong>{selectedAsset.type}</strong></div>
              <div><span>Brand</span><strong>{selectedAsset.brand}</strong></div>
              <div><span>Model</span><strong>{selectedAsset.model}</strong></div>
              <div><span>Year</span><strong>{selectedAsset.year}</strong></div>
              <div><span>Usage</span><strong>{selectedAsset.usage}</strong></div>
              <div><span>Condition</span><strong>{selectedAsset.condition}</strong></div>
              <div><span>Province</span><strong>{selectedAsset.province}</strong></div>
            </div>

            {selectedStatus ? <div className={styles.statusBox}>{selectedStatus}</div> : null}

            {!selectedDisabled ? (
              <label className={styles.messageBox}>
                <span>Short message</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 600))}
                  maxLength={600}
                  rows={4}
                  placeholder="Write a short message for the owner. They will only see this if they choose Yes."
                />
                <small>{message.length}/600</small>
              </label>
            ) : null}

            {submitError ? <div className={styles.errorPanel}>{submitError}</div> : null}
            {successMessage ? <div className={styles.successPanel}>{successMessage}</div> : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={submitting}>
                Close
              </button>
              {!selectedDisabled && !successMessage ? (
                <button type="button" className={styles.primaryButton} onClick={submitEnquiry} disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send enquiry'}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
