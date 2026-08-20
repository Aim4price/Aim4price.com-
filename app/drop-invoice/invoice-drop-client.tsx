'use client';

import Link from 'next/link';
import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 1;
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type LookupMode = 'code' | 'reference';
type Notice = { tone: 'error' | 'info'; message: string } | null;

type InvoiceDropReceipt = {
  reference: string;
  message: string;
};

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 2.75h7.2L19.25 7.8V21.25H7z" />
      <path d="M14 2.75V8h5.25M9.75 12.25h6.5M9.75 15.5h6.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.75v-9M8.5 10.25 12 6.75l3.5 3.5" />
      <path d="M5 14.75v4.5h14v-4.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5.25 12.5 4.15 4.15L18.75 7.4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.75 19 5.5v5.7c0 4.7-2.85 8.35-7 10.05-4.15-1.7-7-5.35-7-10.05V5.5z" />
      <path d="m8.75 12.1 2.1 2.1 4.4-4.45" />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function validateSelectedFiles(files: File[]): string | null {
  if (!files.length) return 'Attach the invoice before submitting.';
  if (files.length > MAX_FILES) return 'Upload one invoice file at a time. Use one multi-page PDF when needed.';

  for (const file of files) {
    if (!ALLOWED_FILE_TYPES.has(file.type.toLowerCase())) {
      return 'Only PDF, JPG, PNG and WEBP files are accepted.';
    }
    if (!file.size) return 'One of the selected files is empty.';
    if (file.size > MAX_FILE_BYTES) return 'Each file must be 12 MB or smaller.';
  }

  return null;
}

export default function InvoiceDropClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [lookupMode, setLookupMode] = useState<LookupMode>('code');
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<InvoiceDropReceipt | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now().toString());

  const fileSummary = useMemo(() => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    return files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatFileSize(totalBytes)}` : '';
  }, [files]);

  function acceptFiles(nextFiles: File[]) {
    const error = validateSelectedFiles(nextFiles);
    if (error) {
      setFiles([]);
      setNotice({ tone: 'error', message: error });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFiles(nextFiles);
    setNotice(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFiles(Array.from(event.target.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function removeFile(index: number) {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
    setFiles(nextFiles);
    setNotice(null);
    if (!nextFiles.length && fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetSubmission() {
    formRef.current?.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLookupMode('code');
    setFiles([]);
    setNotice(null);
    setReceipt(null);
    setStartedAt(Date.now().toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const fileError = validateSelectedFiles(files);
    if (fileError) {
      setNotice({ tone: 'error', message: fileError });
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set('lookupMode', lookupMode);
    formData.set('startedAt', startedAt);
    formData.delete('files');
    files.forEach((file) => formData.append('files', file, file.name));

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/public/invoice-drop', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reference?: string;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.reference) {
        throw new Error(payload?.error || 'The invoice could not be sent. Please try again.');
      }

      setReceipt({
        reference: payload.reference,
        message: payload.message || 'Aim4price will verify and route the invoice within 24 hours.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The invoice could not be sent. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className={styles.introSection}>
        <div className={styles.shell}>
          <div className={styles.introGrid}>
            <div className={styles.introCopy}>
              <p className={styles.eyebrow}>AIM4PRICE INVOICE DROP</p>
              <h1>Send the invoice.<span>We&apos;ll take it from here.</span></h1>
              <p className={styles.introText}>
                No Aim4price account is needed. Attach one invoice, identify the asset and we&apos;ll verify and route it to the correct record.
              </p>
              <div className={styles.promiseRow}>
                <span className={styles.promiseIcon}><CheckIcon /></span>
                <span><strong>Verified by Aim4price</strong> before it reaches an asset&apos;s Cost Ledger.</span>
              </div>
            </div>

            <div className={styles.processCard} aria-label="What happens next">
              <p className={styles.processLabel}>What happens next</p>
              <ol>
                <li><span>1</span><div><strong>We receive it</strong><small>You get a private submission reference.</small></div></li>
                <li><span>2</span><div><strong>We verify it</strong><small>Aim4price checks the document and asset match.</small></div></li>
                <li><span>3</span><div><strong>We route it</strong><small>The asset owner reviews it where approval is needed.</small></div></li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.formShell}>
          {receipt ? (
            <article className={styles.receiptCard} role="status" aria-live="polite">
              <span className={styles.receiptIcon}><CheckIcon /></span>
              <p className={styles.receiptEyebrow}>INVOICE RECEIVED</p>
              <h2>Thank you. It&apos;s safely with Aim4price.</h2>
              <p className={styles.receiptText}>{receipt.message}</p>
              <div className={styles.referenceBlock}>
                <small>Your submission reference</small>
                <strong>{receipt.reference}</strong>
                <span>Keep this reference if you need to contact us.</span>
              </div>
              <div className={styles.receiptActions}>
                <button type="button" className={styles.primaryButton} onClick={resetSubmission}>Send another invoice</button>
                <Link href="/auth#signup" className={styles.secondaryButton}>Create a free dealer profile</Link>
              </div>
              <Link href="/" className={styles.homeLink}>Return to Aim4price</Link>
            </article>
          ) : (
            <form ref={formRef} className={styles.formCard} onSubmit={handleSubmit} noValidate={false}>
              <div className={styles.formHeading}>
                <div>
                  <p className={styles.formEyebrow}>SEND ONE INVOICE</p>
                  <h2>Invoice details</h2>
                </div>
                <span className={styles.secureLabel}><ShieldIcon /> Private upload</span>
              </div>

              <fieldset className={styles.formSectionBlock}>
                <legend><span>1</span><div><strong>Identify the asset</strong><small>Use the code provided by the asset owner where possible.</small></div></legend>
                <div className={styles.lookupToggle} role="group" aria-label="Asset identification method">
                  <button type="button" className={lookupMode === 'code' ? styles.lookupActive : ''} onClick={() => setLookupMode('code')} aria-pressed={lookupMode === 'code'}>Invoice Drop Code</button>
                  <button type="button" className={lookupMode === 'reference' ? styles.lookupActive : ''} onClick={() => setLookupMode('reference')} aria-pressed={lookupMode === 'reference'}>Serial or VIN</button>
                </div>

                {lookupMode === 'code' ? (
                  <label className={styles.fieldWide}>
                    <span>Invoice Drop Code</span>
                    <input name="invoiceDropCode" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="For example A4P-X7KD-29MQ-P6TW" minLength={6} maxLength={80} required />
                    <small>This code only lets you send a document. It does not reveal the asset or its owner.</small>
                  </label>
                ) : (
                  <label className={styles.fieldWide}>
                    <span>Serial number, VIN or asset reference</span>
                    <input name="assetReference" autoComplete="off" placeholder="Enter the reference exactly as shown" minLength={3} maxLength={120} required />
                    <small>We&apos;ll match it privately. No asset information is shown on this page.</small>
                  </label>
                )}
              </fieldset>

              <fieldset className={styles.formSectionBlock}>
                <legend><span>2</span><div><strong>Attach the invoice</strong><small>Upload one PDF or clear image. Use a multi-page PDF where needed.</small></div></legend>
                <div
                  className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }}
                  onDrop={handleDrop}
                >
                  <input ref={fileInputRef} id="invoice-files" name="files" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileChange} />
                  <span className={styles.uploadIcon}><UploadIcon /></span>
                  <div>
                    <strong>Drop the invoice here</strong>
                    <span>or choose it from your device</span>
                  </div>
                  <label htmlFor="invoice-files" className={styles.chooseFileButton}>Choose invoice</label>
                  <small>PDF, JPG, PNG or WEBP · one file · up to 12 MB</small>
                </div>

                {files.length > 0 && (
                  <div className={styles.fileList} aria-label={fileSummary}>
                    <div className={styles.fileListHeading}><strong>Ready to send</strong><span>{fileSummary}</span></div>
                    {files.map((file, index) => (
                      <div key={`${file.name}-${file.lastModified}-${index}`} className={styles.fileRow}>
                        <span className={styles.fileIcon}><DocumentIcon /></span>
                        <span className={styles.fileName}><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span>
                        <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>

              <fieldset className={styles.formSectionBlock}>
                <legend><span>3</span><div><strong>Tell us who sent it</strong><small>We use these details only to verify and follow up on this submission.</small></div></legend>
                <div className={styles.fieldGrid}>
                  <label>
                    <span>Your name</span>
                    <input name="senderName" autoComplete="name" maxLength={120} placeholder="Full name" required />
                  </label>
                  <label>
                    <span>Business name <em>Optional</em></span>
                    <input name="businessName" autoComplete="organization" maxLength={160} placeholder="Workshop or dealership" />
                  </label>
                  <label>
                    <span>You are a</span>
                    <select name="senderType" defaultValue="dealer" required>
                      <option value="dealer">Dealer</option>
                      <option value="workshop">Workshop</option>
                      <option value="supplier">Supplier</option>
                      <option value="owner">Asset owner</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    <span>Mobile number</span>
                    <input name="mobile" type="tel" autoComplete="tel" maxLength={40} placeholder="For example 082 123 4567" required />
                  </label>
                  <label>
                    <span>Email address</span>
                    <input name="email" type="email" autoComplete="email" maxLength={160} placeholder="name@business.co.za" required />
                  </label>
                  <label>
                    <span>Job card or PO <em>Optional</em></span>
                    <input name="jobReference" autoComplete="off" maxLength={100} placeholder="Your internal reference" />
                  </label>
                  <label className={styles.fieldWide}>
                    <span>Note <em>Optional</em></span>
                    <textarea name="note" rows={3} maxLength={600} placeholder="Add anything that will help us verify or match the invoice." />
                  </label>
                </div>
              </fieldset>

              <div className={styles.honeypot} aria-hidden="true">
                <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <input type="hidden" name="startedAt" value={startedAt} />

              <label className={styles.consentRow}>
                <input name="privacyAccepted" type="checkbox" value="yes" required />
                <span>
                  I confirm that I may send this invoice to Aim4price for verification and delivery to the relevant asset owner. See our <Link href="/privacy-policy">Privacy Policy</Link>.
                </span>
              </label>

              {notice && (
                <p className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`} role="alert">{notice.message}</p>
              )}

              <div className={styles.submitRow}>
                <div><ShieldIcon /><span><strong>Private and owner-controlled</strong><small>Sending a document never grants access to an asset record.</small></span></div>
                <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting ? 'Sending invoice…' : 'Send invoice to Aim4price'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
