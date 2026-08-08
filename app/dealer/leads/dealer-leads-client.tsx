'use client';

import { useEffect, useState } from 'react';
import type { AssetLead } from '../../../lib/partner-access';
import LeadsClient from '../../leads/leads-client';

type DealerLeadsResponse = {
  ok?: boolean;
  dealerUserId?: string;
  leads?: AssetLead[];
};

export default function DealerLeadsClient({
  dealerUserId,
  initialLeads,
}: {
  dealerUserId: string;
  initialLeads: AssetLead[];
}) {
  const [hydratedLeads, setHydratedLeads] = useState<AssetLead[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function hydrate() {
      try {
        const response = await fetch('/api/dealer/leads', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as DealerLeadsResponse | null;
        if (!response.ok || !payload?.ok || !Array.isArray(payload.leads)) return;
        if (payload.dealerUserId && payload.dealerUserId !== dealerUserId) return;
        setHydratedLeads(payload.leads);
      } catch {
        // Keep the server-rendered first batch if background hydration fails.
      }
    }

    void hydrate();
    return () => controller.abort();
  }, [dealerUserId]);

  const leads = hydratedLeads ?? initialLeads;

  return (
    <LeadsClient
      key={hydratedLeads ? 'dealer-leads-hydrated' : 'dealer-leads-initial'}
      dealerAppMode
      initialLeads={leads}
      initialLeadsHaveMore={false}
      initialSessionUserId={dealerUserId}
    />
  );
}
