'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import styles from './AppFooter.module.css';

const footerContentId = 'aim4price-footer-content';

const toolLinks = [
  { href: '/', label: 'Home' },
  { href: '/valuation', label: 'Get Estimate' },
  { href: '/asset-register', label: 'Asset Registers' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/account', label: 'My Account' },
];

const companyLinks = [
  { href: '/about-us', label: 'About Aim4price' },
  { href: '/contact-us', label: 'Contact Us' },
];

const legalLinks = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
];

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 14.25 5.5-5.5 5.5 5.5" />
    </svg>
  );
}

export default function AppFooter() {
  const pathname = usePathname();
  const footerRef = useRef<HTMLElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const currentYear = new Date().getFullYear();

  if (
    pathname?.startsWith('/field-manager') ||
    pathname?.startsWith('/scan') ||
    pathname?.startsWith('/dealer') ||
    pathname?.startsWith('/account/dealer-app') ||
    pathname?.startsWith('/account/owner-app') ||
    pathname === '/owner-app' ||
    pathname?.startsWith('/owner-app/')
  ) {
    return null;
  }

  function handleFooterToggle() {
    const nextExpanded = !isExpanded;

    setIsExpanded(nextExpanded);

    if (nextExpanded) {
      window.setTimeout(() => {
        footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 140);
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
                  <span className={styles.brandEyebrow}>Asset management for South Africa</span>
                  <span className={styles.brandName}>Aim4price</span>

                  <p className={styles.brandText}>
                    Aim4price brings asset management, detailed reports and trusted professionals
                    together around one owner-controlled Asset Register.
                  </p>

                  <p className={styles.brandSupport}>
                    Built for machinery, vehicles, equipment and property across South African
                    operations.
                  </p>

                  <div className={styles.trustRow} aria-label="Aim4price platform principles">
                    <span>Owner-controlled records</span>
                    <span>Permission-based collaboration</span>
                  </div>
                </section>

                <div className={styles.linksGrid}>
                  <nav className={styles.linkColumn} aria-label="Aim4price tools footer links">
                    <h3>Tools</h3>
                    {toolLinks.map((link) => (
                      <Link key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </nav>

                  <nav className={styles.linkColumn} aria-label="Company footer links">
                    <h3>Company</h3>
                    {companyLinks.map((link) => (
                      <Link key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </nav>

                  <nav className={styles.linkColumn} aria-label="Legal footer links">
                    <h3>Legal</h3>
                    {legalLinks.map((link) => (
                      <Link key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </div>
              </div>

              <div className={styles.bottomRow}>
                <p>
                  © {currentYear} Aim4price. One clear asset record, with the right people around it.
                </p>
                <p className={styles.rights}>All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerDock}>
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
      </div>
    </footer>
  );
}
