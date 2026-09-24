import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from '../legal-page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAST_UPDATED = '19 September 2026';
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
  ['improvement', 'Improving Aim4price with data'],
  ['collaboration', 'Access and collaboration'],
  ['visibility', 'Marketplace and QR visibility'],
  ['sharing', 'Service providers and sharing'],
  ['integrations', 'Connected services'],
  ['communications', 'Messages, storage and tracking'],
  ['security', 'Security and incidents'],
  ['retention', 'Retention and deletion'],
  ['devices', 'Offline copies and location'],
  ['transfers', 'Cross-border processing and automated tools'],
  ['rights', 'Your privacy rights'],
  ['contact', 'Contact and complaints'],
] as const;

const collectedInformation = [
  'Account and profile information, including names, contact details, organisation details, account type, role and authentication information.',
  'Asset information, including descriptions, serial or registration details, location, condition, values, photos, documents and ownership-related records you choose to add.',
  'Operational records, including estimates, fuel and cost entries, invoices, maintenance, licensing, finance, accounting, insurance and supporting reports.',
  'Collaboration activity, including invitations, permissions, approvals, notes, messages, contact requests, contributions and audit history.',
  'Marketplace and Discovery information, including listings, seller-authorised details, enquiries and transaction-related communications.',
  'Support, billing and communication information, including subscription or transaction references and payment details that may appear on uploaded receipts; source files may still contain unmasked information.',
  'Estimate inputs and outputs, replacement-price assumptions, listing views, sale outcomes supplied by users, and account-linked product activity used for administration and product improvement.',
  'Push notification subscriptions, delivery and read status, device permissions and location readings submitted through enabled features.',
  'Technical information, including IP address, browser and device information, session data, security events, pages used and diagnostic logs.',
];

const rightsList = [
  'ask whether we hold personal information about you and request access to it;',
  'request correction or updating of inaccurate, incomplete or outdated information;',
  'request deletion or destruction where we are no longer authorised or required to keep the information;',
  'object to processing where applicable, or withdraw consent where processing depends on consent;',
  'opt out of direct marketing communications at any time; and',
  'complain to the Information Regulator if you believe your information has been handled unlawfully.',
];

export default async function PrivacyPolicyPage() {
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
        </div>
      </section>

      <section className={styles.articleShell}>
        <div className={styles.documentLayout}>
          <nav className={styles.contents} aria-label="Privacy Policy contents">
            <div className={styles.contentsHeader}>
              <h2>Quick access</h2>
              <p>Jump to a section</p>
            </div>
            <div className={styles.contentsLinks} tabIndex={0} role="region" aria-label="Scroll through sections">
              {contents.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <article className={styles.article}>
            <div className={styles.metaRow}>
              <span>Last updated: {LAST_UPDATED}</span>
              <span>Applies to Aim4price websites, accounts and related services</span>
            </div>

            <div className={styles.rolePanel}>
              <strong>The key privacy distinction</strong>
              <p>
                Aim4price operates the platform, while an owner or organisation controls who may
                access its Asset Register. A professional invited into a record is also responsible
                for using that information lawfully and only for the agreed purpose.
              </p>
            </div>

            <section id="scope" className={styles.section}>
              <h2>1. Scope and responsibility</h2>
              <p>
                Aim4price is the trading name used by Kuyler Chris Geldenhuys, an individual
                operating in South Africa. Aim4price is not currently an incorporated company or a
                VAT-registered vendor. In this policy, "Aim4price", "we" and "us" refer to that
                operator. Contact: aim4price@gmail.com; telephone +27 62 572 1650.
              </p>
              <p>
                This policy covers our website, Owner, Dealer, Middleman and Field Manager
                experiences, estimates, Asset Registers, Document Vault, budgets, costs, fuel,
                maintenance, reports, Ad Studio, showrooms, Invoice Drop, Discovery and Marketplace,
                and professional workspaces where enabled. It also applies to people whose
                information is supplied by an account holder or a public contributor.
              </p>
              <p>
                We act as the responsible party when we determine the purposes and means of account
                administration, service security, billing and our own lawful product improvement.
                Where we process client, staff or business records solely on a customer's
                instructions, that customer is the responsible party and we act as operator. A
                dealer, accountant, broker or other professional may separately be responsible for
                their own records and decisions. Responsibilities depend on the actual processing,
                not simply the account label.
              </p>
              <p>
                Reading or acknowledging this policy is not blanket consent to all processing. Where
                a particular use requires consent, we must obtain that consent separately.
              </p>
            </section>

            <section id="information" className={styles.section}>
              <h2>2. Information we collect</h2>
              <p>
                The information depends on the features and role you use. It may include:
              </p>
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
                We receive information from you; account owners and their authorised staff, Dealers
                and Field Managers; professional collaborators; uploaded documents and photos;
                public Invoice Drop contributors; and your use of the platform. Catalogue research,
                public business listings and user-supplied market information may also inform the
                service. A public business listing does not mean the business is an Aim4price
                subscriber or has authorised marketing.
              </p>
              <p>
                Invoice Drop can collect sender contact details, the destination code, files,
                allocation instructions and technical abuse-prevention information from a person
                without an account. The intended owner and authorised Aim4price capture staff may
                receive that submission. Do not include unrelated personal information. An upload
                code permits the intended submission; it does not grant access to the owner's entire
                register.
              </p>
              <p>
                If you supply information about another person, you must have a lawful basis, give
                any required notice and obtain any required permission. This obligation does not
                remove Aim4price's own privacy responsibilities. Only provide records reasonably
                needed for the selected service.
              </p>
            </section>

            <section id="purposes" className={styles.section}>
              <h2>4. Why we use information</h2>
              <p>
                We use information to create and operate accounts; link records to the correct asset
                and authorised users; calculate estimates; produce reports; capture invoices and
                fuel slips; manage budgets and maintenance; process requested sharing, listings and
                enquiries; deliver notifications; support customers; and administer agreed fees and
                partner arrangements.
              </p>
              <p>
                Contract performance supports processing necessary to deliver a service to a person
                who is party to that contract. Legal duties may require particular records.
                Legitimate interests can support proportionate security, fraud prevention,
                troubleshooting, service administration and compatible product improvement, after
                considering the rights and reasonable expectations of affected people. Consent is
                used where required, including relevant optional disclosures and marketing. We do
                not assume that a customer's contract supplies a lawful basis for every person
                mentioned in their files.
              </p>
              <p>
                We do not sell personal information or private customer documents. We do not make a
                private register available to another customer merely because that customer could
                benefit from it. The improvement rules below limit our use of customer information.
              </p>
            </section>

            <section id="improvement" className={styles.section}>
              <h2>4.1. Using data to improve Aim4price</h2>
              <p>
                We may analyse asset specifications, age, usage, condition, replacement-price
                inputs, estimate results, maintenance and cost patterns, and user-reported listing
                or sale outcomes to improve catalogue coverage, pricing assumptions, depreciation
                methods, data quality, reports and usability. Asking prices and unverified sale
                reports are not treated as confirmed transaction evidence. Product activity and
                error information also help us understand which features work and investigate
                faults.
              </p>
              <p>
                Some operational and estimate history is initially linked to an account and can be
                reviewed by authorised administrators. It is personal information where a person or
                business can be identified. We limit identifiable review to a necessary, lawful
                purpose; replacing a name with an account ID or hash does not make a record
                anonymous.
              </p>
              <p>
                For reusable benchmarks, statistical research and model development, we use
                genuinely de-identified or aggregated information wherever practicable. We must
                remove or generalise names, contact details, account identifiers, serial numbers,
                VINs, exact locations and other identifying combinations; assess unusual assets and
                small groups; and avoid outputs from which a customer or confidential transaction
                can reasonably be identified. We do not attempt to re-identify de-identified
                records.
              </p>
              <p>
                Private source documents, identities, signatures, payment details and confidential
                notes are not made public or supplied to other customers as training examples. The
                limited content licence does not authorise uploading private records to a third
                party for its own general-purpose AI training. Any proposed new use of identifiable
                information, including AI training, requires a lawful basis, a compatibility and
                risk assessment, appropriate notice and separate consent where required before it
                starts.
              </p>
              <p>
                We may retain and use genuinely de-identified insights after an account closes if
                re-identification is not reasonably foreseeable. Identifiable source records remain
                subject to retention limits and privacy rights. Contact us to object to processing
                where the law permits; a published policy does not waive that right.
              </p>
            </section>

            <section id="collaboration" className={styles.section}>
              <h2>5. Owner-controlled access and collaboration</h2>
              <p>
                An owner or authorised administrator selects sharing and staff permissions.
                Depending on those permissions, Dealers, Middlemen, Field Managers, accountants,
                insurers, financiers or other professionals may receive relevant asset details,
                documents, contact information or workflow history. Authorised Aim4price staff may
                access records to provide requested capture and support, maintain the service,
                investigate security issues and perform the limited administration and improvement
                described here. Private from other customers does not mean inaccessible to the
                platform operator.
              </p>
              <p>
                Access may be limited to particular assets, registers, tasks or document categories.
                Paying for an Owner account or introducing the customer does not itself grant a
                Dealer ownership of the records or permission to view everything. Actions may record
                the acting user, organisation, time, approval and changes for accountability.
              </p>
              <p>
                Revoking access affects future access through the service. It cannot recall
                screenshots, exported files, messages, previously authorised snapshots or offline
                copies. Independent recipients remain responsible for lawful retention and use;
                contact them directly where appropriate and contact us for help identifying a
                recipient. Records do not become public when permission ends.
              </p>
            </section>

            <section id="visibility" className={styles.section}>
              <h2>6. Marketplace, Discovery, sharing and QR visibility</h2>
              <p>
                Publishing a listing, showroom or advert can disclose selected asset details,
                prices, photos, business branding and seller contact or location information to the
                public. These may be indexed, downloaded or reshared outside Aim4price. Review both
                the selected fields and the contents of uploaded files before publishing. Publicly
                available information is still subject to applicable privacy law.
              </p>
              <p>
                Discovery uses participation and access controls to separate discoverable asset
                information from restricted details. A user's enquiry or approved sharing can reveal
                additional contact and asset information. A QR label or shared link may identify an
                asset and open a limited view or require additional access credentials, depending on
                the feature; do not assume that possession of a link provides confidentiality.
              </p>
              <p>
                When you share a report, document, photo or advert through email, WhatsApp, social
                media or your device's sharing tools, the selected recipient or service receives
                that content and handles it under its own practices. Removing the original or
                revoking a link does not delete delivered copies. Do not include identity, banking,
                finance or insurance documents in a public advert.
              </p>
            </section>

            <section id="sharing" className={styles.section}>
              <h2>7. Service providers and other disclosures</h2>
              <p>
                Infrastructure providers support hosting, databases and file storage; messaging
                providers deliver email and push notifications; and development services support
                deployment and diagnostics. These services include Railway infrastructure, private
                S3-compatible file storage, Resend email delivery and browser push services. GitHub
                supports source and deployment workflows; it is not the intended repository for
                customer asset documents. Public maps or links may also contact external providers.
              </p>
              <p>
                Providers may handle account identifiers, delivery addresses, technical logs and the
                content needed for their service. Infrastructure operators and authorised support
                staff may need privileged access. We require appropriate confidentiality, security
                and processing arrangements for providers acting on our behalf, and remain
                responsible for our own obligations. We do not claim end-to-end encryption or that
                only the account owner can ever access stored information.
              </p>
              <p>
                We may disclose information where required by law or reasonably necessary for lawful
                claims, fraud prevention or protection of people and the service. Any transfer to a
                successor operator must have a lawful basis, appropriate safeguards and notice where
                required; incorporation, financing or a sale is not permission to use personal
                information for unrelated purposes.
              </p>
            </section>

            <section id="integrations" className={styles.section}>
              <h2>8. Document capture and external services</h2>
              <p>
                Uploading for Aim4price capture authorises necessary access by capture staff to
                read, match, allocate and verify the submitted material. Processing may include
                extraction tools, security checks and owner approval. Verification of capture is not
                certification that an invoice, claim or underlying transaction is genuine. Source
                files can contain information that is absent from the extracted fields; automated
                masking is not a guarantee that the original file has been redacted.
              </p>
              <p>
                External business referrals can send the asset information and contact details
                selected for the enquiry to a business outside Aim4price. Check the recipient and
                scope. A Google Business link, directory entry or external provider is not
                necessarily connected to or endorsed by Aim4price.
              </p>
              <p>
                Where a connection to another system is offered, the access, purpose and external
                provider must be disclosed before you enable it. This policy does not mean that
                automatic accounting, banking or insurance integrations are currently enabled.
                Disconnecting an integration does not automatically remove imported records or
                copies already delivered to another service.
              </p>
            </section>

            <section id="communications" className={styles.section}>
              <h2>9. Messages, browser storage and usage tracking</h2>
              <p>
                We send necessary account, capture, security, support and requested workflow
                messages. Optional push notifications depend on device permission and available
                account settings. Notification previews can appear on a locked screen; review your
                device settings if they could reveal sensitive activity.
              </p>
              <p>
                Direct marketing is separate from service messages. Electronic marketing requires
                consent or a permitted existing-customer exception that satisfies the applicable
                conditions. A public email address, referral, enquiry or agreement to our Terms of Service
                is not blanket marketing consent. You can object or opt out without losing access to
                unrelated paid features; contact aim4price@gmail.com if a message lacks a working
                opt-out.
              </p>
              <p>
                Cookies and browser storage support sign-in, sessions, preferences, account
                separation and enabled offline functions. We also record first-party activity such
                as completed estimates, saved assets, feature use, listing views and Discovery
                views. Signed-in activity can be linked to a user account and, in administration
                views, associated with a profile or email. Guest listing views may use a
                browser-stored identifier recorded as a hash. That is pseudonymous tracking, not a
                guarantee of anonymity.
              </p>
              <p>
                Browser controls can clear or block storage, but may also sign you out or remove
                unsynchronised work. Clearing browser data does not erase server-side activity
                records. You can contact us about access, deletion or objection. Any optional
                tracking that requires consent must be subject to that consent before use; this
                notice does not itself provide it.
              </p>
            </section>

            <section id="security" className={styles.section}>
              <h2>10. Security and incident response</h2>
              <p>
                We use safeguards appropriate to the information and risks, including authenticated
                access, role and ownership checks, restricted storage access and controls against
                abuse. Security also depends on deployment settings, provider arrangements and
                ongoing operational work. No website, backup or device can be guaranteed free from
                loss, unauthorised access or disruption.
              </p>
              <p>
                Keep credentials, passcodes, invitation links and upload codes secure, use
                individual staff access, review sharing permissions and tell us promptly about
                suspected misuse. Do not upload passwords, full payment-card security details or
                unrelated identity documents. Your security responsibilities do not remove ours.
              </p>
              <p>
                Where there are reasonable grounds to believe personal information has been accessed
                or acquired by an unauthorised person, we will investigate and make notifications to
                the Information Regulator and affected people as required by POPIA, as soon as
                reasonably possible and subject to its permitted notification rules. Where we act as
                an operator, we must notify the relevant responsible party immediately. Report
                suspected incidents to aim4price@gmail.com.
              </p>
            </section>

            <section id="retention" className={styles.section}>
              <h2>10.1. Retention, archiving and deletion</h2>
              <p>
                We keep personal information only for as long as there is a lawful reason connected
                to the service, a legal obligation or a properly justified dispute, security or
                record-keeping need. An archived asset, a sold asset, an inactive account and a
                cancelled subscription are not the same as a deletion request. We do not promise
                indefinite storage or retain identifiable information forever merely because it
                might be useful.
              </p>
              <p>
                Active asset and document records support your ongoing account and authorised
                history. Pending capture submissions remain while matching, review or an owner
                decision is needed. Rejected, abandoned or deleted material must move through the
                applicable cleanup process once no lawful need remains. Limited billing, security,
                audit or dispute evidence may need a different retention period; a lawful hold
                restricts use to that purpose.
              </p>
              <p>
                Account closure and file deletion involve live database records, linked copies and
                object-storage cleanup. Some file workflows use a recovery delay before permanent
                object deletion; removal from the account does not mean every stored byte disappears
                immediately. Backup copies can persist through the applicable backup cycle and must
                not be reused for ordinary product improvement. If a backup is restored, applicable
                deletion and access restrictions must be reapplied.
              </p>
              <p>
                You may request deletion or the retention reason and applicable period for a
                particular category at aim4price@gmail.com. We will assess the request, explain any
                lawful exception and delete, restrict or de-identify information as required. We may
                retain minimal evidence of the request and its outcome. Export records you need
                before closure; contact us if access restrictions prevent a lawful export. We cannot
                erase independent recipients' copies directly.
              </p>
            </section>

            <section id="devices" className={styles.section}>
              <h2>10.2. Offline copies, GPS and sensitive information</h2>
              <p>
                Where enabled, offline work stores an asset snapshot and queued updates or photos on
                the device until synchronisation or local removal. The Field Manager offline feature
                uses a PIN-protected encrypted local copy. Other downloads, browser caches and
                exported reports are not automatically covered by that protection. Revocation on the
                server cannot immediately remove or lock a disconnected device's copy.
              </p>
              <p>
                GPS and location features can record asset or device coordinates, timestamps and the
                user submitting them. Device permission and the feature's controls govern
                collection; repeated submissions can build a location history. Asset locations and
                activity can also reveal a person's movements. Account holders must notify workers
                and obtain any required authority; this is not permission for covert tracking.
              </p>
              <p>
                The service is intended for adults. Do not upload children's information or special
                personal information, such as health, biometric or criminal-history records, unless
                necessary for an expressly supported purpose and lawfully authorised. Sensitive
                material incidentally included in insurance or other documents should be minimised
                or redacted before upload. Contact us if such information has been supplied
                unnecessarily.
              </p>
            </section>

            <section id="transfers" className={styles.section}>
              <h2>11. Cross-border processing and automated tools</h2>
              <p>
                Hosting, storage, email, push delivery, support and a recipient you choose may
                involve processing outside South Africa. We do not promise South Africa-only
                storage. A cross-border transfer must satisfy an applicable POPIA transfer ground,
                such as adequate protection under a binding agreement, qualifying contractual
                necessity or valid consent where applicable. We must assess onward transfers and any
                additional requirements for sensitive or children's information, rather than
                treating use of the website as consent to every transfer.
              </p>
              <p>
                Contact us for the providers, destinations and safeguards relevant to your
                information. Provider locations and deployed storage settings must be considered
                when arranging a service that has particular residency requirements.
              </p>
              <p>
                Estimates, price projections, matching and other automated outputs support human
                decisions. Aim4price does not make final lending, insurance, legal or employment
                decisions. You can ask us to review an apparent input or processing error and
                explain the relevant estimate assumptions. Any future automated decision with legal
                or substantial effects requires the safeguards applicable to that processing.
              </p>
            </section>

            <section id="rights" className={styles.section}>
              <h2>12. Your privacy rights</h2>
              <p>
                Subject to applicable law, including POPIA, you may:
              </p>
              <ul className={styles.list}>
                {rightsList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                We may need to verify your identity and authority before completing a request. A
                request may also be limited where another person&apos;s rights or a legal retention duty
                applies. We will explain the outcome and applicable review or complaint options.
                A person does not need an Aim4price account to exercise their privacy rights.
              </p>
            </section>

            <section id="contact" className={styles.section}>
              <h2>13. Contact, complaints and policy changes</h2>
              <p>
                For a privacy request, objection or incident, contact Kuyler Chris Geldenhuys at{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. You may also submit a complaint
                to the{' '}
                <a href="https://inforegulator.org.za/complaints/">Information Regulator of South Africa</a> (enquiries@inforegulator.org.za; 010 023 5200). You do not have to resolve a POPIA complaint with us first.
              </p>
              <p>
                We may update this policy as Aim4price and its account roles develop. Material changes
                will be brought to affected users' attention as required before the new processing starts.
                New purposes are not retrospectively authorised by changing this page. Where consent is
                required, we will seek it separately. The date above identifies this policy version.
              </p>

              <div className={styles.linkRow}>
                <Link href="/terms-of-service" className={styles.documentLink}>
                  Read Terms of Service
                </Link>
                <Link href="/" className={styles.documentLink}>
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
