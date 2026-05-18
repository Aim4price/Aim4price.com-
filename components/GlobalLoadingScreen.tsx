import styles from './GlobalLoadingScreen.module.css';

type GlobalLoadingScreenProps = {
  label?: string;
};

export default function GlobalLoadingScreen({ label = 'Loading' }: GlobalLoadingScreenProps) {
  return (
    <div className={styles.loadingScreen} role="status" aria-live="polite" aria-label={label}>
      <div className={styles.loaderShell}>
        <span className={styles.spinner} aria-hidden="true" />
        <span className={styles.srOnly}>{label}</span>
      </div>
    </div>
  );
}
