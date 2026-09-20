import type { OfflineAccess } from './app-offline-access';
import { listFieldManagerAssets, listFieldManagerFuelStorages, ensureFieldManagerAssetPublicCodes } from './field-manager';
import { listAssetRegisters, ensureAssetRegisterTables } from './asset-registers';
import { listAssetRegisterItems } from './asset-register-db';
import { ownerAppCanAccessAsset } from './owner-app-access';
import { resolveAssetUsage } from './asset-usage';
import { listAssetMaintenanceRecords } from './asset-maintenance';
import { getMaintenanceCatalogue } from './maintenance-catalogue-db';
import { resolveMaintenanceChecklist } from './maintenance-catalogue';
import { listFuelAssetsForUser } from './fuel-ledger';
import { listDealerTrackedAssets } from './dealer-maintenance-tracker';
import { listPublishedMarketplaceAssetListings } from './marketplace-db';
import { listAssetLeadsForUser } from './partner-access';
import { listOfflineNotes } from './app-offline-notes';
export async function buildAppOfflineSnapshot(access: OfflineAccess) {
  const base = { ok: true, app: access.app, identity: access.identity, displayName: access.displayName, savedAt: new Date().toISOString(),
    canRecordWork: access.canWork, canRecordFuel: access.canFuel, canRefillFuel: access.canRefill };
  if (access.app === 'dealer' || access.app === 'middleman') {
    const [tracked, listings, leads, notes, catalogue] = await Promise.all([
      access.canWork ? listDealerTrackedAssets(access.userId) : [],
      access.canShowroom ? listPublishedMarketplaceAssetListings({ viewerUserId: access.userId, sellerUserId: access.userId, exposeContact: false }) : [],
      access.canLeads ? listAssetLeadsForUser(access.userId) : [], listOfflineNotes(access), getMaintenanceCatalogue(),
    ]);
    return { ...base, canRecordNotes: true, storages: [], notes,
      assets: tracked.map(a => ({ id: a.accessId, accessId: a.accessId, title: a.assetTitle, publicAssetCode: '', serialNumber: a.serialNumber, registrationNumber: a.registrationNumber,
        note: a.ownerName, usageReading: a.currentUsage, usageMetric: a.usageMetric, usageLabel: `${a.currentUsage ?? '—'} ${a.usageMetric}`, checklist: resolveMaintenanceChecklist(a, catalogue) })),
      tasks: tracked.flatMap(a => a.openMaintenanceRecords.map(t => ({ ...t, assetId: a.accessId, status: t.computedStatusLabel }))),
      listings: listings.map(l => ({ id: l.id, title: l.title, note: l.description, price: l.askingPriceExVat, year: l.yearModel, location: l.location })),
      leads: leads.filter(l => l.partnerUserId === access.userId).map(l => ({ id: l.id, title: String(l.assetSnapshot.title || 'Asset enquiry'), note: l.ownerMessage, name: l.ownerContactName, phone: l.ownerContactPhone, status: l.status })),
    };
  }
  if (access.app === 'owner') { await ensureAssetRegisterTables(); await ensureFieldManagerAssetPublicCodes(access.userId); }
  const catalogue = await getMaintenanceCatalogue();
  const assets = access.app === 'field'
    ? (await listFieldManagerAssets(access.userId, access.managerId!)).filter(a => a.qrStatus === 'active').map(a => ({ ...a, checklist: resolveMaintenanceChecklist(a, catalogue) }))
    : (await Promise.all((await listAssetRegisters(access.userId)).map(r => listAssetRegisterItems(access.userId, r.id)))).flat()
      .filter(a => ownerAppCanAccessAsset(access.owner!, a.id) && a.qrStatus === 'active').map(a => {
        const usage = resolveAssetUsage({ kind: a.kind, hours: a.hours, lifeWorkedPercent: a.lifeWorkedPercent, specsJson: a.specsJson });
        return { id: a.id, title: a.title, publicAssetCode: a.publicAssetCode, serialNumber: a.serialNumber, registrationNumber: a.licenseRegistrationNumber,
          note: a.note, usageReading: usage.value, usageMetric: usage.metric, usageLabel: `${usage.value ?? '—'} ${usage.metric}`, checklist: resolveMaintenanceChecklist(a, catalogue) };
      });
  const ids = new Set(assets.map(a => a.id));
  const [records, fuelAssets, storages] = await Promise.all([listAssetMaintenanceRecords(access.userId),
    access.canFuel ? listFuelAssetsForUser(access.userId) : [],
    access.canFuel || access.canRefill ? listFieldManagerFuelStorages(access.userId, access.managerId) : []]);
  const fuel = new Map(fuelAssets.filter(a => a.isActive && a.canReceiveFuel && !a.workUseExcluded).map(a => [a.id, a]));
  return { ...base, canRecordNotes: false, notes: [], listings: [], leads: [],
    assets: assets.map(a => ({ id: a.id, title: a.title, publicAssetCode: a.publicAssetCode, serialNumber: a.serialNumber, registrationNumber: a.registrationNumber, note: a.note,
      usageReading: a.usageReading, usageMetric: a.usageMetric, usageLabel: a.usageLabel, checklist: a.checklist,
      canReceiveFuel: fuel.has(a.id), fuelPercent: fuel.get(a.id)?.fuelPercent ?? null })),
    tasks: records.filter(r => ids.has(r.assetId) && r.status === 'upcoming' && (access.app === 'owner' || !r.assignedFieldManagerId || r.assignedFieldManagerId === access.managerId))
      .map(t => ({ id: t.id, assetId: t.assetId, title: t.title, notes: t.notes, maintenanceType: t.maintenanceType, dueDate: t.dueDate, dueUsage: t.dueUsage, usageMetric: t.usageMetric, status: t.computedStatusLabel })),
    storages: storages.map(s => ({ id: s.id, name: s.name, publicFuelStorageCode: s.publicFuelStorageCode, fuelType: s.fuelType, currentLitres: s.currentLitres })),
  };
}
