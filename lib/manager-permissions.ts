import { EMPTY_TEAM_PERMISSIONS, TEAM_TEMPLATES, normalizeTeamPermissions, type TeamPermissions } from './team-access-policy';

/** Desktop and Manager deliberately share the same permission vocabulary and dependencies. */
export function managerPermissions(role: unknown, stored?: unknown): TeamPermissions {
  if (stored !== null && stored !== undefined) return normalizeTeamPermissions(stored);
  if (role === 'admin' || role === 'manager') return { ...TEAM_TEMPLATES.manager.permissions };
  if (role === 'operations') return normalizeTeamPermissions({ ...TEAM_TEMPLATES.workshop.permissions, addFuel: true, recordFuelIssues: true, refillFuel: true, viewFuel: true, viewFuelStorage: true, scheduleMaintenance: true, updateLocation: true, uploadPhotos: true });
  if (role === 'workshop') return { ...TEAM_TEMPLATES.workshop.permissions };
  if (role === 'operator') return { ...TEAM_TEMPLATES.operator.permissions };
  if (role === 'office') return { ...TEAM_TEMPLATES.office.permissions };
  return { ...EMPTY_TEAM_PERMISSIONS };
}

/** Never copy arbitrary owner JSON into a delegated response. */
export function projectManagerAsset<T extends Record<string, any>>(asset: T, permissions: TeamPermissions): T {
  const fields = ['id','registerId','registerName','title','kind','brandName','modelName','typedModelName','yearModel',
    'serialNumber','licenseRegistrationNumber','registrationNumber','condition','hours','lifeWorkedPercent',
    'usage','usageMetric','usageLabel','createdAtIso','updatedAtIso','publicAssetCode','plateLabel','qrStatus'];
  const result: Record<string, unknown> = Object.fromEntries(fields.filter(k => k in asset).map(k => [k, asset[k]]));
  // Neutral placeholders support the existing UI without disclosing values in the response/DOM/cache.
  Object.assign(result, { value: null, replacementPriceExVat: null, insuredValueExVat: null, financeNote: '', note: '',
    photos: [], documents: [], thumbnailUrl: null, specsJson: {}, valuesRestricted: !permissions.viewValues });
  if (permissions.viewValues) for (const key of ['value','replacementPriceExVat','insuredValueExVat']) result[key] = asset[key] ?? null;
  if (permissions.viewPhotos) { result.photos = asset.photos ?? []; result.thumbnailUrl = asset.thumbnailUrl ?? null; }
  if (permissions.viewMap) for (const key of ['locationText','latitude','longitude','locationUpdatedAtIso']) result[key] = asset[key] ?? null;
  // Usage metadata is safe and necessary for hours/km/percentage selectors. Valuation/finance JSON is never copied.
  const specs = asset.specsJson || {};
  result.specsJson = Object.fromEntries(['usageMetric','usage_metric','usageMode','usage_mode','usageBasis','usage_basis','usageApplicable','usage_applicable'].filter(k => k in specs).map(k => [k,specs[k]]));
  return result as T;
}

export function projectManagerMaintenance<T extends Record<string, any>>(record: T): T {
  const fields = ['id','assetId','assetTitle','assetKind','assetCategoryLabel','assetYearModel','assetUsageReading','assetUsageMetric','assetCondition','assetMeta','maintenanceType','triggerType','status','computedStatus','computedStatusLabel','title','notes','assignedFieldManagerId','assignedName','dueDate','dueUsage','usageMetric','currentUsage','remainingUsage','daysUntilDue','alertBeforeValue','alertBeforeUnit','recurringEnabled','recurringIntervalValue','recurringIntervalUnit','completedAtIso','completedUsage','completedNotes','completedBy','createdAtIso','updatedAtIso'];
  return { ...Object.fromEntries(fields.filter(k => k in record).map(k => [k,record[k]])), assetValue: 0, sourcePhotoUrls: [], sourceLatitude: null, sourceLongitude: null, sourceLocationText: '' } as unknown as T;
}
