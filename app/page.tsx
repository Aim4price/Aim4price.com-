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

type ToolCard = {
  title: string;
  text: string;
  href: string;
  image: string;
  label: string;
};

type TrustItem = {
  title: string;
  text: string;
  image: string;
  imageClassName?: string;
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
    image: '/brand/homepage/Get_Estimate.png',
    label: 'Open estimate tool',
  },
  {
    title: 'Asset Register',
    text: 'Centralise asset records, track performance, and stay inspection-ready.',
    href: '/asset-register',
    image: '/brand/homepage/Asset_Register.png',
    label: 'Open asset register',
  },
  {
    title: 'Marketplace',
    text: 'Discover listings, compare value, and connect with verified buyers and sellers.',
    href: '/marketplace',
    image: '/brand/homepage/Marketplace.png',
    label: 'Open marketplace',
  },
];

const trustItems: TrustItem[] = [
  {
    title: 'Trusted by industry professionals',
    text: 'across South Africa',
    image: '/brand/homepage/Security.png',
  },
  {
    title: 'Local data. Local insight.',
    text: 'Built for SA conditions.',
    image: '/brand/homepage/RSA.png',
    imageClassName: styles.flagImage,
  },
  {
    title: 'Secure, compliant,',
    text: 'and privacy-focused',
    image: '/brand/homepage/Lock.png',
  },
];

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
                  sizes="(max-width: 780px) 100vw, 33vw"
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
                <Image
                  src={card.image}
                  alt=""
                  fill
                  sizes="(max-width: 860px) 100vw, 33vw"
                  className={styles.toolImage}
                />
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
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="44px"
                  className={`${styles.trustImage} ${item.imageClassName ?? ''}`}
                />
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
