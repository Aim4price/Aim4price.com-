import type { ReactNode } from 'react';

import styles from './AppPatternBackground.module.css';

type AppPatternBackgroundProps = {
  children: ReactNode;
  className?: string;
};

export default function AppPatternBackground({ children, className }: AppPatternBackgroundProps) {
  const rootClassName = className ? `${styles.background} ${className}` : styles.background;

  return (
    <div className={rootClassName} data-app-pattern="topographic-contours">
      <div className={styles.decoration} aria-hidden="true">
        <span className={styles.topography} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
