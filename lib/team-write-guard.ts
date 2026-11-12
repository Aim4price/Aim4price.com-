import type { PoolClient } from 'pg';
import type { OwnerWorkspaceContext } from './owner-workspace-access';
import type { TeamPermission } from './team-access-policy';
import { TeamAccessError } from './team-access-policy';
import { lockTeamPermission, requireTeamAsset, auditTeam } from './team-access';
export type WorkspaceWriteGuard = {before?: (client:PoolClient)=>Promise<void>; after?: (client:PoolClient)=>Promise<void>};
/** Run inside the mutation transaction, before record locks. Revocation and scope changes serialize with writes. */
export function teamWriteGuard(workspace:OwnerWorkspaceContext, permission:TeamPermission, target:{assetId?:string;storageId?:string;fuelSlipId?:string;invoiceId?:string;budgetId?:string;globalBudget?:boolean} = {}):WorkspaceWriteGuard {
  const scope = workspace.team;
  if (!scope) return {};
  return {
    before:async client=>{
      const grant = await lockTeamPermission(client, scope, permission);
      const checkTank = (id:string) => {if (!grant.permissions.viewFuelStorage || grant.fuelStorageIds && !grant.fuelStorageIds.includes(id)) throw new TeamAccessError('Fuel tank unavailable.',404);};
      if (target.assetId) await requireTeamAsset({...scope,grant},target.assetId,client);
      if (target.storageId) checkTank(target.storageId);
      if (target.globalBudget && grant.scope !== 'all') throw new TeamAccessError('Choose an accessible asset.',403);
      if (target.budgetId) {
        const row = (await client.query('SELECT asset_register_item_id FROM asset_cost_budgets WHERE user_id=$1 AND id::text=$2 FOR UPDATE',[grant.ownerId,target.budgetId])).rows[0];
        if (!row) throw new TeamAccessError('Budget unavailable.',404);
        if (row.asset_register_item_id) await requireTeamAsset({...scope,grant},String(row.asset_register_item_id),client);
        else if (grant.scope !== 'all') throw new TeamAccessError('Budget unavailable.',404);
      }
      if (target.invoiceId) {
        const row = (await client.query('SELECT asset_register_item_id,source FROM asset_invoices WHERE user_id=$1 AND id::text=$2 FOR UPDATE',[grant.ownerId,target.invoiceId])).rows[0];
        if (!row || row.source === 'fuel_slip') throw new TeamAccessError('Use the fuel ledger for fuel records.',403);
        await requireTeamAsset({...scope,grant},String(row.asset_register_item_id),client);
      }
      if (target.fuelSlipId) {
        const row = (await client.query('SELECT asset_register_item_id,storage_id FROM fuel_slips WHERE user_id=$1 AND id::text=$2 FOR UPDATE',[grant.ownerId,target.fuelSlipId])).rows[0];
        if (!row) throw new TeamAccessError('Fuel entry unavailable.',404);
        if (row.asset_register_item_id) await requireTeamAsset({...scope,grant},String(row.asset_register_item_id),client);
        if (row.storage_id) checkTank(String(row.storage_id));
      }
    },
    after:async client=>{await auditTeam(client,scope.actor,scope.grant,permission,target.assetId || null,target);},
  };
}
