import styles from './ItemActionButton.module.css';

export default function ItemActionButton({ action, name, disabled, onClick }: {
  action: 'edit' | 'delete'; name: string; disabled?: boolean; onClick: () => void;
}) {
  const label = `${action === 'edit' ? 'Edit' : 'Delete'} ${name || 'item'}`;
  return <button type="button" className={styles.iconAction} data-action={action} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {action === 'edit' ? <><path d="m15 5 4 4M4 20l4.5-1 12-12a2.83 2.83 0 0 0-4-4l-12 12L4 20Z"/><path d="M4 20h7"/></> : <><path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7"/></>}
    </svg>
  </button>;
}

