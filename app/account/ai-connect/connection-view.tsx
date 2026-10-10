import Link from 'next/link';
import VerifyAdminEmail from './verify-admin-email';
import CopyQuestion from './copy-question';
import DisconnectButton from './disconnect-button';
import AccountSetup from './account-setup';
import ConnectionActions, { ServerAddress } from './connection-actions';
import accessStyles from '../app-access-management.module.css';
import styles from './page.module.css';

type Connection = { id: string; provider?: string; disabled?: boolean; created_at: string; expires_at: string };
export type ConnectionViewProps = {
  audience?: 'owner' | 'admin';
  providerName?: string;
  clientId?: string;
  providers?: { name: string; launchUrl?: string }[];
  account?: { name: string; email: string };
  connections?: Connection[];
  resource?: string;
  proof?: string;
  authorization?: string;
  signInHref?: string;
  message?: string;
  disabled?: boolean;
  needsVerification?: boolean;
};

function Icon({ kind = 'spark' }: { kind?: string }) {
  const paths: Record<string, string> = {
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
    shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
    asset: 'M3 7h18v14H3V7Zm4 0V3h10v4M3 12h18M9 12v3h6v-3',
    cost: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
    fuel: 'M4 21V4h9v17M3 21h12M4 10h9m0 3h3v5a2 2 0 0 0 4 0V9l-3-4',
    service: 'm14 6 4 4m-9 3-6 6 2 2 6-6m1-11a6 6 0 0 0-4 10l2 2a6 6 0 0 0 10-4l-4 1-3-3 1-4Z',
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind] || paths.spark} /></svg>;
}
const permissions = [
  ['asset', 'Assets & values', 'Your active assets, recorded hours or kilometres, condition and saved values.', 'How many active assets do I have, and what is their total saved value?'],
  ['cost', 'Costs & budgets', 'Recorded costs, monthly and annual budgets, spending and remaining amounts.', 'How much of my budget is left this month?'],
  ['fuel', 'Fuel', 'Recorded fuel purchases, litres and fuel issued from storage to assets.', 'How many litres of fuel were issued from storage this month?'],
  ['service', 'Maintenance', 'Service schedules, maintenance activity and logged asset problems.', 'Which services are overdue, and which assets have open problems?'],
];
function date(value: string) {
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });
}

const adminPermissions = [
  ['asset', 'Asset oversight', 'Saved asset records across accounts, with full totals and account breakdowns.', 'How many active asset records are there across all accounts, and what is their saved value?'],
  ['cost', 'Values & data gaps', 'Saved values excluding VAT, umbrella exclusions and missing valuations.', 'Break down asset values by account and show missing valuations.'],
  ['service', 'Asset comparisons', 'Search by brand, type, condition and lifecycle, with saved usage readings.', 'Show active New Holland tractors across accounts, including their recorded hours.'],
];
function SharedInformation({ examples = false, admin = false }: { examples?: boolean; admin?: boolean }) {
  return <div className={examples ? styles.questionGrid : admin ? styles.adminPermissions : styles.permissions}>
    {(admin ? adminPermissions : permissions).map(([icon, title, detail, example]) => <div className={examples ? styles.questionCard : styles.permission} key={title}>
      <div className={styles.cardHeading}><span className={styles.permissionIcon}><Icon kind={icon} /></span><h3>{title}</h3></div>
      <p>{detail}</p>
      {examples && <div className={styles.question}><p>“{example}”</p><CopyQuestion question={example} category={title} /></div>}
    </div>)}
  </div>;
}

export default function ConnectionView({ account, connections, resource, proof, authorization, signInHref, message, disabled, audience = 'owner', providerName, clientId, needsVerification, providers = [] }: ConnectionViewProps) {
  const admin = audience === 'admin';
  const duration = admin ? '24 hours' : '30 days';
  const setup = <>
    {signInHref ? <div className={styles.empty}>
      <h3>Sign in to get started</h3>
      <p>Use the Aim4price account you want to connect.</p>
      <Link className={styles.primary} href={signInHref}>Sign in to Aim4price</Link>
    </div> : resource ? <>
      <p className={styles.description}>Choose a configured assistant, add the Aim4price connection there, then sign in and approve access.</p>
      <div className={styles.providerGrid}>
        {providers.map(provider => <div className={styles.permission} key={provider.name}>
          <h3>{provider.name}</h3>
          <p>Configured for {admin ? 'private admin reporting' : 'Owner accounts'}. Connection setup in the assistant is required.</p>
          {provider.launchUrl && <a className={styles.primary} href={provider.launchUrl} target="_blank" rel="noopener noreferrer">Open {provider.name} ↗</a>}
        </div>)}
      </div>
      <ol className={styles.steps}>
        <li><span className={styles.stepNumber} aria-hidden="true">1</span><div><h3>Add Aim4price in your assistant</h3><p>Use the installed Aim4price connection, or its custom MCP connection settings. Opening the assistant alone does not connect it.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">2</span><div><h3>Sign in and approve</h3><p>Check the provider, account and permissions before allowing read-only access.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">3</span><div><h3>Ask your question</h3><p>Return to your assistant and select Aim4price in your conversation.</p></div></li>
      </ol>
      <details className={styles.setup}>
        <summary>Connection address & setup help</summary>
        <p>Copy this address into the assistant’s MCP server URL field. It is not a browser sign-in link. Custom connections must use a provider registered by Aim4price.</p>
        <ServerAddress resource={resource} />
        {admin && <><p>OAuth client ID: <code>{clientId}</code></p><p>Scope: <code>aim4price:admin:read</code>. Use the separate admin client secret from Railway’s secure variable settings when configuring the private assistant connection.</p></>}
        <p className={styles.note}>Use OAuth sign-in. No personal API key is needed. Never paste passwords or connection secrets into a chat. A public directory listing is not required for a configured custom connection.</p>
      </details>
      <p className={styles.note}>Additional assistants become available after their connection is configured and tested.</p>
    </> : <>
      <p className={styles.description}>{disabled ? 'AI connections are not enabled here yet.' : 'Check your account to help with connection setup.'}</p>
      {!admin && <AccountSetup />}
    </>}
  </>;

  const management = <>
    {account && <div className={styles.accountLine}><strong>{account.name}</strong><span>{account.email}</span></div>}
    {connections?.length ? <div className={styles.connectionList}>
      {connections.map(c => <div className={styles.connection} key={c.id}>
        <span className={styles.connectionIcon}><Icon /></span>
        <div className={styles.connectionCopy}>
          <h3>{c.provider || 'AI connection'}</h3>
          <p>Connected {date(c.created_at)} · Expires {date(c.expires_at)}</p>
        </div>
        <span className={styles.active}>{c.disabled ? 'Provider disabled' : 'Connected'}</span>
        <DisconnectButton id={c.id} audience={audience} />
      </div>)}
    </div> : <div className={styles.empty}>
      <h3>{connections ? 'No active connections' : 'Connection details unavailable'}</h3>
      <p>{connections ? 'Use Connect to set up your assistant. Once approved, its access will appear here.' : signInHref ? 'Sign in to view and manage your connections.' : 'Your connections will appear here once your account is ready.'}</p>
      {signInHref && <Link className={styles.primary} href={signInHref}>Sign in to Aim4price</Link>}
    </div>}
    <p className={styles.note}>Access lasts {duration}. Disconnect at any time to stop future access. Information already shared may remain in your AI conversations.</p>
  </>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href={admin ? "/admin" : "/account"} className={styles.back}>← Back to {admin ? 'admin' : 'account'}</Link>
        <section className={`${accessStyles.launcher} ${styles.launcher}`} aria-labelledby="ai-connections-title">
          <div className={`${accessStyles.launcherIntro} ${styles.intro}`}>
            <h1 id="ai-connections-title">{admin ? 'Admin AI connections' : 'AI connections'}</h1>
            <p>{proof ? 'Review your account and approve read-only access.' : admin ? 'Ask about assets across Aim4price accounts. Read-only oversight.' : 'Connect your assistant. Ask about your assets. Stay in control.'}</p>
          </div>
          <div className={styles.safety}><Icon kind="shield" /><p><strong>{admin ? 'Private admin access.' : 'Your records stay yours.'}</strong> AI can read information you approve, but cannot add, edit or delete your records.</p></div>
          {message && !disabled && <div className={styles.notice} role="alert"><h2>Connection unavailable</h2><p>{message}</p>{needsVerification && <VerifyAdminEmail />}</div>}
          {proof ? <section className={styles.approval} aria-labelledby="approve-title">
            <h2 id="approve-title">Allow {providerName || 'this assistant'} read-only access?</h2>
            {account && <div className={styles.identity}><span>Account being connected</span><strong>{account.name}</strong><span>{account.email}</span></div>}
            <p>{admin ? 'This is cross-account administrator access. Asset records from all accounts can be returned to this AI provider. Queries are audited. No business records can be changed.' : 'This connection can read the following information from this Owner account only.'}</p>
            <SharedInformation admin={admin} />
            <form action="/api/ai/oauth/authorize" method="post">
              <input type="hidden" name="authorization" value={authorization || ''} />
              <input type="hidden" name="proof" value={proof} />
              <label className={styles.consent}><input type="checkbox" name="terms" value="accepted" required /><span>I accept the Aim4price <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and acknowledge the <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>. I authorise read-only access and understand that requested information is shared with my AI provider.</span></label>
              <p className={styles.note}>Access lasts {duration}. You can disconnect from this page at any time. Information already shared may remain in your AI conversations.</p>
              <div className={styles.actions}><button type="submit" className={styles.primary} name="decision" value="allow">Allow read-only access</button><button type="submit" name="decision" value="deny" formNoValidate>Cancel</button></div>
            </form>
          </section> : <ConnectionActions admin={admin} setup={setup} management={management} count={connections?.length} />}
        </section>
        {!proof && <details className={styles.examples}>
          <summary className={styles.exampleHeading}>
            <span className={styles.exampleHeadingCopy}><span className={styles.exampleTitle}>Turn your records into answers</span><span>{admin ? 'Explore asset totals, comparisons and data gaps across accounts.' : 'Explore questions about assets, budgets, fuel and maintenance.'}</span></span>
            <span className={styles.exampleChevron} aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></span>
          </summary>
          <div className={styles.examplesBody}>
            <p className={styles.questionHint}>Once connected, copy a question into your assistant and select Aim4price in your conversation.</p>
            <SharedInformation examples admin={admin} />
            <details className={styles.disclosure}>
              <summary>What information is shared?</summary>
              <div className={styles.sharingDetails}>
                <div><h3>{admin ? 'Authorised admin reporting' : 'Only your connected account'}</h3><p>{admin ? 'This private connection reads approved asset fields across accounts. It does not expose passwords, tokens, contact details, exact locations or attachments.' : 'Your assistant can retrieve your account profile and the records described above. It cannot access another Owner’s account through this connection.'}</p></div>
                <div><h3>You stay in control</h3><p>Access is read-only: your AI cannot add, change or delete records. Disconnect at any time using Manage above.</p></div>
                <div><h3>Based on what you have saved</h3><p>Answers depend on your recorded information. Missing records may leave gaps. Photos and document attachments are not shared through this connection.</p></div>
              </div>
              <p className={styles.sharingNote}>Requested information is shared with your AI provider. Disconnecting stops future access; information already shared may remain in your conversations.</p>
            </details>
          </div>
        </details>}
        <footer className={styles.footer}><span>You choose when to connect and disconnect.</span><nav aria-label="AI connection policies"><Link href="/terms-of-service">Terms of Service</Link><Link href="/privacy-policy">Privacy Policy</Link></nav></footer>
      </div>
    </main>
  );
}
