import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

const routes = [
  {
    href: '/valuation',
    image: '/brand/Valuations.png',
    tone: 'value',
    label: 'Value',
    title: 'Valuation',
    text: 'Get a guided machinery value with a clean, direct flow.',
    action: 'Start valuation',
  },
  {
    href: registerHref,
    image: '/brand/Register.png',
    tone: 'manage',
    label: 'Manage',
    title: 'Asset Register',
    text: 'Store key machines, values, and records in one clear working view.',
    action: 'Open register',
  },
  {
    href: '/marketplace',
    image: '/brand/Buy & Sell.png',
    tone: 'market',
    label: 'Market',
    title: 'Marketplace',
    text: 'Browse machinery and list the right unit when you are ready to sell.',
    action: 'Open marketplace',
  },
] as const;

const steps = [
  {
    number: '01',
    title: 'Get a free valuation',
    text: 'Start with a fast machinery value so you know where the machine stands.',
  },
  {
    number: '02',
    title: 'Save key assets',
    text: 'Move the right machines into your register for cleaner record keeping.',
  },
  {
    number: '03',
    title: 'List for sale',
    text: 'Take the next step into marketplace when the timing makes sense.',
  },
] as const;

const heroMeta = [
  { label: 'Free valuation', tone: 'value' },
  { label: 'Cleaner records', tone: 'manage' },
  { label: 'Marketplace ready', tone: 'market' },
] as const;

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Agricultural &amp; industrial machinery platform</p>

              <h1 className={styles.heroTitle}>
                Value machinery.
                <span className={styles.heroTitleAccent}> Manage records.</span>
                <span className={styles.heroTitleMuted}> List with confidence.</span>
              </h1>

              <p className={styles.heroText}>
                Aim4price keeps valuation, asset register, and marketplace tools in one
                practical working flow.
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
                  <span key={item.label} className={styles.heroMetaItem} data-tone={item.tone}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.heroVisual}>
              <Link href="/valuation" className={styles.heroImageLink} aria-label="Open valuation">
                <div className={styles.heroImageFrame}>
                  <div className={styles.heroPill} data-tone="value">
                    Guided valuation flow
                  </div>
                  <div className={styles.heroPillStack}>
                    <span className={styles.heroMiniPill} data-tone="manage">
                      Asset register ready
                    </span>
                    <span className={styles.heroMiniPill} data-tone="market">
                      Marketplace next
                    </span>
                  </div>
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
            <h2 className={styles.sectionTitle}>Choose the route you need next.</h2>
            <p className={styles.sectionText}>
              Each section works on its own, but the real strength is the flow between them.
            </p>
          </div>

          <div className={styles.routesGrid}>
            {routes.map((route) => (
              <Link
                key={route.title}
                href={route.href}
                className={styles.routeCard}
                data-tone={route.tone}
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

      <section className={styles.journeySection}>
        <div className={styles.shell}>
          <div className={styles.journeyPanel}>
            <div className={styles.sectionIntroCompact}>
              <p className={styles.flowEyebrow}>How it works</p>
              <h2 className={styles.flowTitle}>Simple. Practical. Effective.</h2>
              <p className={styles.flowText}>
                Start with valuation, save what matters, then move the right machine to market.
              </p>
            </div>

            <div className={styles.stepsGrid}>
              {steps.map((step, index) => (
                <div key={step.number} className={styles.stepCard} data-tone={routes[index]?.tone}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              ))}
            </div>

            <div className={styles.journeyFooter}>
              <p className={styles.journeyText}>
                Start with a free valuation, then open the asset register when you want to keep
                the machine in your working set.
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
        </div>
      </section>
    </main>
  );
}
