import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

const featureCards = [
  {
    href: '/valuation',
    image: '/brand/Valuations.png',
    label: 'Fast',
    title: 'Valuation',
    text: 'Get a guided machinery value, quickly.',
    action: 'Start valuation',
  },
  {
    href: registerHref,
    image: '/brand/Register.png',
    label: 'Save',
    title: 'Asset Register',
    text: 'Keep machinery values and records in one place.',
    action: 'Open register',
  },
  {
    href: '/marketplace',
    image: '/brand/Buy & Sell.png',
    label: 'Move',
    title: 'Marketplace',
    text: 'Take the right machines to market faster.',
    action: 'Open marketplace',
  },
] as const;

const steps = [
  {
    number: '01',
    title: 'Value',
    text: 'Choose the machine and get a clean estimate.',
  },
  {
    number: '02',
    title: 'Save',
    text: 'Store the machine in your asset register.',
  },
  {
    number: '03',
    title: 'Move',
    text: 'List the right unit when you are ready.',
  },
] as const;

const heroMeta = ['Free valuation', 'Asset register', 'Marketplace'];

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

              <p className={styles.heroText}>
                Free valuation, asset register, and marketplace tools for faster machinery
                decisions.
              </p>

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryCta}>
                  Start Free Valuation
                </Link>
                <Link href={registerHref} className={styles.secondaryCta}>
                  Open Asset Register
                </Link>
              </div>

              <div className={styles.heroMeta} aria-label="Platform sections">
                {heroMeta.map((item) => (
                  <span key={item} className={styles.heroMetaItem}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.heroVisual}>
              <Link href="/valuation" className={styles.heroImageLink} aria-label="Open valuation">
                <div className={styles.heroImageFrame}>
                  <div className={styles.heroGlow} />
                  <div className={styles.heroPill}>Clear, guided flow</div>

                  <Image
                    src="/brand/Home-page.png"
                    alt="Aim4price machinery homepage banner"
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
            <p className={styles.sectionText}>Open exactly what you need.</p>
          </div>

          <div className={styles.featureGrid}>
            {featureCards.map((card) => (
              <Link key={card.title} href={card.href} className={styles.featureCard}>
                <div className={styles.featureTop}>
                  <span className={styles.featureLabel}>{card.label}</span>
                </div>

                <div className={styles.featureImageWrap}>
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

      <section className={styles.stepsSection} id="platform">
        <div className={styles.shellNarrow}>
          <div className={styles.stepsPanel}>
            <div className={styles.sectionIntro}>
              <p className={styles.sectionEyebrow}>How it works</p>
              <h2 className={styles.sectionTitle}>Simple by design.</h2>
              <p className={styles.sectionText}>Very little noise. Just the core workflow.</p>
            </div>

            <div className={styles.stepsGrid}>
              {steps.map((step) => (
                <div key={step.number} className={styles.stepCard}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shellNarrow}>
          <div className={styles.ctaPanel}>
            <p className={styles.ctaEyebrow}>Get started</p>
            <h2 className={styles.ctaTitle}>Start with a free valuation.</h2>
            <p className={styles.ctaText}>Then save the machine to your asset register.</p>

            <div className={styles.ctaButtons}>
              <Link href="/valuation" className={styles.ctaPrimary}>
                Start Free Valuation
              </Link>
              <Link href={registerHref} className={styles.ctaSecondary}>
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
