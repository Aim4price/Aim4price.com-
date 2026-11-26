import styles from './ContourCardSurface.module.css';

/** Place before the card's media and content so previews can cover the finish. */
export default function ContourCardSurface() {
  return <span aria-hidden="true" className={styles.surface} />;
}
