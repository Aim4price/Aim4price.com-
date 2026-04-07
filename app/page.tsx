import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

const routes = [
  {
    href: '/valuation',
    image: '/brand/Valuations.png',
    label: 'Value',
    title: 'Valuation',
    text: 'Get a guided machinery value with a clean, direct flow.',
    action: 'Start valuation',
  },
  {
    href: registerHref,
    image: '/brand/Register.png',
    label: 'Manage',
    title: 'Asset Register',
    text: 'Keep equipment values and records in one clear working view.',
    action: 'Open register',
  },
  {
    href: '/marketplace',
    image: '/brand/Buy & Sell.png',
    label: 'Market',
    title: 'Marketplace',
    text: 'Browse machinery and list the right unit when ready to sell.',
    action: 'Open marketplace',
  },
] as const;

const steps = [
  {
    number: '01',
    title: 'Value machinery',
    text: 'Start with a free valuation and get to a useful result quickly.',
  },
  {
    number: '02',
    title: 'Save key assets',
    text: 'Store the machine in your register so it is ready for review.',
  },
  {
    number: '03',
    title: 'List for sale',
    text: 'Send the right machine to marketplace when you are ready to sell.',
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
              <p className={styles.eyebrow}>Agricultural &amp; industrial machinery pricing</p>

              <h1 className={styles.heroTitle}>Know what your machinery is worth.</h1>

              <p className={styles.heroText}>
                Free valuation, asset register, and marketplace tools for clearer machinery
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
                  <div className={styles.heroPill}>Clear, guided flow</div>
                  <Image
                    src="/brand/Home-page.png"
                    alt="Aim4price home preview"
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

      <section className={styles.routesSection}>
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>One clear platform</p>
            <h2 className={styles.sectionTitle}>Choose your route.</h2>
            <p className={styles.sectionText}>
              Start with valuation, then manage records or list for sale.
            </p>
          </div>

          <div className={styles.routesGrid}>
            {routes.map((route, index) => (
              <Link
                key={route.title}
                href={route.href}
                className={styles.routeCard}
                data-index={index + 1}
              >
                <div className={styles.routeTop}>
                  <span className={styles.routeLabel}>{route.label}</span>
                </div>

                <div className={styles.routeIconWrap}>
                  <Image
                    src={route.image}
                    alt={route.title}
                    width={82}
                    height={82}
                    className={styles.routeIcon}
                  />
                </div>

                <h3 className={styles.routeTitle}>{route.title}</h3>
                <p className={styles.routeText}>{route.text}</p>
                <span className={styles.routeAction}>{route.action}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.flowSection}>
        <div className={styles.shellNarrow}>
          <div className={styles.flowPanel}>
            <div className={styles.sectionIntroCompact}>
              <p className={styles.flowEyebrow}>How it works</p>
              <h2 className={styles.flowTitle}>Simple, practical, and easy to follow.</h2>
              <p className={styles.flowText}>
                Start with valuation, save what matters, then list when you are ready to sell.
              </p>
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
            <p className={styles.ctaText}>
              Then save the machine to your asset register when needed.
            </p>

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
    </main>
  );
}
