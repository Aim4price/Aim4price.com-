import Link from 'next/link';

import AppHeader from '../components/AppHeader';
import { redirectAdminToAdmin } from '../lib/account-access';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AudienceChoice = {
  role: 'Owner' | 'Dealer';
  eyebrow: string;
  text: string;
  action: string;
};

const audienceChoices: AudienceChoice[] = [
  {
    role: 'Owner',
    eyebrow: 'Own or manage assets',
    text: 'Build a clear record of what you own, what it costs and what it is worth.',
    action: 'Continue to signup',
  },
  {
    role: 'Dealer',
    eyebrow: 'Sell or support assets',
    text: 'Value equipment, work with asset owners and keep every opportunity organised.',
    action: 'Continue to signup',
  },
];

function AudienceIcon({ role }: { role: AudienceChoice['role'] }) {
  if (role === 'Owner') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="7.5" r="3.5" />
        <path d="M5.5 20c.4-4 2.55-6.15 6.5-6.15S18.1 16 18.5 20" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 10.25 5.4 4h13.2l1.4 6.25" />
      <path d="M5.25 10.25V20h13.5v-9.75" />
      <path d="M3.5 10.25h17M8.5 20v-5h7v5" />
    </svg>
  );
}

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection} aria-labelledby="home-hero-title">
        <div className={`${styles.shell} ${styles.heroInner}`}>
          <p className={styles.heroEyebrow}>Asset intelligence for South Africa</p>

          <h1 id="home-hero-title" className={styles.heroTitle}>
            <span>Know every asset.</span>
            <span>Understand every value.</span>
          </h1>

          <p className={styles.heroText}>
            Manage, value and share the machinery, vehicles and equipment behind your business.
          </p>

          <div className={styles.heroActions}>
            <Link href="#choose-your-path" className={styles.primaryCta}>
              Find your path
              <span aria-hidden="true">↓</span>
            </Link>
            <Link href="/about-us" className={styles.secondaryCta}>
              Explore the platform
            </Link>
          </div>
        </div>

        <a
          href="#choose-your-path"
          className={styles.scrollCue}
          aria-label="Choose how you use Aim4price"
        >
          <span aria-hidden="true" />
          Choose your starting point
        </a>
      </section>

      <section
        id="choose-your-path"
        className={styles.audienceSection}
        aria-labelledby="audience-title"
      >
        <div className={`${styles.shell} ${styles.audienceInner}`}>
          <div className={styles.audienceHeading}>
            <p className={styles.audienceEyebrow}>Start with your role</p>
            <h2 id="audience-title" className={styles.audienceTitle}>
              Are you an owner or a dealer?
            </h2>
            <p className={styles.audienceText}>
              Choose the workspace that matches how you work with assets.
            </p>
          </div>

          <div className={styles.audienceGrid}>
            {audienceChoices.map((choice) => (
              <Link
                key={choice.role}
                href="/auth#signup"
                className={styles.audienceCard}
                aria-label={`Continue to signup and choose ${choice.role} as your workspace`}
              >
                <span className={styles.audienceIcon}>
                  <AudienceIcon role={choice.role} />
                </span>

                <span className={styles.audienceCopy}>
                  <span className={styles.audienceCardEyebrow}>{choice.eyebrow}</span>
                  <strong>{choice.role}</strong>
                  <span className={styles.audienceCardText}>{choice.text}</span>
                  <span className={styles.audienceAction}>
                    {choice.action}
                    <span aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
