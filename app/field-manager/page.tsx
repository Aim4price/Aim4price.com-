import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function FieldManagerIndexPage() {
  redirect('/field-manager/login');
}
