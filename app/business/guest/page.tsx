import { guestCreditLimit } from '../../../lib/guest-enquiry-credits';
import AppHeader from '../../../components/AppHeader';
import GuestEnquiryAccess from '../../../components/GuestEnquiryAccess';
import { sharedEnquiryReturnTo } from '../../../lib/external-share-permissions';
import styles from '../page.module.css';
export default function GuestPage({searchParams}:{searchParams?:{returnTo?:string}}){
 return <><AppHeader active="none"/><main className={styles.page}><GuestEnquiryAccess limit={guestCreditLimit()} returnTo={sharedEnquiryReturnTo(searchParams?.returnTo)}/></main></>;
}
