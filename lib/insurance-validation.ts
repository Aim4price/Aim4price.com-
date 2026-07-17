import { INSURANCE_COVER_BY_KEY, INSURANCE_INDUSTRY_PROFILES } from './insurance-cover-catalogue';
import type {
  InsuranceCurrentCoverPosition,
  InsuranceExposureStatus,
  InsurancePlacementStage,
  InsuranceSourceType,
  InsuranceCommand,
} from './insurance-workspace-types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_PATTERN = /^\d{1,17}(?:\.\d{1,4})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const industryKeys = new Set(INSURANCE_INDUSTRY_PROFILES.map((profile) => profile.key));
const sourceTypes = new Set(['owner_provided', 'broker_recorded', 'policy_schedule', 'wording', 'insurer_confirmed', 'migrated_existing', 'system_suggestion']);
const exposureStatuses = new Set(['discovered', 'confirmed', 'dismissed_with_reason', 'information_required']);
const currentCoverPositions = new Set(['unknown', 'not_recorded', 'confirmed_included', 'confirmed_excluded', 'not_applicable', 'covered_elsewhere']);
const placementStages = new Set(['not_assessed', 'area_to_consider', 'information_required', 'quote_requested', 'quoted', 'broker_recommended', 'client_accepted', 'client_declined', 'insurer_declined', 'not_taken', 'not_applicable']);
const financialTermTypes = new Set(['value', 'sum_insured', 'any_one_item_limit', 'any_one_event_limit', 'any_one_location_limit', 'any_one_conveyance_limit', 'any_one_claim_limit', 'annual_aggregate', 'first_loss_limit', 'catastrophe_limit', 'sublimit', 'basic_excess', 'additional_excess', 'percentage_excess', 'time_excess', 'coinsurance', 'average_indicator']);
const partyTypes = new Set(['person', 'organisation', 'trust', 'estate', 'other']);
const partyRoleKeys = new Set(['insured', 'owner', 'financier_mortgagee', 'beneficiary', 'operator', 'custodian', 'principal', 'contractor']);
const evidenceTypes = new Set(['shared_photo', 'shared_document', 'policy_schedule', 'wording', 'endorsement', 'valuation', 'certificate', 'correspondence', 'other_reference']);
const evidenceEntityTypes = new Set(['party', 'location', 'risk_object', 'exposure', 'policy', 'section', 'schedule_item', 'assessment', 'component', 'financial_term', 'information_request']);
const relatedEntityTypes = new Set(['asset', ...evidenceEntityTypes]);
const classificationStatuses = new Set(['unconfirmed', 'human_confirmed', 'dismissed']);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INSURANCE_INVALID_REQUEST');
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string, maxLength: number, required = false): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new Error(`INSURANCE_REQUIRED:${field}`);
  if (result.length > maxLength) throw new Error(`INSURANCE_INVALID_TEXT:${field}`);
  return result;
}

function enumValue<T extends string>(value: unknown, allowed: Set<string>, field: string, fallback: T): T {
  if (value === undefined || value === null || value === '') return fallback;
  const candidate = stringValue(value, field, 100, true);
  if (!allowed.has(candidate)) throw new Error(`INSURANCE_INVALID_ENUM:${field}`);
  return candidate as T;
}

function integerValue(value: unknown, field: string, required = false): number | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`INSURANCE_REQUIRED:${field}`);
    return undefined;
  }
  if (!Number.isInteger(value) || Number(value) < 1) throw new Error(`INSURANCE_INVALID_VERSION:${field}`);
  return Number(value);
}

function uuidValue(value: unknown, field: string, required = false): string | undefined {
  const candidate = stringValue(value, field, 64, required);
  if (!candidate) return undefined;
  if (!UUID_PATTERN.test(candidate)) throw new Error(`INSURANCE_INVALID_UUID:${field}`);
  return candidate;
}

function uuidArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 500) throw new Error(`INSURANCE_INVALID_LINKS:${field}`);
  return [...new Set(value.map((entry) => uuidValue(entry, field, true) as string))];
}

function dateValue(value: unknown, field: string): string {
  const candidate = stringValue(value, field, 10);
  if (!candidate) return '';
  if (!DATE_PATTERN.test(candidate) || Number.isNaN(new Date(`${candidate}T00:00:00Z`).getTime())) throw new Error(`INSURANCE_INVALID_DATE:${field}`);
  return candidate;
}

function decimalValue(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`INSURANCE_DECIMAL_MUST_BE_STRING:${field}`);
  const candidate = value.trim();
  if (!DECIMAL_PATTERN.test(candidate)) throw new Error(`INSURANCE_INVALID_DECIMAL:${field}`);
  return candidate;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function source(body: Record<string, unknown>) {
  return {
    sourceType: enumValue<InsuranceSourceType>(body.sourceType, sourceTypes, 'sourceType', 'broker_recorded'),
    sourceReference: stringValue(body.sourceReference, 'sourceReference', 1000),
  } as const;
}

function identity(body: Record<string, unknown>) {
  return {
    id: uuidValue(body.id, 'id'),
    expectedVersion: integerValue(body.expectedVersion, 'expectedVersion'),
  };
}

function period(body: Record<string, unknown>) {
  const effectiveFrom = dateValue(body.effectiveFrom, 'effectiveFrom');
  const effectiveTo = dateValue(body.effectiveTo, 'effectiveTo');
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) throw new Error('INSURANCE_INVALID_EFFECTIVE_PERIOD');
  return { effectiveFrom, effectiveTo };
}

function relatedEntity(body: Record<string, unknown>) {
  const relatedEntityType = body.relatedEntityType === undefined || body.relatedEntityType === '' ? '' : enumValue(body.relatedEntityType, relatedEntityTypes, 'relatedEntityType', 'asset');
  const relatedEntityId = uuidValue(body.relatedEntityId, 'relatedEntityId') ?? null;
  if (Boolean(relatedEntityType) !== Boolean(relatedEntityId)) throw new Error('INSURANCE_RELATED_ENTITY_INCOMPLETE');
  return { relatedEntityType, relatedEntityId };
}

export function assertInsuranceUuid(value: string, field = 'id'): string {
  if (!UUID_PATTERN.test(value)) throw new Error(`INSURANCE_INVALID_UUID:${field}`);
  return value;
}

export function parseInsuranceCommand(value: unknown): InsuranceCommand {
  const body = record(value);
  const operation = stringValue(body.operation, 'operation', 80, true);

  if (operation === 'update_profile') {
    if (!Array.isArray(body.segments) || body.segments.length > 2) throw new Error('INSURANCE_INVALID_SEGMENTS');
    const segments = [...new Set(body.segments.map((entry) => enumValue(entry, new Set(['domestic', 'commercial']), 'segments', 'commercial')))] as Array<'domestic' | 'commercial'>;
    const industryProfiles = Array.isArray(body.industryProfiles)
      ? [...new Set(body.industryProfiles.map((entry) => enumValue(entry, industryKeys, 'industryProfiles', 'other_specialist_referral')))]
      : [];
    if (industryProfiles.length && !segments.includes('commercial')) throw new Error('INSURANCE_COMMERCIAL_SEGMENT_REQUIRED');
    return { operation, expectedVersion: integerValue(body.expectedVersion, 'expectedVersion', true) as number, segments, industryProfiles };
  }

  if (operation === 'save_location') {
    const latitude = decimalValue(body.latitude, 'latitude');
    const longitude = decimalValue(body.longitude, 'longitude');
    if (latitude !== null && (Number(latitude) < -90 || Number(latitude) > 90)) throw new Error('INSURANCE_INVALID_LATITUDE');
    if (longitude !== null && (Number(longitude) < -180 || Number(longitude) > 180)) throw new Error('INSURANCE_INVALID_LONGITUDE');
    return { operation, ...identity(body), label: stringValue(body.label, 'label', 240, true), addressText: stringValue(body.addressText, 'addressText', 2000), occupancyUse: stringValue(body.occupancyUse, 'occupancyUse', 1000), latitude, longitude };
  }

  if (operation === 'save_risk_object') {
    return { operation, id: uuidValue(body.id, 'id', true) as string, expectedVersion: integerValue(body.expectedVersion, 'expectedVersion', true) as number, objectType: stringValue(body.objectType, 'objectType', 160, true), objectLabel: stringValue(body.objectLabel, 'objectLabel', 300, true), useDescription: stringValue(body.useDescription, 'useDescription', 4000), locationId: uuidValue(body.locationId, 'locationId') ?? null, classificationStatus: enumValue(body.classificationStatus, classificationStatuses, 'classificationStatus', 'unconfirmed') };
  }

  if (operation === 'save_party') {
    if (!Array.isArray(body.roles) || body.roles.length > 8) throw new Error('INSURANCE_INVALID_PARTY_ROLES');
    const roles = body.roles.map((value) => {
      const role = record(value);
      return {
        roleKey: enumValue(role.roleKey, partyRoleKeys, 'roleKey', 'insured'),
        context: stringValue(role.context, 'roleContext', 1000),
      };
    });
    if (!roles.length) throw new Error('INSURANCE_PARTY_ROLE_REQUIRED');
    if (new Set(roles.map((role) => role.roleKey)).size !== roles.length) throw new Error('INSURANCE_DUPLICATE_PARTY_ROLE');
    return { operation, ...identity(body), partyType: enumValue(body.partyType, partyTypes, 'partyType', 'organisation'), displayName: stringValue(body.displayName, 'displayName', 300, true), registrationOrIdReference: stringValue(body.registrationOrIdReference, 'registrationOrIdReference', 240), roles };
  }

  if (operation === 'save_exposure') {
    const exposureStatus = enumValue<InsuranceExposureStatus>(body.exposureStatus, exposureStatuses, 'exposureStatus', 'discovered');
    const dismissalReason = stringValue(body.dismissalReason, 'dismissalReason', 4000);
    if (exposureStatus === 'dismissed_with_reason' && !dismissalReason) throw new Error('INSURANCE_DISMISSAL_REASON_REQUIRED');
    return { operation, ...identity(body), exposureType: stringValue(body.exposureType, 'exposureType', 160, true), label: stringValue(body.label, 'label', 300, true), description: stringValue(body.description, 'description', 8000), exposureStatus, dismissalReason, assetIds: uuidArray(body.assetIds, 'assetIds'), locationIds: uuidArray(body.locationIds, 'locationIds'), partyIds: uuidArray(body.partyIds, 'partyIds') };
  }

  if (operation === 'save_policy') {
    const dates = { inceptionDate: dateValue(body.inceptionDate, 'inceptionDate'), renewalDate: dateValue(body.renewalDate, 'renewalDate'), ...period(body) };
    return { operation, ...identity(body), insurerName: stringValue(body.insurerName, 'insurerName', 240), productName: stringValue(body.productName, 'productName', 240), policyNumber: stringValue(body.policyNumber, 'policyNumber', 160), status: enumValue(body.status, new Set(['unknown', 'current', 'expired', 'cancelled', 'draft']), 'status', 'unknown'), ...dates, ...source(body) };
  }

  if (operation === 'save_section') {
    const canonicalCoverKey = stringValue(body.canonicalCoverKey, 'canonicalCoverKey', 160) || null;
    if (canonicalCoverKey && !INSURANCE_COVER_BY_KEY[canonicalCoverKey]) throw new Error('INSURANCE_INVALID_COVER_KEY');
    return { operation, ...identity(body), policyId: uuidValue(body.policyId, 'policyId', true) as string, canonicalCoverKey, actualSectionLabel: stringValue(body.actualSectionLabel, 'actualSectionLabel', 300, true), sectionNumberReference: stringValue(body.sectionNumberReference, 'sectionNumberReference', 160), wordingEditionReference: stringValue(body.wordingEditionReference, 'wordingEditionReference', 300), status: enumValue(body.status, new Set(['unknown', 'current', 'excluded', 'not_taken', 'expired']), 'status', 'unknown'), ...period(body), ...source(body) };
  }

  if (operation === 'save_schedule_item') {
    return { operation, ...identity(body), sectionId: uuidValue(body.sectionId, 'sectionId', true) as string, itemReference: stringValue(body.itemReference, 'itemReference', 160), itemLabel: stringValue(body.itemLabel, 'itemLabel', 300, true), itemDescription: stringValue(body.itemDescription, 'itemDescription', 8000), treatment: enumValue(body.treatment, new Set(['individual', 'grouped', 'blanket', 'unscheduled']), 'treatment', 'unscheduled'), assetIds: uuidArray(body.assetIds, 'assetIds'), exposureIds: uuidArray(body.exposureIds, 'exposureIds'), locationIds: uuidArray(body.locationIds, 'locationIds'), partyIds: uuidArray(body.partyIds, 'partyIds'), ...source(body) };
  }

  if (operation === 'save_assessment') {
    const canonicalCoverKey = stringValue(body.canonicalCoverKey, 'canonicalCoverKey', 160) || null;
    if (canonicalCoverKey && !INSURANCE_COVER_BY_KEY[canonicalCoverKey]) throw new Error('INSURANCE_INVALID_COVER_KEY');
    const currentCoverPosition = enumValue<InsuranceCurrentCoverPosition>(body.currentCoverPosition, currentCoverPositions, 'currentCoverPosition', 'unknown');
    const placementStage = enumValue<InsurancePlacementStage>(body.placementStage, placementStages, 'placementStage', 'not_assessed');
    const sourceFields = source(body);
    if (currentCoverPosition === 'confirmed_included' && (sourceFields.sourceType === 'system_suggestion' || !sourceFields.sourceReference)) throw new Error('INSURANCE_CONFIRMED_COVER_SOURCE_REQUIRED');
    const brokerRationale = stringValue(body.brokerRationale, 'brokerRationale', 8000);
    if (placementStage === 'broker_recommended' && !brokerRationale) throw new Error('INSURANCE_BROKER_RATIONALE_REQUIRED');
    const exposureStatus = enumValue<InsuranceExposureStatus>(body.exposureStatus, exposureStatuses, 'exposureStatus', 'discovered');
    const dismissalReason = stringValue(body.dismissalReason, 'dismissalReason', 4000);
    if (exposureStatus === 'dismissed_with_reason' && !dismissalReason) throw new Error('INSURANCE_DISMISSAL_REASON_REQUIRED');
    return { operation, ...identity(body), canonicalCoverKey, coverLabel: stringValue(body.coverLabel, 'coverLabel', 300), exposureStatus, currentCoverPosition, placementStage, brokerRationale, dismissalReason, assetIds: uuidArray(body.assetIds, 'assetIds'), exposureIds: uuidArray(body.exposureIds, 'exposureIds'), locationIds: uuidArray(body.locationIds, 'locationIds'), partyIds: uuidArray(body.partyIds, 'partyIds'), sectionIds: uuidArray(body.sectionIds, 'sectionIds'), scheduleItemIds: uuidArray(body.scheduleItemIds, 'scheduleItemIds'), ...sourceFields };
  }

  if (operation === 'save_component') {
    const selectionStatus = enumValue<InsuranceCurrentCoverPosition>(body.selectionStatus, currentCoverPositions, 'selectionStatus', 'unknown');
    const sourceFields = source(body);
    if (selectionStatus === 'confirmed_included' && (sourceFields.sourceType === 'system_suggestion' || !sourceFields.sourceReference)) throw new Error('INSURANCE_CONFIRMED_COVER_SOURCE_REQUIRED');
    return { operation, ...identity(body), assessmentId: uuidValue(body.assessmentId, 'assessmentId', true) as string, componentType: enumValue(body.componentType, new Set(['core_cover', 'extension', 'optional_benefit', 'exclusion', 'condition', 'warranty', 'endorsement']), 'componentType', 'core_cover'), componentKey: stringValue(body.componentKey, 'componentKey', 160), label: stringValue(body.label, 'label', 300, true), selectionStatus, territory: stringValue(body.territory, 'territory', 1000), ...period(body), conditionsNotes: stringValue(body.conditionsNotes, 'conditionsNotes', 8000), ...sourceFields };
  }

  if (operation === 'save_financial_term') {
    const assessmentId = uuidValue(body.assessmentId, 'assessmentId');
    const componentId = uuidValue(body.componentId, 'componentId');
    const scheduleItemId = uuidValue(body.scheduleItemId, 'scheduleItemId');
    if (![assessmentId, componentId, scheduleItemId].filter(Boolean).length) throw new Error('INSURANCE_FINANCIAL_TERM_PARENT_REQUIRED');
    const currency = stringValue(body.currency, 'currency', 3) || 'ZAR';
    if (!CURRENCY_PATTERN.test(currency)) throw new Error('INSURANCE_INVALID_CURRENCY');
    return { operation, ...identity(body), assessmentId, componentId, scheduleItemId, termType: enumValue(body.termType, financialTermTypes, 'termType', 'value'), amount: decimalValue(body.amount, 'amount'), percentage: decimalValue(body.percentage, 'percentage'), timeValue: decimalValue(body.timeValue, 'timeValue'), timeUnit: enumValue(body.timeUnit, new Set(['', 'hours', 'days']), 'timeUnit', ''), currency, valuationBasis: stringValue(body.valuationBasis, 'valuationBasis', 500), limitType: stringValue(body.limitType, 'limitType', 300), vatBasis: enumValue(body.vatBasis, new Set(['', 'inclusive', 'exclusive', 'unknown', 'not_applicable']), 'vatBasis', ''), valuationDate: dateValue(body.valuationDate, 'valuationDate'), ...period(body), ...source(body) };
  }

  if (operation === 'save_information_request') {
    return { operation, ...identity(body), question: stringValue(body.question, 'question', 4000, true), reason: stringValue(body.reason, 'reason', 4000, true), ...relatedEntity(body), status: enumValue(body.status, new Set(['open', 'sent_to_client', 'answered', 'resolved', 'not_applicable']), 'status', 'open'), response: stringValue(body.response, 'response', 8000) };
  }

  if (operation === 'save_note') {
    return { operation, ...identity(body), noteType: enumValue(body.noteType, new Set(['private_broker', 'client_information_request', 'insurer_underwriter', 'report_visible']), 'noteType', 'private_broker'), ...relatedEntity(body), body: stringValue(body.body, 'body', 12000, true) };
  }

  if (operation === 'save_evidence') {
    const entityType = body.entityType === undefined || body.entityType === '' ? undefined : enumValue(body.entityType, evidenceEntityTypes, 'entityType', 'assessment');
    const entityId = uuidValue(body.entityId, 'entityId');
    if (Boolean(entityType) !== Boolean(entityId)) throw new Error('INSURANCE_EVIDENCE_LINK_INCOMPLETE');
    const existingSharedReference = stringValue(body.existingSharedReference, 'existingSharedReference', 1000);
    const sourceReference = stringValue(body.sourceReference, 'sourceReference', 1000);
    if (!existingSharedReference && !sourceReference) throw new Error('INSURANCE_EVIDENCE_REFERENCE_REQUIRED');
    return { operation, evidenceType: enumValue(body.evidenceType, evidenceTypes, 'evidenceType', 'other_reference'), label: stringValue(body.label, 'label', 300, true), existingSharedReference, sourceReference, notes: stringValue(body.notes, 'notes', 4000), entityType, entityId };
  }

  if (operation === 'ingest_snapshot_revision') {
    return {
      operation,
      shareId: uuidValue(body.shareId, 'shareId', true) as string,
      expectedVersion: integerValue(body.expectedVersion, 'expectedVersion', true) as number,
    };
  }

  if (operation === 'refresh_suggestions') {
    return { operation, assetIds: uuidArray(body.assetIds, 'assetIds') };
  }

  if (operation === 'decide_suggestion') {
    return { operation, suggestionId: uuidValue(body.suggestionId, 'suggestionId', true) as string, decision: enumValue(body.decision, new Set(['accepted_for_assessment', 'dismissed_with_reason', 'information_required']), 'decision', 'information_required'), rationale: stringValue(body.rationale, 'rationale', 4000, true) };
  }

  if (operation === 'decide_suggestions') {
    const suggestionIds = uuidArray(body.suggestionIds, 'suggestionIds');
    if (!suggestionIds.length) throw new Error('INSURANCE_SUGGESTION_REQUIRED');
    return { operation, suggestionIds, decision: enumValue(body.decision, new Set(['accepted_for_assessment', 'dismissed_with_reason', 'information_required']), 'decision', 'information_required'), rationale: stringValue(body.rationale, 'rationale', 4000, true) };
  }

  if (booleanValue(body.allowUnknownOperation)) throw new Error('INSURANCE_UNKNOWN_OPERATION');
  throw new Error('INSURANCE_UNKNOWN_OPERATION');
}
