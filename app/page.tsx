import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

type HeroAction = {
  href: string;
  label: string;
};

type WorkflowStep = {
  number: string;
  title: string;
  text: string;
};

const heroActions: HeroAction[] = [
  {
    href: '/valuation',
    label: 'Free valuation',
  },
  {
    href: '/asset-register',
    label: 'Asset register',
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Start with a free valuation',
    text: 'Select the machinery type, enter the core details, and get a clean value output.',
  },
  {
    number: '02',
    title: 'Save and manage assets',
    text: 'Keep machinery records organised in one place and return whenever you need updated values.',
  },
  {
    number: '03',
    title: 'Move equipment to market',
    text: 'When the time is right, move from internal records to active buying or selling.',
  },
];

const heroPoints = ['Free valuation', 'Asset register', 'Marketplace tools'];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.heroMedia}>
          <video
            className={styles.heroVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          >
            <source src="/brand/AIM4PRICE.mp4" type="video/mp4" />
          </video>

          <div className={styles.heroOverlay} />

          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>Agricultural &amp; industrial machinery pricing</p>

                <h1 className={styles.heroTitle}>Know what your machinery is worth.</h1>

                <p className={styles.heroText}>
                  Professional tools for valuing equipment, managing machinery records, and
                  taking the next commercial step with more clarity.
                </p>

                <div className={styles.heroMeta}>
                  {heroPoints.map((point) => (
                    <span key={point} className={styles.heroMetaItem}>
                      {point}
                    </span>
                  ))}
                </div>
              </div>

              <aside className={styles.heroVisual} aria-label="Aim4price platform shortcuts">
                <div className={styles.heroLogoWrap}>
                  <div className={styles.heroLogoGlow} />
                  <Image
                    src="/brand/aim4price-mark-white.png"
                    alt="Aim4price mark"
                    width={660}
                    height={515}
                    priority
                    className={styles.heroLogo}
                  />
                </div>

                <div className={styles.heroActions}>
                  {heroActions.map((item) => (
                    <Link key={item.href} href={item.href} className={styles.heroActionLink}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.shell}>
          <div className={styles.workflowWrap}>
            <div className={styles.workflowIntro}>
              <p className={styles.workflowEyebrow}>How Aim4price works</p>
              <h2 className={styles.workflowTitle}>A clean path from value to action.</h2>
              <p className={styles.workflowText}>
                Users should understand the platform in seconds: value machinery, save records,
                then move to market when the time is right.
              </p>
            </div>

            <div className={styles.stepsGrid}>
              {workflowSteps.map((step) => (
                <div key={step.number} className={styles.stepCard}>
                  <div className={styles.stepBadge}>{step.number}</div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
