'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DealerMaintenanceTrackedAsset } from '../lib/dealer-maintenance-tracker';
import type { AssetLead } from '../lib/partner-access';
import styles from './DealerClientsClient.module.css';

type ClientFilter = 'all' | 'new' | 'attention';

type ClientSummary = {
  ownerUserId: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  location: string;
  leads: AssetLead[];
  assets: DealerMaintenanceTrackedAsset[];
  latestActivityIso: string;
};

type Props = {
  dealerUserId: string;
  initialLeads: AssetLead[];
  initialAssets: DealerMaintenanceTrackedAsset[];
  dealerAppMode?: boolean;
};

const ATTENTION_STATUSES = new Set(['overdue', 'due', 'due_soon', 'usage_needed']);

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function latestIso(values: Array<string | null | undefined>): string {
  return values.reduce<string>((latest, value) => {
    const next = clean(value);
    if (!next) return latest;
    if (!latest) return next;
    return Date.parse(next) > Date.parse(latest) ? next : latest;
  }, '');
}

function formatDate(value: string): string {
  if (!value) return 'No recent activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No recent activity';
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function assetTitleFromLead(lead: AssetLead): string {
  return clean(lead.assetSnapshot.title)
    || [clean(lead.assetSnapshot.brandName), clean(lead.assetSnapshot.modelName)].filter(Boolean).join(' ')
    || 'Asset request';
}

function leadStatusLabel(lead: AssetLead): string {
  if (lead.status === 'sent' && !lead.viewedAtIso) return 'New';
  if (lead.status === 'quoted' || lead.status === 'closed') return 'Completed';
  if (lead.status === 'declined') return 'Declined';
  return 'Open';
}

function isNewLead(lead: AssetLead): boolean {
  return lead.status === 'sent' && !lead.viewedAtIso;
}

function needsAttention(asset: DealerMaintenanceTrackedAsset): boolean {
  return ATTENTION_STATUSES.has(asset.status);
}

function makeClient(
  ownerUserId: string,
  source: Partial<ClientSummary>,
): ClientSummary {
  return {
    ownerUserId,
    name: source.name || 'Aim4price client',
    contactName: source.contactName || '',
    phone: source.phone || '',
    email: source.email || '',
    location: source.location || '',
    leads: source.leads || [],
    assets: source.assets || [],
    latestActivityIso: source.latestActivityIso || '',
  };
}

export default function DealerClientsClient({
  dealerUserId,
  initialLeads,
  initialAssets,
  dealerAppMode = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [openClientId, setOpenClientId] = useState<string | null>(null);

  const clients = useMemo(() => {
    const grouped = new Map<string, ClientSummary>();

    initialLeads
      .filter((lead) => lead.partnerUserId === dealerUserId)
      .forEach((lead) => {
        const existing = grouped.get(lead.ownerUserId);
        const location = [lead.ownerTownCity, lead.ownerProvince].map(clean).filter(Boolean).join(', ');
        const next = existing || makeClient(lead.ownerUserId, {
          name: clean(lead.ownerBusinessName) || clean(lead.ownerName),
          contactName: clean(lead.ownerContactName) || clean(lead.ownerName),
          phone: clean(lead.ownerContactPhone) || clean(lead.ownerPhone),
          email: clean(lead.ownerContactEmail) || clean(lead.ownerEmail),
          location,
        });

        next.name = next.name || clean(lead.ownerBusinessName) || clean(lead.ownerName) || 'Aim4price client';
        next.contactName = next.contactName || clean(lead.ownerContactName) || clean(lead.ownerName);
        next.phone = next.phone || clean(lead.ownerContactPhone) || clean(lead.ownerPhone);
        next.email = next.email || clean(lead.ownerContactEmail) || clean(lead.ownerEmail);
        next.location = next.location || location;
        next.leads.push(lead);
        next.latestActivityIso = latestIso([next.latestActivityIso, lead.updatedAtIso, lead.createdAtIso]);
        grouped.set(lead.ownerUserId, next);
      });

    initialAssets.forEach((asset) => {
      const existing = grouped.get(asset.ownerUserId);
      const next = existing || makeClient(asset.ownerUserId, {
        name: clean(asset.ownerName),
        contactName: clean(asset.ownerName),
        phone: clean(asset.ownerPhone),
        email: clean(asset.ownerEmail),
      });

      next.name = next.name || clean(asset.ownerName) || 'Aim4price client';
      next.contactName = next.contactName || clean(asset.ownerName);
      next.phone = next.phone || clean(asset.ownerPhone);
      next.email = next.email || clean(asset.ownerEmail);
      next.assets.push(asset);
      next.latestActivityIso = latestIso([next.latestActivityIso, asset.updatedAtIso, asset.createdAtIso]);
      grouped.set(asset.ownerUserId, next);
    });

    return Array.from(grouped.values())
      .map((client) => ({
        ...client,
        leads: [...client.leads].sort((left, right) => Date.parse(right.updatedAtIso) - Date.parse(left.updatedAtIso)),
        assets: [...client.assets].sort((left, right) => left.assetTitle.localeCompare(right.assetTitle)),
      }))
      .sort((left, right) => Date.parse(right.latestActivityIso) - Date.parse(left.latestActivityIso));
  }, [dealerUserId, initialAssets, initialLeads]);

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const hasNewLead = client.leads.some(isNewLead);
      const hasAttention = client.assets.some(needsAttention);
      if (filter === 'new' && !hasNewLead) return false;
      if (filter === 'attention' && !hasAttention) return false;
      if (!query) return true;

      return [
        client.name,
        client.contactName,
        client.phone,
        client.email,
        client.location,
        ...client.leads.map(assetTitleFromLead),
        ...client.assets.map((asset) => asset.assetTitle),
      ].join(' ').toLowerCase().includes(query);
    });
  }, [clients, filter, search]);

  const clientsWithNewLeads = clients.filter((client) => client.leads.some(isNewLead)).length;
  const clientsNeedingAttention = clients.filter((client) => client.assets.some(needsAttention)).length;
  const leadsHref = dealerAppMode ? '/dealer/leads' : '/leads';
  const maintenanceHref = dealerAppMode ? '/dealer/maintenance' : '/tracking';

  function chooseFilter(nextFilter: ClientFilter) {
    setFilter(nextFilter);
    setOpenClientId(null);
  }

  return (
    <main className={styles.page + (dealerAppMode ? ' ' + styles.dealerApp : '')}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span>Dealer workspace</span>
            <h1>Clients</h1>
            <p>See each client’s requests and tracked equipment in one clear place.</p>
          </div>
          <strong>{clients.length}</strong>
        </header>

        <section className={styles.summary} aria-label="Client summary">
          <button type="button" className={styles.summaryCard + (filter === 'all' ? ' ' + styles.summaryCardActive : '')} onClick={() => chooseFilter('all')} aria-pressed={filter === 'all'}>
            <span>All clients</span>
            <strong>{clients.length}</strong>
            <small>Every current Dealer relationship.</small>
          </button>
          <button type="button" className={styles.summaryCard + ' ' + styles.summaryNew + (filter === 'new' ? ' ' + styles.summaryCardActive : '')} onClick={() => chooseFilter('new')} aria-pressed={filter === 'new'}>
            <span>New leads</span>
            <strong>{clientsWithNewLeads}</strong>
            <small>Clients with a new request.</small>
          </button>
          <button type="button" className={styles.summaryCard + ' ' + styles.summaryAttention + (filter === 'attention' ? ' ' + styles.summaryCardActive : '')} onClick={() => chooseFilter('attention')} aria-pressed={filter === 'attention'}>
            <span>Needs attention</span>
            <strong>{clientsNeedingAttention}</strong>
            <small>Maintenance due or usage needed.</small>
          </button>
        </section>

        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients, assets or contact details" aria-label="Search clients" />
          {search ? <button type="button" onClick={() => setSearch('')} aria-label="Clear client search">×</button> : null}
        </label>

        <div className={styles.resultLine}>
          <span>Showing</span>
          <strong>{visibleClients.length}</strong>
          <span>of {clients.length} clients</span>
        </div>

        {!visibleClients.length ? (
          <div className={styles.empty}>No clients match this search or filter.</div>
        ) : (
          <section className={styles.clientList} aria-label="Dealer clients">
            {visibleClients.map((client) => {
              const isOpen = openClientId === client.ownerUserId;
              const newLeadCount = client.leads.filter(isNewLead).length;
              const attentionCount = client.assets.filter(needsAttention).length;
              const isMuted = Boolean(openClientId && !isOpen);

              return (
                <article key={client.ownerUserId} className={styles.clientCard + (isOpen ? ' ' + styles.clientCardOpen : '') + (isMuted ? ' ' + styles.clientCardMuted : '')}>
                  <div className={styles.clientTop}>
                    <div className={styles.identity}>
                      <span>{isOpen ? 'Client details' : 'Client'}</span>
                      <h2>{client.name}</h2>
                      <p>{[client.contactName, client.location].filter(Boolean).join(' · ') || 'Contact details not yet saved'}</p>
                    </div>
                    <div className={styles.cardActions}>
                      {newLeadCount ? <span className={styles.newBadge}>{newLeadCount} new</span> : null}
                      {attentionCount ? <span className={styles.attentionBadge}>{attentionCount} need attention</span> : null}
                      <button type="button" className={isOpen ? styles.closeButton : styles.openButton} onClick={() => setOpenClientId(isOpen ? null : client.ownerUserId)}>
                        {isOpen ? 'Close' : 'View client'}
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className={styles.details}>
                      <section className={styles.contactPanel}>
                        <div>
                          <span>Phone</span>
                          <strong>{client.phone || 'Not saved'}</strong>
                        </div>
                        <div>
                          <span>Email</span>
                          <strong>{client.email || 'Not saved'}</strong>
                        </div>
                        <div>
                          <span>Latest activity</span>
                          <strong>{formatDate(client.latestActivityIso)}</strong>
                        </div>
                      </section>

                      <div className={styles.workspaceGrid}>
                        <section className={styles.workspacePanel}>
                          <header>
                            <div><span>Requests</span><h3>Leads</h3></div>
                            <strong>{client.leads.length}</strong>
                          </header>
                          {client.leads.length ? (
                            <div className={styles.recordList}>
                              {client.leads.slice(0, 4).map((lead) => (
                                <div className={styles.recordRow} key={lead.id}>
                                  <div><strong>{assetTitleFromLead(lead)}</strong><span>{leadStatusLabel(lead)} · {formatDate(lead.updatedAtIso)}</span></div>
                                </div>
                              ))}
                            </div>
                          ) : <p className={styles.panelEmpty}>No leads for this client.</p>}
                          <Link className={styles.panelLink} href={leadsHref}>Open Leads</Link>
                        </section>

                        <section className={styles.workspacePanel}>
                          <header>
                            <div><span>Shared assets</span><h3>Maintenance</h3></div>
                            <strong>{client.assets.length}</strong>
                          </header>
                          {client.assets.length ? (
                            <div className={styles.recordList}>
                              {client.assets.slice(0, 4).map((asset) => (
                                <Link className={styles.recordRow} href={maintenanceHref + '?open=' + encodeURIComponent(asset.accessId)} key={asset.accessId}>
                                  <div><strong>{asset.assetTitle}</strong><span>{asset.statusLabel}</span></div>
                                  <span aria-hidden="true">›</span>
                                </Link>
                              ))}
                            </div>
                          ) : <p className={styles.panelEmpty}>No tracked equipment for this client.</p>}
                          <Link className={styles.panelLink} href={maintenanceHref}>Open Maintenance</Link>
                        </section>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}
