import { api, hasVault, createVault, unlockVault, saveVault, refreshVault, queueWork, replaceQueuedWork, syncVault, forgetVault, MAX_PHOTOS, MAX_PHOTO_BYTES } from './store.mjs';
import { config } from './config.mjs';
let editing = null, fuelGps = null, activePanel = null;
const $ = id => document.getElementById(id);
let vault = null, asset = null, gps = null, busy = false, sessionChanged = false, releaseLock = null, idleTimer, photoUrls = [];
const announce = text => { $('notice').textContent = text; };
function node(tag, text, className) { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; }
function button(text, action) { const b = node('button', text); b.type = 'button'; b.onclick = action; return b; }
function connection() { $('connection').textContent = navigator.onLine ? 'Online' : 'Offline · working from this phone'; }
function clearPhotos() { photoUrls.forEach(URL.revokeObjectURL); photoUrls = []; $('photo-preview').replaceChildren(); }
function lock() {
  if (busy) return;
  vault = null; asset = null; gps = null; fuelGps = null; editing = null; activePanel = null;
  for (const id of ['fuel-panel', 'note-panel']) $(id).hidden = true;
  for (const id of ['commercial', 'synced-notes']) $(id).replaceChildren();
  $('fuel-form').reset(); $('note-form').reset(); $('fuel-asset').replaceChildren(); $('fuel-tank').replaceChildren();
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
    navigator.locks.request('aim4price-' + config.app + '-offline-vault', { ifAvailable: true }, async held => {
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
  $('gate-copy').textContent = exists ? 'Enter the offline PIN for the saved copy on this phone.' : 'Download your available work while connected. Your offline PIN protects the copy on this phone.';
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
    if (work.kind?.startsWith('fuel-')) card.append(node('p', [work.kind.replace('fuel-', '').replace('-', ' '), work.payload.litres ? `${work.payload.litres} L` : '', work.payload.assetUsageReading != null ? `Reading: ${work.payload.assetUsageReading}` : '', work.payload.supplierName, work.payload.totalAmount ? `R ${work.payload.totalAmount}` : ''].filter(Boolean).join(' · ')));
    if (work.blocked) card.append(node('p', 'Needs review. No newer work will sync until this is resolved. Check the record or permissions online, then retry.'));
    if (work.blocked && !work.uncertain) card.append(button('Edit saved update', () => editWork(work)));
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
  $('workspace').hidden = Boolean(asset || activePanel); $('gate').hidden = true; $('lock').hidden = false;
  renderQueue(); renderAssets(); renderCommercial();
  $('new-note').hidden = !s.canRecordNotes; $('open-fuel').hidden = !(s.canRecordFuel || s.canRefillFuel);
}
function openAsset(a) {
  if (busy) return;
  asset = a; activePanel = 'work'; gps = null; clearPhotos(); $('capture-form').reset();
  $('asset-title').textContent = a.title;
  $('asset-details').textContent = [a.registrationNumber, a.usageLabel, a.note].filter(Boolean).join(' · ');
  $('tasks').replaceChildren();
  for (const t of vault.data.snapshot.tasks.filter(t => t.assetId === a.id)) {
    const card = node('article', '', 'task'); card.append(node('strong', t.title), node('p', [t.status, t.dueDate || (t.dueUsage != null ? `${t.dueUsage} ${t.usageMetric}` : '')].filter(Boolean).join(' · ')), node('p', t.notes)); $('tasks').append(card);
  }
  $('capture-form').hidden = !vault.data.snapshot.canRecordWork;
  for (const option of $('action').options) option.hidden = config.app === 'dealer' && ['note','Repaired'].includes(option.value);
  if (config.app === 'dealer') $('action').value = 'Serviced';
  $('photos').closest('label').hidden = config.app === 'dealer';
  $('gps-status').textContent = 'Capture your location at the asset before saving.';
  $('workspace').hidden = true; $('capture').hidden = false; announce(''); updateAction(); window.scrollTo(0, 0);
}
function currentReading(a) {
  return Math.max(a.usageReading ?? 0, ...vault.data.queue.filter(q => q.assetId === a.id && q.id !== editing?.id).map(q => Number(q.payload.hours) || 0));
}
function updateAction() {
  const maintenance = $('action').value !== 'note';
  $('company-label').hidden = $('mechanic-label').hidden = $('action').value !== 'Serviced';
  $('company').required = $('mechanic').required = $('action').value === 'Serviced';
  renderChecklist();
  $('task-label').hidden = !maintenance;
  const reading = maintenance && ['hours', 'km'].includes(asset.usageMetric);
  $('usage-label').hidden = !reading; $('usage').required = reading;
  $('usage-label').firstChild.textContent = `Current ${asset.usageMetric === 'km' ? 'kilometre' : 'hour-meter'} reading`;
  $('usage').min = String(Math.ceil(currentReading(asset)));
  $('task').replaceChildren(new Option(config.app === 'dealer' ? 'Choose maintenance task' : 'Separate maintenance', ''));
  $('task').required = config.app === 'dealer';
  const type = $('action').value === 'Checked' ? 'checkup' : 'service';
  for (const task of vault.data.snapshot.tasks.filter(t => t.assetId === asset.id && t.maintenanceType === type)) {
    if (!vault.data.queue.some(q => q.id !== editing?.id && (q.payload.scheduledMaintenanceId || q.payload.maintenanceId) === task.id)) $('task').add(new Option(task.title, task.id));
  }
}
function renderChecklist() {
  const mode = $('action').value;
  const items = asset?.checklist?.items || [];
  $('checklist').hidden = !items.length || !['Checked', 'Serviced', 'Repaired'].includes(mode);
  $('checklist-title').textContent = asset?.checklist?.label || 'Work items';
  $('checklist-items').replaceChildren();
  if ($('checklist').hidden) return;
  for (const item of items) {
    const label = node('label', '', 'checklist-option');
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = item.id;
    label.append(input, node('span', mode === 'Checked' ? item.checkLabel : mode === 'Repaired' ? item.label : item.serviceLabel));
    $('checklist-items').append(label);
  }
}
function selectedWork() {
  const ids = new Set([...$('checklist-items').querySelectorAll('input:checked')].map(i => i.value));
  const mode = $('action').value === 'Checked' ? 'checked' : $('action').value === 'Repaired' ? 'repaired' : 'serviced';
  const c = asset?.checklist;
  return c ? [{ version: c.version, family: c.family, profileKey: c.profileKey, mode,
    items: c.items.filter(i => ids.has(i.id)).map(i => ({ id: i.id, label: mode === 'checked' ? i.checkLabel : mode === 'repaired' ? i.label : i.serviceLabel, action: mode })) }] : [];
}
async function sync() {
  const count = await syncVault(vault, render);
  render(); announce(vault.data.lastSyncMessage || (count ? `${count} update${count === 1 ? '' : 's'} synced.` : 'Saved work is up to date.'));
}
$('unlock-form').onsubmit = event => { event.preventDefault(); void run(async () => {
  await exclusiveTab();
  try {
    if (await hasVault()) vault = await unlockVault($('pin').value);
    else {
      if ($('pin').value !== $('confirm-pin').value) throw Error('The PINs do not match.');
      const snapshot = await api(config.api);
      if (!('serviceWorker' in navigator)) throw Error('This browser cannot prepare offline work.');
      const registration = await navigator.serviceWorker.register(config.worker, { scope: config.root, updateViaCache: 'none' });
      const worker = registration.installing || registration.waiting;
      if (worker && worker.state !== 'activated') await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Offline screens could not be downloaded. Please try again.')), 30000);
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') { clearTimeout(timeout); resolve(); }
          if (worker.state === 'redundant') { clearTimeout(timeout); reject(Error('Offline setup failed. Please reconnect and retry.')); }
        });
      });
      if (!await caches.match(config.root + '/offline.html', { cacheName: config.cache })) throw Error('Offline screens are not ready. Reconnect and try again.');
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
  const details = $('notes').value.trim();
  const maintenanceWork = selectedWork();
  const selectedLabels = maintenanceWork.flatMap(s => s.items.map(i => i.label));
  if ((!details && !selectedLabels.length) || ($('action').value === 'Repaired' && !details)) throw Error('Select work items or describe the work or problem.');
  const maintenance = $('action').value !== 'note';
  const hours = maintenance && ['hours', 'km'].includes(asset.usageMetric) ? $('usage').value : '';
  if (maintenance && ['hours', 'km'].includes(asset.usageMetric) && (!hours || !Number.isFinite(Number(hours)) || Number(hours) < currentReading(asset))) throw Error('Enter a reading at least as high as the saved reading.');
  const photos = $('photos').files.length ? await Promise.all([...$('photos').files].map(file => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, dataUrl: reader.result }); reader.onerror = () => reject(Error('Could not read this photo.')); reader.readAsDataURL(file);
  }))) : editing?.photos || [];
  const id = editing?.id || crypto.randomUUID();
  if (config.app === 'dealer' && !$('task').value) throw Error('Choose a saved maintenance task.');
  await storeWork({ kind: config.app === 'dealer' ? 'dealer-maintenance' : 'work', id, assetId: asset.id, code: asset.publicAssetCode, title: asset.title, createdAt: new Date().toISOString(), photos, maintenance,
    payload: { ...gps, maintenanceWork: maintenance ? maintenanceWork : undefined, clientEventId: editing?.payload.clientEventId || `app-offline:${id}`, hours,
      note: $('action').value === 'Repaired' ? `Repaired\nRepair details: ${details}${selectedLabels.length ? `\nComponents: ${selectedLabels.join(', ')}` : ''}` : maintenance ? `${$('action').value}\n${$('action').value === 'Checked' ? 'Checked items' : $('action').value === 'Repaired' ? 'Repair details' : 'Work done'}: ${selectedLabels.join(', ') || details}${selectedLabels.length && details ? `\nNotes/Problems: ${details}` : ''}${$('action').value === 'Serviced' ? `\nCompany: ${$('company').value.trim()}\nMechanic: ${$('mechanic').value.trim()}` : ''}` : `Notes/Problems: ${details}`,
      scheduledMaintenanceId: maintenance ? $('task').value || null : null,
      maintenanceDecision: maintenance ? ($('task').value ? 'scheduled' : 'separate') : null, maintenanceId: $('task').value, confirmedComplete: true } });
  asset = null; activePanel = null; editing = null; gps = null; clearPhotos(); $('capture-form').reset(); $('capture').hidden = true; render(); announce('Saved on this phone. Waiting to sync.');
  if (navigator.onLine) await sync();
}); };
$('action').onchange = updateAction;
$('search').oninput = renderAssets;
$('back').onclick = () => { if (busy) return; if (($('notes').value || $('photos').files.length || $('checklist-items').querySelector('input:checked')) && !confirm('Discard the unsaved form?')) return; asset = null; activePanel = null; editing = null; gps = null; clearPhotos(); $('capture-form').reset(); $('capture').hidden = true; render(); };
$('lock').onclick = () => { if (activePanel && activePanel !== 'work' && !confirm('Lock and discard this unsaved form?')) return; if (asset && ($('notes').value || $('photos').files.length || $('checklist-items').querySelector('input:checked')) && !confirm('Lock and discard the unsaved form?')) return; lock(); };
$('refresh').onclick = () => run(async () => { await refreshVault(vault); render(); announce('Saved copy updated.'); });
$('sync').onclick = () => run(sync);
$('forget').onclick = () => run(async () => {
  if (vault.data.queue.length) throw Error('Sync or review every saved update before removing the offline copy.');
  if (!confirm('Remove the downloaded assets and tasks from this phone?')) return;
  await forgetVault(); busy = false; lock(); announce('Offline copy removed.');
});
window.addEventListener('online', () => { connection(); if (vault && !asset && !activePanel) void run(sync); });
window.addEventListener('offline', connection);
window.addEventListener('beforeunload', event => { if (asset && ($('notes').value || $('photos').files.length || $('checklist-items').querySelector('input:checked'))) { event.preventDefault(); event.returnValue = ''; } });
for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, touch, { passive: true });
setInterval(() => { if (vault && !asset && !activePanel && !document.hidden && navigator.onLine && vault.data.queue.length) void run(sync); }, 60000);
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(config.channel) : null;
channel?.addEventListener('message', () => { if (busy) sessionChanged = true; else lock(); });
$('app-label').textContent = config.label + ' App · saved work';
connection(); gate().catch(error => announce(error.message));

async function storeWork(work) {
  if (editing) await replaceQueuedWork(vault, editing.id, work);
  else await queueWork(vault, work);
}
function renderCommercial() {
  $('commercial').replaceChildren(); $('synced-notes').replaceChildren();
  for (const [label, rows] of [['Saved showroom', vault.data.snapshot.listings || []], ['Saved leads', vault.data.snapshot.leads || []]]) {
    if (!rows.length) continue;
    $('commercial').append(node('h2', label));
    for (const row of rows) {
      const card = node('article');
      card.append(node('strong', row.title), node('p', row.note || ''), node('small', [row.name, row.phone, row.status, row.location, row.year, row.price != null ? `R ${Number(row.price).toLocaleString('en-ZA')} excl. VAT · saved price` : ''].filter(Boolean).join(' · ')), button('Add follow-up note', () => openNote(row.title)));
      $('commercial').append(card);
    }
  }
  if ((vault.data.snapshot.notes || []).length) $('synced-notes').append(node('h2', 'Synced private notes'));
  for (const note of vault.data.snapshot.notes || []) {
    const card = node('article'); card.append(node('strong', note.title), node('p', note.note), node('small', new Date(note.capturedAt).toLocaleString())); $('synced-notes').append(card);
  }
}
function openNote(title = '') {
  activePanel = 'note'; $('workspace').hidden = true; $('note-panel').hidden = false; $('note-form').reset(); $('note-title').value = title; announce('');
}
$('new-note').onclick = () => openNote();
$('note-form').onsubmit = event => { event.preventDefault(); void run(async () => {
  const id = editing?.id || crypto.randomUUID();
  const title = $('note-title').value.trim(), note = $('note-text').value.trim();
  if (!title || !note) throw Error('Enter a title and note.');
  await storeWork({ id, kind: 'private-note', title, assetId: '', code: '', photos: [], createdAt: new Date().toISOString(), payload: { title, note, clientEventId: editing?.payload.clientEventId || `app-offline:${id}`, clientCapturedAt: editing?.payload.clientCapturedAt || new Date().toISOString() } });
  closePanel(); announce('Saved on this phone. Waiting to sync.'); if (navigator.onLine) await sync();
}); };
function closePanel() {
  activePanel = null; editing = null; fuelGps = null;
  $('fuel-panel').hidden = $('note-panel').hidden = true;
  $('fuel-form').reset(); $('note-form').reset(); render();
}
function confirmBack() { if (confirm('Leave this form? Unsaved changes will be discarded.')) closePanel(); }
$('fuel-back').onclick = confirmBack; $('note-back').onclick = confirmBack;
$('open-fuel').onclick = () => openFuel();
function openFuel() {
  activePanel = 'fuel'; $('workspace').hidden = true; $('fuel-panel').hidden = false; $('fuel-form').reset(); fuelGps = null;
  $('fuel-gps-status').textContent = 'Capture your location before saving.';
  $('fuel-asset').replaceChildren(...vault.data.snapshot.assets.filter(a => a.canReceiveFuel).map(a => new Option(a.title, a.id)));
  $('fuel-tank').replaceChildren(...(vault.data.snapshot.storages || []).map(t => new Option(`${t.name} · ${t.currentLitres} L in saved copy`, t.publicFuelStorageCode)));
  for (const o of $('fuel-action').options) o.hidden = ['fuel-issue','fuel-slip'].includes(o.value) ? !vault.data.snapshot.canRecordFuel : !vault.data.snapshot.canRefillFuel;
  $('fuel-action').value = vault.data.snapshot.canRecordFuel ? ((vault.data.snapshot.storages || []).length ? 'fuel-issue' : 'fuel-slip') : 'fuel-refill';
  $('slip-date').value = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
  updateFuel(); announce('');
}
function updateFuel() {
  const k = $('fuel-action').value, issue = k === 'fuel-issue', slip = k === 'fuel-slip', assetMode = issue || slip;
  const a = vault.data.snapshot.assets.find(a => a.id === $('fuel-asset').value);
  const meter = a && ['hours','km'].includes(a.usageMetric);
  for (const [id, show] of [['fuel-asset-label',assetMode],['fuel-tank-label',!slip],['fuel-litres-label',k !== 'fuel-dipstick'],['fuel-levels',assetMode],['fuel-reading-label',assetMode && meter],['slip-fields',slip],['fuel-work',assetMode]]) $(id).hidden = !show;
  for (const id of ['fuel-asset','fuel-tank','fuel-litres','fuel-before','fuel-after','fuel-reading','station','slip-date','fuel-total','fuel-activity','fuel-area']) {
    const field = $(id); field.required = !field.closest('[hidden]'); field.disabled = !!field.closest('[hidden]');
  }
  $('fuel-notes').required = k === 'fuel-dipstick';
  $('fuel-reading').min = String(a ? currentReading(a) : 0);
}
$('fuel-action').onchange = updateFuel; $('fuel-asset').onchange = updateFuel;
$('fuel-gps').onclick = () => {
  if (!navigator.geolocation) return announce('GPS is not available on this phone.');
  const panel = activePanel;
  navigator.geolocation.getCurrentPosition(p => {
    if (!vault || activePanel !== panel) return;
    fuelGps = { latitude: p.coords.latitude, longitude: p.coords.longitude, gpsAccuracyMeters: p.coords.accuracy, clientCapturedAt: new Date().toISOString() };
    $('fuel-gps-status').textContent = `Location captured · accuracy ${Math.round(p.coords.accuracy)} m`;
  }, () => announce('Allow location access and capture GPS again.'), { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
};
function readPhoto(file) { return new Promise((resolve,reject) => {
  if (!file.size || file.size > MAX_PHOTO_BYTES || !['image/jpeg','image/png','image/webp'].includes(file.type)) return reject(Error('Choose a JPG, PNG or WEBP photo up to 5 MB.'));
  const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, dataUrl: reader.result }); reader.onerror = () => reject(Error('Could not read photo.')); reader.readAsDataURL(file);
}); }
$('fuel-form').onsubmit = event => { event.preventDefault(); void run(async () => {
  if (!fuelGps || Date.now() - Date.parse(fuelGps.clientCapturedAt) > 600000) throw Error('Capture a fresh GPS location before saving.');
  const kind = $('fuel-action').value, assetMode = ['fuel-issue','fuel-slip'].includes(kind);
  const a = vault.data.snapshot.assets.find(a => a.id === $('fuel-asset').value);
  if (assetMode && !a?.canReceiveFuel) throw Error('Choose an included fuel asset.');
  if (kind !== 'fuel-slip' && !$('fuel-tank').value) throw Error('Choose a saved storage tank.');
  const meter = assetMode && ['hours','km'].includes(a.usageMetric);
  const reading = meter ? Number($('fuel-reading').value) : null;
  if (meter && (!$('fuel-reading').value || reading < currentReading(a))) throw Error('The reading cannot be lower than the saved reading.');
  const before = Number($('fuel-before').value), after = Number($('fuel-after').value);
  if (assetMode && (after < before || before < 0 || after > 100)) throw Error('Check the fuel percentages before and after filling.');
  const litres = Number($('fuel-litres').value), total = Number($('fuel-total').value);
  if (kind !== 'fuel-dipstick' && !(litres > 0)) throw Error('Enter litres.');
  const note = $('fuel-notes').value.trim();
  const payload = { ...fuelGps, assetUsageReading: reading, assetUsageMetric: meter ? a.usageMetric : 'none', hours: reading,
    litres, assetFuelPercentBefore: before, assetFuelPercentAfter: after, operatorName: vault.data.snapshot.displayName,
    activityText: $('fuel-activity').value.trim(), workAreaText: $('fuel-area').value.trim(), note, dipstickNote: note };
  if (kind === 'fuel-slip') Object.assign(payload, { supplierName: $('station').value.trim(), slipNumber: $('slip-number').value.trim(), documentDate: $('slip-date').value, fuelType: $('fuel-type').value,
    totalAmount: total, pricePerLitre: total / litres, usageNotApplicable: !meter, hourMeterReading: a.usageMetric === 'hours' ? reading : null, odometerReading: a.usageMetric === 'km' ? reading : null });
  const id = editing?.id || crypto.randomUUID(); payload.clientEventId = editing?.payload.clientEventId || `app-offline:${id}`;
  const file = $('slip-photo').files[0];
  const photos = kind === 'fuel-slip' ? (file ? [await readPhoto(file)] : editing?.photos || []) : [];
  await storeWork({ id, kind, title: assetMode ? a.title : $('fuel-tank').selectedOptions[0].textContent, assetId: assetMode ? a.id : '', code: kind === 'fuel-slip' ? a.publicAssetCode : $('fuel-tank').value,
    photos, payload, createdAt: new Date().toISOString() });
  closePanel(); announce('Saved on this phone. Waiting to sync.'); if (navigator.onLine) await sync();
}); };
function editWork(work) {
  if (busy) return;
  const kind = work.kind || 'work';
  if (kind === 'private-note') { openNote(work.payload.title); $('note-text').value = work.payload.note; }
  else if (kind.startsWith('fuel-')) {
    openFuel(); $('fuel-action').value = kind; $('fuel-asset').value = work.assetId; $('fuel-tank').value = work.code;
    const p = work.payload;
    for (const [id, key] of Object.entries({ 'fuel-litres':'litres','fuel-before':'assetFuelPercentBefore','fuel-after':'assetFuelPercentAfter','fuel-reading':'assetUsageReading','station':'supplierName','slip-date':'documentDate','fuel-type':'fuelType','fuel-total':'totalAmount','slip-number':'slipNumber','fuel-activity':'activityText','fuel-area':'workAreaText','fuel-notes':'note' })) $(id).value = p[key] ?? '';
  } else {
    const a = vault.data.snapshot.assets.find(a => a.id === work.assetId);
    if (!a) return announce('This asset is no longer in your saved copy. Review the original entry before removing it.');
    openAsset(a);
    $('action').value = /^(Serviced|Checked|Repaired)/.exec(work.payload.note)?.[1] || 'note';
    $('notes').value = /^Notes\/Problems:\s*(.*)$/m.exec(work.payload.note)?.[1] || /^(?:Work done|Checked items|Repair details):\s*(.*)$/m.exec(work.payload.note)?.[1] || work.payload.note;
    $('company').value = /^Company:\s*(.+)$/m.exec(work.payload.note)?.[1] || '';
    $('mechanic').value = /^Mechanic:\s*(.+)$/m.exec(work.payload.note)?.[1] || '';
  }
  editing = work;
  if (kind.startsWith('fuel-')) updateFuel();
  else if (kind !== 'private-note') { updateAction();
    const ids = new Set((work.payload.maintenanceWork || []).flatMap(s => s.items.map(i => i.id)));
    for (const input of $('checklist-items').querySelectorAll('input')) input.checked = ids.has(input.value);
    $('task').value = work.payload.scheduledMaintenanceId || work.payload.maintenanceId || ''; $('usage').value = work.payload.hours || ''; }
  announce('Editing a rejected update. Existing photos are kept unless you choose replacements. Capture GPS again before saving.');
}
window.addEventListener('beforeunload', event => { if (activePanel && activePanel !== 'work') { event.preventDefault(); event.returnValue = ''; } });
