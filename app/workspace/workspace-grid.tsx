'use client';

import Link from 'next/link';
import { useState } from 'react';
import ShareDisclosureDialog from '../../components/asset-register/ShareDisclosureDialog';
import PageHelp from '../../components/PageHelp';
import type { workspaceCards, WorkspaceRole } from '../../lib/workspace-navigation';
import { useWorkspaceVisibility } from '../../lib/use-workspace-visibility';
import { cardTopic } from './card-help';
import styles from './workspace.module.css';

type Cards = ReturnType<typeof workspaceCards>;

function WorkspaceTile({card, role, free}: {card: Cards[number]; role: WorkspaceRole; free: boolean}) {
  const {key, label, href, locked} = card;
  return <article className={styles.card}>
    <Link className={styles.cardLink} href={locked ? '/account' : href} prefetch={false}
      aria-label={locked ? label + ' — view account options' : label}>
      <strong>{label}</strong>
      {locked && <span title="Included with Paid Business" aria-hidden="true" className={styles.plan}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="8" width="12" height="9" rx="2"/><path d="M7 8V6a3 3 0 0 1 6 0v2"/></svg></span>}
    </Link>
    <div className={styles.help}><PageHelp topic={cardTopic(key, role, href, free)}/></div>
  </article>;
}

export default function WorkspaceGrid({cards, role, userId, freeBusiness}: {
  cards: Cards; role: WorkspaceRole; userId: string; freeBusiness: boolean;
}) {
  const { hidden, save } = useWorkspaceVisibility(userId, role);
  const [editing, setEditing] = useState(false);
  const visible = cards.filter(card => !hidden.includes(card.key));
  const available = visible.filter(card => !card.locked);
  const paid = visible.filter(card => card.locked);
  return <>
    <header className={styles.heading}>
      {role === 'middleman' ? <h1>Workspace</h1> : (
        <div className={styles.intro}>
          <h1>Choose a workspace</h1>
          <p>{role === 'owner'
            ? 'Manage your assets, track costs and plan maintenance.'
            : 'View shared assets, manage your registers and explore the marketplace.'}</p>
        </div>
      )}
      <button type="button" className={styles.setting} aria-label="Customise workspace" aria-haspopup="dialog" onClick={() => setEditing(true)}>Customise</button>
    </header>
    {editing && <ShareDisclosureDialog title="Customise workspace" titleId="workspace-card-options" closeLabel="Close workspace settings" onClose={() => setEditing(false)}>
      <fieldset className={styles.fields}><legend>Show cards</legend>
      {(freeBusiness || role === 'owner') && <p>Hiding a page here also hides it from Manage. Sign out is always available.</p>}
      <div className={styles.options} data-role={role}>{cards.map(card => <label key={card.key}>
        <input type="checkbox" checked={!hidden.includes(card.key)} onChange={event => save(event.target.checked ? hidden.filter(key => key !== card.key) : [...hidden, card.key])}/>{card.label}
      </label>)}</div>
      </fieldset>
      <footer className={styles.editorActions}>
        <button type="button" className={styles.setting} onClick={() => save([])}>Restore defaults</button>
        <button type="button" className={styles.done} onClick={event => event.currentTarget.closest('dialog')?.close()}>Done</button>
      </footer>
    </ShareDisclosureDialog>}
    {visible.length > 0 && <nav className={styles.grid} aria-label="Workspace pages">
      {[...available, ...paid].map(card => <WorkspaceTile key={card.key} card={card} role={role} free={freeBusiness}/>)}
    </nav>}
    {visible.length === 0 && <p>Choose cards in Customise workspace to show them here.</p>}
  </>;
}
