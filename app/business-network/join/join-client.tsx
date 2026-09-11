"use client";
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
};
export default function BusinessJoin({
  adminMode = false,
  adminBusiness = null,
  onAdminSaved,
}: {
  adminMode?: boolean;
  adminBusiness?: AdminBusiness | null;
  onAdminSaved?: () => void;
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
    [places, setPlaces] = useState<Place[]>([]);
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
  const set = (key: keyof Fields, value: unknown) =>
    setFields((current) => ({ ...current, [key]: value }));
  async function save(action = "save") {
    setBusy(true);
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
            ...(adminMode ? { email, id: adminBusiness?.id } : {}),
          }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (adminMode) {
        onAdminSaved?.();
        return;
      }
      setStatus(action === "pause" ? "paused" : "active");
      setNotice(
        action === "pause"
          ? "Your listing is hidden and requests are stopped."
          : "Your business is now listed. Requests will arrive by email.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  const Container = adminMode ? "section" : "main";
  const Heading = adminMode ? "h2" : "h1";
  return (
    <Container className={`${styles.panel} ${styles.page}`}>
      <Heading>
        {adminMode
          ? adminBusiness
            ? "Edit business"
            : "Add business"
          : status === "invited"
            ? "Join Aim4price"
            : "Your business listing"}
      </Heading>
      <p>
        {adminMode
          ? "Publish directly to the owner directory. No invitation is required."
          : "No subscription or login needed."}
      </p>
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {status ? (
        <>
          <section className={styles.card}>
            <h2>Find your Google business</h2>
            <label>
              Business name and town
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch("/api/business-network/google", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(adminMode
                        ? {}
                        : { Authorization: `Bearer ${token}` }),
                    },
                    body: JSON.stringify({ query }),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setPlaces(d.places);
                  setNotice(
                    d.places.length
                      ? ""
                      : "No matches. Add your details below.",
                  );
                } catch (e) {
                  setNotice(
                    e instanceof Error ? e.message : "Search unavailable.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Find on Google
            </button>
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
                      onClick={() => {
                        set("googlePlaceId", p.id);
                        set("googleMapsUrl", p.googleMapsUri || "");
                        setPlaces([]);
                        setNotice(
                          "Google listing linked. Add your business details below.",
                        );
                      }}
                    >
                      Link this business
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <p className={styles.muted}>
              No Google listing? Fill in your details below.
            </p>
            <label>
              Google Maps link · optional
              <input
                value={fields.googleMapsUrl}
                onChange={(e) => set("googleMapsUrl", e.target.value)}
              />
            </label>
          </section>
          <form
            className={styles.panel}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              Business name
              <input
                required
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
                readOnly={!adminMode || Boolean(adminBusiness)}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <p className={styles.muted}>
              {adminMode
                ? adminBusiness
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
              <BusinessLocation
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
              />
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
            {!adminMode ? (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  required
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                I represent this business and agree to show these details to all
                Aim4price owners and receive their requests by email.
              </label>
            ) : null}
            <button className={styles.primary} disabled={busy} type="submit">
              {busy
                ? "Saving…"
                : adminMode
                  ? "Publish business"
                  : status === "invited"
                    ? "Accept and join"
                    : "Save listing"}
            </button>
          </form>
          {status === "active" ? (
            <button
              className={styles.danger}
              disabled={busy}
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
