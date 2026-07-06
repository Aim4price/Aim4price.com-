import { getDb } from "./db";

export type AssetOwnerResolutionCode =
  | "ASSET_NOT_FOUND"
  | "ASSET_CODE_CONFLICT"
  | "ASSET_OWNER_UNRESOLVED"
  | "ASSET_OWNER_CONFLICT"
  | "ASSET_OWNER_FORBIDDEN"
  | "ASSET_CODE_MISMATCH";

export type AssetOwnerSourceIds = {
  assetItemUserId?: string | null;
  registerUserId?: string | null;
  valuationRunUserId?: string | null;
};

export type CanonicalAssetOwnerResolution = AssetOwnerSourceIds & {
  assetId: string;
  publicAssetCode: string;
  ownerUserId: string;
  registerId: string | null;
  valuationRunId: string | null;
  qrStatus: string;
  title: string;
};

type AssetOwnerRow = {
  asset_id: string | null;
  public_asset_code: string | null;
  asset_item_user_id: string | null;
  register_user_id: string | null;
  valuation_run_user_id: string | null;
  register_id: string | null;
  valuation_run_id: string | null;
  qr_status: string | null;
  title: string | null;
};

type ResolverOptions = {
  expectedOwnerUserId?: string | null;
  assetId?: string | null;
  publicAssetCode?: string | null;
  purpose?: string;
};

export class AssetOwnerResolutionError extends Error {
  code: AssetOwnerResolutionCode;
  status: number;
  safeMessage: string;
  details: Record<string, string | null>;

  constructor(
    code: AssetOwnerResolutionCode,
    safeMessage: string,
    status: number,
    details: Record<string, string | null> = {},
  ) {
    super(code);
    this.name = "AssetOwnerResolutionError";
    this.code = code;
    this.status = status;
    this.safeMessage = safeMessage;
    this.details = details;
  }
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOwnerId(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizePublicAssetCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function uniqueOwnerIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function canonicalOwnerIdFromSources(input: AssetOwnerSourceIds): string {
  const assetItemUserId = normalizeOwnerId(input.assetItemUserId);
  const registerUserId = normalizeOwnerId(input.registerUserId);
  const valuationRunUserId = normalizeOwnerId(input.valuationRunUserId);
  const sourceIds = [
    registerUserId,
    assetItemUserId,
    valuationRunUserId,
  ].filter(Boolean);
  const uniqueSourceIds = uniqueOwnerIds(sourceIds);

  if (!uniqueSourceIds.length) {
    return "";
  }

  if (uniqueSourceIds.length === 1) {
    return uniqueSourceIds[0];
  }

  return registerUserId || assetItemUserId || valuationRunUserId;
}

function normalizedQrStatus(value: unknown): string {
  return asText(value).toLowerCase() || "active";
}

function isActiveQrStatus(value: unknown): boolean {
  return normalizedQrStatus(value) === "active";
}

function logOwnerSourceMismatch(
  resolution: CanonicalAssetOwnerResolution,
  purpose: string,
): void {
  const canonicalOwnerUserId = normalizeOwnerId(resolution.ownerUserId);
  const sourceIds = {
    assetItemUserId: normalizeOwnerId(resolution.assetItemUserId),
    registerUserId: normalizeOwnerId(resolution.registerUserId),
    valuationRunUserId: normalizeOwnerId(resolution.valuationRunUserId),
  };
  const mismatchedSources = Object.entries(sourceIds)
    .filter(([, value]) => value && value !== canonicalOwnerUserId)
    .map(([key]) => key);

  if (!mismatchedSources.length) {
    return;
  }

  console.warn("[asset-owner-resolver] Owner source mismatch ignored", {
    purpose,
    assetId: resolution.assetId,
    publicAssetCode: resolution.publicAssetCode,
    canonicalOwnerUserId,
    assetItemUserId: sourceIds.assetItemUserId || null,
    registerUserId: sourceIds.registerUserId || null,
    valuationRunUserId: sourceIds.valuationRunUserId || null,
    mismatchedSources,
  });
}

function logResolutionIssue(
  code: AssetOwnerResolutionCode,
  message: string,
  details: Record<string, string | null>,
): void {
  console.error(`[asset-owner-resolver] ${message}`, { code, ...details });
}

function makeResolutionError(
  code: AssetOwnerResolutionCode,
  safeMessage: string,
  status: number,
  details: Record<string, string | null>,
): AssetOwnerResolutionError {
  logResolutionIssue(code, safeMessage, details);
  return new AssetOwnerResolutionError(code, safeMessage, status, details);
}

function assertExpectedOwner(
  resolution: CanonicalAssetOwnerResolution,
  expectedOwnerUserId: string | null,
  purpose: string,
): void {
  const expected = normalizeOwnerId(expectedOwnerUserId);

  if (!expected || expected === resolution.ownerUserId) {
    return;
  }

  throw makeResolutionError(
    "ASSET_OWNER_FORBIDDEN",
    "This login does not have access to this asset.",
    403,
    {
      purpose,
      assetId: resolution.assetId,
      publicAssetCode: resolution.publicAssetCode,
      resolvedAssetOwnerId: resolution.ownerUserId,
      expectedOwnerUserId: expected,
    },
  );
}

function resolveOwnerFromRow(
  row: AssetOwnerRow,
  purpose: string,
): CanonicalAssetOwnerResolution {
  const assetId = asText(row.asset_id);
  const publicAssetCode = normalizePublicAssetCode(row.public_asset_code);
  const assetItemUserId = normalizeOwnerId(row.asset_item_user_id);
  const registerUserId = normalizeOwnerId(row.register_user_id);
  const valuationRunUserId = normalizeOwnerId(row.valuation_run_user_id);
  const canonicalOwnerUserId = canonicalOwnerIdFromSources({
    assetItemUserId,
    registerUserId,
    valuationRunUserId,
  });

  if (!assetId) {
    throw makeResolutionError("ASSET_NOT_FOUND", "Asset not found.", 404, {
      purpose,
      publicAssetCode,
    });
  }

  if (!canonicalOwnerUserId) {
    throw makeResolutionError(
      "ASSET_OWNER_UNRESOLVED",
      "This asset is missing owner details and cannot be opened safely.",
      409,
      {
        purpose,
        assetId,
        publicAssetCode,
        assetItemUserId: assetItemUserId || null,
        registerUserId: registerUserId || null,
        valuationRunUserId: valuationRunUserId || null,
      },
    );
  }

  const resolution: CanonicalAssetOwnerResolution = {
    assetId,
    publicAssetCode,
    ownerUserId: canonicalOwnerUserId,
    assetItemUserId: assetItemUserId || null,
    registerUserId: registerUserId || null,
    valuationRunUserId: valuationRunUserId || null,
    registerId: asText(row.register_id) || null,
    valuationRunId: asText(row.valuation_run_id) || null,
    qrStatus: asText(row.qr_status) || "active",
    title: asText(row.title),
  };

  logOwnerSourceMismatch(resolution, purpose);

  return resolution;
}

function assertPublicCodeMatches(
  resolution: CanonicalAssetOwnerResolution,
  expectedPublicAssetCode: string | null,
  purpose: string,
): void {
  const expectedCode = normalizePublicAssetCode(expectedPublicAssetCode);

  if (!expectedCode || resolution.publicAssetCode === expectedCode) {
    return;
  }

  throw makeResolutionError(
    "ASSET_CODE_MISMATCH",
    "This asset QR code does not match the selected asset.",
    409,
    {
      purpose,
      assetId: resolution.assetId,
      publicAssetCode: resolution.publicAssetCode,
      expectedPublicAssetCode: expectedCode,
      resolvedAssetOwnerId: resolution.ownerUserId,
    },
  );
}

function assertNoAmbiguousPublicCodeRows(
  rows: AssetOwnerRow[],
  normalizedCode: string,
  purpose: string,
): void {
  const activeRows = rows.filter((row) => isActiveQrStatus(row.qr_status));
  const uniqueAssetIds = uniqueOwnerIds(
    activeRows.map((row) => asText(row.asset_id)).filter(Boolean),
  );

  if (uniqueAssetIds.length <= 1) {
    return;
  }

  const uniqueCanonicalOwners = uniqueOwnerIds(
    activeRows
      .map((row) =>
        canonicalOwnerIdFromSources({
          assetItemUserId: row.asset_item_user_id,
          registerUserId: row.register_user_id,
          valuationRunUserId: row.valuation_run_user_id,
        }),
      )
      .filter(Boolean),
  );

  if (uniqueCanonicalOwners.length === 1) {
    console.warn(
      "[asset-owner-resolver] Duplicate public QR rows for same owner; newest active row will be used",
      {
        purpose,
        publicAssetCode: normalizedCode,
        canonicalOwnerUserId: uniqueCanonicalOwners[0],
        assetIds: uniqueAssetIds.join(","),
      },
    );
    return;
  }

  throw makeResolutionError(
    "ASSET_CODE_CONFLICT",
    "This QR code is linked to more than one active asset and cannot be opened safely.",
    409,
    {
      purpose,
      publicAssetCode: normalizedCode,
      assetIds: uniqueAssetIds.join(","),
      ownerUserIds: uniqueCanonicalOwners.join(",") || null,
    },
  );
}

const assetOwnerSelectSql = `
  select
    a.id::text as asset_id,
    to_jsonb(a)->>'public_asset_code' as public_asset_code,
    nullif(trim(coalesce(to_jsonb(a)->>'user_id', '')), '') as asset_item_user_id,
    nullif(trim(coalesce(to_jsonb(ar)->>'user_id', '')), '') as register_user_id,
    nullif(trim(coalesce(to_jsonb(vr)->>'user_id', '')), '') as valuation_run_user_id,
    nullif(trim(coalesce(to_jsonb(a)->>'register_id', '')), '') as register_id,
    nullif(trim(coalesce(to_jsonb(a)->>'valuation_run_id', '')), '') as valuation_run_id,
    coalesce(nullif(trim(to_jsonb(a)->>'qr_status'), ''), 'active') as qr_status,
    coalesce(to_jsonb(a)->>'title', '') as title
  from public.asset_register_items a
  left join public.asset_registers ar
    on ar.id::text = nullif(trim(coalesce(to_jsonb(a)->>'register_id', '')), '')
  left join public.valuation_runs vr
    on vr.id::text = nullif(trim(coalesce(to_jsonb(a)->>'valuation_run_id', '')), '')
`;

export async function resolveAssetOwnerByPublicAssetCode(
  publicAssetCode: string,
  options: ResolverOptions = {},
): Promise<CanonicalAssetOwnerResolution> {
  const db = getDb();
  const normalizedCode = normalizePublicAssetCode(publicAssetCode);
  const purpose = options.purpose ?? "asset-owner-public-code";
  const expectedAssetId = asText(options.assetId);

  if (!normalizedCode) {
    throw makeResolutionError("ASSET_NOT_FOUND", "Asset not found.", 404, {
      purpose,
      publicAssetCode: "",
    });
  }

  const params: unknown[] = [normalizedCode];
  let assetIdFilter = "";

  if (expectedAssetId) {
    params.push(expectedAssetId);
    assetIdFilter = `and a.id::text = $${params.length}`;
  }

  const result = await db.query<AssetOwnerRow>(
    `
      ${assetOwnerSelectSql}
      where upper(regexp_replace(coalesce(to_jsonb(a)->>'public_asset_code', ''), '\\s+', '', 'g')) = $1
        ${assetIdFilter}
      order by
        case when lower(coalesce(nullif(trim(to_jsonb(a)->>'qr_status'), ''), 'active')) = 'active' then 0 else 1 end,
        nullif(trim(coalesce(to_jsonb(a)->>'updated_at', '')), '') desc nulls last,
        nullif(trim(coalesce(to_jsonb(a)->>'created_at', '')), '') desc nulls last,
        a.id desc
      limit 20
    `,
    params,
  );

  if (!result.rows.length) {
    throw makeResolutionError("ASSET_NOT_FOUND", "Asset not found.", 404, {
      purpose,
      publicAssetCode: normalizedCode,
      assetId: expectedAssetId || null,
    });
  }

  if (!expectedAssetId) {
    assertNoAmbiguousPublicCodeRows(result.rows, normalizedCode, purpose);
  }

  const row =
    result.rows.find((entry) => isActiveQrStatus(entry.qr_status)) ??
    result.rows.find(
      (entry) => normalizedQrStatus(entry.qr_status) !== "deleted",
    ) ??
    result.rows[0];
  const resolution = resolveOwnerFromRow(row, purpose);

  assertPublicCodeMatches(resolution, normalizedCode, purpose);
  assertExpectedOwner(resolution, options.expectedOwnerUserId ?? null, purpose);

  return resolution;
}

export async function resolveAssetOwnerByAssetId(
  assetId: string,
  options: ResolverOptions = {},
): Promise<CanonicalAssetOwnerResolution> {
  const db = getDb();
  const normalizedAssetId = asText(assetId);
  const purpose = options.purpose ?? "asset-owner-asset-id";

  if (!normalizedAssetId) {
    throw makeResolutionError("ASSET_NOT_FOUND", "Asset not found.", 404, {
      purpose,
      assetId: "",
    });
  }

  const result = await db.query<AssetOwnerRow>(
    `
      ${assetOwnerSelectSql}
      where a.id::text = $1
      limit 1
    `,
    [normalizedAssetId],
  );

  const row = result.rows[0];

  if (!row) {
    throw makeResolutionError("ASSET_NOT_FOUND", "Asset not found.", 404, {
      purpose,
      assetId: normalizedAssetId,
    });
  }

  const resolution = resolveOwnerFromRow(row, purpose);

  assertPublicCodeMatches(resolution, options.publicAssetCode ?? null, purpose);
  assertExpectedOwner(resolution, options.expectedOwnerUserId ?? null, purpose);

  return resolution;
}

export function resolveAssetOwnerFromSourceIds(
  input: AssetOwnerSourceIds & {
    assetId: string;
    publicAssetCode?: string | null;
    purpose?: string;
  },
):
  | { ok: true; ownerUserId: string }
  | { ok: false; error: AssetOwnerResolutionError } {
  try {
    const row: AssetOwnerRow = {
      asset_id: input.assetId,
      public_asset_code: input.publicAssetCode ?? null,
      asset_item_user_id: input.assetItemUserId ?? null,
      register_user_id: input.registerUserId ?? null,
      valuation_run_user_id: input.valuationRunUserId ?? null,
      register_id: null,
      valuation_run_id: null,
      qr_status: "active",
      title: null,
    };

    const resolution = resolveOwnerFromRow(
      row,
      input.purpose ?? "asset-owner-source-ids",
    );
    return { ok: true, ownerUserId: resolution.ownerUserId };
  } catch (error) {
    if (error instanceof AssetOwnerResolutionError) {
      return { ok: false, error };
    }

    throw error;
  }
}

export function safeAssetOwnerError(
  error: unknown,
  fallback = "Could not open this asset.",
): { status: number; error: string } | null {
  if (!(error instanceof AssetOwnerResolutionError)) {
    return null;
  }

  return {
    status: error.status,
    error: error.safeMessage || fallback,
  };
}
