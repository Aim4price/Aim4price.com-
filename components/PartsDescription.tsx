import styles from '../app/dealer/parts/parts.module.css';

type Detail = { id: string; label: string; value: string; private?: boolean };

/** Shared presentation for each list's already-authorized detail fields. */
export default function PartsDescription({ description, details }: { description?: string; details: Detail[] }) {
  const visible = details.filter(detail => detail.value?.trim());
  return <>
    <strong className={styles.partName}>{description || '—'}</strong>
    {!!visible.length && <div className={styles.partExtraDetails}>{visible.map(detail => {
      const condition = detail.id === 'condition' || detail.label.toLowerCase() === 'condition';
      return condition
        ? <span key={detail.id} className={styles.conditionBadge} data-condition={detail.value.trim().toLowerCase()} aria-label={`Condition${detail.private ? ' (private)' : ''}: ${detail.value}`}>{detail.value}{detail.private ? ' (private)' : ''}</span>
        : <span key={detail.id}><strong>{detail.label}{detail.private ? ' (private)' : ''}:</strong> {detail.value}</span>;
    })}</div>}
  </>;
}
