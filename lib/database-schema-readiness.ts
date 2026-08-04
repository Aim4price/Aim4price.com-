const MISSING_SCHEMA_ERROR_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  '42704', // undefined_object
]);

function postgresErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return '';
  }

  return String((error as { code?: unknown }).code ?? '');
}

/**
 * Runs one cheap, read-only schema probe. Production databases that have run
 * their migrations return immediately; only an actually missing table or
 * column falls back to the legacy self-healing setup path.
 */
export async function isDatabaseSchemaReady(
  probe: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await probe();
    return true;
  } catch (error) {
    if (MISSING_SCHEMA_ERROR_CODES.has(postgresErrorCode(error))) {
      return false;
    }

    throw error;
  }
}
