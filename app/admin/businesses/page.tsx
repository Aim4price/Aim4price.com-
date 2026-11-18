import Link from 'next/link';
import { requireAdminPageAccess } from "../../../lib/account-access";
import AdminBusinesses from "./businesses-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams?: { verify?: string } }) {
  await requireAdminPageAccess();
  return <><div style={{marginBottom:"1rem",fontSize:"0.8rem"}}><Link href="/admin/sharing">Sharing usage & access</Link></div><AdminBusinesses initialVerificationOpen={searchParams?.verify === "1"} /></>;
}
