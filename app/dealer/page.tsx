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
  description: string;
  href: string;
  count?: number;
};

function ToolCard({ tool }: { tool: DealerHomeTool }) {
  return (
    <Link className={styles.card} href={tool.href}>
      <span className={styles.cardCopy}>
        <strong>{tool.label}</strong>
        <small>{tool.description}</small>
      </span>
      {tool.count ? <span className={styles.cardCount}>{tool.count > 99 ? '99+' : tool.count}</span> : null}
      <span className={styles.cardArrow} aria-hidden="true">›</span>
    </Link>
  );
}

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
      label: 'Notifications',
      description: unreadMaintenanceCount ? 'New maintenance updates are waiting.' : 'Maintenance updates and reminders.',
      href: '/dealer/notifications',
      count: unreadMaintenanceCount,
    },
    {
      label: 'Leads',
      description: newLeadCount ? 'New client requests need a look.' : 'Review and manage client requests.',
      href: '/dealer/leads',
      count: newLeadCount,
    },
    {
      label: 'Maintenance',
      description: attentionCount ? 'Shared equipment needs attention.' : 'Track shared equipment and schedules.',
      href: '/dealer/maintenance',
      count: attentionCount,
    },
    {
      label: 'Discovery',
      description: 'Find participating assets nearby.',
      href: '/dealer/discovery',
    },
  ];

  const dealerTools: DealerHomeTool[] = [
    { label: 'Clients', description: 'See each client, their leads and tracked assets.', href: '/dealer/clients' },
    { label: 'Get Estimate', description: 'Create a clear equipment estimate.', href: '/dealer/valuation' },
    { label: 'Client Costs', description: 'Capture costs against client equipment.', href: '/dealer/cost' },
    { label: 'Marketplace', description: 'Browse and manage marketplace activity.', href: '/dealer/marketplace' },
  ];

  return (
    <main className={styles.shell}>
      <div className={styles.content}>
        <header className={styles.launcherIntro}>
          <span className={styles.eyebrow}>Dealer App</span>
          <h1 className={styles.brand}>What needs attention?</h1>
          <p className={styles.helper}>Open one clear workspace at a time.</p>
        </header>

        <section className={styles.toolSection}>
          <div className={styles.toolSectionHeader}>
            <h2>Work</h2>
            <span>Today</span>
          </div>
          <nav className={styles.launcher} aria-label="Dealer work">
            {workTools.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
          </nav>
        </section>

        <section className={styles.toolSection}>
          <div className={styles.toolSectionHeader}>
            <h2>More dealer tools</h2>
          </div>
          <nav className={styles.launcher + ' ' + styles.secondaryLauncher} aria-label="More dealer tools">
            {dealerTools.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
          </nav>
        </section>
      </div>
    </main>
  );
}
