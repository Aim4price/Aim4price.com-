import styles from './AssetChooseIcon.module.css';

/** Shared visual cue for a clickable asset choice; the parent button supplies its name. */
export default function AssetChooseIcon({ selected = false }: { selected?: boolean }) {
  return <span className={styles.tile} aria-hidden="true" data-asset-choose-icon="true">
    <svg className={styles.glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {selected ? <path d="m5 12 4 4 10-10" /> : <><path d="m9 9 4 12 2.5-5.5L21 13 9 9Z" /><path d="M9 3v2M3 9h2M4.8 4.8l1.4 1.4M14 4l-1 2M4 14l2-1" /></>}
    </svg>
  </span>;
}
