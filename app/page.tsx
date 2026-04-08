import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

type QuickAction = {
  href: string;
  title: string;
  text: string;
  action: string;
  note: string;
  primary?: boolean;
};

type WorkflowStep = {
  number: string;
  href: string;
  title: string;
  text: string;
  action: string;
};

const quickActions: QuickAction[] = [
  {
    href: '/valuation',
    title: 'Free valuation',
    text: 'Get a fast machinery value estimate in a clean guided flow.',
    action: 'Start free valuation',
    note: 'Recommended first step',
    primary: true,
  },
  {
    href: '/asset-register',
    title: 'Asset register',
    text: 'Store important machinery records and return anytime to update values.',
    action: 'Open asset register',
    note: 'Track and organise assets',
  },
  {
    href: '/marketplace',
    title: 'Marketplace',
    text: 'Move equipment to market when you are ready to buy or sell.',
    action: 'Open marketplace',
    note: 'Take the next commercial step',
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    href: '/valuation',
    title: 'Start with a free valuation',
    text: 'Select the machinery type, enter the core details, and get a clean value output.',
    action: 'Open valuation',
  },
  {
    number: '02',
    href: '/asset-register',
    title: 'Save and manage assets',
    text: 'Keep machinery records organised in one place and return whenever you need updated values.',
    action: 'Open asset register',
  },
  {
    number: '03',
    href: '/marketplace',
    title: 'Move equipment to market',
    text: 'When the time is right, move from internal records to active buying or selling.',
    action: 'Open marketplace',
  },
];

const heroPoints = [
  'Free valuation',
  'Asset register',
  'Marketplace tools',
];

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
                <div className={styles.heroBrand}>
                  <Image
                    src="/brand/aim4price-mark-white.png"
                    alt="Aim4price logo"
                    width={58}
                    height={58}
                    priority
                    className={styles.heroBrandMark}
                  />
                  <span className={styles.heroBrandName}>Aim4price</span>
                </div>

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

              <aside className={styles.heroCard}>
                <p className={styles.cardEyebrow}>Start here</p>

                <h2 className={styles.cardTitle}>Choose your next action.</h2>

                <p className={styles.cardText}>
                  Most users should start with a free valuation, then save key machinery to the
                  asset register or move equipment to market when ready.
                </p>

                <p className={styles.cardSupport}>Clear workflow. Immediate next steps.</p>

                <div className={styles.quickActions}>
                  {quickActions.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.quickAction} ${
                        item.primary ? styles.quickActionPrimary : ''
                      }`}
                    >
                      <span className={styles.quickActionMeta}>{item.note}</span>

                      <span className={styles.quickActionTop}>
                        <span className={styles.quickActionTitle}>{item.title}</span>
                        <span className={styles.quickActionArrow}>→</span>
                      </span>

                      <span className={styles.quickActionText}>{item.text}</span>
                      <span className={styles.quickActionButton}>{item.action}</span>
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
              <p className={styles.workflowEyebrow}>How it works</p>
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
