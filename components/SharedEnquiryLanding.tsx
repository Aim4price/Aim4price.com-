'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import SharedEnquiryAccess from './SharedEnquiryAccess';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from '../app/business-network/accept/page.module.css';
import gateStyles from './SharedEnquiryLanding.module.css';

/** Only public entry copy belongs here. Asset data stays behind the server access check. */
export default function SharedEnquiryLanding({ returnTo, access, prompt = false }: {
  returnTo: string; access: string; prompt?: boolean;
}) {
  const [open, setOpen] = useState(prompt);
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const allowed = ['owner', 'active', 'read-only'].includes(access);
  const contents = <>
    <span className={styles.actionIcon} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 9a2 2 0 0 1 2-2h7l3 3h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="m12 21 8-8m-7 0h7v7"/></svg></span>
    <strong>Open enquiry</strong><span className={styles.actionHint}>View the shared asset details</span>
  </>;
  return <main className={`${styles.page} ${gateStyles.page}`}>
    <div className={styles.layout}>
      <section className={styles.copy}>
        <h1><span>Asset details.</span><span>Shared with you.</span></h1>
      </section>
      {allowed ? <Link className={styles.action} href={returnTo}>{contents}</Link> :
        <button ref={trigger} type="button" className={`${styles.action} ${gateStyles.openButton}`} onClick={() => setOpen(true)}>{contents}</button>}
    </div>
    {open && !allowed ? <ShareDisclosureDialog title={access === 'sign-in' ? 'Please sign in to view this enquiry' : 'Open your shared enquiry'} titleId={titleId} closeLabel="Back to shared enquiry" onClose={() => { setOpen(false); trigger.current?.focus(); }} className={gateStyles.dialog}>
      <SharedEnquiryAccess returnTo={returnTo} access={access} embedded />
    </ShareDisclosureDialog> : null}
  </main>;
}
