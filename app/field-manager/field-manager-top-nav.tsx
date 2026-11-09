'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function FieldManagerTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/field-manager/login') return null;
  const fallback = pathname.startsWith('/field-manager/assets/') ? '/field-manager/assets'
    : pathname.startsWith('/field-manager/diesel/') ? '/field-manager/diesel' : '/field-manager';
  function back() {
    if (window.history.length > 1) router.back();
    else router.replace(fallback);
  }
  return <header className={styles.persistentTopNav} aria-label="Field Manager navigation">
    <button type="button" onClick={back} aria-label="Back">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7" /></svg><span>Back</span>
    </button>
    <Link href="/field-manager" prefetch={false} aria-label="Field Manager home">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" /></svg><span>Home</span>
    </Link>
  </header>;
}
