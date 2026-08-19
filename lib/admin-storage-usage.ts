import { getDb } from "./db";

type StorageSchemaColumn = {
  table_name: string;
  column_name: string;
};

export function formatAdminStorageBytes(value: number): string {
  const bytes = Math.max(0, Math.round(value));

  if (bytes >= 1000 ** 4) return `${(bytes / 1000 ** 4).toFixed(2)} TB`;
  if (bytes >= 1000 ** 3) return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
  if (bytes >= 1000 ** 2) return `${(bytes / 1000 ** 2).toFixed(2)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(2)} KB`;
  return `${bytes} B`;
}

export function formatAdminStorageGigabytes(value: number): string {
  const gigabytes = Math.max(0, value) / 1000 ** 3;

  if (gigabytes === 0) return "0 GB";
  if (gigabytes < 0.0001) return "<0.0001 GB";
  if (gigabytes < 0.01) return `${gigabytes.toFixed(4)} GB`;
  if (gigabytes < 1) return `${gigabytes.toFixed(3)} GB`;
  return `${gigabytes.toFixed(2)} GB`;
}

/**
 * Returns a complete SELECT (without a surrounding CTE) for logical,
 * client-attributable file bytes. Metadata mirrors and internal URL references
 * are intentionally excluded so a client file is not counted twice.
 */
export async function buildLogicalClientStorageSelect(): Promise<string> {
  const db = getDb();
  const storageSchemaResult = await db.query<StorageSchemaColumn>(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any(array[
        'asset_register_bucket_uploads',
        'account_user_messages',
        'asset_partner_notes',
        'fuel_late_entry_evidence',
        'account_profiles',
        'ad_brand_kits'
      ]::text[])
  `);
  const storageColumns = new Set(
    storageSchemaResult.rows.map(
      (column) => `${column.table_name}.${column.column_name}`,
    ),
  );
  const hasStorageColumns = (tableName: string, ...columnNames: string[]) =>
    columnNames.every((columnName) =>
      storageColumns.has(`${tableName}.${columnName}`),
    );
  const storageSelects: string[] = [
    `
      select
        user_id,
        byte_size::bigint as byte_size,
        'postgres'::text as storage_source,
        created_at
      from public.asset_register_uploads
      where user_id is not null
    `,
  ];

  function optionalCreatedAt(tableName: string, alias: string): string {
    return hasStorageColumns(tableName, "created_at")
      ? `${alias}.created_at`
      : "null::timestamptz";
  }

  function optionalByteExpression(
    tableName: string,
    alias: string,
    sizeColumn: string,
    dataColumn: string,
  ): string | null {
    const candidates: string[] = [];

    if (hasStorageColumns(tableName, dataColumn)) {
      candidates.push(`octet_length(${alias}.${dataColumn})::bigint`);
    }

    if (hasStorageColumns(tableName, sizeColumn)) {
      candidates.push(
        `nullif(greatest(coalesce(${alias}.${sizeColumn}, 0), 0), 0)::bigint`,
      );
    }

    return candidates.length > 0
      ? `coalesce(${candidates.join(", ")}, 0)::bigint`
      : null;
  }

  function addBinaryStorageSelect(input: {
    tableName: string;
    alias: string;
    userColumn: string;
    sizeColumn: string;
    dataColumn: string;
  }) {
    if (!hasStorageColumns(input.tableName, input.userColumn)) {
      return;
    }

    const byteExpression = optionalByteExpression(
      input.tableName,
      input.alias,
      input.sizeColumn,
      input.dataColumn,
    );

    if (!byteExpression) {
      return;
    }

    storageSelects.push(`
      select
        ${input.alias}.${input.userColumn} as user_id,
        ${byteExpression} as byte_size,
        'postgres'::text as storage_source,
        ${optionalCreatedAt(input.tableName, input.alias)} as created_at
      from public.${input.tableName} ${input.alias}
      where ${input.alias}.${input.userColumn} is not null
        and ${byteExpression} > 0
    `);
  }

  addBinaryStorageSelect({
    tableName: "account_user_messages",
    alias: "message",
    userColumn: "sender_user_id",
    sizeColumn: "image_size_bytes",
    dataColumn: "image_bytes",
  });
  addBinaryStorageSelect({
    tableName: "account_user_messages",
    alias: "message",
    userColumn: "sender_user_id",
    sizeColumn: "document_size_bytes",
    dataColumn: "document_bytes",
  });
  addBinaryStorageSelect({
    tableName: "asset_partner_notes",
    alias: "note",
    userColumn: "partner_user_id",
    sizeColumn: "attachment_byte_size",
    dataColumn: "attachment_data",
  });
  addBinaryStorageSelect({
    tableName: "fuel_late_entry_evidence",
    alias: "evidence",
    userColumn: "user_id",
    sizeColumn: "byte_size",
    dataColumn: "data",
  });

  for (const [tableName, alias] of [
    ["account_profiles", "profile"],
    ["ad_brand_kits", "brand_kit"],
  ] as const) {
    if (!hasStorageColumns(tableName, "user_id", "logo_url")) {
      continue;
    }

    storageSelects.push(`
      select
        inline_logo.user_id,
        greatest(
          (length(inline_logo.payload) * 3 / 4)
            - case
                when right(inline_logo.payload, 2) = '==' then 2
                when right(inline_logo.payload, 1) = '=' then 1
                else 0
              end,
          0
        )::bigint as byte_size,
        'postgres'::text as storage_source,
        inline_logo.created_at
      from (
        select
          ${alias}.user_id,
          split_part(${alias}.logo_url, ',', 2) as payload,
          null::timestamptz as created_at
        from public.${tableName} ${alias}
        where ${alias}.user_id is not null
          and ${alias}.logo_url like 'data:image/%;base64,%'
      ) inline_logo
      where length(inline_logo.payload) > 2
    `);
  }

  if (hasStorageColumns("account_profiles", "user_id", "extra_photo_urls")) {
    storageSelects.push(`
      select
        inline_photo.user_id,
        greatest(
          (length(inline_photo.payload) * 3 / 4)
            - case
                when right(inline_photo.payload, 2) = '==' then 2
                when right(inline_photo.payload, 1) = '=' then 1
                else 0
              end,
          0
        )::bigint as byte_size,
        'postgres'::text as storage_source,
        inline_photo.created_at
      from (
        select
          profile.user_id,
          split_part(extra_photo.photo_url, ',', 2) as payload,
          null::timestamptz as created_at
        from public.account_profiles profile
        cross join lateral jsonb_array_elements_text(
          case
            when jsonb_typeof(coalesce(profile.extra_photo_urls, '[]'::jsonb)) = 'array'
              then coalesce(profile.extra_photo_urls, '[]'::jsonb)
            else '[]'::jsonb
          end
        ) extra_photo(photo_url)
        where profile.user_id is not null
          and extra_photo.photo_url like 'data:image/%;base64,%'
      ) inline_photo
      where length(inline_photo.payload) > 2
    `);
  }

  if (
    hasStorageColumns(
      "asset_register_bucket_uploads",
      "user_id",
      "byte_size",
      "storage_state",
      "created_at",
    )
  ) {
    storageSelects.push(`
      select
        user_id,
        byte_size::bigint as byte_size,
        'bucket'::text as storage_source,
        created_at
      from public.asset_register_bucket_uploads
      where user_id is not null
        and storage_state = 'ready'
    `);
  }

  return storageSelects.join("\nunion all\n");
}
