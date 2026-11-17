'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './AssetTrackingOptions.module.css';

type IconKind = 'tracker' | 'phone' | 'sim' | 'power' | 'whatsapp' | 'email' | 'call';
function TrackingIcon({ kind }: { kind: IconKind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'tracker' ? <><rect x="7" y="8" width="10" height="13" rx="3"/><circle cx="12" cy="14" r="1.5"/><path d="M8 5a6 6 0 0 1 8 0M5 2a10 10 0 0 1 14 0"/></>
      : kind === 'phone' ? <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/></>
      : kind === 'sim' ? <><path d="M9 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z"/><rect x="8" y="10" width="8" height="7" rx="1"/><path d="M12 10v7M8 13.5h8"/></>
      : kind === 'power' ? <><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4M11 8l-3 4h5l-3 4"/></>
      : kind === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>
      : kind === 'call' ? <path d="m7 3-3 2c-1 1 1 7 5 11s10 6 11 5l2-3-5-3-2 2c-3-1-7-5-8-8l2-2-2-4Z"/>
      : <><path d="M20.5 11.5a9 9 0 0 1-13.2 8L3 21l1.5-4.3a9 9 0 1 1 16-5.2Z"/><path d="m8 7-1 1c-.5 2 4 7 7 7l1-1-2-2-1 1c-1.5-.5-3-2-3.5-3.5l1-1Z"/></>}
  </svg>;
}

export default function AssetTrackingOptions({ assetTitle, connected, onPhone, onBack }: {
  assetTitle: string; connected: boolean; onPhone: () => void; onBack?: () => void;
}) {
  const [existing, setExisting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [existing]);
  const message = `Hello Aim4price, my ${assetTitle} already has a tracker. Could you check whether it can connect to Aim4price? Please let me know what information you need.`;
  const emailHref = `mailto:aim4price@gmail.com?subject=${encodeURIComponent(`Tracker connection enquiry — ${assetTitle}`)}&body=${encodeURIComponent(message)}`;

  return <section className={styles.flow} data-tracking-options={existing ? 'existing' : 'choice'} aria-label="Asset tracking options">
    {existing ? <>
      <div className={styles.intro}>
        <h4 ref={heading} tabIndex={-1}>Connect an existing tracker</h4>
        <p>Contact us to check compatibility with your tracking provider.</p>
      </div>
      <div className={styles.message}>
        <strong>Your message</strong>
        <p>{message}</p>
      </div>
      <div className={styles.contacts}>
        <a className={`${styles.contact} ${styles.green}`} href={`https://wa.me/27625721650?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          <span className={styles.icon}><TrackingIcon kind="whatsapp"/></span><span><strong>WhatsApp</strong><small>062 572 1650</small></span>
        </a>
        <a className={`${styles.contact} ${styles.blue}`} href={emailHref}>
          <span className={styles.icon}><TrackingIcon kind="email"/></span><span><strong>Email</strong><small>aim4price@gmail.com</small></span>
        </a>
        <a className={`${styles.contact} ${styles.amber}`} href="tel:+27625721650">
          <span className={styles.icon}><TrackingIcon kind="call"/></span><span><strong>Call</strong><small>062 572 1650</small></span>
        </a>
      </div>
      <p className={styles.note}>WhatsApp and Email prepare this message for you to review and send.</p>
    </> : <>
      <div className={styles.intro}>
        <h4 ref={heading} tabIndex={-1}>How would you like to track it?</h4>
        <p>Connect a compatible tracker or use a dedicated Android phone.</p>
      </div>
      <div className={styles.choices}>
        <button type="button" className={`${styles.choice} ${styles.purple}`} onClick={() => setExisting(true)}>
          <span className={styles.icon}><TrackingIcon kind="tracker"/></span><span><strong>Connect an existing tracker</strong><small>Let us check if it can connect.</small></span>
        </button>
        <button type="button" className={`${styles.choice} ${styles.green}`} onClick={onPhone}>
          <span className={styles.icon}><TrackingIcon kind="phone"/></span><span><strong>{connected ? 'View connected phone' : 'Use a tracking phone'}</strong><small>{connected ? 'Open your phone’s tracking status and controls.' : 'Track with the Aim4price app.'}</small></span>
        </button>
      </div>
    </>}
    {(existing || onBack) && <div className={styles.footer}><button type="button" className={styles.back} onClick={existing ? () => setExisting(false) : onBack}>Back</button></div>}
  </section>;
}

export function PhoneTrackingRequirements() {
  return <section className={styles.requirements} aria-label="Tracking phone requirements">
    <ul>
      <li><TrackingIcon kind="phone"/><span><strong>Android phone</strong><span>GPS enabled, kept with the asset.</span></span></li>
      <li><TrackingIcon kind="sim"/><span><strong>SIM with data</strong><span>Sends locations to Aim4price.</span></span></li>
      <li><TrackingIcon kind="power"/><span><strong>Reliable power</strong><span>Keep the phone charged.</span></span></li>
    </ul>
  </section>;
}
