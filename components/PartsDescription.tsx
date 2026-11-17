import styles from '../app/dealer/parts/parts.module.css';

type Detail = { id: string; label: string; value: string; private?: boolean };

/** Shared presentation for each list's already-authorized detail fields. */
export default function PartsDescription({ description, details }: { description?: string; details: Detail[] }) {
  const visible = details.filter(detail => detail.value?.trim());
  return <>
    <strong className={styles.partName}>{description || '—'}</strong>
    {!!visible.length && <dl className={styles.partExtraDetails}>{visible.map(detail => {
      const condition = detail.id === 'condition' || detail.label.toLowerCase() === 'condition';
      return <div key={detail.id} className={styles.partDetailRow}>
        <dt>{condition ? 'Condition' : detail.label}{detail.private ? ' (private)' : ''}:</dt>
        <dd>{detail.value}</dd>
      </div>;
    })}</dl>}
  </>;
}
