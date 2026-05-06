'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import styles from './AppFooter.module.css';

const year = new Date().getFullYear();
const footerContentId = 'aim4price-footer-content';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.55 21v-8.2h2.76l.42-3.2h-3.18V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14c-.29-.04-1.3-.14-2.47-.14-2.44 0-4.11 1.49-4.11 4.23V9.6H8v3.2h2.76V21h2.79Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.45 8.39a1.72 1.72 0 1 1 0-3.44 1.72 1.72 0 0 1 0 3.44ZM4.98 20.5h2.95V9.73H4.98V20.5Zm4.8 0h2.95v-5.35c0-1.41.27-2.77 2.01-2.77 1.72 0 1.74 1.61 1.74 2.86v5.26h2.96v-5.86c0-2.88-.62-5.09-3.98-5.09-1.61 0-2.68.88-3.12 1.72h-.04V9.73H9.78c.03 1.01 0 10.77 0 10.77Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.15 3h9.7A4.15 4.15 0 0 1 21 7.15v9.7A4.15 4.15 0 0 1 16.85 21h-9.7A4.15 4.15 0 0 1 3 16.85v-9.7A4.15 4.15 0 0 1 7.15 3Zm-.14 1.8A2.21 2.21 0 0 0 4.8 7.01v9.98c0 1.22.99 2.21 2.21 2.21h9.98c1.22 0 2.21-.99 2.21-2.21V7.01c0-1.22-.99-2.21-2.21-2.21H7.01Zm10.31 1.35a1.03 1.03 0 1 1 0 2.06 1.03 1.03 0 0 1 0-2.06ZM12 7.86A4.14 4.14 0 1 1 7.86 12 4.14 4.14 0 0 1 12 7.86Zm0 1.8A2.34 2.34 0 1 0 14.34 12 2.34 2.34 0 0 0 12 9.66Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 14.25 5.5-5.5 5.5 5.5" />
    </svg>
  );
}

export default function AppFooter() {
  const footerRef = useRef<HTMLElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  function handleFooterToggle() {
    const nextExpanded = !isExpanded;

    setIsExpanded(nextExpanded);

    if (nextExpanded) {
      window.setTimeout(() => {
        footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 120);
    }
  }

  return (
    <footer
      ref={footerRef}
      className={`${styles.footer} ${isExpanded ? styles.footerExpanded : ''}`}
    >
      <div id={footerContentId} className={styles.drawerRegion} aria-hidden={!isExpanded}>
        <div className={styles.drawerInner}>
          <div className={styles.footerPanel}>
            <div className={styles.shell}>
              <div className={styles.topRow}>
                <section className={styles.brandBlock} aria-label="Aim4price footer overview">
                  <span className={styles.brandName}>Aim4price</span>

                  <p className={styles.brandText}>
                    Agricultural and industrial machinery pricing, asset register, and marketplace
                    tools built for clearer decisions.
                  </p>

                  <div className={styles.socialGroup} aria-label="Aim4price social channels">
                    <span className={styles.socialLabel}>Social</span>

                    <div className={styles.socialRow}>
                      <span className={styles.socialIcon} aria-label="Facebook">
                        <FacebookIcon />
                      </span>

                      <span className={styles.socialIcon} aria-label="LinkedIn">
                        <LinkedInIcon />
                      </span>

                      <span className={styles.socialIcon} aria-label="Instagram">
                        <InstagramIcon />
                      </span>
                    </div>
                  </div>
                </section>

                <div className={styles.linksGrid}>
                  <nav className={styles.linkColumn} aria-label="Explore footer links">
                    <h3>Explore</h3>
                    <Link href="/">Home</Link>
                    <Link href="/valuation">Estimate</Link>
                    <Link href="/asset-register">Asset Register</Link>
                    <Link href="/marketplace">Marketplace</Link>
                    <Link href="/account">Account</Link>
                  </nav>

                  <nav className={styles.linkColumn} aria-label="Company footer links">
                    <h3>Company</h3>
                    <Link href="/about-us">About Us</Link>
                    <Link href="/contact-us">Contact Us</Link>
                  </nav>

                  <nav className={styles.linkColumn} aria-label="Legal footer links">
                    <h3>Legal</h3>
                    <Link href="/privacy-policy">Privacy Policy</Link>
                    <Link href="/terms-of-service">Terms of Service</Link>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerDock}>
        <div className={styles.dockShell}>
          <span className={`${styles.metaItem} ${styles.metaCopyright}`}>© {year} Aim4price</span>

          <button
            type="button"
            className={styles.footerToggle}
            aria-label={isExpanded ? 'Collapse footer' : 'Open footer'}
            aria-expanded={isExpanded}
            aria-controls={footerContentId}
            onClick={handleFooterToggle}
          >
            <span className={styles.toggleIcon}>
              <ChevronIcon />
            </span>
          </button>

          <span className={`${styles.metaItem} ${styles.metaNote}`}>
            Indicative estimates should be confirmed for formal insurance, finance, or transactional use.
          </span>
        </div>
      </div>
    </footer>
  );
}
