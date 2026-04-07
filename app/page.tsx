import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

const platformItems = [
  {
    theme: 'value',
    title: 'Valuation',
    text: 'Free start',
  },
  {
    theme: 'manage',
    title: 'Asset Register',
    text: 'Save key machines',
  },
  {
    theme: 'market',
    title: 'Marketplace',
    text: 'List when ready',
  },
] as const;

const routes = [
  {
    href: '/valuation',
    image: '/brand/Valuations.png',
    theme: 'value',
    label: 'Value',
    title: 'Valuation',
    text: 'Get a guided machinery value with a clean, practical flow.',
    action: 'Start valuation',
  },
  {
    href: registerHref,
    image: '/brand/Register.png',
    theme: 'manage',
    label: 'Manage',
    title: 'Asset Register',
    text: 'Keep important equipment values and records in one working view.',
    action: 'Open register',
  },
  {
    href: '/marketplace',
    image: '/brand/Buy & Sell.png',
    theme: 'market',
    label: 'Market',
    title: 'Marketplace',
    text: 'Browse listings and move the right unit to market when ready.',
    action: 'Open marketplace',
  },
] as const;

const workflowSteps = [
  {
    number: '01',
    href: '/valuation',
    theme: 'value',
    title: 'Get a free valuation',
    text: 'Start with a direct machinery valuation built for fast decisions.',
    action: 'Start Free Valuation',
  },
  {
    number: '02',
    href: registerHref,
    theme: 'manage',
    title: 'Save key assets',
    text: 'Store the right machines in the asset register for easy management.',
    action: 'Open Asset Register',
  },
  {
    number: '03',
    href: '/marketplace',
    theme: 'market',
    title: 'List for sale',
    text: 'Browse or list machinery in marketplace when you are ready to sell.',
    action: 'Open Marketplace',
  },
] as const;

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Agricultural &amp; industrial machinery pricing</p>

              <h1 className={styles.heroTitle}>
                Know what your machinery is worth — then decide what to do next.
              </h1>

              <p className={styles.heroText}>
                Start with a free valuation, save important equipment in the asset register,
                and move the right machine to marketplace when you are ready to sell.
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
                {platformItems.map((item) => (
                  <div key={item.title} className={styles.heroMetaItem} data-theme={item.theme}>
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.heroVisual}>
              <Link href="/valuation" className={styles.heroImageLink} aria-label="Open valuation">
                <div className={styles.heroImageFrame}>
                  <Image
                    src="/brand/Home-page.png"
                    alt="Aim4price platform overview"
                    fill
                    priority
                    sizes="(max-width: 980px) 100vw, 48vw"
                    className={styles.heroImage}
                  />

                  <div className={styles.heroTopBadge}>One platform. Three tools.</div>

                  <div className={styles.heroOverlayStack}>
                    {platformItems.map((item) => (
                      <div key={item.title} className={styles.heroOverlayCard} data-theme={item.theme}>
                        <span className={styles.heroOverlayLabel}>{item.title}</span>
                        <strong>{item.text}</strong>
                      </div>
                    ))}
                  </div>
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
            <h2 className={styles.sectionTitle}>Choose what you want to do next.</h2>
            <p className={styles.sectionText}>
              Each part works on its own, but together they create one clean machinery
              workflow.
            </p>
          </div>

          <div className={styles.routesGrid}>
            {routes.map((route) => (
              <Link
                key={route.title}
                href={route.href}
                className={styles.routeCard}
                data-theme={route.theme}
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

      <section className={styles.workflowSection}>
        <div className={styles.shell}>
          <div className={styles.workflowPanel}>
            <div className={styles.workflowIntro}>
              <p className={styles.workflowEyebrow}>Simple workflow</p>
              <h2 className={styles.workflowTitle}>Simple. Practical. Effective.</h2>
              <p className={styles.workflowText}>
                Start with valuation, then manage, and list your machinery for sale — all in
                one seamless workflow.
              </p>
            </div>

            <div className={styles.stepsGrid}>
              {workflowSteps.map((step) => (
                <div key={step.number} className={styles.stepCard} data-theme={step.theme}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                  <Link href={step.href} className={styles.stepAction}>
                    {step.action}
                  </Link>
                </div>
              ))}
            </div>

            <div className={styles.workflowActions}>
              <Link href="/valuation" className={styles.workflowPrimaryCta}>
                Start Free Valuation
              </Link>
              <Link href={registerHref} className={styles.workflowSecondaryCta}>
                Open Asset Register
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
