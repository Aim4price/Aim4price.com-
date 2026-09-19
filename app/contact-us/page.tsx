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
    "Contact Aim4price for help getting started, using your account or managing your assets. Call 062 572 1650 or email aim4price@gmail.com.",
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

      <section className={styles.heroSection} aria-labelledby="contact-title">
        <div className={styles.shell}>
          <div className={styles.heroPanel}>
            <div className={styles.heroCopy}>
              <p className={styles.pageLabel}>Contact us</p>
              <h1 id="contact-title" className={styles.heroTitle}>
                Let&apos;s talk.
              </h1>
              <p className={styles.heroText}>
                Need help getting started, using Aim4price or choosing the right
                workspace? Get in touch.
              </p>

              <address className={styles.contactDetails}>
                <a href="tel:+27625721650" className={styles.contactLink}>
                  <span className={styles.contactIcon}>
                    <PhoneIcon />
                  </span>
                  <span className={styles.contactValue}>
                    <span className={styles.contactLabel}>Call</span>
                    062 572 1650
                  </span>
                  <span className={styles.contactArrow} aria-hidden="true">↗</span>
                </a>
                <a href="mailto:aim4price@gmail.com" className={styles.contactLink}>
                  <span className={styles.contactIcon}>
                    <EmailIcon />
                  </span>
                  <span className={styles.contactValue}>
                    <span className={styles.contactLabel}>Email</span>
                    aim4price@gmail.com
                  </span>
                  <span className={styles.contactArrow} aria-hidden="true">↗</span>
                </a>
              </address>

              <p className={styles.contactNote}>
                New to Aim4price?{" "}
                <Link href="/about-us" className={styles.textLink}>
                  See what it does <span aria-hidden="true">↗</span>
                </Link>
              </p>
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
    </main>
  );
}
