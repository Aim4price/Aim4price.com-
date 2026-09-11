import { api, hasVault, createVault, unlockVault, saveVault, refreshVault, queueWork, syncVault, forgetVault, MAX_PHOTOS, MAX_PHOTO_BYTES } from './offline-store.mjs';
const $ = id => document.getElementById(id);
let vault = null, asset = null, gps = null, busy = false, sessionChanged = false, releaseLock = null, idleTimer, photoUrls = [];
const announce = text => { $('notice').textContent = text; };
function node(tag, text, className) { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; }
function button(text, action) { const b = node('button', text); b.type = 'button'; b.onclick = action; return b; }
function connection() { $('connection').textContent = navigator.onLine ? 'Online' : 'Offline · working from this phone'; }
function clearPhotos() { photoUrls.forEach(URL.revokeObjectURL); photoUrls = []; $('photo-preview').replaceChildren(); }
function lock() {
  if (busy) return;
  vault = null; asset = null; gps = null;
  clearPhotos(); $('capture-form').reset(); $('pin').value = ''; $('confirm-pin').value = '';
  $('assets').replaceChildren(); $('queue').replaceChildren(); $('tasks').replaceChildren();
  $('account').textContent = ''; $('asset-title').textContent = ''; $('asset-details').textContent = '';
  $('search').value = ''; announce('Offline work locked.');
  $('workspace').hidden = true; $('capture').hidden = true; $('lock').hidden = true; $('gate').hidden = false;
  releaseLock?.(); releaseLock = null; clearTimeout(idleTimer); void gate().catch(error => announce(error.message));
}
function touch() { clearTimeout(idleTimer); if (vault) idleTimer = setTimeout(() => { if (busy) touch(); else { lock(); announce('Offline work locked. Enter your PIN to continue.'); } }, 10 * 60 * 1000); }
async function exclusiveTab() {
  if (releaseLock) return;
  if (!navigator.locks) throw Error('This browser cannot safely store offline work. Update your browser and try again.');
  await new Promise((resolve, reject) => {
    navigator.locks.request('aim4price-field-offline-vault', { ifAvailable: true }, async held => {
      if (!held) { reject(Error('Offline work is open in another tab. Lock it there first.')); return; }
      await new Promise(release => { releaseLock = release; resolve(); });
    }).catch(reject);
  });
}
async function run(action) {
  if (busy) return;
  busy = true; document.querySelectorAll('button,input,select,textarea').forEach(b => b.disabled = true);
  try { await action(); } catch (error) { announce(error.message || 'Could not complete this action.'); }
  finally { busy = false; document.querySelectorAll('button,input,select,textarea').forEach(b => b.disabled = false); if (sessionChanged) { sessionChanged = false; lock(); } else touch(); }
}
async function gate() {
  const exists = await hasVault();
  $('gate-title').textContent = exists ? 'Unlock offline work' : 'Prepare for offline use';
  $('gate-copy').textContent = exists ? 'Enter the offline PIN for the saved copy on this phone.' : 'Download assigned assets and tasks while connected. Your offline PIN protects the copy on this phone.';
  $('confirm-label').hidden = exists;
  $('confirm-pin').required = !exists;
  $('unlock-button').textContent = exists ? 'Unlock' : 'Prepare offline work';
}
function renderQueue() {
  $('pending-count').textContent = `(${vault.data.queue.length})`;
  $('queue').replaceChildren();
  if (!vault.data.queue.length) $('queue').append(node('p', 'All captured work has synced.'));
  for (const work of vault.data.queue) {
    const card = node('article', '', 'queued');
    card.append(node('strong', work.title), node('p', work.payload.note), node('small', `${new Date(work.createdAt).toLocaleString()} · ${work.photos.length} photos`),
      node('p', work.error || 'Waiting to sync'));
    if (work.blocked) card.append(node('p', 'Needs review. No newer work will sync until this is resolved. Check the record or permissions online, then retry.'));
    card.append(button('Retry', () => run(async () => {
      await saveVault(vault, { ...vault.data, queue: vault.data.queue.map(q => q.id === work.id ? { ...q, blocked: false, error: '' } : q) });
      await sync();
    })), button('Remove saved update', () => run(async () => {
      if (!confirm('Remove this update and its offline photos from this phone? A server-side update, if already received, will remain.')) return;
      await saveVault(vault, { ...vault.data, queue: vault.data.queue.filter(q => q.id !== work.id) }); render();
    })));
    $('queue').append(card);
  }
}
function renderAssets() {
  $('assets').replaceChildren();
  const query = $('search').value.trim().toLowerCase();
  const shown = vault.data.snapshot.assets.filter(a => [a.title, a.registrationNumber, a.serialNumber, a.publicAssetCode].join(' ').toLowerCase().includes(query));
  for (const a of shown) {
    const b = button('', () => openAsset(a)); b.className = 'asset';
    const count = vault.data.snapshot.tasks.filter(t => t.assetId === a.id).length;
    b.append(node('strong', a.title), node('small', [a.registrationNumber || a.serialNumber, a.usageLabel, `${count} tasks`].filter(Boolean).join(' · ')));
    $('assets').append(b);
  }
  if (!shown.length) $('assets').append(node('p', 'No matching assets in this saved copy.'));
}
function render() {
  if (!vault) return;
  connection();
  const s = vault.data.snapshot;
  $('account').textContent = s.displayName;
  $('sync-status').textContent = `Copy updated ${new Date(s.savedAt).toLocaleString()} · ${vault.data.queue.length} waiting to sync`;
  $('workspace').hidden = Boolean(asset); $('gate').hidden = true; $('lock').hidden = false;
  renderQueue(); renderAssets();
}
function openAsset(a) {
  if (busy) return;
  asset = a; gps = null; clearPhotos(); $('capture-form').reset();
  $('asset-title').textContent = a.title;
  $('asset-details').textContent = [a.registrationNumber, a.usageLabel, a.note].filter(Boolean).join(' · ');
  $('tasks').replaceChildren();
  for (const t of vault.data.snapshot.tasks.filter(t => t.assetId === a.id)) {
    const card = node('article', '', 'task'); card.append(node('strong', t.title), node('p', [t.status, t.dueDate || (t.dueUsage != null ? `${t.dueUsage} ${t.usageMetric}` : '')].filter(Boolean).join(' · ')), node('p', t.notes)); $('tasks').append(card);
  }
  $('capture-form').hidden = !vault.data.snapshot.canRecordWork;
  $('gps-status').textContent = 'Capture your location at the asset before saving.';
  $('workspace').hidden = true; $('capture').hidden = false; announce(''); updateAction(); window.scrollTo(0, 0);
}
function currentReading(a) {
  return Math.max(a.usageReading ?? 0, ...vault.data.queue.filter(q => q.assetId === a.id).map(q => Number(q.payload.hours) || 0));
}
function updateAction() {
  const maintenance = $('action').value !== 'note';
  $('task-label').hidden = !maintenance;
  const reading = maintenance && ['hours', 'km'].includes(asset.usageMetric);
  $('usage-label').hidden = !reading; $('usage').required = reading;
  $('usage-label').firstChild.textContent = `Current ${asset.usageMetric === 'km' ? 'kilometre' : 'hour-meter'} reading`;
  $('usage').min = String(Math.ceil(currentReading(asset)));
  $('task').replaceChildren(new Option('Separate maintenance', ''));
  const type = $('action').value === 'Checked' ? 'checkup' : 'service';
  for (const task of vault.data.snapshot.tasks.filter(t => t.assetId === asset.id && t.maintenanceType === type)) {
    if (!vault.data.queue.some(q => q.payload.scheduledMaintenanceId === task.id)) $('task').add(new Option(task.title, task.id));
  }
}
async function sync() {
  const count = await syncVault(vault, render);
  render(); announce(count ? `${count} update${count === 1 ? '' : 's'} synced.` : 'Saved work is up to date.');
}
$('unlock-form').onsubmit = event => { event.preventDefault(); void run(async () => {
  await exclusiveTab();
  try {
    if (await hasVault()) vault = await unlockVault($('pin').value);
    else {
      if ($('pin').value !== $('confirm-pin').value) throw Error('The PINs do not match.');
      const snapshot = await api('/api/field-manager/offline');
      if (!('serviceWorker' in navigator)) throw Error('This browser cannot prepare offline work.');
      const registration = await navigator.serviceWorker.register('/field-manager-sw.js', { scope: '/field-manager' });
      const worker = registration.installing || registration.waiting;
      if (worker && worker.state !== 'activated') await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Offline screens could not be downloaded. Please try again.')), 30000);
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') { clearTimeout(timeout); resolve(); }
          if (worker.state === 'redundant') { clearTimeout(timeout); reject(Error('Offline setup failed. Please reconnect and retry.')); }
        });
      });
      if (!await caches.match('/field-manager/offline.html', { cacheName: 'aim4price-field-offline-shell-v1' })) throw Error('Offline screens are not ready. Reconnect and try again.');
      vault = await createVault($('pin').value, snapshot);
      await navigator.storage?.persist?.().catch(() => false);
    }
    $('pin').value = ''; $('confirm-pin').value = ''; announce('Offline copy unlocked.'); render();
    if (navigator.onLine) await sync();
  } catch (error) { if (!vault) { releaseLock?.(); releaseLock = null; } throw error; }
}); };
$('gps').onclick = () => {
  if (!navigator.geolocation) { announce('This device does not support GPS.'); return; }
  const requestedAsset = asset?.id;
  $('gps').disabled = true; $('gps-status').textContent = 'Getting location…';
  navigator.geolocation.getCurrentPosition(position => {
    $('gps').disabled = false;
    if (!asset || asset.id !== requestedAsset) return;
    gps = { latitude: position.coords.latitude, longitude: position.coords.longitude, gpsAccuracyMeters: position.coords.accuracy, clientCapturedAt: new Date().toISOString() };
    $('gps-status').textContent = `Location captured · accuracy ${Math.round(position.coords.accuracy)} m`;
  }, () => { $('gps').disabled = false; announce('Location could not be captured. Allow GPS and try again at the asset.'); }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
};
$('photos').onchange = () => {
  clearPhotos();
  const files = [...$('photos').files];
  if (files.length > MAX_PHOTOS || files.some(f => f.size > MAX_PHOTO_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))) {
    $('photos').value = ''; announce('Choose up to 4 JPG, PNG or WEBP photos, no larger than 5 MB each.'); return;
  }
  for (const file of files) { const url = URL.createObjectURL(file); photoUrls.push(url); const img = document.createElement('img'); img.src = url; img.alt = file.name; $('photo-preview').append(img); }
};
$('capture-form').onsubmit = event => { event.preventDefault(); void run(async () => {
  if (!gps || Date.now() - Date.parse(gps.clientCapturedAt) > 10 * 60 * 1000) throw Error('Capture a fresh GPS location before saving.');
  const details = $('notes').value.trim(); if (!details) throw Error('Describe the work or problem.');
  const maintenance = $('action').value !== 'note';
  const hours = maintenance && ['hours', 'km'].includes(asset.usageMetric) ? $('usage').value : '';
  if (maintenance && ['hours', 'km'].includes(asset.usageMetric) && (!hours || !Number.isFinite(Number(hours)) || Number(hours) < currentReading(asset))) throw Error('Enter a reading at least as high as the saved reading.');
  const photos = await Promise.all([...$('photos').files].map(file => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, dataUrl: reader.result }); reader.onerror = () => reject(Error('Could not read this photo.')); reader.readAsDataURL(file);
  })));
  const id = crypto.randomUUID();
  await queueWork(vault, { id, assetId: asset.id, code: asset.publicAssetCode, title: asset.title, createdAt: new Date().toISOString(), photos, maintenance,
    payload: { ...gps, clientEventId: `field-offline:${id}`, hours,
      note: maintenance ? `${$('action').value}\n${$('action').value === 'Checked' ? 'Checked items' : $('action').value === 'Repaired' ? 'Repair details' : 'Work done'}: ${details}` : `Notes/Problems: ${details}`,
      scheduledMaintenanceId: maintenance ? $('task').value || null : null,
      maintenanceDecision: maintenance ? ($('task').value ? 'scheduled' : 'separate') : null } });
  asset = null; gps = null; clearPhotos(); $('capture-form').reset(); $('capture').hidden = true; render(); announce('Saved on this phone. Waiting to sync.');
  if (navigator.onLine) await sync();
}); };
$('action').onchange = updateAction;
$('search').oninput = renderAssets;
$('back').onclick = () => { if (busy) return; if (($('notes').value || $('photos').files.length) && !confirm('Discard the unsaved form?')) return; asset = null; gps = null; clearPhotos(); $('capture-form').reset(); $('capture').hidden = true; render(); };
$('lock').onclick = () => { if (asset && ($('notes').value || $('photos').files.length) && !confirm('Lock and discard the unsaved form?')) return; lock(); };
$('refresh').onclick = () => run(async () => { await refreshVault(vault); render(); announce('Saved copy updated.'); });
$('sync').onclick = () => run(sync);
$('forget').onclick = () => run(async () => {
  if (vault.data.queue.length) throw Error('Sync or review every saved update before removing the offline copy.');
  if (!confirm('Remove the downloaded assets and tasks from this phone?')) return;
  await forgetVault(); busy = false; lock(); announce('Offline copy removed.');
});
window.addEventListener('online', () => { connection(); if (vault && !asset) void run(sync); });
window.addEventListener('offline', connection);
window.addEventListener('beforeunload', event => { if (asset && ($('notes').value || $('photos').files.length)) { event.preventDefault(); event.returnValue = ''; } });
for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, touch, { passive: true });
setInterval(() => { if (vault && !asset && !document.hidden && navigator.onLine && vault.data.queue.length) void run(sync); }, 60000);
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('aim4price-field-session') : null;
channel?.addEventListener('message', () => { if (busy) sessionChanged = true; else lock(); });
connection(); gate().catch(error => announce(error.message));
