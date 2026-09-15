/** Retry only aborted, transient database reads. Never wrap user mutations. */
export function isTransientDatabaseReadError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return code === '40P01' || code === '40001';
}

export async function retryDatabaseRead<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= 2 || !isTransientDatabaseReadError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}
