import styles from './GlobalLoadingScreen.module.css';

type GlobalLoadingScreenProps = {
  isVisible?: boolean;
  label?: string;
};

export default function GlobalLoadingScreen({
  isVisible = true,
  label = 'Loading all data...',
}: GlobalLoadingScreenProps) {
  return (
    <div
      className={styles.loadingScreen}
      data-visible={isVisible ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={styles.loaderShell}>
        <span className={styles.spinner} aria-hidden="true" />
        <span className={styles.loadingText}>{label}</span>
      </div>
    </div>
  );
}
