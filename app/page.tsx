import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

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

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <Image src="/brand/aim4price-mark-black.png" alt="Aim4price" width={34} height={28} priority />
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
                Agri &amp; Industrial
                <br />
                Machinery Pricing
                <br />
                Made Simple.
              </h1>

              <p className={styles.heroText}>
                Discover your machinery values, build an asset register and buy &amp; sell with confidence -
                all on one easy-to-use platform.
              </p>

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryCta}>
                  Get Started For Free
                </Link>
              </div>

              <p className={styles.heroNote}>
                Trusted by farmers, insurance brokers, and dealers across ZA.
              </p>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroImageFrame}>
                <Image
                  src="/brand/Home-page.png"
                  alt="Aim4price homepage machinery banner"
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
                <Image
                  src="/brand/Valuations.png"
                  alt="Valuations"
                  width={108}
                  height={108}
                  className={styles.featureImage}
                />
              </div>
              <h2 className={styles.featureTitle}>
                Instantly Know Your
                <br />
                Machinery Values
              </h2>
              <p className={styles.featureText}>
                Get accurate, data-driven valuations for your agricultural and industrial equipment.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <Image
                  src="/brand/Register.png"
                  alt="Register"
                  width={108}
                  height={108}
                  className={styles.featureImage}
                />
              </div>
              <h2 className={styles.featureTitle}>
                Manage Your Assets
                <br />
                &amp; Valuations
              </h2>
              <p className={styles.featureText}>
                Build and save asset registers to track, update, and value your equipment over time.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <Image
                  src="/brand/Buy & Sell.png"
                  alt="Buy and Sell"
                  width={108}
                  height={108}
                  className={styles.featureImage}
                />
              </div>
              <h2 className={styles.featureTitle}>
                Easily Buy &amp; Sell
                <br />
                Equipment
              </h2>
              <p className={styles.featureText}>
                Move equipment to the marketplace and connect with vetted buyers and sellers.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.statementSection} id="platform">
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
          <div className={styles.ctaPanel}>
            <h2 className={styles.ctaTitle}>Get started — create an asset register in minutes.</h2>
            <p className={styles.ctaText}>
              Open your account, add your machinery, and keep valuations organised in one place from the start.
            </p>

            <div className={styles.ctaButtons}>
              <Link href="/valuation" className={styles.primaryCta}>
                Sign Up For Free
              </Link>
              <a href="#platform" className={styles.secondaryCta}>
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrandCol}>
              <Link href="/" className={styles.footerBrand}>
                <Image src="/brand/aim4price-mark-black.png" alt="Aim4price" width={36} height={30} />
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
            <p className={styles.copyright}>© 2026 Aim4price. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
