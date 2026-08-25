import { AIM4PRICE_ADMIN_EMAIL } from './account-constants';
import { ensureAdminUsageTrackingSchema, type AdminUsageEventType } from './admin-usage-events';
import {
  buildLogicalClientStorageSelect,
  formatAdminStorageBytes as formatBytes,
} from './admin-storage-usage';
import { getAdminMarketplaceSummary } from './admin-marketplace';
import { formatAdminMarketplaceMoney } from './admin-marketplace-shared';
import { getDb } from './db';

type CountValue = string | number | null | undefined;

type PeriodCountRow = {
  today?: CountValue;
  month?: CountValue;
  year?: CountValue;
};

export type DashboardMetricValue = {
  label: string;
  value: string;
  detail?: string;
};

export type DashboardStatCard = {
  id: string;
  title: string;
  description?: string;
  values: DashboardMetricValue[];
  href?: string;
  linkLabel?: string;
};

export type AdminDashboardStats = {
  generatedAtIso: string;
  cards: DashboardStatCard[];
  storage: {
    usedBytes: number;
    usedLabel: string;
    limitBytes: number | null;
    limitLabel: string;
    leftBytes: number | null;
    leftLabel: string;
    sources: Array<{ label: string; bytes: number; value: string }>;
    customerUsage: {
      accountCount: number;
      accountCountLabel: string;
      averageBytes: number;
      averageLabel: string;
      medianBytes: number;
      medianLabel: string;
      p90Bytes: number;
      p90Label: string;
      addedLast30DaysBytes: number;
      addedLast30DaysLabel: string;
      pendingBucketUploads: number;
      pendingBucketUploadsLabel: string;
      failedBucketUploads: number;
      failedBucketUploadsLabel: string;
    };
  };
};

type PeriodCounts = {
  today: number;
  month: number;
  year: number;
};

type MonthYearCounts = {
  month: number;
  year: number;
};

const ZERO_PERIOD_COUNTS: PeriodCounts = { today: 0, month: 0, year: 0 };
const ZERO_MONTH_YEAR_COUNTS: MonthYearCounts = { month: 0, year: 0 };
const ACTIVITY_PING_MINUTES = 5;

function asNumber(value: CountValue): number {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function cleanSqlIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return value;
}

function formatCount(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-ZA');
}

function formatAverageMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'Not enough data';
  }

  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toFixed(hours >= 10 ? 0 : 1)} h / user`;
  }

  return `${Math.round(minutes)} min / user`;
}

function readStorageLimitBytes(): number | null {
  const candidates = [
    process.env.AIM4PRICE_STORAGE_LIMIT_BYTES,
    process.env.STORAGE_LIMIT_BYTES,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);

    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric);
    }
  }

  return null;
}

function periodValues(counts: PeriodCounts): DashboardMetricValue[] {
  return [
    { label: 'Today', value: formatCount(counts.today) },
    { label: 'Month', value: formatCount(counts.month) },
    { label: 'Year', value: formatCount(counts.year) },
  ];
}

function monthYearValues(counts: MonthYearCounts): DashboardMetricValue[] {
  return [
    { label: 'Month', value: formatCount(counts.month) },
    { label: 'Year', value: formatCount(counts.year) },
  ];
}

function mapPeriodCounts(row: PeriodCountRow | undefined): PeriodCounts {
  if (!row) return ZERO_PERIOD_COUNTS;

  return {
    today: asNumber(row.today),
    month: asNumber(row.month),
    year: asNumber(row.year),
  };
}

function mapMonthYearCounts(row: PeriodCountRow | undefined): MonthYearCounts {
  if (!row) return ZERO_MONTH_YEAR_COUNTS;

  return {
    month: asNumber(row.month),
    year: asNumber(row.year),
  };
}

async function tableExists(regclassName: string): Promise<boolean> {
  const result = await getDb().query<{ exists: boolean }>(
    'select to_regclass($1) is not null as exists',
    [regclassName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await getDb().query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = $2
      ) as exists
    `,
    [tableName, columnName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function countUsageEvents(eventType: AdminUsageEventType): Promise<PeriodCounts> {
  await ensureAdminUsageTrackingSchema();

  const result = await getDb().query<PeriodCountRow>(
    `
      select
        count(*) filter (where created_at >= date_trunc('day', now()))::bigint as today,
        count(*) filter (where created_at >= date_trunc('month', now()))::bigint as month,
        count(*) filter (where created_at >= date_trunc('year', now()))::bigint as year
      from public.admin_usage_events
      where event_type = $1
    `,
    [eventType],
  );

  return mapPeriodCounts(result.rows[0]);
}

async function countDistinctUsageUsers(eventType: AdminUsageEventType): Promise<MonthYearCounts> {
  await ensureAdminUsageTrackingSchema();

  const result = await getDb().query<PeriodCountRow>(
    `
      select
        count(distinct user_id) filter (
          where user_id is not null
            and created_at >= date_trunc('month', now())
        )::bigint as month,
        count(distinct user_id) filter (
          where user_id is not null
            and created_at >= date_trunc('year', now())
        )::bigint as year
      from public.admin_usage_events
      where event_type = $1
    `,
    [eventType],
  );

  return mapMonthYearCounts(result.rows[0]);
}

async function countTableByCreatedAt(
  tableName: string,
  whereClause = '',
): Promise<PeriodCounts> {
  cleanSqlIdentifier(tableName);

  if (!(await tableExists(`public.${tableName}`)) || !(await columnExists(tableName, 'created_at'))) {
    return ZERO_PERIOD_COUNTS;
  }

  const whereSql = whereClause ? `where ${whereClause}` : '';
  const result = await getDb().query<PeriodCountRow>(`
    select
      count(*) filter (where created_at >= date_trunc('day', now()))::bigint as today,
      count(*) filter (where created_at >= date_trunc('month', now()))::bigint as month,
      count(*) filter (where created_at >= date_trunc('year', now()))::bigint as year
    from public.${tableName}
    ${whereSql}
  `);

  return mapPeriodCounts(result.rows[0]);
}

async function countAssetRegisterItems(whereClause = ''): Promise<PeriodCounts> {
  return countTableByCreatedAt('asset_register_items', whereClause);
}

async function countAim4priceAssetRegisterItems(): Promise<PeriodCounts> {
  if (
    !(await tableExists('public.asset_register_items')) ||
    !(await columnExists('asset_register_items', 'created_at')) ||
    !(await columnExists('asset_register_items', 'valuation_run_id')) ||
    !(await columnExists('asset_register_items', 'selected_method'))
  ) {
    return ZERO_PERIOD_COUNTS;
  }

  return countAssetRegisterItems("valuation_run_id is not null and lower(coalesce(selected_method, '')) <> 'manual'");
}

async function countAccountsByType(accountType?: 'owner' | 'dealer' | 'finance' | 'insurance'): Promise<MonthYearCounts> {
  if (!(await tableExists('public."user"')) || !(await columnExists('user', 'createdAt'))) {
    return ZERO_MONTH_YEAR_COUNTS;
  }

  const hasProfiles = await tableExists('public.account_profiles');
  const typeFilter = accountType
    ? `and ${hasProfiles ? 'coalesce(account_type_group, \'owner\')' : '\'owner\''} = $2`
    : '';
  const params = accountType ? [AIM4PRICE_ADMIN_EMAIL, accountType] : [AIM4PRICE_ADMIN_EMAIL];

  const result = await getDb().query<PeriodCountRow>(
    `
      with account_rows as (
        select
          u."createdAt" as created_at,
          ${hasProfiles ? `
            case
              when lower(trim(coalesce(ap.account_type, ''))) in ('dealer', 'auctioneer', 'auction-house') then 'dealer'
              when lower(trim(coalesce(ap.account_type, ''))) in ('finance', 'bank', 'finance-house', 'accountant') then 'finance'
              when lower(trim(coalesce(ap.account_type, ''))) in ('insurance', 'insurer', 'broker', 'short-term-insurer') then 'insurance'
              else 'owner'
            end
          ` : `'owner'`} as account_type_group
        from public."user" u
        ${hasProfiles ? 'left join public.account_profiles ap on ap.user_id = u.id' : ''}
        where lower(trim(coalesce(u.email, ''))) <> $1
      )
      select
        count(*) filter (where created_at >= date_trunc('month', now()))::bigint as month,
        count(*) filter (where created_at >= date_trunc('year', now()))::bigint as year
      from account_rows
      where true
      ${typeFilter}
    `,
    params,
  );

  return mapMonthYearCounts(result.rows[0]);
}

async function getAverageUserTimePerWeek(): Promise<DashboardMetricValue[]> {
  await ensureAdminUsageTrackingSchema();

  const result = await getDb().query<{ ping_count: CountValue; user_count: CountValue }>(`
    select
      count(*)::bigint as ping_count,
      count(distinct user_id) filter (where user_id is not null)::bigint as user_count
    from public.admin_usage_events
    where event_type = 'user_activity_ping'
      and created_at >= now() - interval '7 days'
  `);

  const pingCount = asNumber(result.rows[0]?.ping_count);
  const userCount = asNumber(result.rows[0]?.user_count);
  const averageMinutes = userCount > 0 ? (pingCount * ACTIVITY_PING_MINUTES) / userCount : 0;

  return [
    {
      label: 'Last 7 days',
      value: formatAverageMinutes(averageMinutes),
      detail: userCount > 0 ? `${formatCount(userCount)} active user${userCount === 1 ? '' : 's'}` : 'Starts after deployment',
    },
  ];
}

async function sumColumnIfPresent(tableName: string, columnName: string): Promise<number> {
  cleanSqlIdentifier(tableName);
  cleanSqlIdentifier(columnName);

  if (!(await tableExists(`public.${tableName}`)) || !(await columnExists(tableName, columnName))) {
    return 0;
  }

  const result = await getDb().query<{ total: CountValue }>(`
    select coalesce(sum(greatest(coalesce(${columnName}, 0), 0)), 0)::bigint as total
    from public.${tableName}
  `);

  return asNumber(result.rows[0]?.total);
}

async function sumOctetLengthIfPresent(tableName: string, columnName: string): Promise<number> {
  cleanSqlIdentifier(tableName);
  cleanSqlIdentifier(columnName);

  if (!(await tableExists(`public.${tableName}`)) || !(await columnExists(tableName, columnName))) {
    return 0;
  }

  const result = await getDb().query<{ total: CountValue }>(`
    select coalesce(sum(octet_length(${columnName})), 0)::bigint as total
    from public.${tableName}
    where ${columnName} is not null
  `);

  return asNumber(result.rows[0]?.total);
}

async function sumJsonbTextArrayOctetLengthIfPresent(
  tableName: string,
  columnName: string,
): Promise<number> {
  cleanSqlIdentifier(tableName);
  cleanSqlIdentifier(columnName);

  if (!(await tableExists(`public.${tableName}`)) || !(await columnExists(tableName, columnName))) {
    return 0;
  }

  const result = await getDb().query<{ total: CountValue }>(`
    select coalesce(sum(octet_length(item.value)), 0)::bigint as total
    from public.${tableName} source
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(source.${columnName}) = 'array' then source.${columnName}
        else '[]'::jsonb
      end
    ) item(value)
  `);

  return asNumber(result.rows[0]?.total);
}

async function getStorageStats(): Promise<AdminDashboardStats['storage']> {
  const assetRegisterUploadBytes = await sumOctetLengthIfPresent('asset_register_uploads', 'data');
  const hasBucketUploadCatalog = await tableExists('public.asset_register_bucket_uploads');
  const hasBucketPurgeQueue = await tableExists('public.asset_register_bucket_upload_purge_queue');
  const hasUploadStorageState = await columnExists('asset_register_uploads', 'storage_state');
  const hasUploadByteSize = await columnExists('asset_register_uploads', 'byte_size');
  const hasUploadCreatedAt = await columnExists('asset_register_uploads', 'created_at');
  const hasUploadUserId = await columnExists('asset_register_uploads', 'user_id');
  const mirroredBucketBytes = hasUploadStorageState && hasUploadByteSize
    ? asNumber((await getDb().query<{ total: CountValue }>(`
        select coalesce(sum(byte_size), 0)::bigint as total
        from public.asset_register_uploads
        where storage_state = 'dual_verified'
      `)).rows[0]?.total)
    : 0;
  const bucketCatalogResult = hasBucketUploadCatalog
    ? await getDb().query<{
        ready_bytes: CountValue;
        pending_bytes: CountValue;
        pending_count: CountValue;
        failed_count: CountValue;
      }>(`
        select
          coalesce(sum(byte_size) filter (where storage_state = 'ready'), 0)::bigint as ready_bytes,
          coalesce(sum(byte_size) filter (where storage_state = 'pending'), 0)::bigint as pending_bytes,
          count(*) filter (where storage_state = 'pending' and last_error is null)::bigint as pending_count,
          count(*) filter (
            where storage_state = 'delete_failed'
               or (storage_state = 'pending' and last_error is not null)
          )::bigint as failed_count
        from public.asset_register_bucket_uploads
      `)
    : null;
  const bucketReadyBytes = asNumber(bucketCatalogResult?.rows[0]?.ready_bytes);
  const bucketPendingBytes = asNumber(bucketCatalogResult?.rows[0]?.pending_bytes);
  const pendingBucketUploads = asNumber(bucketCatalogResult?.rows[0]?.pending_count);
  const failedBucketUploads = asNumber(bucketCatalogResult?.rows[0]?.failed_count);
  const bucketPurgeQueueBytes = hasBucketPurgeQueue
    ? asNumber((await getDb().query<{ total: CountValue }>(`
        select coalesce(sum(byte_size), 0)::bigint as total
        from public.asset_register_bucket_upload_purge_queue
        where purged_at is null
      `)).rows[0]?.total)
    : 0;

  let customerUsage = {
    accountCount: 0,
    accountCountLabel: '0',
    averageBytes: 0,
    averageLabel: '0 B',
    medianBytes: 0,
    medianLabel: '0 B',
    p90Bytes: 0,
    p90Label: '0 B',
    addedLast30DaysBytes: 0,
    addedLast30DaysLabel: '0 B',
    pendingBucketUploads,
    pendingBucketUploadsLabel: formatCount(pendingBucketUploads),
    failedBucketUploads,
    failedBucketUploadsLabel: formatCount(failedBucketUploads),
  };

  if (hasUploadByteSize && hasUploadCreatedAt && hasUploadUserId) {
    const logicalStorageSelect = await buildLogicalClientStorageSelect();
    const usageResult = await getDb().query<{
      account_count: CountValue;
      average_bytes: CountValue;
      median_bytes: CountValue;
      p90_bytes: CountValue;
      added_last_30_days_bytes: CountValue;
    }>(`
      with all_uploads as (
        ${logicalStorageSelect}
      ),
      per_account as (
        select user_id, coalesce(sum(byte_size), 0)::bigint as total_bytes
        from all_uploads
        group by user_id
      )
      select
        count(*)::bigint as account_count,
        coalesce(avg(total_bytes), 0)::bigint as average_bytes,
        coalesce(percentile_cont(0.5) within group (order by total_bytes), 0)::bigint as median_bytes,
        coalesce(percentile_cont(0.9) within group (order by total_bytes), 0)::bigint as p90_bytes,
        (
          select coalesce(sum(byte_size), 0)::bigint
          from all_uploads
          where created_at >= now() - interval '30 days'
        ) as added_last_30_days_bytes
      from per_account
    `);
    const usage = usageResult.rows[0];
    const accountCount = asNumber(usage?.account_count);
    const averageBytes = asNumber(usage?.average_bytes);
    const medianBytes = asNumber(usage?.median_bytes);
    const p90Bytes = asNumber(usage?.p90_bytes);
    const addedLast30DaysBytes = asNumber(usage?.added_last_30_days_bytes);

    customerUsage = {
      accountCount,
      accountCountLabel: formatCount(accountCount),
      averageBytes,
      averageLabel: formatBytes(averageBytes),
      medianBytes,
      medianLabel: formatBytes(medianBytes),
      p90Bytes,
      p90Label: formatBytes(p90Bytes),
      addedLast30DaysBytes,
      addedLast30DaysLabel: formatBytes(addedLast30DaysBytes),
      pendingBucketUploads,
      pendingBucketUploadsLabel: formatCount(pendingBucketUploads),
      failedBucketUploads,
      failedBucketUploadsLabel: formatCount(failedBucketUploads),
    };
  }

  const userMessageBytes =
    (await sumColumnIfPresent('account_user_messages', 'image_size_bytes')) +
    (await sumColumnIfPresent('account_user_messages', 'document_size_bytes')) ||
    (await sumOctetLengthIfPresent('account_user_messages', 'image_bytes')) +
      (await sumOctetLengthIfPresent('account_user_messages', 'document_bytes'));

  const partnerNoteAttachmentBytes = (await columnExists('asset_partner_notes', 'attachment_byte_size'))
    ? await sumColumnIfPresent('asset_partner_notes', 'attachment_byte_size')
    : await sumOctetLengthIfPresent('asset_partner_notes', 'attachment_data');

  const lateFuelEvidenceBytes = await sumOctetLengthIfPresent('fuel_late_entry_evidence', 'data');
  const inlineBrandingBytes =
    (await sumOctetLengthIfPresent('account_profiles', 'logo_url'))
    + (await sumJsonbTextArrayOctetLengthIfPresent('account_profiles', 'extra_photo_urls'))
    + (await sumOctetLengthIfPresent('ad_brand_kits', 'logo_url'));

  const sources = [
    {
      label: 'Asset uploads in PostgreSQL',
      bytes: assetRegisterUploadBytes,
      value: formatBytes(assetRegisterUploadBytes),
    },
    ...(hasUploadStorageState ? [{
      label: 'Verified Railway Bucket copies',
      bytes: mirroredBucketBytes,
      value: formatBytes(mirroredBucketBytes),
    }] : []),
    ...(hasBucketUploadCatalog ? [
      {
        label: 'Ready Bucket-only uploads',
        bytes: bucketReadyBytes,
        value: formatBytes(bucketReadyBytes),
      },
      {
        label: 'Pending Bucket-only upload allowance',
        bytes: bucketPendingBytes,
        value: formatBytes(bucketPendingBytes),
      },
    ] : []),
    ...(hasBucketPurgeQueue ? [{
      label: 'Bucket deletion recovery queue',
      bytes: bucketPurgeQueueBytes,
      value: formatBytes(bucketPurgeQueueBytes),
    }] : []),
    {
      label: 'User message attachments',
      bytes: userMessageBytes,
      value: formatBytes(userMessageBytes),
    },
    {
      label: 'Partner note PDFs',
      bytes: partnerNoteAttachmentBytes,
      value: formatBytes(partnerNoteAttachmentBytes),
    },
    {
      label: 'Late fuel-entry evidence',
      bytes: lateFuelEvidenceBytes,
      value: formatBytes(lateFuelEvidenceBytes),
    },
    {
      label: 'Inline profile photos and Brand Kit logos',
      bytes: inlineBrandingBytes,
      value: formatBytes(inlineBrandingBytes),
    },
  ];
  const usedBytes = sources.reduce((sum, source) => sum + source.bytes, 0);
  const limitBytes = readStorageLimitBytes();
  const leftBytes = limitBytes === null ? null : Math.max(0, limitBytes - usedBytes);

  return {
    usedBytes,
    usedLabel: formatBytes(usedBytes),
    limitBytes,
    limitLabel: limitBytes === null ? 'not set' : formatBytes(limitBytes),
    leftBytes,
    leftLabel: leftBytes === null ? 'Limit not set' : formatBytes(leftBytes),
    sources,
    customerUsage,
  };
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await ensureAdminUsageTrackingSchema();

  const [
    freeEstimates,
    freeEstimateUsers,
    paidEstimates,
    totalAssets,
    aim4priceAssets,
    assetRegisters,
    totalAccounts,
    ownerAccounts,
    dealerAccounts,
    financeAccounts,
    insurerAccounts,
    averageUserTimeValues,
    passwordResetClicks,
    optionMessages,
    qrShareMessages,
    leaveNoteMessages,
    qrAssetUpdates,
    assetUpdates,
    maintenanceNotes,
    marketplaceSummary,
    storage,
  ] = await Promise.all([
    countUsageEvents('free_estimate_completed'),
    countDistinctUsageUsers('free_estimate_completed'),
    countTableByCreatedAt('valuation_runs'),
    countAssetRegisterItems(),
    countAim4priceAssetRegisterItems(),
    countTableByCreatedAt('asset_registers'),
    countAccountsByType(),
    countAccountsByType('owner'),
    countAccountsByType('dealer'),
    countAccountsByType('finance'),
    countAccountsByType('insurance'),
    getAverageUserTimePerWeek(),
    countUsageEvents('password_reset_clicked'),
    countUsageEvents('message_sent_options'),
    countUsageEvents('message_sent_qr_share'),
    countUsageEvents('message_sent_leave_note'),
    countUsageEvents('qr_asset_updated'),
    countUsageEvents('asset_updated'),
    countUsageEvents('maintenance_note_left'),
    getAdminMarketplaceSummary(),
    getStorageStats(),
  ]);

  const cards: DashboardStatCard[] = [
    {
      id: 'free-estimates',
      title: 'Free estimates done',
      values: periodValues(freeEstimates),
      href: '/admin/valuations?type=estimate',
      linkLabel: 'View estimate history',
    },
    {
      id: 'free-estimate-users',
      title: 'Different accounts that used free estimates',
      description: 'Signed-in users only. Guest estimates are counted above but have no account attached.',
      values: monthYearValues(freeEstimateUsers),
    },
    {
      id: 'paid-estimates',
      title: 'Full estimates saved',
      description: 'Saved valuations completed in the full estimate workflow.',
      values: periodValues(paidEstimates),
      href: '/admin/valuations?type=saved',
      linkLabel: 'View saved valuations',
    },
    {
      id: 'total-assets-saved',
      title: 'Total assets saved',
      values: monthYearValues(totalAssets),
    },
    {
      id: 'aim4price-assets-saved',
      title: 'Aim4price-valued assets saved',
      values: monthYearValues(aim4priceAssets),
    },
    {
      id: 'marketplace-advertised',
      title: 'Marketplace value advertised',
      description: 'All-time asking value excl. VAT. Each unique asset is counted once at its latest recorded asking price.',
      values: [
        {
          label: 'All time',
          value: formatAdminMarketplaceMoney(marketplaceSummary.allTimeAdvertisedValueExVat),
        },
        {
          label: 'Unique assets',
          value: formatCount(marketplaceSummary.totalUniqueAssets),
          detail: `${formatCount(marketplaceSummary.totalListingEvents)} listing events`,
        },
        {
          label: 'Live now',
          value: formatAdminMarketplaceMoney(marketplaceSummary.liveAdvertisedValueExVat),
          detail: `${formatCount(marketplaceSummary.liveAssets)} live assets`,
        },
      ],
      href: '/admin/marketplace',
      linkLabel: 'View every marketplace asset',
    },
    {
      id: 'asset-registers-created',
      title: 'Asset registers created',
      values: monthYearValues(assetRegisters),
    },
    {
      id: 'total-accounts-created',
      title: 'Total accounts created',
      values: monthYearValues(totalAccounts),
    },
    {
      id: 'owner-accounts-created',
      title: 'Owner accounts created',
      values: monthYearValues(ownerAccounts),
    },
    {
      id: 'dealer-accounts-created',
      title: 'Dealer accounts created',
      values: monthYearValues(dealerAccounts),
    },
    {
      id: 'finance-accounts-created',
      title: 'Finance accounts created',
      values: monthYearValues(financeAccounts),
    },
    {
      id: 'insurer-accounts-created',
      title: 'Insurer accounts created',
      values: monthYearValues(insurerAccounts),
    },
    {
      id: 'average-user-time',
      title: 'Average user time per week',
      description: 'Estimated from 5-minute server activity pings. No external analytics.',
      values: averageUserTimeValues,
    },
    {
      id: 'storage',
      title: 'Known file payload / configured allowance',
      description: 'Logical uploaded bytes only—not PostgreSQL table overhead, WAL, backups or Railway volume headroom.',
      values: [
        { label: 'Used', value: storage.usedLabel },
        { label: 'Limit', value: storage.limitLabel },
        { label: 'Left', value: storage.leftLabel },
      ],
    },
    {
      id: 'password-reset-clicks',
      title: 'Reset password button clicked',
      values: monthYearValues(passwordResetClicks),
    },
    {
      id: 'messages-options',
      title: 'Messages sent via options',
      values: monthYearValues(optionMessages),
    },
    {
      id: 'messages-qr-share',
      title: 'Messages sent via QR code share',
      values: monthYearValues(qrShareMessages),
    },
    {
      id: 'messages-leave-note',
      title: 'Messages sent via leave note',
      values: monthYearValues(leaveNoteMessages),
    },
    {
      id: 'qr-updates',
      title: 'QR codes successfully updated/scanned',
      values: monthYearValues(qrAssetUpdates),
    },
    {
      id: 'asset-updates',
      title: 'Assets successfully updated',
      values: monthYearValues(assetUpdates),
    },
    {
      id: 'maintenance-notes',
      title: 'Maintenance notes left',
      values: monthYearValues(maintenanceNotes),
    },
  ];

  return {
    generatedAtIso: new Date().toISOString(),
    cards,
    storage,
  };
}
