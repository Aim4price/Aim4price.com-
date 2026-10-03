'use client';

import { useId } from 'react';
import { useLeadDialog } from './leads/useLeadDialog';
import styles from '../app/maintenance/page.module.css';
import accountStyles from '../app/account/page.module.css';

type Props = {
  assetTitle: string;
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
  const dialogRef = useLeadDialog(props.onClose);
  const choices = props.step === 'timing' ? [
    { label: 'Already done', description: 'Record past services, repairs or checks.', icon: '✓', onClick: props.onDone },
    { label: 'Upcoming', description: props.onUpcoming ? 'Schedule work and reminders.' : 'Scheduling access has not been shared.', icon: '31', onClick: props.onUpcoming },
  ] : [
    { label: 'Service', description: 'Servicing, repairs or maintenance.', icon: <svg className={styles.maintenanceChoiceSvg} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a8.2 8.2 0 0 0-1.7-1L15 3.3h-4L10.6 6a8.2 8.2 0 0 0-1.7 1L6.4 6 4.4 9.4 6.5 11a7.7 7.7 0 0 0-.1 1c0 .3 0 .7.1 1l-2.1 1.6 2 3.4 2.5-1a8.2 8.2 0 0 0 1.7 1l.4 2.7h4l.4-2.7a8.2 8.2 0 0 0 1.7-1l2.5 1 2-3.4-2.2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" /></svg>, onClick: () => props.onType('service') },
    { label: 'Checkup', description: 'Inspection or condition check.', icon: '✓', onClick: () => props.onType('checkup') },
  ];
  return <div className={`${styles.page} ${styles.modalBackdrop}`} data-website-overlay style={{ zIndex: 26000 }} role="dialog" ref={node => { dialogRef.current = node; }} tabIndex={-1} aria-modal="true" aria-labelledby={titleId}>
    <section className={`${styles.formModal} ${styles.maintenanceStepModal} ${styles.schedulingDialog}`}>
      <header className={styles.modalHeader}>
        <div><h2 id={titleId}>{props.step === 'timing' ? 'Already done or upcoming?' : props.timing === 'done' ? 'What was done?' : 'What needs doing?'}</h2><p>{props.assetTitle}</p></div>
        <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={props.onClose} aria-label="Close maintenance"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg></button>
      </header>
      <div className={styles.modalDivider} />
      <div className={styles.maintenanceChoiceBody}><div className={styles.maintenanceChoiceGrid}>
        {choices.map(choice => <button key={choice.label} className={styles.maintenanceChoiceCard} type="button" disabled={!choice.onClick} onClick={choice.onClick}>
          <span className={styles.maintenanceChoiceIcon} aria-hidden="true">{choice.icon}</span>
          <strong>{choice.label}</strong><small>{choice.description}</small>
        </button>)}
      </div></div>
      <footer className={styles.modalFooter}>
        {props.onBack && <button className={styles.secondaryButton} type="button" onClick={props.onBack}>Back</button>}
        <button className={styles.secondaryButton} type="button" onClick={props.onClose}>Cancel</button>
      </footer>
    </section>
  </div>;
}
