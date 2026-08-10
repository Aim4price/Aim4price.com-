import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import { redirectAdminToAdmin } from "../../lib/account-access";
import styles from "./about-us.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn how Aim4price connects asset information, daily management and trusted partners to create better business decisions.",
};

const valueSteps = [
  {
    number: "01",
    title: "Know the asset",
    text: "Bring values, condition, photos, documents and ownership information into one trusted record.",
  },
  {
    number: "02",
    title: "Manage the lifecycle",
    text: "Keep maintenance, fuel, costs and important changes connected throughout ownership.",
  },
  {
    number: "03",
    title: "Work better together",
    text: "Give trusted partners the right information to contribute clearly and make better decisions.",
  },
];

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 3.8 4.8 5.2c-.8.5-1.1 1.4-.8 2.3 2 6.1 6.4 10.5 12.5 12.5.9.3 1.8 0 2.3-.8l1.4-2.4-4.1-2-1.3 1.8c-3.2-1.3-6.1-4.2-7.4-7.4l1.8-1.3-2-4.1Z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
      <path d="m5 7 7 5 7-5" />
    </svg>
  );
}

export default async function AboutUsPage() {
  await redirectAdminToAdmin();

  return (
    <>
      <main className={styles.page}>
        <AppHeader active="none" />

        <section className={styles.heroSection}>
          <div className={styles.shell}>
            <div className={styles.heroPanel}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>ABOUT AIM4PRICE</p>
                <h1 className={styles.heroTitle}>
                  Better asset information.
                  <span>Better business decisions.</span>
                </h1>
                <p className={styles.heroText}>
                  Aim4price is a connected asset management and intelligence
                  platform that brings owners, dealers, service providers,
                  insurers, financiers and accountants together around one
                  trusted asset record.
                </p>

                <div className={styles.heroActions}>
                  <Link href="/valuation" className={styles.primaryAction}>
                    Get free estimate
                  </Link>
                  <Link href="/auth#signup" className={styles.secondaryAction}>
                    Create free account
                  </Link>
                </div>

                <div className={styles.heroPrinciple}>
                  <span className={styles.principleLine} aria-hidden="true" />
                  <p>One asset. One live record. Every trusted partner.</p>
                </div>
              </div>

              <div className={styles.portraitColumn}>
                <div className={styles.portraitFrame}>
                  <Image
                    src="/about/kuyler-geldenhuys.jpg"
                    alt="Kuyler Chris Geldenhuys"
                    fill
                    priority
                    sizes="(max-width: 900px) 88vw, 420px"
                    className={styles.portrait}
                  />
                </div>

                <div className={styles.founderCard}>
                  <p className={styles.founderLabel}>FOUNDER</p>
                  <p className={styles.founderName}>Kuyler Chris Geldenhuys</p>
                  <p className={styles.founderLocation}>
                    Built in South Africa
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.directionSection}>
          <div className={styles.shell}>
            <div className={styles.directionIntro}>
              <p className={styles.sectionEyebrow}>OUR DIRECTION</p>
              <h2>Building a clearer asset economy.</h2>
              <p>
                Better records should create better ownership, stronger
                collaboration and fairer competition.
              </p>
            </div>

            <div className={styles.directionGrid}>
              <article className={styles.directionCard}>
                <span className={styles.cardIndex}>01</span>
                <p className={styles.cardLabel}>OUR MISSION</p>
                <h3>Improve every stage of the asset lifecycle.</h3>
                <p>
                  To improve the way valuable assets are owned, managed,
                  maintained, valued, financed and insured by connecting trusted
                  information, daily management and the right partners in one
                  system.
                </p>
              </article>

              <article
                className={`${styles.directionCard} ${styles.visionCard}`}
              >
                <span className={styles.cardIndex}>02</span>
                <p className={styles.cardLabel}>OUR VISION</p>
                <h3>Let better information create better competition.</h3>
                <p>
                  To create a future where transparent, real world asset
                  information drives genuine competition, leading to fairer
                  financing, more accurate insurance pricing, better cover,
                  improved operational efficiency and stronger partnerships.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.valueSection}>
          <div className={styles.shell}>
            <div className={styles.valueHeading}>
              <div>
                <p className={styles.sectionEyebrow}>
                  HOW AIM4PRICE CREATES VALUE
                </p>
                <h2>Start with the asset. Improve everything around it.</h2>
              </div>
              <p>
                Aim4price turns scattered information into a practical record
                that stays useful throughout ownership.
              </p>
            </div>

            <div className={styles.valueGrid}>
              {valueSteps.map((step) => (
                <article key={step.number} className={styles.valueCard}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>

            <div className={styles.beliefPanel}>
              <p className={styles.beliefLabel}>WHAT WE BELIEVE</p>
              <p className={styles.beliefStatement}>
                Better asset information creates better decisions.
                <span>Better decisions create better competition.</span>
              </p>
            </div>
          </div>
        </section>

        <section className={styles.contactSection}>
          <div className={styles.shell}>
            <div className={styles.contactPanel}>
              <div className={styles.contactCopy}>
                <p className={styles.contactEyebrow}>GET IN TOUCH</p>
                <h2>Let&apos;s build a better asset economy.</h2>
                <p>
                  Whether you own, service, finance or insure assets, Aim4price
                  is building a clearer way to work together.
                </p>
              </div>

              <div className={styles.contactDetails}>
                <p className={styles.contactName}>Kuyler Chris Geldenhuys</p>
                <a href="tel:+27625721650" className={styles.contactLink}>
                  <span className={styles.contactIcon}>
                    <PhoneIcon />
                  </span>
                  <span>
                    <small>PHONE</small>
                    062 572 1650
                  </span>
                </a>
                <a
                  href="mailto:aim4price@gmail.com"
                  className={styles.contactLink}
                >
                  <span className={styles.contactIcon}>
                    <EmailIcon />
                  </span>
                  <span>
                    <small>EMAIL</small>
                    aim4price@gmail.com
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

