import { isAccountingPilotSession } from './accounting-pilot';
import { notFound } from 'next/navigation';
import { requireActivePageAccess } from './account-access';
import { getServerSession } from './auth-session';
import { getAccountProfile } from './account-profile';
export async function accountingOwner() {
  const {session} = await requireActivePageAccess();
  const desktop = await getServerSession();
  if (!desktop || desktop.user.id !== session.user.id ||
      !isAccountingPilotSession(desktop) || (await getAccountProfile(session.user)).accountType !== 'owner') notFound();
  return session.user.id;
}

