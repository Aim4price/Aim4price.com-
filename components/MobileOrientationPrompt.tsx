import styles from './MobileOrientationPrompt.module.css';

export default function MobileOrientationPrompt() {
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
          <svg className={styles.icon} viewBox="0 0 160 160" focusable="false">
            <path
              className={styles.arrow}
              d="M42 56a50 50 0 0 1 78-8l8 8m0 0V37m0 19h-19"
            />
            <path
              className={styles.arrow}
              d="M118 104a50 50 0 0 1-78 8l-8-8m0 0v19m0-19h19"
            />
            <rect className={styles.phone} x="59" y="39" width="42" height="82" rx="10" />
            <path className={styles.phoneDetail} d="M72 47h16M76 113h8" />
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
