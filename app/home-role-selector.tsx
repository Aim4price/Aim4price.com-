'use client';

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
          <article className={styles.roleCard} aria-labelledby="role-owner-title">
            <h3 id="role-owner-title">I own or manage assets</h3>
            <p>Farmers, contractors, fleet operators and business owners.</p>
          </article>

          <article className={styles.roleCard} aria-labelledby="role-business-title">
            <h3 id="role-business-title">I sell, service or support assets</h3>
            <p>Dealers, workshops and service providers.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

