const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('app/maintenance/maintenance-client.tsx', 'utf8');
function harness() {
  const pending = [], applied = [];
  const env = { useCallback: fn => fn, activeFilters: {}, EMPTY_SUMMARY: {},
    buildListUrl: () => '/maintenance', setIsLoading() {}, setNotice() {},
    setAssets() {}, setFieldManagers() {}, setSummary() {}, setRecords: records => applied.push(records),
    fetch: () => new Promise(resolve => pending.push(data => resolve({ ok: true, json: async () => data }))),
  };
  const body = source.slice(source.indexOf('  const applyPayload = useCallback'),source.indexOf('  useEffect(() => {\n    void loadData(activeFilters);'));
  const code = ts.transpileModule(`exports.create = function(env) { const {${Object.keys(env).join(',')}} = env; const refreshVersion={current:0}; ${body} return { loadData, applyPayload }; }`, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {}; new Function('exports',code)(exports);
  return { ...exports.create(env), pending, applied };
}
test('a slower older refresh cannot replace the newest remaining values', async () => {
  const h = harness();
  const older=h.loadData(), newer=h.loadData({}, {silent:true});
  h.pending[1]({records:[{remainingUsage:20}]}); await newer;
  h.pending[0]({records:[{remainingUsage:100}]}); await older;
  assert.deepEqual(h.applied, [[{remainingUsage:20}]]);
});
test('a saved maintenance update invalidates an in-flight background response', async () => {
  const h=harness(); const pending=h.loadData({}, {silent:true});
  h.applyPayload({records:[{status:'done'}]});
  h.pending[0]({records:[{status:'upcoming'}]}); await pending;
  assert.deepEqual(h.applied,[[{status:'done'}]]);
});
test('remaining label is beside status and removed from the due-date column', () => {
  const badges=source.slice(source.indexOf('<div className={styles.ledgerBadges}>'),source.indexOf('<div className={styles.invoiceHeaderAside}>'));
  assert.ok(badges.includes('maintenanceTimingLabel(record)'));
  const aside=source.slice(source.indexOf('<div className={styles.invoiceHeaderAside}>'),source.indexOf('<div className={styles.rowActions}>'));
  assert.ok(!aside.includes('maintenanceTimingLabel(record)'));
});
