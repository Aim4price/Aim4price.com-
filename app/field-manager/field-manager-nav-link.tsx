import Link from 'next/link';
import styles from './field-manager-nav-link.module.css';

type FieldManagerNavLinkProps = {
  href: string;
  label: 'Home' | 'Back';
  tone?: 'default' | 'home';
};

export default function FieldManagerNavLink({
  href,
  label,
  tone = 'default',
}: FieldManagerNavLinkProps) {
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
