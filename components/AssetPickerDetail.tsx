import type { ReactNode } from 'react';
import styles from './AssetPickerDetail.module.css';

/** Quiet supporting information shared by every saved-asset chooser. */
export default function AssetPickerDetail({ children, serial = false }: { children: ReactNode; serial?: boolean }) {
  return <small className={styles.detail} data-asset-choice-secondary="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {serial ? <path d="M3 4v16M6 4v16M10 4v16M14 4v16M17 4v16M21 4v16" /> : <path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />}
    </svg>
    <span>{children}</span>
  </small>;
}
