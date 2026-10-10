import type { NextRequest } from 'next/server';
import { appMaintenanceChecklist } from '../../../../../../lib/app-maintenance-checklist-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest, { params }: { params: { assetId: string } }) {
  return appMaintenanceChecklist(request, 'owner', params.assetId);
}
export const POST = GET;
export const DELETE = GET;
