import Link from 'next/link';
import CopyQuestion from './copy-question';
import DisconnectButton from './disconnect-button';
import AccountSetup from './account-setup';
import ConnectionActions, { ServerAddress } from './connection-actions';
import accessStyles from '../app-access-management.module.css';
import styles from './page.module.css';

type Connection = { id: string; created_at: string; expires_at: string };
export type ConnectionViewProps = {
  account?: { name: string; email: string };
  connections?: Connection[];
  resource?: string;
  proof?: string;
  authorization?: string;
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
  ['asset', 'Assets & values', 'Your active assets, recorded hours or kilometres, condition and saved values.', 'How many active assets do I have, and what is their total saved value?'],
  ['cost', 'Costs & budgets', 'Recorded costs, monthly and annual budgets, spending and remaining amounts.', 'How much of my budget is left this month?'],
  ['fuel', 'Fuel', 'Recorded fuel purchases, litres and fuel issued from storage to assets.', 'How many litres of fuel were issued from storage this month?'],
  ['service', 'Maintenance', 'Service schedules, maintenance activity and logged asset problems.', 'Which services are overdue, and which assets have open problems?'],
];
function date(value: string) {
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });
}

function SharedInformation({ examples = false }: { examples?: boolean }) {
  return <div className={examples ? styles.questionGrid : styles.permissions}>
    {permissions.map(([icon, title, detail, example]) => <div className={examples ? styles.questionCard : styles.permission} key={title}>
      <div className={styles.cardHeading}><span className={styles.permissionIcon}><Icon kind={icon} /></span><h3>{title}</h3></div>
      <p>{detail}</p>
      {examples && <div className={styles.question}><p>“{example}”</p><CopyQuestion question={example} category={title} /></div>}
    </div>)}
  </div>;
}

export default function ConnectionView({ account, connections, resource, proof, authorization, signInHref, message, disabled }: ConnectionViewProps) {
  const setup = <>
    {signInHref ? <div className={styles.empty}>
      <h3>Sign in to get started</h3>
      <p>Use the Owner account you want ChatGPT to read.</p>
      <Link className={styles.primary} href={signInHref}>Sign in to Aim4price</Link>
    </div> : resource ? <>
      <p className={styles.description}>Connect in ChatGPT, then sign in to Aim4price and approve read-only access.</p>
      <div className={styles.chatgptStart}>
        <a className={styles.primary} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT <span aria-hidden="true">↗</span></a>
        <p>Opens ChatGPT in a new tab. Opening it does not connect your account automatically.</p>
      </div>
      <ol className={styles.steps}>
        <li><span className={styles.stepNumber} aria-hidden="true">1</span><div><h3>Select your Aim4price plugin</h3><p>In ChatGPT, open Plugins and select the Aim4price plugin installed for your pilot. Choose Connect. If it already shows Connected, you can start asking questions.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">2</span><div><h3>Sign in and approve</h3><p>Check your Owner account, review what will be shared and allow read-only access.</p></div></li>
        <li><span className={styles.stepNumber} aria-hidden="true">3</span><div><h3>Ask about your assets</h3><p>Return to ChatGPT and use the Aim4price connection in your conversation.</p></div></li>
      </ol>
      <details className={styles.setup}>
        <summary>Can’t find Aim4price in ChatGPT?</summary>
        <p>Aim4price is currently a private pilot, so it may not appear in your ChatGPT plugins. Ask the person helping with your pilot to set it up first. Opening ChatGPT alone does not install it.</p>
        <details className={styles.technicalSetup}><summary>Technical setup for the pilot</summary>
        <p>Copy this address into the MCP server URL field when setting up the connection in ChatGPT. It is not a website or sign-in link; opening it in your browser will show an error.</p>
        <ServerAddress resource={resource} />
        <p className={styles.note}>No personal API key is needed. Never paste your password or a connection secret into a chat.</p>
        </details>
      </details>
      <p className={styles.note}>ChatGPT is available in the private pilot. Other assistants are not available yet.</p>
    </> : <>
      <p className={styles.description}>{disabled ? 'ChatGPT connections are not enabled for your account yet. Check your account below if you are joining the private pilot.' : 'Check your Owner account to help with connection setup.'}</p>
      <AccountSetup />
    </>}
  </>;

  const management = <>
    {account && <div className={styles.accountLine}><strong>{account.name}</strong><span>{account.email}</span></div>}
    {connections?.length ? <div className={styles.connectionList}>
      {connections.map(c => <div className={styles.connection} key={c.id}>
        <span className={styles.connectionIcon}><Icon /></span>
        <div className={styles.connectionCopy}>
          <h3>AI connection</h3>
          <p>Connected {date(c.created_at)} · Expires {date(c.expires_at)}</p>
        </div>
        <span className={styles.active}>Connected</span>
        <DisconnectButton id={c.id} />
      </div>)}
    </div> : <div className={styles.empty}>
      <h3>{connections ? 'No active connections' : 'Connection details unavailable'}</h3>
      <p>{connections ? 'Use Connect to set up ChatGPT. Once approved, its access will appear here.' : signInHref ? 'Sign in to view and manage your connections.' : 'Your connections will appear here once your account is ready.'}</p>
      {signInHref && <Link className={styles.primary} href={signInHref}>Sign in to Aim4price</Link>}
    </div>}
    <p className={styles.note}>Access lasts 30 days. Disconnect at any time to stop future access. Information already shared may remain in your AI conversations.</p>
  </>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/account" className={styles.back}>← Back to account</Link>
        <section className={`${accessStyles.launcher} ${styles.launcher}`} aria-labelledby="ai-connections-title">
          <div className={`${accessStyles.launcherIntro} ${styles.intro}`}>
            <h1 id="ai-connections-title">AI connections</h1>
            <p>{proof ? 'Review your account and approve read-only access.' : 'Connect ChatGPT. Ask about your assets. Stay in control.'}</p>
          </div>
          <div className={styles.safety}><Icon kind="shield" /><p><strong>Your records stay yours.</strong> AI can read information you approve, but cannot add, edit or delete your records.</p></div>
          {message && !disabled && <div className={styles.notice} role="alert"><h2>Connection unavailable</h2><p>{message}</p></div>}
          {proof ? <section className={styles.approval} aria-labelledby="approve-title">
            <h2 id="approve-title">Allow read-only access?</h2>
            {account && <div className={styles.identity}><span>Account being connected</span><strong>{account.name}</strong><span>{account.email}</span></div>}
            <p>This connection can read the following information from this Owner account only.</p>
            <SharedInformation />
            <form action="/api/ai/oauth/authorize" method="post">
              <input type="hidden" name="authorization" value={authorization || ''} />
              <input type="hidden" name="proof" value={proof} />
              <label className={styles.consent}><input type="checkbox" name="terms" value="accepted" required /><span>I accept the Aim4price <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and acknowledge the <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>. I authorise read-only access and understand that requested information is shared with my AI provider.</span></label>
              <p className={styles.note}>Access lasts 30 days. You can disconnect from this page at any time. Information already shared may remain in your AI conversations.</p>
              <div className={styles.actions}><button type="submit" className={styles.primary} name="decision" value="allow">Allow read-only access</button><button type="submit" name="decision" value="deny" formNoValidate>Cancel</button></div>
            </form>
          </section> : <ConnectionActions setup={setup} management={management} count={connections?.length} />}
        </section>
        {!proof && <details className={styles.examples}>
          <summary className={styles.exampleHeading}>
            <span className={styles.exampleHeadingCopy}><span className={styles.exampleTitle}>Turn your records into answers</span><span>Explore questions about assets, budgets, fuel and maintenance.</span></span>
            <span className={styles.exampleChevron} aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></span>
          </summary>
          <div className={styles.examplesBody}>
            <p className={styles.questionHint}>Once connected, copy a question into ChatGPT and select Aim4price in your conversation.</p>
            <SharedInformation examples />
            <details className={styles.disclosure}>
              <summary>What information is shared?</summary>
              <div className={styles.sharingDetails}>
                <div><h3>Only your connected account</h3><p>ChatGPT can retrieve your account profile and the records described above. It cannot access another Owner’s account through this connection.</p></div>
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
