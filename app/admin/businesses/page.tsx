import Link from 'next/link';
import { requireAdminPageAccess } from "../../../lib/account-access";
import AdminBusinesses from "./businesses-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams?: { verify?: string } }) {
  await requireAdminPageAccess();
  return <><div style={{padding:"1rem 2rem"}}><Link href="/admin/sharing">Sharing usage & access</Link></div><AdminBusinesses initialVerificationOpen={searchParams?.verify === "1"} /></>;
}
