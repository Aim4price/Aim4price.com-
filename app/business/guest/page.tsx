import { guestCreditLimit } from '../../../lib/guest-enquiry-credits';
import GuestEnquiryAccess from '../../../components/GuestEnquiryAccess';
import { sharedEnquiryReturnTo } from '../../../lib/external-share-permissions';
export default function GuestPage({searchParams}:{searchParams?:{returnTo?:string}}){
 return <GuestEnquiryAccess limit={guestCreditLimit()} returnTo={sharedEnquiryReturnTo(searchParams?.returnTo)}/>;
}
