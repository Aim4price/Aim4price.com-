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
    "Discover why Aim4price started: from helping machinery dealers value second-hand tractors to helping owners understand and manage their assets.",
};

export default async function AboutUsPage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.heroSection} aria-labelledby="about-title">
        <div className={styles.shell}>
          <div className={styles.heroPanel}>
            <div className={styles.heroCopy}>
              <p className={styles.pageLabel}>About Aim4price</p>
              <h1 id="about-title" className={styles.heroTitle}>
                Why we started{" "}
                <span>Aim4price.</span>
              </h1>
              <div className={styles.storyText}>
                <p>
                  Aim4price began by helping machinery dealers work out
                  trade-in values. Our first tool made it easier to value
                  second-hand tractors.
                </p>
                <p>
                  We soon realised owners needed more than a value. They needed
                  to know what they owned, what it was worth and what it cost
                  to keep running.
                </p>
                <p>
                  That meant linking invoices, running costs, budgets and
                  maintenance to each asset. With everything in one place,
                  owners could see where their money was going and what
                  needed attention.
                </p>
                <p className={styles.storyFocus}>
                  That became our focus: helping owners make better decisions,
                  plan ahead and look after what they have.
                </p>
              </div>
            </div>

            <figure className={`${styles.founderPanel} ${styles.storyFounder}`}>
              <div className={`${styles.portraitFrame} ${styles.storyPortrait}`}>
                <Image
                  src="/about/kuyler-geldenhuys.jpg"
                  alt="Kuyler Geldenhuys, founder of Aim4price"
                  fill
                  priority
                  sizes="420px"
                  className={styles.portrait}
                />
              </div>
              <figcaption className={styles.founderCaption}>
                <p className={styles.founderRole}>From our founder</p>
                <p className={styles.founderName}>Kuyler Geldenhuys</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.directionSection} aria-labelledby="direction-title">
        <div className={styles.shell}>
          <div className={styles.directionPanel}>
            <div className={styles.directionCopy}>
              <h2 id="direction-title" className={styles.sectionTitle}>
                Where we’re heading
              </h2>
              <p>
                We want to help owners save on parts and reduce maintenance
                costs. In time, we also believe accurate asset records could
                help lenders understand risk and insurers offer fairer premiums.
                These are our longer-term goals, built on keeping asset
                information reliable and up to date.
              </p>
            </div>
            <div className={styles.directionClosing}>
              <p>
                It starts with helping owners understand and manage
                what they have.
              </p>
              <div className={styles.heroActions}>
                <Link href="/auth#signup" className={styles.primaryAction}>
                  Get started
                </Link>
                <Link href="/contact-us" className={styles.secondaryAction}>
                  Get in touch
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
