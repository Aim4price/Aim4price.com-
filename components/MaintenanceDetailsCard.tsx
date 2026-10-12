'use client';

import type { ComponentPropsWithoutRef } from 'react';
import styles from '../app/asset-register/page.module.css';

type Props = ComponentPropsWithoutRef<'article'> & {
  expanded: boolean;
  onToggle: () => void;
};

/** Keep maintenance cards consistent with the Asset Register's card-wide toggle. */
export default function MaintenanceDetailsCard({ expanded, onToggle, className = '', children, ...props }: Props) {
  return (
    <article {...props} className={`${className} ${styles.cardToggleSurface}`} onClick={(event) => {
      if (window.getSelection()?.toString()) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest('button, a, input, select, textarea, label, summary, [role="button"], [contenteditable], [role="dialog"]')) return;
      onToggle();
    }}>
      <span aria-hidden="true" className={`${styles.controlTooltip} ${styles.cardToggleHint}`} data-tooltip={expanded ? 'Hide details' : 'View details'} />
      {children}
    </article>
  );
}
