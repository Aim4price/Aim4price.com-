import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAttentionClient from './owner-attention-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAttentionPage() {
  await requireOwnerAppPageAccess();
  return <OwnerAttentionClient />;
}
