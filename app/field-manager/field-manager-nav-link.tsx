import Link from 'next/link';
import styles from './field-manager-nav-link.module.css';

type FieldManagerNavLinkProps = {
  href: string;
  label: 'Home' | 'Back';
};

export default function FieldManagerNavLink({ href, label }: FieldManagerNavLinkProps) {
  return (
    <Link className={styles.navLink} href={href} aria-label={label}>
      <span className={styles.arrow} aria-hidden="true">
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}
