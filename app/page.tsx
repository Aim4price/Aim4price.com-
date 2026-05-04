import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

type WorkflowStep = {
  number: string;
  title: string;
  text: string;
  href: string;
  action: string;
};

const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Start with a free estimate',
    text: 'Select the machinery type, enter the key details, and get a clean estimate output in a guided flow.',
    href: '/valuation',
    action: 'Start estimate',
  },
  {
    number: '02',
    title: 'Save and manage assets',
    text: 'Keep machinery records organised in one place and return whenever you need updated values.',
    href: '/asset-register',
    action: 'Open register',
  },
  {
    number: '03',
    title: 'Move equipment to market',
    text: 'When the time is right, take the next commercial step with more clarity and structure.',
    href: '/marketplace',
    action: 'View marketplace',
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
            poster="/brand/Home-page.png"
          >
            <source src="/brand/AIM4PRICE.mp4" type="video/mp4" />
          </video>

          <div className={styles.heroOverlay} />

          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p
                  className={styles.eyebrow}
                  aria-label="Aim4price.com - Agricultural and industrial machinery pricing"
                >
                  <span className={styles.eyebrowStatic}>AIM4PRICE.COM</span>
                  <span className={styles.eyebrowDivider} aria-hidden="true">
                    —
                  </span>
                  <span className={styles.eyebrowTyping} aria-hidden="true">
                    Agricultural &amp; industrial machinery pricing
                  </span>
                </p>

                <h1 className={styles.heroTitle}>
                  <span className={styles.heroTitleLine}>Know what</span>
                  <span className={styles.heroTitleLine}>machinery</span>
                  <span className={styles.heroTitleLine}>is worth.</span>
                </h1>

                <p className={styles.heroText}>
                  Aim4price helps machinery owners, financiers, insurers and dealers
                  <br className={styles.heroTextBreak} />
                  make confident decisions with estimates, asset records, and marketplace tools
                  built for South Africa.
                </p>

                <div className={styles.heroActions}>
                  <Link href="/valuation" className={styles.primaryCta}>
                    Get free estimate
                  </Link>
                </div>
              </div>

              <div className={styles.heroVisual} aria-hidden="true">
                <div className={styles.heroMarkStage}>
                  <Image
                    src="/brand/aim4price-mark-white.png"
                    alt=""
                    width={640}
                    height={640}
                    priority
                    className={styles.heroLogo}
                  />
                </div>
              </div>
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
                Estimate value, save the asset record, and use the result when you insure,
                finance, sell or manage machinery.
              </p>
            </div>

            <div className={styles.stepsGrid}>
              {workflowSteps.map((step) => (
                <Link key={step.number} href={step.href} className={styles.stepCard}>
                  <div className={styles.stepBadge}>{step.number}</div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                  <span className={styles.stepAction}>{step.action}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
