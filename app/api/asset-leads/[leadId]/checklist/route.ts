import type {NextRequest} from 'next/server';
import {sharedAssetWork} from '../../../../../lib/shared-asset-work';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest,{params}:{params:{leadId:string}})=>sharedAssetWork(request,params,'checklist');
