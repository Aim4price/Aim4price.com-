import { NextResponse } from 'next/server';
import { loadProtectedLeadReport } from '../../../../../../lib/guest-leads';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{token:string;reportId:string}}){
 const result=await loadProtectedLeadReport(params.token,params.reportId);
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
 if(result.status!==200)return NextResponse.json({error:result.status===403?'Sign in with the verified recipient account approved for this enquiry.':'This report is no longer available.'},{status:result.status,headers});
 return new NextResponse(result.report.pdf,{headers:{...headers,'Content-Type':result.report.content_type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'?result.report.content_type:'application/pdf','Content-Disposition':`${result.report.content_type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'?'attachment':'inline'}; filename="${encodeURIComponent(result.report.file_name)}"`}});
}
