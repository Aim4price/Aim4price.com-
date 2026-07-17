import type {
  InsuranceClientSegment,
  InsuranceIndustryProfileKey,
} from './insurance-cover-catalogue';
import type { InsuranceRuleConfidence } from './insurance-classification-engine';

export type InsuranceReviewStatus = 'not_started' | 'in_progress' | 'completed';
export type InsuranceReportType = 'summary' | 'detailed';

export type InsuranceWorkspaceAsset = {
  id: string;
  sourceAssetKey: string;
  title: string;
  kind: string;
  location: string;
  registerValue: number;
  replacementValue: number;
  photoUrl: string;
  serialNumber: string;
  registrationNumber: string;
  yearModel: number | null;
  condition: string;
  snapshot: Record<string, unknown>;
};

export type InsuranceReportSnapshotSummary = {
  id: string;
  type: InsuranceReportType;
  revision: number;
  reference: string;
  filename: string;
  generatedAtIso: string;
};

export type InsuranceExposureStatus = 'discovered' | 'confirmed' | 'dismissed_with_reason' | 'information_required';
export type InsuranceCurrentCoverPosition =
  | 'unknown'
  | 'not_recorded'
  | 'confirmed_included'
  | 'confirmed_excluded'
  | 'not_applicable'
  | 'covered_elsewhere';
export type InsurancePlacementStage =
  | 'not_assessed'
  | 'area_to_consider'
  | 'information_required'
  | 'quote_requested'
  | 'quoted'
  | 'broker_recommended'
  | 'client_accepted'
  | 'client_declined'
  | 'insurer_declined'
  | 'not_taken'
  | 'not_applicable';
export type InsuranceSourceType =
  | 'owner_provided'
  | 'broker_recorded'
  | 'policy_schedule'
  | 'wording'
  | 'insurer_confirmed'
  | 'migrated_existing'
  | 'system_suggestion';
export type InsuranceExtractionMethod = 'manual' | 'imported' | 'deterministic_rule';

export type InsuranceProvenance = {
  sourceType: InsuranceSourceType;
  sourceReference: string;
  confidence: InsuranceRuleConfidence | '';
  extractionMethod: InsuranceExtractionMethod;
  humanConfirmedBy: string;
  humanConfirmedAtIso: string | null;
  unresolvedQuestion: string;
};

export type InsuranceSnapshotRevision = {
  id: string;
  revision: number;
  sourceShareId: string;
  hash: string;
  generatedAtIso: string | null;
  importedAtIso: string;
  ownerAuthorisationReference: string;
  assetCount: number;
};

export type InsuranceSnapshotDiff = {
  id: string;
  sourceAssetKey: string;
  changeType: 'added' | 'removed' | 'materially_changed';
  changedFields: string[];
};

export type InsuranceLocation = {
  id: string;
  label: string;
  addressText: string;
  latitude: string | null;
  longitude: string | null;
  occupancyUse: string;
  isUnknown: boolean;
  version: number;
  assetIds: string[];
};

export type InsuranceRiskObject = {
  id: string;
  workspaceAssetId: string | null;
  objectType: string;
  objectLabel: string;
  useDescription: string;
  locationId: string | null;
  classificationStatus: 'unconfirmed' | 'human_confirmed' | 'dismissed';
  provenance: InsuranceProvenance;
  version: number;
};

export type InsuranceExposure = {
  id: string;
  exposureType: string;
  label: string;
  description: string;
  exposureStatus: InsuranceExposureStatus;
  dismissalReason: string;
  assetIds: string[];
  locationIds: string[];
  partyIds: string[];
  provenance: InsuranceProvenance;
  version: number;
};

export type InsuranceParty = {
  id: string;
  partyType: 'person' | 'organisation' | 'trust' | 'estate' | 'other';
  displayName: string;
  registrationOrIdReference: string;
  roles: Array<{
    roleKey: 'insured' | 'owner' | 'financier_mortgagee' | 'beneficiary' | 'operator' | 'custodian' | 'principal' | 'contractor';
    context: string;
  }>;
  version: number;
};

export type InsuranceEvidence = {
  id: string;
  evidenceType: 'shared_photo' | 'shared_document' | 'policy_schedule' | 'wording' | 'endorsement' | 'valuation' | 'certificate' | 'correspondence' | 'other_reference';
  label: string;
  existingSharedReference: string;
  sourceReference: string;
  notes: string;
  links: Array<{
    entityType: 'party' | 'location' | 'risk_object' | 'exposure' | 'policy' | 'section' | 'schedule_item' | 'assessment' | 'component' | 'financial_term' | 'information_request';
    entityId: string;
  }>;
  createdAtIso: string;
};

export type InsurancePolicy = {
  id: string;
  insurerName: string;
  productName: string;
  policyNumber: string;
  status: 'unknown' | 'current' | 'expired' | 'cancelled' | 'draft';
  inceptionDate: string;
  effectiveFrom: string;
  effectiveTo: string;
  renewalDate: string;
  evidenceStatus: 'not_supplied' | 'referenced' | 'verified';
  provenance: InsuranceProvenance;
  version: number;
  sections: InsurancePolicySection[];
};

export type InsurancePolicySection = {
  id: string;
  policyId: string;
  canonicalCoverKey: string | null;
  actualSectionLabel: string;
  sectionNumberReference: string;
  wordingEditionReference: string;
  status: 'unknown' | 'current' | 'excluded' | 'not_taken' | 'expired';
  effectiveFrom: string;
  effectiveTo: string;
  provenance: InsuranceProvenance;
  version: number;
  scheduleItems: InsuranceScheduleItem[];
};

export type InsuranceScheduleItem = {
  id: string;
  sectionId: string;
  itemReference: string;
  itemLabel: string;
  itemDescription: string;
  treatment: 'individual' | 'grouped' | 'blanket' | 'unscheduled';
  effectiveFrom: string;
  effectiveTo: string;
  assetIds: string[];
  exposureIds: string[];
  locationIds: string[];
  partyIds: string[];
  financialTerms: InsuranceFinancialTerm[];
  provenance: InsuranceProvenance;
  version: number;
};

export type InsuranceFinancialTerm = {
  id: string;
  termType:
    | 'value'
    | 'sum_insured'
    | 'any_one_item_limit'
    | 'any_one_event_limit'
    | 'any_one_location_limit'
    | 'any_one_conveyance_limit'
    | 'any_one_claim_limit'
    | 'annual_aggregate'
    | 'first_loss_limit'
    | 'catastrophe_limit'
    | 'sublimit'
    | 'basic_excess'
    | 'additional_excess'
    | 'percentage_excess'
    | 'time_excess'
    | 'coinsurance'
    | 'average_indicator';
  amount: string | null;
  percentage: string | null;
  timeValue: string | null;
  timeUnit: '' | 'hours' | 'days';
  currency: string;
  valuationBasis: string;
  limitType: string;
  vatBasis: '' | 'inclusive' | 'exclusive' | 'unknown' | 'not_applicable';
  valuationDate: string;
  effectiveFrom: string;
  effectiveTo: string;
  provenance: InsuranceProvenance;
  version: number;
};

export type InsuranceCoverComponent = {
  id: string;
  componentType: 'core_cover' | 'extension' | 'optional_benefit' | 'exclusion' | 'condition' | 'warranty' | 'endorsement';
  componentKey: string;
  label: string;
  selectionStatus: InsuranceCurrentCoverPosition;
  territory: string;
  effectiveFrom: string;
  effectiveTo: string;
  conditionsNotes: string;
  financialTerms: InsuranceFinancialTerm[];
  provenance: InsuranceProvenance;
  version: number;
};

export type InsuranceCoverAssessment = {
  id: string;
  canonicalCoverKey: string | null;
  coverLabel: string;
  catalogueVersion: string;
  exposureStatus: InsuranceExposureStatus;
  currentCoverPosition: InsuranceCurrentCoverPosition;
  placementStage: InsurancePlacementStage;
  systemSuggestionRuleId: string;
  systemSuggestionRationale: string;
  brokerRationale: string;
  dismissalReason: string;
  assetIds: string[];
  exposureIds: string[];
  locationIds: string[];
  partyIds: string[];
  sectionIds: string[];
  scheduleItemIds: string[];
  components: InsuranceCoverComponent[];
  financialTerms: InsuranceFinancialTerm[];
  provenance: InsuranceProvenance;
  version: number;
};

export type InsuranceInformationRequest = {
  id: string;
  question: string;
  reason: string;
  relatedEntityType: string;
  relatedEntityId: string | null;
  status: 'open' | 'sent_to_client' | 'answered' | 'resolved' | 'not_applicable';
  response: string;
  requestedAtIso: string;
  resolvedAtIso: string | null;
  version: number;
};

export type InsuranceNote = {
  id: string;
  noteType: 'private_broker' | 'client_information_request' | 'insurer_underwriter' | 'report_visible';
  relatedEntityType: string;
  relatedEntityId: string | null;
  body: string;
  createdAtIso: string;
  version: number;
};

export type InsuranceSuggestion = {
  id: string;
  workspaceAssetId: string | null;
  exposureId: string | null;
  suggestedRiskObjectType: string;
  suggestedCoverKey: string | null;
  ruleId: string;
  ruleVersion: string;
  rationale: string;
  confidence: InsuranceRuleConfidence;
  missingQuestions: string[];
  decision: 'accepted_for_assessment' | 'dismissed_with_reason' | 'information_required' | null;
  decisionRationale: string;
};

export type InsuranceWorkspaceData = {
  schemaVersion: 1;
  catalogueVersion: string;
  id: string;
  workspaceId: string;
  shareId: string;
  clientName: string;
  clientMeta: string;
  clientLogoUrl: string;
  ownerMessage: string;
  reviewStatus: InsuranceReviewStatus;
  snapshotGeneratedAtIso: string | null;
  snapshotReference: string;
  assetCount: number;
  totalRegisterValue: number;
  totalReplacementValue: number;
  lastReviewedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  version: number;
  segments: InsuranceClientSegment[];
  industryProfiles: InsuranceIndustryProfileKey[];
  snapshotRevisions: InsuranceSnapshotRevision[];
  availableSnapshotShares: Array<{ id: string; createdAtIso: string; assetCount: number; ownerMessage: string }>;
  latestSnapshotDiffs: InsuranceSnapshotDiff[];
  locations: InsuranceLocation[];
  riskObjects: InsuranceRiskObject[];
  exposures: InsuranceExposure[];
  parties: InsuranceParty[];
  evidence: InsuranceEvidence[];
  policies: InsurancePolicy[];
  assessments: InsuranceCoverAssessment[];
  informationRequests: InsuranceInformationRequest[];
  notes: InsuranceNote[];
  suggestions: InsuranceSuggestion[];
  assets: InsuranceWorkspaceAsset[];
  reports: InsuranceReportSnapshotSummary[];
  overview: {
    locationCount: number;
    assetCount: number;
    nonAssetExposureCount: number;
    reviewedAssessmentCount: number;
    unassessedAssessmentCount: number;
    currentCoverCounts: Record<InsuranceCurrentCoverPosition, number>;
    placementCounts: Partial<Record<InsurancePlacementStage, number>>;
    openInformationRequestCount: number;
    missingSumInsuredCount: number;
    replacementValueDifferenceCount: number;
  };
};

export type InsurancePortfolioItem = Pick<
  InsuranceWorkspaceData,
  | 'id'
  | 'shareId'
  | 'clientName'
  | 'clientMeta'
  | 'clientLogoUrl'
  | 'ownerMessage'
  | 'reviewStatus'
  | 'snapshotGeneratedAtIso'
  | 'snapshotReference'
  | 'assetCount'
  | 'totalRegisterValue'
  | 'totalReplacementValue'
  | 'lastReviewedAtIso'
  | 'createdAtIso'
  | 'updatedAtIso'
> & {
  completedAssetCount: number;
  includedAssetCount: number;
  outstandingAssetCount: number;
  currentPolicyCount: number;
  openQuestionCount: number;
  nearestRenewalDateIso: string | null;
};

export type InsuranceCommand =
  | { operation: 'update_profile'; expectedVersion: number; segments: InsuranceClientSegment[]; industryProfiles: InsuranceIndustryProfileKey[] }
  | { operation: 'save_location'; id?: string; expectedVersion?: number; label: string; addressText?: string; occupancyUse?: string; latitude?: string | null; longitude?: string | null }
  | { operation: 'save_risk_object'; id: string; expectedVersion: number; objectType: string; objectLabel: string; useDescription?: string; locationId?: string | null; classificationStatus: InsuranceRiskObject['classificationStatus'] }
  | { operation: 'save_party'; id?: string; expectedVersion?: number; partyType: InsuranceParty['partyType']; displayName: string; registrationOrIdReference?: string; roles: InsuranceParty['roles'] }
  | { operation: 'save_exposure'; id?: string; expectedVersion?: number; exposureType: string; label: string; description?: string; exposureStatus?: InsuranceExposureStatus; dismissalReason?: string; assetIds?: string[]; locationIds?: string[]; partyIds?: string[] }
  | { operation: 'save_policy'; id?: string; expectedVersion?: number; insurerName?: string; productName?: string; policyNumber?: string; status?: InsurancePolicy['status']; inceptionDate?: string; effectiveFrom?: string; effectiveTo?: string; renewalDate?: string; sourceType?: InsuranceSourceType; sourceReference?: string }
  | { operation: 'save_section'; id?: string; expectedVersion?: number; policyId: string; canonicalCoverKey?: string | null; actualSectionLabel: string; sectionNumberReference?: string; wordingEditionReference?: string; status?: InsurancePolicySection['status']; effectiveFrom?: string; effectiveTo?: string; sourceType?: InsuranceSourceType; sourceReference?: string }
  | { operation: 'save_schedule_item'; id?: string; expectedVersion?: number; sectionId: string; itemReference?: string; itemLabel: string; itemDescription?: string; treatment?: InsuranceScheduleItem['treatment']; assetIds?: string[]; exposureIds?: string[]; locationIds?: string[]; partyIds?: string[]; sourceType?: InsuranceSourceType; sourceReference?: string }
  | { operation: 'save_assessment'; id?: string; expectedVersion?: number; canonicalCoverKey?: string | null; coverLabel?: string; exposureStatus?: InsuranceExposureStatus; currentCoverPosition?: InsuranceCurrentCoverPosition; placementStage?: InsurancePlacementStage; brokerRationale?: string; dismissalReason?: string; sourceType?: InsuranceSourceType; sourceReference?: string; assetIds?: string[]; exposureIds?: string[]; locationIds?: string[]; partyIds?: string[]; sectionIds?: string[]; scheduleItemIds?: string[] }
  | { operation: 'save_component'; id?: string; expectedVersion?: number; assessmentId: string; componentType: InsuranceCoverComponent['componentType']; componentKey?: string; label: string; selectionStatus?: InsuranceCurrentCoverPosition; territory?: string; effectiveFrom?: string; effectiveTo?: string; conditionsNotes?: string; sourceType?: InsuranceSourceType; sourceReference?: string }
  | { operation: 'save_financial_term'; id?: string; expectedVersion?: number; assessmentId?: string; componentId?: string; scheduleItemId?: string; termType: InsuranceFinancialTerm['termType']; amount?: string | null; percentage?: string | null; timeValue?: string | null; timeUnit?: InsuranceFinancialTerm['timeUnit']; currency?: string; valuationBasis?: string; limitType?: string; vatBasis?: InsuranceFinancialTerm['vatBasis']; valuationDate?: string; effectiveFrom?: string; effectiveTo?: string; sourceType?: InsuranceSourceType; sourceReference?: string }
  | { operation: 'save_information_request'; id?: string; expectedVersion?: number; question: string; reason: string; relatedEntityType?: string; relatedEntityId?: string | null; status?: InsuranceInformationRequest['status']; response?: string }
  | { operation: 'save_note'; id?: string; expectedVersion?: number; noteType: InsuranceNote['noteType']; relatedEntityType?: string; relatedEntityId?: string | null; body: string }
  | { operation: 'save_evidence'; evidenceType: InsuranceEvidence['evidenceType']; label: string; existingSharedReference?: string; sourceReference?: string; notes?: string; entityType?: InsuranceEvidence['links'][number]['entityType']; entityId?: string | null }
  | { operation: 'ingest_snapshot_revision'; shareId: string; expectedVersion: number }
  | { operation: 'refresh_suggestions'; assetIds?: string[] }
  | { operation: 'decide_suggestion'; suggestionId: string; decision: 'accepted_for_assessment' | 'dismissed_with_reason' | 'information_required'; rationale: string }
  | { operation: 'decide_suggestions'; suggestionIds: string[]; decision: 'accepted_for_assessment' | 'dismissed_with_reason' | 'information_required'; rationale: string };
