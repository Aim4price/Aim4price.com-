const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const moduleCache = new Map();

function loadTypeScript(relativePath) {
  const filename = path.resolve(root, relativePath.endsWith('.ts') ? relativePath : `${relativePath}.ts`);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const diagnostics = output.diagnostics || [];
  assert.equal(diagnostics.length, 0, `Transpile diagnostics in ${relativePath}`);
  const loaded = { exports: {} };
  moduleCache.set(filename, loaded);
  const localRequire = (request) => {
    if (!request.startsWith('.')) return require(request);
    const resolved = path.resolve(path.dirname(filename), request);
    return loadTypeScript(path.relative(root, resolved));
  };
  const execute = new Function('exports', 'require', 'module', '__filename', '__dirname', output.outputText);
  execute(loaded.exports, localRequire, loaded, filename, path.dirname(filename));
  return loaded.exports;
}

function source(relativePath) {
  return fs.readFileSync(path.resolve(root, relativePath), 'utf8');
}

function scenario(engine, title, extra = {}) {
  return engine.classifyInsuranceRisk({
    ownerFacts: { title },
    segments: ['commercial'],
    ...extra,
  });
}

function assertSuggestion(result, key) {
  const suggestion = result.coverSuggestions.find((entry) => entry.coverKey === key);
  assert.ok(suggestion, `Expected ${key} for rule scenario`);
  assert.match(suggestion.ruleId, /^[A-Z]+-[A-Z-]+-\d{3}$/);
  assert.ok(suggestion.rationale.length >= 20);
  assert.ok(['low', 'medium', 'high'].includes(suggestion.confidence));
  assert.equal(suggestion.placementStage, 'area_to_consider');
  assert.equal(suggestion.currentCoverPosition, 'unknown');
  assert.equal(suggestion.humanConfirmationRequired, true);
  assert.notEqual(suggestion.displayLabel.toLowerCase(), 'recommended');
}

const catalogue = loadTypeScript('lib/insurance-cover-catalogue');
const engine = loadTypeScript('lib/insurance-classification-engine');
const validation = loadTypeScript('lib/insurance-validation');
const definitions = catalogue.INSURANCE_COVER_CATALOGUE;
const byKey = catalogue.INSURANCE_COVER_BY_KEY;

assert.equal(definitions.length, 66, 'The canonical catalogue must contain exactly 66 covers');
assert.equal(new Set(definitions.map((entry) => entry.key)).size, 66, 'Cover keys must be unique');
assert.equal(catalogue.INSURANCE_INDUSTRY_PROFILES.length, 16, 'Industry is a separate 16-profile layer');
assert.equal(catalogue.INSURANCE_REGULATORY_CLASSES.length, 15, 'Regulatory class is a separate metadata layer');

for (const definition of definitions) {
  for (const field of [
    'key', 'label', 'familyKey', 'catalogueVersion', 'purpose', 'insuredInterestSummary',
    'triggerSummary', 'claimsLens',
  ]) assert.ok(definition[field], `${definition.key}: missing ${field}`);
  for (const field of [
    'aliases', 'eligibleClientSegments', 'regulatoryMappings', 'applicableRiskObjectTypes',
    'applicableExposureTypes', 'coreCoverElements', 'commonExtensions',
    'limitationsAndConditions', 'underwritingQuestions', 'requiredDataFields',
    'valuationGuidance', 'limitGuidance', 'excessGuidance', 'evidenceRequirements',
    'dependencies', 'overlaps', 'moreSpecificCoverRelationships', 'sourceReferences',
  ]) assert.ok(Array.isArray(definition[field]), `${definition.key}: ${field} must be an array`);
  assert.ok(definition.eligibleClientSegments.every((value) => value === 'domestic' || value === 'commercial'));
  assert.ok(definition.regulatoryMappings.every((mapping) => catalogue.INSURANCE_REGULATORY_CLASSES.some((entry) => entry.key === mapping.classKey)));
  assert.ok(definition.sourceReferences.every((reference) => reference.includes('Aim4price handbook')));
  assert.doesNotMatch(JSON.stringify(definition), /Santam|Hollard|OUTsurance|Discovery Insure|Old Mutual Insure/i, `${definition.key}: insurer-specific wording must not be universalized`);
  for (const linkedKey of [...definition.dependencies, ...definition.overlaps, ...definition.moreSpecificCoverRelationships]) {
    assert.ok(byKey[linkedKey], `${definition.key}: unknown related cover ${linkedKey}`);
  }
}

assertSuggestion(scenario(engine, 'John Deere tractor', { financed: 'yes', industries: ['agriculture_farming'] }), 'contractors_plant_machinery');
assertSuggestion(scenario(engine, 'John Deere tractor', { financed: 'yes' }), 'commercial_motor_fleet');
assertSuggestion(scenario(engine, 'Delivery truck', { financed: 'yes' }), 'consumer_credit_shortfall_payment_protection');
assertSuggestion(scenario(engine, 'Office building'), 'buildings_combined');
assertSuggestion(scenario(engine, 'Portable laptop', { portable: 'yes', criticalToOperations: 'yes' }), 'electronic_equipment');
assertSuggestion(scenario(engine, 'Portable laptop', { portable: 'yes' }), 'business_all_risks');
assertSuggestion(scenario(engine, 'Warehouse stock and inventory'), 'goods_in_transit');
assertSuggestion(scenario(engine, 'Maize crop field', { industries: ['agriculture_farming'] }), 'crop_hail_multi_peril_weather_index');
assertSuggestion(scenario(engine, 'Construction project and contract works'), 'contract_works_contractors_all_risks');
assertSuggestion(scenario(engine, 'Consulting activity', { exposureTypes: ['third party liability'] }), 'public_liability');
assertSuggestion(scenario(engine, 'Solar facility', { industries: ['renewable_energy'] }), 'renewable_energy_project_operational');

const furniture = engine.classifyInsuranceRisk({
  ownerFacts: {
    title: 'Boardroom furniture',
    kind: 'manual',
    specsJson: {
      generalAssetCategory: 'furniture_contents',
      insuranceUseContext: 'business',
      insuranceMobility: 'premises',
    },
  },
  segments: [],
});
assertSuggestion(furniture, 'office_contents');

const homeLaptop = engine.classifyInsuranceRisk({
  ownerFacts: {
    title: 'MacBook Pro',
    kind: 'manual',
    specsJson: {
      generalAssetCategory: 'computers_it',
      insuranceUseContext: 'home',
      insuranceMobility: 'portable',
    },
  },
  segments: ['commercial'],
});
assertSuggestion(homeLaptop, 'personal_all_risks_portable_possessions');
assert.ok(!homeLaptop.coverSuggestions.some((entry) => entry.coverKey === 'electronic_equipment'), 'Home-use facts must not silently force a commercial electronics section');

const coldRoom = engine.classifyInsuranceRisk({
  ownerFacts: {
    title: 'Main cold room',
    kind: 'manual',
    specsJson: {
      generalAssetCategory: 'commercial_refrigeration',
      insuranceUseContext: 'business',
      insuranceMobility: 'fixed',
      insuranceCriticalToOperations: 'yes',
      insuranceTemperatureSensitiveStock: 'yes',
    },
  },
});
assertSuggestion(coldRoom, 'machinery_breakdown');
assertSuggestion(coldRoom, 'machinery_breakdown_bi_deterioration_stock');
assertSuggestion(coldRoom, 'business_interruption');

const uuid = '11111111-1111-4111-8111-111111111111';
const emptyMoney = validation.parseInsuranceCommand({ operation: 'save_financial_term', assessmentId: uuid, termType: 'sum_insured' });
assert.equal(emptyMoney.amount, null, 'Missing policy money must remain null');
const groupedDecision = validation.parseInsuranceCommand({ operation: 'decide_suggestions', suggestionIds: [uuid], decision: 'accepted_for_assessment', rationale: 'Group matching asset signals into one cover review.' });
assert.deepEqual(groupedDecision.suggestionIds, [uuid], 'Grouped suggestion decisions must retain every selected signal');
assert.throws(() => validation.parseInsuranceCommand({ operation: 'save_assessment', canonicalCoverKey: 'public_liability', currentCoverPosition: 'confirmed_included', sourceType: 'system_suggestion', sourceReference: 'rule' }), /INSURANCE_CONFIRMED_COVER_SOURCE_REQUIRED/);
assert.throws(() => validation.parseInsuranceCommand({ operation: 'save_assessment', canonicalCoverKey: 'public_liability', placementStage: 'broker_recommended' }), /INSURANCE_BROKER_RATIONALE_REQUIRED/);
assert.throws(() => validation.parseInsuranceCommand({ operation: 'save_exposure', exposureType: 'liability', label: 'Dismissed exposure', exposureStatus: 'dismissed_with_reason' }), /INSURANCE_DISMISSAL_REASON_REQUIRED/);

const stateSource = source('lib/insurance-workspace-types.ts');
for (const state of ['unknown', 'not_recorded', 'confirmed_excluded', 'not_applicable', 'covered_elsewhere', 'client_declined', 'insurer_declined']) {
  assert.ok(stateSource.includes(`'${state}'`), `Distinct state missing: ${state}`);
}

const workspace = source('lib/insurance-workspaces.ts');
const report = source('lib/insurance-report.ts');
const migration = source('database/migrations/54-insurance-workspace-normalized.sql');
const workspaceRoute = source('app/api/insurance-workspaces/[workspaceId]/route.ts');
const routeAuth = source('lib/insurance-route-auth.ts');
const readiness = source('lib/insurance-workspace-readiness.ts');
const panels = source('app/shared-registers/[shareId]/insurance-workspace-panels.tsx');

assert.match(workspaceRoute, /requireInsuranceBrokerUserId/);
assert.match(workspaceRoute, /parseInsuranceCommand/);
assert.match(routeAuth, /accountType !== 'insurance'/);
assert.ok(!/sumInsured\s*\?\?\s*[^\n]*replacementValue/.test(report), 'Reports must not fall back from sum insured to replacement value');
assert.match(report, /getInsuranceWorkspaceReadiness/);
assert.match(report, /scheduleTermsByAsset/, 'Reports must use sums insured linked through policy schedule items');
assert.match(readiness, /policy-vat-/);
assert.match(readiness, /policy-renewal-/);
assert.match(panels, /decide_suggestions/);
assert.match(panels, /Create client questions/);
assert.doesNotMatch(workspace, /vatBasis\s*=\s*amount\s*\?\s*'inclusive'/, 'Saved monetary values must not silently force VAT-inclusive');
assert.match(workspace, /version\s*=\s*version\s*\+\s*1/);
assert.match(report, /note\.noteType === 'report_visible'/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.insurance_policy_sections/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.insurance_schedule_item_assets/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.insurance_schedule_item_exposures/);
assert.match(migration, /current_cover_position/);
assert.match(migration, /placement_stage/);
assert.match(migration, /insurance_suggestion_decisions/);
assert.match(migration, /prevent_insurance_report_snapshot_update/);
assert.doesNotMatch(migration, /DROP TABLE/i, 'Migration must preserve existing data');
assert.match(migration, /ON CONFLICT[\s\S]+DO NOTHING/);
assert.match(workspace, /INSURANCE_CROSS_WORKSPACE_LINK/);
assert.match(workspace, /insurance_schedule_item_assets/);
assert.match(workspace, /insurance_schedule_item_exposures/);
assert.match(workspace, /insurance_assessment_locations/);
assert.match(workspace, /insurance_assessment_parties/);
assert.match(workspace, /insurance_evidence_links/);
assert.doesNotMatch(workspace, /delete from insurance_suggestion_decisions/i, 'Rule refresh must not erase human decisions');

console.log(`Insurance workspace verification passed: ${definitions.length} covers, deterministic rules, route, migration and report guards.`);
