import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import { redirectAdminToAdmin } from '../../lib/account-access';
import styles from '../legal-page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAST_UPDATED = '02 August 2026';
const PRIVACY_EMAIL = 'aim4price@gmail.com';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Aim4price handles personal information across accounts, Asset Registers, reports and permission-based collaboration.',
};

const contents = [
  ['scope', 'Scope and responsibility'],
  ['information', 'Information we collect'],
  ['sources', 'Where information comes from'],
  ['purposes', 'Why we use information'],
  ['collaboration', 'Access and collaboration'],
  ['visibility', 'Marketplace and QR visibility'],
  ['sharing', 'Service providers and sharing'],
  ['integrations', 'Connected services'],
  ['communications', 'Messages and marketing'],
  ['security', 'Security and retention'],
  ['transfers', 'Cross-border processing'],
  ['rights', 'Your privacy rights'],
  ['contact', 'Contact and complaints'],
] as const;

const collectedInformation = [
  'Account and profile information, including names, contact details, organization details, account type, role and authentication information.',
  'Asset information, including descriptions, serial or registration details, location, condition, values, photos, documents and ownership-related records you choose to add.',
  'Operational records, including estimates, fuel and cost entries, invoices, maintenance, licensing, finance, accounting, insurance and supporting reports.',
  'Collaboration activity, including invitations, permissions, approvals, notes, messages, contact requests, contributions and audit history.',
  'Marketplace and Discovery information, including listings, seller-authorized details, enquiries and transaction-related communications.',
  'Support, billing and communication information, including subscription or transaction references and masked payment details that may appear on uploaded receipts.',
  'Technical information, including IP address, browser and device information, session data, security events, pages used and diagnostic logs.',
];

const useOfInformation = [
  'provide accounts, estimates, Asset Registers, reports, collaboration, marketplace and related platform functions;',
  'keep records connected to the correct asset, user, organization and authorized role;',
  'send service messages, invitations, security alerts, support responses and requested reports;',
  'protect accounts, investigate misuse, prevent fraud and maintain reliable audit history;',
  'improve platform performance, usability, data quality and relevant product features; and',
  'meet legal, regulatory, accounting, dispute-resolution and record-keeping obligations.',
];

const rightsList = [
  'ask whether we hold personal information about you and request access to it;',
  'request correction or updating of inaccurate, incomplete or outdated information;',
  'request deletion or destruction where we are no longer authorized or required to keep the information;',
  'object to processing where applicable, or withdraw consent where processing depends on consent;',
  'opt out of direct marketing communications at any time; and',
  'complain to the Information Regulator if you believe your information has been handled unlawfully.',
];

export default async function PrivacyPolicyPage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroShell}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>Privacy and data</span>
          <h1>Privacy Policy</h1>
          <p>
            How personal information moves through owner-controlled Asset Registers,
            permission-based collaboration and the services that support Aim4price.
          </p>
          <div className={styles.heroPills} aria-label="Privacy policy principles">
            <span>Owner-controlled access</span>
            <span>Purpose-limited use</span>
            <span>POPIA-aligned rights</span>
          </div>
        </div>
      </section>

      <section className={styles.articleShell}>
        <div className={styles.documentLayout}>
          <nav className={styles.contents} aria-label="Privacy Policy contents">
            <h2>On this page</h2>
            {contents.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>

          <article className={styles.article}>
            <div className={styles.metaRow}>
              <span>Last updated: {LAST_UPDATED}</span>
              <span>Applies to Aim4price websites, accounts and related services</span>
            </div>

            <div className={styles.rolePanel}>
              <strong>The key privacy distinction</strong>
              <p>
                Aim4price operates the platform, while an owner or organization controls who may
                access its Asset Register. A professional invited into a record is also responsible
                for using that information lawfully and only for the agreed purpose.
              </p>
            </div>

            <section id="scope" className={styles.section}>
              <h2>1. Scope and responsibility</h2>
              <p>
                This policy explains how Aim4price collects and processes personal information when
                you visit the website, create or join an account, build an Asset Register, request
                estimates or reports, collaborate with another role, or use Discovery and Marketplace.
              </p>
              <p>
                Aim4price is the responsible party where we decide why and how information is used to
                operate, secure and improve the platform. Where an owner, business or professional uses
                Aim4price for its own clients, staff or business records, that party may be a separate
                responsible party and Aim4price may act as its operator for that processing.
              </p>
            </section>

            <section id="information" className={styles.section}>
              <h2>2. Information we collect</h2>
              <p>The information depends on the features and role you use. It may include:</p>
              <ul className={styles.list}>
                {collectedInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                Most information is provided voluntarily. Information marked as required is needed
                to create the account, identify the asset, provide the selected feature or meet a
                legal or security requirement. Without it, that feature may not work.
              </p>
            </section>

            <section id="sources" className={styles.section}>
              <h2>3. Where information comes from</h2>
              <p>
                We receive information directly from you, from an owner or authorized user who
                invites you or adds a record, from documents and images users upload, from connected
                services a user authorizes, and automatically from use of the platform. Estimate and
                market information may also use lawful public or commercial data sources.
              </p>
              <p>
                If you provide information about another person, you must have authority to do so
                and must tell them how their information will be used where required.
              </p>
            </section>

            <section id="purposes" className={styles.section}>
              <h2>4. Why we use information</h2>
              <p>We use personal information to:</p>
              <ul className={styles.list}>
                {useOfInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                We process information where it is necessary to provide an agreed service, comply
                with law, protect legitimate interests, or where you have given consent. We do not
                sell personal information as part of our ordinary business model.
              </p>
            </section>

            <section id="collaboration" className={styles.section}>
              <h2>5. Owner-controlled access and collaboration</h2>
              <p>
                The owner or authorized account administrator decides who may access an Asset
                Register and what each role may see or contribute. Depending on those permissions,
                dealers, accountants, financiers, insurers, brokers, managers and other invited
                professionals may view or add information relevant to their work.
              </p>
              <p>
                Permissions may be changed or withdrawn, but this does not automatically remove
                information already lawfully included in an audit trail, retained under a legal
                obligation, or separately held by another responsible party. Users must not use
                shared information outside the authorized purpose.
              </p>
            </section>

            <section id="visibility" className={styles.section}>
              <h2>6. Marketplace, Discovery and QR visibility</h2>
              <p>
                Asset information is private by default unless an authorized user chooses to share
                it, publish a listing, respond to an enquiry, or make selected details available
                through a QR-linked view. A person with a shared link or QR code may be able to see
                the fields made available through that view.
              </p>
              <p>
                Do not publish identity documents, finance records, policy documents or other
                sensitive information in a public or marketplace view unless it is necessary and
                lawful to do so.
              </p>
            </section>

            <section id="sharing" className={styles.section}>
              <h2>7. Service providers and other sharing</h2>
              <p>
                We use service providers to host the application and database, store files, deliver
                email, support deployment and protect the service. Current tooling includes Railway
                for platform infrastructure, Resend for email delivery and GitHub for source and
                deployment workflows. Providers may change as the platform develops.
              </p>
              <p>
                Providers receive only the access reasonably required for their function and must
                handle information under appropriate confidentiality and security arrangements. We
                may also disclose information where required by law, to protect users or the service,
                or as part of a properly managed financing, restructuring or sale of the business.
              </p>
            </section>

            <section id="integrations" className={styles.section}>
              <h2>8. Connected services and imports</h2>
              <p>
                If Aim4price enables connections to accounting, finance, insurance or other external
                services, information will be accessed only after an authorized user initiates or
                approves the connection. The external provider&apos;s own terms and privacy policy will
                also apply.
              </p>
              <p>
                Disconnecting a service stops future access where technically supported, but does
                not automatically remove information already imported into an Asset Register. Users
                must review imported or extracted data because automated matching, document reading
                and synchronization may be incomplete or incorrect.
              </p>
            </section>

            <section id="communications" className={styles.section}>
              <h2>9. Service messages, cookies and direct marketing</h2>
              <p>
                We may send necessary account, invitation, security, report and support messages.
                Marketing messages are separate. Where consent or another lawful basis is required,
                we will obtain it, identify the sender and provide a simple way to opt out.
              </p>
              <p>
                Aim4price may use cookies, local storage and session technologies for sign-in,
                preferences, security, performance and product usage measurement. You can control
                optional browser storage through your browser, although essential functions may then
                be affected.
              </p>
            </section>

            <section id="security" className={styles.section}>
              <h2>10. Security, retention and account deletion</h2>
              <p>
                We use reasonable technical and organizational safeguards designed to protect
                personal information against loss, misuse, unauthorized access, alteration and
                disclosure. This includes access controls, role-based permissions, protected
                infrastructure and operational monitoring. No online service can guarantee absolute
                security.
              </p>
              <p>
                We retain information for as long as needed to provide the service, preserve lawful
                asset and audit records, resolve disputes, protect the platform and meet legal or
                record-keeping requirements. Deleting an account may not remove records another
                responsible party must lawfully retain, and limited copies may remain in protected
                backups until they are overwritten.
              </p>
            </section>

            <section id="transfers" className={styles.section}>
              <h2>11. Cross-border processing</h2>
              <p>
                Some providers may process information outside South Africa. Where personal
                information crosses borders, Aim4price takes reasonable steps to use providers and
                arrangements that provide an appropriate level of protection as required by
                applicable law.
              </p>
              <p>
                Estimates, reports and automated tools support human decisions. Aim4price does not
                make final credit, insurance, accounting, legal or employment decisions about users
                solely through automated processing.
              </p>
            </section>

            <section id="rights" className={styles.section}>
              <h2>12. Your privacy rights</h2>
              <p>Subject to applicable law, including POPIA, you may:</p>
              <ul className={styles.list}>
                {rightsList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                We may need to verify your identity and authority before completing a request. A
                request may also be limited where another person&apos;s rights or a legal retention duty
                applies.
              </p>
            </section>

            <section id="contact" className={styles.section}>
              <h2>13. Contact, complaints and policy changes</h2>
              <p>
                For a privacy request or question, contact Aim4price at{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. You may also submit a complaint
                to the{' '}
                <a href="https://inforegulator.org.za/complaints/">Information Regulator of South Africa</a>.
              </p>
              <p>
                We may update this policy as Aim4price and its account roles develop. Material changes
                will be communicated where reasonably required, and the date above will show when the
                published policy was last revised.
              </p>

              <div className={styles.linkRow}>
                <Link href="/terms-of-service" className={styles.linkPill}>
                  Read Terms of Service
                </Link>
                <Link href="/" className={styles.linkPill}>
                  Return Home
                </Link>
              </div>
            </section>
          </article>
        </div>
      </section>
    </main>
  );
}
