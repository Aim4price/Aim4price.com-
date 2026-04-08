import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

type QuickAction = {
  href: string;
  title: string;
  text: string;
  action: string;
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
    text: 'Get a fast machinery value estimate.',
    action: 'Start Free Valuation',
    primary: true,
  },
  {
    href: '/asset-register',
    title: 'Asset register',
    text: 'Save and manage key machinery in one place.',
    action: 'Open Asset Register',
  },
  {
    href: '/marketplace',
    title: 'Marketplace',
    text: 'Browse or move equipment to market when ready.',
    action: 'Open Marketplace',
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    href: '/valuation',
    title: 'Start with a free valuation',
    text: 'Choose equipment type, enter the core details, and get a clean value output.',
    action: 'Open valuation',
  },
  {
    number: '02',
    href: '/asset-register',
    title: 'Save important assets',
    text: 'Keep machinery records organised and return to them whenever you need to update values.',
    action: 'Open register',
  },
  {
    number: '03',
    href: '/marketplace',
    title: 'Move equipment to market',
    text: 'When you are ready to buy or sell, use the marketplace as the next logical step.',
    action: 'Open marketplace',
  },
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
                  Free valuation, asset register, and marketplace tools built for owners who
                  want clearer machinery decisions backed by practical workflows.
                </p>
              </div>

              <aside className={styles.heroCard}>
                <p className={styles.cardEyebrow}>Quick actions</p>

                <h2 className={styles.cardTitle}>Start with the right next step.</h2>

                <p className={styles.cardText}>
                  Use the free valuation for a quick answer, the asset register for ongoing
                  tracking, and the marketplace when you are ready to move equipment.
                </p>

                <div className={styles.quickActions}>
                  {quickActions.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.quickAction} ${
                        item.primary ? styles.quickActionPrimary : ''
                      }`}
                    >
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
              <p className={styles.workflowEyebrow}>Simple workflow</p>
              <h2 className={styles.workflowTitle}>Simple steps. Clear actions.</h2>
              <p className={styles.workflowText}>
                The home page should immediately show users what to do first, what to do next,
                and where Aim4price becomes useful every day.
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
