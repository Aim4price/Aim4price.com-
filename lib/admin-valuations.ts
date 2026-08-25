import { ensureAccountProfileColumns } from './account-profile';
import { ensureAdminUsageTrackingSchema } from './admin-usage-events';
import {
  ADMIN_VALUATION_PAGE_SIZES,
  type AdminValuationAccountFilter,
  type AdminValuationFilterOption,
  type AdminValuationFilters,
  type AdminValuationMode,
  type AdminValuationModeFilter,
  type AdminValuationOptions,
  type AdminValuationRecord,
  type AdminValuationRecordFilter,
  type AdminValuationReport,
  type AdminValuationSort,
  type AdminValuationSummary,
} from './admin-valuations-shared';
import { getDb } from './db';

type DatabaseValue = string | number | boolean | Date | Record<string, unknown> | null | undefined;

type AdminValuationRow = {
  valuation_id: DatabaseValue;
  source_id: DatabaseValue;
  record_type: DatabaseValue;
  valuation_mode: DatabaseValue;
  event_source: DatabaseValue;
  created_at: DatabaseValue;
  account_user_id: DatabaseValue;
  has_account: DatabaseValue;
  account_label: DatabaseValue;
  account_name: DatabaseValue;
  account_business_name: DatabaseValue;
  account_email: DatabaseValue;
  account_type: DatabaseValue;
  account_status: DatabaseValue;
  sector_key: DatabaseValue;
  sector_label: DatabaseValue;
  family_key: DatabaseValue;
  family_label: DatabaseValue;
  brand_name: DatabaseValue;
  model_name: DatabaseValue;
  year_model: DatabaseValue;
  condition: DatabaseValue;
  usage_amount: DatabaseValue;
  usage_unit: DatabaseValue;
  selected_value_ex_vat: DatabaseValue;
  low_value_ex_vat: DatabaseValue;
  mid_value_ex_vat: DatabaseValue;
  high_value_ex_vat: DatabaseValue;
  replacement_price_ex_vat: DatabaseValue;
  confidence_label: DatabaseValue;
  input_json: DatabaseValue;
  output_json: DatabaseValue;
};

type SummaryRow = {
  total_valuations: DatabaseValue;
  estimate_events: DatabaseValue;
  saved_valuations: DatabaseValue;
  known_account_valuations: DatabaseValue;
  unknown_account_valuations: DatabaseValue;
  unique_accounts: DatabaseValue;
  valued_valuations: DatabaseValue;
};

type OptionRow = {
  option_group: DatabaseValue;
  value: DatabaseValue;
  label: DatabaseValue;
  count: DatabaseValue;
};

const EMPTY_OPTIONS: AdminValuationOptions = { sectors: [], years: [] };

function safeNumericSql(source: string): string {
  const normalized = `nullif(regexp_replace(coalesce(${source}, ''), '[^0-9.-]', '', 'g'), '')`;
  return `(case
    when ${normalized} ~ '^-?[0-9]+([.][0-9]+)?$'
      then (${normalized})::numeric
    else null
  end)`;
}

const FREE_SELECTED_VALUE_SQL = `coalesce(
  ${safeNumericSql("event_document.metadata #>> '{output,selectedValueExVat}'")},
  ${safeNumericSql("event_document.metadata #>> '{output,aim4priceValueExVat}'")},
  ${safeNumericSql("event_document.metadata #>> '{output,valuationMidExVat}'")},
  ${safeNumericSql("event_document.metadata #>> '{output,genericEstimateExVat}'")},
  ${safeNumericSql("event_document.metadata #>> '{output,previewValueExVat}'")}
)`;

const SAVED_SELECTED_VALUE_SQL = `coalesce(
  ${safeNumericSql("valuation_document.row_json->>'selected_value_ex_vat'")},
  ${safeNumericSql("valuation_document.row_json->>'valuation_mid_ex_vat'")},
  ${safeNumericSql("valuation_document.row_json->>'aim4price_value_ex_vat'")},
  ${safeNumericSql("payload_document.payload #>> '{output,selectedValueExVat}'")},
  ${safeNumericSql("payload_document.payload #>> '{output,aim4priceValueExVat}'")},
  ${safeNumericSql("payload_document.payload #>> '{output,valuationMidExVat}'")}
)`;

const ADMIN_VALUATION_CTE = `
  with free_estimate_rows as (
    select
      'estimate:' || event.id::text as valuation_id,
      event.id::text as source_id,
      'estimate'::text as record_type,
      case
        when lower(coalesce(event_document.metadata->>'valuationMode', '')) in ('tractor', 'generic')
          then lower(event_document.metadata->>'valuationMode')
        when lower(coalesce(event.event_source, '')) = 'tractor-valuations' then 'tractor'
        when lower(coalesce(event.event_source, '')) = 'generic-valuations' then 'generic'
        else 'unknown'
      end as valuation_mode,
      coalesce(nullif(trim(event.event_source), ''), 'estimate') as event_source,
      event.created_at,
      nullif(trim(event.user_id), '') as account_user_id,
      coalesce(
        nullif(trim(event_document.metadata #>> '{output,sectorKey}'), ''),
        nullif(trim(event_document.metadata #>> '{output,sector,key}'), ''),
        nullif(trim(event_document.metadata #>> '{input,sectorKey}'), ''),
        nullif(trim(event_document.metadata->>'sectorKey'), ''),
        case when lower(coalesce(event.event_source, '')) = 'tractor-valuations'
          then 'agricultural' else null end,
        'uncategorised'
      ) as sector_key,
      coalesce(
        nullif(trim(event_document.metadata #>> '{output,sectorLabel}'), ''),
        nullif(trim(event_document.metadata #>> '{output,sector,label}'), ''),
        case coalesce(
          nullif(trim(event_document.metadata #>> '{input,sectorKey}'), ''),
          nullif(trim(event_document.metadata->>'sectorKey'), '')
        )
          when 'agricultural' then 'Agricultural'
          when 'industrial' then 'Industrial'
          when 'construction' then 'Construction'
          when 'motor' then 'Motor'
          else null
        end,
        case when lower(coalesce(event.event_source, '')) = 'tractor-valuations'
          then 'Agricultural' else null end,
        'Uncategorised'
      ) as sector_label,
      coalesce(
        nullif(trim(event_document.metadata #>> '{output,familyKey}'), ''),
        nullif(trim(event_document.metadata #>> '{output,family,key}'), ''),
        nullif(trim(event_document.metadata #>> '{input,familyKey}'), ''),
        nullif(trim(event_document.metadata->>'familyKey'), ''),
        case when lower(coalesce(event.event_source, '')) = 'tractor-valuations'
          then 'tractors' else null end,
        'uncategorised'
      ) as family_key,
      coalesce(
        nullif(trim(event_document.metadata #>> '{output,familyLabel}'), ''),
        nullif(trim(event_document.metadata #>> '{output,family,label}'), ''),
        case when lower(coalesce(event.event_source, '')) = 'tractor-valuations'
          then 'Tractors' else null end,
        initcap(replace(coalesce(
          nullif(trim(event_document.metadata #>> '{input,familyKey}'), ''),
          nullif(trim(event_document.metadata->>'familyKey'), ''),
          'uncategorised'
        ), '_', ' '))
      ) as family_label,
      coalesce(
        nullif(trim(event_document.metadata #>> '{output,brandName}'), ''),
        nullif(trim(event_document.metadata #>> '{output,brand,name}'), ''),
        nullif(trim(event_document.metadata #>> '{input,brandName}'), ''),
        nullif(trim(event_document.metadata #>> '{input,brandSlug}'), ''),
        nullif(trim(event_document.metadata->>'brandSlug'), ''),
        ''
      ) as brand_name,
      coalesce(
        nullif(trim(event_document.metadata #>> '{output,modelName}'), ''),
        nullif(trim(event_document.metadata #>> '{output,typedModelName}'), ''),
        nullif(trim(event_document.metadata #>> '{input,typedModelName}'), ''),
        nullif(trim(event_document.metadata->>'modelId'), ''),
        'Model not recorded'
      ) as model_name,
      case
        when lower(coalesce(
          event_document.metadata #>> '{input,yearModelUnknown}',
          event_document.metadata #>> '{input,year_model_unknown}',
          'false'
        )) in ('true', '1', 'yes') then null
        else coalesce(
          ${safeNumericSql("event_document.metadata #>> '{input,displayYearModel}'")},
          ${safeNumericSql("event_document.metadata #>> '{input,yearModel}'")},
          ${safeNumericSql("event_document.metadata #>> '{input,year}'")}
        )
      end as year_model,
      coalesce(nullif(trim(event_document.metadata #>> '{input,condition}'), ''), '') as condition,
      coalesce(
        ${safeNumericSql("event_document.metadata #>> '{input,usageAmount}'")},
        ${safeNumericSql("event_document.metadata #>> '{input,hours}'")},
        ${safeNumericSql("event_document.metadata #>> '{input,lifeWorkedPercent}'")}
      ) as usage_amount,
      coalesce(
        nullif(trim(event_document.metadata #>> '{input,usageMode}'), ''),
        nullif(trim(event_document.metadata #>> '{output,usageMetricType}'), ''),
        case
          when event_document.metadata #>> '{input,lifeWorkedPercent}' is not null then 'percent'
          when lower(coalesce(event.event_source, '')) = 'tractor-valuations' then 'hours'
          else ''
        end
      ) as usage_unit,
      ${FREE_SELECTED_VALUE_SQL} as selected_value_ex_vat,
      coalesce(
        ${safeNumericSql("event_document.metadata #>> '{output,valuationLowExVat}'")},
        ${safeNumericSql("event_document.metadata #>> '{output,marketLowExVat}'")}
      ) as low_value_ex_vat,
      coalesce(
        ${safeNumericSql("event_document.metadata #>> '{output,valuationMidExVat}'")},
        ${safeNumericSql("event_document.metadata #>> '{output,marketMidExVat}'")},
        ${safeNumericSql("event_document.metadata #>> '{output,aim4priceValueExVat}'")}
      ) as mid_value_ex_vat,
      coalesce(
        ${safeNumericSql("event_document.metadata #>> '{output,valuationHighExVat}'")},
        ${safeNumericSql("event_document.metadata #>> '{output,marketHighExVat}'")}
      ) as high_value_ex_vat,
      coalesce(
        ${safeNumericSql("event_document.metadata #>> '{output,totalReplacementPriceUsedExVat}'")},
        ${safeNumericSql("event_document.metadata #>> '{output,replacementPriceUsedExVat}'")}
      ) as replacement_price_ex_vat,
      coalesce(
        nullif(trim(event_document.metadata #>> '{output,confidenceLabel}'), ''),
        nullif(trim(event_document.metadata #>> '{output,coverageBand}'), ''),
        ''
      ) as confidence_label,
      case
        when jsonb_typeof(event_document.metadata->'input') = 'object'
          then event_document.metadata->'input'
        else event_document.metadata - 'output'
      end as input_json,
      case
        when jsonb_typeof(event_document.metadata->'output') = 'object'
          then event_document.metadata->'output'
        else '{}'::jsonb
      end as output_json
    from public.admin_usage_events event
    cross join lateral (
      select coalesce(event.metadata, '{}'::jsonb) as metadata
    ) event_document
    where event.event_type = 'free_estimate_completed'
  ),
  saved_valuation_rows as (
    select
      'saved:' || valuation.id::text as valuation_id,
      valuation.id::text as source_id,
      'saved'::text as record_type,
      case
        when coalesce(
          nullif(trim(valuation_document.row_json->>'catalog_mode_used'), ''),
          nullif(trim(payload_document.payload #>> '{input,sectorKey}'), '')
        ) is not null then 'generic'
        when lower(coalesce(valuation_document.row_json->>'equipment_type', '')) = 'tractor'
          then 'tractor'
        else 'unknown'
      end as valuation_mode,
      'valuation-runs'::text as event_source,
      valuation.created_at,
      nullif(trim(valuation_document.row_json->>'user_id'), '') as account_user_id,
      coalesce(
        nullif(trim(sector.sector_key), ''),
        nullif(trim(payload_document.payload #>> '{output,sector,key}'), ''),
        nullif(trim(payload_document.payload #>> '{input,sectorKey}'), ''),
        case when lower(coalesce(valuation_document.row_json->>'equipment_type', '')) = 'tractor'
          then 'agricultural' else null end,
        'uncategorised'
      ) as sector_key,
      coalesce(
        nullif(trim(sector.sector_label), ''),
        nullif(trim(payload_document.payload #>> '{output,sector,label}'), ''),
        case when lower(coalesce(valuation_document.row_json->>'equipment_type', '')) = 'tractor'
          then 'Agricultural' else null end,
        'Uncategorised'
      ) as sector_label,
      coalesce(
        nullif(trim(family.family_key), ''),
        nullif(trim(payload_document.payload #>> '{output,family,key}'), ''),
        nullif(trim(payload_document.payload #>> '{input,familyKey}'), ''),
        case when lower(coalesce(valuation_document.row_json->>'equipment_type', '')) = 'tractor'
          then 'tractors' else null end,
        'uncategorised'
      ) as family_key,
      coalesce(
        nullif(trim(family.family_label), ''),
        nullif(trim(payload_document.payload #>> '{output,family,label}'), ''),
        case when lower(coalesce(valuation_document.row_json->>'equipment_type', '')) = 'tractor'
          then 'Tractors' else null end,
        'Uncategorised'
      ) as family_label,
      coalesce(
        nullif(trim(valuation_document.row_json->>'brand_name'), ''),
        nullif(trim(brand.name), ''),
        nullif(trim(payload_document.payload #>> '{output,brand,name}'), ''),
        nullif(trim(payload_document.payload #>> '{input,brandSlug}'), ''),
        ''
      ) as brand_name,
      coalesce(
        nullif(trim(valuation_document.row_json->>'typed_model_name'), ''),
        nullif(trim(valuation_document.row_json->>'model_name'), ''),
        nullif(trim(payload_document.payload #>> '{output,typedModelName}'), ''),
        nullif(trim(payload_document.payload #>> '{input,typedModelName}'), ''),
        'Model not recorded'
      ) as model_name,
      ${safeNumericSql("valuation_document.row_json->>'year_model'")} as year_model,
      coalesce(nullif(trim(valuation_document.row_json->>'condition'), ''), '') as condition,
      coalesce(
        ${safeNumericSql("valuation_document.row_json->>'hours'")},
        ${safeNumericSql("valuation_document.row_json->>'estimated_hours'")},
        ${safeNumericSql("valuation_document.row_json->>'life_worked_percent'")},
        ${safeNumericSql("payload_document.payload #>> '{input,usageAmount}'")},
        ${safeNumericSql("payload_document.payload #>> '{input,lifeWorkedPercent}'")}
      ) as usage_amount,
      coalesce(
        nullif(trim(payload_document.payload #>> '{input,usageMode}'), ''),
        nullif(trim(payload_document.payload #>> '{selectedUsageMode}'), ''),
        case
          when valuation_document.row_json->>'life_worked_percent' is not null then 'percent'
          when lower(coalesce(sector.sector_key, '')) = 'motor' then 'km'
          else 'hours'
        end
      ) as usage_unit,
      ${SAVED_SELECTED_VALUE_SQL} as selected_value_ex_vat,
      coalesce(
        ${safeNumericSql("valuation_document.row_json->>'valuation_low_ex_vat'")},
        ${safeNumericSql("valuation_document.row_json->>'market_low_ex_vat'")}
      ) as low_value_ex_vat,
      coalesce(
        ${safeNumericSql("valuation_document.row_json->>'valuation_mid_ex_vat'")},
        ${safeNumericSql("valuation_document.row_json->>'market_mid_ex_vat'")},
        ${safeNumericSql("valuation_document.row_json->>'aim4price_value_ex_vat'")}
      ) as mid_value_ex_vat,
      coalesce(
        ${safeNumericSql("valuation_document.row_json->>'valuation_high_ex_vat'")},
        ${safeNumericSql("valuation_document.row_json->>'market_high_ex_vat'")}
      ) as high_value_ex_vat,
      coalesce(
        ${safeNumericSql("valuation_document.row_json->>'replacement_price_used_ex_vat'")},
        ${safeNumericSql("valuation_document.row_json->>'catalog_replacement_price_ex_vat'")}
      ) as replacement_price_ex_vat,
      coalesce(
        nullif(trim(valuation_document.row_json->>'confidence_label'), ''),
        nullif(trim(payload_document.payload #>> '{output,coverageBand}'), ''),
        ''
      ) as confidence_label,
      jsonb_strip_nulls(jsonb_build_object(
        'sectorKey', sector.sector_key,
        'familyKey', family.family_key,
        'brandName', coalesce(valuation_document.row_json->>'brand_name', brand.name),
        'modelName', coalesce(
          valuation_document.row_json->>'typed_model_name',
          valuation_document.row_json->>'model_name'
        ),
        'year', valuation_document.row_json->>'year_model',
        'usageAmount', coalesce(
          valuation_document.row_json->>'hours',
          valuation_document.row_json->>'estimated_hours',
          valuation_document.row_json->>'life_worked_percent'
        ),
        'condition', valuation_document.row_json->>'condition'
      )) || case
        when jsonb_typeof(payload_document.payload->'input') = 'object'
          then payload_document.payload->'input'
        else '{}'::jsonb
      end as input_json,
      jsonb_strip_nulls(jsonb_build_object(
        'selectedValueExVat', ${SAVED_SELECTED_VALUE_SQL},
        'valuationLowExVat', valuation_document.row_json->>'valuation_low_ex_vat',
        'valuationMidExVat', valuation_document.row_json->>'valuation_mid_ex_vat',
        'valuationHighExVat', valuation_document.row_json->>'valuation_high_ex_vat',
        'replacementPriceUsedExVat', valuation_document.row_json->>'replacement_price_used_ex_vat',
        'confidenceLabel', valuation_document.row_json->>'confidence_label'
      )) || case
        when jsonb_typeof(payload_document.payload->'output') = 'object'
          then payload_document.payload->'output'
        else '{}'::jsonb
      end as output_json
    from public.valuation_runs valuation
    cross join lateral (
      select to_jsonb(valuation) as row_json
    ) valuation_document
    cross join lateral (
      select case
        when jsonb_typeof(valuation_document.row_json->'valuation_payload') = 'object'
          then valuation_document.row_json->'valuation_payload'
        else '{}'::jsonb
      end as payload
    ) payload_document
    left join public.sectors sector
      on sector.id::text = nullif(valuation_document.row_json->>'sector_id', '')
    left join public.equipment_families family
      on family.id::text = nullif(valuation_document.row_json->>'equipment_family_id', '')
    left join public.brands brand
      on brand.id::text = nullif(valuation_document.row_json->>'brand_id', '')
  ),
  valuation_history as (
    select * from free_estimate_rows
    union all
    select * from saved_valuation_rows
  ),
  admin_valuations as (
    select
      history.*,
      extract(year from history.created_at)::integer as valuation_year,
      (history.account_user_id is not null) as has_account,
      coalesce(
        nullif(trim(profile.business_name), ''),
        nullif(trim(profile.display_name), ''),
        nullif(trim(auth_user.name), ''),
        nullif(trim(auth_user.email), ''),
        case when history.account_user_id is not null
          then 'Account ' || left(history.account_user_id, 12) else null end,
        'Unknown / guest'
      ) as account_label,
      coalesce(nullif(trim(profile.display_name), ''), nullif(trim(auth_user.name), ''), '')
        as account_name,
      coalesce(nullif(trim(profile.business_name), ''), '') as account_business_name,
      coalesce(nullif(trim(auth_user.email), ''), '') as account_email,
      coalesce(nullif(trim(profile.account_type), ''), '') as account_type,
      coalesce(nullif(trim(profile.account_status), ''), '') as account_status
    from valuation_history history
    left join public.account_profiles profile on profile.user_id = history.account_user_id
    left join public."user" auth_user on auth_user.id = history.account_user_id
  )
`;

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return ['true', 't', '1', 'yes'].includes(text(value).toLowerCase());
}

function iso(value: unknown): string {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function recordType(value: unknown): 'estimate' | 'saved' {
  return text(value).toLowerCase() === 'saved' ? 'saved' : 'estimate';
}

function valuationMode(value: unknown): AdminValuationMode {
  const normalized = text(value).toLowerCase();
  return normalized === 'tractor' || normalized === 'generic' ? normalized : 'unknown';
}

function mapValuation(row: AdminValuationRow): AdminValuationRecord {
  const accountUserId = text(row.account_user_id) || null;
  return {
    id: text(row.valuation_id),
    sourceId: text(row.source_id),
    recordType: recordType(row.record_type),
    valuationMode: valuationMode(row.valuation_mode),
    source: text(row.event_source),
    createdAtIso: iso(row.created_at),
    account: {
      userId: accountUserId,
      known: boolean(row.has_account),
      label: text(row.account_label) || 'Unknown / guest',
      name: text(row.account_name),
      businessName: text(row.account_business_name),
      email: text(row.account_email),
      accountType: text(row.account_type),
      accountStatus: text(row.account_status),
    },
    asset: {
      sectorKey: text(row.sector_key) || 'uncategorised',
      sectorLabel: text(row.sector_label) || 'Uncategorised',
      familyKey: text(row.family_key) || 'uncategorised',
      familyLabel: text(row.family_label) || 'Uncategorised',
      brandName: text(row.brand_name),
      modelName: text(row.model_name) || 'Model not recorded',
      yearModel: nullableNumber(row.year_model),
      condition: text(row.condition),
      usageAmount: nullableNumber(row.usage_amount),
      usageUnit: text(row.usage_unit),
    },
    estimate: {
      selectedValueExVat: nullableNumber(row.selected_value_ex_vat),
      lowValueExVat: nullableNumber(row.low_value_ex_vat),
      midValueExVat: nullableNumber(row.mid_value_ex_vat),
      highValueExVat: nullableNumber(row.high_value_ex_vat),
      replacementPriceExVat: nullableNumber(row.replacement_price_ex_vat),
      confidenceLabel: text(row.confidence_label),
    },
    input: jsonObject(row.input_json),
    output: jsonObject(row.output_json),
  };
}

function mapSummary(row: SummaryRow | undefined): AdminValuationSummary {
  return {
    totalValuations: Math.max(0, number(row?.total_valuations)),
    estimateEvents: Math.max(0, number(row?.estimate_events)),
    savedValuations: Math.max(0, number(row?.saved_valuations)),
    knownAccountValuations: Math.max(0, number(row?.known_account_valuations)),
    unknownAccountValuations: Math.max(0, number(row?.unknown_account_valuations)),
    uniqueAccounts: Math.max(0, number(row?.unique_accounts)),
    valuedValuations: Math.max(0, number(row?.valued_valuations)),
  };
}

function mapOptions(rows: OptionRow[]): AdminValuationOptions {
  const options: AdminValuationOptions = { sectors: [], years: [] };
  for (const row of rows) {
    const option: AdminValuationFilterOption = {
      value: text(row.value),
      label: text(row.label),
      count: Math.max(0, number(row.count)),
    };
    if (!option.value) continue;
    if (text(row.option_group) === 'sector') options.sectors.push(option);
    if (text(row.option_group) === 'year') options.years.push(option);
  }
  options.sectors.sort((left, right) =>
    left.label.localeCompare(right.label, 'en-ZA', { sensitivity: 'base' }),
  );
  options.years.sort((left, right) => Number(right.value) - Number(left.value));
  return options;
}

function clampPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRecordFilter(value: unknown): AdminValuationRecordFilter {
  const normalized = text(value).toLowerCase();
  return normalized === 'estimate' || normalized === 'saved' ? normalized : 'all';
}

function normalizeModeFilter(value: unknown): AdminValuationModeFilter {
  const normalized = text(value).toLowerCase();
  return normalized === 'tractor' || normalized === 'generic' || normalized === 'unknown'
    ? normalized
    : 'all';
}

function normalizeAccountFilter(value: unknown): AdminValuationAccountFilter {
  const normalized = text(value).toLowerCase();
  return normalized === 'known' || normalized === 'unknown' ? normalized : 'all';
}

function normalizeSort(value: unknown): AdminValuationSort {
  const normalized = text(value).toLowerCase();
  if (
    normalized === 'oldest' ||
    normalized === 'value-high' ||
    normalized === 'value-low' ||
    normalized === 'account' ||
    normalized === 'asset'
  ) {
    return normalized;
  }
  return 'latest';
}

function normalizePeriod(value: unknown): string {
  const normalized = text(value).toLowerCase();
  if (['last-7-days', 'last-30-days', 'last-90-days'].includes(normalized)) {
    return normalized;
  }
  if (/^year:\d{4}$/.test(normalized)) return normalized;
  return 'all';
}

export function normalizeAdminValuationFilters(
  input: Partial<AdminValuationFilters> = {},
): AdminValuationFilters {
  const requestedPageSize = clampPositiveInteger(input.pageSize, 50);
  return {
    search: text(input.search).slice(0, 200),
    recordType: normalizeRecordFilter(input.recordType),
    valuationMode: normalizeModeFilter(input.valuationMode),
    account: normalizeAccountFilter(input.account),
    sector: text(input.sector).toLowerCase().slice(0, 100),
    period: normalizePeriod(input.period),
    sort: normalizeSort(input.sort),
    page: clampPositiveInteger(input.page, 1),
    pageSize: ADMIN_VALUATION_PAGE_SIZES.includes(requestedPageSize as 25 | 50 | 100)
      ? requestedPageSize
      : 50,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildWhere(filters: AdminValuationFilters): { whereSql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${escapeLike(filters.search)}%`);
    const parameter = `$${params.length}`;
    where.push(`concat_ws(' ',
      source_id, record_type, valuation_mode, event_source, account_user_id,
      account_label, account_name, account_business_name, account_email,
      account_type, account_status, sector_key, sector_label, family_key,
      family_label, brand_name, model_name, year_model::text, condition,
      input_json::text, output_json::text
    ) ilike ${parameter} escape '\\'`);
  }
  if (filters.recordType !== 'all') {
    params.push(filters.recordType);
    where.push(`record_type = $${params.length}`);
  }
  if (filters.valuationMode !== 'all') {
    params.push(filters.valuationMode);
    where.push(`valuation_mode = $${params.length}`);
  }
  if (filters.account === 'known') where.push('has_account = true');
  if (filters.account === 'unknown') where.push('has_account = false');
  if (filters.sector) {
    params.push(filters.sector);
    where.push(`lower(sector_key) = $${params.length}`);
  }
  if (filters.period === 'last-7-days') where.push("created_at >= now() - interval '7 days'");
  if (filters.period === 'last-30-days') where.push("created_at >= now() - interval '30 days'");
  if (filters.period === 'last-90-days') where.push("created_at >= now() - interval '90 days'");
  if (filters.period.startsWith('year:')) {
    params.push(Number(filters.period.slice(5)));
    where.push(`valuation_year = $${params.length}`);
  }

  return { whereSql: where.length ? `where ${where.join(' and ')}` : '', params };
}

function sortSql(sort: AdminValuationSort): string {
  if (sort === 'oldest') return 'created_at asc, valuation_id asc';
  if (sort === 'value-high') return 'selected_value_ex_vat desc nulls last, created_at desc';
  if (sort === 'value-low') return 'selected_value_ex_vat asc nulls last, created_at desc';
  if (sort === 'account') return 'lower(account_label) asc, created_at desc';
  if (sort === 'asset') return 'lower(brand_name) asc, lower(model_name) asc, created_at desc';
  return 'created_at desc, valuation_id desc';
}

async function getOptions(): Promise<AdminValuationOptions> {
  const result = await getDb().query<OptionRow>(`
    ${ADMIN_VALUATION_CTE}
    select 'sector'::text as option_group, sector_key as value,
      max(sector_label) as label, count(*)::bigint as count
    from admin_valuations
    group by sector_key
    union all
    select 'year', valuation_year::text, valuation_year::text, count(*)::bigint
    from admin_valuations
    where valuation_year is not null
    group by valuation_year
    order by option_group, label desc
  `);
  return mapOptions(result.rows);
}

export async function getAdminValuationReport(
  input: Partial<AdminValuationFilters> = {},
): Promise<AdminValuationReport> {
  await Promise.all([ensureAdminUsageTrackingSchema(), ensureAccountProfileColumns()]);
  const filters = normalizeAdminValuationFilters(input);
  const { whereSql, params } = buildWhere(filters);
  const [summaryResult, options] = await Promise.all([
    getDb().query<SummaryRow>(
      `
        ${ADMIN_VALUATION_CTE}
        select
          count(*)::bigint as total_valuations,
          count(*) filter (where record_type = 'estimate')::bigint as estimate_events,
          count(*) filter (where record_type = 'saved')::bigint as saved_valuations,
          count(*) filter (where has_account)::bigint as known_account_valuations,
          count(*) filter (where not has_account)::bigint as unknown_account_valuations,
          count(distinct account_user_id)::bigint as unique_accounts,
          count(*) filter (where selected_value_ex_vat is not null)::bigint as valued_valuations
        from admin_valuations
        ${whereSql}
      `,
      params,
    ),
    getOptions(),
  ]);

  const summary = mapSummary(summaryResult.rows[0]);
  const totalPages = Math.max(1, Math.ceil(summary.totalValuations / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;
  const listParams = [...params, filters.pageSize, offset];
  const limitParameter = `$${listParams.length - 1}`;
  const offsetParameter = `$${listParams.length}`;
  const listResult = await getDb().query<AdminValuationRow>(
    `
      ${ADMIN_VALUATION_CTE}
      select *
      from admin_valuations
      ${whereSql}
      order by ${sortSql(filters.sort)}
      limit ${limitParameter}
      offset ${offsetParameter}
    `,
    listParams,
  );

  return {
    generatedAtIso: new Date().toISOString(),
    valuations: listResult.rows.map(mapValuation),
    summary,
    options: options ?? EMPTY_OPTIONS,
    filters: { ...filters, page },
    pagination: {
      page,
      pageSize: filters.pageSize,
      totalItems: summary.totalValuations,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}
