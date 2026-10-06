import Link from 'next/link';
import { getDb } from '../../../lib/db';
import { connectionOwner } from '../../../lib/ai-connection/browser';
import {
  authorizationRequest,
  connectionConfig,
  ConnectionError,
  consentProof,
} from '../../../lib/ai-connection/security';
import DisconnectButton from './disconnect-button';
import styles from './page.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'AI connection | Aim4price',
  robots: { index: false, follow: false },
};
export default async function AiConnectionPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  let content;
  try {
    const config = connectionConfig();
    const auth = params.size ? authorizationRequest(params, config) : null;
    let owner;
    try {
      owner = await connectionOwner(config);
    } catch (error) {
      if (error instanceof ConnectionError && error.status === 401) {
        const returnTo =
          '/account/ai-connect' + (params.size ? '?' + params.toString() : '');
        return (
          <main className={styles.page}>
            <section className={styles.card}>
              <h1>Connect Aim4price to your AI</h1>
              <p>
                Sign in to choose which account to connect. Access is read-only.
              </p>
              <Link
                className={styles.primary}
                href={`/auth?accountAccess=desktop&returnTo=${encodeURIComponent(returnTo)}#login`}
              >
                Sign in to Aim4price
              </Link>
            </section>
          </main>
        );
      }
      throw error;
    }
    const connections = (
      await getDb().query(
        `SELECT id,created_at,expires_at FROM public.ai_connections WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC`,
        [owner.account.id],
      )
    ).rows;
    content = (
      <>
        <h1>{auth ? 'Allow read-only access?' : 'AI connections'}</h1>
        <div className={styles.identity}>
          <strong>{owner.account.name}</strong>
          <span>{owner.account.email}</span>
        </div>
        <p>
          Your assistant can read this account’s assets, saved valuations, costs
          and fuel records to answer your questions.
        </p>
        <p>
          <strong>
            It cannot add, edit or delete anything in your records.
          </strong>{' '}
          You can disconnect below at any time.
        </p>
        {auth ? (
          <form action="/api/ai/oauth/authorize" method="post">
            <input
              type="hidden"
              name="proof"
              value={consentProof(
                auth,
                owner.account.id,
                owner.sessionId,
                config.signingSecret,
              )}
            />
            <div className={styles.actions}>
              <button className={styles.primary} name="decision" value="allow">
                Allow read-only access
              </button>
              <button name="decision" value="deny">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p>
              Add the private Aim4price connection in your AI assistant, then
              sign in and approve access. For the pilot, use this server
              address:
            </p>
            <code className={styles.code}>{config.resource}</code>
            <p className={styles.note}>
              The pilot organiser configures the connection once. You never
              paste your Aim4price password into a conversation.
            </p>
          </>
        )}
        <p className={styles.note}>
          Requested information is sent to the AI provider you connect.
          Disconnecting stops future access; it does not erase existing
          conversations. Connections expire after 30 days.
        </p>
        <h2>Connected assistants</h2>
        {connections.length ? (
          connections.map((c) => (
            <div className={styles.connection} key={c.id}>
              <div>
                <strong>Aim4price read-only pilot</strong>
                <p>
                  Connected {new Date(c.created_at).toLocaleDateString('en-ZA')}{' '}
                  · Expires {new Date(c.expires_at).toLocaleDateString('en-ZA')}
                </p>
              </div>
              <DisconnectButton id={c.id} />
            </div>
          ))
        ) : (
          <p>No assistants connected yet.</p>
        )}
      </>
    );
  } catch (error) {
    content = (
      <>
        <h1>AI connections</h1>
        <p role="alert">
          {error instanceof ConnectionError
            ? error.message
            : 'The connection is temporarily unavailable. Please try again later.'}
        </p>
      </>
    );
  }
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/account">← Back to account</Link>
        {content}
      </section>
    </main>
  );
}
