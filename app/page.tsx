import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

const featureCards = [
  {
    href: '/valuation',
    image: '/brand/Valuations.png',
    label: 'Free',
    title: 'Valuation',
    text: 'Get a fast machinery value with a guided flow.',
    action: 'Open valuation',
  },
  {
    href: registerHref,
    image: '/brand/Register.png',
    label: 'Save',
    title: 'Asset Register',
    text: 'Keep equipment values and records in one place.',
    action: 'Open register',
  },
  {
    href: '/marketplace',
    image: '/brand/Buy & Sell.png',
    label: 'List',
    title: 'Marketplace',
    text: 'Move equipment to market with less friction.',
    action: 'Open marketplace',
  },
] as const;

const audienceCards = [
  {
    title: 'Owners',
    text: 'See what your machinery is worth.',
  },
  {
    title: 'Dealers',
    text: 'Value stock faster and more clearly.',
  },
  {
    title: 'Brokers',
    text: 'Start with cleaner machinery data.',
  },
] as const;

const heroChips = ['Fast valuation', 'Asset register', 'Marketplace'];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>Agricultural &amp; industrial machinery pricing</p>

              <h1 className={styles.heroTitle}>Know what your machinery is worth.</h1>

              <p className={styles.heroText}>Value it. Register it. Move it to market.</p>

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryCta}>
                  Start Free Valuation
                </Link>
                <Link href={registerHref} className={styles.secondaryCta}>
                  Open Asset Register
                </Link>
              </div>

              <div className={styles.heroChips} aria-label="Platform sections">
                {heroChips.map((chip) => (
                  <span key={chip} className={styles.heroChip}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.heroVisual}>
              <Link href="/valuation" className={styles.heroImageLink} aria-label="Open valuation">
                <div className={styles.heroImageFrame}>
                  <div className={styles.heroGlow} />
                  <Image
                    src="/brand/Home-page.png"
                    alt="Aim4price machinery banner"
                    fill
                    priority
                    sizes="(max-width: 980px) 100vw, 48vw"
                    className={styles.heroImage}
                  />
                  <div className={styles.heroImageBadge}>Open valuation</div>
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
            <h2 className={styles.sectionTitle}>Three clear paths.</h2>
          </div>

          <div className={styles.featureGrid}>
            {featureCards.map((card) => (
              <Link key={card.title} href={card.href} className={styles.featureCard}>
                <div className={styles.featureTopRow}>
                  <span className={styles.featureLabel}>{card.label}</span>
                </div>

                <div className={styles.featureIconWrap}>
                  <Image
                    src={card.image}
                    alt={card.title}
                    width={88}
                    height={88}
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

      <section className={styles.audienceSection} id="platform">
        <div className={styles.shellNarrow}>
          <div className={styles.audiencePanel}>
            <div className={styles.audienceIntro}>
              <p className={styles.sectionEyebrow}>Built for</p>
              <h2 className={styles.sectionTitle}>Owners. Dealers. Brokers.</h2>
            </div>

            <div className={styles.audienceGrid}>
              {audienceCards.map((card) => (
                <div key={card.title} className={styles.audienceCard}>
                  <h3 className={styles.audienceTitle}>{card.title}</h3>
                  <p className={styles.audienceText}>{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shellNarrow}>
          <div className={styles.ctaPanel}>
            <p className={styles.sectionEyebrow}>Get started</p>
            <h2 className={styles.ctaTitle}>Open your asset register.</h2>
            <div className={styles.ctaButtons}>
              <Link href={registerHref} className={styles.primaryCta}>
                Open Asset Register
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerRow}>
            <Link href="/" className={styles.footerBrand}>
              <Image src="/brand/aim4price-mark-black.png" alt="Aim4price" width={34} height={28} />
              <span className={styles.footerBrandText}>Aim4price</span>
            </Link>

            <div className={styles.footerLinks}>
              <Link href="/valuation" className={styles.footerLink}>
                Valuation
              </Link>
              <Link href={registerHref} className={styles.footerLink}>
                Asset Register
              </Link>
              <Link href="/marketplace" className={styles.footerLink}>
                Marketplace
              </Link>
            </div>
          </div>

          <p className={styles.copyright}>© 2026 Aim4price. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
