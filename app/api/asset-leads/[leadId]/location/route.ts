import type {NextRequest} from 'next/server';
import {sharedAssetSettings} from '../../../../../lib/shared-asset-settings';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest,{params}:{params:{leadId:string}})=>sharedAssetSettings(request,params,'location');
export const POST=GET;
