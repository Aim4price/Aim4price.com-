'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

export type OverviewClearOutcome = 'clear' | 'completed' | 'problem_done';

type OverviewClearConfirmationProps = {
  assetTitle: string;
  itemLabel: string;
  itemType: 'problem' | 'service' | 'checkup' | 'license';
  isClearing: boolean;
  canClearForEveryone?: boolean;
  clearsForEveryone?: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    outcome: OverviewClearOutcome;
    clearForEveryone: boolean;
  }) => void;
};

export default function OverviewClearConfirmation({
  assetTitle,
  itemLabel,
  itemType,
  isClearing,
  canClearForEveryone = false,
  clearsForEveryone = false,
  onCancel,
  onConfirm,
}: OverviewClearConfirmationProps) {
  const [step, setStep] = useState<'confirm' | 'completion'>('confirm');
  const [clearForEveryone, setClearForEveryone] = useState(clearsForEveryone);
  const isMaintenance = itemType === 'service' || itemType === 'checkup';
  const isProblem = itemType === 'problem';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isClearing) onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClearing, onCancel]);

  function continueFromConfirmation() {
    if (isMaintenance || isProblem) {
      setStep('completion');
      return;
    }

    onConfirm({ outcome: 'clear', clearForEveryone });
  }

  const title = step === 'confirm'
    ? 'Are you sure?'
    : isProblem
      ? 'Has the problem been dealt with?'
      : 'Was it completed?';

  return (
    <div
      className={styles.overviewConfirmBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isClearing) onCancel();
      }}
    >
      <section
        className={styles.overviewConfirmCard}
        data-step={step}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overview-clear-title"
        aria-describedby="overview-clear-description"
      >
        <span className={styles.overviewConfirmEyebrow}>Overview</span>
        <h2 id="overview-clear-title">{title}</h2>

        {step === 'confirm' ? (
          <>
            <p id="overview-clear-description">
              Clear the {itemLabel.toLowerCase()} for <strong>{assetTitle}</strong> from Overview?
            </p>

            {canClearForEveryone && !isProblem ? (
              <fieldset className={styles.overviewConfirmScope}>
                <legend>Clear from</legend>
                <label className={clearForEveryone ? '' : styles.overviewConfirmScopeSelected}>
                  <input
                    type="radio"
                    name="overview-clear-scope"
                    checked={!clearForEveryone}
                    onChange={() => setClearForEveryone(false)}
                  />
                  <span>
                    <strong>My overview only</strong>
                    <small>Other app users will still see it.</small>
                  </span>
                </label>
                <label className={clearForEveryone ? styles.overviewConfirmScopeSelected : ''}>
                  <input
                    type="radio"
                    name="overview-clear-scope"
                    checked={clearForEveryone}
                    onChange={() => setClearForEveryone(true)}
                  />
                  <span>
                    <strong>Everyone’s overview</strong>
                    <small>Clear it for the Owner and all Field Managers.</small>
                  </span>
                </label>
              </fieldset>
            ) : clearsForEveryone ? (
              <p className={styles.overviewConfirmSharedNote}>
                This clears it for the Owner and all Field Managers.
              </p>
            ) : null}

            <div className={styles.overviewConfirmActions}>
              <button
                type="button"
                className={styles.overviewConfirmCancel}
                onClick={onCancel}
                disabled={isClearing}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.overviewConfirmButton}
                onClick={continueFromConfirmation}
                disabled={isClearing}
              >
                {isMaintenance || isProblem ? 'Continue' : 'Yes, clear'}
              </button>
            </div>
          </>
        ) : isProblem ? (
          <>
            <p id="overview-clear-description">
              Only choose <strong>Yes, done</strong> once the problem has been dealt with.
            </p>
            <div className={styles.overviewConfirmActions}>
              <button
                type="button"
                className={styles.overviewConfirmCancel}
                onClick={onCancel}
                disabled={isClearing}
              >
                Not yet
              </button>
              <button
                type="button"
                className={styles.overviewConfirmButton}
                onClick={() => onConfirm({ outcome: 'problem_done', clearForEveryone: true })}
                disabled={isClearing}
                aria-busy={isClearing}
              >
                {isClearing ? 'Saving…' : 'Yes, done'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p id="overview-clear-description">
              <strong>Yes</strong> saves a basic {itemLabel.toLowerCase()} record. <strong>Not sure</strong> clears the reminder without saving maintenance.
            </p>
            <div className={styles.overviewConfirmActions}>
              <button
                type="button"
                className={styles.overviewConfirmCancel}
                onClick={() => onConfirm({ outcome: 'clear', clearForEveryone })}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing…' : 'Not sure'}
              </button>
              <button
                type="button"
                className={styles.overviewConfirmButton}
                onClick={() => onConfirm({ outcome: 'completed', clearForEveryone: true })}
                disabled={isClearing}
                aria-busy={isClearing}
              >
                {isClearing ? 'Saving…' : 'Yes'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
