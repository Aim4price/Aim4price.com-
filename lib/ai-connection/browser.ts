import { getAnyServerSession } from '../auth-session';
import { getDb } from '../db';
import { ConnectionError, type ConnectionConfig } from './security';
import { eligibleAccount, readOnly } from './store';
export async function connectionOwner(config: ConnectionConfig) {
  // Real website session only. Never use the support/impersonation or app sessions.
  const session = await getAnyServerSession();
  if (!session?.user?.id)
    throw new ConnectionError(
      401,
      'login_required',
      'Sign in to your Owner account first.',
    );
  const account = await readOnly(getDb(), (db) =>
    eligibleAccount(db, session.user.id, config),
  );
  return { account, sessionId: session.session.id };
}
