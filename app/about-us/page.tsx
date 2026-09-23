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
    "Aim4price — Asset Intelligence & Management. From fair agricultural machinery trade-in values to helping owners understand asset values, running costs and maintenance.",
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
              <p className={styles.pageLabel}>Aim4price — Asset Intelligence &amp; Management</p>
              <h1 id="about-title" className={styles.heroTitle}>
                Why we started{" "}
                <span>Aim4price.</span>
              </h1>
              <div className={styles.storyText}>
                <p>
                  Aim4price was initially built to help agricultural machinery
                  dealers determine fair trade-in values. Our first tool focused
                  on second-hand tractors, bringing a more consistent approach
                  to estimating their worth and giving dealers a clearer starting
                  point for discussions with owners.
                </p>
                <p>
                  As Aim4price developed, we recognised that a valuation was only
                  one part of a much bigger picture. Owners also needed to know
                  exactly what they owned, how its value changed with age and
                  use, and what it really cost to keep it working.
                </p>
                <p>
                  The information needed to answer those questions was often
                  spread across invoices, service records, spreadsheets and
                  paperwork. A total expense could tell an owner how much they
                  had spent, but not always which machine was costing the most,
                  why costs were rising or what needed attention next.
                </p>
                <p>
                  That led us to connect asset details and values with invoices,
                  fuel costs, budgets and maintenance in one place. By linking
                  records to the assets they belong to, Aim4price helps owners
                  build a useful history and make more informed decisions about
                  maintaining, repairing or replacing what they own.
                </p>
                <p className={styles.storyFocus}>
                  Today, our focus is asset intelligence and management: helping
                  owners understand what they have, what it is worth and what it
                  costs to own, so they can plan ahead and look after it better.
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
                We want to help owners understand and manage their assets in
                every possible way. That means helping them spot problems
                earlier, reduce avoidable breakdowns, plan maintenance and
                lower the cost of keeping their equipment working.
              </p>
              <p>
                We also want owners to put their asset data to work for them.
                Reliable records of value, condition, maintenance and running
                costs could help them present a clearer picture to insurers
                and lenders, strengthening their position when negotiating
                competitive insurance premiums and financing rates.
              </p>
              <p>
                Our longer-term goal is to turn better asset information into
                practical advantages for the people who own and manage it.
                It starts with keeping those records accurate, organised and
                up to date.
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
