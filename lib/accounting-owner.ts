import { notFound } from 'next/navigation';
import { requireActivePageAccess } from './account-access';
import { getServerSession, isAdminSupportSession } from './auth-session';
import { getAccountProfile } from './account-profile';
export async function accountingOwner() {
  const {session} = await requireActivePageAccess();
  const desktop = await getServerSession();
  if (!desktop || isAdminSupportSession(desktop) || desktop.user.id !== session.user.id ||
      ![process.env.ACCOUNTING_PILOT_OWNER_ID,process.env.SAGE_ZA_PILOT_OWNER_ID].includes(session.user.id) || (await getAccountProfile(session.user)).accountType !== 'owner') notFound();
  return session.user.id;
}

