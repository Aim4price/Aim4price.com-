import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { requireOwnerAppPageAccess, ownerAppCan } from '../../../../lib/owner-app-access';
import { managerTeamActor } from '../../../../lib/manager-team-workspace';
import { DesktopWorkspaceProvider } from '../../../../components/DesktopWorkspace';
import FuelClient from '../../../fuel/fuel-client';
import CostsClient from '../../../my-invoices/my-invoices-client';
import MapClient from '../../../asset-map/asset-map-client';
import DocumentsClient from '../../../documents/documents-client';
import MaintenanceClient from '../../../maintenance/maintenance-client';
import OwnerAppNav from '../../owner-app-nav';
import type { TeamPermission } from '../../../../lib/team-access-policy';
import styles from '../../owner-app.module.css';
export const dynamic = 'force-dynamic';
const sections: Record<string, { label: string; permission?: TeamPermission }> = {
  fuel: { label: 'Fuel ledger', permission: 'viewFuel' }, costs: { label: 'Costs', permission: 'viewCosts' },
  budgets: { label: 'Budgets', permission: 'viewBudgets' }, map: { label: 'Asset map', permission: 'viewMap' },
  documents: { label: 'Documents' }, maintenance: { label: 'Maintenance', permission: 'viewMaintenance' },
};
export default async function ManagerWorkspacePage({ params }: { params: { section: string } }) {
  const access = await requireOwnerAppPageAccess();
  const section = sections[params.section];
  if (!section) notFound();
  const allowed = !section.permission || ownerAppCan(access, section.permission);
  const actor = allowed ? await managerTeamActor(access) : null;
  return <div className={styles.page} data-manager-workspace>
    <OwnerAppNav backHref="/owner-app/more"/>
    {!allowed ? <section className={styles.section}><h1>{section.label}</h1><p>Your account holder has not enabled this page for your login.</p></section> :
      <DesktopWorkspaceProvider workspace={{ native: true, membershipId: actor?.managedGrantId || '', managedLogin: true, name: 'Aim4price Manager', accountType: 'owner', displayName: access.displayName, permissions: access.teamPermissions }}>
        <Suspense fallback={<p role="status">Loading {section.label.toLowerCase()}…</p>}>
          {params.section === 'fuel' && <FuelClient addedByLabel={access.displayName}/>}
          {params.section === 'costs' && <CostsClient showAppHeader={false}/>}
          {params.section === 'budgets' && <CostsClient showAppHeader={false} budgetsPage/>}
          {params.section === 'map' && <MapClient/>}
          {params.section === 'documents' && <DocumentsClient/>}
          {params.section === 'maintenance' && <MaintenanceClient/>}
        </Suspense>
      </DesktopWorkspaceProvider>}
  </div>;
}
