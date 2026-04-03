import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './AppHeader.module.css';

type ActivePage = 'home' | 'valuation' | 'asset-register' | 'marketplace';

type AppHeaderProps = {
  active: ActivePage;
  signupHref?: string;
  loginHref?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

const navItems: Array<{ key: ActivePage; href: string; label: string }> = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'valuation', href: '/valuation', label: 'Valuation' },
  { key: 'asset-register', href: '/asset-register', label: 'Asset Register' },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
];

function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children?: ReactNode;
}) {
  const isAnchorLike =
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:');

  if (isAnchorLike) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function AppHeader({
  active,
  signupHref = '#',
  loginHref = '#',
  ctaHref,
  ctaLabel = 'Create Account',
}: AppHeaderProps) {
  const primaryHref = ctaHref ?? signupHref;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Go to Aim4price home">
          <Image
            src="/brand/aim4price-mark-black.png"
            alt="Aim4price"
            width={34}
            height={28}
            priority
            className={styles.brandImage}
          />

          <span className={styles.brandCopy}>
            <span className={styles.brandTitle}>Aim4price</span>
            <span className={styles.brandSubtext}>Value, register, market</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <div className={styles.navRail}>
            {navItems.map((item) => {
              const isActive = active === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={styles.actions}>
          <SmartLink href={primaryHref} className={styles.signupButton}>
            {ctaLabel}
          </SmartLink>

          <SmartLink href={loginHref} className={styles.loginButton}>
            Login
          </SmartLink>
        </div>
      </div>
    </header>
  );
}
