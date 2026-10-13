import styles from './AssetRegisterGuide.module.css';

/** Optional help stays beside the register, without interrupting everyday work. */
export default function AssetRegisterGuide({ empty = false }: { empty?: boolean }) {
  return <details className={styles.guide} open={empty || undefined}>
    <summary>Start here · how your asset register works</summary>
    <div className={styles.body}>
      <ol className={styles.steps}>
        <li><strong>Add one asset</strong><p>Choose Add Asset. Get an Aim4price estimate or enter a value you already have, then save it to your register.</p></li>
        <li><strong>Build its history</strong><p>On the asset card, choose Manage to record a cost, add fuel or capture maintenance.</p></li>
        <li><strong>See the result</strong><p>Choose Manage → Reports to review its value, maintenance or ownership costs. Reports become more useful as you add records.</p></li>
      </ol>
      <p><strong>Register:</strong> a list of assets for a business or part of your operation. <strong>Umbrella:</strong> related assets grouped together, such as a tractor and its implements. Each asset keeps its own records.</p>
      <p>For example: Farm register → Planting equipment umbrella → Tractor and planter. Grouping is optional; you can start with one asset.</p>
    </div>
  </details>;
}
