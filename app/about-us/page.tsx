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
    "Asset management software built for South Africa. Organise your assets, estimate their value and track costs, fuel, budgets and maintenance with Aim4price.",
};

const features = [
  {
    title: "Know what you have.",
    text: "Keep asset details, photos and documents together. Group related assets and share or download your records.",
  },
  {
    title: "Know what it’s worth.",
    text: "Get indicative values for supported vehicles and equipment, and explore how age and usage affect their estimated value.",
  },
  {
    title: "Know what it costs.",
    text: "Record expenses and fuel against each asset, track budgets and download cost of ownership reports.",
  },
  {
    title: "Keep work on track.",
    text: "Schedule maintenance, use checklists and keep a record of reported problems and completed work.",
  },
];

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
                Know your assets.
                <span>Manage them better.</span>
              </h1>
              <p className={styles.heroText}>
                Asset management software built for South Africa. Keep your
                vehicles, machinery and equipment organised, with their details,
                estimated values and ownership costs in one place.
              </p>
              <div className={styles.heroActions}>
                <Link href="/auth#signup" className={styles.primaryAction}>
                  Get started
                </Link>
                <Link href="/valuation" className={styles.secondaryAction}>
                  Get a free estimate
                </Link>
              </div>
            </div>

            <figure className={styles.founderPanel}>
              <div className={styles.portraitFrame}>
                <Image
                  src="/about/kuyler-geldenhuys.jpg"
                  alt="Kuyler Chris Geldenhuys"
                  fill
                  priority
                  sizes="420px"
                  className={styles.portrait}
                />
              </div>
              <figcaption className={styles.founderCaption}>
                <p className={styles.founderName}>Kuyler Chris Geldenhuys</p>
                <p className={styles.founderRole}>Founder · South Africa</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.featuresSection} aria-labelledby="features-title">
        <div className={styles.shell}>
          <h2 id="features-title" className={styles.sectionTitle}>
            Practical tools for everyday ownership.
          </h2>
          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <article key={feature.title} className={styles.featureCard}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
          <div className={styles.aboutClosing}>
            <p>
              Aim4price stands for Asset Intelligence, Management &amp; Pricing.
            </p>
            <Link href="/contact-us" className={styles.textLink}>
              Get in touch <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
