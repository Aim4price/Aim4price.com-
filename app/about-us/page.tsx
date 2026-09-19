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
                Why we started
                <span>Aim4price.</span>
              </h1>
              <div className={styles.storyText}>
                <p>
                  We started with a simple problem: machinery dealers struggled
                  to determine trade-in values. Our first tool helped value
                  second-hand tractors, bringing a clearer approach to pricing
                  used equipment.
                </p>
                <p>
                  We soon saw a bigger need. Owners needed to understand their
                  assets, from what they owned and what it was worth to what it
                  cost to keep running.
                </p>
                <p>
                  We also saw a gap between accounting records and everyday
                  ownership. Invoices, budgets, running costs and maintenance
                  needed to connect to each individual asset.
                </p>
                <p className={styles.storyFocus}>
                  That became our focus: bringing this information together so
                  owners can make better decisions, plan ahead and look after
                  what they have.
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
                We believe better asset information could help lenders assess
                risk and give insurers a clearer basis for offering fairer
                premiums. That is our longer-term ambition, built on reliable,
                up-to-date records.
              </p>
            </div>
            <div className={styles.directionClosing}>
              <p>
                It starts with something practical: helping owners understand
                and manage their assets better.
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
