import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

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
    text: 'Keep important machinery in the asset register for easier management.',
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
                Free valuation, asset register, and marketplace tools for clearer machinery
                decisions.
              </p>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroImageFrame}>
                <div className={styles.heroTopBadge}>One clear platform</div>

                <Image
                  src="/brand/Home-page.png"
                  alt="Aim4price agricultural and industrial machinery overview"
                  fill
                  priority
                  sizes="(max-width: 1100px) 100vw, 58vw"
                  className={styles.heroImage}
                />

                <Link href="/valuation" className={styles.heroImageCta}>
                  Start Free Valuation
                </Link>
              </div>
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
                Start with valuation, then manage, then list your machinery for sale — all in one seamless workflow.
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
          </div>
        </div>
      </section>
    </main>
  );
}
