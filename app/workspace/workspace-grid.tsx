import Link from 'next/link';
import type { workspaceCards } from '../../lib/workspace-navigation';
import styles from './workspace.module.css';

export default function WorkspaceGrid({ cards }: { cards: ReturnType<typeof workspaceCards> }) {
  return (
    <nav className={styles.grid} aria-label="Workspace pages">
      {cards.map(({ key, label, href, locked }) => (
        <Link
          key={key}
          href={locked ? '/upgrade-account' : href}
          prefetch={false}
          aria-label={locked ? label + ' — upgrade to Paid Business' : undefined}
          className={styles.card}
          data-account={key === 'account' || undefined}
          data-locked={locked || undefined}
        >
          <strong>{label}</strong>
          {locked && (
            <svg className={styles.lock} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="10" width="16" height="11" rx="3" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          )}
        </Link>
      ))}
    </nav>
  );
}
