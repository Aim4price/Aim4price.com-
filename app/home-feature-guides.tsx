import Link from 'next/link';
import styles from './home-feature-guides.module.css';

export default function HomeFeatureGuides() {
  return <section className={styles.section} aria-labelledby="working-together-title">
    <header><h2 id="working-together-title">Put your records to work.</h2><p>From one invoice to a useful history. Explore what you can do next.</p></header>
    <div className={styles.grid}>
      <article><span className={styles.label}>Sharing</span><h3>Give the right person the right access.</h3><p>Share an asset with a mechanic, insurer or adviser. You choose the records they can see and the actions they can take.</p><details><summary>See a simple example</summary><p>Share a tractor with your mechanic, choose the relevant maintenance permissions, then review the completed work in its history. Check the recipient and permissions before sending, and revoke access when it is no longer needed.</p><Link href="/asset-register">Open your register →</Link></details></article>
      <article><span className={styles.label}>Business accounts</span><h3>Record a cost for a customer.</h3><p>When an owner shares an asset with permission to add costs, your business can upload the invoice against that asset.</p><Link href="/auth?accountType=business&offer=free#signup">Create a free Business account →</Link></article>
      <article><span className={styles.label}>Reports</span><h3>Turn saved records into a clear picture.</h3><p>Use reports to review an asset’s costs, fuel, maintenance and value. Open an asset, choose Manage, then Reports.</p><details><summary>What a report can show</summary><dl><div><dt>Costs</dt><dd>Recorded spending linked to the asset</dd></div><div><dt>Maintenance</dt><dd>Completed work and scheduled tasks</dd></div><div><dt>Fuel</dt><dd>Recorded fuel use and supporting entries</dd></div></dl><p>Available reports depend on the asset and your access. Review missing records and date ranges before sharing a report.</p><Link href="/asset-register">Explore your asset reports →</Link></details></article>
      <article><span className={styles.label}>AI Connections</span><h3>Ask questions about your records.</h3><p>Connect a supported AI assistant from your account, review the requested access, and use plain language to explore your saved information.</p><details><summary>Try a useful question</summary><blockquote>“Which of my assets have maintenance due?”</blockquote><p>Check the answer against the saved records. Manage or disconnect authorised connections from Account → AI Connections.</p><Link href="/account/ai-connect">View AI Connections →</Link></details></article>
    </div>
  </section>;
}
