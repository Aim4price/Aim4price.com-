import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const tracker = read('lib/dealer-maintenance-tracker.ts');
const leads = read('app/leads/leads-client.tsx');
const dealerRoute = read('app/api/dealer/maintenance/schedule-proposals/route.ts');
const ownerRoute = read('app/api/dealer-maintenance-schedule-proposals/[proposalId]/route.ts');
const notifications = read('lib/notifications.ts');
const ownerNotifications = read('app/owner-app/notifications/owner-notifications-client.tsx');
const accessSettings = read('components/DealerMaintenanceAccessSettings.tsx');
const ownerShare = read('app/asset-register/asset-register-client.tsx');
const scheduleModal = read('components/DealerMaintenanceScheduleModal.tsx');
const trackerClient = read('components/DealerMaintenanceTrackerClient.tsx');

test('new tracking shares enable reports and dealer schedule proposals without requiring an existing schedule', () => {
  assert.match(tracker, /can_view_maintenance_reports,\s*can_create_maintenance_schedules/);
  assert.match(tracker, /values \(\$1, \$2, \$3::uuid, \$4, \$5, \$6, true, true, true/);
  assert.doesNotMatch(tracker, /export async function assertAssetHasOpenMaintenance/);
});

test('My Leads exposes the owner-style maintenance report and schedule creation action', () => {
  assert.match(leads, /<WorkspaceTitlePanel title="LEAD MANAGEMENT SYSTEM" \/>/);
  assert.match(leads, /<h1>LEAD MANAGEMENT SYSTEM<\/h1>/);
  assert.match(leads, /<strong>PDF reports<\/strong>/);
  assert.match(leads, /assetReportOptionsGrid/);
  assert.match(leads, /<strong>Download asset valuation<\/strong>/);
  assert.match(leads, /<strong>Download maintenance report<\/strong>/);
  assert.match(leads, /<strong>Send a proposed schedule<\/strong>/);
  assert.match(leads, /DealerMaintenanceReportModal/);
  assert.match(leads, /DealerMaintenanceScheduleModal/);
});

test('Tracking uses the same proposed schedule helper text as My Leads', () => {
  assert.match(leads, /The owner can approve or disapprove it\./);
  assert.match(trackerClient, /The owner can approve or disapprove it\./);
  assert.doesNotMatch(trackerClient, /Send a proposed schedule for owner approval\./);
});

test('empty shared assets stay in My Leads until approved maintenance exists', () => {
  assert.match(tracker, /hasMaintenanceRecords: Boolean\(row\.has_maintenance_records\)/);
  assert.match(tracker, /asset !== null && asset\.maintenanceRecords\.length > 0/);
  assert.match(leads, /lead\.maintenanceAccess\?\.hasMaintenanceRecords/);
});

test('dealer proposal wizard reuses the owner maintenance flow without the asset picker', () => {
  assert.match(scheduleModal, /from '\.\.\/app\/maintenance\/page\.module\.css'/);
  assert.match(scheduleModal, />What are you scheduling\?</);
  assert.match(scheduleModal, />When should it be due\?</);
  assert.match(scheduleModal, /maintenanceChoiceGrid/);
  assert.match(scheduleModal, /maintenanceFieldGrid/);
  assert.match(scheduleModal, /'Send proposal'/);
  assert.doesNotMatch(scheduleModal, /Choose asset for maintenance/);
});

test('dealer proposal creation is bound to the active share, permission and exact lead asset', () => {
  assert.match(tracker, /access\.dealer_user_id = \$1 and access\.id = \$2::uuid and access\.is_active = true/);
  assert.match(tracker, /canCreateMaintenanceSchedules/);
  assert.match(tracker, /owner_user_id = \$2[\s\S]*partner_user_id = \$3[\s\S]*asset_register_item_id = \$4::uuid/);
  assert.match(dealerRoute, /getServerSession\(\{ allowDealerApp: true \}\)/);
});

test('owner approval atomically creates the official maintenance record', () => {
  assert.match(tracker, /for update of proposal/);
  assert.match(tracker, /insert into public\.asset_maintenance_records/);
  assert.match(tracker, /created_maintenance_record_id = \$4::uuid/);
  assert.match(tracker, /await client\.query\('commit'\)/);
  assert.match(tracker, /await client\.query\('rollback'\)/);
  assert.match(ownerRoute, /getServerSession\(\{ allowOwnerApp: true \}\)/);
});

test('disapproved schedules remain dealer-only and disappear from owner notifications', () => {
  assert.match(tracker, /proposal\.proposal_status = 'pending'/);
  assert.match(tracker, /nextStatus[\s\S]*'approved'[\s\S]*'declined'/);
  assert.match(notifications, /listPendingOwnerDealerMaintenanceScheduleProposals/);
  assert.match(ownerNotifications, /current\.filter\([\s\S]*dealerMaintenanceScheduleProposalId !== proposalId/);
  assert.match(ownerRoute, /no longer visible on the owner side/);
});

test('owner tracking settings include the new schedule permission and clear sharing copy', () => {
  assert.match(accessSettings, /title: 'Create Maintenance Schedules'/);
  assert.match(accessSettings, /require owner approval before becoming official/);
  assert.match(ownerShare, /create maintenance schedules, which will only appear in your Asset Register after you approve them/);
});
