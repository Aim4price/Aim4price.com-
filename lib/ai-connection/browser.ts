import { getAnyServerSession } from '../auth-session';
import { getDb } from '../db';
import { ConnectionError, requireRecentAiSignIn, type ConnectionConfig } from './security';
import { eligibleAccount, readOnly } from './store';
export async function connectionOwner(config: ConnectionConfig, fresh = false) {
  // Real website session only. Never use the support/impersonation or app sessions.
  const session = await getAnyServerSession();
  if (!session?.user?.id)
    throw new ConnectionError(
      401,
      'login_required',
      'Sign in to your Aim4price account first.',
    );
  if (fresh && config.audience !== 'admin') requireRecentAiSignIn(session.session.createdAt);
  const account = await readOnly(getDb(), (db) =>
    eligibleAccount(db, session.user.id, config),
  );
  return { account, sessionId: session.session.id };
}
