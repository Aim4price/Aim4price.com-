import styles from './AssetRegisterGuide.module.css';

/** Optional help stays beside the register, without interrupting everyday work. */
export default function AssetRegisterGuide({ empty = false }: { empty?: boolean }) {
  return <details className={`${styles.guide} ${styles.registerGuide}`} open={empty || undefined}>
    <summary className={styles.guideHeader}>
      <span className={styles.guideMark} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span>
      <span className={styles.headerCopy}><strong>Start here</strong><span>Your asset register in three simple steps</span></span>
      <svg className={styles.chevron} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 5 7 7-7 7"/></svg>
    </summary>
    <div className={styles.body}>
      <ol className={styles.steps}>
        <li><span className={styles.stepNumber} aria-hidden="true">1</span><div><strong>Add one asset</strong><p>Choose <b>Add Asset</b>. Get an estimate or enter a value you already have, then save it.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">2</span><div><strong>Build its history</strong><p>Choose <b>Manage</b> on the asset card to record costs, fuel and maintenance.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">3</span><div><strong>See the result</strong><p>Open <b>Manage → Reports</b> to review its value, maintenance and ownership costs.</p></div></li>
      </ol>
      <div className={styles.definitions}>
        <p><strong>Register</strong><span>Your list of assets, for example a farm’s equipment.</span></p>
        <p><strong>Umbrella</strong><span>A group of related assets, such as a tractor and planter. Each keeps its own records.</span></p>
      </div>
      <p className={styles.guideFootnote}>Start with one asset. Grouping is optional, and reports become more useful as you add records.</p>
    </div>
  </details>;
}
