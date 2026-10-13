'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import styles from './page.module.css';

const ROLE_SECTION_HASH = '#choose-role';

export default function HomeRoleSelector() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    let frame: number | null = null;

    const focusHeadingWhenTargeted = () => {
      if (window.location.hash !== ROLE_SECTION_HASH) return;

      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        headingRef.current?.focus({ preventScroll: true });
      });
    };

    focusHeadingWhenTargeted();
    window.addEventListener('hashchange', focusHeadingWhenTargeted);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', focusHeadingWhenTargeted);
    };
  }, []);

  return (
    <section
      id="choose-role"
      className={styles.roleSection}
      aria-labelledby="choose-role-title"
    >
      <div className={styles.shell}>
        <h2
          ref={headingRef}
          id="choose-role-title"
          className={styles.roleTitle}
          tabIndex={-1}
        >
          Which describes you best?
        </h2>

        <div className={styles.roleGrid}>
          <article className={styles.roleCard}>
            <h3>Owner</h3>
            <p>For farms, companies and individuals managing their own assets, costs and maintenance.</p>
            <Link href="/pricing" className={styles.rolePricing} aria-label="See Owner pricing">See pricing</Link>
            <Link href="/pricing" className={styles.roleAction}>Find my package</Link>
          </article>
          <article className={styles.roleCard}>
            <h3>Dealer</h3>
            <p>For dealerships managing stock, client registers and asset enquiries.</p>
            <Link href="/pricing" className={styles.rolePricing} aria-label="See Dealer pricing">See pricing</Link>
            <Link href="/pricing" className={styles.roleAction}>Find my package</Link>
          </article>
          <article className={styles.roleCard}>
            <h3>Business</h3>
            <p>For service providers, such as repairers, insurers and financiers, working with assets shared by clients.</p>
            <Link href="/pricing" className={styles.rolePricing} aria-label="See Business pricing">See pricing</Link>
            <Link href="/pricing" className={styles.roleAction}>Find my package</Link>
          </article>
        </div>
      </div>
    </section>
  );
}
