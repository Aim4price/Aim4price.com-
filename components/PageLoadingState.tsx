import styles from './PageLoadingState.module.css';

type Props = {
  label?: string;
  detail?: string;
};

export default function PageLoadingState({
  label = 'Loading your workspace',
  detail = 'Getting the latest information ready.',
}: Props) {
  return (
    <main className={styles.screen} aria-busy="true" aria-live="polite">
      <section className={styles.card}>
        <span className={styles.spinner} aria-hidden="true" />
        <div className={styles.copy}>
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>
      </section>
    </main>
  );
}
