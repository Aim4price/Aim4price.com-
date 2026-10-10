const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', code)(name => mocks[name], exports);
  return exports;
}
const { buildAssetPartsReportHtml } = load('lib/asset-parts-report.ts', {
  './maintenance-report-style': { MAINTENANCE_REPORT_FONT_CSS: '/* checklist fonts */', MAINTENANCE_REPORT_LAYOUT_CSS: '/* checklist layout */' },
  './report-theme': { REPORT_THEME_CSS: '/* shared theme */' },
});
test('parts report retains numbers, escapes content and includes only authorized maintenance', () => {
  const part = { id:'part', name:'Oil <filter>', partNumber:'001-ABC', brand:'A&B', itemLabel:'Oil <filter>', notes:'<script>alert(1)</script>', maintenanceId:'private' };
  const html = buildAssetPartsReportHtml({ title:'Tractor & loader', serialNumber:'VIN-01' }, [part], [], { generatedDate:'10 Oct 2026' });
  assert.match(html, /001-ABC/); assert.match(html, /Oil &lt;filter&gt;/); assert.match(html, /A&amp;B/);
  assert.doesNotMatch(html, /<script>|Maintenance:|private/);
  assert.match(html, /checklist fonts/); assert.match(html, /checklist layout/); assert.match(html, /shared theme/);
  assert.match(html, /table-header-group/); assert.match(html, /1 part/);
  const linked = buildAssetPartsReportHtml({ title:'Tractor' }, [part], [{ id:'private', title:'Service & check', status:'done' }], { generatedDate:'10 Oct 2026' });
  assert.match(linked, /Maintenance: Service &amp; check/);
});
