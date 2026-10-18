import Link from 'next/link';
import type { Ref } from 'react';
import styles from './WorkspaceViewSwitch.module.css';

type Props = {
  label: string;
  count?: number;
} & ({ href: string; onClick?: never; buttonRef?: never } | { href?: never; onClick: () => void; buttonRef?: Ref<HTMLButtonElement> });

/** The same circular switch and hover-label convention as the Asset Register. */
export default function WorkspaceViewSwitch({ label, count = 0, href, onClick, buttonRef }: Props) {
  const accessibleLabel = count > 0 ? `${label}, ${count} budget alerts need attention` : label;
  const content = <>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10m-3-3 3 3-3 3M17 17H7m3-3-3 3 3 3" />
    </svg>
    {count > 0 ? <span className={styles.badge} aria-hidden="true">{count > 99 ? '99+' : count}</span> : null}
  </>;
  return href !== undefined
    ? <Link className={styles.switchButton} href={href} aria-label={accessibleLabel} data-tooltip={label}>{content}</Link>
    : <button ref={buttonRef} type="button" className={styles.switchButton} onClick={onClick} aria-label={accessibleLabel} data-tooltip={label}>{content}</button>;
}
