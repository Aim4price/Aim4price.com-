import { TeamAccessError, type TeamPermissions, type TeamPermission } from './team-access-policy';
import type { FuelLedgerData, FuelLedgerEvent, FuelSlipTransaction } from './fuel-ledger';
import type { MyInvoiceListResult, MyInvoiceRecord } from './my-invoices';

function pick<T extends object>(record: T, keys: readonly string[]): T { return Object.fromEntries(keys.filter(key => key in record).map(key => [key, (record as Record<string, unknown>)[key]])) as T; }
const FuelLedgerEventKeys = ["id", "storageId", "storageName", "storagePublicCode", "eventType", "sourceType", "sourceLabel", "fuelSlipId", "fuelSlipTargetType", "fuelSlipSupplierName", "fuelSlipFuelType", "fuelSlipDocumentDate", "fuelSlipDocumentTime", "fuelSlipExtractionStatus", "fuelSlipReviewRequired", "fuelSlipReviewStatus", "totalAmount", "documentFileUrl", "paymentMethod", "cardNumberMasked", "assetId", "assetTitle", "assetSerialNumber", "assetPlateLabel", "litres", "storageLevelBefore", "storageLevelAfter", "assetFuelPercentBefore", "assetFuelPercentAfter", "assetUsageReading", "operatorName", "activityText", "workAreaText", "note", "latitude", "longitude", "locationText", "isLateEntry", "issueDate", "issueTime", "issueTimeRecorded", "issueAtIso", "entryAddedAtIso", "addedByUserId", "addedByName", "addedByEmail", "assetUsageMetric", "lateEntryReason", "evidenceType", "evidenceReference", "evidenceStatus", "evidenceFileName", "evidenceFileUrl", "tankBalanceTreatment", "linkedAdjustmentEventId", "linkedMissingEntryEventId", "adjustmentKind", "idempotencyKey", "gpsCaptureStatus", "workUseExcluded", "workUseExclusionReason", "createdAtIso"] as const;
const FuelSlipTransactionKeys = ["id", "userId", "sourceType", "sourceLabel", "targetType", "assetId", "assetTitle", "assetSerialNumber", "assetPlateLabel", "storageId", "storageName", "fuelStorageEventId", "assetInvoiceId", "invoiceDocumentId", "uploadId", "documentFileUrl", "originalFilename", "contentType", "byteSize", "supplierName", "supplierVatNumber", "slipNumber", "transactionNumber", "documentDate", "documentTime", "fuelType", "litres", "pricePerLitre", "totalAmount", "vatAmount", "vatIncluded", "vatRate", "paymentMethod", "cardType", "cardNumberMasked", "cardLast4", "merchantNumber", "terminalNumber", "siteNumber", "odometerReading", "hourMeterReading", "usageNotApplicable", "operatorName", "operatorNotApplicable", "activityText", "activityNotApplicable", "workAreaText", "workAreaNotApplicable", "note", "latitude", "longitude", "locationText", "clientCapturedAtIso", "gpsAccuracyMeters", "assetFuelPercentBefore", "assetFuelPercentAfter", "extractionStatus", "ocrConfidence", "reviewRequired", "rawExtractedText", "extractionWarnings", "workUseExcluded", "workUseExclusionReason", "recordStatus", "voidedAtIso", "voidedByName", "voidReason", "createdAtIso", "updatedAtIso"] as const;
const FuelLedgerStorageKeys = ["id", "userId", "name", "fuelType", "capacityLitres", "currentLitres", "stockPercent", "reorderLevelLitres", "locationLabel", "notes", "dipstickNote", "dipstickNoteUpdatedAtIso", "balanceVerificationStatus", "balanceNeedsChecking", "balanceCheckReason", "balanceCheckSourceEventId", "balanceCheckMarkedAtIso", "status", "publicFuelStorageCode", "pinEnabled", "hasPin", "pinUpdatedAtIso", "createdAtIso", "updatedAtIso"] as const;
const FuelLedgerAssetKeys = ["equipmentFamilyKey", "id", "title", "kind", "assetTypeLabel", "brandName", "modelName", "serialNumber", "plateLabel", "publicAssetCode", "hours", "fuelPercent", "yearModel", "condition", "selectedMethod", "currentValue", "canReceiveFuel", "isActive", "usageMetric", "lifeWorkedPercent", "workUseExcluded", "workUseExclusionReason"] as const;

/** Every opted-in endpoint is listed here. A new owner endpoint never becomes a team endpoint implicitly. */
export function teamWorkspacePermission(path: string, method: string): TeamPermission | null {
  if (path === '/api/maintenance') return method === 'GET' ? 'viewMaintenance' : null;
  if (path === '/api/maintenance/report') return method === 'GET' ? 'exportMaintenance' : null;
  if (/^\/api\/maintenance\/[^/]+\/complete$/.test(path)) return ['POST','PATCH'].includes(method) ? 'completeMaintenance' : null;
  if (path === '/api/documents' && method === 'POST') return 'uploadDocuments';
  if (path === '/api/fuel') return method === 'GET' ? 'viewFuel' : method === 'POST' ? 'manageFuelStorage' : null;
  if (path === '/api/fuel/report') return method === 'GET' ? 'exportFuel' : null;
  if (path === '/api/fuel/documents/download') return method === 'GET' ? 'viewFuelDocuments' : null;
  if (path === '/api/fuel/slips/export') return method === 'POST' ? 'exportFuel' : null;
  if (path === '/api/fuel/slips/upload') return method === 'POST' ? 'addFuel' : null;
  if (path === '/api/fuel/slips') return method === 'POST' ? 'addFuel' : null;
  if (/^\/api\/fuel\/slips\/[^/]+$/.test(path)) return method === 'PATCH' ? 'editFuel' : method === 'DELETE' ? 'voidFuel' : null;
  if (/^\/api\/fuel\/storage\/[^/]+$/.test(path)) return ['PATCH', 'DELETE'].includes(method) ? 'manageFuelStorage' : null;
  if (/^\/api\/my-invoices\/documents\/[^/]+\/download$/.test(path)) return method === 'GET' ? 'viewCostDocuments' : null;
  if (path === '/api/my-invoices/budgets/report') return method === 'GET' ? 'exportCosts' : null;
  if (path === '/api/my-invoices/budgets') return method === 'GET' ? 'viewBudgets' : method === 'POST' ? 'manageBudgets' : null;
  if (/^\/api\/my-invoices\/budgets\/[^/]+$/.test(path)) return ['PATCH','DELETE'].includes(method) ? 'manageBudgets' : null;
  if (path === '/api/my-invoices') return method === 'GET' ? 'viewCosts' : method === 'POST' ? 'addCosts' : null;
  if (path === '/api/my-invoices/report') return method === 'GET' ? 'exportCosts' : null;
  if (/^\/api\/my-invoices\/[^/]+$/.test(path)) return method === 'PATCH' ? 'editCosts' : method === 'DELETE' ? 'deleteCosts' : null;
  if (path === '/api/asset-map') return method === 'GET' ? 'viewMap' : null;
  if (path === '/api/asset-map/report') return method === 'GET' ? 'exportMap' : null;
  if (path === '/api/asset-register/location') return method === 'POST' ? 'updateLocation' : null;
  return null;
}
export function isTeamDocumentRead(path: string, method: string) { return method === 'GET' && (path === '/api/documents' || /^\/api\/documents\/[^/]+\/download$/.test(path)); }
export function assertTeamWorkspaceRequest(permissions: TeamPermissions, url: URL, method: string) {
  const permission = teamWorkspacePermission(url.pathname, method);
  if (!isTeamDocumentRead(url.pathname, method) && (!permission || !permissions[permission])) throw new TeamAccessError('Not available with your permissions.');
  if (['shareToken', 'accessId', 'accountantShareId', 'accountantRegisterId'].some(key => url.searchParams.has(key)))
    throw new TeamAccessError('Choose one workspace at a time.');
  if (url.pathname.endsWith('/report') && !['', 'pdf', 'html'].includes(url.searchParams.get('format') || ''))
    throw new TeamAccessError('Desktop reports are available as PDF only.');
}

export function teamFuelEventVisible(event: Pick<FuelLedgerEvent, 'assetId' | 'storageId'>, ids: Set<string>, permissions: TeamPermissions) {
  return event.assetId ? ids.has(event.assetId) : Boolean(event.storageId && permissions.viewFuelStorage);
}
export function projectTeamFuelEvent(event: FuelLedgerEvent, permissions: TeamPermissions, membershipId?: string): FuelLedgerEvent {
  const report = event as FuelLedgerEvent & {pricePerLitre?: number | null; vatAmount?: number | null; slipNote?: string};
  const safe = { ...pick(event, FuelLedgerEventKeys),
    pricePerLitre: permissions.viewFuelCosts ? report.pricePerLitre : null, vatAmount: permissions.viewFuelCosts ? report.vatAmount : null, slipNote: '',
    totalAmount: permissions.viewFuelCosts ? event.totalAmount : null,
    documentFileUrl: permissions.viewFuelDocuments && event.documentFileUrl ? `/api/fuel/documents/download?source=${encodeURIComponent(event.documentFileUrl)}${membershipId ? `&desktopMembershipId=${encodeURIComponent(membershipId)}` : ''}` : '', evidenceFileUrl: '', evidenceFileName: '', evidenceReference: '',
    paymentMethod: '', cardNumberMasked: '', addedByEmail: '',
    note: permissions.viewFuelCosts ? event.note : '', lateEntryReason: '', workUseExclusionReason: '',
    storageId: permissions.viewFuelStorage ? event.storageId : '',
    storageName: permissions.viewFuelStorage ? event.storageName : '',
    storagePublicCode: '',
    storageLevelBefore: permissions.viewFuelStorage ? event.storageLevelBefore : null,
    storageLevelAfter: permissions.viewFuelStorage ? event.storageLevelAfter : null,
    latitude: permissions.viewMap ? event.latitude : null,
    longitude: permissions.viewMap ? event.longitude : null,
    locationText: permissions.viewMap ? event.locationText : '',
    workAreaText: permissions.viewMap ? event.workAreaText : '',
  };
  return safe;
}
export function projectTeamFuelSlip(slip: FuelSlipTransaction, permissions: TeamPermissions, membershipId?: string): FuelSlipTransaction {
  return { ...pick(slip, FuelSlipTransactionKeys),
    pricePerLitre: permissions.viewFuelCosts ? slip.pricePerLitre : null,
    totalAmount: permissions.viewFuelCosts ? slip.totalAmount : null,
    vatAmount: permissions.viewFuelCosts ? slip.vatAmount : null,
    documentFileUrl: permissions.viewFuelDocuments && slip.documentFileUrl ? `/api/fuel/documents/download?source=${encodeURIComponent(slip.documentFileUrl)}${membershipId ? `&desktopMembershipId=${encodeURIComponent(membershipId)}` : ''}` : '', uploadId: '', invoiceDocumentId: '', originalFilename: '', rawExtractedText: '', extractionWarnings: [],
    paymentMethod: '', cardType: '', cardNumberMasked: '', cardLast4: '', merchantNumber: '', terminalNumber: '',
    note: permissions.viewFuelCosts ? slip.note : '', voidReason: '', workUseExclusionReason: '',
    storageId: permissions.viewFuelStorage ? slip.storageId : '',
    storageName: permissions.viewFuelStorage ? slip.storageName : '',
    latitude: permissions.viewMap ? slip.latitude : null,
    longitude: permissions.viewMap ? slip.longitude : null,
    locationText: permissions.viewMap ? slip.locationText : '',
    workAreaText: permissions.viewMap ? slip.workAreaText : '',
  };
}
export function projectTeamFuelLedger(ledger: FuelLedgerData, ids: Set<string>, permissions: TeamPermissions, membershipId?: string): FuelLedgerData {
  const assets = ledger.assets.filter(asset => ids.has(asset.id)).map(asset => ({ ...pick(asset, FuelLedgerAssetKeys), publicAssetCode: '', currentValue: permissions.viewValues ? asset.currentValue : null }));
  const storages = permissions.viewFuelStorage ? ledger.storages.map(storage => ({ ...pick(storage, FuelLedgerStorageKeys), balanceCheckReason: '', notes: '', dipstickNote: '', publicFuelStorageCode: '', pinEnabled: false, hasPin: false, pinUpdatedAtIso: null })) : [];
  const recentEvents = ledger.recentEvents.filter(event => teamFuelEventVisible(event, ids, permissions)).map(event => projectTeamFuelEvent(event, permissions, membershipId));
  const recentFuelSlips = ledger.recentFuelSlips.filter(slip => slip.targetType === 'asset' ? ids.has(slip.assetId) : permissions.viewFuelStorage).map(slip => projectTeamFuelSlip(slip, permissions, membershipId));
  const totalCapacityLitres = storages.reduce((sum, tank) => sum + (tank.capacityLitres || 0), 0);
  const currentLitres = storages.reduce((sum, tank) => sum + tank.currentLitres, 0);
  const recent = recentEvents.filter(event => Date.parse(event.createdAtIso) >= Date.now() - 30 * 86400000);
  return { assets, storages, recentEvents, recentFuelSlips, summary: {
    totalStorageUnits: storages.length, totalCapacityLitres, currentLitres,
    currentStockPercent: totalCapacityLitres ? currentLitres / totalCapacityLitres * 100 : null,
    lowStorageCount: storages.filter(tank => tank.reorderLevelLitres !== null && tank.currentLitres <= tank.reorderLevelLitres).length,
    issuedLitres30Days: recent.filter(event => event.eventType === 'asset_issue').reduce((sum, event) => sum + event.litres, 0),
    filledLitres30Days: recent.filter(event => event.eventType === 'stock_in').reduce((sum, event) => sum + event.litres, 0),
    activeAssetsCount: assets.filter(asset => asset.isActive).length,
  } };
}
export function projectTeamCostRecord(invoice: MyInvoiceRecord, permissions: TeamPermissions): MyInvoiceRecord {
  const documentsAllowed = permissions.viewCostDocuments && (invoice.source !== 'fuel_slip' || permissions.viewFuelDocuments);
  return { ...invoice, assetValue: permissions.viewValues ? invoice.assetValue : 0, document: documentsAllowed && invoice.document ? { ...invoice.document, rawExtractedText: '', extractionWarnings: [], uploadId: '' } : null, invoiceDocumentId: documentsAllowed ? invoice.invoiceDocumentId : null };
}
export function projectTeamCosts(data: MyInvoiceListResult, ids: Set<string>, permissions: TeamPermissions, summarize: (invoices: MyInvoiceRecord[]) => MyInvoiceListResult['summary']): MyInvoiceListResult {
  const invoices = data.invoices.filter(invoice => ids.has(invoice.assetId) && (permissions.viewFuelCosts || invoice.source !== 'fuel_slip')).map(invoice => projectTeamCostRecord(invoice, permissions));
  return { assets: data.assets.filter(asset => ids.has(asset.id)).map(asset => ({ ...asset, value: permissions.viewValues ? asset.value : 0 })), invoices, summary: summarize(invoices) };
}
