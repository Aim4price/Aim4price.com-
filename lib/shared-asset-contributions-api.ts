import { getAssetRegisterItemById } from './asset-register-db';
import { mapMyInvoiceAssetOption } from './my-invoices';
import type { NextRequest } from 'next/server';
import { businessJson, businessError, requireBusinessOrigin } from './business-network-api';
import { limitBusinessAction } from './business-network';
import { ExternalLeadAccessError } from './external-lead-access';
import { addSharedPhotos, addSharedCost, contributionScope, type ContributionTarget } from './shared-asset-contributions';
export async function saveSharedContribution(request:NextRequest,target:ContributionTarget,kind:'photos'|'costs') {
  try {
    requireBusinessOrigin(request);
    const scope = await contributionScope(target,kind === 'photos' ? 'addPhotos' : 'addCosts');
    await limitBusinessAction(`shared-upload:${scope.user.id}`,30);
    if (Number(request.headers.get('content-length') || 0) > 65*1024*1024) throw new Error('This upload is too large.');
    const form = await request.formData();
    if (kind === 'photos') {
      const files = form.getAll('files').filter((value):value is File=>typeof value !== 'string');
      await addSharedPhotos(target,files,form.get('requestId'));
    } else {
      const file = form.get('file');
      const rawDraft = form.get('draft');
      if (rawDraft !== null && (typeof rawDraft !== 'string' || rawDraft.length > 20000)) throw new Error('This cost is invalid.');
      const draft = typeof rawDraft === 'string' ? JSON.parse(rawDraft) : null;
      if (draft && (typeof draft !== 'object' || Array.isArray(draft))) throw new Error('This cost is invalid.');
      const category = String(form.get('category') || 'other');
      const notes = String(form.get('description') || '').trim().slice(0,4000);
      await addSharedCost(target,draft ? {
        captureRequestId:form.get('requestId'),invoiceDate:draft.invoiceDate,supplierName:draft.supplierName,invoiceNumber:draft.invoiceNumber,
        subtotalExVat:draft.subtotalExVat,vatAmount:draft.vatAmount,notes:draft.notes,maintenanceWorkDone:draft.maintenanceWorkDone,partsSupplied:draft.partsSupplied,repairWorkDone:draft.repairWorkDone,usageReading:draft.usageReading,usageMetric:draft.usageMetric,
      } : {
        captureRequestId:form.get('requestId'),invoiceDate:form.get('date'),supplierName:String(form.get('supplier') || '').slice(0,200),invoiceNumber:String(form.get('invoiceNumber') || '').slice(0,100),
        subtotalExVat:form.get('amount'),vatAmount:form.get('vat'),notes,
        maintenanceWorkDone:category === 'maintenance' ? notes : '',partsSupplied:category === 'parts' ? notes : '',repairWorkDone:category === 'repair' ? notes : '',
      },file && typeof file !== 'string' && file.size ? file : undefined);
    }
    return businessJson({ok:true});
  } catch (error) {return error instanceof ExternalLeadAccessError ? businessJson({error:error.message},error.status) : businessError(error);}
}

export async function readSharedCostAsset(target:ContributionTarget) {
  try {
    const scope=await contributionScope(target,'addCosts');
    const asset=await getAssetRegisterItemById(scope.ownerId,scope.assetId);
    if(!asset)throw new ExternalLeadAccessError('This asset is no longer available.',404);
    return businessJson({ok:true,asset:mapMyInvoiceAssetOption(asset)});
  }catch(error){return error instanceof ExternalLeadAccessError?businessJson({error:error.message},error.status):businessError(error);}
}
