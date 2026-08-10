import Image from 'next/image';
import Link from 'next/link';
import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeHeroVideo from './home-hero-video';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProductStep = {
  number: string;
  title: string;
  text: string;
  href: string;
  action: string;
};

type RolePlayer = {
  role: string;
  text: string;
};

const productSteps: ProductStep[] = [
  {
    number: '01',
    title: 'Estimate the value',
    text: 'Create a structured estimate using the asset details and condition.',
    href: '/valuation',
    action: 'Start estimate',
  },
  {
    number: '02',
    title: 'Create the record',
    text: 'Keep values, photos, documents and QR-linked details together.',
    href: '/asset-register',
    action: 'Open Asset Register',
  },
  {
    number: '03',
    title: 'Manage ownership',
    text: 'Track costs, fuel, maintenance, finance, insurance and licensing.',
    href: '/asset-register',
    action: 'Explore Asset Register',
  },
  {
    number: '04',
    title: 'Work with your team',
    text: 'Give trusted professionals controlled access to the same asset information.',
    href: '#roleplayers',
    action: 'View role players',
  },
];

const rolePlayers: RolePlayer[] = [
  {
    role: 'Dealers',
    text: 'Valuation, servicing and replacement support.',
  },
  {
    role: 'Accountants',
    text: 'Financial records, documents and reports.',
  },
  {
    role: 'Financiers',
    text: 'Asset values, finance agreements and funding needs.',
  },
  {
    role: 'Insurers & brokers',
    text: 'Cover values, schedules and supporting evidence.',
  },
];

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.heroMedia}>
          <HomeHeroVideo />

          <div className={styles.heroOverlay} />

          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.heroEyebrow}>
                  <span>AIM4PRICE.COM</span>
                  <span className={styles.heroEyebrowDivider} aria-hidden="true">
                    |
                  </span>
                  <span>Asset management for South Africa</span>
                </p>

                <h1 className={styles.heroTitle}>
                  <span>Manage every asset.</span>
                  <span>One live system.</span>
                </h1>

                <p className={styles.heroText}>
                  Build detailed records and reports, manage every stage of ownership and
                  collaborate with trusted professionals through one owner-controlled Asset Register.
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

              <Link
                href="/contact-us"
                className={styles.heroVisual}
                aria-label="Contact Aim4price"
              >
                <Image
                  src="/brand/aim4price-mark-white.png"
                  alt="Aim4price"
                  width={640}
                  height={640}
                  priority
                  className={styles.heroLogo}
                />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.productSection}>
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>What Aim4price does</p>
            <h2 className={styles.sectionTitle}>From estimate to a complete asset record.</h2>
            <p className={styles.sectionText}>
              Create the record once, then keep it useful throughout ownership.
            </p>
          </div>

          <div className={styles.productGrid}>
            {productSteps.map((step) => (
              <Link key={step.number} href={step.href} className={styles.productCard}>
                <span className={styles.productNumber}>{step.number}</span>
                <h3 className={styles.productTitle}>{step.title}</h3>
                <p className={styles.productText}>{step.text}</p>
                <span className={styles.productAction}>{step.action}</span>
              </Link>
            ))}
          </div>

          <div className={styles.marketPrompt}>
            <div>
              <p className={styles.marketLabel}>Explore the market</p>
              <p className={styles.marketText}>Browse listings and owner-authorised opportunities.</p>
            </div>
            <Link href="/marketplace" className={styles.marketLink}>
              View Marketplace
            </Link>
          </div>
        </div>
      </section>

      <section id="roleplayers" className={styles.rolesSection}>
        <div className={styles.shell}>
          <div className={styles.rolesPanel}>
            <div className={styles.rolesHeading}>
              <p className={styles.rolesEyebrow}>One system, clear roles</p>
              <h2 className={styles.rolesTitle}>
                <span className={styles.rolesTitleLine}>
                  The owner controls the Asset Register.
                </span>
                <span className={styles.rolesTitleLine}>Every role can contribute.</span>
              </h2>
              <p className={styles.rolesText}>
                Trusted professionals contribute only where relevant.
              </p>
            </div>

            <div className={styles.collaborationMap}>
              <article className={styles.ownerHub}>
                <p className={styles.ownerHubEyebrow}>Owner controlled</p>
                <h3 className={styles.ownerHubTitle}>One Asset Register</h3>
                <p className={styles.ownerHubText}>
                  The owner sees the full record and controls who can access or update it.
                </p>
              </article>

              <div className={styles.partnerGrid}>
                {rolePlayers.map((player) => (
                  <article key={player.role} className={styles.partnerCard}>
                    <h3 className={styles.partnerTitle}>{player.role}</h3>
                    <p className={styles.partnerText}>{player.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className={styles.rolesFooter}>
              <div>
                <p className={styles.rolesFooterLabel}>Start with one asset</p>
                <p className={styles.rolesFooterText}>
                  Create the first record, then keep building the register.
                </p>
              </div>
              <div className={styles.rolesActions}>
                <Link href="/valuation" className={styles.lightCta}>
                  Get free estimate
                </Link>
                <Link href="/auth#signup" className={styles.outlineCta}>
                  Create free account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

