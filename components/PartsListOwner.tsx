import styles from "../app/dealer/parts/parts.module.css";

export default function PartsListOwner({ name, town }: { name: string; town?: string }) {
  return (
    <div className={styles.listDealer}>
      <strong className={styles.listDealerName}>{name}</strong>
      {town && (
        <span className={styles.listTown}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>{town}</span>
        </span>
      )}
    </div>
  );
}
