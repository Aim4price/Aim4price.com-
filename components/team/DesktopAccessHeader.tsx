'use client';
import Link from 'next/link';
import styles from '../AppHeader.module.css';
import BackgroundToggle from '../BackgroundToggle';

/** Same application header surfaces. Owner-only destinations are deliberately not links. */
export default function DesktopAccessHeader({ onSignOut, accountHref = '/team/access' }: { onSignOut: () => void; accountHref?: string }) {
  return <header className={styles.header}><div className={styles.inner}>
    <Link href="/asset-register" className={styles.brand} aria-label="Aim4price asset register"><img src="/brand/aim4price-mark-black.png" alt="Aim4price" className={styles.headerBrandLogo}/></Link>
    <div className={styles.zoomHost} data-website-zoom-host="ready"/>
    <nav className={styles.nav} aria-label="Primary navigation"><div className={styles.navRail}><div className={styles.navViewport}>
      {['Home','Value Asset','Asset Register','Marketplace','Maintenance','Fuel Ledger','Documents'].map(label => label === 'Asset Register'
        ? <Link key={label} href="/asset-register" className={`${styles.navLink} ${styles.navLinkActive}`} aria-current="page">{label}</Link>
        : <button key={label} type="button" className={styles.navLink} disabled title={label === 'Maintenance' || label === 'Documents' ? 'Open an asset for the records you have permission to use.' : 'Managed by the account holder.'} style={{opacity:.45,cursor:'not-allowed'}}>{label}</button>)}
      <Link href={accountHref} className={styles.navLink}>Account</Link>
    </div></div></nav>
    <div className={styles.actions}><div className={styles.actionsRail}>
      <BackgroundToggle className={`${styles.notificationButton} ${styles.themeToggle}`} iconClassName={styles.notificationIcon}/>
      <button type="button" className={styles.navLink} onClick={onSignOut}>Sign out</button>
    </div></div>
  </div></header>;
}
