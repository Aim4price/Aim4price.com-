'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from './WebsitePortal';
import { useLeadDialog } from './leads/useLeadDialog';
import { pageHelp, type PageHelpTopic } from '../lib/page-help';
import styles from './PageHelp.module.css';

function InfoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".85" fill="currentColor" stroke="none"/></svg>;
}

function HelpDialog({ topic, id, onClose }: { topic: PageHelpTopic; id: string; onClose: () => void }) {
  const content = pageHelp[topic];
  const ref = useLeadDialog(onClose);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  return <div className={styles.overlay} data-website-overlay="true" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section id={`${id}-dialog`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-purpose`} className={styles.dialog}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>About this page</span><h2 id={`${id}-title`}>{content.title}</h2></div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close page information" data-modal-close="true">×</button>
      </header>
      <div className={styles.body}>
        <p className={styles.purpose} id={`${id}-purpose`}>{content.purpose}</p>
        <h3>What you can do here</h3>
        <ul className={styles.features}>{content.actions.map(action => <li key={action}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg><span>{action}</span></li>)}</ul>
        <div className={styles.start}><h3>Where to start</h3><p>{content.start}</p></div>
      </div>
      <footer className={styles.footer}><button type="button" onClick={onClose}>Got it</button></footer>
    </section>
  </div>;
}

export default function PageHelp({ topic }: { topic: PageHelpTopic }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <>
    <button type="button" className={styles.trigger} aria-label={`About ${pageHelp[topic].title}`} title="About this page" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-dialog` : undefined} onClick={() => setOpen(true)}><InfoIcon /></button>
    {open && createPortal(<HelpDialog topic={topic} id={id} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

/** Keeps the existing heading typography, with a quiet help control on its right. */
export function PageHelpHeading({ topic, children, inset = false, reserveSwitch = false, enabled = true }: { topic: PageHelpTopic; children: ReactNode; inset?: boolean; reserveSwitch?: boolean; enabled?: boolean }) {
  if (!enabled) return <>{children}</>;
  return <div className={`${styles.heading} ${inset ? styles.inset : ""} ${reserveSwitch ? styles.reserveSwitch : ""}`}>{children}<PageHelp topic={topic} /></div>;
}
