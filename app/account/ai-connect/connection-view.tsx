import Link from 'next/link';
import VerifyAdminEmail from './verify-admin-email';
import CopyQuestion from './copy-question';
import DisconnectButton from './disconnect-button';
import AccountSetup from './account-setup';
import ConnectionActions, { ServerAddress } from './connection-actions';
import accessStyles from '../app-access-management.module.css';
import pageStyles from '../dealer-app/page.module.css';
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
    chat: 'M4 4h16v12H9l-5 4V4Zm4 4h8m-8 4h5',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
    shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
    asset: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7',
    records: 'M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7m-7 4h5',
    cost: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
    fuel: 'M4 21V4h9v17M3 21h12M4 10h9m0 3h3v5a2 2 0 0 0 4 0V9l-3-4',
    service: 'm14 6 4 4m-9 3-6 6 2 2 6-6m1-11a6 6 0 0 0-4 10l2 2a6 6 0 0 0 10-4l-4 1-3-3 1-4Z',
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind] || paths.spark} /></svg>;
}
const permissions = [
  ['asset', 'Assets & values', 'Your active assets, recorded hours or kilometres, condition and saved values.', 'How many active assets do I have, and what is my saved register value excluding VAT?'],
  ['cost', 'Costs & budgets', 'Recorded costs, monthly and annual budgets, spending and remaining amounts.', 'For each monthly budget, how much have I spent and how much is left this month?'],
  ['fuel', 'Fuel', 'Recorded fuel purchases, litres and fuel issued from storage to assets.', 'How many litres are recorded as issued from fuel storage this month?'],
  ['service', 'Maintenance', 'Service schedules, maintenance activity and logged asset problems.', 'Which saved maintenance schedules are overdue or due soon?'],
];
function date(value: string) {
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });
}

const adminPermissions = [
  ['asset', 'Asset oversight', 'Saved asset records across accounts, with full totals and account breakdowns.', 'How many active asset records are there across all accounts, and what is their saved value?'],
  ['cost', 'Values & data gaps', 'Saved values excluding VAT, umbrella exclusions and missing valuations.', 'Break down asset values by account and show missing valuations.'],
  ['service', 'Asset comparisons', 'Search by brand, type, condition and lifecycle, with saved usage readings.', 'Show active New Holland tractors across accounts, including their recorded hours.'],
];
const questionNotes: Record<string, string> = {
  asset: 'Saved values, not a new valuation.',
  cost: 'Each budget shown separately, including VAT.',
  fuel: 'Recorded issues, not measured consumption.',
  service: 'Based on saved dates and usage readings.',
};

function SharedInformation({ examples = false, admin = false }: { examples?: boolean; admin?: boolean }) {
  return <div className={examples ? styles.questionGrid : admin ? styles.adminPermissions : styles.permissions}>
    {(admin ? adminPermissions : permissions).map(([icon, title, detail, example]) => <div className={examples ? styles.questionCard : styles.permission} key={title} data-category={icon}>
      <div className={styles.cardHeading}><span className={styles.permissionIcon}><Icon kind={icon} /></span><h3>{title}</h3></div>
      {!examples && <p>{detail}</p>}
      {examples && <div className={styles.question}><p>{example}</p>{!admin && <span className={styles.questionNote}>{questionNotes[icon]}</span>}<CopyQuestion question={example} category={title} /></div>}
    </div>)}
  </div>;
}

export default function ConnectionView({ account, connections, resource, proof, authorization, signInHref, message, disabled, audience = 'owner', providerName, clientId, needsVerification, providers = [] }: ConnectionViewProps) {
  const admin = audience === 'admin';
  const duration = admin ? '24 hours' : '30 days';
  const makeSetup = (selectedProvider?: string) => <>
    {selectedProvider && !signInHref && !providers.some(provider => provider.name.toLowerCase().includes(selectedProvider.toLowerCase())) ? <div className={styles.empty}>
      <h3>{selectedProvider} connection is not available yet</h3>
      <p>{selectedProvider === 'Gemini' ? 'Gemini setup is planned. We will enable it after regional availability and the Aim4price connection have been verified.' : 'We will enable this option once its Aim4price connection is configured and tested.'}</p>
    </div> : signInHref ? <div className={styles.empty}>
      <h3>Sign in to get started</h3>
      <p>Use the Aim4price account you want to connect.</p>
      <Link className={styles.primary} href={signInHref}>Sign in to Aim4price</Link>
    </div> : resource ? <>
      <div className={styles.setupLayout}>
      <div className={styles.providerGrid}>
        {providers.filter(provider => !selectedProvider || provider.name.toLowerCase().includes(selectedProvider.toLowerCase())).map(provider => <div className={styles.permission} key={provider.name}>
          <div className={styles.cardHeading}><span className={styles.permissionIcon}><Icon kind="chat" /></span><h3>{provider.name}</h3></div>
          <p>{admin ? 'Private admin reporting with read-only access.' : 'Ask about your Aim4price records with read-only access.'}</p>
          {provider.launchUrl && <a className={styles.primary} href={provider.launchUrl} target="_blank" rel="noopener noreferrer">Open {provider.name}</a>}
        </div>)}
      </div>
      <ul className={styles.steps}>
        <li><span className={styles.stepIcon}><Icon kind="link" /></span><div><h3>Add Aim4price</h3><p>Open {selectedProvider || 'your assistant'} and add its Aim4price connection. Opening it alone does not connect it.</p></div></li>
        <li><span className={styles.stepIcon}><Icon kind="shield" /></span><div><h3>Sign in and approve</h3><p>Sign in to Aim4price and review the account and read-only access.</p></div></li>
        <li><span className={styles.stepIcon}><Icon kind="chat" /></span><div><h3>Ask your question</h3><p>Return to {selectedProvider || 'your assistant'} and select Aim4price in your conversation.</p></div></li>
      </ul>
      </div>
      <details className={styles.setup}>
        <summary>Manual setup & connection address</summary>
        <p>Copy this address into the assistant’s MCP server URL field. It is not a browser sign-in link. Custom connections must use a provider registered by Aim4price.</p>
        <ServerAddress resource={resource} />
        {admin && <><p>OAuth client ID: <code>{clientId}</code></p><p>Scope: <code>aim4price:admin:read</code>. Use the separate admin client secret from Railway’s secure variable settings when configuring the private assistant connection.</p></>}
        <p className={styles.note}>Use OAuth sign-in. No personal API key is needed. Never paste passwords or connection secrets into a chat.</p>
      </details>

    </> : <>
      <p className={styles.description}>{disabled ? 'AI connections are not enabled here yet.' : 'Check your account to help with connection setup.'}</p>
      {!admin && <AccountSetup />}
    </>}
  </>;

  const setup = makeSetup();
  const assistantOptions = ['ChatGPT', 'Claude', 'Gemini'].map(name => ({
    name,
    available: providers.some(provider => provider.name.toLowerCase().includes(name.toLowerCase())),
    setup: makeSetup(name),
  }));

  const management = <>
    {account && <div className={`${accessStyles.loginIdentity} ${styles.accountLine}`}><Icon kind="asset" /><div><strong>{account.name}</strong><span>{account.email}</span></div></div>}
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
      <span className={styles.emptyIcon}><Icon kind="link" /></span>
      <h3>{connections ? 'No active connections' : 'Connection details unavailable'}</h3>
      <p>{connections ? 'Connect your assistant to ask about your records.' : signInHref ? 'Sign in to view and manage your connections.' : 'Your connections will appear here once your account is ready.'}</p>
      {signInHref && <Link className={styles.primary} href={signInHref}>Sign in to Aim4price</Link>}
    </div>}
    <p className={styles.note}>Access lasts {duration}. Disconnect at any time to stop future access. Information already shared may remain in your AI conversations.</p>
  </>;

  return (
    <main className={styles.page}>
      <div className={`${pageStyles.shell} ${styles.shell}`}>
        <Link href={admin ? "/admin" : "/account"} className={pageStyles.backButton}>Back to {admin ? 'admin' : 'account'}</Link>
        <section className={`${accessStyles.launcher} ${styles.launcher}`} aria-labelledby="ai-connections-title">
          <div className={accessStyles.launcherIntro}>
            <h1 id="ai-connections-title">{admin ? 'Admin AI connections' : 'AI connections'}</h1>
            <p>{proof ? 'Review your account and approve read-only access.' : admin ? 'Ask about assets across Aim4price accounts. Read-only oversight.' : 'Ask your AI assistant about your assets, costs, fuel and maintenance.'}</p>
          </div>
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
          </section> : <ConnectionActions admin={admin} assistantOptions={assistantOptions} setup={setup} management={management} count={connections?.length} />}
          <div className={styles.safety}><Icon kind="shield" /><p><strong>{admin ? 'Private admin access.' : 'Read-only access.'}</strong> Your assistant cannot add, edit or delete records.</p></div>
        </section>
        {!proof && <details className={styles.examples} open>
          <summary className={styles.exampleHeading}>
            <span className={styles.exampleHeadingCopy}><span className={styles.exampleTitle}>Questions you can ask</span><span>{admin ? 'Explore asset totals, comparisons and data gaps across accounts.' : 'Explore questions about assets, budgets, fuel and maintenance.'}</span></span>
            <span className={styles.exampleChevron} aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></span>
          </summary>
          <div className={styles.examplesBody}>
            <p className={styles.questionHint}>Copy a question into your connected assistant and ask it to use Aim4price.</p>
            <SharedInformation examples admin={admin} />
            <details className={styles.disclosure}>
              <summary>What information is shared?</summary>
              <div className={styles.sharingDetails}>
                <div><span className={styles.sharingIcon}><Icon kind="asset" /></span><h3>{admin ? 'Admin access' : 'Your account only'}</h3><p>{admin ? 'Approved asset information across accounts. No passwords, tokens, contact details or exact locations.' : 'Your account profile, assets, costs, budgets, fuel and maintenance. Other owners’ accounts are not accessible.'}</p></div>
                <div><span className={styles.sharingIcon}><Icon kind="shield" /></span><h3>Read-only access</h3><p>Your assistant cannot add, edit or delete records. Stop future access at any time through Manage.</p></div>
                <div><span className={styles.sharingIcon}><Icon kind="records" /></span><h3>Saved records</h3><p>Answers depend on what you have recorded. Missing information can leave gaps. Photos and document attachments are not shared.</p></div>
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
