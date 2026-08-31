'use client';

import { usePathname } from 'next/navigation';

import styles from './MobileOrientationPrompt.module.css';

const MOBILE_APP_ROUTE_PREFIXES = ['/owner-app', '/dealer', '/field-manager'] as const;

function isMobileAppRoute(pathname: string): boolean {
  return MOBILE_APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function MobileOrientationPrompt() {
  const pathname = usePathname();

  if (isMobileAppRoute(pathname)) return null;

  return (
    <section
      className={styles.prompt}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-orientation-title"
      aria-describedby="mobile-orientation-description"
      tabIndex={0}
    >
      <div className={styles.card}>
        <div className={styles.iconSignal} aria-hidden="true">
          <svg className={styles.icon} viewBox="0 0 180 180" focusable="false">
            <defs>
              <linearGradient
                id="orientation-phone-frame"
                x1="65"
                y1="42"
                x2="116"
                y2="139"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#1f7157" />
                <stop offset="1" stopColor="#0d4234" />
              </linearGradient>
              <linearGradient
                id="orientation-phone-screen"
                x1="75"
                y1="54"
                x2="108"
                y2="121"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#f8fffb" />
                <stop offset="1" stopColor="#c9ecd9" />
              </linearGradient>
              <marker
                id="orientation-arrowhead"
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path className={styles.arrowMarker} d="M2 2L10 6L2 10Z" />
              </marker>
            </defs>

            <path
              className={styles.motionTrack}
              pathLength="1"
              markerEnd="url(#orientation-arrowhead)"
              d="M37 101C37 61 66 32 104 33C132 34 151 51 156 74"
            />

            <g className={styles.phoneGroup}>
              <rect className={styles.phoneShadow} x="65" y="42" width="50" height="96" rx="15" />
              <rect className={styles.phoneFrame} x="65" y="41" width="50" height="96" rx="15" />
              <rect className={styles.phoneScreen} x="72" y="52" width="36" height="67" rx="8" />
              <path className={styles.screenSheen} d="M75 58C85 53 96 53 105 57V77L75 95Z" />
              <rect className={styles.phoneSpeaker} x="83" y="46" width="14" height="3" rx="1.5" />
              <circle className={styles.phoneButton} cx="90" cy="128" r="4" />
            </g>
          </svg>
        </div>

        <p className={styles.eyebrow}>Aim4price</p>
        <h1 id="mobile-orientation-title">Turn your phone sideways</h1>
        <p id="mobile-orientation-description">
          Rotate to landscape to continue.
        </p>
      </div>
    </section>
  );
}
