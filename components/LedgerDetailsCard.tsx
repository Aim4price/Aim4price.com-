'use client';

import type { ComponentPropsWithoutRef } from 'react';
import styles from '../app/asset-register/page.module.css';

type Props = ComponentPropsWithoutRef<'article'> & {
  expanded: boolean;
  onToggle: () => void;
};

/** Match the Asset Register's hover hint and card-wide details toggle. */
export default function LedgerDetailsCard({ expanded, onToggle, className = '', children, ...props }: Props) {
  return (
    <article {...props} className={`${className} ${styles.cardToggleSurface}`} onClick={(event) => {
      if (window.getSelection()?.toString()) return;
      const target = event.target;
      if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
      const control = target.closest('button, a, input, select, textarea, label, summary, [role="button"], [contenteditable], [role="dialog"]');
      // A containing manager dialog must not disable the cards inside it.
      if (control && event.currentTarget.contains(control)) return;
      onToggle();
    }}>
      <span aria-hidden="true" className={`${styles.controlTooltip} ${styles.cardToggleHint}`} data-tooltip={expanded ? 'Hide details' : 'View details'} />
      {children}
    </article>
  );
}
