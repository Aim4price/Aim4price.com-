import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/register';

const featureCards = [
  {
    href: '/valuation',
    image: '/brand/Valuations.png',
    title: 'Instant machinery valuations',
    text: 'Get fast, data-driven equipment values with a clean guided flow.',
    action: 'Open valuations',
  },
  {
    href: registerHref,
    image: '/brand/Register.png',
    title: 'Build your asset register',
    text: 'Save machinery, organise values, and keep your equipment records in one place.',
    action: 'Open register',
  },
  {
    href: '/marketplace',
    image: '/brand/Buy & Sell.png',
    title: 'Move equipment to marketplace',
    text: 'List machinery and connect with serious buyers and sellers more easily.',
    action: 'Open marketplace',
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>Agricultural &amp; industrial machinery pricing</p>

              <h1 className={styles.heroTitle}>
                Agri &amp; Industrial
                <br />
                Machinery Pricing
                <br />
                <span className={styles.heroAccent}>Made Simple.</span>
              </h1>

              <p className={styles.heroText}>
                Discover machinery values, build an asset register, and move equipment to the
                marketplace from one clean, easy-to-use platform.
              </p>

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryCta}>
                  Start Free Valuation
                </Link>
                <Link href={registerHref} className={styles.secondaryCta}>
                  Create Account
                </Link>
              </div>

              <p className={styles.heroNote}>
                Built for owners, dealers, and brokers who need faster machinery decisions.
              </p>
            </div>

            <div className={styles.heroVisual}>
              <Link href="/valuation" className={styles.heroImageLink} aria-label="Open valuations">
                <div className={styles.heroImageFrame}>
                  <div className={styles.heroGlow} />
                  <div className={styles.heroImageMotion}>
                    <Image
                      src="/brand/Home-page.png"
                      alt="Aim4price homepage machinery banner"
                      fill
                      priority
                      sizes="(max-width: 980px) 100vw, 48vw"
                      className={styles.heroImage}
                    />
                  </div>
                  <div className={styles.heroImageBadge}>Open valuations</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>Choose a section</p>
            <h2 className={styles.sectionTitle}>Open the part of Aim4price you need.</h2>
            <p className={styles.sectionText}>
              Each card below is clickable and opens the correct part of the platform.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {featureCards.map((card) => (
              <Link key={card.title} href={card.href} className={styles.featureCard}>
                <div className={styles.featureIconCircle}>
                  <Image
                    src={card.image}
                    alt={card.title}
                    width={108}
                    height={108}
                    className={styles.featureImage}
                  />
                </div>

                <h3 className={styles.featureTitle}>{card.title}</h3>
                <p className={styles.featureText}>{card.text}</p>
                <span className={styles.featureAction}>{card.action}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.statementSection} id="platform">
        <div className={styles.shellNarrow}>
          <div className={styles.statementRow}>
            <div>
              <p className={styles.sectionEyebrow}>Why Aim4price</p>
              <h2 className={styles.statementTitle}>
                Built for machinery owners wanting to know their machinery values.
              </h2>
            </div>

            <p className={styles.statementText}>
              Aim4price helps users value equipment faster, organise machinery in an asset
              register, and move the right units to market with clearer, more usable data.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shellNarrow}>
          <div className={styles.ctaPanel}>
            <h2 className={styles.ctaTitle}>Create your asset register.</h2>
            <p className={styles.ctaText}>
              Open your account, add your equipment, and keep valuations organised in one place.
            </p>

            <div className={styles.ctaButtons}>
              <Link href={registerHref} className={styles.primaryCta}>
                Create Your Free Account
              </Link>
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

              <p className={styles.footerBlurb}>
                Agricultural and industrial machinery pricing built on clearer, more usable data.
              </p>
            </div>

            <div className={styles.footerLinks}>
              <div className={styles.footerColumn}>
                <h3 className={styles.footerHeading}>Platform</h3>
                <Link href="/valuation" className={styles.footerLink}>
                  Valuation
                </Link>
                <Link href="/marketplace" className={styles.footerLink}>
                  Marketplace
                </Link>
                <Link href={registerHref} className={styles.footerLink}>
                  Register
                </Link>
              </div>

              <div className={styles.footerColumn}>
                <h3 className={styles.footerHeading}>Browse</h3>
                <Link href="/" className={styles.footerLink}>
                  Home
                </Link>
                <a href="#platform" className={styles.footerLink}>
                  Why Aim4price
                </a>
              </div>
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
