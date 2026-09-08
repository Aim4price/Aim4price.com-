'use client';

import Image from 'next/image';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from '../components/WebsitePortal';
import styles from './page.module.css';

export type QuestionKey = 'have' | 'worth' | 'cost' | 'manage' | 'attention';

type PreviewKey = QuestionKey | 'register';

type HomeAssetPreviewProps = {
  showRegister?: boolean;
  onOpenRegister?: () => void;
  activeQuestion: QuestionKey;
  onQuestionChange: (question: QuestionKey, index: number) => void;
  onInteraction?: (source: 'pointer' | 'focus') => void;
};

type Question = {
  key: QuestionKey;
  label: string;
  icon: ReactNode;
};

type ManageGlyph =
  | 'edit'
  | 'reports'
  | 'cost'
  | 'fuel'
  | 'maintenance'
  | 'map'
  | 'qr'
  | 'marketplace'
  | 'remove';

const QUESTION_FEEDBACK: Readonly<Record<QuestionKey, string>> = {
  have: 'Showing the complete asset record.',
  worth: 'Showing the indicative value and valuation report.',
  cost: 'Showing fuel and ownership costs.',
  manage: 'Showing the asset management tools.',
  attention: 'Showing an open issue that needs attention.',
};

const QUESTIONS: readonly Question[] = [
  {
    key: 'have',
    label: 'Know what you have',
    icon: (
      <>
        <path d="M4.7 5.6h6.8l7.8 7.8-5.9 5.9-7.8-7.8z" />
        <circle cx="9.2" cy="9.1" r="1.25" />
      </>
    ),
  },
  {
    key: 'worth',
    label: 'Know what it’s worth',
    icon: (
      <>
        <path d="M4.5 18.5V14m5 4.5v-7m5 7V8m5 10.5V4.5" />
        <path d="m4.5 10.8 5-3 5 1.1 5-5" />
        <path d="M16.8 3.8h2.7v2.7" />
      </>
    ),
  },
  {
    key: 'cost',
    label: 'Know what it really costs',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M14.8 8.5c-.8-.7-1.7-1-2.8-1-1.7 0-2.8.8-2.8 2 0 3.1 5.8 1.4 5.8 4.7 0 1.4-1.2 2.3-3 2.3-1.2 0-2.4-.4-3.2-1.2M12 5.8v12.4" />
      </>
    ),
  },
  {
    key: 'manage',
    label: 'Manage its working life',
    icon: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    key: 'attention',
    label: 'See what needs attention',
    icon: (
      <>
        <path d="M12 3.3 2.9 19.1h18.2L12 3.3Z" />
        <path d="M12 8.4v5.2M12 16.8h.01" />
      </>
    ),
  },
];

export default function HomeAssetPreview({
  activeQuestion,
  showRegister = false,
  onOpenRegister,
  onQuestionChange,
  onInteraction,
}: HomeAssetPreviewProps) {
  const [feedback, setFeedback] = useState('');
  const [openedQuestion, setOpenedQuestion] = useState<PreviewKey | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const questionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const closePreview = useCallback(() => {
    setOpenedQuestion(null);
    openButtonRef.current?.focus({ preventScroll: true });
  }, []);

  const openPreview = () => {
    // Claim manual control so the story stays on the card being inspected.
    if (showRegister) onOpenRegister?.();
    else onQuestionChange(activeQuestion, QUESTIONS.findIndex(({ key }) => key === activeQuestion));
    setOpenedQuestion(showRegister ? 'register' : activeQuestion);
  };

  const selectQuestion = (index: number, moveFocus = false) => {
    const question = QUESTIONS[index];
    if (!question) return;

    onQuestionChange(question.key, index);
    setFeedback(QUESTION_FEEDBACK[question.key]);
    if (moveFocus) questionRefs.current[index]?.focus();
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % QUESTIONS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + QUESTIONS.length) % QUESTIONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = QUESTIONS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    selectQuestion(nextIndex, true);
  };

  const activeIndex = QUESTIONS.findIndex(({ key }) => key === activeQuestion);

  return (
    <div
      className={styles.assetHeroStage}
      data-active-question={activeQuestion}
    >
      {!showRegister && <div
        className={styles.assetQuestionGroup}
        role="tablist"
        aria-label="Explore the Aim4price asset record"
        onPointerEnter={() => onInteraction?.('pointer')}
        onFocusCapture={() => onInteraction?.('focus')}
      >
        {QUESTIONS.map((question, index) => {
          const isActive = question.key === activeQuestion;

          return (
            <button
              key={question.key}
              ref={(element) => {
                questionRefs.current[index] = element;
              }}
              id={`home-asset-question-${question.key}`}
              type="button"
              role="tab"
              className={[
                styles.assetQuestion,
                isActive ? styles.assetQuestionActive : '',
              ].filter(Boolean).join(' ')}
              aria-selected={isActive}
              aria-label={question.label}
              aria-controls="home-asset-preview"
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectQuestion(index)}
              onKeyDown={(event) => handleQuestionKeyDown(event, index)}
            >
              <span className={styles.assetQuestionBubble} aria-hidden="true">
                <svg viewBox="0 0 24 24">{question.icon}</svg>
              </span>
            </button>
          );
        })}
      </div>}

      <article
        id="home-asset-preview"
        role={showRegister ? 'region' : 'tabpanel'}
        aria-labelledby={showRegister ? 'home-register-preview-label' : `home-asset-question-${QUESTIONS[activeIndex]?.key ?? 'have'}`}
        tabIndex={0}
        className={styles.assetPreviewCard}
        data-active-question={activeQuestion}
        onPointerEnter={() => onInteraction?.('pointer')}
        onFocusCapture={() => onInteraction?.('focus')}
      >
        <div key={activeQuestion} className={styles.assetPreviewState}>
          <PreviewContent activeQuestion={showRegister ? 'register' : activeQuestion} />
        </div>
        <button
          ref={openButtonRef}
          type="button"
          className={styles.assetPreviewOpen}
          aria-label={`Open preview: ${showRegister ? 'Asset Register' : QUESTIONS[activeIndex]?.label ?? QUESTIONS[0].label}`}
          aria-haspopup="dialog"
          onClick={openPreview}
        >
          <span>Click to open ↗</span>
        </button>
      </article>

      {openedQuestion !== null && typeof document !== 'undefined'
        ? createPortal(
          <ExpandedPreview activeQuestion={openedQuestion} onClose={closePreview} />,
          document.body,
        )
        : null}

      <p id="home-register-preview-label" className={styles.assetActiveQuestion}>
        <span className={styles.assetActiveQuestionMain}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {showRegister ? QUESTIONS[0].icon : QUESTIONS[activeIndex]?.icon ?? QUESTIONS[0].icon}
          </svg>
          <span>{showRegister ? QUESTIONS[0].label : QUESTIONS[activeIndex]?.label ?? QUESTIONS[0].label}</span>
        </span>
        <span className={styles.assetStoryProgress} aria-hidden="true">
          {QUESTIONS.map((question, index) => (
            <span
              key={question.key}
              className={index === (showRegister ? 0 : activeIndex) ? styles.assetStoryProgressActive : undefined}
            />
          ))}
        </span>
      </p>

      <span
        className={styles.assetQuestionFeedback}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback}
      </span>
    </div>
  );
}

function ExpandedPreview({ activeQuestion, onClose }: {
  activeQuestion: PreviewKey;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const dismiss = () => {
    dialogRef.current?.close();
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Fit the complete composition, including the header, within the visible
    // viewport. Measuring rendered geometry also accounts for website zoom.
    const fitPreview = () => {
      dialog.style.zoom = '1';
      const rect = dialog.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      if (!rect.width || !rect.height) return;
      const scale = Math.min(1, Math.max(1, width - 32) / rect.width,
        Math.max(1, height - 32) / rect.height);
      dialog.style.zoom = String(scale);
    };

    fitPreview();
    window.addEventListener('resize', fitPreview);
    window.addEventListener('aim4price:canvas-geometry', fitPreview);
    window.visualViewport?.addEventListener('resize', fitPreview);
    return () => {
      window.removeEventListener('resize', fitPreview);
      window.removeEventListener('aim4price:canvas-geometry', fitPreview);
      window.visualViewport?.removeEventListener('resize', fitPreview);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);

  return (
    <dialog
      data-home-preview-dialog
      ref={dialogRef}
      className={styles.assetPreviewDialog}
      aria-labelledby="home-expanded-preview-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
      }}
    >
      <header className={styles.assetPreviewDialogHeader}>
        <h2 id="home-expanded-preview-title">
          {activeQuestion === 'register' ? 'Asset Register' : QUESTIONS.find(({ key }) => key === activeQuestion)?.label}
        </h2>
        <button type="button" onClick={dismiss} autoFocus aria-label="Close preview">
          Close <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className={styles.assetPreviewDialogBody}>
        <div className={styles.assetPreviewExpandedContent}>
          <PreviewContent activeQuestion={activeQuestion} />
        </div>
      </div>
    </dialog>
  );
}

function PreviewContent({ activeQuestion }: { activeQuestion: PreviewKey }) {
  switch (activeQuestion) {
    case 'register':
      return <RegisterPreview />;
    case 'worth':
      return <WorthPreview />;
    case 'manage':
      return <ManagePreview />;
    case 'cost':
      return <CostPreview />;
    case 'attention':
      return <AttentionPreview />;
    case 'have':
    default:
      return <AssetCardPreview />;
  }
}

function RegisterIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
    summary: <><path d="M4 5h16M4 12h16M4 19h16M8 3v18"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="1"/><circle cx="15" cy="12" r="1"/></>,
    download: <path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>,
    transfer: <path d="M5 7h14l-4-4M19 17H5l4 4M19 7l-4 4M5 17l4-4"/>,
    umbrella: <><path d="M3 12a9 9 0 0 1 18 0c-3-3-6 0-9 0s-6-3-9 0ZM12 3v15a3 3 0 0 0 6 0M8 11c0-5 1-8 4-8s4 3 4 8"/></>,
    overview: <><path d="M4 4h14M4 9h10M4 14h7"/><rect x="2" y="2" width="19" height="20" rx="4"/><circle cx="16" cy="16" r="2"/></>,
    assets: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>,
    details: <><circle cx="12" cy="12" r="9"/><path d="m8 10 4 4 4-4"/></>,
    flag: <path d="M6 21V3h12l-2 4 2 4H6"/>,
    plus: <path d="M12 4v16M4 12h16"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] ?? paths.assets}</svg>;
}

function RegisterActions({ expanded = false }: { expanded?: boolean }) {
  return <div className={styles.registerActions} aria-hidden="true">
    <span data-tone="share"><RegisterIcon name="share"/>Share</span>
    <span data-tone="details"><RegisterIcon name="details"/>{expanded ? 'Hide details' : 'View details'}</span>
    <span data-tone="manage"><svg viewBox="0 0 24 24" aria-hidden="true">{QUESTIONS[3].icon}</svg>Manage</span>
  </div>;
}

function RegisterPreview() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => setScale(Math.min(frame.clientWidth / 768, frame.clientHeight / 676));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const assets = [
    { name: '2023 Toyota Hilux Single Cab', year: '2023', usage: '113 677 km', value: 'R 237 150', updated: '01 Sept 2026' },
    { name: '2013 Toyota Hilux 2.5 4x4', year: '2013', usage: '328 242 km', value: 'R 122 400', updated: '26 Aug 2026' },
  ];
  return (
    <div ref={frameRef} className={styles.registerPreviewFrame}>
      <div style={{ width: 768 * scale, height: 676 * scale }}>
        <div className={styles.registerPreview} style={{ transform: `scale(${scale})`, left: 12 * scale }}>
          <header className={styles.registerPreviewTitle}>
            <h2>TEST BUSINESS PTY LTD</h2>
            <span className={styles.registerTransfer} aria-hidden="true"><RegisterIcon name="transfer"/><b>15</b></span>
          </header>
          <div className={styles.registerPreviewToolbar} aria-hidden="true">
            <span data-tone="share"><RegisterIcon name="share"/>Share</span><span data-tone="details"><RegisterIcon name="summary"/>Summary</span><span data-tone="manage"><RegisterIcon name="filter"/>Filters</span><span data-tone="primary"><RegisterIcon name="download"/>Download</span>
          </div>
          <div className={styles.registerPreviewStats}>
            <span className={styles.registerPrevious} aria-hidden="true">‹</span>
            <div><small>Register value</small><strong>R 11 450 567<small>+ VAT</small></strong><div className={styles.registerStatFooter}><div className={styles.registerVat}><b>Excl. VAT</b><span>Incl. VAT</span></div></div></div>
            <div><small>Aim4price valued equipment</small><strong>58</strong><div className={styles.registerStatFooter}/></div>
            <div><small>Total assets</small><strong>101</strong><div className={styles.registerStatFooter}>1 umbrella always shown　No standalone assets</div></div>
            <span className={styles.registerNext} aria-hidden="true">›</span>
          </div>
          <div className={styles.registerPreviewTabs} aria-hidden="true">
            <div><i><RegisterIcon name="overview"/></i><span><strong>Overview</strong><small>Checking updates...</small></span><b>›</b></div>
            <div data-selected="true"><i><RegisterIcon name="assets"/></i><span><strong>Assets</strong><small>Loading register...</small></span><b>✓</b></div>
          </div>
          <div className={styles.registerPreviewSearch} aria-hidden="true">
            <span><RegisterIcon name="search"/>Toyota Hilux<i><RegisterIcon name="close"/></i></span>
            <span><RegisterIcon name="refresh"/>Refresh</span><span><RegisterIcon name="umbrella"/>Create Umbrella</span><span data-tone="primary"><RegisterIcon name="plus"/>Add Asset</span>
          </div>
          <section className={styles.registerPreviewGroup}>
            <header>
              <div className={styles.registerGroupIdentity}><i><RegisterIcon name="umbrella"/></i><div><strong>Vehicles</strong><small>9 grouped assets · Every asset counted · Combined umbrella</small></div></div>
              <div className={styles.registerGroupAside}><strong>Counted value R 3 305 000</strong><small>Excl. VAT</small><RegisterActions expanded/></div>
            </header>
            <div className={styles.registerPreviewAssets}>
              {assets.map((asset, index) => (
                <article key={index} className={styles.registerPreviewRow}>
                  <div className={styles.registerRowFlags} aria-hidden="true"><span><RegisterIcon name="flag"/></span><span><RegisterIcon name="transfer"/></span><span><RegisterIcon name="umbrella"/></span></div>
                  <div className={styles.registerRowIdentity}><h3>{asset.name}</h3><p>Year Model: {asset.year} · Usage: {asset.usage} · Condition: Good</p><strong>Aim4price value</strong><small>Updated {asset.updated}</small></div>
                  <div className={styles.registerRowAside}><strong>{asset.value}</strong><small>Excl. VAT</small><RegisterActions/></div>
                  <span className={styles.registerRowChevron} aria-hidden="true">›</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AssetCardPreview() {
  return (
    <>
      <header className={styles.assetPreviewHeader}>
        <div className={styles.assetPreviewIdentity}>
          <h2>2023 Toyota Hilux Single Cab</h2>
          <p>Year Model: 2023 · Usage: 113 677 km · Condition: Good</p>
          <strong>Aim4price value</strong>
          <small>Updated 01 Sept 2026</small>
        </div>

        <div className={styles.assetPreviewAside}>
          <div className={styles.assetCurrentValue}>
            <strong>R 237 150</strong>
            <small>Excl. VAT</small>
          </div>
          <div className={styles.assetPreviewActions} aria-hidden="true">
            <span className={styles.assetShareAction}>
              <svg viewBox="0 0 24 24">
                <circle cx="18" cy="5" r="2.2" />
                <circle cx="6" cy="12" r="2.2" />
                <circle cx="18" cy="19" r="2.2" />
                <path d="m8 11 7.8-4.6M8 13l7.8 4.6" />
              </svg>
              Share
            </span>
            <span className={styles.assetDetailsAction}>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 13.7 3.5-3.5 3.5 3.5" />
              </svg>
              Hide details
            </span>
            <span className={styles.assetManageAction}>
              <MiniGlyph type="maintenance" />
              Manage
            </span>
          </div>
        </div>
      </header>

      <div className={styles.assetPreviewBody}>
        <div className={styles.assetPhotoPanel}>
          <Image
            src="/brand/home-asset-hilux-listing.webp"
            alt="Left-side view of the white Toyota Hilux single-cab work vehicle"
            width={1280}
            height={960}
            priority
            sizes="(min-width: 1181px) 17vw, (min-width: 761px) 32vw, 42vw"
          />
          <div className={styles.assetThumbnails} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className={styles.assetDetailsPanel}>
          <AssetDetail label="Year" value="2023" />
          <AssetDetail label="Usage" value="113 677 km" />
          <AssetDetail label="Condition" value="Good" />
          <AssetDetail label="Licensed" value="✓" status />
          <AssetDetail label="Mapped" value="✓" status />

          <div className={styles.assetReplacementRow}>
            <span>Replacement price</span>
            <strong>
              R 450 000
              <small>Excl. VAT</small>
            </strong>
          </div>
        </div>
      </div>
    </>
  );
}

function WorthPreview() {
  return (
    <div className={styles.worthPreview}>
      <section className={styles.worthResult}>
        <h2 className={styles.worthAssetTitle}>2023 Toyota Hilux Single Cab</h2>

        <div className={styles.worthValueRow}>
          <span>
            <strong>R 237 150</strong>
            <small>Excl. VAT</small>
          </span>
        </div>
        <span className={styles.previewSrOnly}>Estimate shown with VAT excluded.</span>

        <div className={styles.worthVatToggle} aria-hidden="true">
          <span>VAT excluded</span>
          <span>VAT included</span>
        </div>

        <div className={styles.worthFacts}>
          <MiniFact label="Year model" value="2023" />
          <MiniFact label="Usage" value="113 677 km" />
          <MiniFact label="Condition" value="Good" />
          <MiniFact label="Replacement" value="R 450 000 excl. VAT" />
        </div>
      </section>

      <aside className={styles.worthReportPreview} aria-label="Asset Valuation Report preview">
        <div
          className={styles.worthReportPaper}
          role="img"
          aria-label="Miniature Asset Valuation Report for the 2023 Toyota Hilux Single Cab"
        >
          <header className={styles.worthReportHeader}>
            <Image
              src="/brand/aim4price-mark-black.png"
              alt=""
              width={660}
              height={515}
              sizes="1.35rem"
              className={styles.worthReportLogo}
              aria-hidden="true"
            />
            <span>
              <strong>Asset Valuation Report</strong>
              <small>Aim4price asset register</small>
            </span>
            <span className={styles.worthReportGenerated}>
              <small>Generated</small>
              <strong>01 Sept 2026</strong>
            </span>
          </header>

          <div className={styles.worthReportSummary}>
            <span>
              <small>Bakkies / LDVs</small>
              <strong>2023 Toyota Hilux Single Cab</strong>
              <em>Year 2023 · Usage 113 677 km · Condition Good</em>
            </span>
            <span>
              <small>Estimated value</small>
              <strong>R 237 150</strong>
              <em>VAT excluded</em>
            </span>
          </div>

          <div className={styles.worthReportBody}>
            <section className={styles.worthReportDetails}>
              <strong>Asset Details</strong>
              <dl>
                <div><dt>Category</dt><dd>Bakkies / LDVs</dd></div>
                <div><dt>Brand</dt><dd>Toyota</dd></div>
                <div><dt>Model</dt><dd>Hilux</dd></div>
                <div><dt>Year</dt><dd>2023</dd></div>
                <div><dt>Usage</dt><dd>113 677 km</dd></div>
                <div><dt>Condition</dt><dd>Good</dd></div>
                <div><dt>Replacement</dt><dd>R 450 000 excl. VAT</dd></div>
              </dl>

              <div className={styles.worthReportOwner}>
                <strong>Client / Asset Owner</strong>
                <span>Aim4price demo owner</span>
              </div>
            </section>

            <section className={styles.worthReportSide}>
              <div className={styles.worthReportRecord}>
                <strong>Record Summary</strong>
                <span>Insured <b>Not sure</b></span>
                <span>Financed <b>Not sure</b></span>
                <span>Documents <b>None</b></span>
              </div>

              <div className={styles.worthReportPhotos}>
                <strong>Asset Photos</strong>
                <Image
                  src="/brand/home-asset-hilux-thumb-side.webp"
                  alt="Side view of the Toyota Hilux in the valuation report"
                  width={108}
                  height={58}
                  sizes="7rem"
                />
                <Image
                  src="/brand/home-asset-hilux-thumb-rear.webp"
                  alt="Rear view of the Toyota Hilux in the valuation report"
                  width={108}
                  height={58}
                  sizes="7rem"
                />
              </div>
            </section>
          </div>
        </div>
      </aside>

      <div className={styles.worthActions} aria-label="Estimate actions">
        <span>Create Ad <b>↗</b></span>
        <span>Save to Asset Register</span>
        <span>Download PDF <b>↓</b></span>
      </div>
    </div>
  );
}

function ManagePreview() {
  const actions: readonly { type: ManageGlyph; title: string; description: string }[] = [
    { type: 'edit', title: 'Update asset', description: 'Edit details, documents and photos.' },
    { type: 'reports', title: 'Reports', description: 'Choose and download asset reports.' },
    { type: 'cost', title: 'Add cost', description: 'Record an expense for this asset.' },
    { type: 'fuel', title: 'Add fuel', description: 'Capture a fuel record for this asset.' },
    { type: 'maintenance', title: 'Maintenance', description: 'Add or review maintenance records.' },
    { type: 'map', title: 'Asset map', description: 'View this asset selected on the map.' },
    { type: 'qr', title: 'QR code', description: 'Copy, download or print the QR label.' },
    { type: 'marketplace', title: 'Marketplace', description: 'Create a listing for this asset.' },
    { type: 'remove', title: 'Remove asset', description: 'Archive, sell, write off or remove.' },
  ];

  return (
    <div className={styles.managePreview}>
      <header className={`${styles.previewModalHeader} ${styles.managePreviewHeader}`}>
        <div>
          <h2>2023 Toyota Hilux Single Cab</h2>
          <p>Year Model: 2023 · Usage: 113 677 km · Condition: Good</p>
        </div>
        <span className={styles.previewClose} aria-hidden="true">×</span>
      </header>

      <div className={styles.manageGrid}>
        {actions.map((action, index) => (
          <div
            key={action.title}
            className={[
              styles.manageTile,
              index === 0 ? styles.manageTilePrimary : '',
              action.type === 'remove' ? styles.manageTileDanger : '',
            ].filter(Boolean).join(' ')}
          >
            <span className={styles.manageTileIcon}><MiniGlyph type={action.type} /></span>
            <span>
              <strong>{action.title}</strong>
              <small>{action.description}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostPreview() {
  const reports = [
    ['Open asset valuation', 'PDF value summary with notes and documents.'],
    ['Download maintenance report', 'PDF or Excel service and repair costs.'],
    ['Download fuel report', 'PDF or Excel fuel costs by month.'],
    ['Download depreciation log', 'PDF or Excel log of saved value changes.'],
    ['Download cost of ownership report', 'PDF or Excel ownership costs and VAT.'],
  ] as const;

  return (
    <div className={styles.costPreview}>
      <header className={`${styles.previewModalHeader} ${styles.costPreviewHeader}`}>
        <div>
          <h2>2023 Toyota Hilux Single Cab</h2>
          <p>Year Model: 2023 · Usage: 113 677 km · Condition: Good</p>
        </div>
        <span className={styles.previewClose} aria-hidden="true">×</span>
      </header>

      <div className={styles.reportList}>
        {reports.map(([title, description], index) => (
          <div key={title} className={styles.reportRow}>
            <span className={styles.reportIcon}>
              <MiniGlyph type={index === 2 ? 'fuel' : index === 4 ? 'cost' : 'reports'} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <b aria-hidden="true">›</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttentionPreview() {
  return (
    <div className={styles.attentionPreview}>
      <header className={styles.attentionHeader}>
        <div className={styles.attentionIdentity}>
          <div className={styles.attentionBadges}>
            <span>Maintenance serviced</span>
            <span>Open issue</span>
          </div>
          <h2>2023 Toyota Hilux Single Cab</h2>
          <p>Year Model: 2023 · Usage: 113 677 km · Condition: Good</p>
          <strong className={styles.attentionValueLabel}>Aim4price value</strong>
          <small className={styles.attentionUpdated}>Updated 01 Sept 2026</small>
        </div>

        <div className={styles.attentionAside}>
          <strong className={styles.attentionPrice}>
            R 237 150
            <small>Excl. VAT</small>
          </strong>

          <div className={`${styles.assetPreviewActions} ${styles.attentionActions}`} aria-hidden="true">
            <span className={styles.assetShareAction}>
              <svg viewBox="0 0 24 24">
                <circle cx="18" cy="5" r="2.2" />
                <circle cx="6" cy="12" r="2.2" />
                <circle cx="18" cy="19" r="2.2" />
                <path d="m8 11 7.8-4.6M8 13l7.8 4.6" />
              </svg>
              Share
            </span>
            <span className={styles.assetDetailsAction}>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 10.3 3.5 3.5 3.5-3.5" />
              </svg>
              View details
            </span>
            <span className={styles.assetManageAction}>
              <MiniGlyph type="maintenance" />
              Manage
            </span>
          </div>
        </div>
      </header>

      <div className={styles.attentionBody}>
        <section className={styles.issueCard}>
          <div className={styles.issueCardTitle}>
            <strong>Open issue reported</strong>
          </div>
          <ul>
            <li>Lisensie disk het verval 2025</li>
            <li>Sitplek kort aandag</li>
          </ul>
          <small className={styles.attentionByline}>By Gerald · 29 Aug 2026</small>
          <span className={styles.issueNoted}>Noted</span>
        </section>

        <section className={styles.serviceCard}>
          <div className={styles.issueCardTitle}>
            <strong>Maintenance has been done</strong>
          </div>
          <p>
            Serviced: Changed engine oil, Changed air filters, Changed oil filters,
            Changed diesel filters, Greased machine · By Skimmelkrans · Gerald
          </p>
          <p>Notes/Problems: Lisensie disk het verval 2025</p>
          <small className={styles.attentionByline}>By Gerald · 29 Aug 2026</small>
          <span className={styles.serviceNoted}>Noted</span>
        </section>
      </div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.miniFact}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AssetDetail({ label, value, status = false }: { label: string; value: string; status?: boolean }) {
  return (
    <div className={styles.assetDetailRow}>
      <span>{label}</span>
      <strong
        className={status ? styles.assetStatusValue : undefined}
        aria-label={status ? `${label}: yes` : undefined}
      >
        {value}
      </strong>
    </div>
  );
}

function MiniGlyph({ type }: { type: ManageGlyph }) {
  if (type === 'edit') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.7 4.2 4.2-.7L18.8 8.2l-3.5-3.5L4 16Z" /><path d="m13.8 6.2 3.5 3.5" /></svg>;
  }
  if (type === 'reports') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h10l4 4V20.5H5z" /><path d="M15 3.5v4h4M8 16v-3m4 3V9m4 7v-5" /></svg>;
  }
  if (type === 'cost') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M14.8 8.6c-.8-.7-1.7-1-2.8-1-1.7 0-2.8.8-2.8 2 0 3 5.8 1.3 5.8 4.6 0 1.4-1.2 2.3-3 2.3-1.2 0-2.4-.4-3.2-1.2M12 5.8v12.4" /></svg>;
  }
  if (type === 'fuel') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V5.5A2.5 2.5 0 0 1 7.5 3h6A2.5 2.5 0 0 1 16 5.5V20M4 20h13M7.5 7h6v4h-6z" /><path d="m16 8 3 3v6.2a1.8 1.8 0 0 0 3.6 0V9.5l-2-2" /></svg>;
  }
  if (type === 'maintenance') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 5.1a4.6 4.6 0 0 0-5.7 5.7l-5 5a2.2 2.2 0 0 0 3.1 3.1l5-5a4.6 4.6 0 0 0 5.7-5.7l-2.7 2.7-2.1-.5-.5-2.1z" /></svg>;
  }
  if (type === 'map') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5zM8.5 4v13.5M15.5 6.5V20" /></svg>;
  }
  if (type === 'qr') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4v-2h-2v2" /></svg>;
  }
  if (type === 'marketplace') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1.2-5H5.2L4 9Z" /><path d="M5.5 9v11h13V9M9 20v-6h6v6" /><path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></svg>;
}
