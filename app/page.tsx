import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

type AudienceCard = {
  title: string;
  text: string;
  href: string;
  image: string;
  accent: 'navy' | 'teal' | 'blue';
};

type ToolIconName = 'estimate' | 'register' | 'marketplace';

type ToolCard = {
  title: string;
  text: string;
  href: string;
  icon: ToolIconName;
  iconClassName: 'iconBlue' | 'iconTeal' | 'iconIndigo';
  label: string;
};

type TrustIconName = 'security' | 'flag' | 'lock';

type TrustItem = {
  title: string;
  text: string;
  icon: TrustIconName;
};

const audienceCards: AudienceCard[] = [
  {
    title: 'Machinery Owner',
    text: 'Get accurate estimates, manage your assets, and unlock better opportunities.',
    href: '/valuation',
    image: '/brand/homepage/Machinery_owner.png',
    accent: 'navy',
  },
  {
    title: 'Financial Institution',
    text: 'Assess risk with reliable data and comprehensive asset insights.',
    href: '/valuation',
    image: '/brand/homepage/Financials.png',
    accent: 'teal',
  },
  {
    title: 'Dealer',
    text: 'List, value, and connect with serious buyers and sellers.',
    href: '/marketplace',
    image: '/brand/homepage/Dealers.png',
    accent: 'blue',
  },
];

const toolCards: ToolCard[] = [
  {
    title: 'Get Estimate',
    text: 'Instant, data-driven estimates for thousands of machinery makes and models.',
    href: '/valuation',
    icon: 'estimate',
    iconClassName: 'iconBlue',
    label: 'Open estimate tool',
  },
  {
    title: 'Asset Register',
    text: 'Centralise asset records, track performance, and stay inspection-ready.',
    href: '/asset-register',
    icon: 'register',
    iconClassName: 'iconTeal',
    label: 'Open asset register',
  },
  {
    title: 'Marketplace',
    text: 'Discover listings, compare value, and connect with verified buyers and sellers.',
    href: '/marketplace',
    icon: 'marketplace',
    iconClassName: 'iconIndigo',
    label: 'Open marketplace',
  },
];

const trustItems: TrustItem[] = [
  {
    title: 'Trusted by industry professionals',
    text: 'across South Africa',
    icon: 'security',
  },
  {
    title: 'Local data. Local insight.',
    text: 'Built for SA conditions.',
    icon: 'flag',
  },
  {
    title: 'Secure, compliant,',
    text: 'and privacy-focused',
    icon: 'lock',
  },
];

function ToolIcon({ name }: { name: ToolIconName }) {
  if (name === 'estimate') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M14 6h14.8L38 15.2V42H14V6Z" />
        <path d="M29 6v10h9" />
        <path d="M20 24h4" />
        <path d="M20 30h4" />
        <path d="M20 36h4" />
        <path d="M29 34v2" />
        <path d="M34 28v8" />
        <path d="M39 22v14" />
      </svg>
    );
  }

  if (name === 'register') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M18 8h12l1.5 4H36v30H12V12h4.5L18 8Z" />
        <path d="M18 12h12" />
        <path d="M19 22h1" />
        <path d="M25 22h10" />
        <path d="M19 29h1" />
        <path d="M25 29h10" />
        <path d="M19 36h1" />
        <path d="M25 36h10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 12h5l3.2 18.5h17.1L41 17H19" />
      <path d="M22 38.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M35 38.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M22.4 23h15.1" />
      <path d="M24.2 29h11.6" />
    </svg>
  );
}

function SouthAfricaFlag() {
  return (
    <svg className={styles.flagSvg} viewBox="0 0 72 48" aria-hidden="true">
      <clipPath id="flagRadius">
        <rect width="72" height="48" rx="7" />
      </clipPath>
      <g clipPath="url(#flagRadius)">
        <path fill="#de3831" d="M0 0h72v24H0z" />
        <path fill="#002395" d="M0 24h72v24H0z" />
        <path fill="#fff" d="M0 0v48l36-24z" />
        <path fill="#007a4d" d="M0 4.8v38.4L28.8 24z" />
        <path fill="#ffb612" d="M0 9.7v28.6L21.5 24z" />
        <path fill="#000" d="M0 14.5v19L14.3 24z" />
        <path fill="#fff" d="M24 18h48v12H24z" />
        <path fill="#007a4d" d="M25.8 20h46.2v8H25.8z" />
      </g>
    </svg>
  );
}

function TrustIcon({ name }: { name: TrustIconName }) {
  if (name === 'flag') {
    return <SouthAfricaFlag />;
  }

  if (name === 'lock') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M15 21v-5a9 9 0 0 1 18 0v5" />
        <path d="M12 21h24v19H12V21Z" />
        <path d="M24 29v5" />
        <path d="M24 29h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 6 38 12v10c0 9.8-5.7 16.8-14 20-8.3-3.2-14-10.2-14-20V12l14-6Z" />
      <path d="m17.5 24.5 4.4 4.4 9-10" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" ctaLabel="Sign up" />

      <section className={styles.landingSection} aria-label="Aim4price overview">
        <div className={styles.heroBackdrop} aria-hidden="true">
          <Image
            src="/brand/homepage/Aim4price_hero.png"
            alt=""
            fill
            priority
            quality={100}
            sizes="100vw"
            className={styles.heroImage}
          />
        </div>

        <div className={styles.shell}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>Know what your machinery is worth — fast</h1>
            <p className={styles.heroText}>
              Aim4price helps machinery owners, financiers, insurers, and dealers make confident
              decisions with estimates, asset records, and marketplace tools built for the real world.
            </p>

            <div className={styles.heroActions}>
              <Link href="/valuation" className={styles.primaryCta}>
                Get Estimate
              </Link>
              <Link href="/asset-register" className={styles.secondaryCta}>
                View Asset Register
              </Link>
            </div>
          </div>

          <div className={styles.audienceGrid} aria-label="Choose your Aim4price path">
            {audienceCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className={`${styles.audienceCard} ${styles[card.accent]}`}
                aria-label={`Explore Aim4price for ${card.title.toLowerCase()}`}
              >
                <Image
                  src={card.image}
                  alt=""
                  fill
                  quality={100}
                  sizes="(min-width: 1280px) 440px, (min-width: 860px) 31vw, 100vw"
                  className={styles.audienceImage}
                />
                <span className={styles.audienceContent}>
                  <span className={styles.audienceTitle}>{card.title}</span>
                  <span className={styles.audienceText}>{card.text}</span>
                  <span className={styles.audienceButton}>Explore</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.toolsSection} aria-labelledby="tools-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Built for every stage</p>
            <h2 id="tools-heading" className={styles.sectionTitle}>
              Three powerful tools. One trusted platform.
            </h2>
          </div>

          <div className={styles.toolsGrid}>
            {toolCards.map((card) => (
              <Link key={card.title} href={card.href} className={styles.toolCard} aria-label={card.label}>
                <span className={`${styles.toolIcon} ${styles[card.iconClassName]}`}>
                  <ToolIcon name={card.icon} />
                </span>
                <span className={styles.toolContent}>
                  <span className={styles.toolTitle}>{card.title}</span>
                  <span className={styles.toolText}>{card.text}</span>
                </span>
                <span className={styles.arrowButton} aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.trustSection} aria-label="Platform trust markers">
        <div className={styles.trustShell}>
          {trustItems.map((item) => (
            <div key={item.title} className={styles.trustItem}>
              <span className={styles.trustIcon}>
                <TrustIcon name={item.icon} />
              </span>
              <span className={styles.trustCopy}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
