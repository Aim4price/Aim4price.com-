'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import HomeHeroVideo from '../home-hero-video';
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
type WizardStep = 1 | 2 | 3;
type Notice = { tone: 'error' | 'info'; message: string } | null;

type InvoiceDropReceipt = {
  reference: string;
  message: string;
};

const WIZARD_STEPS: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: 'Identify asset' },
  { step: 2, label: 'Add invoice' },
  { step: 3, label: 'Your details' },
];

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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function validateSelectedFiles(files: File[]): string | null {
  if (!files.length) return 'Choose an invoice before continuing.';
  if (files.length > MAX_FILES) return 'Upload one invoice file at a time. Use one multi-page PDF when needed.';

  for (const file of files) {
    if (!ALLOWED_FILE_TYPES.has(file.type.toLowerCase())) {
      return 'Only PDF, JPG, PNG and WEBP files are accepted.';
    }
    if (!file.size) return 'The selected file is empty.';
    if (file.size > MAX_FILE_BYTES) return 'The invoice must be 12 MB or smaller.';
  }

  return null;
}

export default function InvoiceDropClient() {
  const heroButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const identifierInputRef = useRef<HTMLInputElement | null>(null);
  const chooseFileButtonRef = useRef<HTMLButtonElement | null>(null);
  const senderNameInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [lookupMode, setLookupMode] = useState<LookupMode>('code');
  const [identifier, setIdentifier] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<InvoiceDropReceipt | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now().toString());

  const identifierMinimumLength = lookupMode === 'code' ? 6 : 3;
  const stepOneComplete = identifier.trim().length >= identifierMinimumLength;
  const stepTwoComplete = files.length === 1;

  const fileSummary = useMemo(() => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    return files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatFileSize(totalBytes)}` : '';
  }, [files]);

  useEffect(() => {
    if (!isModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || isSubmitting) return;
      setIsModalOpen(false);
      window.requestAnimationFrame(() => heroButtonRef.current?.focus());
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isSubmitting]);

  useEffect(() => {
    if (!isModalOpen || receipt) return;

    const frame = window.requestAnimationFrame(() => {
      if (currentStep === 1) identifierInputRef.current?.focus();
      if (currentStep === 2) chooseFileButtonRef.current?.focus();
      if (currentStep === 3) senderNameInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentStep, isModalOpen, receipt]);

  function openModal() {
    setNotice(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setNotice(null);
    window.requestAnimationFrame(() => heroButtonRef.current?.focus());
  }

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

  function selectLookupMode(mode: LookupMode) {
    setLookupMode(mode);
    setIdentifier('');
    setNotice(null);
  }

  function goToNextStep() {
    setNotice(null);

    if (currentStep === 1) {
      if (!stepOneComplete) {
        identifierInputRef.current?.reportValidity();
        return;
      }
      setCurrentStep(2);
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentStep === 2) {
      const fileError = validateSelectedFiles(files);
      if (fileError) {
        setNotice({ tone: 'error', message: fileError });
        return;
      }
      setCurrentStep(3);
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goToPreviousStep() {
    setNotice(null);
    setCurrentStep((step) => (step === 3 ? 2 : 1));
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function returnToCompletedStep(step: WizardStep) {
    if (step >= currentStep) return;
    setNotice(null);
    setCurrentStep(step);
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetSubmission() {
    formRef.current?.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLookupMode('code');
    setIdentifier('');
    setFiles([]);
    setNotice(null);
    setReceipt(null);
    setCurrentStep(1);
    setStartedAt(Date.now().toString());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const fileError = validateSelectedFiles(files);
    if (fileError) {
      setCurrentStep(2);
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
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The invoice could not be sent. Please try again.',
      });
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className={styles.heroSection}>
        <HomeHeroVideo />
        <div className={styles.heroOverlay} />

        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>
                <span>AIM4PRICE INVOICES</span>
                <span className={styles.heroEyebrowDivider} aria-hidden="true">|</span>
                <span>No account needed</span>
              </p>

              <h1 className={styles.heroTitle}>
                <span>Send the invoice.</span>
                <span>We&apos;ll take it from here.</span>
              </h1>

              <p className={styles.heroText}>
                Identify the asset, attach one invoice and send it securely. Aim4price will verify it and route it to the correct record.
              </p>

              <div className={styles.heroActions}>
                <button ref={heroButtonRef} type="button" className={styles.heroPrimaryButton} onClick={openModal}>
                  <span className={styles.heroButtonIcon}><PlusIcon /></span>
                  Add invoice
                  <span className={styles.heroButtonArrow}><ArrowIcon /></span>
                </button>
              </div>

              <div className={styles.heroTrust}>
                <span className={styles.heroTrustIcon}><ShieldIcon /></span>
                <span><strong>Private and owner-controlled.</strong> Sending a document never grants access to an asset record.</span>
              </div>
            </div>

            <div className={styles.heroVisual} aria-hidden="true">
              <Image
                src="/brand/aim4price-mark-white.png"
                alt=""
                width={640}
                height={640}
                priority
                className={styles.heroLogo}
              />
            </div>
          </div>
        </div>
      </section>

      {isModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className={styles.modalDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-modal-title"
          >
            <header className={styles.modalHeader}>
              <div className={styles.modalHeaderCopy}>
                <p className={styles.modalEyebrow}>{receipt ? 'INVOICE RECEIVED' : 'AIM4PRICE INVOICES'}</p>
                <h2 id="invoice-modal-title">{receipt ? 'Safely sent.' : 'Add an invoice'}</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.modalCloseButton}
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close invoice modal"
              >
                <CloseIcon />
              </button>
            </header>

            {receipt ? (
              <div ref={modalBodyRef} className={styles.modalBody}>
                <article className={styles.receiptContent} role="status" aria-live="polite">
                  <span className={styles.receiptIcon}><CheckIcon /></span>
                  <p className={styles.receiptEyebrow}>INVOICE RECEIVED</p>
                  <h3>Thank you. It&apos;s safely with Aim4price.</h3>
                  <p className={styles.receiptText}>{receipt.message}</p>
                  <div className={styles.referenceBlock}>
                    <small>Your submission reference</small>
                    <strong>{receipt.reference}</strong>
                    <span>Keep this reference if you need to contact us.</span>
                  </div>
                  <div className={styles.receiptActions}>
                    <button type="button" className={styles.submitButton} onClick={resetSubmission}>Send another invoice</button>
                    <Link href="/auth#signup" className={styles.secondaryButton}>Create a free dealer profile</Link>
                  </div>
                </article>
              </div>
            ) : (
              <form ref={formRef} className={styles.modalForm} onSubmit={handleSubmit}>
                <nav className={styles.wizardProgress} aria-label="Invoice submission steps">
                  {WIZARD_STEPS.map(({ step, label }) => {
                    const isActive = currentStep === step;
                    const isComplete = currentStep > step;
                    return (
                      <button
                        key={step}
                        type="button"
                        className={`${styles.wizardStep} ${isActive ? styles.wizardStepActive : ''} ${isComplete ? styles.wizardStepComplete : ''}`}
                        onClick={() => returnToCompletedStep(step)}
                        disabled={!isComplete}
                        aria-current={isActive ? 'step' : undefined}
                      >
                        <span className={styles.wizardStepNumber}>{isComplete ? <CheckIcon /> : step}</span>
                        <span className={styles.wizardStepLabel}><small>Step {step}</small><strong>{label}</strong></span>
                      </button>
                    );
                  })}
                </nav>

                <div ref={modalBodyRef} className={styles.modalBody} aria-live="polite">
                  <section className={styles.wizardPanel} hidden={currentStep !== 1}>
                    <div className={styles.wizardHeading}>
                      <span className={styles.wizardHeadingNumber}>1</span>
                      <div className={styles.wizardHeadingText}>
                        <p>STEP 1 OF 3</p>
                        <h3>Identify the asset</h3>
                        <span>Use the Invoice Drop Code from the owner where possible.</span>
                      </div>
                    </div>

                    <div className={styles.lookupToggle} role="group" aria-label="Asset identification method">
                      <button type="button" className={lookupMode === 'code' ? styles.lookupActive : ''} onClick={() => selectLookupMode('code')} aria-pressed={lookupMode === 'code'}>Invoice Drop Code</button>
                      <button type="button" className={lookupMode === 'reference' ? styles.lookupActive : ''} onClick={() => selectLookupMode('reference')} aria-pressed={lookupMode === 'reference'}>Serial or VIN</button>
                    </div>

                    <label className={styles.fieldWide}>
                      <span>{lookupMode === 'code' ? 'Invoice Drop Code' : 'Serial number, VIN or asset reference'}</span>
                      <input
                        ref={identifierInputRef}
                        name={lookupMode === 'code' ? 'invoiceDropCode' : 'assetReference'}
                        value={identifier}
                        onChange={(event) => setIdentifier(event.currentTarget.value)}
                        autoComplete="off"
                        autoCapitalize={lookupMode === 'code' ? 'characters' : 'none'}
                        spellCheck={false}
                        placeholder={lookupMode === 'code' ? 'For example A4P-X7KD-29MQ-P6TW' : 'Enter the reference exactly as shown'}
                        minLength={identifierMinimumLength}
                        maxLength={lookupMode === 'code' ? 80 : 120}
                        required
                      />
                      <small>
                        {lookupMode === 'code'
                          ? 'This code only lets you send a document. It does not reveal the asset or its owner.'
                          : 'We will match it privately. No asset information is shown here.'}
                      </small>
                    </label>
                  </section>

                  <section className={styles.wizardPanel} hidden={currentStep !== 2}>
                    <div className={styles.wizardHeading}>
                      <span className={styles.wizardHeadingNumber}>2</span>
                      <div className={styles.wizardHeadingText}>
                        <p>STEP 2 OF 3</p>
                        <h3>Attach the invoice</h3>
                        <span>Upload one PDF or clear image. Use a multi-page PDF where needed.</span>
                      </div>
                    </div>

                    <div
                      className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
                      }}
                      onDrop={handleDrop}
                    >
                      <input ref={fileInputRef} id="invoice-files" name="files" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileChange} />
                      <span className={styles.uploadIcon}><UploadIcon /></span>
                      <div>
                        <strong>Drop the invoice here</strong>
                        <span>or choose it from your device</span>
                      </div>
                      <button ref={chooseFileButtonRef} type="button" className={styles.chooseFileButton} onClick={() => fileInputRef.current?.click()}>Choose invoice</button>
                      <small>PDF, JPG, PNG or WEBP · one file · up to 12 MB</small>
                    </div>

                    {files.length > 0 ? (
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
                    ) : null}
                  </section>

                  <section className={styles.wizardPanel} hidden={currentStep !== 3}>
                    <div className={styles.wizardHeading}>
                      <span className={styles.wizardHeadingNumber}>3</span>
                      <div className={styles.wizardHeadingText}>
                        <p>STEP 3 OF 3</p>
                        <h3>Tell us who sent it</h3>
                        <span>We only use these details to verify and follow up on this submission.</span>
                      </div>
                    </div>

                    <div className={styles.fieldGrid}>
                      <label>
                        <span>Your name</span>
                        <input ref={senderNameInputRef} name="senderName" autoComplete="name" maxLength={120} placeholder="Full name" required />
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

                    <label className={styles.consentRow}>
                      <input name="privacyAccepted" type="checkbox" value="yes" required />
                      <span>
                        I confirm that I may send this invoice to Aim4price for verification and delivery to the relevant asset owner. See our <Link href="/privacy-policy">Privacy Policy</Link>.
                      </span>
                    </label>
                  </section>

                  <div className={styles.honeypot} aria-hidden="true">
                    <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
                  </div>
                  <input type="hidden" name="startedAt" value={startedAt} />

                  {notice ? (
                    <p className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`} role="alert">{notice.message}</p>
                  ) : null}
                </div>

                <footer className={styles.modalFooter}>
                  <div className={styles.modalSecurity}>
                    <ShieldIcon />
                    <span><strong>Private upload</strong><small>Verified by Aim4price before delivery.</small></span>
                  </div>
                  <div className={styles.modalActions}>
                    {currentStep > 1 ? <button type="button" className={styles.backButton} onClick={goToPreviousStep}>Back</button> : null}
                    {currentStep < 3 ? (
                      <button
                        type="button"
                        className={styles.nextButton}
                        onClick={goToNextStep}
                        disabled={currentStep === 1 ? !stepOneComplete : !stepTwoComplete}
                      >
                        Next
                        <ArrowIcon />
                      </button>
                    ) : (
                      <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
                        {isSubmitting ? 'Sending invoice…' : 'Send invoice to Aim4price'}
                      </button>
                    )}
                  </div>
                </footer>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
