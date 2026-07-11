import { NextResponse } from 'next/server'; import { DEALER_APP_COOKIE } from '../../../../lib/dealer-app-session';
export async function POST(){const r=NextResponse.json({ok:true});r.cookies.set(DEALER_APP_COOKIE,'',{httpOnly:true,path:'/',maxAge:0});return r;}
