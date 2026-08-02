import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import { redirectAdminToAdmin } from '../../lib/account-access';
import styles from '../legal-page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAST_UPDATED = '02 August 2026';
const CONTACT_EMAIL = 'aim4price@gmail.com';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms for Aim4price accounts, Asset Registers, reports, role-based collaboration and marketplace services.',
};

const contents = [
  ['acceptance', 'Acceptance and authority'],
  ['service', 'The Aim4price service'],
  ['accounts', 'Accounts and roles'],
  ['control', 'Asset Register control'],
  ['professionals', 'Professional contributions'],
  ['estimates', 'Estimates and reports'],
  ['records', 'Asset records and documents'],
  ['marketplace', 'Marketplace and Discovery'],
  ['integrations', 'Imports and integrations'],
  ['content', 'User content and platform rights'],
  ['acceptable-use', 'Acceptable use'],
  ['fees', 'Fees and paid services'],
  ['availability', 'Availability and third parties'],
  ['termination', 'Suspension and termination'],
  ['liability', 'Risk and liability'],
  ['general', 'General terms and contact'],
] as const;

const prohibitedUse = [
  'use the platform unlawfully, fraudulently, deceptively or in a way that harms another person;',
  'access, share or use an Asset Register outside the permissions and purpose given by its owner or administrator;',
  'upload information, documents, images or listings you do not have authority to use;',
  'present an Aim4price estimate or report as a certified valuation, guaranteed price, approval or professional opinion;',
  'probe security, gain unauthorized access, introduce harmful code or interfere with normal operation;',
  'scrape, copy, reverse engineer or commercially exploit the platform or its data except where law or a written agreement permits it; or',
  'use Aim4price to send spam, conduct unlawful direct marketing or facilitate an unlawful transaction.',
];

export default async function TermsOfServicePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroShell}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>Platform terms</span>
          <h1>Terms of Service</h1>
          <p>
            The rules for using Aim4price across owner-controlled Asset Registers, detailed reports,
            permission-based collaboration and market opportunities.
          </p>
          <div className={styles.heroPills} aria-label="Terms of Service principles">
            <span>The owner stays in control</span>
            <span>Every role remains accountable</span>
            <span>Statutory rights remain protected</span>
          </div>
        </div>
      </section>

      <section className={styles.articleShell}>
        <div className={styles.documentLayout}>
          <nav className={styles.contents} aria-label="Terms of Service contents">
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
              <span>Website terms for Aim4price accounts and related services</span>
            </div>

            <div className={styles.notice}>
              <strong>Important notice</strong>
              <p>
                Aim4price estimates, reports and asset records are decision-support tools. They are
                not certified valuations, proof of ownership, financial advice, insurance advice or
                guaranteed outcomes. Each user and professional must verify the information relevant
                to their decision. Sections 5 to 9 and 15 contain important risk and responsibility
                provisions.
              </p>
            </div>

            <section id="acceptance" className={styles.section}>
              <h2>1. Acceptance, capacity and authority</h2>
              <p>
                By accessing Aim4price, creating an account, accepting an invitation or using a
                service, you agree to these Terms of Service and the Privacy Policy. If you use the
                platform for a business, client or organization, you confirm that you are authorized
                to bind or act for that party.
              </p>
              <p>
                You must be at least 18 years old and legally capable of entering into these terms.
                If you do not agree, do not use the platform.
              </p>
            </section>

            <section id="service" className={styles.section}>
              <h2>2. The Aim4price service</h2>
              <p>
                Aim4price provides digital tools for asset estimates, Asset Registers, documents,
                values, costs, fuel, maintenance, licensing, finance, insurance, accounting-related
                records, reports, QR-linked information, collaboration, Discovery and Marketplace.
                Features may differ by account type, role, subscription and stage of development.
              </p>
              <p>
                Aim4price supports the asset lifecycle. It does not replace the official records,
                professional systems or regulated responsibilities of accountants, banks, insurers,
                brokers, dealers, auctioneers, licensing specialists or other professionals.
              </p>
            </section>

            <section id="accounts" className={styles.section}>
              <h2>3. Accounts, organizations and roles</h2>
              <p>
                You must provide accurate account information, protect your login credentials and
                promptly report suspected unauthorized use. You are responsible for activity carried
                out through your account unless applicable law provides otherwise.
              </p>
              <p>
                An organization or account administrator may invite staff and professionals, assign
                roles, change permissions and remove access. Each person must use an individual
                account where required and may access only the information and functions authorized
                for that role.
              </p>
            </section>

            <section id="control" className={styles.section}>
              <h2>4. Owner-controlled Asset Registers</h2>
              <p>
                The owner or authorized administrator controls the Asset Register and decides who may
                view or contribute to it. Granting access does not transfer ownership of the asset or
                make Aim4price the owner, custodian, agent or manager of the underlying asset.
              </p>
              <p>
                Owners must review permissions regularly. Removing access stops future access where
                supported, but may not erase lawful audit history, completed reports, records another
                party must retain, or copies properly exported before access ended.
              </p>
            </section>

            <section id="professionals" className={styles.section}>
              <h2>5. Professional contributions and responsibility</h2>
              <p>
                Invited professionals may contribute information relevant to their role, such as
                service records, finance details, accounting values, insurance schedules, estimates
                or supporting documents. The contributor is responsible for the accuracy, authority,
                timing and professional standard of that contribution.
              </p>
              <p>
                Unless Aim4price expressly agrees otherwise in writing, Aim4price is not acting as an
                accountant, auditor, financial services provider, insurer, broker, bank, credit
                provider, dealer, auctioneer, property practitioner, licensing authority or legal
                adviser. A professional relationship is between the owner and the selected provider.
              </p>
            </section>

            <section id="estimates" className={styles.section}>
              <h2>6. Estimates, values and reports</h2>
              <p>
                Estimated values, ranges, averages, confidence indicators and reports depend on the
                information supplied, available comparison data, assumptions, asset condition and
                market conditions at the time. They may be incomplete, delayed or incorrect.
              </p>
              <p>
                An output is not a guaranteed sale price, replacement value, insured value, finance
                approval, credit decision, accounting treatment, tax position or certified valuation.
                Obtain an inspection or appropriately qualified advice when a decision requires it.
              </p>
            </section>

            <section id="records" className={styles.section}>
              <h2>7. Asset records, documents and reports</h2>
              <p>
                An Asset Register organizes information supplied by users and connected services. It
                is not by itself proof of legal ownership, registration, title, security interests,
                settlement balance, licence validity, insurance cover, compliance or the authenticity
                of an uploaded document.
              </p>
              <p>
                Users must keep original source documents where required, confirm important figures
                with the relevant institution and correct records when circumstances change. Reports
                should be read with their source information, date, scope and stated limitations.
              </p>
            </section>

            <section id="marketplace" className={styles.section}>
              <h2>8. Marketplace, Discovery and contact opportunities</h2>
              <p>
                Owners decide whether an asset or selected details may appear in Discovery or
                Marketplace. Aim4price may help users discover assets and contact one another, but is
                not automatically the seller, buyer, auctioneer, broker, agent, financier or party to
                a transaction.
              </p>
              <p>
                Users must conduct their own identity, ownership, condition, pricing, finance and
                compliance checks. Aim4price does not guarantee that a listing is accurate, that a
                user will respond, or that a transaction, finance application or insurance placement
                will be completed.
              </p>
            </section>

            <section id="integrations" className={styles.section}>
              <h2>9. Uploads, document reading and connected services</h2>
              <p>
                Aim4price may extract information from invoices, receipts, photos or other documents,
                and may in future support user-authorized connections to accounting, finance,
                insurance or other external services. Extracted, matched or synchronized information
                must be checked before it is relied on or saved as final.
              </p>
              <p>
                Connected services remain subject to their own terms, availability and security.
                Aim4price is not responsible for changes, downtime, rejected access, duplicated data
                or errors caused by an external service, except to the extent liability cannot
                lawfully be excluded.
              </p>
            </section>

            <section id="content" className={styles.section}>
              <h2>10. User content, privacy and platform rights</h2>
              <p>
                You keep your rights in information, photos and documents you upload. You grant
                Aim4price a limited, non-exclusive right to host, copy, process and display that
                content only as reasonably needed to provide, secure, support and improve the service
                and as described in the Privacy Policy.
              </p>
              <p>
                You must have authority to upload and share the content, choose permissions carefully
                and respect confidentiality, intellectual property and privacy rights. Aim4price owns
                or licenses its software, branding, layouts, workflows and original platform content.
              </p>
            </section>

            <section id="acceptable-use" className={styles.section}>
              <h2>11. Acceptable use</h2>
              <p>You may not:</p>
              <ul className={styles.list}>
                {prohibitedUse.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section id="fees" className={styles.section}>
              <h2>12. Fees, subscriptions and paid services</h2>
              <p>
                Some services may be free and others may require payment or a separate written
                agreement. Before a paid service begins, the applicable price, taxes, billing period,
                renewal, cancellation and material service terms will be displayed or agreed with the
                customer.
              </p>
              <p>
                You must pay valid charges when due. Any statutory cooling-off, refund or consumer
                right that applies remains unaffected by these terms.
              </p>
            </section>

            <section id="availability" className={styles.section}>
              <h2>13. Availability, changes and third-party services</h2>
              <p>
                Aim4price is provided on an available basis. We use reasonable efforts to maintain a
                reliable and secure service, but cannot promise uninterrupted access, permanent
                storage or error-free operation. Keep independent copies of records that are legally
                or operationally critical.
              </p>
              <p>
                We may add, improve, restrict or retire features for security, legal, technical or
                commercial reasons. We will give reasonable notice where a change materially affects
                a paid service and notice is practical.
              </p>
            </section>

            <section id="termination" className={styles.section}>
              <h2>14. Suspension, termination and data export</h2>
              <p>
                Aim4price may restrict or suspend access where reasonably necessary to address
                security risk, unlawful use, material breach, non-payment, harm to another user or a
                legal requirement. Where appropriate, we will explain the reason and provide a chance
                to remedy the issue.
              </p>
              <p>
                You may stop using the service and request account closure. Before closure, export
                records you are entitled to keep. Some information may be retained as explained in
                the Privacy Policy, including lawful audit, dispute and backup records.
              </p>
            </section>

            <section id="liability" className={styles.section}>
              <h2>15. Disclaimers, risk and limitation of liability</h2>
              <p>
                To the extent permitted by law, Aim4price is not responsible for indirect or
                consequential loss, loss of profit or opportunity, or a decision made by a user or
                third-party professional in reliance on user-supplied information, an estimate,
                report, listing or external service.
              </p>
              <p>
                Nothing in these terms excludes or limits liability for fraud, wilful misconduct,
                gross negligence, or any liability or consumer right that cannot lawfully be excluded
                or limited. Any responsibility that remains will be assessed under applicable law and
                any separate written agreement for the affected service.
              </p>
            </section>

            <section id="general" className={styles.section}>
              <h2>16. General terms, governing law and contact</h2>
              <p>
                These terms are governed by South African law. Before starting formal proceedings,
                the parties should try in good faith to resolve a dispute through written discussion,
                without limiting any right to approach a regulator, tribunal or court.
              </p>
              <p>
                We may update these terms as the service and its account roles develop. We will post
                the revised terms and date, and provide reasonable notice of material changes where
                required. If you do not accept a material change, you should stop using the affected
                service before it takes effect.
              </p>
              <p>
                Notices and contractual questions may be sent to Aim4price at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Electronic notices may also be
                sent to the email address linked to your account.
              </p>

              <div className={styles.linkRow}>
                <Link href="/privacy-policy" className={styles.linkPill}>
                  Read Privacy Policy
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
