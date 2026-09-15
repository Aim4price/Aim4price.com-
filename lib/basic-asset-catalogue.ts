import { BASIC_USAGE_FAMILIES } from './basic-usage-profiles';

// Read-only identity resolution for saved assets, independent of estimate rollout
// settings and database schema. Public labels always come from reviewed data.
const RELEASE = 'basic_ballpark_20260907_v1';
const families = new Map(BASIC_USAGE_FAMILIES.map(([sector, key, label, metric]) =>
  [`${sector}:${key}`, { key, label, metric }] as const));

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function basicAssetFamily(value: unknown) {
  const specs = object(value);
  if (specs.basic_catalogue_release !== RELEASE) return null;
  const catalogue = object(specs.basic_catalogue);
  const profile = object(specs.basic_usage_profile);
  const savedProfile = object(catalogue.usageProfile);
  const sector = profile.sectorKey ?? savedProfile.sectorKey;
  return families.get(`${sector}:${catalogue.familyKey}`) ?? null;
}

export function basicAssetUsage(value: unknown): 'hours' | 'km' | 'percent' | null {
  const specs = object(value);
  const family = basicAssetFamily(specs);
  return family ? specs.basic_usage_basis === 'percent' ? 'percent' : family.metric : null;
}

// Arguments are internal SQL expressions, never request values. Stored labels
// are intentionally ignored, even for an otherwise valid Basic catalogue key.
export function basicAssetFamilySql(specs: string, field: 'label' | 'metric'): string {
  const lookup = JSON.stringify(Object.fromEntries([...families].map(([key, family]) => [key, family[field]])))
    .replaceAll("'", "''");
  return `(case when ${specs}->>'basic_catalogue_release' = '${RELEASE}' then
    '${lookup}'::jsonb ->> (coalesce(${specs}#>>'{basic_usage_profile,sectorKey}',
      ${specs}#>>'{basic_catalogue,usageProfile,sectorKey}') || ':' || (${specs}#>>'{basic_catalogue,familyKey}'))
    end)`;
}

export function basicAssetUsageSql(specs: string): string {
  const metric = basicAssetFamilySql(specs, 'metric');
  return `(case when ${metric} is not null then
    case when ${specs}->>'basic_usage_basis' = 'percent' then 'percent' else ${metric} end end)`;
}
