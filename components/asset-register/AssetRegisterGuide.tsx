import styles from './AssetRegisterGuide.module.css';

/** Optional help stays beside the register, without interrupting everyday work. */
export default function AssetRegisterGuide({ empty = false }: { empty?: boolean }) {
  return <details className={`${styles.guide} ${styles.registerGuide}`} open={empty || undefined}>
    <summary className={styles.guideHeader}>
      <span className={styles.guideMark} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span>
      <span className={styles.headerCopy}><strong>Start here</strong><span>Your asset register in three simple steps</span></span>
      <span className={styles.guideToggle} aria-hidden="true"><span className={styles.showGuide}>Show guide</span><span className={styles.hideGuide}>Hide guide</span></span>
    </summary>
    <div className={styles.body}>
      <ol className={styles.steps}>
        <li><span className={styles.stepNumber} aria-hidden="true">1</span><div><strong>Add one asset</strong><p>Select <b>Add Asset</b>, get an estimate or enter your own value, then save.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">2</span><div><strong>Build its history</strong><p>Select <b>Manage</b> on the asset card to add costs, fuel and maintenance.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">3</span><div><strong>See the result</strong><p>Select <b>Reports</b> under <b>Manage</b> to review values, maintenance and ownership costs.</p></div></li>
      </ol>
      <div className={styles.definitions}>
        <p><strong>Register</strong><span>Your complete list of assets, such as all the equipment on your farm.</span></p>
        <p><strong>Umbrella</strong><span>An optional group within your register, such as a tractor and planter. Each asset keeps its own records.</span></p>
      </div>
      <p className={styles.guideFootnote}>Start with one asset. Grouping is optional. Your reports grow as you add records.</p>
    </div>
  </details>;
}
