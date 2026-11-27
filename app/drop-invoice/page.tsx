import { redirect } from 'next/navigation';

export default function DropInvoicePage() {
  redirect('/auth?accountType=business&offer=free#signup');
}
