import { redirect } from 'next/navigation';

// This workspace is available on the main desktop site only.
export default function DesktopOnlyDealerWorkspace() {
  redirect('/dealer');
}
