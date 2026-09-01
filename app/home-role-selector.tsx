'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

const ROLE_SECTION_HASH = '#choose-role';

export default function HomeRoleSelector() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const syncVisibilityWithHash = () => {
      setIsVisible(window.location.hash === ROLE_SECTION_HASH);
    };

    syncVisibilityWithHash();
    window.addEventListener('hashchange', syncVisibilityWithHash);

    return () => window.removeEventListener('hashchange', syncVisibilityWithHash);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      });
      headingRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
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
          Which best describes you?
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
