import type { InsuranceFinancialTerm, InsuranceWorkspaceData } from './insurance-workspace-types';

export type InsuranceWorkflowStepId = 'setup' | 'assets' | 'covers' | 'policies';

export type InsuranceReadinessIssue = {
  id: string;
  step: InsuranceWorkflowStepId;
  title: string;
  detail: string;
  entityId?: string;
};

export type InsuranceWorkspaceReadiness = {
  ready: boolean;
  completion: Record<InsuranceWorkflowStepId, boolean>;
  issues: InsuranceReadinessIssue[];
  readyStepCount: number;
  requiredStepCount: 4;
};

function hasRecordedTermValue(term: InsuranceFinancialTerm): boolean {
  return Boolean(term.amount || term.percentage || term.timeValue);
}

function isMoneyTerm(term: InsuranceFinancialTerm): boolean {
  return Boolean(term.amount);
}

export function getInsuranceWorkspaceReadiness(workspace: InsuranceWorkspaceData): InsuranceWorkspaceReadiness {
  const issues: InsuranceReadinessIssue[] = [];
  const realLocations = workspace.locations.filter((location) => !location.isUnknown);

  if (!workspace.segments.length) {
    issues.push({ id: 'setup-client-segment', step: 'setup', title: 'Choose the client segment', detail: 'Record whether the review is domestic, commercial or both.' });
  }
  if (!realLocations.length) {
    issues.push({ id: 'setup-location', step: 'setup', title: 'Save a real risk location', detail: 'At least one named address or verified GPS location is required.' });
  }
  if (!workspace.parties.length) {
    issues.push({ id: 'setup-party', step: 'setup', title: 'Record the insured party', detail: 'Add the person, organisation, trust or estate whose interest is being reviewed.' });
  }

  for (const asset of workspace.assets) {
    const riskObject = workspace.riskObjects.find((entry) => entry.workspaceAssetId === asset.id);
    if (!riskObject || riskObject.classificationStatus === 'unconfirmed') {
      issues.push({ id: `asset-classification-${asset.id}`, step: 'assets', title: `Confirm ${asset.title}`, detail: 'Confirm its insurance type, use and saved location.', entityId: asset.id });
    }
  }

  const openCoverSuggestions = workspace.suggestions.filter((suggestion) => suggestion.suggestedCoverKey && !suggestion.decision);
  if (openCoverSuggestions.length) {
    issues.push({ id: 'covers-open-suggestions', step: 'covers', title: 'Decide the remaining cover suggestions', detail: `${openCoverSuggestions.length} asset-level suggestion${openCoverSuggestions.length === 1 ? '' : 's'} still need a grouped decision.` });
  }

  const assessments = workspace.assessments.filter((assessment) => assessment.canonicalCoverKey);
  if (!assessments.length) {
    issues.push({ id: 'covers-no-assessments', step: 'covers', title: 'Record the cover review', detail: 'Review the grouped suggestions or add the relevant cover areas from the handbook catalogue.' });
  }
  for (const assessment of assessments) {
    if (assessment.currentCoverPosition === 'unknown' || assessment.placementStage === 'not_assessed') {
      issues.push({ id: `cover-decision-${assessment.id}`, step: 'covers', title: `Decide ${assessment.coverLabel}`, detail: 'Record both the current-policy position and what should happen next.', entityId: assessment.id });
    }
    if (assessment.placementStage === 'information_required') {
      const hasLinkedQuestion = workspace.informationRequests.some((request) =>
        request.relatedEntityType === 'assessment' && request.relatedEntityId === assessment.id && !['resolved', 'not_applicable'].includes(request.status),
      );
      if (!hasLinkedQuestion) {
        issues.push({ id: `cover-question-${assessment.id}`, step: 'covers', title: `Create a client question for ${assessment.coverLabel}`, detail: 'The decision says information is required, but no open client question is linked to it.', entityId: assessment.id });
      }
    }
  }

  const currentPolicies = workspace.policies.filter((policy) => policy.status === 'current');
  const confirmedAssessments = assessments.filter((assessment) => assessment.currentCoverPosition === 'confirmed_included');

  for (const policy of currentPolicies) {
    if (!policy.provenance.sourceReference) {
      issues.push({ id: `policy-source-${policy.id}`, step: 'policies', title: `Add the source for policy ${policy.policyNumber || policy.insurerName || 'record'}`, detail: 'Reference the actual schedule, email or insurer evidence used.', entityId: policy.id });
    }
    if (!policy.renewalDate && !policy.effectiveTo) {
      issues.push({ id: `policy-renewal-${policy.id}`, step: 'policies', title: `Add the renewal date for ${policy.policyNumber || policy.insurerName || 'the policy'}`, detail: 'A renewal or expiry date is required for reliable follow-up.', entityId: policy.id });
    }
  }

  for (const assessment of confirmedAssessments) {
    const matchingSections = currentPolicies.flatMap((policy) => policy.sections).filter((section) =>
      section.status === 'current' && section.canonicalCoverKey === assessment.canonicalCoverKey,
    );
    if (!matchingSections.length) {
      issues.push({ id: `policy-section-${assessment.id}`, step: 'policies', title: `Match policy evidence to ${assessment.coverLabel}`, detail: 'Confirmed current cover needs a matching current policy section.', entityId: assessment.id });
      continue;
    }

    const matchingItems = matchingSections.flatMap((section) => section.scheduleItems);
    if (!matchingItems.length) {
      issues.push({ id: `policy-schedule-${assessment.id}`, step: 'policies', title: `Add the schedule line for ${assessment.coverLabel}`, detail: 'Copy the relevant schedule item and link the applicable assets, exposures, locations or parties.', entityId: assessment.id });
      continue;
    }

    const missingLinkedAssets = assessment.assetIds.filter((assetId) => !matchingItems.some((item) => item.assetIds.includes(assetId)));
    if (missingLinkedAssets.length) {
      issues.push({ id: `policy-assets-${assessment.id}`, step: 'policies', title: `Link all assets for ${assessment.coverLabel}`, detail: `${missingLinkedAssets.length} reviewed asset${missingLinkedAssets.length === 1 ? ' is' : 's are'} not linked to the matching schedule line.`, entityId: assessment.id });
    }

    const terms = [...assessment.financialTerms, ...matchingItems.flatMap((item) => item.financialTerms)];
    if (!terms.some(hasRecordedTermValue)) {
      issues.push({ id: `policy-value-${assessment.id}`, step: 'policies', title: `Record the value, limit or excess for ${assessment.coverLabel}`, detail: 'Capture the policy amount exactly as shown and state its VAT basis.', entityId: assessment.id });
    }
  }

  const financialTerms = [
    ...assessments.flatMap((assessment) => [
      ...assessment.financialTerms,
      ...assessment.components.flatMap((component) => component.financialTerms),
    ]),
    ...workspace.policies.flatMap((policy) => policy.sections.flatMap((section) => section.scheduleItems.flatMap((item) => item.financialTerms))),
  ];
  for (const term of financialTerms) {
    if (isMoneyTerm(term) && !['inclusive', 'exclusive'].includes(term.vatBasis)) {
      issues.push({ id: `policy-vat-${term.id}`, step: 'policies', title: `Confirm VAT for ${term.termType.replace(/_/g, ' ')}`, detail: 'Money amounts must be marked VAT-inclusive or VAT-exclusive before reporting.', entityId: term.id });
    }
  }

  const completion: Record<InsuranceWorkflowStepId, boolean> = {
    setup: !issues.some((issue) => issue.step === 'setup'),
    assets: workspace.assets.length > 0 && !issues.some((issue) => issue.step === 'assets'),
    covers: !issues.some((issue) => issue.step === 'covers'),
    policies: !issues.some((issue) => issue.step === 'policies'),
  };
  const readyStepCount = Object.values(completion).filter(Boolean).length;

  return {
    ready: readyStepCount === 4,
    completion,
    issues,
    readyStepCount,
    requiredStepCount: 4,
  };
}
