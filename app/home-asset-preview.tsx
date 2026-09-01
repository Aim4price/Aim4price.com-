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
  icon: ReactNode;
};

const QUESTION_ROTATION_MS = 5000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const QUESTION_FEEDBACK: Readonly<Record<QuestionKey, string>> = {
  have: 'Asset identity and condition details highlighted.',
  worth: 'Current and replacement values highlighted.',
  cost: 'Cost Ledger tracking for fuel, maintenance and repairs highlighted.',
  attention: 'Licence, mapping and replacement information highlighted.',
};

const QUESTIONS: readonly Question[] = [
  {
    key: 'have',
    label: 'What do I have?',
    positionClass: styles.assetQuestionHave,
    connectorClass: styles.assetConnectorHave,
    connectorPath: 'M 109 60 C 128 60 126 104 146 104',
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
    connectorPath: 'M 632 166 C 645 166 650 166 659 166',
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
    connectorPath: 'M 109 498 C 128 498 126 454 146 454',
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
    connectorPath: 'M 632 438 C 649 438 650 490 660 490',
    icon: (
      <path d="M14.8 5.1a4.6 4.6 0 0 0-5.7 5.7l-5 5a2.2 2.2 0 0 0 3.1 3.1l5-5a4.6 4.6 0 0 0 5.7-5.7l-2.7 2.7-2.1-.5-.5-2.1z" />
    ),
  },
];

export default function HomeAssetPreview() {
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey>('worth');
  const [isPaused, setIsPaused] = useState(false);
  const [autoAdvanceCount, setAutoAdvanceCount] = useState(0);
  const [hasUserSelected, setHasUserSelected] = useState(false);

  useEffect(() => {
    if (
      isPaused ||
      hasUserSelected ||
      autoAdvanceCount >= QUESTIONS.length ||
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
        viewBox="0 0 760 560"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {QUESTIONS.map((question) => (
          <path
            key={question.key}
            d={question.connectorPath}
            className={question.connectorClass}
          />
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
              type="button"
              className={[
                styles.assetQuestion,
                question.positionClass,
                isActive ? styles.assetQuestionActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isActive}
              aria-controls="home-asset-preview"
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
              <span className={styles.assetShareAction}>Share</span>
              <span className={styles.assetDetailsAction}>Hide details</span>
              <span className={styles.assetManageAction}>Manage</span>
            </div>
          </div>
        </header>

        <div className={styles.assetPreviewBody}>
          <div className={styles.assetPhotoPanel}>
            <span className={styles.assetPhotoAction} aria-hidden="true">
              + Add photos
            </span>
            <Image
              src="/brand/home-asset-hilux.webp"
              alt="White Toyota Hilux single-cab work vehicle in a farm equipment yard"
              width={960}
              height={720}
              priority
              sizes="(min-width: 1181px) 13vw, (min-width: 761px) 24vw, (min-width: 641px) 30vw, 40vw"
            />
            <span className={styles.assetPhotoCount} aria-hidden="true">
              1 / 3
            </span>
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
              {activeQuestion === 'cost' ? (
                <>
                  <span>Cost Ledger</span>
                  <strong className={styles.assetCostSummary}>
                    Tracks fuel · maintenance · repairs
                  </strong>
                </>
              ) : (
                <>
                  <span>Replacement price</span>
                  <strong>
                    R 450 000
                    <small>Excl. VAT</small>
                  </strong>
                </>
              )}
            </div>
          </div>
        </div>
      </article>

      <span
        className={styles.assetQuestionFeedback}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {hasUserSelected ? QUESTION_FEEDBACK[activeQuestion] : ''}
      </span>
    </div>
  );
}

function AssetDetail({
  label,
  value,
  status = false,
}: {
  label: string;
  value: string;
  status?: boolean;
}) {
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
