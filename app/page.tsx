import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

type WorkflowStep = {
  number: string;
  title: string;
  text: string;
};

const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Start with a free valuation',
    text: 'Select the machinery type, enter the key details, and get a clean value output in a guided flow.',
  },
  {
    number: '02',
    title: 'Save and manage assets',
    text: 'Keep machinery records organised in one place and return whenever you need updated values.',
  },
  {
    number: '03',
    title: 'Move equipment to market',
    text: 'When the time is right, take the next commercial step with more clarity and structure.',
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
                <p className={styles.eyebrow}>Agricultural &amp; industrial machinery pricing</p>

                <h1 className={styles.heroTitle}>
                  <span className={styles.heroTitleLine}>Know</span>
                  <span className={styles.heroTitleLine}>what your</span>
                  <span className={styles.heroTitleLine}>machinery</span>
                  <span className={styles.heroTitleLine}>is worth.</span>
                </h1>

                <p className={styles.heroText}>
                  <span className={styles.heroTextLine}>
                    Professional tools for valuing equipment, managing machinery records,
                  </span>
                  <span className={styles.heroTextLine}>
                    and taking the next commercial step with more clarity.
                  </span>
                </p>

                <div className={styles.heroActions}>
                  <Link href="/valuation" className={styles.primaryCta}>
                    Get free valuation
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
