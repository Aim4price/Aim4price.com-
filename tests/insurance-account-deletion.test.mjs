import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migration = read('database/migrations/78-insurance-share-deletion-cascade.sql');
const accountDeletion = read('lib/account-deletion.ts');
const insuranceWorkspaces = read('lib/insurance-workspaces.ts');

test('insurance snapshot revisions cascade when their source share is deleted', () => {
  assert.match(
    migration,
    /DROP CONSTRAINT IF EXISTS insurance_snapshot_revisions_source_share_id_fkey/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \(source_share_id\)[\s\S]*?REFERENCES public\.asset_leads\(id\)[\s\S]*?ON DELETE CASCADE/,
  );
});

test('admin account deletion clears insurance dependants before asset leads', () => {
  const revisionDelete = accountDeletion.indexOf('delete from insurance_snapshot_revisions');
  const workspaceDelete = accountDeletion.indexOf('delete from insurance_workspaces');
  const leadDelete = accountDeletion.indexOf('delete from asset_leads where owner_user_id');

  assert.ok(revisionDelete >= 0);
  assert.ok(workspaceDelete > revisionDelete);
  assert.ok(leadDelete > workspaceDelete);
});

test('single insurance-share deletion is safe before and after the migration is applied', () => {
  const functionStart = insuranceWorkspaces.indexOf('export async function deleteInsuranceShare');
  const deletionFlow = insuranceWorkspaces.slice(functionStart);
  const revisionDelete = deletionFlow.indexOf('delete from insurance_snapshot_revisions');
  const workspaceDelete = deletionFlow.indexOf('delete from insurance_workspaces');
  const leadDelete = deletionFlow.indexOf('delete from asset_leads');

  assert.ok(functionStart >= 0);
  assert.ok(revisionDelete >= 0);
  assert.ok(workspaceDelete > revisionDelete);
  assert.ok(leadDelete > workspaceDelete);
});
