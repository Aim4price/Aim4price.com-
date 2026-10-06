import {NextRequest} from 'next/server';
import {getServerSession} from '../../../lib/auth-session';
import {directoryIdentity,readAccountListing,saveAccountListing} from '../../../lib/account-directory';
import {businessJson,businessError,requireBusinessOrigin} from '../../../lib/business-network-api';
export const runtime='nodejs';
export async function GET(){try{const s=await getServerSession({requireActive:false});if(!s?.user)return businessJson({error:'Sign in first.'},401);await directoryIdentity(s.user);return businessJson({listing:await readAccountListing(s.user.id)});}catch(e){return businessError(e);}}
export async function POST(request:NextRequest){try{requireBusinessOrigin(request);const s=await getServerSession({requireActive:false});if(!s?.user)return businessJson({error:'Sign in first.'},401);await directoryIdentity(s.user);
 const reader=request.body?.getReader();if(!reader)throw new Error('This request is invalid.');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2900000){await reader.cancel();throw new Error('This request is too large.');}chunks.push(value);}
 const body=JSON.parse(Buffer.concat(chunks).toString());if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('This request is invalid.');
 return businessJson({listing:await saveAccountListing(s.user,body)});
}catch(e){return businessError(e);}}
