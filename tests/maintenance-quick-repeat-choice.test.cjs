const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadFunction(file, start, end, dependencies) {
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source.slice(source.indexOf(start), source.indexOf(end)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${code}; return ${start.match(/function (\w+)/)[1]};`)(...Object.values(dependencies));
}

for (const choice of [true, false, undefined]) {
  test(`quick completion preserves repeat choice ${choice}`, async () => {
    let saved;
    const save = loadFunction('app/api/maintenance/[maintenanceId]/complete/route.ts', 'async function saveCompletedMaintenance(', 'function parseType(', {
      getAssetMaintenanceRecordById: async () => ({ status: 'upcoming', assetId: 'asset', maintenanceType: 'service' }),
      unknownMaintenanceCompletionNote: () => 'Details not supplied',
      completeAssetMaintenanceRecord: async (owner, id, input, guard) => { saved = { owner, id, input, guard }; return saved; },
    });
    await save('owner', 'record', { quickComplete: true, confirmedComplete: true, continueSchedule: choice }, 'Owner');
    assert.equal(saved.input.continueSchedule, choice);
    assert.equal(saved.owner, 'owner');
    assert.equal(saved.guard.allowUnknownDetails, true);
    await assert.rejects(save('owner', 'record', { quickComplete: true, continueSchedule: choice }, 'Owner'), /COMPLETION_CONFIRMATION_REQUIRED/);
  });
}

test('cancelled records are a separate report group, never scheduled work', () => {
  const group = loadFunction('lib/asset-maintenance-report.ts', 'function groupRecords(', 'function recordTitle(', {});
  const cancelled = { id: 'cancelled', status: 'cancelled', computedStatus: 'cancelled' };
  const groups = group([cancelled, { id: 'open', status: 'upcoming', computedStatus: 'upcoming' }]);
  assert.deepEqual(groups.find(g => g.key === 'cancelled').records, [cancelled]);
  assert.deepEqual(groups.find(g => g.key === 'scheduled').records.map(r => r.id), ['open']);
});
