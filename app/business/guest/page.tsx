import { redirect } from 'next/navigation';
import { sharedEnquiryReturnTo } from '../../../lib/external-share-permissions';
export default function GuestPage({searchParams}:{searchParams?:{returnTo?:string}}) {
 const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo);
 redirect('/business/join'+(returnTo?'?returnTo='+encodeURIComponent(returnTo):''));
}
