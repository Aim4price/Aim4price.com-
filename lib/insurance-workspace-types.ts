export type InsuranceClientProfile =
  | 'unclassified'
  | 'domestic'
  | 'commercial'
  | 'agricultural'
  | 'transport'
  | 'construction'
  | 'industrial'
  | 'other';

export type InsuranceReviewStatus = 'not_started' | 'in_progress' | 'completed';
export type CurrentInsuranceStatus = 'insured' | 'not_insured' | 'unknown' | 'not_applicable' | 'covered_elsewhere';
export type InsuranceOptionStatus = 'included' | 'excluded' | 'unknown' | 'not_applicable';
export type InsuranceRecommendationStatus = 'review' | 'include' | 'exclude' | 'information_required' | 'not_applicable';
export type InsuranceReportType = 'summary' | 'detailed';

export type InsuranceOptionReview = {
  key: string;
  label: string;
  status: InsuranceOptionStatus;
  exclusionReasonKey: string;
  note: string;
  amountValue: number | null;
  textValue: string;
};

export type InsuranceAssetReview = {
  categoryKey: string;
  currentInsuranceStatus: CurrentInsuranceStatus;
  insurerName: string;
  policyNumber: string;
  policySectionKey: string;
  policySectionLabel: string;
  scheduleDescription: string;
  renewalDate: string;
  coverBasis: string;
  sumInsured: number | null;
  vatBasis: '' | 'inclusive' | 'exclusive' | 'unknown';
  excessText: string;
  schedulingTreatment: '' | 'individual' | 'grouped' | 'blanket' | 'not_applicable';
  specialConditions: string;
  recommendationStatus: InsuranceRecommendationStatus;
  recommendationReasonKey: string;
  recommendationNote: string;
  informationRequiredNote: string;
  reviewStatus: InsuranceReviewStatus;
  reviewedAtIso: string | null;
  options: InsuranceOptionReview[];
};

export type InsuranceWorkspaceAsset = {
  id: string;
  sourceAssetKey: string;
  title: string;
  kind: string;
  categoryKey: string;
  location: string;
  registerValue: number;
  replacementValue: number;
  photoUrl: string;
  serialNumber: string;
  registrationNumber: string;
  yearModel: number | null;
  condition: string;
  snapshot: Record<string, unknown>;
  review: InsuranceAssetReview;
};

export type InsuranceGeneralCoverReview = {
  key: string;
  label: string;
  status: InsuranceOptionStatus;
  insurerName: string;
  policyNumber: string;
  policySectionLabel: string;
  limitAmount: number | null;
  exclusionReasonKey: string;
  recommendationStatus: InsuranceRecommendationStatus;
  recommendationNote: string;
  notes: string;
  reviewedAtIso: string | null;
};

export type InsuranceReportSnapshotSummary = {
  id: string;
  type: InsuranceReportType;
  revision: number;
  reference: string;
  filename: string;
  generatedAtIso: string;
};

export type InsuranceWorkspaceData = {
  id: string;
  shareId: string;
  clientName: string;
  clientMeta: string;
  clientLogoUrl: string;
  ownerMessage: string;
  clientProfile: InsuranceClientProfile;
  reviewStatus: InsuranceReviewStatus;
  snapshotGeneratedAtIso: string | null;
  snapshotReference: string;
  assetCount: number;
  totalRegisterValue: number;
  totalReplacementValue: number;
  lastReviewedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  assets: InsuranceWorkspaceAsset[];
  generalCovers: InsuranceGeneralCoverReview[];
  reports: InsuranceReportSnapshotSummary[];
};

export type InsurancePortfolioItem = Omit<InsuranceWorkspaceData, 'assets' | 'generalCovers' | 'reports'> & {
  completedAssetCount: number;
  includedAssetCount: number;
  outstandingAssetCount: number;
};
