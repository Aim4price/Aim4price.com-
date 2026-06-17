import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import { redirectAdminToAdmin } from '../../lib/account-access';
import styles from '../legal-page.module.css';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LAST_UPDATED = '08 April 2026';
const LEGAL_EMAIL = 'legal@aim4price.com'; // Replace before launch

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read the Terms of Service for using the Aim4price website and related services.',
};

const prohibitedUse = [
  'use the platform in a way that is unlawful, fraudulent, misleading, or abusive;',
  'attempt to gain unauthorized access to accounts, systems, data, or infrastructure;',
  'copy, scrape, reverse engineer, or exploit the service or data in a prohibited manner;',
  'upload false, infringing, defamatory, or harmful content;',
  'interfere with platform security, availability, performance, or normal operation;',
];

export default async function TermsOfServicePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroShell}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>Legal</span>
          <h1>Terms of Service</h1>
          <p>
            These Terms of Service govern access to and use of the Aim4price website, valuation
            tools, asset register features, marketplace functionality, and related services.
          </p>
        </div>
      </section>

      <section className={styles.articleShell}>
        <article className={styles.article}>
          <div className={styles.metaRow}>
            <span>Last updated: {LAST_UPDATED}</span>
            <span>This page serves as Aim4price’s website terms and conditions</span>
          </div>

          <section className={styles.section}>
            <h2>1. Acceptance of terms</h2>
            <p>
              By accessing or using Aim4price, you agree to be bound by these Terms of Service. If
              you do not agree to these terms, you must not use the platform.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Services</h2>
            <p>
              Aim4price provides digital tools and information services relating to machinery
              valuation, asset register management, marketplace activity, and related workflows.
            </p>
            <p>
              We may update, refine, suspend, or discontinue features at any time in order to
              improve the service, maintain security, or reflect operational and commercial changes.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Accounts and access</h2>
            <p>
              If you create an account, you are responsible for maintaining the confidentiality of
              your login credentials and for all activity under your account. You must provide
              accurate information and keep it reasonably up to date.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Valuation outputs</h2>
            <p>
              Valuation outputs, pricing indicators, averages, estimated ranges, confidence scores,
              and related information are provided for general informational and operational use
              only.
            </p>
            <p>
              Unless expressly agreed otherwise in writing, Aim4price does not guarantee that any
              valuation reflects a final sale price, replacement value, insurable value, financing
              approval, accounting treatment, or legal position.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Asset register and marketplace use</h2>
            <p>
              You are responsible for the accuracy, legality, and completeness of any information,
              listings, descriptions, photos, prices, contact details, or records that you upload
              or publish through Aim4price.
            </p>
            <p>
              Aim4price may remove, limit, or suspend content or listings that appear inaccurate,
              unlawful, misleading, infringing, abusive, or operationally harmful.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Prohibited conduct</h2>
            <p>You may not:</p>
            <ul className={styles.list}>
              {prohibitedUse.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h2>7. Intellectual property</h2>
            <p>
              The Aim4price platform, software, branding, layout, workflows, text, and original
              content are owned by or licensed to Aim4price and are protected by applicable
              intellectual property laws.
            </p>
            <p>
              Except where permitted by law or expressly allowed in writing, you may not reproduce,
              distribute, modify, commercialize, or create derivative works from the platform or
              its protected content.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. Availability and disclaimers</h2>
            <p>
              Aim4price is provided on an “as is” and “as available” basis. We do not warrant that
              the platform will be uninterrupted, error-free, fully accurate, or available at all
              times.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Aim4price will not be liable for
              indirect, incidental, special, consequential, or business interruption losses arising
              from the use of, inability to use, or reliance on the platform.
            </p>
            <p>
              Nothing in these terms excludes liability that cannot lawfully be excluded.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Suspension and termination</h2>
            <p>
              We may suspend or terminate access to the platform where reasonably necessary for
              security, legal compliance, operational protection, non-payment, misuse, or breach of
              these terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Governing law</h2>
            <p>
              These Terms of Service are governed by the laws of South Africa, unless a separate
              written agreement provides otherwise.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Changes to these terms</h2>
            <p>
              We may revise these terms from time to time. Updated terms will be posted on this
              page with a revised last updated date. Continued use of the platform after changes are
              published constitutes acceptance of the revised terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>13. Contact</h2>
            <p>
              For legal or contractual questions about these terms, contact Aim4price at{' '}
              <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
            </p>

            <div className={styles.linkRow}>
              <Link href="/privacy-policy" className={styles.linkPill}>
                Read Privacy Policy
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
