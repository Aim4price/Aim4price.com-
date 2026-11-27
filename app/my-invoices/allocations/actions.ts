'use server';

import { accountingOwner } from '../../../lib/accounting-owner';
import { dismissAllocation, editAllocation, listAllocations, postAllocation, type AllocationDetails } from '../../../lib/accounting-allocations';

export async function loadAllocations() {
  return listAllocations(await accountingOwner());
}
export async function allocateCost(id: string, version: number, assetId: string, category?: string) {
  return postAllocation(await accountingOwner(), id, version, assetId, category);
}
export async function saveCostDetails(id: string, version: number, details: AllocationDetails) {
  return editAllocation(await accountingOwner(), id, version, details);
}
export async function deleteCostAllocation(id: string, version: number) {
  return dismissAllocation(await accountingOwner(), id, version);
}
