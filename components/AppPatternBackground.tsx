import type { ReactNode } from 'react';

import styles from './AppPatternBackground.module.css';

type AppPatternBackgroundProps = {
  children: ReactNode;
  className?: string;
};

const ARC_RADII = [72, 104, 136, 168, 200];
const DOT_POSITIONS = [6, 22, 38, 54];

function CornerArcs({ className, origin }: { className: string; origin: 'start' | 'end' }) {
  const coordinate = origin === 'start' ? 0 : 240;

  return (
    <svg className={className} viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      {ARC_RADII.map((radius) => (
        <circle
          key={radius}
          cx={coordinate}
          cy={coordinate}
          r={radius}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function DotGrid({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 60 60" aria-hidden="true" focusable="false">
      {DOT_POSITIONS.flatMap((y) =>
        DOT_POSITIONS.map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.25" />),
      )}
    </svg>
  );
}

export default function AppPatternBackground({ children, className }: AppPatternBackgroundProps) {
  const rootClassName = className ? `${styles.background} ${className}` : styles.background;

  return (
    <div className={rootClassName} data-app-pattern="minimal-arc">
      <div className={styles.decoration} aria-hidden="true">
        <CornerArcs className={`${styles.arcs} ${styles.arcsTopLeft}`} origin="start" />
        <CornerArcs className={`${styles.arcs} ${styles.arcsBottomRight}`} origin="end" />
        <DotGrid className={`${styles.dotGrid} ${styles.dotGridTopRight}`} />
        <DotGrid className={`${styles.dotGrid} ${styles.dotGridBottomLeft}`} />
        <span className={`${styles.mintCircle} ${styles.mintCircleLeft}`} />
        <span className={`${styles.mintCircle} ${styles.mintCircleRight}`} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
