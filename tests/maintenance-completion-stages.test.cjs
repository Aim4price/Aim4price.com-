const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('components/DesktopServiceModal.tsx', 'utf8');
const validator = source.slice(source.indexOf('  function stageError('), source.indexOf('  function nextStage('));
const code = ts.transpileModule(validator, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function check(stage, overrides = {}) {
  const context = { selectedItems: [], customItems: [], ownItem: '', notes: '', completedAt: '2026-09-01', today: '2026-09-16', actionName: 'service', completedUsage: '', requiresUsageReading: false, unit: 'hours', standalone: false, isSeparateCompletion: false, record: { currentUsage: 100 }, mode: 'serviced', inHouse: false, company: '', mechanic: '', copy: { companyLabel: 'Company', mechanicLabel: 'Mechanic' }, asksRecurrence: false, continueSchedule: null, ...overrides };
  return new Function(...Object.keys(context), code + ';return stageError(' + stage + ')')(...Object.values(context));
}
test('work stage requires completed items, custom work or notes', () => {
  assert.ok(check(1));
  for (const value of [{ selectedItems: ['Oil'] }, { customItems: ['Hose'] }, { ownItem: 'Belt' }, { notes: 'Repaired leak' }]) assert.equal(check(1, value), '');
  assert.ok(check(1, { notes: '  ', ownItem: ' ' }));
});
test('date stage rejects missing/future dates and missing/invalid required usage', () => {
  for (const value of [{ completedAt: '' }, { completedAt: 'invalid' }, { completedAt: '2027-01-01' }, { requiresUsageReading: true }, { completedUsage: '-1' }, { completedUsage: 'bad' }, { completedUsage: '99' }]) assert.ok(check(2, value));
  assert.equal(check(2, { completedUsage: '100', requiresUsageReading: true }), '');
  assert.equal(check(2, { completedUsage: '50', isSeparateCompletion: true }), '');
  assert.equal(check(2, { completedUsage: '50', standalone: true }), '');
  assert.equal(check(2), '');
});
test('person stage requires provider and mechanic except for in-house and checkup work', () => {
  assert.ok(check(3));
  assert.ok(check(3, { inHouse: true }));
  assert.equal(check(3, { inHouse: true, mechanic: 'Alex' }), '');
  assert.equal(check(3, { company: 'Workshop', mechanic: 'Alex' }), '');
  assert.equal(check(3, { mode: 'checked', mechanic: 'Alex' }), '');
});
test('recurrence stage requires an explicit choice and accepts both outcomes', () => {
  assert.ok(check(4, { asksRecurrence: true }));
  for (const continueSchedule of [true, false]) assert.equal(check(4, { asksRecurrence: true, continueSchedule }), '');
});
