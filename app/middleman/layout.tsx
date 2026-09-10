import AppNotificationsTopLink from '../../components/AppNotificationsTopLink';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import DealerNav from '../dealer/dealer-nav';
import DealerSessionKeeper from '../dealer/dealer-session-keeper';
import styles from '../dealer/dealer.module.css';

export { middlemanAppMetadata as metadata } from '../../lib/middleman-app-metadata';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#1877F2',
};

export default function DealerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DealerSessionKeeper />
      <div className={styles.dealerLayout} data-app-shell="dealer">
        <AppNotificationsTopLink root="/middleman" />
        <DealerNav />
        <div className={styles.patternPageContent}>{children}</div>
      </div>
    </>
  );
}



