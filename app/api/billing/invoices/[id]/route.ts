import { NextRequest, NextResponse } from 'next/server';
import { getAnyServerSession } from '../../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../../lib/account-constants';
import { BillingError, getBillingInvoice, mapInvoice } from '../../../../../lib/billing';
import { buildBillingInvoiceHtml } from '../../../../../lib/billing-report';
import { billingPdf } from '../../../../../lib/billing-mail';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:{id:string}}){
 const session=await getAnyServerSession();if(!session?.user?.id)return NextResponse.json({error:'Sign in to view this invoice.'},{status:401});
 try{
  const row=await getBillingInvoice(params.id,session.user.id,isAim4priceAdminEmail(session.user.email));
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(row.status==='void')return NextResponse.json({error:'This invoice has been voided. View its status in Billing.'},{status:409,headers});
  if(request.nextUrl.searchParams.get('format')==='pdf'&&row.status!=='draft')return new NextResponse(await billingPdf(row.id),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${row.number}.pdf"`}});
  return new NextResponse(row.report_html || await buildBillingInvoiceHtml(mapInvoice(row),row.issuer),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-ancestors 'self'; base-uri 'none'"}});
 }catch(error){if(error instanceof BillingError)return NextResponse.json({error:'Invoice not found.'},{status:404});console.error('Invoice rendering failed',error);return NextResponse.json({error:'Invoice could not be rendered. Please retry.'},{status:500});}
}
