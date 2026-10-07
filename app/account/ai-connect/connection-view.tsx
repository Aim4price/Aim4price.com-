import Link from 'next/link';
import DisconnectButton from './disconnect-button';
import styles from './page.module.css';

type Connection = { id: string; created_at: string; expires_at: string };
export type ConnectionViewProps = {
  account?: { name: string; email: string };
  connections?: Connection[];
  resource?: string;
  proof?: string;
  signInHref?: string;
  message?: string;
  disabled?: boolean;
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
  ['asset', 'Assets & values', 'Your saved assets, conditions, usage and valuations.'],
  ['cost', 'Costs & budgets', 'Recorded costs, current budgets and remaining amounts.'],
  ['fuel', 'Fuel records', 'Fuel slips, storage issues and recorded litres.'],
  ['service', 'Maintenance & problems', 'Schedules, completed work and logged problem notes.'],
];
function date(value: string) {
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });
}
export default function ConnectionView({ account, connections, resource, proof, signInHref, message, disabled }: ConnectionViewProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/account" className={styles.back}>← Back to account</Link>
        <header className={styles.hero}>
          <div className={styles.heroIcon}><Icon /></div>
          <div><p className={styles.eyebrow}>YOUR ACCOUNT · YOUR CONTROL</p><h1>AI connections</h1><p className={styles.intro}>Your records. Clearer answers.<br />Ask your AI assistant about the assets you own and what they cost to run.</p></div>
          <span className={styles.badge}><Icon kind="shield" /> Read-only access</span>
        </header>
        <div className={styles.safety}><Icon kind="shield" /><p><strong>Your records stay in your control.</strong> AI can read information you approve. It cannot add, edit or delete business records.</p></div>
        {message && <div className={styles.notice} role={disabled ? 'status' : 'alert'}><strong>{disabled ? 'Private pilot · setup in progress' : 'Connection unavailable'}</strong><p>{message}</p></div>}
        {signInHref && <section className={styles.panel}><h2>Sign in to your Owner account</h2><p>Check the account you want to connect before approving access.</p><Link className={styles.primary} href={signInHref}>Sign in to Aim4price →</Link></section>}
        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            {proof ? <section className={styles.panel} aria-labelledby="approve-title">
              <p className={styles.eyebrow}>REVIEW YOUR CONNECTION</p><h2 id="approve-title">Allow read-only access?</h2>
              {account && <div className={styles.identity}><span>Account being connected</span><strong>{account.name}</strong><span>{account.email}</span></div>}
              <p>This private AI connection will be able to retrieve the information listed on this page from this account.</p>
              <form action="/api/ai/oauth/authorize" method="post">
                <input type="hidden" name="proof" value={proof} />
                <label className={styles.consent}><input type="checkbox" name="terms" value="accepted" required /><span>I accept the Aim4price <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and acknowledge the <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>. I authorise read-only access and understand that requested information is shared with my AI provider.</span></label>
                <div className={styles.actions}><button className={styles.primary} name="decision" value="allow">Allow read-only access</button><button name="decision" value="deny" formNoValidate>Cancel</button></div>
              </form>
            </section> : <section className={styles.panel} aria-labelledby="choose-title">
              <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>GET CONNECTED</p><h2 id="choose-title">Choose your assistant</h2></div><span className={styles.smallBadge}>Private pilot</span></div>
              <p>Connect your own AI account, then sign in to Aim4price and approve read-only access.</p>
              <div className={styles.provider}>
                <div className={styles.providerIcon}><Icon /></div><div className={styles.providerText}><h3>ChatGPT</h3><p>Our first planned connection. Available to invited Owners once setup is complete.</p></div>
                <span className={styles.smallBadge}>{resource ? 'Pilot setup' : 'Not enabled yet'}</span>
              </div>
              {resource && <details className={styles.setup}><summary>View private connection setup</summary><p>The pilot organiser first sets up Aim4price in your AI assistant. Use this server address, then return here through the assistant to sign in and approve access.</p><code className={styles.code}>{resource}</code><p className={styles.note}>No personal API key to manage. Never paste your Aim4price password or a connection secret into a chat.</p></details>}
              <div className={styles.future}><span><strong>Claude</strong><small>Planned · not available</small></span><span><strong>Gemini</strong><small>Planned · not available</small></span></div>
              <p className={styles.note}>Other assistants will be enabled after compatibility testing.</p>
            </section>}
            <section className={styles.panel} aria-labelledby="connections-title">
              <div className={styles.sectionHeading}><h2 id="connections-title">Your connections</h2>{connections && <span className={styles.smallBadge}>{connections.length} active</span>}</div>
              {!proof && account && <div className={styles.accountLine}><strong>{account.name}</strong><span>{account.email}</span></div>}
              {connections?.length ? connections.map(c => <div className={styles.connection} key={c.id}><div><span className={styles.active}>Active · read-only</span><h3>Aim4price private AI connection</h3><p>Connected {date(c.created_at)}<br />Expires {date(c.expires_at)}</p></div><DisconnectButton id={c.id} /></div>) : <div className={styles.empty}><span className={styles.emptyIcon}><Icon kind="shield" /></span><strong>{connections ? 'No assistants connected yet' : 'Connections are not available to view yet'}</strong><p>{connections ? 'Once you approve an assistant, you can manage its access here.' : 'When setup is ready, sign in to view and manage your connections.'}</p></div>}
              <p className={styles.note}>Connections expire after 30 days. Disconnect here at any time to stop future access. Information already shared may remain in your AI conversations.</p>
            </section>
          </div>
          <aside className={styles.panel} aria-labelledby="permissions-title"><p className={styles.eyebrow}>WHAT YOU SHARE</p><h2 id="permissions-title">Answers from your records</h2><p>Only information belonging to the connected Owner account.</p><div className={styles.permissions}>{permissions.map(([icon, title, detail]) => <div className={styles.permission} key={title}><span><Icon kind={icon} /></span><div><h3>{title}</h3><p>{detail}</p></div></div>)}</div><div className={styles.example}><span>TRY ASKING</span><p>“How much of my current budget remains?”</p><p>“Which services are overdue?”</p></div></aside>
        </div>
        <footer className={styles.footer}><span>Secure sign-in. Your approval. Read-only access.</span><nav aria-label="AI connection policies"><Link href="/terms-of-service">Terms of Service</Link><Link href="/privacy-policy">Privacy Policy</Link></nav></footer>
      </div>
    </main>
  );
}
