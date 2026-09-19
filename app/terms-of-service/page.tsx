import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from '../legal-page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAST_UPDATED = '19 September 2026';
const CONTACT_EMAIL = 'aim4price@gmail.com';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms for Aim4price accounts, Asset Registers, reports, role-based collaboration and marketplace services.',
};

const contents = [
  ['acceptance', 'Acceptance and authority'],
  ['operator', 'Who operates Aim4price'],
  ['service', 'The Aim4price service'],
  ['accounts', 'Accounts and roles'],
  ['control', 'Asset Register control'],
  ['professionals', 'Professional contributions'],
  ['estimates', 'Estimates and reports'],
  ['records', 'Asset records and documents'],
  ['marketplace', 'Marketplace and Discovery'],
  ['integrations', 'Invoice Drop and connected services'],
  ['content', 'User content and platform rights'],
  ['processing', 'Processing customer records'],
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
  'probe security, gain unauthorised access, introduce harmful code or interfere with normal operation;',
  'scrape, copy, reverse engineer or commercially exploit the platform or its data except where law or a written agreement permits it; or',
  'use Aim4price to send spam, conduct unlawful direct marketing or facilitate an unlawful transaction.',
];

export default async function TermsOfServicePage() {
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
                to their decision. Read sections 5 to 9, 13 and 15 carefully for risk and responsibility provisions.
                Sections 10 and 10.1 explain content use and processing; section 12 covers fees and
                cancellation. These terms do not waive mandatory consumer or privacy rights.
              </p>
            </div>

            <section id="acceptance" className={styles.section}>
              <h2>1. Acceptance, capacity and authority</h2>
              <p>
                These terms govern use of Aim4price. Before creating an account or ordering a paid
                service, read them together with the Privacy Policy and the specific quote or plan
                terms. Acknowledging the Privacy Policy records that it has been brought to your
                attention; it is not blanket consent to marketing, publication of private records or
                unrelated use of personal information.
              </p>
              <p>
                You must be at least 18 and legally capable of contracting. If acting for a
                business, owner or client, you must have authority for that action and must not
                grant access or accept obligations beyond that authority. An invitation or a Dealer
                paying a fee does not, by itself, establish that the Owner has accepted these terms
                or authorised access.
              </p>
            </section>

            <section id="operator" className={styles.section}>
              <h2>1.1. The operator and contracting party</h2>
              <p>
                Aim4price is the trading name of Kuyler Chris Geldenhuys, an individual operating in
                South Africa. It is not currently an incorporated company or a VAT-registered
                vendor. References to Aim4price, we or us mean this operator, not a separate
                limited-liability company.
              </p>
              <p>
                Website: https://www.aim4price.com. Email for support, contractual notices and
                privacy requests: aim4price@gmail.com. Telephone: +27 62 572 1650. Any future change
                of operator will be communicated with the relevant legal identity and effective
                date; it will not retrospectively remove accrued rights or authorise unrelated data
                use.
              </p>
            </section>

            <section id="service" className={styles.section}>
              <h2>2. The Aim4price service</h2>
              <p>
                Aim4price provides digital tools for asset estimates, Asset Registers, documents,
                values, costs, fuel, maintenance, licensing, finance, insurance, accounting-related
                records, budgets, reports, QR-linked information, Invoice Drop, assisted capture,
                Document Vault, Ad Studio, showrooms, mobile and offline tools, collaboration,
                Discovery and Marketplace.
                Features may differ by account type, role, subscription and stage of development.
              </p>
              <p>
                Aim4price supports the asset lifecycle. It does not replace the official records,
                professional systems or regulated responsibilities of accountants, banks, insurers,
                brokers, dealers, auctioneers, licensing specialists or other professionals.
              </p>
            </section>

            <section id="accounts" className={styles.section}>
              <h2>3. Accounts, organisations and roles</h2>
              <p>
                You must provide accurate account information, protect your login credentials and
                promptly report suspected unauthorised use. Use individual authorised access and do not share an Owner password with a Dealer.
                You must take reasonable steps to prevent misuse; you are not automatically liable
                for an incident caused by Aim4price's failure to meet its own obligations.
              </p>
              <p>
                An organisation or account administrator may invite staff and professionals, assign
                roles, change permissions and remove access. Each person must use an individual
                account where required and may access only the information and functions authorised
                for that role.
              </p>
            </section>

            <section id="control" className={styles.section}>
              <h2>4. Owner-controlled Asset Registers</h2>
              <p>
                The owner or authorised administrator controls the Asset Register and decides who may
                view or contribute to it. Granting access does not transfer ownership of the asset or
                make Aim4price the owner, custodian, agent or manager of the underlying asset.
              </p>
              <p>
                Owners must review permissions regularly. Removing access restricts future online access, but cannot recall completed reports,
                authorised snapshots, messages, downloaded files or disconnected offline copies.
                Recipients remain bound by privacy, confidentiality and purpose limitations.
              </p>
              <p>
                Dealer funding, referral attribution and permission to manage an account are
                separate. Paying for an account does not transfer control of the Owner's records. An
                authorised Dealer must act under their own identity and within the approved scope.
                If funding ends, continuation, notice and any read-only period follow the agreed
                plan and applicable law; the Owner may contact Aim4price about independent access
                and export.
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
                Estimated values, ranges, projections and reports depend on the
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
              <h2>7. Asset records, maintenance and reports</h2>
              <p>
                An Asset Register organises information supplied by users and connected services. It
                is not by itself proof of legal ownership, registration, title, security interests,
                settlement balance, licence validity, insurance cover, compliance or the authenticity
                of an uploaded document.
              </p>
              <p>
                Users must keep original source documents where required, confirm important figures
                with the relevant institution and correct records when circumstances change. Reports
                should be read with their source information, date, scope and stated limitations.
              </p>
              <p>
                Maintenance reminders, family checklists, fuel balances, budgets, location readings
                and projections depend on correct inputs and timely updates. They do not certify
                mechanical safety, detect every fault, replace a manufacturer's instructions or
                guarantee a notification will arrive. Arrange required inspections and act on safety
                issues independently of a reminder.
              </p>
              <p>
                Asset transfers must be authorised by the relevant parties. Transferring an asset
                record does not itself transfer legal title, settle finance, assign insurance or
                permit disclosure of unrelated personal documents. Review the information included
                before approving a transfer.
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
              <p>
                Ad Studio and showrooms use content and branding supplied or authorised by users.
                You must have rights to the photos, logos and claims you publish. A directory or
                Google Business entry is not proof of a commercial relationship or endorsement. Do
                not infer consent to unsolicited marketing from an enquiry or visible contact
                details. A lead, listing or partner subscription does not guarantee enquiries, sales
                or income.
              </p>
            </section>

            <section id="integrations" className={styles.section}>
              <h2>9. Invoice Drop, assisted capture and connected services</h2>
              <p>
                When you submit an invoice, fuel slip, document or photograph for capture, you
                authorise Aim4price staff and necessary service providers to handle it for that
                task. Supply legible, relevant material and accurate allocation instructions. We may
                request clarification, reject unsafe or unsuitable files and require the Owner's
                approval before a third-party contribution becomes a final record.
              </p>
              <p>
                An upload receipt or pending entry is not confirmation that the item has been added
                to the ledger. Capture verification checks the recording process; it is not an
                audit, certification of authenticity, confirmation of payment or approval of a tax
                deduction. Check final entries and report errors. Aim4price remains responsible for
                the standard of its own paid capture service.
              </p>
              <p>
                Turnaround and charges are those stated when you request the service or in the
                accepted quote. If we cannot meet a stated turnaround, we will communicate the delay
                and available remedy. Nothing here converts a paid service commitment into an
                unlimited discretion to delay. A software subscription does not include unlimited
                staff capture or administration unless expressly agreed.
              </p>
              <p>
                Connected systems, maps, messaging and external sharing services have their own
                terms. A future integration requires the relevant authorisation before access
                begins. Review imported or extracted information and check recipients before
                sharing. We remain responsible for our own integration and provider-selection
                obligations; an external provider's involvement does not waive your statutory
                rights.
              </p>
            </section>

            <section id="content" className={styles.section}>
              <h2>10. Your content and Aim4price improvements</h2>
              <p>
                You retain your rights in uploaded information, photos and documents, subject to the
                rights of other people. You grant Aim4price a non-exclusive licence to store, copy,
                organise, extract, format and display that content to provide the requested service
                and authorised sharing, and to secure and support it. Necessary providers may
                process it for those purposes under appropriate obligations. This is not a transfer
                of ownership or an unrestricted licence to sell private records.
              </p>
              <p>
                We may use relevant information to improve catalogues, estimate methods,
                replacement-price assumptions, data quality and product performance within the
                purposes, lawful bases and safeguards explained in the Privacy Policy, especially{' '}
                <Link href="/privacy-policy#improvement">section 4.1 on data improvement</Link>. Reusable research, statistics and benchmarks should use genuinely
                de-identified or aggregated information. Account IDs and hashes alone do not
                establish de-identification. Private documents are not licensed for a third party's
                own general-purpose AI training.
              </p>
              <p>
                The content licence lasts only while necessary for the agreed service, authorised
                sharing and lawful retention. Genuinely de-identified statistics and insights may
                remain useful after account closure. They must not identify a customer or expose
                confidential records. Aim4price retains rights in its software, branding and
                original methods and outputs, without taking ownership of your source material or
                restricting statutory data rights.
              </p>
            </section>

            <section id="processing" className={styles.section}>
              <h2>10.1. Where Aim4price processes records on your behalf</h2>
              <p>
                For customer-controlled personal information that we handle as an operator, your
                authorised use of the service and written instructions define the processing
                mandate: hosting, organising, updating, reporting, sharing as instructed and
                assisting with deletion or return for the service period. Records can concern
                owners, employees, customers, suppliers and professional contacts. We may question
                or decline an instruction that appears unlawful.
              </p>
              <p>
                We must keep that information confidential, limit staff and provider access to the
                authorised purpose, maintain appropriate security measures, and require appropriate
                written obligations from operators engaged to assist us. We must notify the relevant
                responsible party immediately of a suspected unauthorised access or acquisition
                where POPIA requires it, and reasonably assist with rights requests, incident
                investigation and lawful return, restriction or deletion.
              </p>
              <p>
                Our separate responsible-party processing for accounts, security, billing and
                limited improvement is explained in the Privacy Policy and needs its own lawful
                basis. A customer mandate does not authorise unrestricted reuse of another person's
                information. Contact us before uploading information that needs special processing
                terms or residency arrangements; any agreed written addendum must be consistent with
                applicable law.
              </p>
            </section>

            <section id="acceptable-use" className={styles.section}>
              <h2>11. Acceptable use</h2>
              <p>
                You may not:
              </p>
              <ul className={styles.list}>
                {prohibitedUse.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section id="fees" className={styles.section}>
              <h2>12. Fees, subscriptions, VAT and cancellation</h2>
              <p>
                Before you commit to a paid service, the offer or written quote must identify the
                total price in South African rand, what is included, any active-asset or user
                limits, the billing period, payment method, activation conditions, renewal
                arrangements and cancellation terms. Only an accepted offer creates those charges; a
                planning document, draft price list or possible future feature is not an active
                subscription agreement.
              </p>
              <p>
                Aim4price is not currently VAT registered and does not charge VAT on its own service
                fees. Those charges must not be represented as carrying VAT or as a VAT tax invoice.
                VAT-inclusive or VAT-exclusive views of asset values, customer invoices or
                Marketplace prices relate to those underlying figures and do not change Aim4price's
                own VAT status. Any future VAT-registration change and its effect on fees must be
                disclosed before applicable charges are agreed or renewed.
              </p>
              <p>
                Account setup, data capture, managed administration, travel, inspections and
                professional valuation work may have separate agreed charges. Any prepaid-hour
                expiry, rollover restriction, additional-work rate or travel basis must be disclosed
                before purchase and remain subject to applicable law. A referral commission or
                Dealer-funded discount is governed by the separately accepted partner arrangement;
                it does not grant access to private records.
              </p>
              <p>
                You may send cancellation or billing questions to aim4price@gmail.com. We will
                confirm the effective date and any refund or lawful amount due. Automatic renewal
                requires disclosure in the accepted offer and compliance with applicable notice
                rules; changes to these terms do not authorise an undisclosed debit or immediate
                price increase during a paid period.
              </p>
              <p>
                Applicable cooling-off, cancellation, refund and service-quality rights under South
                African consumer and electronic-transactions law are preserved. Where section 14 of
                the Consumer Protection Act applies, its fixed-term cancellation and expiry rules
                apply, including cancellation on 20 business days' notice and only a reasonable
                permitted cancellation charge. We do not impose a blanket "no refunds" rule or treat
                every annual payment as non-refundable. If a paid service is materially withdrawn
                and cannot be supplied as agreed, we will offer the remedy required by law.
              </p>
            </section>

            <section id="availability" className={styles.section}>
              <h2>13. Availability, changes and third-party services</h2>
              <p>
                We use reasonable efforts to maintain a
                reliable and secure service, but cannot promise uninterrupted access, permanent
                storage or error-free operation. Keep independent copies of records that are legally
                or operationally critical.
              </p>
              <p>
                We may add, improve, restrict or retire features for security, legal, technical or
                commercial reasons. We will give reasonable notice where a change materially affects
                a paid service and notice is practical.
              </p>
              <p>
                Offline changes remain on the device until successfully synchronised. Access
                revocations cannot be applied immediately to a disconnected copy, and clearing
                storage or losing the device may lose unsynchronised work. Use trusted devices,
                protect offline PINs and keep necessary originals. Reminders, email, GPS and push
                delivery depend on network and device availability.
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
                records you are entitled to keep, or contact us for assistance if access is restricted.
                A payment dispute does not remove statutory privacy or access rights. Some information may be retained as explained in
                the Privacy Policy, including lawful audit, dispute and backup records.
              </p>
              <p>
                Cancellation, archiving and deletion are different actions. Private records are not
                made public when an account is suspended. We will give reasonable notice of a
                planned service closure or material removal of stored records where lawful and
                practical, with an opportunity for authorised export. Legal holds, recovery delays,
                backups and recipients' independent copies are addressed in the Privacy Policy;
                there is no promise of either immediate universal erasure or permanent free storage.
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
                These provisions do not excuse Aim4price from its own data-protection, security,
                confidentiality or service-quality duties. Nothing in these terms excludes or limits
                liability for fraud, wilful misconduct,
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
                required. Material changes apply prospectively and require renewed agreement where the law
                or the affected contract requires it. If you do not accept a material change, contact
                us about cancellation and any applicable refund before it takes effect. A change
                cannot retrospectively authorise new data uses or remove accrued rights.
              </p>
              <p>
                Notices and contractual questions may be sent to Aim4price at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Electronic notices may also be
                sent to the email address linked to your account.
              </p>

              <div className={styles.linkRow}>
                <Link href="/privacy-policy" className={styles.documentLink}>
                  Read Privacy Policy
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
