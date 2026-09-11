// The only persistent private record is an authenticated AES-GCM ciphertext.
const DB = 'aim4price-field-offline-v1';
const encoder = new TextEncoder();
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_QUEUE = 100;
async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vault');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Phone storage is unavailable. Nothing has been saved.'));
    request.onblocked = () => reject(Error('Close other offline work tabs and try again.'));
  });
}
async function storage(value, remove = false) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', value !== undefined || remove ? 'readwrite' : 'readonly');
    const store = tx.objectStore('vault');
    let req;
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(Error('Phone storage is full or unavailable. This change has not been saved.')); };
    try { req = remove ? store.delete('current') : value !== undefined ? store.put(value, 'current') : store.get('current'); }
    catch { tx.abort(); db.close(); reject(Error('Phone storage is full or unavailable. This change has not been saved.')); }
  });
}
export async function hasVault() { return Boolean(await storage()); }
export async function forgetVault() { await storage(undefined, true); }
async function keyFor(pin, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function createVault(pin, snapshot) {
  if (!/^\d{8,}$/.test(pin)) throw Error('Choose an offline PIN with at least 8 digits.');
  if (await hasVault()) throw Error('Unlock the existing offline copy first.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const vault = { salt, key: await keyFor(pin, salt), data: null };
  await saveVault(vault, { snapshot, queue: [], lastSynced: null });
  return vault;
}
export async function unlockVault(pin) {
  const stored = await storage();
  if (!stored || stored.version !== 1) throw Error('Prepare offline work while connected first.');
  const key = await keyFor(pin, stored.salt);
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.iv }, key, stored.bytes); }
  catch { throw Error('That PIN could not unlock this offline copy.'); }
  return { key, salt: stored.salt, data: JSON.parse(new TextDecoder().decode(plain)) };
}
export async function saveVault(vault, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = encoder.encode(JSON.stringify(data));
  if (plain.byteLength > 80 * 1024 * 1024) throw Error('Offline storage limit reached. Sync saved work before adding more photos.');
  const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.key, plain);
  await storage({ version: 1, salt: vault.salt, iv, bytes });
  vault.data = data; // Never show a successful save until the transaction commits.
}
export async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', ...options,
    headers: { 'x-aim4price-client-realm': 'field', ...options.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const error = Error(data?.error || 'Could not connect. Saved work is still on this phone.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function refreshVault(vault) {
  const snapshot = await api('/api/field-manager/offline');
  if (snapshot.identity !== vault.data.snapshot.identity) throw Error('Sign in to the account that prepared this offline copy.');
  await saveVault(vault, { ...vault.data, snapshot });
}
export async function queueWork(vault, work) {
  if (!vault.data.snapshot.canRecordWork) throw Error('This login cannot record work.');
  if (vault.data.queue.length >= MAX_QUEUE) throw Error('Sync your saved work before adding more.');
  if (!vault.data.snapshot.assets.some(a => a.id === work.assetId && a.publicAssetCode === work.code)) throw Error('Choose an asset from your saved copy.');
  if (!work.payload.clientEventId || vault.data.queue.some(q => q.payload.clientEventId === work.payload.clientEventId)) throw Error('This update has already been saved.');
  await saveVault(vault, { ...vault.data, queue: [...vault.data.queue, work] });
}
function photoFile(photo) {
  const [header, base64] = photo.dataUrl.split(',');
  const type = header.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1];
  if (!type) throw Error('The saved photo format is invalid.');
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type });
}
export async function syncVault(vault, onChange = () => {}) {
  const identity = (await api('/api/field-manager/offline?identityOnly=1')).identity;
  if (identity !== vault.data.snapshot.identity) throw Error('Sign in to the account that captured this work. Nothing was sent.');
  let synced = 0;
  for (const original of [...vault.data.queue]) {
    // Invalid/stale readings require a deliberate review, never a silent overwrite.
    if (original.blocked) throw Error(original.error || 'Review the first saved update before syncing newer work.');
    let work = structuredClone(original);
    const checkpoint = async () => {
      await saveVault(vault, { ...vault.data, queue: vault.data.queue.map(q => q.id === work.id ? work : q) });
      onChange();
    };
    try {
      for (let i = 0; i < work.photos.length; i++) {
        if (work.photos[i].url) continue;
        const form = new FormData();
        form.append('publicAssetCode', work.code);
        form.append('files', photoFile(work.photos[i]), work.photos[i].name);
        const result = await api('/api/field-manager/offline/upload?assetId=' + encodeURIComponent(work.assetId), {
          method: 'POST', headers: { 'x-aim4price-offline-identity': identity }, body: form,
        });
        if (!result.uploads?.[0]?.url) throw Error('Photo upload was not confirmed.');
        work.photos[i].url = result.uploads[0].url;
        await checkpoint();
      }
      const result = await api('/api/field-manager/offline/sync?assetId=' + encodeURIComponent(work.assetId) + '&code=' + encodeURIComponent(work.code), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-aim4price-offline-identity': identity },
        body: JSON.stringify({ ...work.payload, photoUrls: work.photos.map(p => p.url) }),
      });
      if (!result.asset || (work.maintenance && !result.scheduledMaintenanceCompletion?.completed)) throw Error('The server has not confirmed this work as complete. It remains saved here.');
      await saveVault(vault, { ...vault.data, queue: vault.data.queue.filter(q => q.id !== work.id), lastSynced: new Date().toISOString() });
      synced++; onChange();
    } catch (error) {
      work.error = error.message || 'Connection interrupted. Waiting to sync.';
      work.blocked = [400, 403, 409, 413].includes(error.status);
      await checkpoint();
      // Keep chronological order; newer readings must not jump ahead of a failed earlier reading.
      throw error;
    }
  }
  if (!vault.data.queue.length) await refreshVault(vault);
  return synced;
}
