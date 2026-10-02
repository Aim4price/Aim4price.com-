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
      const category = String(form.get('category') || 'other');
      const notes = String(form.get('description') || '').trim().slice(0,4000);
      await addSharedCost(target,{
        captureRequestId:form.get('requestId'),invoiceDate:form.get('date'),supplierName:String(form.get('supplier') || '').slice(0,200),invoiceNumber:String(form.get('invoiceNumber') || '').slice(0,100),
        subtotalExVat:form.get('amount'),vatAmount:form.get('vat'),notes,
        maintenanceWorkDone:category === 'maintenance' ? notes : '',partsSupplied:category === 'parts' ? notes : '',repairWorkDone:category === 'repair' ? notes : '',
      },file && typeof file !== 'string' && file.size ? file : undefined);
    }
    return businessJson({ok:true});
  } catch (error) {return error instanceof ExternalLeadAccessError ? businessJson({error:error.message},error.status) : businessError(error);}
}
