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
          <Link
            href="/auth?accountType=owner#signup"
            className={styles.roleCard}
            aria-label="Continue as someone who owns or manages assets"
          >
            <span>
              <strong>I own or manage assets</strong>
              <small>Farmers, contractors, fleet operators and business owners.</small>
            </span>
            <span className={styles.roleArrow} aria-hidden="true">
              →
            </span>
          </Link>

          <Link
            href="/auth?accountType=dealer#signup"
            className={styles.roleCard}
            aria-label="Continue as someone who sells, services or supports assets"
          >
            <span>
              <strong>I sell, service or support assets</strong>
              <small>Dealers, workshops and service providers.</small>
            </span>
            <span className={styles.roleArrow} aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
