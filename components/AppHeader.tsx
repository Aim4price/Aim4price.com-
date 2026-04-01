import Image from 'next/image';
import Link from 'next/link';
import styles from './AppHeader.module.css';

type ActivePage = 'home' | 'valuation' | 'asset-register' | 'marketplace';

type AppHeaderProps = {
  active: ActivePage;
  ctaHref?: string;
  ctaLabel?: string;
};

const navItems: Array<{ key: ActivePage; href: string; label: string }> = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'valuation', href: '/valuation', label: 'Valuation' },
];

export default function AppHeader({
  active,
  ctaHref = '/valuation',
  ctaLabel = 'Start valuation',
}: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMarkWrap}>
            <Image src="/brand/aim4price-mark.png" alt="Aim4price" width={44} height={34} priority />
          </span>
          <span className={styles.brandText}>Aim4price</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.navLink} ${active === item.key ? styles.navLinkActive : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href={ctaHref} className={styles.primaryButton}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
