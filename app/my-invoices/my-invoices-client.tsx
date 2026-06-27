'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type SVGProps } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type FlowMode = 'asset-manual' | 'asset-automatic' | 'manual-form' | 'upload' | 'review' | null;
type InvoiceSource = 'manual' | 'automatic';
type UsageMetric = 'none' | 'hours' | 'km';
type NoticeTone = 'success' | 'error';

type AssetOption = {
  id: string;
  title: string;
  kind: string;
  categoryLabel: string;
  yearModel: number | null;
  usageReading: number | null;
  usageMetric: 'hours' | 'km';
  condition: string;
  value: number;
  selectedMethod: string;
  meta: string;
};

type InvoiceDocument = {
  id: string;
  uploadUrl: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  source: InvoiceSource;
  rawExtractedText: string;
  extractionStatus: string;
  extractionWarnings: string[];
  createdAtIso: string;
};

type InvoiceBlock = {
  id: string;
  blockType: 'maintenance' | 'parts' | 'repair' | 'other';
  description: string;
  totalIncVat: number | null;
};

type InvoiceRecord = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetCategoryLabel: string;
  assetYearModel: number | null;
  assetUsageReading: number | null;
  assetUsageMetric: 'hours' | 'km';
  assetCondition: string;
  invoiceDocumentId: string | null;
  document: InvoiceDocument | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number;
  usageReading: number | null;
  usageMetric: UsageMetric;
  source: InvoiceSource;
  notes: string;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  blocks: InvoiceBlock[];
  createdAtIso: string;
  updatedAtIso: string;
};

type InvoiceSummary = {
  totalSpent: number;
  maintenanceSpend: number;
  partsSpend: number;
  repairSpend: number;
  otherSpend: number;
  vatTotal: number;
  invoiceCount: number;
};

type InvoicesResponse = {
  ok: boolean;
  assets?: AssetOption[];
  invoices?: InvoiceRecord[];
  summary?: InvoiceSummary;
  invoice?: InvoiceRecord | null;
  duplicateWarnings?: string[];
  error?: string;
};

type UploadResponse = {
  ok: boolean;
  document?: InvoiceDocument;
  error?: string;
};

type ExtractionDraft = {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  subtotalExVat?: number | null;
  vatAmount?: number | null;
  totalIncVat?: number | null;
  usageReading?: number | null;
  usageMetric?: UsageMetric;
  maintenanceWorkDone?: string;
  partsSupplied?: string;
  repairWorkDone?: string;
  notes?: string;
};

type ExtractionResponse = {
  ok: boolean;
  document?: InvoiceDocument;
  extraction?: {
    draft: ExtractionDraft;
    rawText: string;
    warnings: string[];
    quality: 'none' | 'weak' | 'good';
  };
  error?: string;
};

type InvoiceDraft = {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalExVat: string;
  vatAmount: string;
  totalIncVat: string;
  usageReading: string;
  usageMetric: UsageMetric;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  notes: string;
  source: InvoiceSource;
  invoiceDocumentId: string | null;
};

type Notice = {
  tone: NoticeTone;
  message: string;
};

function IconBase(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </IconBase>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </IconBase>
  );
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'R 0';
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

function formatMoneyWithCents(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toFixed(2);
}

function parseMoney(value: string): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  let text = raw
    .replace(/zar/gi, '')
    .replace(/rand/gi, '')
    .replace(/r/gi, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[^0-9, .-]/g, '')
    .replace(/\s+/g, '');

  if (!/[0-9]/.test(text)) return null;

  if (text.includes(',') && text.includes('.')) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',') && !text.includes('.')) {
    const parts = text.split(',');
    const last = parts[parts.length - 1] ?? '';
    text = last.length === 2 ? `${parts.slice(0, -1).join('')}.${last}` : text.replace(/,/g, '');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : null;
}

function buildEmptyDraft(source: InvoiceSource): InvoiceDraft {
  return {
    supplierName: '',
    invoiceNumber: '',
    invoiceDate: '',
    subtotalExVat: '',
    vatAmount: '',
    totalIncVat: '',
    usageReading: '',
    usageMetric: 'none',
    maintenanceWorkDone: '',
    partsSupplied: '',
    repairWorkDone: '',
    notes: '',
    source,
    invoiceDocumentId: null,
  };
}

function draftFromExtraction(extractionDraft: ExtractionDraft, source: InvoiceSource, documentId: string): InvoiceDraft {
  return {
    supplierName: extractionDraft.supplierName ?? '',
    invoiceNumber: extractionDraft.invoiceNumber ?? '',
    invoiceDate: extractionDraft.invoiceDate ?? '',
    subtotalExVat: formatMoneyWithCents(extractionDraft.subtotalExVat ?? null),
    vatAmount: formatMoneyWithCents(extractionDraft.vatAmount ?? null),
    totalIncVat: formatMoneyWithCents(extractionDraft.totalIncVat ?? null),
    usageReading: extractionDraft.usageReading === null || typeof extractionDraft.usageReading === 'undefined' ? '' : String(extractionDraft.usageReading),
    usageMetric: extractionDraft.usageMetric ?? 'none',
    maintenanceWorkDone: extractionDraft.maintenanceWorkDone ?? '',
    partsSupplied: extractionDraft.partsSupplied ?? '',
    repairWorkDone: extractionDraft.repairWorkDone ?? '',
    notes: extractionDraft.notes ?? '',
    source,
    invoiceDocumentId: documentId,
  };
}

function recalculatedDraft(draft: InvoiceDraft): InvoiceDraft {
  const subtotal = parseMoney(draft.subtotalExVat);
  const vat = parseMoney(draft.vatAmount);
  const total = parseMoney(draft.totalIncVat);

  if (subtotal !== null && vat !== null && total === null) {
    return { ...draft, totalIncVat: (subtotal + vat).toFixed(2) };
  }

  if (subtotal !== null && total !== null && vat === null) {
    return { ...draft, vatAmount: Math.max(0, total - subtotal).toFixed(2) };
  }

  if (vat !== null && total !== null && subtotal === null) {
    return { ...draft, subtotalExVat: Math.max(0, total - vat).toFixed(2) };
  }

  return draft;
}

function assetSearchText(asset: AssetOption): string {
  return `${asset.title} ${asset.categoryLabel} ${asset.meta} ${asset.value}`.toLowerCase();
}

export default function MyInvoicesClient() {
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [flow, setFlow] = useState<FlowMode>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [draft, setDraft] = useState<InvoiceDraft>(buildEmptyDraft('manual'));
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [manualUploadFile, setManualUploadFile] = useState<File | null>(null);
  const [automaticUploadFile, setAutomaticUploadFile] = useState<File | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<InvoiceDocument | null>(null);
  const [rawTextPreview, setRawTextPreview] = useState('');
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  useEffect(() => {
    let cancelled = false;

    async function loadInvoices() {
      setIsLoading(true);

      try {
        const response = await fetch('/api/my-invoices', { cache: 'no-store' });
        const data = (await response.json()) as InvoicesResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'My Invoices could not be loaded.');
        }

        if (!cancelled) {
          setAssets(data.assets ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'My Invoices could not be loaded.' });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadInvoices();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const filteredAssets = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => assetSearchText(asset).includes(query));
  }, [assets, pickerSearch]);

  async function reloadData() {
    const response = await fetch('/api/my-invoices', { cache: 'no-store' });
    const data = (await response.json()) as InvoicesResponse;

    if (!response.ok || !data.ok) throw new Error(data.error || 'My Invoices could not be refreshed.');

    setAssets(data.assets ?? []);
  }

  function closeModal() {
    setFlow(null);
    setSelectedAssetId('');
    setPickerSearch('');
    setEditingInvoiceId(null);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(null);
    setRawTextPreview('');
    setExtractionWarnings([]);
    setDraft(buildEmptyDraft('manual'));
  }

  function startFlow(source: InvoiceSource) {
    setNotice(null);
    setSelectedAssetId('');
    setPickerSearch('');
    setEditingInvoiceId(null);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(null);
    setRawTextPreview('');
    setExtractionWarnings([]);
    setDraft(buildEmptyDraft(source));
    setFlow(source === 'manual' ? 'asset-manual' : 'asset-automatic');
  }

  function selectAssetAndContinue(assetId: string) {
    setSelectedAssetId(assetId);
    setPickerSearch('');

    if (flow === 'asset-automatic') {
      setDraft(buildEmptyDraft('automatic'));
      setFlow('upload');
      return;
    }

    setDraft(buildEmptyDraft('manual'));
    setFlow('manual-form');
  }

  async function uploadInvoiceFile(assetId: string, source: InvoiceSource, file: File): Promise<InvoiceDocument> {
    const formData = new FormData();
    formData.append('assetId', assetId);
    formData.append('source', source);
    formData.append('file', file);

    const response = await fetch('/api/my-invoices/upload', {
      method: 'POST',
      body: formData,
    });
    const data = (await response.json()) as UploadResponse;

    if (!response.ok || !data.ok || !data.document) {
      throw new Error(data.error || 'The invoice file could not be uploaded.');
    }

    return data.document;
  }

  async function handleAutomaticExtract() {
    if (!selectedAssetId || !automaticUploadFile) return;

    setIsExtracting(true);
    setNotice(null);

    try {
      const document = await uploadInvoiceFile(selectedAssetId, 'automatic', automaticUploadFile);
      setUploadedDocument(document);

      const response = await fetch('/api/my-invoices/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, assetId: selectedAssetId }),
      });
      const data = (await response.json()) as ExtractionResponse;

      if (!response.ok || !data.ok || !data.extraction) {
        setDraft({ ...buildEmptyDraft('automatic'), invoiceDocumentId: document.id });
        setExtractionWarnings([data.error || 'Aim4price could not read this invoice automatically. Complete the fields manually.']);
        setRawTextPreview('');
        setFlow('review');
        return;
      }

      const nextDocument = data.document ?? document;
      setUploadedDocument(nextDocument);
      setDraft(draftFromExtraction(data.extraction.draft, 'automatic', nextDocument.id));
      setExtractionWarnings(data.extraction.warnings ?? []);
      setRawTextPreview((data.extraction.rawText ?? '').slice(0, 3000));
      setFlow('review');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The automatic invoice flow could not continue.' });
    } finally {
      setIsExtracting(false);
    }
  }

  async function submitInvoiceDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAssetId) {
      setNotice({ tone: 'error', message: 'Choose an asset before saving the invoice.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      let invoiceDocumentId = draft.invoiceDocumentId;

      if (manualUploadFile) {
        const document = await uploadInvoiceFile(selectedAssetId, draft.source, manualUploadFile);
        invoiceDocumentId = document.id;
      }

      const payload = {
        assetId: selectedAssetId,
        invoiceDocumentId,
        supplierName: draft.supplierName,
        invoiceNumber: draft.invoiceNumber,
        invoiceDate: draft.invoiceDate,
        subtotalExVat: draft.subtotalExVat,
        vatAmount: draft.vatAmount,
        totalIncVat: draft.totalIncVat,
        usageReading: draft.usageReading,
        usageMetric: draft.usageMetric,
        source: draft.source,
        maintenanceWorkDone: draft.maintenanceWorkDone,
        partsSupplied: draft.partsSupplied,
        repairWorkDone: draft.repairWorkDone,
        notes: draft.notes,
      };

      const response = await fetch(editingInvoiceId ? `/api/my-invoices/${editingInvoiceId}` : '/api/my-invoices', {
        method: editingInvoiceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as InvoicesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'The invoice could not be saved.');
      }

      await reloadData();
      const duplicateText = data.duplicateWarnings?.length ? ` ${data.duplicateWarnings.join(' ')}` : '';
      closeModal();
      setNotice({ tone: 'success', message: `Invoice saved.${duplicateText}` });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The invoice could not be saved.' });
    } finally {
      setIsSaving(false);
    }
  }

  function setDraftField<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleManualFileChange(event: ChangeEvent<HTMLInputElement>) {
    setManualUploadFile(event.target.files?.[0] ?? null);
  }

  function handleAutomaticFileChange(event: ChangeEvent<HTMLInputElement>) {
    setAutomaticUploadFile(event.target.files?.[0] ?? null);
  }

  const assetPickerOpen = flow === 'asset-manual' || flow === 'asset-automatic';
  const formOpen = flow === 'manual-form' || flow === 'review';
  const flowTitle = flow === 'asset-automatic' ? 'Choose asset for automatic invoice' : 'Choose asset for manual invoice';
  const formTitle = flow === 'review' ? 'Review automatic invoice' : 'Manual invoice';

  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${styles[notice.tone === 'success' ? 'noticeSuccess' : 'noticeError']}`}>{notice.message}</div> : null}

        <section className={styles.pageTitleBlock}>
          <div>
            <h1>My Invoices</h1>
          </div>
        </section>

        <section className={styles.optionGrid} aria-label="Invoice capture options">
          <button type="button" className={styles.optionCard} onClick={() => startFlow('manual')}>
            <span>Manual</span>
          </button>
          <button type="button" className={styles.optionCard} onClick={() => startFlow('automatic')}>
            <span>Automatic</span>
          </button>
        </section>
      </section>

      {assetPickerOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={flowTitle}>
          <div className={styles.assetModal}>
            <div className={styles.modalHeader}>
              <h2>{flowTitle}</h2>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar}>
              <input
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Search..."
                aria-label="Search assets"
              />
              <button type="button" className={styles.secondaryButton} onClick={() => setPickerSearch('')}>Clear</button>
            </div>
            <div className={styles.assetList}>
              {isLoading ? (
                <div className={styles.emptyState}>Loading assets...</div>
              ) : filteredAssets.length ? filteredAssets.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={styles.assetRow}
                  onClick={() => selectAssetAndContinue(asset.id)}
                >
                  <span className={styles.assetInfo}>
                    <strong>{asset.title}</strong>
                    <small>{asset.meta}</small>
                    <small>{asset.categoryLabel} · {asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</small>
                  </span>
                  <span className={styles.assetValue}>
                    <strong>{formatMoney(asset.value)}</strong>
                    <small>current value</small>
                  </span>
                </button>
              )) : <div className={styles.emptyState}>No matching assets found.</div>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {flow === 'upload' ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Upload automatic invoice">
          <div className={styles.formModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Upload invoice</h2>
                <p>{selectedAsset?.title ?? 'Selected asset'}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <section className={styles.uploadPanel}>
              <h3>Documents and photos</h3>
              <div className={styles.uploadBox}>
                <label className={styles.uploadButton}>
                  <UploadIcon />
                  Add invoice
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleAutomaticFileChange} />
                </label>
                <span className={styles.uploadCounter}>{automaticUploadFile ? '1 / 1' : '0 / 1'}</span>
                {automaticUploadFile ? <p>{automaticUploadFile.name}</p> : null}
              </div>
              <p className={styles.helperText}>Digital PDFs are read with free text extraction. Images and scanned PDFs remain editable if extraction is weak.</p>
            </section>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFlow('asset-automatic')}>Back</button>
              <button type="button" className={styles.primaryButton} onClick={handleAutomaticExtract} disabled={!automaticUploadFile || isExtracting}>
                {isExtracting ? 'Reading invoice...' : 'Review invoice'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={formTitle}>
          <form className={styles.formModal} onSubmit={submitInvoiceDraft}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{formTitle}</h2>
                <p>{selectedAsset?.title ?? 'Selected asset'} · {draft.source === 'automatic' ? 'Automatic' : 'Manual'}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />

            {extractionWarnings.length ? (
              <div className={styles.warningBox}>
                {extractionWarnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}

            <div className={styles.formGrid}>
              <label>
                <span>Supplier name</span>
                <input value={draft.supplierName} onChange={(event) => setDraftField('supplierName', event.target.value)} />
              </label>
              <label>
                <span>Invoice number</span>
                <input value={draft.invoiceNumber} onChange={(event) => setDraftField('invoiceNumber', event.target.value)} />
              </label>
              <label>
                <span>Invoice date</span>
                <input type="date" value={draft.invoiceDate} onChange={(event) => setDraftField('invoiceDate', event.target.value)} />
              </label>
              <label>
                <span>Usage metric</span>
                <select value={draft.usageMetric} onChange={(event) => setDraftField('usageMetric', event.target.value as UsageMetric)}>
                  <option value="none">None</option>
                  <option value="hours">Hours</option>
                  <option value="km">KM</option>
                </select>
              </label>
              <label>
                <span>Usage reading</span>
                <input inputMode="decimal" value={draft.usageReading} disabled={draft.usageMetric === 'none'} onChange={(event) => setDraftField('usageReading', event.target.value)} />
              </label>
              <label>
                <span>Subtotal Excl. VAT</span>
                <input inputMode="decimal" value={draft.subtotalExVat} onChange={(event) => setDraftField('subtotalExVat', event.target.value)} />
              </label>
              <label>
                <span>VAT amount</span>
                <input inputMode="decimal" value={draft.vatAmount} onChange={(event) => setDraftField('vatAmount', event.target.value)} />
              </label>
              <label>
                <span>Total Incl. VAT</span>
                <input inputMode="decimal" value={draft.totalIncVat} onChange={(event) => setDraftField('totalIncVat', event.target.value)} />
              </label>
            </div>

            <button type="button" className={styles.secondaryButton} onClick={() => setDraft((current) => recalculatedDraft(current))}>Calculate missing VAT/total</button>

            <div className={styles.textAreaGrid}>
              <label>
                <span>Maintenance work done</span>
                <textarea value={draft.maintenanceWorkDone} onChange={(event) => setDraftField('maintenanceWorkDone', event.target.value)} rows={4} />
              </label>
              <label>
                <span>Parts supplied</span>
                <textarea value={draft.partsSupplied} onChange={(event) => setDraftField('partsSupplied', event.target.value)} rows={4} />
              </label>
              <label>
                <span>Repair work done</span>
                <textarea value={draft.repairWorkDone} onChange={(event) => setDraftField('repairWorkDone', event.target.value)} rows={4} />
              </label>
              <label>
                <span>Notes</span>
                <textarea value={draft.notes} onChange={(event) => setDraftField('notes', event.target.value)} rows={4} />
              </label>
            </div>

            {draft.source === 'manual' ? (
              <section className={styles.uploadInline}>
                <span>Optional document/photo upload</span>
                <label className={styles.uploadButtonSmall}>
                  <UploadIcon />
                  Add file
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleManualFileChange} />
                </label>
                <strong>{manualUploadFile ? manualUploadFile.name : uploadedDocument?.fileName || 'No file selected'}</strong>
              </section>
            ) : null}

            {uploadedDocument?.uploadUrl ? (
              <a className={styles.fileLink} href={uploadedDocument.uploadUrl} target="_blank" rel="noreferrer">Open attached invoice: {uploadedDocument.fileName}</a>
            ) : null}

            {rawTextPreview ? (
              <details className={styles.rawPreview}>
                <summary>Raw extraction preview</summary>
                <pre>{rawTextPreview}</pre>
              </details>
            ) : null}

            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => {
                if (flow === 'manual-form') setFlow('asset-manual');
                else if (flow === 'review') setFlow('upload');
                else closeModal();
              }}>Back</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save invoice'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
