import Image from 'next/image';
import Link from 'next/link';
import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkflowStep = {
  number: string;
  title: string;
  text: string;
  href: string;
  action: string;
};

type FeatureItem = {
  number: string;
  title: string;
  text: string;
};

type RolePlayer = {
  role: string;
  position: string;
  text: string;
};

const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Get a clear estimate',
    text: 'Select the asset type, enter the important details, and receive a structured Aim4price estimate.',
    href: '/valuation',
    action: 'Get free estimate',
  },
  {
    number: '02',
    title: 'Build your Asset Register',
    text: 'Save machinery, vehicles, property and equipment with photos, documents, values and important information.',
    href: '/asset-register',
    action: 'Explore Asset Register',
  },
  {
    number: '03',
    title: 'Manage the complete record',
    text: 'Track costs, fuel, maintenance, finance, insurance, licensing, condition and supporting documents.',
    href: '#features',
    action: 'See what you can manage',
  },
  {
    number: '04',
    title: 'Work with trusted professionals',
    text: 'Give trusted specialists controlled access to help maintain, understand and improve the asset record.',
    href: '#roleplayers',
    action: 'See who uses Aim4price',
  },
];

const featureItems: FeatureItem[] = [
  {
    number: '01',
    title: 'Estimates and values',
    text: 'Create structured estimates and return to the asset when updated value information is needed.',
  },
  {
    number: '02',
    title: 'Photos and documents',
    text: 'Keep invoices, ownership documents, photos and other evidence connected to the right asset.',
  },
  {
    number: '03',
    title: 'QR asset identity',
    text: 'Use a QR-linked record to identify the asset and reach the information connected to it.',
  },
  {
    number: '04',
    title: 'Costs and fuel',
    text: 'Build a clearer view of invoices, fuel activity and the ongoing cost of ownership.',
  },
  {
    number: '05',
    title: 'Maintenance and service',
    text: 'Record maintenance history, service activity, condition and upcoming work.',
  },
  {
    number: '06',
    title: 'Finance and accounting',
    text: 'Keep finance agreements, accounting information and supporting records closer to the asset.',
  },
  {
    number: '07',
    title: 'Insurance records',
    text: 'Organise policy information, insured values, schedules, photos and supporting evidence.',
  },
  {
    number: '08',
    title: 'Discovery and Marketplace',
    text: 'Explore owner-authorised opportunities and take the next market step when the time is right.',
  },
];

const rolePlayers: RolePlayer[] = [
  {
    role: 'Owners',
    position: 'Control the Asset Register',
    text: 'Understand what you own, what it is worth, what it costs, what is financed and what needs attention.',
  },
  {
    role: 'Dealers',
    position: 'Support the asset lifecycle',
    text: 'Use estimates, maintenance, cost and market information to provide more relevant service and replacement support.',
  },
  {
    role: 'Accountants',
    position: 'Strengthen financial clarity',
    text: 'Help clients maintain asset information, understand finance commitments and receive better asset-specific advice.',
  },
  {
    role: 'Financiers',
    position: 'Support capital decisions',
    text: 'Work from better-prepared asset information when discussing funding, refinancing and capital requirements.',
  },
  {
    role: 'Insurers and brokers',
    position: 'Protect the operation',
    text: 'Use authorised schedules, values, photos and evidence to improve cover discussions, renewals and claims preparation.',
  },
];

export default async function HomePage() {
  await redirectAdminToAdmin();

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
                  aria-label="Aim4price.com - Asset management built for South Africa"
                >
                  <span className={styles.eyebrowStatic}>AIM4PRICE.COM</span>
                  <span className={styles.eyebrowDivider} aria-hidden="true">
                    |
                  </span>
                  <span className={styles.eyebrowTyping} aria-hidden="true">
                    Asset management built for South Africa
                  </span>
                </p>

                <h1 className={styles.heroTitle}>
                  <span className={styles.heroTitleLine}>Know your assets.</span>
                  <span className={styles.heroTitleLine}>Know their value.</span>
                  <span className={styles.heroTitleLine}>Manage what happens next.</span>
                </h1>

                <p className={styles.heroText}>
                  Aim4price helps South African owners build a living Asset Register, track values,
                  documents, costs, maintenance, finance and insurance, and work with trusted
                  professionals from one place.
                </p>

                <div className={styles.heroActions}>
                  <Link href="/valuation" className={styles.primaryCta}>
                    Get free estimate
                  </Link>
                  <Link href="/asset-register" className={styles.secondaryCta}>
                    Create Asset Register
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
              <p className={styles.workflowEyebrow}>From estimate to asset management</p>
              <h2 className={styles.workflowTitle}>A clearer record throughout the asset lifecycle</h2>
              <p className={styles.workflowText}>
                Start with an estimate, save the asset, and continue building a record that supports
                the decisions and professionals around it.
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

      <section id="features" className={styles.featuresSection}>
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>More than an estimate</p>
            <h2 className={styles.sectionTitle}>Everything connected to one asset record</h2>
            <p className={styles.sectionText}>
              Aim4price brings the operational, financial and market information surrounding an
              asset into one organised record.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {featureItems.map((feature) => (
              <article key={feature.number} className={styles.featureCard}>
                <span className={styles.featureNumber}>{feature.number}</span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureText}>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="roleplayers" className={styles.rolesSection}>
        <div className={styles.shell}>
          <div className={styles.rolesWrap}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionEyebrow}>One system, different positions</p>
              <h2 className={styles.sectionTitle}>Asset management is a team effort</h2>
              <p className={styles.sectionText}>
                Aim4price gives owners and trusted professionals a clearer way to work around the
                same assets, while the owner remains in control.
              </p>
            </div>

            <div className={styles.rolesGrid}>
              {rolePlayers.map((player, index) => (
                <article key={player.role} className={styles.roleCard}>
                  <span className={styles.roleIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <p className={styles.rolePosition}>{player.position}</p>
                  <h3 className={styles.roleTitle}>{player.role}</h3>
                  <p className={styles.roleText}>{player.text}</p>
                </article>
              ))}
            </div>

            <p className={styles.rolesFootnote}>
              As the platform grows, the wider ecosystem can also include auctioneers, licence
              experts, importers and other specialists involved throughout the asset lifecycle.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.controlSection}>
        <div className={styles.shell}>
          <div className={styles.controlPanel}>
            <div className={styles.controlCopy}>
              <p className={styles.controlEyebrow}>Owner-controlled collaboration</p>
              <h2 className={styles.controlTitle}>Your assets. Your team. Your control.</h2>
              <p className={styles.controlText}>
                Owners decide who can access an Asset Register, what information they can see and
                how they may contribute. Aim4price keeps the asset record connected while giving
                each role access only to what is relevant.
              </p>
            </div>

            <div className={styles.controlPoints}>
              <span>Permission-based access</span>
              <span>Role-specific visibility</span>
              <span>Owner approval where required</span>
              <span>Clear contribution history</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.marketSection}>
        <div className={styles.shell}>
          <div className={styles.marketPanel}>
            <div className={styles.marketCopy}>
              <p className={styles.sectionEyebrow}>Discovery and Marketplace</p>
              <h2 className={styles.marketTitle}>When the time is right, take the next market step</h2>
              <p className={styles.marketText}>
                Explore owner-authorised opportunities, understand what is available and move an
                asset toward its next transaction with more clarity.
              </p>
            </div>

            <div className={styles.marketActions}>
              <Link href="/auth#signup" className={styles.marketSecondaryAction}>
                Create free account
              </Link>
              <Link href="/marketplace" className={styles.marketPrimaryAction}>
                View Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className={styles.shell}>
          <div className={styles.finalPanel}>
            <p className={styles.finalEyebrow}>Start with one asset</p>
            <h2 className={styles.finalTitle}>Build a clearer picture of your operation.</h2>
            <p className={styles.finalText}>
              Get an estimate, save the asset and continue building the Asset Register your
              operation can work from.
            </p>
            <div className={styles.finalActions}>
              <Link href="/valuation" className={styles.primaryCta}>
                Get free estimate
              </Link>
              <Link href="/auth#signup" className={styles.finalSecondaryAction}>
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
