import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from '../legal-page.module.css';

const LAST_UPDATED = '08 April 2026';
const LEGAL_EMAIL = 'legal@aim4price.com'; // Replace before launch

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Read how Aim4price collects, uses, stores, and protects personal information.',
};

const collectedInformation = [
  'Account information such as name, email address, phone number, company name, and login credentials.',
  'Valuation inputs and equipment information you submit, including brand, model, year, hours, usage details, and related pricing inputs.',
  'Asset register data, including equipment records, ownership-related details, notes, and saved values.',
  'Marketplace information, including listing details, seller details, pricing, location, photos, and buyer or seller enquiries.',
  'Technical and usage information such as browser type, IP address, device data, pages visited, and general interaction data.',
];

const useOfInformation = [
  'To provide valuations, asset register functionality, marketplace features, and account access.',
  'To improve product performance, data quality, user experience, and platform security.',
  'To communicate with you about your account, support requests, legal notices, or product updates.',
  'To detect misuse, fraud, unauthorized access, or other harmful activity.',
  'To comply with legal, regulatory, operational, and record-keeping obligations.',
];

const rightsList = [
  'request access to personal information we hold about you;',
  'request correction of inaccurate, incomplete, or outdated personal information;',
  'request deletion or destruction of information we are no longer authorized or required to keep;',
  'object to certain processing where applicable;',
  'withdraw consent where consent is the basis for processing; and',
  'lodge a complaint with the relevant regulator if you believe your rights have been infringed.',
];

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroShell}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>Legal</span>
          <h1>Privacy Policy</h1>
          <p>
            This page explains how Aim4price collects, uses, stores, shares, and protects
            personal information across valuations, accounts, asset registers, and marketplace
            activity.
          </p>
        </div>
      </section>

      <section className={styles.articleShell}>
        <article className={styles.article}>
          <div className={styles.metaRow}>
            <span>Last updated: {LAST_UPDATED}</span>
            <span>Applies to the Aim4price website and related services</span>
          </div>

          <section className={styles.section}>
            <h2>1. Overview</h2>
            <p>
              Aim4price respects your privacy and is committed to handling personal information
              responsibly. This Privacy Policy describes how we process information when you use
              the Aim4price website, create an account, request a valuation, save items into an
              asset register, or use marketplace features.
            </p>
            <p>
              By using Aim4price, you acknowledge that your information may be processed as
              described in this policy.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Information we collect</h2>
            <p>Depending on how you use the platform, we may collect the following information:</p>
            <ul className={styles.list}>
              {collectedInformation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. How we use information</h2>
            <p>We use personal information for legitimate business and operational purposes, including:</p>
            <ul className={styles.list}>
              {useOfInformation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Sharing of information</h2>
            <p>
              We may share personal information with trusted service providers and operators who
              assist us with hosting, infrastructure, analytics, support, communications, security,
              and platform delivery.
            </p>
            <p>
              We may also disclose information where required to comply with law, enforce our legal
              rights, investigate misuse, protect users, or support a business transaction such as a
              merger, restructuring, financing process, or sale of assets.
            </p>
            <p>
              We do not sell personal information as part of our ordinary business model.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Retention</h2>
            <p>
              We keep personal information only for as long as it is reasonably necessary for the
              purpose for which it was collected, for platform operations, for legitimate business
              needs, or to comply with legal, tax, accounting, dispute, or record-keeping
              requirements.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Security</h2>
            <p>
              Aim4price uses reasonable technical and organizational safeguards to protect personal
              information against loss, misuse, unauthorized access, disclosure, alteration, and
              destruction. No method of storage or transmission is completely secure, so we cannot
              guarantee absolute security.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Cookies and analytics</h2>
            <p>
              We may use cookies, local storage, session technologies, and analytics tools to keep
              the website functioning, understand product usage, improve performance, remember user
              preferences, and support security controls.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. POPIA-related rights</h2>
            <p>
              Subject to applicable law, including South African privacy requirements, you may:
            </p>
            <ul className={styles.list}>
              {rightsList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              To make a privacy-related request, contact us at{' '}
              <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Cross-border processing</h2>
            <p>
              Aim4price may use infrastructure, software providers, or operators that process data
              in or from jurisdictions outside South Africa. Where this occurs, we will take
              reasonable steps to ensure that appropriate safeguards apply to the processing of
              personal information.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any updated version will be
              posted on this page with a revised effective or last updated date.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Contact</h2>
            <p>
              For privacy, data, or legal questions relating to this policy, contact Aim4price at{' '}
              <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
            </p>

            <div className={styles.linkRow}>
              <Link href="/terms-of-service" className={styles.linkPill}>
                Read Terms of Service
              </Link>
              <Link href="/" className={styles.linkPill}>
                Return Home
              </Link>
            </div>

            <p className={styles.small}>
              Replace the placeholder legal email before publishing this page live.
            </p>
          </section>
        </article>
      </section>
    </main>
  );
}
