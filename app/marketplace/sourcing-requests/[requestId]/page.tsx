import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AppHeader from '../../../../components/AppHeader';
import {
  WorkspaceTitlePanel,
  workspaceStyles,
} from '../../../../components/WorkspacePrimitives';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { dealerRoleCan } from '../../../../lib/dealer-app-access';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { getMarketplaceSourcingRequestForAdvertiser } from '../../../../lib/marketplace-sourcing-requests';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MarketplaceSourcingRequestPageProps = {
  params: {
    requestId: string;
  };
};

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not available';

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Johannesburg',
    timeZoneName: 'short',
  }).format(date);
}

function cleanPhoneForTel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const prefix = trimmed.startsWith('+') ? '+' : '';
  return `${prefix}${trimmed.replace(/\D/g, '')}`;
}

function cleanPhoneForWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('27')
    ? digits
    : digits.startsWith('0')
      ? `27${digits.slice(1)}`
      : digits;
  return /^[1-9]\d{7,14}$/.test(normalized) && !/^270+$/.test(normalized)
    ? normalized
    : '';
}

function cleanEmail(value: string): string {
  const firstAddress = value.split(/[;,]/)[0]?.trim() ?? '';
  const bracketMatch = firstAddress.match(/<([^>]+)>/);
  const email = (bracketMatch?.[1] ?? firstAddress).replace(/\s+/g, '');
  return email.includes('@') ? email : '';
}

function whatsappHref(digits: string, requesterName: string, title: string): string {
  const message = `Hi ${requesterName}, I received your Aim4price request about equipment similar to ${title}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function emailHref(email: string, requesterName: string, title: string): string {
  const subject = `Your Aim4price sourcing request for ${title}`;
  const body = `Hi ${requesterName},\n\nI received your Aim4price request about equipment similar to ${title}.\n\n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function statusLabel(status: string): string {
  if (status === 'pending') return 'New request';
  if (status === 'viewed') return 'Viewed';
  if (status === 'declined') return 'Declined';
  if (status === 'closed') return 'Closed';
  return 'Request received';
}

function statusClass(status: string): string {
  if (status === 'pending') return workspaceStyles.statusCopper;
  if (status === 'declined') return workspaceStyles.statusDanger;
  if (status === 'closed') return workspaceStyles.statusGreen;
  return workspaceStyles.statusBlue;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3.25a8.25 8.25 0 0 0-7.13 12.4l-1.12 4.6 4.67-1.23A8.25 8.25 0 1 0 12 3.25Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.15 7.25c.23-.24.57-.3.86-.15l1.1.56c.3.15.46.49.39.81l-.3 1.29c-.06.27.02.55.22.75l1.07 1.07c.2.2.48.28.75.22l1.29-.3c.32-.07.66.09.81.39l.56 1.1c.15.29.09.63-.15.86l-.83.83c-.6.6-1.5.83-2.3.56a10.5 10.5 0 0 1-6.8-6.8c-.27-.8-.04-1.7.56-2.3l.83-.83Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export default async function MarketplaceSourcingRequestPage({
  params,
}: MarketplaceSourcingRequestPageProps) {
  const session = await getServerSession({
    allowDealerApp: true,
    allowOwnerApp: true,
  });
  if (!session?.user?.id) redirect('/auth#login');

  const dealerAppSession = await getDealerAppSession();
  if (
    dealerAppSession
    && !dealerRoleCan(dealerAppSession.role, 'discovery')
  ) {
    redirect('/dealer');
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (
    profile.accountStatus !== 'active'
    || !['owner', 'dealer'].includes(profile.accountType)
  ) {
    redirect('/account');
  }

  const request = await getMarketplaceSourcingRequestForAdvertiser({
    advertiserUserId: session.user.id,
    requestId: text(params.requestId),
  });
  if (!request) notFound();

  const requesterName = text(request.requesterName) || 'Aim4price user';
  const requesterPhone = text(request.requesterPhone);
  const requesterPhoneForTel = cleanPhoneForTel(requesterPhone);
  const requesterPhoneForWhatsApp = cleanPhoneForWhatsApp(requesterPhone);
  const requesterEmail = cleanEmail(text(request.requesterEmail));
  const requestMessage = text(request.message);
  const title = text(request.title) || 'Marketplace equipment';
  const hasContactAction = Boolean(
    requesterPhoneForTel || requesterPhoneForWhatsApp || requesterEmail,
  );

  return (
    <main className={`${workspaceStyles.page} ${styles.page}`}>
      <AppHeader active="marketplace" />

      <section className={`${workspaceStyles.shell} ${styles.shell}`}>
        <WorkspaceTitlePanel title="Marketplace sourcing request" />

        <Link
          href="/asset-discovery?view=recently-advertised"
          className={styles.backLink}
        >
          <span aria-hidden="true">←</span>
          Back to recently advertised equipment
        </Link>

        <article className={`${workspaceStyles.card} ${styles.requestCard}`} aria-labelledby="sourcing-request-title">
          <header className={styles.requestHeader}>
            <div className={styles.requestHeading}>
              <span className={styles.eyebrow}>Marketplace discovery</span>
              <h2 id="sourcing-request-title">{title}</h2>
              <p>
                {requesterName} would like to know whether you can help source
                this or similar equipment.
              </p>
            </div>

            <span className={`${workspaceStyles.statusPill} ${styles.statusPill} ${statusClass(request.status)}`}>
              {statusLabel(request.status)}
            </span>
          </header>

          <div className={styles.requestMeta}>
            <div>
              <span>Request from</span>
              <strong>{requesterName}</strong>
            </div>
            <div>
              <span>Received</span>
              <strong>
                <time dateTime={request.createdAtIso}>
                  {formatDate(request.createdAtIso)}
                </time>
              </strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{statusLabel(request.status)}</strong>
            </div>
          </div>

          <div className={styles.contentGrid}>
            <section className={styles.contactPanel} aria-labelledby="requester-contact-heading">
              <div className={styles.sectionHeading}>
                <span aria-hidden="true">01</span>
                <div>
                  <h3 id="requester-contact-heading">Requester contact</h3>
                  <p>Reply directly using the details they chose to share.</p>
                </div>
              </div>

              <dl className={styles.contactDetails}>
                <div>
                  <dt>Name</dt>
                  <dd>{requesterName}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{requesterPhone || 'Not shared'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{requesterEmail || 'Not shared'}</dd>
                </div>
              </dl>

              {hasContactAction ? (
                <nav className={styles.contactActions} aria-label={`Contact ${requesterName}`}>
                  {requesterPhoneForTel || requesterPhoneForWhatsApp ? (
                    <>
                      {requesterPhoneForWhatsApp ? (
                        <a
                          href={whatsappHref(requesterPhoneForWhatsApp, requesterName, title)}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.primaryAction}`}
                          aria-label={`Reply to ${requesterName} on WhatsApp (opens in a new tab)`}
                        >
                          <WhatsAppIcon className={styles.whatsappIcon} />
                          <span>Reply on WhatsApp</span>
                        </a>
                      ) : null}
                      {requesterPhoneForTel ? (
                        <a
                          href={`tel:${requesterPhoneForTel}`}
                          className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${styles.secondaryAction}`}
                        >
                          Call requester
                        </a>
                      ) : null}
                    </>
                  ) : null}
                  {requesterEmail ? (
                    <a
                      href={emailHref(requesterEmail, requesterName, title)}
                      className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${styles.secondaryAction}`}
                    >
                      Email requester
                    </a>
                  ) : null}
                </nav>
              ) : (
                <p className={styles.noContactNote}>
                  The requester did not share a phone number or email address.
                </p>
              )}
            </section>

            <div className={styles.messageColumn}>
              <section className={styles.messagePanel} aria-labelledby="request-message-heading">
                <div className={styles.sectionHeading}>
                  <span aria-hidden="true">02</span>
                  <div>
                    <h3 id="request-message-heading">Request message</h3>
                    <p>What the requester asked through Aim4price.</p>
                  </div>
                </div>
                <blockquote>
                  {requestMessage || `Could you help source equipment similar to ${title}?`}
                </blockquote>
              </section>

              <aside className={styles.privacyPanel} aria-labelledby="request-privacy-heading">
                <span className={styles.privacyIcon} aria-hidden="true">✓</span>
                <div>
                  <h3 id="request-privacy-heading">Shared with their permission</h3>
                  <p>
                    {requesterName} sent this sourcing request and chose to share
                    these Marketplace contact details with you. Your own private
                    contact details have not been disclosed.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
