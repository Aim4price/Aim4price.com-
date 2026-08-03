'use client';

import { useEffect } from 'react';
import styles from './page.module.css';

type OverviewClearConfirmationProps = {
  assetTitle: string;
  itemLabel: string;
  isClearing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function OverviewClearConfirmation({
  assetTitle,
  itemLabel,
  isClearing,
  onCancel,
  onConfirm,
}: OverviewClearConfirmationProps) {
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

  return (
    <div
      className={styles.overviewConfirmBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isClearing) onCancel();
      }}
    >
      <section
        className={styles.overviewConfirmCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overview-clear-title"
        aria-describedby="overview-clear-description"
      >
        <span className={styles.overviewConfirmEyebrow}>Overview</span>
        <h2 id="overview-clear-title">Are you sure?</h2>
        <p id="overview-clear-description">
          Clear the {itemLabel.toLowerCase()} for <strong>{assetTitle}</strong> from your Overview?
          This will not delete the asset or its records.
        </p>
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
            onClick={onConfirm}
            disabled={isClearing}
            aria-busy={isClearing}
          >
            {isClearing ? 'Clearing…' : 'Yes, clear'}
          </button>
        </div>
      </section>
    </div>
  );
}
