import Image from 'next/image';
import Link from 'next/link';
import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
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
    title: 'Get an estimate',
    text: 'Start with a guided estimate built around the important details of the asset.',
    href: '/valuation',
    action: 'Get free estimate',
  },
  {
    number: '02',
    title: 'Build the register',
    text: 'Save values, photos, documents and QR-linked information in one asset record.',
    href: '/asset-register',
    action: 'Open Asset Register',
  },
  {
    number: '03',
    title: 'Manage the asset',
    text: 'Track costs, fuel, maintenance, finance and insurance throughout its lifecycle.',
    href: '/asset-register',
    action: 'Explore the tools',
  },
  {
    number: '04',
    title: 'Work together',
    text: 'Give trusted professionals controlled access when their help is needed.',
    href: '#roleplayers',
    action: 'See who it helps',
  },
];

const rolePlayers: RolePlayer[] = [
  {
    role: 'Owners',
    text: 'Stay clear on values, costs, finance and what needs attention.',
  },
  {
    role: 'Dealers',
    text: 'Provide better service, maintenance and replacement support.',
  },
  {
    role: 'Accountants',
    text: 'Maintain clearer records and provide stronger financial advice.',
  },
  {
    role: 'Financiers',
    text: 'Review better-prepared asset and funding information.',
  },
  {
    role: 'Insurers and brokers',
    text: 'Improve cover, renewals and claims preparation.',
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
                <p className={styles.heroEyebrow}>
                  <span>AIM4PRICE.COM</span>
                  <span className={styles.heroEyebrowDivider} aria-hidden="true">
                    |
                  </span>
                  <span>Asset management</span>
                </p>

                <h1 className={styles.heroTitle}>
                  <span>Know your assets.</span>
                  <span>Manage them better.</span>
                </h1>

                <p className={styles.heroText}>
                  Estimate, record and manage machinery, vehicles, property and equipment in one
                  Asset Register.
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
      </section>

      <section className={styles.productSection}>
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>What Aim4price does</p>
            <h2 className={styles.sectionTitle}>From estimate to one clear Asset Register.</h2>
            <p className={styles.sectionText}>
              Keep the important information around every asset organised and ready when you need
              it.
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
              <p className={styles.marketLabel}>Ready for the next step?</p>
              <p className={styles.marketText}>
                Explore available assets and market opportunities.
              </p>
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
              <p className={styles.rolesEyebrow}>Who Aim4price helps</p>
              <h2 className={styles.rolesTitle}>
                One Asset Register. The right people around it.
              </h2>
              <p className={styles.rolesText}>
                Owners remain in control while trusted professionals work from a clearer asset
                record.
              </p>
            </div>

            <div className={styles.rolesGrid}>
              {rolePlayers.map((player) => (
                <article key={player.role} className={styles.roleCard}>
                  <h3 className={styles.roleTitle}>{player.role}</h3>
                  <p className={styles.roleText}>{player.text}</p>
                </article>
              ))}
            </div>

            <div className={styles.rolesFooter}>
              <div>
                <p className={styles.rolesFooterLabel}>Start with one asset</p>
                <p className={styles.rolesFooterText}>
                  Get an estimate, save the record and build from there.
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
