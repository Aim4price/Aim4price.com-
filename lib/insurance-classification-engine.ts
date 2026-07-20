import {
  INSURANCE_CATALOGUE_VERSION,
  INSURANCE_COVER_BY_KEY,
  type InsuranceClientSegment,
  type InsuranceIndustryProfileKey,
} from './insurance-cover-catalogue';

export const INSURANCE_CLASSIFICATION_RULE_VERSION = 'insurance-rules-2026.07.3' as const;

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
    specs.generalAssetCategory,
    specs.general_asset_category,
    specs.generalAssetCategoryLabel,
    specs.general_asset_category_label,
    specs.insuranceUseContext,
    specs.insurance_use_context,
    specs.insuranceMobility,
    specs.insurance_mobility,
    specs.propertyAssetSubtype,
    specs.property_asset_subtype,
    specs.propertyAssetSubtypeLabel,
    specs.property_asset_subtype_label,
    specs.propertyInterest,
    specs.property_interest,
    specs.stockAssetSubtype,
    specs.stock_asset_subtype,
    specs.stockAssetSubtypeLabel,
    specs.stock_asset_subtype_label,
    specs.stockValuationBasis,
    specs.stock_valuation_basis,
    specs.stockMovement,
    specs.stock_movement,
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
  const specs = record(input.ownerFacts.specsJson);
  const generalAssetCategory = normalize(text(specs.generalAssetCategory ?? specs.general_asset_category));
  const propertyAssetSubtype = normalize(text(specs.propertyAssetSubtype ?? specs.property_asset_subtype));
  const propertyInterest = normalize(text(specs.propertyInterest ?? specs.property_interest));
  const stockAssetSubtype = normalize(text(specs.stockAssetSubtype ?? specs.stock_asset_subtype));
  const stockValuationBasis = normalize(text(specs.stockValuationBasis ?? specs.stock_valuation_basis));
  const stockMovement = normalize(text(specs.stockMovement ?? specs.stock_movement));
  const useContext = normalize(text(specs.insuranceUseContext ?? specs.insurance_use_context));
  const mobility = normalize(text(specs.insuranceMobility ?? specs.insurance_mobility));
  const criticalToOperations = input.criticalToOperations ?? normalize(text(
    specs.insuranceCriticalToOperations ?? specs.insurance_critical_to_operations,
  ));
  const temperatureSensitiveStock = normalize(text(
    specs.insuranceTemperatureSensitiveStock ?? specs.insurance_temperature_sensitive_stock,
  ));
  const portable = input.portable ?? (mobility === 'portable' || mobility === 'moves between locations' ? 'yes' : mobility ? 'no' : 'unknown');
  const configuredSegments = input.segments ?? [];
  const commercial = useContext === 'home'
    ? false
    : useContext === 'business' || useContext === 'mixed'
      ? true
      : configuredSegments.length > 0
        ? configuredSegments.includes('commercial')
        : true;

  if (generalAssetCategory === 'furniture contents') {
    const ruleId = 'OBJ-CONTENTS-001';
    addCandidate(result, {
      riskObjectType: commercial ? 'commercial_contents' : 'household_contents',
      label: commercial ? 'Commercial furniture and contents' : 'Household furniture and contents',
      confidence: 'high',
      ruleId,
      rationale: 'The owner classified the item as furniture or ordinary contents and recorded its use context.',
      missingQuestions: ['At which address is it kept and what is its current full replacement value?', 'Is any item high-value, portable or owned by another party?'],
    });
    addCover(result, {
      coverKey: commercial ? 'office_contents' : 'domestic_home_contents_householders',
      ruleId,
      rationale: commercial
        ? 'Furniture and ordinary business contents are commonly assessed within a premises-based contents section.'
        : 'Furniture and ordinary household contents are commonly assessed within home contents cover.',
      confidence: 'high',
      missingQuestions: ['Confirm the risk address, ownership, replacement inventory and security.'],
    });
    if (commercial) {
      addCover(result, { coverKey: 'commercial_theft', ruleId, rationale: 'Theft trigger and premises security should be assessed separately for business contents.', confidence: 'medium', missingQuestions: ['What alarm, access and physical security controls apply?'] });
    }
  }

  if (generalAssetCategory === 'appliances') {
    const ruleId = 'OBJ-APPLIANCE-001';
    addCandidate(result, { riskObjectType: commercial ? 'commercial_appliance' : 'domestic_equipment', label: commercial ? 'Commercial appliance' : 'Domestic appliance', confidence: 'high', ruleId, rationale: 'The owner classified the item as an appliance and recorded whether it is used at home or for business.', missingQuestions: ['Is it fixed or movable, and does it require professional installation?', 'Would a failure cause stock loss or a material interruption?'] });
    addCover(result, { coverKey: commercial ? 'office_contents' : 'domestic_home_contents_householders', ruleId, rationale: commercial ? 'An ordinary business appliance is first assessed as business contents at its premises.' : 'An ordinary domestic appliance is first assessed as part of household contents.', confidence: 'high', missingQuestions: ['Confirm location, ownership, replacement value and any power-surge requirements.'] });
    if (commercial && criticalToOperations === 'yes') {
      addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'The owner marked the appliance as critical to operations, creating a possible interruption or increased-cost dependency.', confidence: 'medium', missingQuestions: ['How long could operations continue without it and what replacement arrangements exist?'] });
    }
  }

  if (generalAssetCategory === 'computers it' || generalAssetCategory === 'portable electronics') {
    const ruleId = generalAssetCategory === 'portable electronics' ? 'OBJ-PORTABLE-ELECTRONICS-001' : 'OBJ-COMPUTER-IT-001';
    addCandidate(result, { riskObjectType: commercial ? 'electronic_equipment' : 'personal_electronics', label: commercial ? 'Electronic or IT equipment' : 'Personal electronic equipment', confidence: 'high', ruleId, rationale: 'The owner selected a structured computer, IT or portable-electronics category.', missingQuestions: ['Which devices, serial numbers, locations and replacement values apply?', 'What power, backup, data and security controls exist?'] });
    if (commercial) {
      addCover(result, { coverKey: 'electronic_equipment', ruleId, rationale: 'Business computer and electronic equipment can require specialist physical-damage, data-media and increased-cost treatment.', confidence: 'high', missingQuestions: ['Confirm the equipment schedule, portability, backup and surge protection.'] });
      if (portable === 'yes') addCover(result, { coverKey: 'business_all_risks', ruleId, rationale: 'The item is recorded as portable or moving between locations, so away-from-premises treatment should be assessed.', confidence: 'high', missingQuestions: ['Where does it travel and what custody and vehicle-security controls apply?'] });
      if (criticalToOperations === 'yes') addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'The item is recorded as operationally critical, creating a possible interruption or increased-cost dependency.', confidence: 'high', missingQuestions: ['What recovery time, redundancy and hired-replacement options exist?'] });
      addCover(result, { coverKey: 'cyber_insurance', ruleId, rationale: 'Systems, data and privacy exposures are distinct from physical damage to the device and should be tested separately.', confidence: criticalToOperations === 'yes' ? 'medium' : 'low', missingQuestions: ['Does the item store sensitive data, connect to critical systems or support online operations?'] });
    } else {
      addCover(result, { coverKey: portable === 'yes' ? 'personal_all_risks_portable_possessions' : 'domestic_home_contents_householders', ruleId, rationale: portable === 'yes' ? 'Portable personal electronics may need individual away-from-home treatment.' : 'Personal electronics normally kept at home should first be assessed within household contents.', confidence: 'high', missingQuestions: ['Confirm business use, territory, serial number, replacement value and whether individual specification is needed.'] });
    }
  }

  if (generalAssetCategory === 'commercial refrigeration') {
    const ruleId = 'OBJ-REFRIGERATION-001';
    addCandidate(result, { riskObjectType: 'commercial_refrigeration', label: 'Commercial refrigeration or cold-storage equipment', confidence: 'high', ruleId, rationale: 'The owner explicitly classified the item as commercial refrigeration or cold storage.', missingQuestions: ['What machinery, refrigerant, maintenance and power arrangements apply?', 'What is the maximum temperature-sensitive stock value and safe holding time?'] });
    addCover(result, { coverKey: 'machinery_breakdown', ruleId, rationale: 'Internal mechanical or electrical breakdown is a distinct exposure for refrigeration equipment.', confidence: 'high', missingQuestions: ['What is the age, duty, service history and availability of spares?'] });
    addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'The equipment remains physical property at a stated premises and should be included in the property-value discussion.', confidence: 'medium', missingQuestions: ['At which location is it installed and on what replacement basis?'] });
    if (temperatureSensitiveStock !== 'no') addCover(result, { coverKey: 'machinery_breakdown_bi_deterioration_stock', ruleId, rationale: 'Refrigeration failure may cause deterioration of temperature-sensitive stock as well as equipment damage.', confidence: temperatureSensitiveStock === 'yes' ? 'high' : 'medium', missingQuestions: ['Confirm peak stock values, temperature controls, alarms, waiting period and backup power.'] });
    if (criticalToOperations === 'yes') addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'The owner marked the refrigeration equipment as critical to operations.', confidence: 'high', missingQuestions: ['What income, recovery time and increased costs follow a breakdown?'] });
  }

  if (generalAssetCategory === 'kitchen catering') {
    const ruleId = 'OBJ-CATERING-EQUIPMENT-001';
    addCandidate(result, { riskObjectType: 'commercial_kitchen_equipment', label: 'Commercial kitchen or catering equipment', confidence: 'high', ruleId, rationale: 'The owner classified the item as commercial kitchen or catering equipment.', missingQuestions: ['Is it gas, electrical, fixed or portable, and how is it maintained?', 'Would failure stop trading or create food-stock loss?'] });
    addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'Commercial catering equipment is physical property at the operating premises and creates material fire exposure.', confidence: 'high', missingQuestions: ['Confirm extraction, fire suppression, gas and electrical controls.'] });
    addCover(result, { coverKey: 'machinery_breakdown', ruleId, rationale: 'Powered catering machinery may have an internal breakdown exposure distinct from ordinary property damage.', confidence: 'medium', missingQuestions: ['Which powered units are critical and what maintenance applies?'] });
    if (criticalToOperations === 'yes') addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'The item is recorded as critical to business operations.', confidence: 'high', missingQuestions: ['What trading loss or increased cost follows failure?'] });
  }

  if (generalAssetCategory === 'security systems') {
    const ruleId = 'OBJ-SECURITY-SYSTEM-001';
    addCandidate(result, { riskObjectType: 'security_and_access_system', label: 'Security, alarm or access-control system', confidence: 'high', ruleId, rationale: 'The owner selected the structured security and access-system category.', missingQuestions: ['Is it fixed, monitored and owned by the client or a service provider?', 'What power, connectivity and maintenance dependencies exist?'] });
    addCover(result, { coverKey: commercial ? 'electronic_equipment' : 'domestic_buildings_houseowners', ruleId, rationale: commercial ? 'Electronic security and access equipment can require specialist equipment treatment.' : 'Fixed domestic security equipment should be assessed with the building and attached installations.', confidence: 'high', missingQuestions: ['Confirm ownership, installation, replacement value and power protection.'] });
    if (commercial && criticalToOperations === 'yes') addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'Loss of a critical security system may prevent safe access or continued operation.', confidence: 'medium', missingQuestions: ['Would the site close or require temporary guarding after failure?'] });
  }

  if (generalAssetCategory === 'power energy') {
    const ruleId = 'OBJ-POWER-ENERGY-001';
    addCandidate(result, { riskObjectType: 'power_or_energy_equipment', label: 'Generator, inverter, battery or solar equipment', confidence: 'high', ruleId, rationale: 'The owner selected a structured backup-power or energy-equipment category.', missingQuestions: ['Is it fixed or portable, and who owns and installed it?', 'What capacity, certificates, maintenance, fire and theft controls apply?'] });
    addCover(result, { coverKey: commercial ? 'electronic_equipment' : mobility === 'fixed' ? 'domestic_buildings_houseowners' : 'domestic_home_contents_householders', ruleId, rationale: commercial ? 'Power electronics, controls and battery systems require equipment-specific physical-damage assessment.' : 'The home-use and installation facts determine whether the item is treated as a fixture or movable contents.', confidence: 'high', missingQuestions: ['Confirm installation, ownership, replacement value, surge and battery-fire controls.'] });
    if (commercial) addCover(result, { coverKey: 'machinery_breakdown', ruleId, rationale: 'Generators and installed power equipment can have an internal mechanical or electrical breakdown exposure.', confidence: 'medium', missingQuestions: ['Which components can fail internally and what service support exists?'] });
    if (commercial && criticalToOperations === 'yes') addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'The owner marked the power equipment as an operational dependency.', confidence: 'high', missingQuestions: ['What operations fail during an outage and for how long?'] });
  }

  if (generalAssetCategory === 'fixtures improvements') {
    const ruleId = 'OBJ-FIXTURE-IMPROVEMENT-001';
    addCandidate(result, { riskObjectType: commercial ? 'tenant_improvement_or_fixture' : 'domestic_fixed_installation', label: commercial ? 'Tenant improvement or fixed fixture' : 'Domestic fixed installation', confidence: 'high', ruleId, rationale: 'The owner classified the item as fixed, built in or an improvement.', missingQuestions: ['Who owns it and who is responsible under the title or lease?', 'Is its reinstatement value included in the building or contents valuation?'] });
    addCover(result, { coverKey: commercial ? 'buildings_combined' : 'domestic_buildings_houseowners', ruleId, rationale: 'Fixed installations and improvements should be tested against the building ownership and reinstatement basis.', confidence: 'high', missingQuestions: ['Confirm ownership, lease responsibility, construction and rebuilding value.'] });
    if (commercial) addCover(result, { coverKey: 'office_contents', ruleId, rationale: 'Tenant improvements can instead sit with office contents depending on ownership and wording.', confidence: 'medium', missingQuestions: ['Is the client a tenant and does the contents section include tenant improvements?'] });
  }

  if (generalAssetCategory === 'high value items') {
    const ruleId = 'OBJ-HIGH-VALUE-ITEM-001';
    addCandidate(result, { riskObjectType: commercial ? 'specified_high_value_business_property' : 'specified_high_value_personal_property', label: 'High-value item requiring individual review', confidence: 'high', ruleId, rationale: 'The owner identified the asset as high-value or specialist property.', missingQuestions: ['Is a current professional valuation available?', 'Where is it kept, displayed, transported and secured?'] });
    addCover(result, { coverKey: commercial ? 'business_all_risks' : 'personal_all_risks_portable_possessions', ruleId, rationale: 'High-value items may require individual specification, valuation and territorial treatment.', confidence: 'high', missingQuestions: ['Confirm item description, ownership, valuation, security, use and territory.'] });
  }

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
    addCandidate(result, { riskObjectType: commercial ? 'electronic_equipment' : 'personal_electronics', label: commercial ? 'Electronic equipment' : 'Personal electronic equipment', confidence: 'high', ruleId, rationale: 'The immutable facts identify electronic, computer or data-processing equipment.', missingQuestions: ['Is it portable or fixed?', 'What data, backup, power, cyber and operational dependencies exist?'] });
    if (commercial) {
      addCover(result, { coverKey: 'electronic_equipment', ruleId, rationale: 'Electronic equipment damage, data media and increased cost may require a specialist engineering section.', confidence: 'high', missingQuestions: ['Is equipment, data media or increased cost intended to be insured?'] });
      addCover(result, { coverKey: 'business_all_risks', ruleId, rationale: 'Portable equipment away from premises can require Business All Risks treatment.', confidence: portable === 'yes' ? 'high' : 'medium', missingQuestions: ['Does the item regularly leave the premises?'] });
      addCover(result, { coverKey: 'cyber_insurance', ruleId, rationale: 'Data, privacy and network interruption are distinct from physical equipment damage.', confidence: 'medium', missingQuestions: ['What data or network exposure exists beyond physical damage?'] });
      addCover(result, { coverKey: 'business_interruption', ruleId, rationale: 'Critical electronics can create revenue or increased-cost dependency.', confidence: criticalToOperations === 'yes' ? 'high' : 'medium', missingQuestions: ['Would loss of the item interrupt operations or require hired replacement equipment?'] });
    } else {
      addCover(result, { coverKey: portable === 'yes' ? 'personal_all_risks_portable_possessions' : 'domestic_home_contents_householders', ruleId, rationale: portable === 'yes' ? 'Portable personal electronics may require away-from-home specification.' : 'Personal electronics normally kept at home should first be assessed within household contents.', confidence: 'high', missingQuestions: ['Confirm replacement value, serial number, territory and any business use.'] });
    }
  }

  if (propertyAssetSubtype === 'land') {
    const ruleId = 'OBJ-LAND-001';
    addCandidate(result, {
      riskObjectType: 'land_or_property_interest',
      label: 'Land or property interest',
      confidence: 'high',
      ruleId,
      rationale: 'The owner explicitly recorded this property as land rather than a building or fixed improvement.',
      missingQuestions: [
        'What is the land used for, who owns or occupies it, and which liability or agricultural activities arise there?',
        'Are any buildings, fencing, boreholes, crops or other improvements recorded separately?',
      ],
    });
    if (commercial) {
      addCover(result, {
        coverKey: 'public_liability',
        ruleId,
        rationale: 'Ownership or occupation of land can create third-party liability even though the land itself does not have a rebuilding value.',
        confidence: 'medium',
        missingQuestions: ['Who enters or works on the land and what activities or hazards exist there?'],
      });
    }
  }

  if (propertyAssetSubtype === 'fixed improvement' || propertyAssetSubtype === 'tenant improvement') {
    const tenantImprovement = propertyAssetSubtype === 'tenant improvement' || propertyInterest === 'tenant improvement';
    const ruleId = tenantImprovement ? 'OBJ-TENANT-IMPROVEMENT-001' : 'OBJ-FIXED-IMPROVEMENT-001';
    addCandidate(result, {
      riskObjectType: tenantImprovement ? 'tenant_improvement' : 'fixed_property_improvement',
      label: tenantImprovement ? 'Tenant improvement' : 'Fixed property improvement',
      confidence: 'high',
      ruleId,
      rationale: tenantImprovement
        ? 'The owner recorded an improvement at a leased premises rather than ownership of the whole building.'
        : 'The owner recorded a permanent improvement separately from land and buildings.',
      missingQuestions: ['Who is responsible for insuring the improvement under the title or lease?', 'What is its current reinstatement cost and risk address?'],
    });
    addCover(result, {
      coverKey: commercial ? 'commercial_fire_allied_perils' : 'domestic_buildings_houseowners',
      ruleId,
      rationale: 'A fixed improvement is physical property at a stated location, but ownership and policy treatment must be confirmed.',
      confidence: 'high',
      missingQuestions: ['Confirm ownership, location, reinstatement value and whether it is included with a building or contents section.'],
    });
  }

  if (
    propertyAssetSubtype === 'building structure' ||
    (!propertyAssetSubtype && hasAny(haystack, ['building', 'warehouse', 'office', 'shop', 'factory', 'house', 'shed', 'structure']))
  ) {
    const ruleId = 'OBJ-BUILDING-001';
    addCandidate(result, { riskObjectType: commercial ? 'commercial_building' : 'domestic_building', label: commercial ? 'Commercial building' : 'Domestic building', confidence: 'high', ruleId, rationale: 'The asset facts identify a building or fixed structure.', missingQuestions: ['Who owns and occupies the structure?', 'What is the construction, occupancy, location and full rebuilding value?'] });
    addCover(result, { coverKey: commercial ? 'buildings_combined' : 'domestic_buildings_houseowners', ruleId, rationale: 'A building-specific section is a plausible primary treatment subject to ownership and use.', confidence: 'high', missingQuestions: ['Confirm segment, ownership, occupancy and rebuild basis.'] });
    if (commercial) addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'Commercial property perils and site accumulation require consideration.', confidence: 'high', missingQuestions: ['Which perils, locations and property categories are scheduled?'] });
    addCover(result, { coverKey: 'public_liability', ruleId, rationale: 'Ownership or occupation of premises can create third-party liability.', confidence: 'medium', missingQuestions: ['Who visits, occupies or works at the location?'] });
    addCover(result, { coverKey: 'machinery_breakdown', ruleId, rationale: 'Fixed mechanical services are separate from the building structure.', confidence: 'low', missingQuestions: ['Which lifts, pumps, refrigeration or mechanical services are critical?'] });
    addCover(result, { coverKey: 'electronic_equipment', ruleId, rationale: 'Building systems and electronic controls may need more specific treatment.', confidence: 'low', missingQuestions: ['Which fixed electronics, security or energy-control systems exist?'] });
    addPhysicalPropertyDependencies(result, ruleId, 'A physical building exposure exists.');
  }

  if (stockAssetSubtype === 'livestock') {
    const ruleId = 'OBJ-LIVESTOCK-001';
    addCandidate(result, {
      riskObjectType: 'livestock_or_herd',
      label: 'Livestock or herd',
      confidence: 'high',
      ruleId,
      rationale: 'The owner explicitly classified this stock record as livestock.',
      missingQuestions: ['Which animals, quantities, identification and value basis apply?', 'What health, security, movement and accumulation controls exist?'],
    });
    addCover(result, {
      coverKey: 'livestock_pedigree_game',
      ruleId,
      rationale: 'Livestock requires specialist animal treatment rather than ordinary premises stock classification.',
      confidence: 'high',
      missingQuestions: ['Confirm animal schedule or herd basis, per-animal or agreed values, covered perils and veterinary requirements.'],
    });
    addCover(result, {
      coverKey: 'agricultural_package_farm_property',
      ruleId,
      rationale: 'The livestock exposure should be considered alongside the wider farm property and operational position.',
      confidence: 'medium',
      missingQuestions: ['What other farm property, produce and liability exposures exist at the same locations?'],
    });
  }

  if (stockAssetSubtype !== 'livestock' && hasAny(haystack, ['stock', 'inventory', 'goods', 'produce', 'materials', 'merchandise'])) {
    const ruleId = 'OBJ-STOCK-001';
    addCandidate(result, { riskObjectType: 'stock_or_goods', label: 'Stock, goods or materials', confidence: 'high', ruleId, rationale: stockAssetSubtype ? 'The owner selected a structured stock subtype and value basis.' : 'The asset facts identify stock, goods, produce or inventory.', missingQuestions: [stockValuationBasis ? 'Confirm that the recorded value follows the selected basis and VAT treatment.' : 'Who owns the goods and what is the valuation basis?', 'What are the peak values by location and conveyance?'] });
    addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'Stock at a premises can form part of the commercial property value at risk.', confidence: 'high', missingQuestions: ['What stock is held at each location and on what valuation basis?'] });
    addCover(result, { coverKey: 'goods_in_transit', ruleId, rationale: 'Movement between locations creates a separate transit exposure.', confidence: stockMovement === 'regular transit' ? 'high' : stockMovement === 'one location' ? 'low' : 'medium', missingQuestions: ['When and how are the goods transported?'] });
    addCover(result, { coverKey: 'marine_cargo_stock_throughput', ruleId, rationale: 'International transit or continuous stock throughput may require marine treatment.', confidence: 'low', missingQuestions: ['Are imports, exports, Incoterms or overseas voyages involved?'] });
    addCover(result, { coverKey: 'commercial_theft', ruleId, rationale: 'Stock theft trigger and security conditions should be assessed separately.', confidence: 'medium', missingQuestions: ['What theft trigger, security and stock controls apply?'] });
    if (temperatureSensitiveStock !== 'no') {
      addCover(result, { coverKey: 'machinery_breakdown_bi_deterioration_stock', ruleId, rationale: 'Temperature-sensitive produce may deteriorate after equipment or supply failure.', confidence: temperatureSensitiveStock === 'yes' ? 'high' : 'low', missingQuestions: ['Is stock temperature-sensitive or dependent on refrigeration?'] });
    }
  }

  if (hasAny(haystack, ['tools', 'tool set', 'power tool', 'workshop equipment', 'handheld equipment'])) {
    const ruleId = 'OBJ-TOOLS-001';
    addCandidate(result, { riskObjectType: 'tools_and_workshop_equipment', label: 'Tools or workshop equipment', confidence: 'high', ruleId, rationale: 'The asset facts identify tools, powered tools or workshop equipment.', missingQuestions: ['Are the tools portable, kept in vehicles or used at client sites?', 'What serials, values, security and custody controls apply?'] });
    addCover(result, { coverKey: 'business_all_risks', ruleId, rationale: 'Portable business tools can require accidental-loss, theft and away-from-premises treatment.', confidence: portable === 'yes' ? 'high' : 'medium', missingQuestions: ['Where are the tools used and stored, and what vehicle or site security applies?'] });
    addCover(result, { coverKey: 'commercial_theft', ruleId, rationale: 'Theft trigger and security conditions should be assessed for tools kept at a workshop or premises.', confidence: 'medium', missingQuestions: ['What alarm, access, storage and inventory controls apply?'] });
    addCover(result, { coverKey: 'commercial_fire_allied_perils', ruleId, rationale: 'Tools stored at a declared business premises remain part of the physical property value at risk.', confidence: 'medium', missingQuestions: ['At which locations are the tools kept and what are the peak values?'] });
  }

  if (!generalAssetCategory && hasAny(haystack, ['furniture', 'desk', 'chair', 'couch', 'cupboard', 'shelving'])) {
    const ruleId = 'OBJ-CONTENTS-LEGACY-001';
    addCandidate(result, { riskObjectType: commercial ? 'commercial_contents' : 'household_contents', label: commercial ? 'Possible commercial furniture or contents' : 'Possible household contents', confidence: 'medium', ruleId, rationale: 'The item title contains a common furniture or contents term, but the new structured category has not been confirmed.', missingQuestions: ['Is this home or business property, and at which address is it kept?'] });
    addCover(result, { coverKey: commercial ? 'office_contents' : 'domestic_home_contents_householders', ruleId, rationale: 'The item appears to be furniture or ordinary contents, subject to confirmation of use and location.', confidence: 'medium', missingQuestions: ['Confirm use, location, ownership and replacement value.'] });
  }

  if (!generalAssetCategory && hasAny(haystack, ['fridge', 'freezer', 'washing machine', 'dishwasher', 'microwave', 'appliance'])) {
    const ruleId = 'OBJ-APPLIANCE-LEGACY-001';
    addCandidate(result, { riskObjectType: commercial ? 'commercial_appliance' : 'domestic_equipment', label: 'Possible appliance', confidence: 'medium', ruleId, rationale: 'The item title contains a common appliance term, but its structured use and dependency facts have not been confirmed.', missingQuestions: ['Is it for home or business use, and does stock or income depend on it?'] });
    addCover(result, { coverKey: commercial ? 'office_contents' : 'domestic_home_contents_householders', ruleId, rationale: 'The item appears to be an ordinary appliance and should first be assessed with the applicable contents section.', confidence: 'medium', missingQuestions: ['Confirm use, location, installation and replacement value.'] });
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
