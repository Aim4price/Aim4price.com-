import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

const heroHighlights = [
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

const workflowSteps = [
  {
    number: '01',
    href: '/valuation',
    theme: 'value',
    title: 'Get a free valuation',
    text: 'Start with a free and straightforward valuation.',
    action: 'Start Free Valuation',
  },
  {
    number: '02',
    href: registerHref,
    theme: 'manage',
    title: 'Save key assets',
    text: 'Store important equipment in the asset register for easier management.',
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

              <h1 className={styles.heroTitle}>Know what your machinery is worth.</h1>

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

              <div className={styles.heroHighlights} aria-label="Platform sections">
                {heroHighlights.map((item) => (
                  <div
                    key={item.title}
                    className={styles.heroHighlightCard}
                    data-theme={item.theme}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.heroVisual}>
              <Link href="/valuation" className={styles.heroImageLink} aria-label="Open valuation">
                <div className={styles.heroImageFrame}>
                  <div className={styles.heroTopBadge}>One clean platform</div>

                  <Image
                    src="/brand/Home-page.png"
                    alt="Aim4price platform preview"
                    fill
                    priority
                    sizes="(max-width: 980px) 100vw, 48vw"
                    className={styles.heroImage}
                  />

                  <div className={styles.heroInfoCard}>
                    <p className={styles.heroInfoTitle}>Value. Register. Market.</p>
                    <p className={styles.heroInfoText}>
                      Three connected tools for clearer machinery decisions.
                    </p>

                    <span className={styles.heroInfoAction}>Open valuation →</span>
                  </div>
                </div>
              </Link>
            </div>
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
