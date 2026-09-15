import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync('app/maintenance/maintenance-client.tsx', 'utf8');
const helpers = source.slice(source.indexOf('function maintenanceTimingLabel('), source.indexOf('function maintenanceAlertLabel('));
const scope = { numberText: n => String(n), formatUsage: (n, unit) => `${n} ${unit}` };
vm.createContext(scope);
vm.runInContext(ts.transpile(helpers, { target: ts.ScriptTarget.ES2020 }), scope);
const base = { id: 'upcoming', status: 'upcoming', computedStatus: 'upcoming', title: 'Next service', maintenanceType: 'service', triggerType: 'usage', remainingUsage: 750, usageMetric: 'hours' };
test('timing distinguishes remaining, due, overdue and unknown readings', () => {
  assert.equal(scope.maintenanceTimingLabel(base), '750 hours remaining');
  assert.equal(scope.maintenanceTimingLabel({...base, remainingUsage: -50}), '50 hours overdue');
  assert.equal(scope.maintenanceTimingLabel({...base, remainingUsage: 0}), 'Due now');
  assert.equal(scope.maintenanceTimingLabel({...base, remainingUsage: null}), '');
  assert.equal(scope.maintenanceTimingLabel({...base, triggerType: 'date', daysUntilDue: -1}), '1 day overdue');
  assert.equal(scope.maintenanceTimingLabel({...base, triggerType: 'date', daysUntilDue: 0}), 'Due today');
  assert.equal(scope.maintenanceTimingLabel({...base, status: 'done'}), '');
  assert.equal(scope.maintenanceTimingLabel({...base, status: 'cancelled'}), '');
});
test('completed titles remain meaningful without replacing custom work descriptions', () => {
  assert.equal(scope.maintenanceDisplayTitle({...base, status: 'done'}), 'Completed service');
  assert.equal(scope.maintenanceDisplayTitle({...base, status: 'done', title: '', maintenanceType: 'checkup'}), 'Completed check-up');
  assert.equal(scope.maintenanceDisplayTitle({...base, status: 'done', title: 'Replace hydraulic pump'}), 'Replace hydraulic pump');
  assert.equal(scope.maintenanceDisplayTitle(base), 'Next service');
});
test('urgency groups precede history, preserve stable order and do not mutate records', () => {
  const records = [{...base, id: 'done', status: 'done'}, base, {...base, id: 'cancelled', status: 'cancelled'}, {...base, id: 'due', computedStatus: 'due'}, {...base, id: 'overdue', computedStatus: 'overdue'}, {...base, id: 'soon', computedStatus: 'due_soon'}, {...base, id: 'upcoming2'}];
  assert.equal(scope.arrangeMaintenanceTimeline(records).map(r => r.id).join(','), 'overdue,due,soon,upcoming,upcoming2,done,cancelled');
  assert.equal(records[0].id, 'done');
});

test('generic recurring titles describe the interval while preserving custom titles', () => {
  const recurring = { ...base, recurringEnabled: true, recurringIntervalValue: 250, recurringIntervalUnit: 'hours' };
  assert.equal(scope.maintenanceDisplayTitle(recurring), '250-hour service');
  assert.equal(scope.maintenanceDisplayTitle({ ...recurring, title: 'Inspect hydraulic pump' }), 'Inspect hydraulic pump');
  assert.equal(scope.maintenanceDisplayTitle({ ...recurring, recurringIntervalUnit: 'months', recurringIntervalValue: 6 }), '6-month service');
});
test('asset titles hide only an unknown-year prefix and preserve real years', () => {
  assert.equal(scope.cleanMaintenanceAssetTitle('Year Unknown Zimmatic 6-Tower'), 'Zimmatic 6-Tower');
  assert.equal(scope.cleanMaintenanceAssetTitle('2017 John Deere 5075E'), '2017 John Deere 5075E');
});
