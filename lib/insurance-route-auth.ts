import { getAccountProfile } from './account-profile';
import { getServerSession } from './auth-session';

export async function requireInsuranceBrokerUserId(): Promise<string> {
  const session = await getServerSession({ requireActive: true });
  const userId = session?.user?.id ?? '';
  if (!session || !userId) throw new Error('INSURANCE_AUTH_REQUIRED');
  const profile = await getAccountProfile({ id: userId, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'insurance') throw new Error('INSURANCE_ACCOUNT_REQUIRED');
  return userId;
}

export function insuranceApiError(error: unknown): { message: string; status: number } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'INSURANCE_AUTH_REQUIRED') return { message: 'You must be signed in.', status: 401 };
  if (code === 'INSURANCE_ACCOUNT_REQUIRED') return { message: 'This workspace is available to insurance accounts only.', status: 403 };
  if (code.includes('NOT_FOUND') || code === 'INSURANCE_SNAPSHOT_MISSING') return { message: 'The requested insurance workspace was not found.', status: 404 };
  if (code.includes('REQUIRED')) return { message: 'Required review information is missing.', status: 400 };
  return { message: 'The insurance workspace could not be updated.', status: 500 };
}
