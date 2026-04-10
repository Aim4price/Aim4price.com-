import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

type HeroAction = {
  href: string;
  label: string;
  title: string;
  primary?: boolean;
};

type WorkflowStep = {
  number: string;
  title: string;
  text: string;
  note: string;
  featured?: boolean;
};

const heroActions: HeroAction[] = [
  {
    href: '/valuation',
    label: 'Recommended start',
    title: 'Free valuation',
    primary: true,
  },
  {
    href: '/asset-register',
    label: 'Then organise',
    title: 'Asset register',
  },
  {
    href: '/marketplace',
    label: 'When ready',
    title: 'Marketplace',
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Start with a free valuation',
    text: 'Begin with the fastest decision point. Enter the machinery details and get a clean value output before doing anything else.',
    note: 'Best first move',
    featured: true,
  },
  {
    number: '02',
    title: 'Save the asset and return later',
    text: 'Once a machine matters, move it into the asset register so the value, history, and future updates stay organised.',
    note: 'Operational step',
  },
  {
    number: '03',
    title: 'Move to market when timing is right',
    text: 'Only after the value is clear and the record is structured should the user take the commercial step into the marketplace.',
    note: 'Commercial step',
  },
];

const pathItems = ['Value first', 'Save second', 'Sell or source third'];

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
                  Start with valuation. Then save key machinery into the asset register and
                  move to market only when you are ready. The entire homepage should point the
                  user to the first step immediately.
                </p>

                <div className={styles.heroCtas}>
                  <Link href="/valuation" className={styles.primaryCta}>
                    Start free valuation
                  </Link>

                  <Link href="#workflow" className={styles.secondaryCta}>
                    See the path
                  </Link>
                </div>

                <div className={styles.pathRail}>
                  <p className={styles.pathLabel}>Recommended flow</p>

                  <div className={styles.pathItems}>
                    {pathItems.map((item, index) => (
                      <div key={item} className={styles.pathItem}>
                        <span className={styles.pathNumber}>0{index + 1}</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className={styles.heroVisual}>
                <div className={styles.logoStage}>
                  <div className={styles.logoGlow} />
                  <Image
                    src="/brand/aim4price-mark-white.png"
                    alt="Aim4price mark"
                    width={420}
                    height={420}
                    priority
                    className={styles.heroLogo}
                  />
                </div>

                <div className={styles.heroActionsWrap}>
                  <div className={styles.heroActionsHeader}>
                    <p className={styles.heroActionsEyebrow}>Quick start</p>
                    <p className={styles.heroActionsText}>
                      The first click should usually be valuation.
                    </p>
                  </div>

                  <div className={styles.heroActions}>
                    {heroActions.map((action) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        className={`${styles.heroAction} ${
                          action.primary ? styles.heroActionPrimary : ''
                        }`}
                      >
                        <span className={styles.heroActionLabel}>{action.label}</span>
                        <span className={styles.heroActionTitle}>{action.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className={styles.workflowSection}>
        <div className={styles.shell}>
          <div className={styles.workflowWrap}>
            <div className={styles.workflowIntro}>
              <p className={styles.workflowEyebrow}>How Aim4price should guide users</p>
              <h2 className={styles.workflowTitle}>A cleaner route into valuation.</h2>
              <p className={styles.workflowText}>
                The page should feel premium, but also obvious. The user should understand in
                seconds that valuation is the entry point, with the register and marketplace
                following after that.
              </p>
            </div>

            <div className={styles.stepsGrid}>
              {workflowSteps.map((step) => (
                <div
                  key={step.number}
                  className={`${styles.stepCard} ${step.featured ? styles.stepCardFeatured : ''}`}
                >
                  <div className={styles.stepTop}>
                    <div className={styles.stepBadge}>{step.number}</div>
                    <p className={styles.stepNote}>{step.note}</p>
                  </div>

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
