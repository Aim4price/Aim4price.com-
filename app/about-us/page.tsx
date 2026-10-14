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
    "Aim4price - Asset Intelligence & Management. Connecting asset records, trusted businesses, reports and AI to help owners understand costs and protect long-term value.",
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
              <p className={styles.pageLabel}>Aim4price - Asset Intelligence &amp; Management</p>
              <h1 id="about-title" className={styles.heroTitle}>
                Why we started{" "}
                <span>Aim4price.</span>
              </h1>
              <div className={styles.storyText}>
                <p>
                  Aim4price began by helping agricultural machinery dealers
                  determine fair trade-in values. Our first tool focused on
                  second-hand tractors, giving dealers and owners a clearer
                  starting point for understanding what an asset could be worth.
                </p>
                <p>
                  As we developed, we recognised that a valuation was only one
                  part of a much bigger picture. Owners also needed to know what
                  they owned, how its value changed over time and what it really
                  cost to keep it working.
                </p>
                <p>
                  Those answers were often scattered across invoices, service
                  records, spreadsheets and paperwork. We built Aim4price to bring
                  asset details, values, fuel costs, budgets and maintenance
                  together, creating a useful history for each asset.
                </p>
              </div>
            </div>

            <figure className={`${styles.founderPanel} ${styles.storyFounder}`}>
              <div className={`${styles.portraitFrame} ${styles.storyPortrait}`}>
                <Image
                  src="/about/kuyler-geldenhuys.jpg"
                  alt="Kuyler Chris Geldenhuys, founder of Aim4price"
                  fill
                  priority
                  sizes="420px"
                  className={styles.portrait}
                />
              </div>
              <figcaption className={styles.founderCaption}>
                <p className={styles.founderRole}>From our founder</p>
                <p className={styles.founderName}>Kuyler Chris Geldenhuys</p>
              </figcaption>
            </figure>

            <p className={styles.storyFocus}>
              Today, our focus is helping people understand, manage and protect
              the long-term value of what they own.
            </p>
          </div>
        </div>
      </section>

      <div className={`${styles.shell} ${styles.valueSections}`}>
        <section className={styles.valueCard} aria-labelledby="sharing-title">
          <h2 id="sharing-title" className={styles.sectionTitle}>
            Build a clearer picture, together.
          </h2>
          <p>
            An asset’s story involves more than its owner. Dealers, mechanics
            and other businesses all contribute knowledge that can help complete
            the picture.
          </p>
          <p>
            Aim4price lets owners share assets with trusted businesses and choose
            what they can view or update. From adding maintenance records and
            invoices to updating asset information, those contributions help build
            a more complete record and support better decisions.
          </p>
        </section>

        <section className={styles.valueCard} aria-labelledby="insights-title">
          <h2 id="insights-title" className={styles.sectionTitle}>
            Turn your asset records into answers.
          </h2>
          <p>
            Reports bring asset values, running costs, fuel, maintenance and
            budgets into a clearer view, helping owners review their records,
            understand costs and share useful information with trusted partners.
          </p>
          <p>
            AI connections offer another way to explore the register, asking
            questions in everyday language about what is costing more, what needs
            attention and where to look next. Together, reports and AI make the
            information easier to understand and use. More complete records
            provide a stronger foundation for both.
          </p>
        </section>

        <section className={`${styles.valueCard} ${styles.lifecycleCard}`} aria-labelledby="value-title">
          <div>
            <h2 id="value-title" className={styles.sectionTitle}>
              Understand value throughout ownership.
            </h2>
            <p>
              Understanding an asset’s value means looking at how it typically
              depreciates and how age, usage, condition, maintenance and market
              demand influence what it may be worth.
            </p>
          </div>
          <div className={styles.valuePerspectives}>
            <p>
              <strong>For owners,</strong> that helps guide decisions about
              maintaining, repairing, replacing or selling.
            </p>
            <p>
              <strong>For dealers,</strong> it supports informed trade-ins,
              buying and pricing.
            </p>
            <p>
              <strong>For businesses that support those assets,</strong> it
              provides context for recommending work and services that help
              preserve their useful life and long-term value.
            </p>
          </div>
        </section>
      </div>

      <section className={styles.directionSection} aria-labelledby="direction-title">
        <div className={styles.shell}>
          <div className={styles.directionPanel}>
            <div className={styles.directionCopy}>
              <h2 id="direction-title" className={styles.sectionTitle}>
                Where we’re heading
              </h2>
              <p>
                We’re working towards using better asset information to deliver
                practical benefits for owners, from supplying the right parts and
                negotiating with suppliers and service providers to helping
                owners achieve the best possible price when it is time to sell.
              </p>
              <p>
                We also believe that reliable asset records can help owners
                present a clearer picture to insurers and financiers,
                strengthening their position when seeking suitable cover and
                competitive terms.
              </p>
            </div>
            <div className={styles.directionClosing}>
              <p>
                Our ambition is simple: help owners get more from their assets,
                and help the dealers and businesses around them deliver greater
                value throughout ownership.
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
