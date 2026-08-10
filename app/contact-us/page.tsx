import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import { redirectAdminToAdmin } from "../../lib/account-access";
import styles from "../about-us/about-us.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Kuyler Chris Geldenhuys and Aim4price to discuss better asset management, valuation and collaboration.",
};

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

export default async function ContactUsPage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroPanel}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>CONTACT AIM4PRICE</p>
              <h1 className={styles.heroTitle}>
                Let&apos;s build a better
                <span>asset economy.</span>
              </h1>
              <p className={styles.heroText}>
                Whether you own, service, finance or insure assets, Aim4price is
                building a clearer way to manage information, work together and
                make better decisions.
              </p>

              <div
                className={`${styles.contactDetails} ${styles.heroContactDetails}`}
              >
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

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryAction}>
                  Get free estimate
                </Link>
                <Link href="/about-us" className={styles.secondaryAction}>
                  About Aim4price
                </Link>
              </div>

              <div className={styles.heroPrinciple}>
                <span className={styles.principleLine} aria-hidden="true" />
                <p>
                  South African asset intelligence, built around real ownership.
                </p>
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
                <div className={styles.founderCard}>
                  <p className={styles.founderLabel}>FOUNDER</p>
                  <p className={styles.founderName}>Kuyler Chris Geldenhuys</p>
                  <p className={styles.founderLocation}>Built in South Africa</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.directionSection}>
        <div className={styles.shell}>
          <div className={styles.directionIntro}>
            <p className={styles.sectionEyebrow}>WHY AIM4PRICE EXISTS</p>
            <h2>Clear information. Stronger partnerships.</h2>
            <p>
              Better records should help every trusted role make faster, fairer
              and more informed decisions.
            </p>
          </div>

          <div className={styles.directionGrid}>
            <article className={styles.directionCard}>
              <span className={styles.cardIndex}>01</span>
              <p className={styles.cardLabel}>WHAT AIM4PRICE IS</p>
              <h3>One trusted asset record.</h3>
              <p>
                Aim4price connects owners, dealers, service providers, insurers,
                financiers and accountants around useful information that stays
                with the asset throughout its lifecycle.
              </p>
            </article>

            <article className={`${styles.directionCard} ${styles.visionCard}`}>
              <span className={styles.cardIndex}>02</span>
              <p className={styles.cardLabel}>OUR DIRECTION</p>
              <h3>Better decisions create better competition.</h3>
              <p>
                Transparent asset information can support fairer financing, more
                accurate insurance pricing, better cover, improved operational
                efficiency and stronger partnerships.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
