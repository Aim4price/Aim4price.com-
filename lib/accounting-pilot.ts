import { isAdminSupportSession } from './auth-session';

export function isAccountingPilotSession(session: Parameters<typeof isAdminSupportSession>[0]) {
  return Boolean(session?.user.id && !isAdminSupportSession(session)
    && session.user.email?.trim().toLowerCase() === 'kallageldenhuys@gmail.com');
}
