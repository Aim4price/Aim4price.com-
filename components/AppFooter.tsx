'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  readCachedHeaderSession,
  refreshCachedHeaderSession,
  type HeaderSessionUser,
} from '../lib/header-session-cache';
import styles from './AppFooter.module.css';

const footerContentId = 'aim4price-footer-content';

type FooterLink = {
  href: string;
  label: string;
};

type FooterWorkspace = {
  label: string;
  links: FooterLink[];
};

const publicWorkspace: FooterWorkspace = {
  label: 'Explore',
  links: [
    { href: '/valuation', label: 'Get Estimate' },
    { href: '/drop-invoice', label: 'Drop an Invoice' },
  ],
};

const ownerWorkspace: FooterWorkspace = {
  label: 'Owner tools',
  links: [
    { href: '/asset-register', label: 'Asset Register' },
    { href: '/valuation', label: 'Get Estimate' },
    { href: '/asset-map', label: 'Asset Map' },
    { href: '/my-invoices', label: 'Cost Ledger' },
    { href: '/maintenance', label: 'Maintenance' },
    { href: '/fuel', label: 'Fuel Ledger' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/account', label: 'Account' },
  ],
};

const dealerWorkspace: FooterWorkspace = {
  label: 'Dealer tools',
  links: [
    { href: '/leads', label: 'Leads' },
    { href: '/tracking', label: 'Maintenance' },
    { href: '/dealer-costs', label: 'Client Costs' },
    { href: '/valuation', label: 'Get Estimate' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/account', label: 'Account' },
  ],
};

const financeWorkspace: FooterWorkspace = {
  label: 'Finance tools',
  links: [
    { href: '/leads', label: 'My Leads' },
    { href: '/valuation', label: 'Get Estimate' },
    { href: '/account', label: 'Account' },
  ],
};

const accountantWorkspace: FooterWorkspace = {
  label: 'Accountant tools',
  links: [
    { href: '/leads', label: 'My Clients' },
    { href: '/valuation', label: 'Get Estimate' },
    { href: '/account', label: 'Account' },
  ],
};

const insuranceWorkspace: FooterWorkspace = {
  label: 'Insurance tools',
  links: [
    { href: '/leads', label: 'My Leads' },
    { href: '/shared-registers', label: 'Shared Registers' },
    { href: '/valuation', label: 'Get Estimate' },
    { href: '/account', label: 'Account' },
  ],
};

const companyLinks: FooterLink[] = [
  { href: '/about-us', label: 'About Aim4price' },
  { href: '/contact-us', label: 'Contact Us' },
];

const legalLinks: FooterLink[] = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
];

function getWorkspace(session: HeaderSessionUser | null | undefined): FooterWorkspace {
  if (session?.accountType === 'owner') return ownerWorkspace;
  if (session?.accountType === 'dealer') return dealerWorkspace;
  if (session?.accountType === 'insurance') return insuranceWorkspace;

  if (session?.accountType === 'finance') {
    return session.accountSubtype === 'accountant' ? accountantWorkspace : financeWorkspace;
  }

  return publicWorkspace;
}

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
  const [session, setSession] = useState<HeaderSessionUser | null>();
  const [isExpanded, setIsExpanded] = useState(false);
  const currentYear = new Date().getFullYear();
  const workspace = useMemo(() => getWorkspace(session), [session]);

  useEffect(() => {
    let mounted = true;
    const cachedSession = readCachedHeaderSession();

    if (cachedSession !== undefined) {
      setSession(cachedSession);
    }

    async function loadSession() {
      try {
        const nextSession = await refreshCachedHeaderSession();
        if (mounted) setSession(nextSession);
      } catch {
        if (mounted && cachedSession === undefined) setSession(null);
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (
    pathname?.startsWith('/field-manager') ||
    pathname?.startsWith('/scan') ||
    pathname?.startsWith('/dealer') ||
    pathname?.startsWith('/showroom/') ||
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
                <section className={styles.brandBlock} aria-label="About Aim4price">
                  <Link href="/" className={styles.brandName}>
                    Aim4price
                  </Link>

                  <p className={styles.brandText}>
                    Asset Intelligence, Management &amp; Pricing.
                  </p>

                  <p className={styles.brandSupport}>
                    One secure place to value, manage and share information for South African
                    machinery, vehicles, equipment and property.
                  </p>
                </section>

                <div className={styles.linksGrid}>
                  <nav className={styles.linkColumn} aria-label={`${workspace.label} footer links`}>
                    <h3>{workspace.label}</h3>
                    {workspace.links.map((link) => (
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
                <p>© {currentYear} Aim4price. All rights reserved.</p>
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
