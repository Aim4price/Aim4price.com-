import { NextResponse } from 'next/server';
import { loadProtectedLeadReport } from '../../../../../../lib/guest-leads';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{token:string;reportId:string}}){
 const result=await loadProtectedLeadReport(params.token,params.reportId);
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
 if(result.status!==200)return NextResponse.json({error:result.status===403?'Confirm your business email and activate access to open this report.':'This report is no longer available.'},{status:result.status,headers});
 return new NextResponse(result.report.pdf,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${encodeURIComponent(result.report.file_name)}"`}});
}
