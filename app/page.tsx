import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.featureSvg}>
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.featureSvg}>
      <rect x="6" y="5" width="12" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9" y="3" width="6" height="4" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 11H15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 15H13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.featureSvg}>
      <path
        d="M4 9.5L6 5H18L20 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9.5H19V18.5C19 19.3284 18.3284 20 17.5 20H6.5C5.67157 20 5 19.3284 5 18.5V9.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 20V14H15V20" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.socialSvg}>
      <path
        d="M13.2 20V12.8H15.5L15.9 10.1H13.2V8.4C13.2 7.62 13.43 7.08 14.55 7.08H16V4.67C15.75 4.64 14.9 4.56 13.9 4.56C11.82 4.56 10.4 5.83 10.4 8.16V10.1H8.2V12.8H10.4V20H13.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.socialSvg}>
      <path
        d="M7.35 8.55C6.42 8.55 5.84 7.92 5.84 7.12C5.84 6.31 6.43 5.69 7.38 5.69C8.33 5.69 8.89 6.31 8.91 7.12C8.91 7.92 8.33 8.55 7.35 8.55ZM6.07 18.5V9.93H8.63V18.5H6.07ZM10.24 18.5V9.93H12.69V11.1H12.72C13.06 10.46 13.89 9.75 15.3 9.75C18.24 9.75 18.78 11.69 18.78 14.2V18.5H16.22V14.49C16.22 13.54 16.2 12.32 14.89 12.32C13.56 12.32 13.35 13.36 13.35 14.42V18.5H10.24Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.socialSvg}>
      <path
        d="M18.9 7.25C18.39 7.48 17.85 7.63 17.28 7.7C17.87 7.35 18.33 6.8 18.54 6.15C17.99 6.48 17.37 6.72 16.71 6.85C16.19 6.29 15.45 5.95 14.64 5.95C13.08 5.95 11.82 7.21 11.82 8.77C11.82 8.99 11.85 9.2 11.89 9.4C9.54 9.28 7.44 8.17 6.05 6.48C5.81 6.9 5.67 7.39 5.67 7.92C5.67 8.92 6.18 9.8 6.96 10.32C6.5 10.31 6.08 10.18 5.72 9.98V10.02C5.72 11.42 6.72 12.58 8.04 12.84C7.8 12.9 7.55 12.94 7.28 12.94C7.1 12.94 6.93 12.92 6.76 12.89C7.11 14 8.15 14.81 9.38 14.83C8.42 15.58 7.21 16.03 5.9 16.03C5.67 16.03 5.44 16.02 5.22 15.99C6.46 16.79 7.94 17.25 9.53 17.25C14.63 17.25 17.42 13.03 17.42 9.37C17.42 9.25 17.42 9.12 17.41 9C17.95 8.61 18.42 8.12 18.9 7.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <Image src="/brand/aim4price-mark.png" alt="Aim4price" width={34} height={28} priority />
            <span className={styles.brandText}>Aim4price</span>
          </Link>

          <nav className={styles.nav} aria-label="Primary navigation">
            <Link href="/" className={`${styles.navLink} ${styles.navLinkActive}`}>
              Home
            </Link>
            <Link href="/valuation" className={styles.navLink}>
              Valuation
            </Link>
            <span className={styles.navLinkMuted}>Asset Register</span>
            <span className={styles.navLinkMuted}>Marketplace</span>
          </nav>

          <div className={styles.headerActions}>
            <a href="#" className={styles.signupButton}>
              Sign Up
            </a>
            <a href="#" className={styles.loginButton}>
              Login
            </a>
          </div>
        </div>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1 className={styles.heroTitle}>
                Agricultural &amp; Industrial
                <br />
                Machinery Pricing
                <br />
                Made Simple.
              </h1>

              <p className={styles.heroText}>
                Build asset registers, determine true machinery values,
                <br />
                and buy or sell with confidence —
                <br />
                all on one easy-to-use platform.
              </p>

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryCta}>
                  Get Started For Free
                </Link>
              </div>

              <p className={styles.heroNote}>
                Trusted by farmers, contractors, and dealers across South Africa
              </p>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroImageFrame}>
                <Image
                  src="/images/hero-tractor.png"
                  alt="Green tractor in a field"
                  fill
                  priority
                  sizes="(max-width: 980px) 100vw, 48vw"
                  className={styles.heroImage}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.shell}>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <SearchIcon />
              </div>
              <h2 className={styles.featureTitle}>
                Instantly Know Your
                <br />
                Machinery Values
              </h2>
              <p className={styles.featureText}>
                Get accurate, data-driven valuations
                <br />
                for your agricultural and industrial
                <br />
                equipment.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <ClipboardIcon />
              </div>
              <h2 className={styles.featureTitle}>
                Manage Your Assets
                <br />
                &amp; Valuations
              </h2>
              <p className={styles.featureText}>
                Build and save asset registers to track,
                <br />
                update, and value your equipment
                <br />
                over time.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <StoreIcon />
              </div>
              <h2 className={styles.featureTitle}>
                Easily Buy &amp; Sell
                <br />
                Equipment
              </h2>
              <p className={styles.featureText}>
                Move equipment to the marketplace
                <br />
                and connect with vetted buyers
                <br />
                and sellers.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.statementSection}>
        <div className={styles.shellNarrow}>
          <h2 className={styles.statementTitle}>
            Built for owners wanting to know their machinery values.
            <br />
            Built on provable data.
          </h2>
          <p className={styles.statementText}>
            Aim4price is a one-stop platform for agricultural and industrial equipment pricing. Build and manage
            your asset register, get instant, data-driven valuations, and easily move your equipment to the
            marketplace based on provable data.
          </p>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shellNarrow}>
          <h2 className={styles.ctaTitle}>Get started in minutes — join Aim4price today!</h2>

          <div className={styles.ctaButtons}>
            <Link href="/valuation" className={styles.primaryCta}>
              Sign Up For Free
            </Link>
            <a href="#" className={styles.secondaryCta}>
              Learn More
            </a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrandCol}>
              <Link href="/" className={styles.footerBrand}>
                <Image src="/brand/aim4price-mark.png" alt="Aim4price" width={36} height={30} />
                <span className={styles.footerBrandText}>Aim4price</span>
              </Link>
            </div>

            <div className={styles.footerLinks}>
              <div>
                <h3 className={styles.footerHeading}>Company</h3>
                <a href="#" className={styles.footerLink}>
                  About Us
                </a>
                <a href="#" className={styles.footerLink}>
                  Pricing
                </a>
                <a href="#" className={styles.footerLink}>
                  Contact Us
                </a>
              </div>

              <div>
                <h3 className={styles.footerHeading}>Resources</h3>
                <a href="#" className={styles.footerLink}>
                  Valuation Guide
                </a>
                <a href="#" className={styles.footerLink}>
                  Marketplace
                </a>
              </div>

              <div>
                <h3 className={styles.footerHeading}>Legal</h3>
                <a href="#" className={styles.footerLink}>
                  Privacy Policy
                </a>
                <a href="#" className={styles.footerLink}>
                  Terms of Service
                </a>
              </div>
            </div>

            <div className={styles.footerRight}>
              <div className={styles.socialRow}>
                <a href="#" className={styles.socialButton} aria-label="Facebook">
                  <FacebookIcon />
                </a>
                <a href="#" className={styles.socialButton} aria-label="LinkedIn">
                  <LinkedInIcon />
                </a>
                <a href="#" className={styles.socialButton} aria-label="Twitter">
                  <TwitterIcon />
                </a>
              </div>

              <p className={styles.footerMade}>
                Made with <span aria-hidden="true">💚</span> by Aim4price <span className={styles.dot}>•</span> in South
                Africa
              </p>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div className={styles.shell}>
            <p className={styles.copyright}>© 2024 Aim4price. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
