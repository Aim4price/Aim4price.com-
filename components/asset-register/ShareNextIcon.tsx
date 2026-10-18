import styles from './ShareNextIcon.module.css';

/** Decorative continuation marker; the containing button owns the action. */
export default function ShareNextIcon() {
  return <svg className={styles.icon} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <circle cx="16" cy="16" r="14" />
    <path d="m13 10 6 6-6 6" />
  </svg>;
}
