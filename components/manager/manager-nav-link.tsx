import Link from 'next/link';
import styles from './nav-link.module.css';

type ManagerNavLinkProps = {
  href: string;
  label: 'Home' | 'Back';
  tone?: 'default' | 'home';
};

export default function ManagerNavLink({
  href,
  label,
  tone = 'default',
}: ManagerNavLinkProps) {
  return (
    <Link
      data-field-legacy-nav
      className={`${styles.navLink} ${tone === 'home' ? styles.homeLink : ''}`}
      href={href}
      aria-label={label}
    >
      {label === 'Back' ? (
        <span className={styles.arrow} aria-hidden="true">
          ←
        </span>
      ) : null}
      <span>{label}</span>
    </Link>
  );
}
