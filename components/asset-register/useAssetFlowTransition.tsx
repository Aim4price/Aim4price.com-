'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './AssetFlowTransition.module.css';

export function useAssetFlowTransition() {
  const [pending, setPending] = useState<{ dialog: Element; label: string } | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  function start(source: Element | null, label: string, proceed: () => void) {
    if (timer.current !== null) return;
    const dialog = source?.closest('[role="dialog"]');
    if (!dialog) return proceed();
    setPending({ dialog, label });
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setPending(null);
      if (dialog.isConnected) proceed();
    }, 500);
  }

  const feedback = pending && createPortal(
    <div className={styles.cover} role="status" aria-live="polite">
      <span className={styles.badge}><i aria-hidden="true" />{pending.label}</span>
    </div>,
    pending.dialog,
  );
  return { start, feedback, pending: Boolean(pending) };
}
