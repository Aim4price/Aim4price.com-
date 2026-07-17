import {
  INSURANCE_CATALOGUE_VERSION,
  INSURANCE_COVER_BY_KEY,
  type InsuranceClientSegment,
  type InsuranceIndustryProfileKey,
} from './insurance-cover-catalogue';

export const INSURANCE_CLASSIFICATION_RULE_VERSION = 'insurance-rules-2026.07.1' as const;

export type InsuranceRuleConfidence = 'low' | 'medium' | 'high';

export type InsuranceRiskObjectCandidate = {
  riskObjectType: string;
  label: string;
  confidence: InsuranceRuleConfidence;
  ruleId: string;
  rationale: string;
  missingQuestions: string[];
  humanConfirmationRequired: true;
};

export type InsuranceCoverSuggestion = {
  coverKey: string;
  label: string;
  familyKey: string;
  ruleId: string;
  rationale: string;
  confidence: InsuranceRuleConfidence;
  missingQuestions: string[];
  placementStage: 'area_to_consider';
  displayLabel: 'Suggested area to consider';
  currentCoverPosition: 'unknown';
  dependencies: string[];
  overlaps: string[];
  humanConfirmationRequired: true;
};

export type InsuranceClassificationInput = {
  ownerFacts: Record<string, unknown>;
  segments?: InsuranceClientSegment[];
  industries?: InsuranceIndustryProfileKey[];
  useDescription?: string;
  roadUse?: 'yes' | 'no' | 'unknown';
  financed?: 'yes' | 'no' | 'unknown';
  portable?: 'yes' | 'no' | 'unknown';
  criticalToOperations?: 'yes' | 'no' | 'unknown';
  carriesThirdPartyGoods?: 'yes' | 'no' | 'unknown';
  exposureTypes?: string[];
};

export type InsuranceClassificationResult = {
  ruleVersion: typeof INSURANCE_CLASSIFICATION_RULE_VERSION;
  catalogueVersion: typeof INSURANCE_CATALOGUE_VERSION;
  riskObjectCandidates: InsuranceRiskObjectCandidate[];
  coverSuggestions: InsuranceCoverSuggestion[];
  unresolvedQuestions: string[];
  humanConfirmationRequired: true;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function factText(input: InsuranceClassificationInput): string {
  const facts = input.ownerFacts;
  const specs = record(facts.specsJson);
  return normalize([
    facts.title,
    facts.kind,
    facts.equipmentFamilyLabel,
    facts.brandName,
    facts.modelName,
    facts.typedModelName,
    facts.category,
    input.useDescription,
    specs.assetType,
    specs.category,
    specs.description,
    specs.use,
  ].map(text).filter(Boolean).join(' '));
}

function hasAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(normalize(term)));
}

function confidenceRank(value: InsuranceRuleConfidence): number {
  return value === 'high' ? 3 : value === 'medium' ? 2 : 1;
}

type MutableResult = {
  candidates: Map<string, InsuranceRiskObjectCandidate>;
  suggestions: Map<string, InsuranceCoverSuggestion>;
  questions: Set<string>;
};

function addCandidate(
  result: MutableResult,
  input: Omit<InsuranceRiskObjectCandidate, 'humanConfirmationRequired'>,
) {
  const candidate: InsuranceRiskObjectCandidate = { ...input, humanConfirmationRequired: true };
  const current = result.candidates.get(candidate.riskObjectType);
  if (!current || confidenceRank(candidate.confidence) > confidenceRank(current.confidence)) {
    result.candidates.set(candidate.riskObjectType, candidate);
  }
  candidate.missingQuestions.forEach((question) => result.questions.add(question));
}

function addCover(
  result: MutableResult,
  input: {
    coverKey: string;
    ruleId: string;
    rationale: string;
    confidence: InsuranceRuleConfidence;
    missingQuestions?: string[];
  },
) {
  const definition = INSURANCE_COVER_BY_KEY[input.coverKey];
  if (!definition) throw new Error(`INSURANCE_RULE_UNKNOWN_COVER:${input.coverKey}`);
  const suggestion: InsuranceCoverSuggestion = {
    coverKey: definition.key,
    label: definition.label,
    familyKey: definition.familyKey,
    ruleId: input.ruleId,
    rationale: input.rationale,
    confidence: input.confidence,
    missingQuestions: input.missingQuestions ?? [],
    placementStage: 'area_to_consider',
    displayLabel: 'Suggested area to consider',
    currentCoverPosition: 'unknown',
    dependencies: definition.dependencies,
    overlaps: definition.overlaps,
    humanConfirmationRequired: true,
  };
  const current = result.suggestions.get(suggestion.coverKey);
  if (!current || confidenceRank(suggestion.confidence) > confidenceRank(current.confidence)) {
    result.suggestions.set(suggestion.coverKey, suggestion);
  }
  suggestion.missingQuestions.forEach((question) => result.questions.add(question));
}

function addPhysicalPropertyDependencies(result: MutableResult, ruleId: string, rationale: string) {
  addCover(result, { coverKey: 'business_interruption', ruleId, rationale: `${rationale} Operational dependency should be tested separately.`, confidence: 'medium', missingQuestions: ['Would damage to this property interrupt income, increase costs or affect customers?'] });
  addCover(result, { coverKey: 'sasria_material_damage', ruleId, rationale: `${rationale} Correctly linked special-risks cover may need consideration.`, confidence: 'medium', missingQuestions: ['Is there a correctly issued Sasria coupon linked to the applicable underlying property section?'] });
}

export function classifyInsuranceRisk(input: InsuranceClassificationInput): InsuranceClassificationResult {
  const haystack = factText(input);
  const result: MutableResult = { candidates: new Map(), suggestions: new Map(), questions: new Set() };
  const commercial = input.segments?.includes('commercial') ?? true;

  if (hasAny(haystack, ['tractor', 'harvester', 'combine', 'loader', 'excavator', 'bulldozer', 'grader', 'forklift', 'telehandler', 'mobile plant'])) {
    const ruleId = 'OBJ-MOBILE-PLANT-001';
    addCandidate(result, { riskObjectType: 'mobile_plant', label: 'Mobile plant or agricultural machinery', confidence: 'high', ruleId, rationale: 'The immutable asset facts contain a recognised mobile plant or agricultural machinery term.', missingQuestions: ['Is it licensed or used on a public road?', 'Is it used for contracting, hired out, hired in or confined to one premises?', 'Is internal mechanical or electrical breakdown a material concern?'] });
    addCandidate(result, { riskObjectType: 'motor_vehicle_possible', label: 'Possible motor-class risk object', confidence: 'medium', ruleId, rationale: 'Some self-propelled machinery can fall within motor treatment depending on road use and wording.', missingQuestions: ['Is it registered, roadworthy or subject to motor third-party exposure?'] });
    addCover(result, { coverKey: 'contractors_plant_machinery', ruleId, rationale: 'The object is mobile plant; external accidental damage, theft, use and hired-plant interests should be assessed.', confidence: 'high', missingQuestions: ['Who owns it and where/how is it operated?'] });
    addCover(result, { coverKey: 'commercial_motor_fleet', ruleId, rationale: 'Road use, licensing or third-party motor exposure can make commercial motor relevant.', confidence: 'medium', missingQuestions: ['Is it driven or transported on public roads?'] });
    addCover(result, { coverKey: 'business_all_risks', ruleId, rationale: 'Portable or mobile property treatment may overlap depending on the policy architecture.', confidence: 'low', missingQuestions: ['Is the asset regularly moved between premises or sites?'] });
    addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'Property-at-premises treatment can be relevant when the asset is stored or operated at a declared location.', confidence: 'low', missingQuestions: ['Is the asset intended to sit under a premises-based property section?'] });
    addCover(result, { coverKey: 'machinery_breakdown', ruleId, rationale: 'Internal breakdown is a distinct peril from external accidental damage.', confidence: 'medium', missingQuestions: ['What is the maintenance history and internal breakdown dependency?'] });
    addCover(result, { coverKey: 'public_liability', ruleId, rationale: 'Operation of heavy machinery can create third-party injury or property-damage exposure.', confidence: 'medium', missingQuestions: ['Where is it operated and who may be affected?'] });
    addPhysicalPropertyDependencies(result, ruleId, 'The asset is operational machinery.');
  } else if (hasAny(haystack, ['car', 'bakkie', 'truck', 'vehicle', 'bus', 'van', 'motorcycle'])) {
    const ruleId = 'OBJ-MOTOR-001';
    addCandidate(result, { riskObjectType: 'motor_vehicle', label: 'Motor vehicle', confidence: 'high', ruleId, rationale: 'The asset facts contain a recognised motor vehicle term.', missingQuestions: ['Is use private, business, delivery, passenger carrying or other commercial use?', 'Who are the regular drivers and what licence or PDP requirements apply?'] });
    addCover(result, { coverKey: commercial ? 'commercial_motor_fleet' : 'personal_motor', ruleId, rationale: 'The physical object is a motor vehicle, but the correct section depends on segment and use.', confidence: 'high', missingQuestions: ['Confirm segment, use, driver and value basis.'] });
    addCover(result, { coverKey: 'goods_in_transit', ruleId, rationale: 'Goods carried are a separate insured interest from the vehicle.', confidence: 'low', missingQuestions: ['Does the vehicle carry owned or third-party goods?'] });
    addCover(result, { coverKey: 'sasria_material_damage', ruleId, rationale: 'Motor special-risks treatment should be checked separately from ordinary motor cover.', confidence: 'medium', missingQuestions: ['Is the motor Sasria coupon correctly issued and linked?'] });
  }

  if (hasAny(haystack, ['laptop', 'computer', 'server', 'tablet', 'electronic equipment', 'camera', 'printer', 'network'])) {
    const ruleId = 'OBJ-ELECTRONIC-001';
    addCandidate(result, { riskObjectType: 'electronic_equipment', label: 'Electronic equipment', confidence: 'high', ruleId, rationale: 'The immutable facts identify electronic, computer or data-processing equipment.', missingQuestions: ['Is it portable or fixed?', 'What data, backup, power, cyber and operational dependencies exist?'] });
    addCover(result, { coverKey: 'electronic_equipment', ruleId, rationale: 'Electronic equipment damage, data media and increased cost may require a specialist engineering section.', confidence: 'high', missingQuestions: ['Is equipment, data media or increased cost intended to be insured?'] });
    addCover(result, { coverKey: 'business_all_risks', ruleId, rationale: 'Portable equipment away from premises can require Business All Risks treatment.', confidence: input.portable === 'yes' ? 'high' : 'medium', missingQuestions: ['Does the item regularly leave the premises?'] });
    addCover(result, { coverKey: 'cyber_insurance', ruleId, rationale: 'Data, privacy and network interruption are distinct from physical equipment damage.', confidence: 'medium', missingQuestions: ['What data or network exposure exists beyond physical damage?'] });
    addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'Critical electronics can create revenue or increased-cost dependency.', confidence: input.criticalToOperations === 'yes' ? 'high' : 'medium', missingQuestions: ['Would loss of the item interrupt operations or require hired replacement equipment?'] });
  }

  if (hasAny(haystack, ['building', 'warehouse', 'office', 'shop', 'factory', 'house', 'shed', 'property', 'structure'])) {
    const ruleId = 'OBJ-BUILDING-001';
    addCandidate(result, { riskObjectType: commercial ? 'commercial_building' : 'domestic_building', label: commercial ? 'Commercial building' : 'Domestic building', confidence: 'high', ruleId, rationale: 'The asset facts identify a building or fixed structure.', missingQuestions: ['Who owns and occupies the structure?', 'What is the construction, occupancy, location and full rebuilding value?'] });
    addCover(result, { coverKey: commercial ? 'buildings_combined' : 'domestic_buildings_houseowners', ruleId, rationale: 'A building-specific section is a plausible primary treatment subject to ownership and use.', confidence: 'high', missingQuestions: ['Confirm segment, ownership, occupancy and rebuild basis.'] });
    if (commercial) addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'Commercial property perils and site accumulation require consideration.', confidence: 'high', missingQuestions: ['Which perils, locations and property categories are scheduled?'] });
    addCover(result, { coverKey: 'public_liability', ruleId, rationale: 'Ownership or occupation of premises can create third-party liability.', confidence: 'medium', missingQuestions: ['Who visits, occupies or works at the location?'] });
    addCover(result, { coverKey: 'machinery_breakdown', ruleId, rationale: 'Fixed mechanical services are separate from the building structure.', confidence: 'low', missingQuestions: ['Which lifts, pumps, refrigeration or mechanical services are critical?'] });
    addCover(result, { coverKey: 'electronic_equipment', ruleId, rationale: 'Building systems and electronic controls may need more specific treatment.', confidence: 'low', missingQuestions: ['Which fixed electronics, security or energy-control systems exist?'] });
    addPhysicalPropertyDependencies(result, ruleId, 'A physical building exposure exists.');
  }

  if (hasAny(haystack, ['stock', 'inventory', 'goods', 'produce', 'materials', 'merchandise'])) {
    const ruleId = 'OBJ-STOCK-001';
    addCandidate(result, { riskObjectType: 'stock_or_goods', label: 'Stock, goods or materials', confidence: 'high', ruleId, rationale: 'The asset facts identify stock, goods, produce or inventory.', missingQuestions: ['Who owns the goods and what is the valuation basis?', 'What are the peak values by location and conveyance?'] });
    addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'Stock at a premises can form part of the commercial property value at risk.', confidence: 'high', missingQuestions: ['What stock is held at each location and on what valuation basis?'] });
    addCover(result, { coverKey: 'goods_in_transit', ruleId, rationale: 'Movement between locations creates a separate transit exposure.', confidence: 'medium', missingQuestions: ['When and how are the goods transported?'] });
    addCover(result, { coverKey: 'marine_cargo_stock_throughput', ruleId, rationale: 'International transit or continuous stock throughput may require marine treatment.', confidence: 'low', missingQuestions: ['Are imports, exports, Incoterms or overseas voyages involved?'] });
    addCover(result, { coverKey: 'commercial_theft', ruleId, rationale: 'Stock theft trigger and security conditions should be assessed separately.', confidence: 'medium', missingQuestions: ['What theft trigger, security and stock controls apply?'] });
    addCover(result, { coverKey: 'machinery_breakdown_bi_deterioration_stock', ruleId, rationale: 'Temperature-sensitive produce may deteriorate after equipment or supply failure.', confidence: 'low', missingQuestions: ['Is stock temperature-sensitive or dependent on refrigeration?'] });
  }

  if (hasAny(haystack, ['crop', 'maize', 'wheat', 'sunflower', 'soy', 'orchard', 'vineyard', 'field'])) {
    const ruleId = 'EXP-CROP-001';
    addCandidate(result, { riskObjectType: 'crop_field', label: 'Crop field or growing crop', confidence: 'high', ruleId, rationale: 'The facts identify a crop, field, orchard or vineyard exposure.', missingQuestions: ['What crop, hectares, field boundary, planting date, yield and peril basis apply?'] });
    addCover(result, { coverKey: 'crop_hail_multi_peril_weather_index', ruleId, rationale: 'Crop hail, yield and index products use distinct triggers that require field-level facts.', confidence: 'high', missingQuestions: ['Is the intended trigger hail damage, multi-peril yield loss or a weather index?'] });
    addCover(result, { coverKey: 'agricultural_package_farm_property', ruleId, rationale: 'Farm property and fire exposures can sit alongside specialist crop cover.', confidence: 'medium', missingQuestions: ['What other farm property or operational exposures exist?'] });
  }

  if (hasAny(haystack, ['project', 'construction', 'contract works', 'erection', 'installation', 'site works'])) {
    const ruleId = 'EXP-PROJECT-001';
    addCandidate(result, { riskObjectType: 'project_or_contract_works', label: 'Construction or erection project', confidence: 'high', ruleId, rationale: 'The facts identify a temporary works, installation or project exposure.', missingQuestions: ['What is the contract scope, value, parties, project period and handover stage?', 'Is the dominant activity civil works, machinery erection or both?'] });
    addCover(result, { coverKey: 'contract_works_contractors_all_risks', ruleId, rationale: 'Temporary construction works and project liability are plausible coverage areas.', confidence: 'high', missingQuestions: ['What existing structures, defects and maintenance-period terms apply?'] });
    addCover(result, { coverKey: 'erection_all_risks_transit_erection', ruleId, rationale: 'Transit, erection, testing and commissioning may require EAR treatment.', confidence: 'medium', missingQuestions: ['Is machinery or equipment being transported, installed or tested?'] });
    addCover(result, { coverKey: 'advanced_loss_profits_delay_startup', ruleId, rationale: 'Future earnings can depend on timely project completion after insured damage.', confidence: 'medium', missingQuestions: ['Would insured project damage delay revenue, debt service or operation start?'] });
    addCover(result, { coverKey: 'contractors_plant_machinery', ruleId, rationale: 'Plant used on the project is a separate risk object from the works.', confidence: 'medium', missingQuestions: ['Which owned or hired plant is used on site?'] });
  }

  const financedFact = normalize(text(input.ownerFacts.financeStatus ?? record(input.ownerFacts.specsJson).financeStatus));
  if (input.financed === 'yes' || hasAny(financedFact, ['financed', 'finance', 'yes', 'outstanding'])) {
    const motorCandidate = result.candidates.has('motor_vehicle') || result.candidates.has('motor_vehicle_possible');
    if (motorCandidate) {
      addCover(result, { coverKey: 'consumer_credit_shortfall_payment_protection', ruleId: 'EXP-FINANCED-MOTOR-001', rationale: 'A financed motor asset can create a contractual credit-shortfall exposure distinct from asset value.', confidence: 'medium', missingQuestions: ['What is the finance settlement and does the intended product cover the defined shortfall?'] });
    }
  }

  const exposureTypes = new Set((input.exposureTypes ?? []).map(normalize));
  if ([...exposureTypes].some((value) => value.includes('liability') || value.includes('third party'))) {
    addCover(result, { coverKey: 'public_liability', ruleId: 'EXP-LIABILITY-001', rationale: 'Broker-entered context records a third-party liability exposure.', confidence: 'high', missingQuestions: ['What activities, territories, contracts and loss scenarios create the liability?'] });
    addCandidate(result, { riskObjectType: 'non_asset_liability_exposure', label: 'Non-asset liability exposure', confidence: 'high', ruleId: 'EXP-LIABILITY-001', rationale: 'Liability exists independently of a physical asset row.', missingQuestions: ['Which parties, activities, locations and contracts create the exposure?'] });
  }

  if (input.industries?.includes('agriculture_farming') && result.candidates.size === 0) {
    addCover(result, { coverKey: 'agricultural_package_farm_property', ruleId: 'IND-AGRICULTURE-001', rationale: 'The Agriculture industry profile makes a farm-package discovery conversation relevant.', confidence: 'low', missingQuestions: ['Which farm properties, crops, animals, machinery and liabilities exist?'] });
  }
  if (input.industries?.includes('renewable_energy')) {
    addCover(result, { coverKey: 'renewable_energy_project_operational', ruleId: 'IND-RENEWABLE-001', rationale: 'The Renewable Energy industry profile requires project-stage and operational specialist discovery.', confidence: 'medium', missingQuestions: ['What technology, project stage, capacity, contracts and grid dependencies apply?'] });
  }
  if (input.industries?.includes('transport_logistics') && input.carriesThirdPartyGoods !== 'no') {
    addCover(result, { coverKey: 'carrier_freight_forwarder_warehouse_liability', ruleId: 'IND-LOGISTICS-001', rationale: 'Transport and logistics activities can create custody and contractual cargo liability beyond goods physical damage.', confidence: 'medium', missingQuestions: ['Are owned or third-party goods carried, forwarded or stored under contract?'] });
  }

  if (result.candidates.size === 0) {
    addCandidate(result, { riskObjectType: 'unclassified_physical_asset', label: 'Unclassified physical asset', confidence: 'low', ruleId: 'FALLBACK-OBJECT-001', rationale: 'The supplied facts do not match a deterministic risk-object rule.', missingQuestions: ['What is the object, who owns it, how is it used, where is it kept and what can cause loss?'] });
  }

  return {
    ruleVersion: INSURANCE_CLASSIFICATION_RULE_VERSION,
    catalogueVersion: INSURANCE_CATALOGUE_VERSION,
    riskObjectCandidates: [...result.candidates.values()],
    coverSuggestions: [...result.suggestions.values()].sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.label.localeCompare(b.label)),
    unresolvedQuestions: [...result.questions],
    humanConfirmationRequired: true,
  };
}

export function shortlistInsuranceCovers(inputs: InsuranceClassificationInput[], limit = 18): InsuranceCoverSuggestion[] {
  const merged = new Map<string, InsuranceCoverSuggestion>();
  for (const input of inputs) {
    for (const suggestion of classifyInsuranceRisk(input).coverSuggestions) {
      const current = merged.get(suggestion.coverKey);
      if (!current || confidenceRank(suggestion.confidence) > confidenceRank(current.confidence)) merged.set(suggestion.coverKey, suggestion);
    }
  }
  return [...merged.values()]
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.label.localeCompare(b.label))
    .slice(0, Math.max(1, Math.min(limit, 30)));
}
