"use client";
import BusinessAcceptanceForm from "../../../components/business-network/BusinessAcceptanceForm";
import { useEffect, useState, useRef } from "react";
import BusinessLocation from "../../../components/business-network/BusinessLocation";
import {
  BUSINESS_HEADINGS,
  BUSINESS_SERVICES,
} from "../../../lib/business-network-shared";
import styles from "../../../components/business-network/BusinessNetwork.module.css";
import type { AdminBusiness } from "../../../lib/admin-business-network";
type Fields = {
  name: string;
  phone: string;
  website: string;
  address: string;
  town: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
  nationwide: boolean;
  headings: string[];
  services: string[];
  googlePlaceId: string;
  googleMapsUrl: string;
};
const defaults: Fields = {
  name: "",
  phone: "",
  website: "",
  address: "",
  town: "",
  latitude: "",
  longitude: "",
  radiusKm: "50",
  nationwide: false,
  headings: [],
  services: [],
  googlePlaceId: "",
  googleMapsUrl: "",
};
type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  primaryTypeDisplayName?: { text: string };
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  addressComponents?: Array<{longText?: string; types?: string[]}>;
  location?: {latitude: number; longitude: number};
  businessStatus?: string;
  attributions?: Array<{provider?: string; providerUri?: string}>;
};
export default function BusinessJoin({
  adminMode = false,
  adminBusiness = null,
  onAdminSaved,
}: {
  adminMode?: boolean;
  adminBusiness?: AdminBusiness | null;
  onAdminSaved?: (published: boolean) => void;
}) {
  const tokenRef = useRef("");
  const [token, setToken] = useState(""),
    [fields, setFields] = useState(defaults),
    [email, setEmail] = useState(""),
    [status, setStatus] = useState(adminMode ? "new" : ""),
    [notice, setNotice] = useState(adminMode ? "" : "Loading invitation…"),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false),
    [service, setService] = useState(""),
    [heading, setHeading] = useState(""),
    [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [entryMode, setEntryMode] = useState<'google' | 'manual'>('google'),
    [searching, setSearching] = useState(false),
    [searchNotice, setSearchNotice] = useState(''),
    [linking, setLinking] = useState(''),
    [linkedPlace, setLinkedPlace] = useState<Place | null>(null),
    [detailsVerified, setDetailsVerified] = useState(false);
  const detailsRequest = useRef(0);
  const populated = useRef<Partial<Fields>>({});
  const businessNameInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { detailsRequest.current++; }, []);
  useEffect(() => {
    if (entryMode === 'manual') businessNameInput.current?.focus();
  }, [entryMode]);
  useEffect(() => {
    if (adminMode) {
      if (adminBusiness) {
        const b = adminBusiness;
        setFields({
          ...defaults,
          ...b.details,
          name: b.name,
          latitude: String(b.details.latitude ?? ""),
          longitude: String(b.details.longitude ?? ""),
          radiusKm: String(b.details.radiusKm ?? 50),
        });
        setEmail(b.email);
        setStatus(b.status);
        setQuery(`${b.name} ${b.details.town || ""}`);
      }
      return;
    }
    const token = tokenRef.current || window.location.hash.slice(1);
    tokenRef.current = token;
    history.replaceState(null, "", window.location.pathname);
    setToken(token);
    if (!token) { setNotice("Open your invitation link to accept a listing, or request a management link for an existing invitation."); return; }
    fetch("/api/business-network/profile", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        const b = d.business;
        setFields({
          ...defaults,
          ...b.details,
          name: b.name,
          latitude: String(b.details.latitude ?? ""),
          longitude: String(b.details.longitude ?? ""),
          radiusKm: String(b.details.radiusKm ?? 50),
        });
        setEmail(b.email);
        setStatus(b.status);
        setQuery(`${b.name} ${b.details.town || ""}`);
        setNotice("");
      })
      .catch((e) => setNotice(e.message));
  }, [adminMode, adminBusiness]);
  const set = (key: keyof Fields, value: unknown) => {
    setDetailsVerified(false);
    setFields((current) => ({ ...current, [key]: value }));
  };
  async function save(action = "save") {
    if (linking) return;
    if (linkedPlace && action !== 'pause' && !detailsVerified) {
      setNotice('Confirm the listing details directly with the business or its own website before saving.');
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const r = await fetch(
        adminMode
          ? "/api/admin/business-network"
          : "/api/business-network/profile",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(adminMode ? {} : { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            ...fields,
            action,
            accepted,
            ...(linkedPlace ? { googleDetailsUsed: true, detailsVerified } : {}),
            ...(adminMode ? { email, id: adminBusiness?.id } : {}),
          }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (adminMode) {
        onAdminSaved?.(action === "save_publish");
        return;
      }
      if (action === "pause") setStatus("paused");
      setNotice(
        action === "pause"
          ? "Your listing is hidden and requests are stopped."
          : status === "active"
            ? "Your listing details have been updated."
            : "Your details are saved. Aim4price will review and publish your listing.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  async function linkBusiness(place: Place) {
    const requestId = ++detailsRequest.current;
    setLinking(place.id);
    setSearchNotice('');
    try {
      const response = await fetch('/api/business-network/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(adminMode ? {} : { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ placeId: place.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (requestId !== detailsRequest.current) return;
      const detail: Place = data.place;
      if (!detail || detail.id !== place.id) throw new Error('This business could not be loaded. Try again.');
      const town = ['locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2']
        .map(type => detail.addressComponents?.find(component => component.types?.includes(type))?.longText).find(Boolean) || '';
      const next: Partial<Fields> = {
        name: detail.displayName?.text || '', phone: detail.nationalPhoneNumber || '',
        website: detail.websiteUri || '', address: detail.formattedAddress || '', town,
        latitude: Number.isFinite(detail.location?.latitude) ? String(detail.location!.latitude) : '',
        longitude: Number.isFinite(detail.location?.longitude) ? String(detail.location!.longitude) : '',
      };
      const previous = populated.current;
      setFields(current => {
        const updated = {...current, googlePlaceId: detail.id, googleMapsUrl: detail.googleMapsUri || ''};
        for (const key of ['name', 'phone', 'website', 'address', 'town', 'latitude', 'longitude'] as const) {
          if (!current[key].trim() || current[key] === previous[key]) updated[key] = next[key] || '';
        }
        return updated;
      });
      populated.current = next;
      setLinkedPlace(detail);
      setDetailsVerified(false);
      setPlaces([]);
      setNotice('Google details loaded. Review the fields below, add the enquiry email and choose the services. Your own entries have been kept.');
      businessNameInput.current?.scrollIntoView({behavior: 'smooth', block: 'center'});
    } catch (error) {
      if (requestId === detailsRequest.current) setSearchNotice(error instanceof Error ? error.message : 'Unable to load business details. Enter them manually.');
    } finally {
      if (requestId === detailsRequest.current) setLinking('');
    }
  }
  async function searchGoogle() {
    if (linking || searching) return;
    setSearching(true);
    setSearchNotice('');
    setPlaces([]);
    try {
      const r = await fetch("/api/business-network/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminMode ? {} : { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPlaces(d.places);
      setSearchNotice(d.places.length ? '' : 'No matching businesses found. Try adding the town, or enter the business manually.');
    } catch (e) {
      setSearchNotice(e instanceof Error ? e.message : 'Search unavailable. You can enter the business manually.');
    } finally {
      setSearching(false);
    }
  }
  if (!adminMode && !token && notice.startsWith("Open your invitation")) return <BusinessAcceptanceForm/>;
  const Container = adminMode ? "section" : "main";
  const Heading = adminMode ? "h2" : "h1";
  return (
    <Container className={`${styles.panel} ${styles.page}`}>
      <Heading>
        {adminMode
          ? adminBusiness?.id
            ? "Edit business"
            : "Add business"
          : status === "invited"
            ? "Join Aim4price"
            : "Your business listing"}
      </Heading>
      <p>
        {adminMode
          ? "Search Google or enter the business yourself. As admin, you can save and publish immediately without an invitation or business acceptance."
          : "Would you like your business to be part of the Aim4price directory?"}
      </p>
      {!adminMode && status !== "active" && status !== "paused" ? (
        <section className={styles.invitationOptions} aria-label="Ways to join Aim4price">
          <div className={styles.card}>
            <h2>Free directory listing</h2>
            <p>Help asset owners find your business. Receive messages, asset photos and reports through email or WhatsApp.</p>
            <p>No Aim4price account is required. Complete the details below to accept. Aim4price will review and publish your listing.</p>
          </div>
          <div className={styles.card}>
            <h2>With an Aim4price account</h2>
            <p>Show an Aim4price account badge and receive leads inside Aim4price. Access shared asset information according to the owner’s permissions.</p>
            <a className={styles.button} href="/auth">Explore an Aim4price account</a>
            <p className={styles.muted}>Account registration and approval are separate from your free listing.</p>
          </div>
        </section>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {!adminMode && !status ? <a href="/business-network/manage">Request a management link</a> : null}
      {status ? (
        <>
          <div className={styles.entryActions} aria-label="Business entry method">
            <button type="button" className={entryMode === 'google' ? styles.primary : styles.button} aria-pressed={entryMode === 'google'} onClick={() => setEntryMode('google')}>Search Google</button>
            <button type="button" className={entryMode === 'manual' ? styles.primary : styles.button} aria-pressed={entryMode === 'manual'} onClick={() => setEntryMode('manual')}>Enter manually</button>
          </div>
          {entryMode === 'manual' && <p className={styles.notice}>Enter the business details below. Google is optional. {adminMode ? 'Use Save and publish to approve it yourself.' : 'Aim4price will review your listing.'}</p>}
          {entryMode === 'google' && <form className={styles.card} aria-label="Google business search" onSubmit={event => { event.preventDefault(); if (!searching && query.trim().length >= 3) void searchGoogle(); }}>
            <h2>Find a business on Google</h2>
            <label>
              Business name and town
              <input value={query} placeholder="For example: S Haddad, George" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button
              type="submit"
              disabled={searching || Boolean(linking) || query.trim().length < 3}

            >
              {searching ? 'Searching Google…' : 'Find on Google'}
            </button>
            {searchNotice && <p role="status" className={styles.notice}>{searchNotice}</p>}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim() || 'businesses near me')}`} target="_blank" rel="noreferrer">Open search in Google Maps</a>
            {places.length ? (
              <div className={styles.card}>
                <span style={{ fontSize: 14, fontWeight: 400 }} translate="no">
                  Google Maps
                </span>
                {places.map((p) => (
                  <div key={p.id}>
                    <strong>{p.displayName?.text}</strong>
                    <p>{p.formattedAddress}</p>
                    <p>{p.primaryTypeDisplayName?.text}</p>
                    <button
                      type="button"
                      disabled={Boolean(linking) || busy}
                      onClick={() => void linkBusiness(p)}
                    >
                      {linking === p.id ? 'Loading business details…' : 'Link this business'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <p className={styles.muted}>Google is optional. You can enter the business details manually.</p>
            <label>
              Google Maps link · optional
              <input
                value={fields.googleMapsUrl}
                onChange={(e) => set("googleMapsUrl", e.target.value)}
              />
            </label>
          </form>}
          {linkedPlace && <section className={styles.card} aria-label="Linked Google business">
            <strong>{linkedPlace.displayName?.text || 'Linked business'}</strong>
            <p>{linkedPlace.primaryTypeDisplayName?.text}</p>
            <span translate="no">Google Maps</span>
            {linkedPlace.attributions?.map((a, index) => <p key={index}>{a.providerUri && /^https?:\/\//i.test(a.providerUri) ? <a href={a.providerUri} target="_blank" rel="noreferrer">{a.provider}</a> : a.provider}</p>)}
            {linkedPlace.businessStatus && linkedPlace.businessStatus !== 'OPERATIONAL' && <p role="alert">Google marks this business as {linkedPlace.businessStatus === 'CLOSED_PERMANENTLY' ? 'permanently closed' : 'temporarily closed'}. Check with the business before publishing.</p>}
            <p>Google does not supply an enquiry email. Enter the address the business wants to receive requests at.</p>
          </section>}
          <form
            className={styles.panel}
            onSubmit={(e) => {
              e.preventDefault();
              const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              void save(adminMode && submitter?.value === 'save_publish' ? 'save_publish' : 'save');
            }}
          >
            <label>
              Business name
              <input
                required
                ref={businessNameInput}
                value={fields.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label>
              Request email
              <input
                type="email"
                required
                value={email}
                readOnly={!adminMode || Boolean(adminBusiness?.id)}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <p className={styles.muted}>
              {adminMode
                ? adminBusiness?.id
                  ? "The delivery email stays fixed for this listing."
                  : "Owner enquiries will be sent to this address."
                : "Contact Aim4price to change this verified email address."}
            </p>
            {(["phone", "website", "address", "town"] as const).map((key) => (
              <label key={key}>
                {
                  {
                    phone: "Phone",
                    website: "Website",
                    address: "Business address",
                    town: "Town / city",
                  }[key]
                }
                <input
                  required={key === "town"}
                  value={fields[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </label>
            ))}
            <section className={styles.card}>
              <h2>Business location</h2>
              {!linkedPlace && <BusinessLocation
                latitude={fields.latitude}
                longitude={fields.longitude}
                town={fields.town}
                onChange={(latitude, longitude, town) =>
                  setFields((current) => ({
                    ...current,
                    latitude,
                    longitude,
                    ...(town ? { town } : {}),
                  }))
                }
              />}
              <button
                type="button"
                onClick={() =>
                  navigator.geolocation
                    ? navigator.geolocation.getCurrentPosition(
                        (p) => {
                          set("latitude", String(p.coords.latitude));
                          set("longitude", String(p.coords.longitude));
                        },
                        () =>
                          setNotice(
                            "Location unavailable. Enter your business coordinates below.",
                          ),
                      )
                    : setNotice(
                        "Location unavailable. Enter your business coordinates below.",
                      )
                }
              >
                Use my current location
              </button>
              <p className={styles.muted}>
                Use this while at your business, or enter its map coordinates.
              </p>
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  required
                  min="-90"
                  max="90"
                  value={fields.latitude}
                  onChange={(e) => set("latitude", e.target.value)}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  required
                  min="-180"
                  max="180"
                  value={fields.longitude}
                  onChange={(e) => set("longitude", e.target.value)}
                />
              </label>
              <label>
                Distance you serve (km)
                <input
                  type="number"
                  required
                  min="1"
                  max="2000"
                  value={fields.radiusKm}
                  onChange={(e) => set("radiusKm", e.target.value)}
                />
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={fields.nationwide}
                  onChange={(e) => set("nationwide", e.target.checked)}
                />
                Nationwide
              </label>
            </section>
            {(["headings", "services"] as const).map((key) => (
              <section key={key} className={styles.card}>
                <h2>{key === "headings" ? "Business headings" : "Services"}</h2>
                <div className={styles.choices}>
                  {[
                    ...new Set([
                      ...(key === "headings"
                        ? BUSINESS_HEADINGS
                        : BUSINESS_SERVICES),
                      ...fields[key],
                    ]),
                  ].map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={fields[key].includes(v)}
                      onClick={() =>
                        set(
                          key,
                          fields[key].includes(v)
                            ? fields[key].filter((x) => x !== v)
                            : [...fields[key], v],
                        )
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <label>
                  {key === "headings"
                    ? "Add another heading"
                    : "Add another service"}
                  <input
                    value={key === "headings" ? heading : service}
                    onChange={(e) =>
                      key === "headings"
                        ? setHeading(e.target.value)
                        : setService(e.target.value)
                    }
                    maxLength={100}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const v = (key === "headings" ? heading : service).trim();
                    if (v) set(key, [...new Set([...fields[key], v])]);
                    key === "headings" ? setHeading("") : setService("");
                  }}
                >
                  Add
                </button>
              </section>
            ))}
            {linkedPlace && <label className={styles.check}>
              <input type="checkbox" required checked={detailsVerified} onChange={event => setDetailsVerified(event.target.checked)} />
              I have independently checked these listing details with the business or its own website and have permission to publish them.
            </label>}
            {!adminMode ? (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  required
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                I represent this business and agree to show these details to all
                Aim4price owners and receive their requests by email or WhatsApp.
              </label>
            ) : null}
            {adminMode ? <section className={styles.card} aria-label="Manual approval">
              <h2>Publish this business</h2>
              <p>You control approval. Save and publish adds this business to the directory immediately, without sending an invitation.</p>
              <div className={styles.entryActions}>
                <button className={styles.button} disabled={busy || Boolean(linking)} type="submit" name="action" value="save">{status === 'active' ? 'Save changes' : 'Save draft'}</button>
                <button className={styles.primary} disabled={busy || Boolean(linking)} type="submit" name="action" value="save_publish">{busy ? 'Saving…' : 'Save and publish'}</button>
              </div>
            </section> : <button className={styles.primary} disabled={busy || Boolean(linking)} type="submit">
              {busy ? 'Saving…' : status === 'invited' ? 'Accept free listing' : 'Save listing'}
            </button>}
          </form>
          {status === "active" ? (
            <button
              className={styles.danger}
              disabled={busy || Boolean(linking)}
              onClick={() => void save("pause")}
            >
              Hide listing and stop requests
            </button>
          ) : null}
          <a href="/privacy-policy">Privacy policy</a>
          {!adminMode ? (
            <a href="/business-network/manage">Request a new management link</a>
          ) : null}
        </>
      ) : null}
    </Container>
  );
}
