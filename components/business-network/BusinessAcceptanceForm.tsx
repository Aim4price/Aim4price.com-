'use client';
import { useId, useRef, useState } from 'react';
import styles from './BusinessAcceptanceForm.module.css';

type Place = { id: string; displayName?: { text: string }; formattedAddress?: string; googleMapsUri?: string };
export default function BusinessAcceptanceForm({ businessName = '', embedded = false }: { businessName?: string; embedded?: boolean }) {
  const id = useId();
  const [done, setDone] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [searching, setSearching] = useState(false), [searchNotice, setSearchNotice] = useState('');
  const [places, setPlaces] = useState<Place[]>([]), [selected, setSelected] = useState<Place | null>(null);
  const [name, setName] = useState(businessName), [mapsUrl, setMapsUrl] = useState(''), [confirmed, setConfirmed] = useState(false);
  const requestId = useRef(0), nameInput = useRef<HTMLInputElement>(null);

  function manual() {
    requestId.current++;
    setSearching(false); setSelected(null); setPlaces([]); setConfirmed(false); setSearchNotice('');
    nameInput.current?.focus();
  }
  async function search() {
    if (query.trim().length < 3) { setSearchNotice('Enter your business name and town.'); return; }
    const current = ++requestId.current;
    setSearching(true); setSearchNotice(''); setPlaces([]); setSelected(null); setConfirmed(false);
    try {
      const response = await fetch('/api/business-network/accept/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search unavailable. Enter your details below.');
      if (current !== requestId.current) return;
      setPlaces(data.places || []);
      if (!data.places?.length) setSearchNotice('No matches found. Try adding your town, or enter your details below.');
    } catch (e) { if (current === requestId.current) setSearchNotice(e instanceof Error ? e.message : 'Search unavailable. Enter your details below.'); }
    finally { if (current === requestId.current) setSearching(false); }
  }

  return <section className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>AIM4PRICE BUSINESS DIRECTORY</span>
      <h1>Let asset owners find your business.</h1>
      <p>Make it easier for owners to reach you for repairs, servicing, replacement quotes and the services you offer.</p>
      <span className={styles.reassurance}>Free basic listing · No Aim4price account required</span>
    </header>
    {done ? <section className={styles.card} role="status" tabIndex={-1} ref={node => node?.focus()}>
      <span className={styles.icon} aria-hidden="true">✓</span>
      <h2>Thank you—your acceptance is recorded.</h2>
      <p>Aim4price will review your details before adding your business to the directory. Your listing is not public yet.</p>
      <p>Submitting this form does not create an account or activate paid access.</p>
    </section> : <>
      <div className={styles.benefits}>
        <article><Icon kind="pin"/><h2>Get found</h2><p>Help owners discover your business when they need your services.</p></article>
        <article><Icon kind="asset"/><h2>Understand the request</h2><p>Receive a link to the asset details and photos the owner chooses to share.</p></article>
        <article><Icon kind="message"/><h2>Keep it familiar</h2><p>Receive enquiries through your existing email or confirmed WhatsApp number.</p></article>
      </div>
      <div className={styles.layout}>
        <aside className={styles.explainer}>
          <h2>A simple way to get involved.</h2>
          <p>Find your business, confirm how owners can contact you, and give permission for a free listing.</p>
          <ol><li><strong>You confirm your details.</strong><span>Choose your Google listing or enter them yourself.</span></li><li><strong>We review your submission.</strong><span>Aim4price checks the details before publishing.</span></li><li><strong>Owners can contact you.</strong><span>Discuss the request directly by email or WhatsApp.</span></li></ol>
          <div className={styles.optional}><h3>Want to do more?</h3><p>An Aim4price account is a separate option for managing leads and documents inside the platform. Some shared reports and actions require additional access.</p><a href="/contact-us">Ask about an Aim4price account →</a></div>
        </aside>
        <div className={styles.card}>
          <section className={styles.lookup} aria-labelledby={`${id}-find`}>
            <h2 id={`${id}-find`}>Find your business on Google</h2>
            <p>Search by business name and town, then choose the correct listing.</p>
            <form className={styles.search} onSubmit={event => { event.preventDefault(); void search(); }}>
              <label className={styles.searchField}>Business name and town<input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. S Haddad, George" maxLength={200}/></label>
              <button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search Google'}</button>
            </form>
            <div className={styles.searchLinks}><button type="button" onClick={manual}>Enter details manually</button><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'businesses near me')}`} target="_blank" rel="noopener noreferrer">Open Google Maps ↗</a></div>
            {searchNotice && <p role="status" className={styles.notice}>{searchNotice}</p>}
            {places.length > 0 && !selected && <div className={styles.results} aria-label="Google search results"><span className={styles.muted}>Results from Google Maps</span>{places.map(place => <button type="button" key={place.id} onClick={() => { setSelected(place); setConfirmed(false); }}><strong>{place.displayName?.text}</strong><span>{place.formattedAddress}</span><small>Select business →</small></button>)}</div>}
            {selected && <div className={styles.preview}><span className={styles.muted}>Selected Google listing</span><strong>{selected.displayName?.text}</strong><p>{selected.formattedAddress}</p><button type="button" disabled={confirmed} onClick={() => { setName(selected.displayName?.text || ''); setMapsUrl(selected.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.displayName?.text || '')}&query_place_id=${encodeURIComponent(selected.id)}`); setConfirmed(true); nameInput.current?.focus(); }}>{confirmed ? 'Business selected ✓' : 'Yes, this is my business'}</button><button type="button" onClick={() => { setSelected(null); setConfirmed(false); }}>Choose another business</button></div>}
          </section>
          <form className={styles.details} onSubmit={async event => {
            event.preventDefault(); setError('');
            if (selected && !confirmed) { setError('Confirm the selected Google listing first, or choose Enter details manually.'); return; }
            setBusy(true); const form = new FormData(event.currentTarget);
            try {
              const response = await fetch('/api/business-network/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(form), googlePlaceId: confirmed ? selected?.id : '', googleConfirmed: confirmed, whatsappConfirmed: form.get('whatsappConfirmed') === 'on', accepted: form.get('accepted') === 'on' }) });
              const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Please try again.'); setDone(true);
            } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
          }}>
            <h2>Confirm your details</h2><p>Check these details yourself. Your email is where owners can send enquiries.</p>
            <label>Business name<input ref={nameInput} name="businessName" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={200} autoComplete="organization"/></label>
            <label>Town or area<input name="town" maxLength={150} autoComplete="address-level2"/></label>
            <label>Google Maps link <small>Optional</small><input name="googleMapsUrl" type="url" value={mapsUrl} onChange={e => { setMapsUrl(e.target.value); setConfirmed(false); setSelected(null); }} placeholder="Paste your Google Maps link" maxLength={1000}/></label>
            <div className={styles.twoColumns}><label>Your name<input name="contactName" required minLength={2} maxLength={150} autoComplete="name"/></label><label>Business email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label></div>
            <label>Phone number <small>Optional</small><input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label>
            <label className={styles.check}><input name="whatsappConfirmed" type="checkbox"/>This number accepts WhatsApp enquiries.</label>
            <label className={`${styles.check} ${styles.consent}`}><input name="accepted" type="checkbox" required/>I represent this business, confirm these details are correct, and agree to a public directory listing and enquiries from Aim4price users.</label>
            <p className={styles.muted}>Your submitted business contact details may appear in the directory. Read our <a href="/privacy-policy">Privacy Policy</a>. There is no charge for submitting this form.</p>
            {error && <p role="alert" className={styles.notice}>{error}</p>}
            <button className={styles.primary} disabled={busy || searching}>{busy ? 'Submitting…' : 'Submit my free listing'}</button>
            <small className={styles.review}>Aim4price reviews your details before publishing.</small>
          </form>
        </div>
      </div>
    </>}
  </section>;
}
function Icon({ kind }: { kind: 'pin' | 'asset' | 'message' }) {
  return <span className={styles.icon}><svg viewBox="0 0 24 24" aria-hidden="true">{kind === 'pin' ? <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></> : kind === 'asset' ? <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></> : <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z"/>}</svg></span>;
}
