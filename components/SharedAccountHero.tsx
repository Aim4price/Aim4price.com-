import Link from 'next/link';
import hero from '../app/drop-invoice/page.module.css';
import styles from '../app/business/page.module.css';

export default function SharedAccountHero({count}:{count:number}) {
 return <section className={`${hero.heroSection} ${styles.accountHero}`} aria-labelledby="shared-account-title">
  <div className={hero.heroOverlay} aria-hidden="true"/>
  <div className={`${hero.shell} ${hero.heroGrid}`}>
   <div className={hero.heroCopy}>
    <span className={styles.accountBadge}>Free sharing account</span>
    <h1 id="shared-account-title" className={hero.heroTitle}><span>Shared assets.</span><span>Ready when you are.</span></h1>
    <p className={hero.heroText}>Open the assets shared with you.<br/>View the latest information and make permitted updates.</p>
    <div className={hero.heroTrust}><span className={hero.heroTrustIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/></svg></span><span><strong>Owner-controlled access.</strong> The sender chooses what you can view or update.</span></div>
   </div>
   <Link href="#received-enquiries" className={`${hero.heroUploadAction} ${styles.heroLink}`}>
    <span className={hero.heroUploadIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4m8-4v4m-7 8 2 2 4-4"/></svg></span>
    <span className={hero.heroUploadLabel}>View enquiries</span>
    <span className={hero.heroUploadHint}>{count ? `${count} shared ${count===1?'enquiry':'enquiries'}` : 'Your shared assets appear here'}</span>
   </Link>
  </div>
 </section>;
}
