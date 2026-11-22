'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ShareDisclosureDialog from '../../components/asset-register/ShareDisclosureDialog';
import BusinessCardIcon from './business-card-icon';
import PageHelp from '../../components/PageHelp';
import { BusinessSubscriptionButton, type BusinessSubscription } from '../../components/BusinessCreditControls';
import type { workspaceCards, WorkspaceRole } from '../../lib/workspace-navigation';
import { cardTopic } from './card-help';
import styles from './workspace.module.css';

type Cards = ReturnType<typeof workspaceCards>;

function WorkspaceTile({card, role, free}: {card: Cards[number]; role: WorkspaceRole; free: boolean}) {
  const {key, label, href, locked} = card;
  return <article className={styles.card} data-business={role === 'business' || undefined}>
    <Link className={styles.cardLink} href={locked ? '#workspace-upgrade' : href} prefetch={false}
      aria-label={locked ? label + ' — see Paid Business upgrade' : label}>
      {role === 'business' && <BusinessCardIcon name={key}/>}
      <strong>{label}</strong>
      {locked && <span title="Included with Paid Business" aria-hidden="true" className={styles.plan}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="8" width="12" height="9" rx="2"/><path d="M7 8V6a3 3 0 0 1 6 0v2"/></svg></span>}
    </Link>
    <div className={styles.help}><PageHelp topic={cardTopic(key, role, href, free)}/></div>
  </article>;
}

export default function WorkspaceGrid({cards, role, userId, subscription}: {
  cards: Cards; role: WorkspaceRole; userId: string; subscription: BusinessSubscription | null;
}) {
  const storageKey = 'aim4price.workspace.hidden.' + userId + '.' + role;
  const [hidden, setHidden] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(saved)) setHidden(saved.filter((key): key is string => typeof key === 'string'));
    } catch { /* The workspace is also usable without browser storage. */ }
  }, [storageKey]);
  function save(keys: string[]) {
    setHidden(keys);
    try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { /* Session-only preferences. */ }
  }
  const visible = cards.filter(card => !hidden.includes(card.key));
  const available = visible.filter(card => !card.locked);
  const paid = visible.filter(card => card.locked);
  return <>
    <header className={styles.heading}><h1>Workspace</h1>
      <div className={styles.actions}>
        <button type="button" className={styles.setting} aria-label="Customise workspace" aria-haspopup="dialog" onClick={() => setEditing(true)}>Customise</button>
        {subscription && <div id="workspace-upgrade" className={styles.subscription} tabIndex={-1}>
          <BusinessSubscriptionButton plan={subscription} className={styles.upgrade} icon={subscription.remaining !== null && <span>{subscription.remaining.toLocaleString('en-ZA')} credits</span>}/>
        </div>}
      </div>
    </header>
    {editing && <ShareDisclosureDialog title="Customise workspace" titleId="workspace-card-options" closeLabel="Close workspace settings" onClose={() => setEditing(false)}>
      <fieldset className={styles.fields}><legend>Show cards</legend>
      <div className={styles.options}>{cards.map(card => <label key={card.key}>
        <input type="checkbox" checked={!hidden.includes(card.key)} onChange={event => save(event.target.checked ? hidden.filter(key => key !== card.key) : [...hidden, card.key])}/>{card.label}
      </label>)}</div>
      </fieldset>
      <footer className={styles.editorActions}>
        <button type="button" className={styles.setting} onClick={() => save([])}>Restore defaults</button>
        <button type="button" className={styles.done} onClick={event => event.currentTarget.closest('dialog')?.close()}>Done</button>
      </footer>
    </ShareDisclosureDialog>}
    {visible.length > 0 && <nav className={styles.grid} aria-label="Workspace pages">
      {[...available, ...paid].map(card => <WorkspaceTile key={card.key} card={card} role={role} free={Boolean(subscription)}/>)}
    </nav>}
    {visible.length === 0 && <p>Choose cards in Customise workspace to show them here.</p>}
  </>;
}
