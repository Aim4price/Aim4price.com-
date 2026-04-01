import Image from 'next/image';
import Link from 'next/link';
import styles from './AppHeader.module.css';

type ActivePage = 'home' | 'valuation' | 'asset-register' | 'marketplace';

type AppHeaderProps = {
  active: ActivePage;
  signupHref?: string;
  loginHref?: string;
};

const navItems: Array<{ key: ActivePage; href: string; label: string }> = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'valuation', href: '/valuation', label: 'Valuation' },
  { key: 'asset-register', href: '/asset-register', label: 'Asset Register' },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
];

export default function AppHeader({
  active,
  signupHref = '#',
  loginHref = '#',
}: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMarkWrap}>
            <Image
              src="/brand/aim4price-mark-black.png"
              alt="Aim4price"
              width={34}
              height={28}
              priority
            />
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
          <a href={signupHref} className={styles.signupButton}>
            Sign Up
          </a>
          <a href={loginHref} className={styles.loginButton}>
            Login
          </a>
        </div>
      </div>
    </header>
  );
}
