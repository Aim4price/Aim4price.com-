import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import { redirectAdminToAdmin } from "../../lib/account-access";
import styles from "./contact-us.module.css";

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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.whatsAppMark} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.892-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.892 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.3-1.654a11.882 11.882 0 0 0 5.69 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
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
              <h1 id="contact-title" className={styles.heroTitle}>
                Let&apos;s talk.
              </h1>
              <p className={styles.heroText}>
                Need help getting started, using Aim4price or choosing the right
                workspace?
                <span className={styles.contactInvitation}>Get in touch.</span>
              </p>

              <address className={styles.contactDetails}>
                <a href="tel:+27625721650" className={styles.contactLink}>
                  <span className={`${styles.contactIcon} ${styles.phoneIcon}`}>
                    <PhoneIcon />
                  </span>
                  <span className={styles.contactValue}>
                    <span className={styles.contactLabel}>Call</span>
                    062 572 1650
                  </span>
                </a>
                <a href="mailto:aim4price@gmail.com" className={styles.contactLink}>
                  <span className={`${styles.contactIcon} ${styles.emailIcon}`}>
                    <EmailIcon />
                  </span>
                  <span className={styles.contactValue}>
                    <span className={styles.contactLabel}>Email</span>
                    aim4price@gmail.com
                  </span>
                </a>
                <a href="https://wa.me/27625721650" className={styles.contactLink} target="_blank" rel="noopener noreferrer">
                  <span className={`${styles.contactIcon} ${styles.whatsAppIcon}`}>
                    <WhatsAppIcon />
                  </span>
                  <span className={styles.contactValue}><span className={styles.contactLabel}>WhatsApp</span>Chat to Aim4price</span>
                </a>
              </address>

              <p className={styles.contactNote}>
                New to Aim4price?{" "}
                <Link href="/about-us" className={styles.textLink}>
                  See what it does
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
                  sizes="260px"
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
