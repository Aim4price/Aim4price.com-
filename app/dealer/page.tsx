import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import { getAccountProfile } from '../../lib/account-profile';
import {
  listDealerMaintenanceNotifications,
  listDealerTrackedAssets,
} from '../../lib/dealer-maintenance-tracker';
import { listAssetLeadsForUser } from '../../lib/partner-access';
import styles from './dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ATTENTION_STATUSES = new Set(['overdue', 'due', 'due_soon', 'usage_needed']);

type DealerHomeTool = {
  label: string;
  href: string;
  count?: number;
  emptyLabel: string;
  countLabel: string;
  tone: 'leads' | 'maintenance' | 'notifications';
};

function DealerToolIcon({ type }: { type: DealerHomeTool['tone'] }) {
  if (type === 'leads') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.75h16v12.5H4z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m5.2 7 6.8 5.1L18.8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === 'maintenance') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m8.5 14 2.1 2.1 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 6 2.5 6.25 2.5 7.5H4c0-1.25 2.5-1.5 2.5-7.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 19a2.8 2.8 0 0 0 5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WorkCard({ tool }: { tool: DealerHomeTool }) {
  const countText = tool.count ? `${tool.count} ${tool.countLabel}` : tool.emptyLabel;

  return (
    <Link
      className={`${styles.dealerWorkCard} ${styles[`dealerWorkCard${tool.tone[0].toUpperCase()}${tool.tone.slice(1)}`]}`}
      href={tool.href}
      prefetch={false}
      aria-label={`${tool.label}, ${countText}`}
    >
      <span className={styles.dealerWorkIcon}><DealerToolIcon type={tool.tone} /></span>
      <span className={styles.dealerWorkCopy}>
        <strong>{tool.label}</strong>
        <small>{countText}</small>
      </span>
      <span className={styles.dealerWorkArrow} aria-hidden="true">›</span>
    </Link>
  );
}

const DEALER_TOOLS = [
  { label: 'Get Estimate', href: '/dealer/valuation' },
  { label: 'Discover Assets', href: '/dealer/discovery' },
  { label: 'Client Costs', href: '/dealer/cost' },
  { label: 'Marketplace', href: '/dealer/marketplace' },
] as const;

export default async function DealerHome() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/dealer/login');
  }

  const [maintenanceNotifications, leads, trackedAssets] = await Promise.all([
    listDealerMaintenanceNotifications(session.user.id).catch(() => []),
    listAssetLeadsForUser(session.user.id).catch(() => []),
    listDealerTrackedAssets(session.user.id).catch(() => []),
  ]);

  const unreadMaintenanceCount = maintenanceNotifications.filter((notification) => !notification.isRead).length;
  const newLeadCount = leads.filter(
    (lead) => lead.partnerUserId === session.user.id && lead.status === 'sent' && !lead.viewedAtIso,
  ).length;
  const attentionCount = trackedAssets.filter((asset) => ATTENTION_STATUSES.has(asset.status)).length;

  const workTools: DealerHomeTool[] = [
    {
      label: 'Leads',
      href: '/dealer/leads',
      count: newLeadCount,
      emptyLabel: 'No new leads',
      countLabel: newLeadCount === 1 ? 'new lead' : 'new leads',
      tone: 'leads',
    },
    {
      label: 'Maintenance',
      href: '/dealer/maintenance',
      count: attentionCount,
      emptyLabel: 'Nothing needs attention',
      countLabel: attentionCount === 1 ? 'asset needs attention' : 'assets need attention',
      tone: 'maintenance',
    },
    {
      label: 'Notifications',
      href: '/dealer/notifications',
      count: unreadMaintenanceCount,
      emptyLabel: 'All notifications checked',
      countLabel: unreadMaintenanceCount === 1 ? 'new notification' : 'new notifications',
      tone: 'notifications',
    },
  ];

  return (
    <main className={`${styles.shell} ${styles.homeShell}`}>
      <div className={styles.homeContent}>
        <header className={styles.dealerHomeIntro}>
          <span>Dealer App</span>
          <h1>What needs attention?</h1>
          <p>Open one workspace and take the next clear action.</p>
        </header>

        <nav className={styles.dealerWorkGrid} aria-label="Dealer work">
          {workTools.map((tool) => <WorkCard key={tool.href} tool={tool} />)}
        </nav>

        <nav className={styles.dealerToolGrid} aria-label="Dealer tools">
          {DEALER_TOOLS.map((tool) => (
            <Link key={tool.href} className={styles.dealerToolCard} href={tool.href} prefetch={false}>
              <strong>{tool.label}</strong>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
