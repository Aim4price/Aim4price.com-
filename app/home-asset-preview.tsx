'use client';

import Image from 'next/image';
import AssetReportTypeIcon from '../components/asset-register/AssetReportTypeIcon';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './page.module.css';

export type QuestionKey = 'have' | 'worth' | 'cost' | 'manage' | 'attention';

type PreviewKey = QuestionKey | 'register';

type HomeAssetPreviewProps = {
  showRegister?: boolean;
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
  cost: 'Showing the reports available for this asset.',
  manage: 'Showing the asset management tools.',
  attention: 'Showing an open problem and completed maintenance.',
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
    key: 'manage',
    label: 'Take control of every asset',
    icon: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    key: 'cost',
    label: 'Know what it costs',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M14.8 8.5c-.8-.7-1.7-1-2.8-1-1.7 0-2.8.8-2.8 2 0 3.1 5.8 1.4 5.8 4.7 0 1.4-1.2 2.3-3 2.3-1.2 0-2.4-.4-3.2-1.2M12 5.8v12.4" />
      </>
    ),
  },
  {
    key: 'attention',
    label: 'Keep maintenance on track',
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
  onQuestionChange,
  onInteraction,
}: HomeAssetPreviewProps) {
  const [feedback, setFeedback] = useState('');
  const questionRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
              title={question.label}
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
        aria-label={showRegister ? 'Asset Register preview' : undefined}
        aria-labelledby={showRegister ? undefined : `home-asset-question-${QUESTIONS[activeIndex]?.key ?? 'have'}`}
        tabIndex={0}
        className={styles.assetPreviewCard}
        data-active-question={activeQuestion}
        onPointerEnter={() => onInteraction?.('pointer')}
        onFocusCapture={() => onInteraction?.('focus')}
      >
        <div key={activeQuestion} className={styles.assetPreviewState}>
          <PreviewContent activeQuestion={showRegister ? 'register' : activeQuestion} />
        </div>
      </article>

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
    <span data-tone="manage"><svg viewBox="0 0 24 24" aria-hidden="true">{QUESTIONS.find(({ key }) => key === 'manage')?.icon}</svg>Manage</span>
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
            <h2>DEMO BUSINESS PTY LTD</h2>
            <span className={styles.registerTransfer} aria-hidden="true"><RegisterIcon name="transfer"/></span>
          </header>
          <div className={styles.registerPreviewToolbar} aria-hidden="true">
            <span data-tone="share"><RegisterIcon name="share"/>Share</span><span data-tone="details"><RegisterIcon name="summary"/>Summary</span><span data-tone="manage"><RegisterIcon name="filter"/>Filters</span><span data-tone="primary"><RegisterIcon name="download"/>Download</span>
          </div>
          <div className={styles.registerPreviewStats}>
            <span className={styles.registerPrevious} aria-hidden="true">‹</span>
            <div><small>Register value</small><strong>R 359 550<small>+ VAT</small></strong><div className={styles.registerStatFooter}><div className={styles.registerVat}><b>Excl. VAT</b><span>Incl. VAT</span></div></div></div>
            <div><small>Aim4price valued equipment</small><strong>2</strong><div className={styles.registerStatFooter}/></div>
            <div><small>Total assets</small><strong>2</strong><div className={styles.registerStatFooter}>1 umbrella always shown　No standalone assets</div></div>
            <span className={styles.registerNext} aria-hidden="true">›</span>
          </div>
          <div className={styles.registerPreviewTabs} aria-hidden="true">
            <div><i><RegisterIcon name="overview"/></i><span><strong>Overview</strong><small>No open updates</small></span><b>›</b></div>
            <div data-selected="true"><i><RegisterIcon name="assets"/></i><span><strong>Assets</strong><small>2 assets</small></span><b>✓</b></div>
          </div>
          <div className={styles.registerPreviewSearch} aria-hidden="true">
            <span><RegisterIcon name="search"/>Toyota Hilux<i><RegisterIcon name="close"/></i></span>
            <span><RegisterIcon name="refresh"/>Refresh</span><span><RegisterIcon name="umbrella"/>Create Umbrella</span><span data-tone="primary"><RegisterIcon name="plus"/>Add Asset</span>
          </div>
          <section className={styles.registerPreviewGroup}>
            <header>
              <div className={styles.registerGroupIdentity}><i><RegisterIcon name="umbrella"/></i><div><strong>Vehicles</strong><small>2 grouped assets · Every asset counted</small></div></div>
              <div className={styles.registerGroupAside}><strong>Combined value R 359 550</strong><small>Excl. VAT</small><RegisterActions expanded/></div>
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
              <svg viewBox="0 0 24 24" aria-hidden="true">{QUESTIONS.find(({ key }) => key === 'manage')?.icon}</svg>
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
          <span className={styles.assetPhotoCount} aria-hidden="true">1 / 3</span>
          <div className={styles.assetThumbnails} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className={styles.assetDetailsPanel}>
          <div className={styles.assetIdentityColumn}>
            <AssetDetail label="Serial" value="SKB 5" />
            <AssetDetail label="Year" value="2023" />
            <AssetDetail label="Usage" value="113 677 km" />
            <AssetDetail label="Condition" value="Good" />
          </div>
          <div className={styles.assetStatusColumn}>
            <AssetDetail label="Financed" value="✓" status />
            <AssetDetail label="Insured" value="✓" status />
            <AssetDetail label="Licensed" value="✓" status />
            <AssetDetail label="Mapped" value="✓" status />
          </div>

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
  const reportFrameRef = useRef<HTMLDivElement | null>(null);
  const [reportScale, setReportScale] = useState(0);
  useLayoutEffect(() => {
    const frame = reportFrameRef.current;
    if (!frame) return;
    const fit = () => setReportScale(Math.min(frame.clientWidth / 786, frame.clientHeight / 777));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const assetDetails = [
    ['Category', 'Bakkies / LDVs'], ['Brand', 'Toyota'], ['Model', 'Hilux Single Cab'],
    ['Year', '2023'], ['Usage', '113 677 km'], ['Condition', 'Good'],
    ['Replacement Price', 'R 450 000 excl. VAT'], ['Serial Number', 'SKB 5'],
    ['Insured Value', 'Not set'], ['Licensed', 'Yes'], ['Registration', 'Demo vehicle'],
  ];
  const ownerDetails = [
    ['Business Name', 'Aim4price demo owner'], ['Contact Details', 'Demo account'],
    ['Business Email', 'owner@example.com'], ['Location / Address', 'George, Western Cape'],
  ];
  return (
    <div className={styles.worthPreview}>
      <section className={styles.worthResult}>
        <div className={styles.worthHeading}>
          <span className={styles.previewEyebrow}>Indicative asset value</span>
          <h2 className={styles.worthAssetTitle}>2023 Toyota Hilux Single Cab</h2>
        </div>

        <div className={styles.worthValueBlock}>
          <div className={styles.worthValueRow}>
            <strong>R 237 150</strong>
            <small>Excl. VAT</small>
          </div>
          <span className={styles.previewSrOnly}>Estimate shown with VAT excluded.</span>
          <div className={styles.worthVatToggle} aria-hidden="true">
            <span>VAT excluded</span>
            <span>VAT included</span>
          </div>
        </div>

        <div className={styles.worthFacts}>
          <MiniFact label="Year model" value="2023" />
          <MiniFact label="Usage" value="113 677 km" />
          <MiniFact label="Condition" value="Good" />
          <MiniFact label="Replacement" value="R 450 000" />
        </div>
        <p className={styles.worthBasis}>Replacement price and estimate exclude VAT.</p>
      </section>

      <aside className={styles.worthReportPreview} aria-label="Asset Valuation Report preview">
        <div ref={reportFrameRef} className={styles.worthReportFrame}>
          <div style={{ width: 786 * reportScale, height: 777 * reportScale }}>
            <div
              className={styles.worthReportPaper}
              style={{ transform: `scale(${reportScale})` }}
              role="img"
              aria-label="Miniature Asset Valuation Report for the 2023 Toyota Hilux Single Cab"
            >
              <header className={styles.worthReportHeader}>
                <Image src="/brand/aim4price-mark-black.png" alt="" width={660} height={515}
                  sizes="40px" className={styles.worthReportLogo} aria-hidden="true" />
                <span><strong>Asset Valuation Report</strong><small>Aim4price asset register</small></span>
                <dl className={styles.worthReportMetadata}>
                  <div><dt>Generated</dt><dd>19 Sept 2026</dd></div>
                  <div><dt>Email</dt><dd>owner@example.com</dd></div>
                </dl>
              </header>
              <div className={styles.worthReportSummary}>
                <div className={styles.worthReportIdentity}>
                  <small>Bakkies / LDVs</small>
                  <strong>2023 Toyota Hilux Single Cab</strong>
                  <p>Year Model: 2023 · Usage: 113 677 km · Condition: Good</p>
                </div>
                <div className={styles.worthReportValuation}>
                  <small>Estimated value</small>
                  <b>R 237 150</b>
                  <span>VAT excluded</span>
                  <div><span>Updated</span><strong>01 Sept 2026</strong></div>
                </div>
              </div>
              <div className={styles.worthReportBody}>
                <div className={styles.worthReportFacts}>
                  <section className={styles.worthReportDetails}>
                    <h3>Asset Details</h3>
                    <dl>{assetDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                  </section>
                  <section className={styles.worthReportDetails}>
                    <h3>Client / Asset Owner</h3>
                    <dl>{ownerDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                  </section>
                </div>
                <div className={styles.worthReportFacts}>
                  <section className={`${styles.worthReportDetails} ${styles.worthReportRecord}`}>
                    <h3>Record Summary</h3>
                    <dl>
                      <div><dt>Insured</dt><dd>Yes</dd></div>
                      <div><dt>Financed</dt><dd>Yes</dd></div>
                      <div><dt>Documents</dt><dd>None</dd></div>
                      <div><dt>Updated</dt><dd>01 Sept 2026</dd></div>
                    </dl>
                  </section>
                  <section className={styles.worthReportPhotos}>
                    <h3>Asset Photos</h3>
                    <div>
                      <Image src="/brand/home-asset-hilux-thumb-side.webp" alt="Side view of the Toyota Hilux in the valuation report" width={108} height={72} sizes="120px" />
                      <Image src="/brand/home-asset-hilux-thumb-rear.webp" alt="Rear view of the Toyota Hilux in the valuation report" width={108} height={72} sizes="120px" />
                    </div>
                    <small>1 additional photo saved in the asset register.</small>
                  </section>
                </div>
              </div>
              <footer className={styles.worthReportFooter}>
                <strong>Powered by Aim4price.com</strong>
                <p>Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price. Final value remains subject to physical inspection, documentation, attachments, condition and live market demand.</p>
              </footer>
            </div>
          </div>
        </div>
        <span className={styles.worthReportCaption}><RegisterIcon name="download" />Valuation report · PDF</span>
      </aside>

      <div className={styles.worthActions} aria-label="Estimate actions">
        <span>Create Ad <b>↗</b></span>
        <span>Save to Asset Register</span>
        <span>Download PDF <b>↓</b></span>
      </div>
    </div>
  );
}

// Use the exact SVG geometry and stroke styles from the Asset Register Manage modal.
function ManageActionGlyph({ type }: { type: ManageGlyph | 'budget' | 'pricing' }) {
  const glyphs: Record<ManageGlyph | 'pricing', ReactNode> = {
    edit: (<svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5z" />
    </svg>),
    reports: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 20h16" />
    </svg>),
    cost: (<svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.2 4.2c.55 1.35 1.7 2.1 3.8 2.1s3.25-.75 3.8-2.1" />
      <path d="M9.15 3.2h5.7l1.55 2.25-1.85 1.85h-5.1L7.6 5.45z" />
      <path d="M7.35 8.05c-2.65 2.2-4.1 5.15-4.1 8.25 0 3.15 2.5 4.5 8.75 4.5s8.75-1.35 8.75-4.5c0-3.1-1.45-6.05-4.1-8.25" />
      <path d="M12 10.1v7.1" />
      <path d="M14.4 11.65h-3.2c-.9 0-1.55.52-1.55 1.25s.58 1.12 1.55 1.32l1.6.34c.97.2 1.55.6 1.55 1.32s-.65 1.25-1.55 1.25H9.45" />
    </svg>),
    fuel: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>),
    maintenance: (<svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>),
    pricing: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>),
    map: (<svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>),
    qr: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M15 15h3v3" />
      <path d="M21 15v6h-3" />
      <path d="M15 21v-3" />
      <path d="M12 7h1" />
      <path d="M12 12h1" />
      <path d="M7 12h1" />
      <path d="M12 17h1" />
    </svg>),
    marketplace: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.95-1.56L20 8H6.2" />
      <path d="M8 8h12" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>),
    remove: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>),
  };
  return glyphs[type === 'budget' ? 'cost' : type];
}

function ManagePreview() {
  // Preserve the real modal's wide composition instead of wrapping its tile copy.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => setScale(Math.min(frame.clientWidth / 1344, frame.clientHeight / 608));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const actions: readonly { type: ManageGlyph | 'budget' | 'pricing'; title: string; description: string }[] = [
    { type: 'edit', title: 'Update asset', description: 'Edit details, documents and photos.' },
    { type: 'reports', title: 'Reports', description: 'Choose and download asset reports.' },
    { type: 'cost', title: 'Add cost', description: 'Record an expense for this asset.' },
    { type: 'budget', title: 'Add budget', description: 'Set a spending limit for this asset.' },
    { type: 'fuel', title: 'Add fuel', description: 'Capture a fuel record for this asset.' },
    { type: 'maintenance', title: 'Maintenance', description: 'Add or review maintenance records.' },
    { type: 'pricing', title: 'Manage pricing', description: 'Refresh values or calculate future value.' },
    { type: 'map', title: 'Asset map', description: 'View this asset selected on the map.' },
    { type: 'qr', title: 'QR code', description: 'Copy, download or print the QR label.' },
    { type: 'marketplace', title: 'Marketplace', description: 'Create a listing for this asset.' },
    { type: 'remove', title: 'Dispose or remove asset', description: 'Archive, sell, write off or remove.' },
  ];

  return (
    <div ref={frameRef} className={styles.managePreviewFrame}>
      <div style={{ width: 1344 * scale, height: 608 * scale }}>
        <div className={styles.managePreview} style={{ transform: `scale(${scale})` }}>
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
                <span className={styles.manageTileIcon}><ManageActionGlyph type={action.type} /></span>
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Homepage examples use the product's report choices and asset update cards.
// Keep the records fictional and independent of signed-in customer data.
function CostPreview() {
  const reports = [
    { kind: 'valuation', title: 'Asset valuation', description: 'Values, notes and documents.' },
    { kind: 'maintenance', title: 'Maintenance report', description: 'Service and repair costs.' },
    { kind: 'fuel', title: 'Fuel report', description: 'Monthly fuel costs.' },
    { kind: 'depreciation', title: 'Depreciation log', description: 'Saved value changes.' },
    { kind: 'ownership', title: 'Cost of ownership', description: 'Ownership costs and budgets.' },
    { kind: 'map', title: 'Asset map', description: 'Saved asset location.' },
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
        {reports.map((report) => (
          <div key={report.kind} className={styles.reportRow}>
            <span className={styles.reportIcon}><AssetReportTypeIcon kind={report.kind} /></span>
            <span><strong>{report.title}</strong><small>{report.description}</small></span>
          </div>
        ))}
      </div>
      <div className={styles.reportFooter} aria-hidden="true"><span>Cancel</span></div>
    </div>
  );
}

function AttentionPreview() {
  return (
    <div className={styles.attentionPreview}>
      <header className={styles.attentionHeader}>
        <div className={styles.attentionIdentity}>
          <div className={styles.attentionBadges}><span>Maintenance serviced</span><span>Open issue</span></div>
          <h2>2023 Toyota Hilux Single Cab</h2>
          <p>Year Model: 2023 · Usage: 113 677 km · Condition: Good</p>
          <strong className={styles.attentionValueLabel}>Aim4price value</strong>
          <small className={styles.attentionUpdated}>Updated 01 Sept 2026</small>
        </div>
        <div className={styles.attentionAside}>
          <strong className={styles.attentionPrice}>R 237 150<small>Excl. VAT</small></strong>
          <RegisterActions />
        </div>
      </header>
      <div className={styles.attentionBody}>
        <section className={styles.issueCard}>
          <div className={styles.issueCardTitle}><strong>Open issue reported</strong></div>
          <ul><li>Licence disc has expired.</li><li>Driver’s seat needs attention.</li></ul>
          <small className={styles.attentionByline}>Reported by Demo operator · 29 Aug 2026</small>
          <span className={styles.issueNoted} aria-hidden="true">Noted</span>
        </section>
        <section className={styles.serviceCard}>
          <div className={styles.issueCardTitle}><strong>Maintenance has been done</strong></div>
          <p>Engine oil, oil filter and air filter changed. Vehicle greased and checked.</p>
          <p><b>Notes:</b> Licence renewal still needs attention.</p>
          <small className={styles.attentionByline}>Serviced by Demo workshop · 01 Sept 2026</small>
          <span className={styles.serviceNoted} aria-hidden="true">Noted</span>
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
