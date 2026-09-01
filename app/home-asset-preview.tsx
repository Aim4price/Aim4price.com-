'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import styles from './page.module.css';

type QuestionKey = 'have' | 'worth' | 'cost' | 'attention';

type Question = {
  key: QuestionKey;
  label: string;
  positionClass: string;
  connectorClass: string;
  connectorPath: string;
  connectorDots: readonly [
    { x: number; y: number },
    { x: number; y: number },
  ];
  icon: ReactNode;
};

type PreviewTone = 'neutral' | 'success' | 'warning' | 'value';

type PreviewRow = {
  label: string;
  value: string;
  tone?: PreviewTone;
};

type PreviewState = {
  heading: string;
  description: string;
  rows: readonly PreviewRow[];
  featureLabel: string;
  featureValue: string;
  feedback: string;
};

const QUESTION_ROTATION_MS = 5000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const QUESTIONS: readonly Question[] = [
  {
    key: 'have',
    label: 'What do I have?',
    positionClass: styles.assetQuestionHave,
    connectorClass: styles.assetConnectorHave,
    connectorPath: 'M 830 53 C 846 53 854 -16 874 -16',
    connectorDots: [
      { x: 830, y: 53 },
      { x: 874, y: -16 },
    ],
    icon: (
      <>
        <path d="M4.7 5.6h6.8l7.8 7.8-5.9 5.9-7.8-7.8z" />
        <circle cx="9.2" cy="9.1" r="1.25" />
      </>
    ),
  },
  {
    key: 'worth',
    label: 'What is it worth?',
    positionClass: styles.assetQuestionWorth,
    connectorClass: styles.assetConnectorWorth,
    connectorPath: 'M 830 118 C 846 118 858 118 874 118',
    connectorDots: [
      { x: 830, y: 118 },
      { x: 874, y: 118 },
    ],
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
    label: 'What is it costing me?',
    positionClass: styles.assetQuestionCost,
    connectorClass: styles.assetConnectorCost,
    connectorPath: 'M 830 253 C 846 253 858 253 874 253',
    connectorDots: [
      { x: 830, y: 253 },
      { x: 874, y: 253 },
    ],
    icon: (
      <>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M14.8 8.5c-.8-.7-1.7-1-2.8-1-1.7 0-2.8.8-2.8 2 0 3.1 5.8 1.4 5.8 4.7 0 1.4-1.2 2.3-3 2.3-1.2 0-2.4-.4-3.2-1.2M12 5.8v12.4" />
      </>
    ),
  },
  {
    key: 'attention',
    label: 'What needs attention?',
    positionClass: styles.assetQuestionAttention,
    connectorClass: styles.assetConnectorAttention,
    connectorPath: 'M 830 395 C 846 395 858 395 874 395',
    connectorDots: [
      { x: 830, y: 395 },
      { x: 874, y: 395 },
    ],
    icon: (
      <path d="M14.8 5.1a4.6 4.6 0 0 0-5.7 5.7l-5 5a2.2 2.2 0 0 0 3.1 3.1l5-5a4.6 4.6 0 0 0 5.7-5.7l-2.7 2.7-2.1-.5-.5-2.1z" />
    ),
  },
];

const PREVIEW_STATES: Readonly<Record<QuestionKey, PreviewState>> = {
  have: {
    heading: 'Asset overview',
    description: 'Identity, condition and status in one place.',
    rows: [
      { label: 'Year model', value: '2023' },
      { label: 'Usage', value: '113 677 km' },
      { label: 'Condition', value: 'Good', tone: 'success' },
      { label: 'Licensed', value: 'Confirmed', tone: 'success' },
      { label: 'Mapped', value: 'Confirmed', tone: 'success' },
    ],
    featureLabel: 'Living record',
    featureValue: 'Complete',
    feedback: 'Showing asset identity, condition and status.',
  },
  worth: {
    heading: 'Value over time',
    description: 'Know its value today and what replacement would cost.',
    rows: [
      { label: 'Aim4price value', value: 'R 237 150', tone: 'value' },
      { label: 'Replacement price', value: 'R 450 000', tone: 'value' },
      { label: 'Updated', value: '01 Sept 2026' },
      { label: 'Value basis', value: 'Aim4price estimate' },
      { label: 'VAT', value: 'Excluded' },
    ],
    featureLabel: 'Value history',
    featureValue: 'Tracked over time',
    feedback: 'Showing current value, replacement price and value tracking.',
  },
  cost: {
    heading: 'Cost of ownership',
    description: 'Every running cost recorded against this asset.',
    rows: [
      { label: 'Fuel', value: 'Recorded per fill-up' },
      { label: 'Maintenance', value: 'Service history' },
      { label: 'Repairs', value: 'Parts and labour' },
      { label: 'Other costs', value: 'Invoices and fees' },
      { label: 'Period', value: 'Lifetime record' },
    ],
    featureLabel: 'Cost Ledger',
    featureValue: 'One complete ledger',
    feedback: 'Showing fuel, maintenance, repairs and ownership costs.',
  },
  attention: {
    heading: 'Needs attention',
    description: 'Missing information and upcoming actions at a glance.',
    rows: [
      { label: 'Licence', value: 'Confirmed', tone: 'success' },
      { label: 'Location', value: 'Mapped', tone: 'success' },
      { label: 'Insurance', value: 'Confirm', tone: 'warning' },
      { label: 'Finance', value: 'Confirm', tone: 'warning' },
      { label: 'Service history', value: 'Update required', tone: 'warning' },
    ],
    featureLabel: 'Attention summary',
    featureValue: '3 items to review',
    feedback: 'Showing missing information and items requiring attention.',
  },
};

export default function HomeAssetPreview() {
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey>('have');
  const [isPaused, setIsPaused] = useState(false);
  const [autoAdvanceCount, setAutoAdvanceCount] = useState(0);
  const [hasUserSelected, setHasUserSelected] = useState(false);

  useEffect(() => {
    if (
      isPaused ||
      hasUserSelected ||
      autoAdvanceCount >= QUESTIONS.length - 1 ||
      window.matchMedia(REDUCED_MOTION_QUERY).matches
    ) {
      return undefined;
    }

    const rotation = window.setTimeout(() => {
      setActiveQuestion((current) => {
        const currentIndex = QUESTIONS.findIndex(({ key }) => key === current);
        return QUESTIONS[(currentIndex + 1) % QUESTIONS.length]?.key ?? 'worth';
      });
      setAutoAdvanceCount((current) => current + 1);
    }, QUESTION_ROTATION_MS);

    return () => window.clearTimeout(rotation);
  }, [autoAdvanceCount, hasUserSelected, isPaused]);

  const previewState = PREVIEW_STATES[activeQuestion];

  return (
    <div
      className={styles.assetHeroStage}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
    >
      <svg
        className={styles.assetConnectors}
        viewBox="0 0 1000 560"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {QUESTIONS.map((question) => (
          <g
            key={question.key}
            className={[
              question.connectorClass,
              question.key === activeQuestion ? styles.assetConnectorActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <path d={question.connectorPath} />
            {question.connectorDots.map((dot, index) => (
              <circle key={index} cx={dot.x} cy={dot.y} r="4" />
            ))}
          </g>
        ))}
      </svg>

      <div
        className={styles.assetQuestionGroup}
        role="group"
        aria-label="Explore the Aim4price asset record"
      >
        {QUESTIONS.map((question) => {
          const isActive = question.key === activeQuestion;

          return (
            <button
              key={question.key}
              id={`asset-question-${question.key}`}
              type="button"
              className={[
                styles.assetQuestion,
                question.positionClass,
                isActive ? styles.assetQuestionActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isActive}
              aria-controls="home-asset-state"
              onClick={() => {
                setActiveQuestion(question.key);
                setHasUserSelected(true);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {question.icon}
              </svg>
              <span>{question.label}</span>
            </button>
          );
        })}
      </div>

      <article
        id="home-asset-preview"
        className={styles.assetPreviewCard}
        data-active-question={activeQuestion}
        aria-label="Example Aim4price living asset record"
      >
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
                <svg viewBox="0 0 24 24">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Manage
              </span>
            </div>
          </div>
        </header>

        <div className={styles.assetPreviewBody}>
          <div className={styles.assetPhotoPanel}>
            <Image
              src="/brand/home-asset-hilux-listing.webp"
              alt="White Toyota Hilux single-cab work vehicle in a farm equipment yard"
              width={342}
              height={359}
              priority
              sizes="(min-width: 1181px) 17vw, (min-width: 761px) 32vw, 42vw"
            />
            <div className={styles.assetThumbnails} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <section
            key={activeQuestion}
            id="home-asset-state"
            className={styles.assetDetailsPanel}
            aria-labelledby={`asset-question-${activeQuestion}`}
          >
            <header className={styles.assetStateHeader}>
              <h3>{previewState.heading}</h3>
              <p>{previewState.description}</p>
            </header>

            <dl className={styles.assetStateRows}>
              {previewState.rows.map((row) => (
                <AssetDetail key={row.label} {...row} />
              ))}
            </dl>

            <div className={styles.assetStateFeature}>
              <span>{previewState.featureLabel}</span>
              <strong>{previewState.featureValue}</strong>
            </div>
          </section>
        </div>
      </article>

      <span
        className={styles.assetQuestionFeedback}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {hasUserSelected ? previewState.feedback : ''}
      </span>
    </div>
  );
}

function AssetDetail({
  label,
  value,
  tone = 'neutral',
}: PreviewRow) {
  return (
    <div className={styles.assetDetailRow}>
      <dt>{label}</dt>
      <dd data-tone={tone}>{value}</dd>
    </div>
  );
}
