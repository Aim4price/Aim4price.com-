export type OfflineMutationKind =
  | 'asset-scan-update'
  | 'fuel-ledger-issue'
  | 'fuel-ledger-refill'
  | 'fuel-ledger-dipstick';

export type OfflineMutationMethod = 'POST';

export type OfflineMutation = {
  id: string;
  kind: OfflineMutationKind;
  endpoint: string;
  method: OfflineMutationMethod;
  payload: unknown;
  createdAtIso: string;
  updatedAtIso: string;
  attemptCount: number;
  lastError: string | null;
};

type EnqueueOfflineMutationInput = {
  id?: string;
  kind: OfflineMutationKind;
  endpoint: string;
  method?: OfflineMutationMethod;
  payload: unknown;
};

type SyncOfflineMutationsOptions = {
  kinds?: OfflineMutationKind[];
  onSynced?: (mutation: OfflineMutation) => void;
  onDropped?: (mutation: OfflineMutation, reason: string) => void;
  onRetry?: (mutation: OfflineMutation, reason: string) => void;
};

type SyncOfflineMutationsResult = {
  syncedCount: number;
  pendingCount: number;
  droppedCount: number;
};

const DB_NAME = 'aim4price-offline-mutation-queue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';
const LOCAL_STORAGE_KEY = 'aim4price_offline_mutation_queue_v1';

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined';
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomIdPart(): string {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : null;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(4);
    cryptoApi.getRandomValues(values);
    return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('');
  }

  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function createOfflineClientEventId(kind: OfflineMutationKind): string {
  return `${kind}:${Date.now().toString(36)}:${randomIdPart()}`;
}

function isIndexedDbAvailable(): boolean {
  return canUseBrowserStorage() && 'indexedDB' in window && Boolean(window.indexedDB);
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed to open.'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openQueueDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request: IDBRequest<T> | void;

    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    };

    try {
      request = callback(store);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

function readFallbackQueue(): OfflineMutation[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOfflineMutation);
  } catch {
    return [];
  }
}

function writeFallbackQueue(queue: OfflineMutation[]): void {
  if (!canUseBrowserStorage()) throw new Error('Phone storage is unavailable. Your update has not been saved.');

  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    throw new Error('Phone storage is full or unavailable. Your update has not been saved. Keep this page open and retry when connected.');
  }
}

function isOfflineMutation(value: unknown): value is OfflineMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<OfflineMutation>;
  return Boolean(
    typeof record.id === 'string' &&
      typeof record.kind === 'string' &&
      typeof record.endpoint === 'string' &&
      record.method === 'POST' &&
      typeof record.createdAtIso === 'string' &&
      typeof record.updatedAtIso === 'string' &&
      typeof record.attemptCount === 'number',
  );
}

async function getAllIndexedDbMutations(): Promise<OfflineMutation[]> {
  const result = await withStore<OfflineMutation[]>('readonly', (store) => store.getAll());
  return Array.isArray(result) ? result.filter(isOfflineMutation) : [];
}

async function putIndexedDbMutation(mutation: OfflineMutation): Promise<void> {
  await withStore('readwrite', (store) => {
    store.put(mutation);
  });
}

async function deleteIndexedDbMutation(id: string): Promise<void> {
  await withStore('readwrite', (store) => {
    store.delete(id);
  });
}

async function saveFallbackMutation(mutation: OfflineMutation): Promise<void> {
  const queue = readFallbackQueue();
  const existingIndex = queue.findIndex((entry) => entry.id === mutation.id);

  if (existingIndex >= 0) {
    const existing = queue[existingIndex];
    queue[existingIndex] = {
      ...existing,
      ...mutation,
      createdAtIso: existing.createdAtIso || mutation.createdAtIso,
      attemptCount: mutation.attemptCount,
    };
  } else {
    queue.push(mutation);
  }

  writeFallbackQueue(queue);
}

async function getAllMutations(): Promise<OfflineMutation[]> {
  const fallbackQueue = readFallbackQueue();

  try {
    const indexedQueue = await getAllIndexedDbMutations();
    const merged = new Map<string, OfflineMutation>();
    [...fallbackQueue, ...indexedQueue].forEach((entry) => merged.set(entry.id, entry));
    return Array.from(merged.values());
  } catch {
    return fallbackQueue;
  }
}

async function saveMutation(mutation: OfflineMutation): Promise<void> {
  try {
    await putIndexedDbMutation(mutation);
  } catch {
    await saveFallbackMutation(mutation);
  }
}

async function removeMutation(id: string): Promise<void> {
  try {
    await deleteIndexedDbMutation(id);
  } catch {
    // IndexedDB may be unavailable; localStorage cleanup still runs below.
  }

  const queue = readFallbackQueue().filter((entry) => entry.id !== id);
  writeFallbackQueue(queue);
}

export async function enqueueOfflineMutation(input: EnqueueOfflineMutationInput): Promise<OfflineMutation> {
  const id = input.id || createOfflineClientEventId(input.kind);
  const existing = (await getAllMutations()).find((entry) => entry.id === id);
  const timestamp = nowIso();
  const mutation: OfflineMutation = {
    id,
    kind: input.kind,
    endpoint: input.endpoint,
    method: input.method ?? 'POST',
    payload: input.payload,
    createdAtIso: existing?.createdAtIso ?? timestamp,
    updatedAtIso: timestamp,
    attemptCount: existing?.attemptCount ?? 0,
    lastError: existing?.lastError ?? null,
  };

  await saveMutation(mutation);
  return mutation;
}

export async function getOfflineMutationCount(kinds?: OfflineMutationKind[]): Promise<number> {
  const kindSet = kinds?.length ? new Set(kinds) : null;
  const queue = await getAllMutations();
  return kindSet ? queue.filter((entry) => kindSet.has(entry.kind)).length : queue.length;
}

export function isOfflineNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network error') ||
      message.includes('load failed') ||
      message.includes('internet connection') ||
      message.includes('the network connection was lost')
    );
  }

  return false;
}

export async function syncOfflineMutations(options: SyncOfflineMutationsOptions = {}): Promise<SyncOfflineMutationsResult> {
  const kindSet = options.kinds?.length ? new Set(options.kinds) : null;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      syncedCount: 0,
      droppedCount: 0,
      pendingCount: await getOfflineMutationCount(options.kinds),
    };
  }

  const queue = (await getAllMutations())
    .filter((entry) => !kindSet || kindSet.has(entry.kind))
    .sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));

  let syncedCount = 0;
  let droppedCount = 0;

  for (const mutation of queue) {
    try {
      const response = await fetch(mutation.endpoint, {
        method: mutation.method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mutation.payload),
      });

      if (response.ok) {
        await removeMutation(mutation.id);
        syncedCount += 1;
        options.onSynced?.(mutation);
        continue;
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      const reason = data?.error || `Server returned ${response.status}.`;

      await saveMutation({
        ...mutation,
        updatedAtIso: nowIso(),
        attemptCount: mutation.attemptCount + 1,
        lastError: reason,
      });
      options.onRetry?.(mutation, reason);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Network unavailable.';
      await saveMutation({
        ...mutation,
        updatedAtIso: nowIso(),
        attemptCount: mutation.attemptCount + 1,
        lastError: reason,
      });
      options.onRetry?.(mutation, reason);
    }
  }

  return {
    syncedCount,
    droppedCount,
    pendingCount: await getOfflineMutationCount(options.kinds),
  };
}
