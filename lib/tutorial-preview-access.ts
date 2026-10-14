import { isAim4priceAdminEmail, normalizeEmail } from './account-constants';

/** Private draft: authorize the real website session, never a query parameter. */
export function canViewTutorialPreview(user: { id?: string; email?: string | null } | null | undefined): boolean {
  return Boolean(user?.id && (normalizeEmail(user.email) === 'kallageldenhuys@gmail.com' || isAim4priceAdminEmail(user.email)));
}
