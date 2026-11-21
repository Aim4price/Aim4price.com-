import type { ReactNode } from 'react';
import assetStyles from '../../app/asset-register/page.module.css';
import styles from '../../app/leads/shared-assets.module.css';

type Props = {
  title: string;
  sender?: string;
  date: string;
  pills: string[];
  message?: string;
  action: ReactNode;
};

export default function RecipientAssetSummary({ title, sender, date, pills, message, action }: Props) {
  return (
    <div className={`${styles.card} ${styles.recipientCard}`}>
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5M12 12v10"/>
        </svg>
      </span>
      <div className={styles.body}>
        <div className={styles.heading}><h3>{title}</h3></div>
        <div className={styles.metadata}>{sender && <strong>{sender}</strong>}<span>Shared {date}</span></div>
        <div className={styles.preview}>
          {pills.map(label => <span key={label} className={assetStyles.assetGroupPreview} title={label}>{label}</span>)}
        </div>
        {message && <p className={styles.message}>{message}</p>}
      </div>
      {action}
    </div>
  );
}
