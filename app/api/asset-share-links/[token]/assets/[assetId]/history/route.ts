import type {NextRequest} from 'next/server';
import {sharedAssetWork} from '../../../../../../../lib/shared-asset-work';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest,{params}:{params:{token:string;assetId:string}})=>sharedAssetWork(request,params,'history');
