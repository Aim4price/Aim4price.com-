'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLeadDialog } from './leads/useLeadDialog';
import styles from '../app/maintenance/page.module.css';
import CostDetailIcon from './CostDetailIcon';
import accountStyles from '../app/account/page.module.css';

type Props = {
  assetTitle: string;
  assetDetails?: string;
  onClose: () => void;
  onBack?: () => void;
} & ({
  step: 'timing';
  onDone: () => void;
  onUpcoming?: () => void;
} | {
  step: 'type';
  timing: 'done' | 'upcoming';
  onType: (type: 'service' | 'checkup') => void;
});

/** One entry chooser for owner maintenance, leads and shared links. */
export default function MaintenanceEntryChoice(props: Props) {
  const titleId = useId();
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelTransition = () => {
    if (transitionTimer.current !== null) clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
  };
  const close = () => {
    cancelTransition();
    setTransitioning(false);
    props.onClose();
  };
  const dialogRef = useLeadDialog(close);
  useEffect(() => cancelTransition, []);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [props.step]);
  const transitionTo = (action?: () => void) => {
    if (!action || transitionTimer.current !== null) return;
    setTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      setTransitioning(false);
      action();
    }, 450);
  };
  const choices = props.step === 'timing' ? [
    { label: 'Already done', description: 'Record past services, repairs or checks.', icon: <CostDetailIcon kind="document" />, onClick: props.onDone },
    { label: 'Upcoming', description: props.onUpcoming ? 'Schedule work and reminders.' : 'Scheduling access has not been shared.', icon: <CostDetailIcon kind="calendar" />, onClick: props.onUpcoming },
  ] : [
    { label: 'Service', description: 'Servicing, repairs or maintenance.', icon: <CostDetailIcon kind="maintenance" />, onClick: () => props.onType('service') },
    { label: 'Checkup', description: 'Inspection or condition check.', icon: <CostDetailIcon kind="document" />, onClick: () => props.onType('checkup') },
  ];
  return <div className={`${styles.page} ${styles.modalBackdrop} ${styles.maintenanceChoiceBackdrop}`} data-website-overlay style={{ zIndex: 26000 }} role="dialog" ref={node => { dialogRef.current = node; }} tabIndex={-1} aria-modal="true" aria-labelledby={titleId}>
    <section className={`${styles.formModal} ${styles.maintenanceStepModal} ${styles.schedulingDialog}`}>
      <header className={styles.modalHeader}>
        <div><h2 id={titleId} ref={headingRef} tabIndex={-1}>{props.step === 'timing' ? 'Already done or upcoming?' : props.timing === 'done' ? 'What was done?' : 'What needs doing?'}</h2><p>{props.assetTitle}</p>{props.assetDetails ? <p>{props.assetDetails}</p> : null}</div>
        <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={close} aria-label="Close maintenance" data-modal-close="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg></button>
      </header>
      <div className={styles.modalDivider} />
      <div className={`${styles.maintenanceChoiceBody} ${styles.maintenanceTransitionBody}`} aria-busy={transitioning}>
        {transitioning && <div className={styles.maintenanceTransitionStatus} role="status">
          <span className={styles.maintenanceTransitionSpinner} aria-hidden="true" />
          <span>Loading question…</span>
        </div>}
        <div className={styles.maintenanceChoiceGrid} style={transitioning ? { visibility: 'hidden' } : undefined}>
        {choices.map(choice => <button key={choice.label} className={styles.maintenanceChoiceCard} type="button" disabled={transitioning || !choice.onClick} onClick={() => transitionTo(choice.onClick)}>
          <span className={styles.maintenanceChoiceIcon} aria-hidden="true">{choice.icon}</span>
          <strong>{choice.label}</strong><small>{choice.description}</small>
        </button>)}
      </div></div>
      <footer className={styles.modalFooter}>
        {props.onBack && <button className={styles.secondaryButton} type="button" disabled={transitioning} onClick={() => transitionTo(props.onBack)}>Back</button>}
        <button className={styles.secondaryButton} type="button" onClick={close}>Cancel</button>
      </footer>
    </section>
  </div>;
}
