import styles from './AssetRegisterGuide.module.css';

/** Optional help stays beside the register, without interrupting everyday work. */
export default function AssetRegisterGuide({ empty = false }: { empty?: boolean }) {
  return <details className={`${styles.guide} ${styles.registerGuide}`} open={empty || undefined}>
    <summary className={styles.guideHeader}>
      <span className={styles.headerCopy}><strong>Start here</strong><span>Add an asset. Keep records. See the full picture.</span></span>
      <span className={styles.guideToggle} aria-hidden="true"><span className={styles.showGuide}>Show guide</span><span className={styles.hideGuide}>Hide guide</span></span>
    </summary>
    <div className={styles.body}>
      <ol className={styles.steps}>
        <li><span className={styles.stepNumber} aria-hidden="true">Step 1</span><div><strong>Add one asset</strong><p>Choose <b>Add Asset</b> above. Get an estimate or enter a value you already know.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">Step 2</span><div><strong>Build its history</strong><p>Open <b>Manage</b> on the asset card. Add costs, fuel and maintenance as you go.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">Step 3</span><div><strong>See the full picture</strong><p>Open <b>Reports</b> in Manage to see its value, maintenance and ownership costs.</p></div></li>
      </ol>
      <div className={styles.definitions}>
        <p><strong>Register</strong><span>Your complete list of assets.</span></p>
        <p><strong>Umbrella</strong><span>An optional group, such as a tractor and planter. Each asset keeps its own records.</span></p>
      </div>
    </div>
  </details>;
}
