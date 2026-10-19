import type { PoolClient } from 'pg';
import { getDb } from './db';
import { getAssetRegisterItemById, type AssetRegisterItem } from './asset-register-db';

/** Calculate outside the transaction; lock and validate before writing anything. */
export async function saveAssetRevaluation<T>(
  expected: AssetRegisterItem,
  persist: (transaction: PoolClient) => Promise<T>,
): Promise<T> {
  const transaction = await getDb().connect();
  let discardConnection = false;
  try {
    await transaction.query('BEGIN');
    const current = await getAssetRegisterItemById(expected.userId, expected.id, transaction);
    if (!current) throw new Error('ASSET_NOT_FOUND');
    if (current.selectedMethod === 'manual') throw new Error('ASSET_NOT_REVALUEABLE');
    if (!expected.updatedAtIso || current.updatedAtIso !== expected.updatedAtIso) {
      throw new Error('The asset changed. Reopen the value preview and try again.');
    }
    const result = await persist(transaction);
    await transaction.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await transaction.query('ROLLBACK');
    } catch {
      // An uncertain transaction must not return its connection to the pool.
      discardConnection = true;
    }
    throw error;
  } finally {
    transaction.release(discardConnection);
  }
}
