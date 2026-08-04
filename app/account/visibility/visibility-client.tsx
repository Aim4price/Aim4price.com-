"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import AccountSectionLayout from "../account-section-layout";
import type { AccountProfile, AccountProfileResponse } from "../account-types";
import {
  buildProfileUpdatePayload,
  isOwnerProfile,
  profileDisplayName,
  profileLocation,
  readResponseError,
} from "../account-types";
import styles from "../account-system.module.css";

type Props = { initialProfile: AccountProfile };
type Notice = { tone: "success" | "error"; message: string } | null;

const DEFAULT_MAP_CENTER: [number, number] = [-29, 24];
const LEAFLET_SCRIPT_ID = "aim4price-leaflet-script";
const LEAFLET_CSS_ID = "aim4price-leaflet-css";
let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("The map is only available in your browser."));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const ready = () => {
      const leaflet = (window as any).L;
      if (leaflet) resolve(leaflet);
      return Boolean(leaflet);
    };
    if (ready()) return;

    let script = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = LEAFLET_SCRIPT_ID;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", () => { if (!ready()) reject(new Error("The map did not initialise correctly.")); });
    script.addEventListener("error", () => reject(new Error("The map could not be loaded.")));
  });

  return leafletPromise;
}

function validPin(profile: AccountProfile): { lat: number; lng: number } | null {
  const lat = Number(profile.partnerLatitude);
  const lng = Number(profile.partnerLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) < 0.000001 || Math.abs(lng) < 0.000001) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function initials(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "A").toUpperCase();
}

export default function VisibilityClient({ initialProfile }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(initialProfile);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const radiusRef = useRef<any>(null);
  const owner = isOwnerProfile(profile);
  const partner = !owner;
  const pin = useMemo(() => validPin(draft), [draft.partnerLatitude, draft.partnerLongitude]);
  const displayName = profileDisplayName(draft);
  const publicPhone = draft.marketplacePhone.trim() || draft.phone.trim() || "Contact number not added";
  const publicEmail = draft.marketplaceEmail.trim() || draft.email.trim();
  const publicLocation = draft.marketplaceLocation.trim() || profileLocation(draft);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(profile);

  function update<K extends keyof AccountProfile>(key: K, value: AccountProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function setPin(lat: number, lng: number) {
    setDraft((current) => ({ ...current, partnerLatitude: Number(lat.toFixed(6)), partnerLongitude: Number(lng.toFixed(6)) }));
    setNotice(null);
  }

  useEffect(() => {
    if (!partner || !mapElementRef.current) return;
    let cancelled = false;

    void loadLeaflet().then((L) => {
      if (cancelled || !mapElementRef.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(mapElementRef.current, { zoomControl: true, scrollWheelZoom: true })
          .setView(pin ? [pin.lat, pin.lng] : DEFAULT_MAP_CENTER, pin ? 11 : 5);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
          detectRetina: true,
        }).addTo(mapRef.current);
        mapRef.current.on("click", (event: any) => setPin(event.latlng.lat, event.latlng.lng));
      }

      markerRef.current?.remove();
      radiusRef.current?.remove();
      markerRef.current = null;
      radiusRef.current = null;

      if (pin) {
        const icon = L.divIcon({ className: "accountDirectoryMarker", html: "<span>PIN</span>", iconSize: [45, 45], iconAnchor: [22, 45] });
        const marker = L.marker([pin.lat, pin.lng], { draggable: true, icon, title: "Public directory location" }).addTo(mapRef.current);
        marker.on("dragend", () => { const point = marker.getLatLng(); setPin(point.lat, point.lng); });
        markerRef.current = marker;
        const radius = Number(draft.partnerServiceRadiusKm);
        if (Number.isFinite(radius) && radius > 0) {
          radiusRef.current = L.circle([pin.lat, pin.lng], { radius: radius * 1000, color: "#1f8a66", fillColor: "#1f8a66", fillOpacity: 0.08, opacity: 0.4, weight: 2 }).addTo(mapRef.current);
        }
        mapRef.current.setView([pin.lat, pin.lng], Math.max(mapRef.current.getZoom(), 8));
      }

      window.requestAnimationFrame(() => mapRef.current?.invalidateSize());
    }).catch((error) => {
      if (!cancelled) setNotice({ tone: "error", message: error instanceof Error ? error.message : "The map could not be loaded." });
    });

    return () => { cancelled = true; };
  }, [partner, pin?.lat, pin?.lng, draft.partnerServiceRadiusKm]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    markerRef.current = null;
    radiusRef.current = null;
  }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice({ tone: "error", message: "Current location is not available in this browser." });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPin(position.coords.latitude, position.coords.longitude);
        setNotice({ tone: "success", message: "Public map pin updated. Save to confirm it." });
        setLocating(false);
      },
      () => {
        setNotice({ tone: "error", message: "We could not read your location. Click the map to place your pin." });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (partner && draft.partnerDirectoryEnabled && (!draft.province.trim() || !draft.townCity.trim())) {
      setNotice({ tone: "error", message: "Add your town or city and province under Profile & Location before joining the directory." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const overrides: Record<string, unknown> = {
        marketplaceSellerName: draft.marketplaceSellerName.trim(),
        marketplacePhone: draft.marketplacePhone.trim(),
        marketplaceEmail: draft.marketplaceEmail.trim(),
        marketplaceLocation: draft.marketplaceLocation.trim(),
        partnerDirectoryEnabled: partner ? draft.partnerDirectoryEnabled : false,
        partnerDescription: draft.partnerDescription.trim(),
        partnerLatitude: draft.partnerLatitude,
        partnerLongitude: draft.partnerLongitude,
        partnerServiceRadiusKm: draft.partnerServiceRadiusKm,
        partnerBrandFocus: draft.partnerBrandFocus.trim(),
        partnerServices: draft.partnerServices.trim(),
      };
      if (owner) overrides.discoveryParticipationEnabled = draft.discoveryParticipationEnabled;

      const response = await fetch("/api/account-profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProfileUpdatePayload(profile, overrides)),
      });
      const payload = (await response.json().catch(() => null)) as AccountProfileResponse | null;
      if (!response.ok || !payload?.ok || !payload.profile) throw new Error(readResponseError(payload, "Failed to save visibility settings."));
      setProfile(payload.profile);
      setDraft(payload.profile);
      setNotice({ tone: "success", message: "Visibility and contact settings saved." });
      window.dispatchEvent(new CustomEvent("aim4price-account-profile-updated", { detail: payload.profile }));
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to save visibility settings." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountSectionLayout
      profile={profile}
      eyebrow="Privacy and reach"
      title="Visibility & contact"
      description={owner ? "Choose how Aim4price may match you with relevant opportunities while keeping your account location private." : "Control how owners find and contact your business in the Aim4price partner directory."}
      badge={owner ? (draft.discoveryParticipationEnabled ? "Discovery active" : "Private") : (draft.partnerDirectoryEnabled ? "Directory visible" : "Directory hidden")}
    >
      <form className={styles.contentGrid} onSubmit={save}>
        <section className={styles.formCard}>
          {notice ? <div className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}>{notice.message}</div> : null}

          <section className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h2>{owner ? "Aim4price Discovery" : "Partner directory"}</h2>
              <p>{owner ? "Discovery uses your account information to make Aim4price more relevant to you. Your exact account address is never listed publicly." : "Be available when owners search for dealers, finance, insurance and other support near them."}</p>
            </div>
            <label className={styles.toggleCard}>
              <input type="checkbox" checked={owner ? draft.discoveryParticipationEnabled : draft.partnerDirectoryEnabled} onChange={(event) => owner ? update("discoveryParticipationEnabled", event.target.checked) : update("partnerDirectoryEnabled", event.target.checked)} />
              <span className={styles.toggleCopy}>
                <strong>{owner ? "Participate in Discovery" : "Show my business in the Aim4price directory"}</strong>
                <small>{owner ? "You can turn this off at any time." : "Owners can find and select your business when requesting support or sending a lead."}</small>
              </span>
            </label>

            <article className={styles.previewCard}>
              <div className={styles.previewHead}>{owner ? "Account privacy" : "Owner preview"}</div>
              <div className={styles.previewBody}>
                <div className={styles.previewLogo}>{draft.logoUrl ? <img src={draft.logoUrl} alt="" /> : <span>{initials(displayName)}</span>}</div>
                <div className={styles.previewCopy}><strong>{displayName}</strong><span>{partner ? profileLocation(draft) : "Your precise location remains private"}</span><span>{partner ? (draft.partnerServices.trim() || "Services not added yet") : (draft.discoveryParticipationEnabled ? "Discovery enabled" : "Discovery disabled")}</span></div>
              </div>
            </article>
          </section>

          {partner ? (
            <section className={styles.formSection}>
              <div className={styles.mapToolbar}>
                <div className={styles.formSectionHeader}><h2>Public map location</h2><p>Click the map, drag the pin or use your current location. This is separate from your private street address.</p></div>
                <div className={styles.mapActions}>
                  <button type="button" className={styles.secondaryButton} onClick={useCurrentLocation} disabled={locating}>{locating ? "Locating…" : "Use current location"}</button>
                  <button type="button" className={styles.secondaryButton} onClick={() => { update("partnerLatitude", null); update("partnerLongitude", null); }} disabled={!pin}>Clear pin</button>
                </div>
              </div>
              <div ref={mapElementRef} className={styles.map} aria-label="Select your public business location on the map" />
              <div className={styles.mapStatus}><span>{pin ? `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}` : "No public pin selected"}</span><strong>{pin ? "Ready to save" : "Optional"}</strong></div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}><span>Service radius (km)</span><input type="number" min="1" max="1000" value={draft.partnerServiceRadiusKm ?? ""} onChange={(event) => update("partnerServiceRadiusKm", event.target.value ? Number(event.target.value) : null)} placeholder="Example: 150" /></label>
                <label className={styles.field}><span>Brand focus</span><input value={draft.partnerBrandFocus} onChange={(event) => update("partnerBrandFocus", event.target.value)} placeholder="Brands or equipment types" /></label>
                <label className={styles.fullField}><span>Services</span><input value={draft.partnerServices} onChange={(event) => update("partnerServices", event.target.value)} placeholder="Example: Finance, insurance, replacements, trade-ins" /></label>
                <label className={styles.fullField}><span>Short directory description</span><textarea value={draft.partnerDescription} maxLength={500} onChange={(event) => update("partnerDescription", event.target.value)} placeholder="Explain how your business helps Aim4price owners." /><small className={styles.fieldHint}>{draft.partnerDescription.length}/500 characters</small></label>
              </div>
            </section>
          ) : null}

          <section className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h2>{partner ? "Public contact" : "Marketplace contact"}</h2>
              <p>Leave an override blank to use the corresponding contact or location from your main profile.</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Contact name</span><input value={draft.marketplaceSellerName} onChange={(event) => update("marketplaceSellerName", event.target.value)} placeholder={displayName} /></label>
              <label className={styles.field}><span>Contact number</span><input value={draft.marketplacePhone} onChange={(event) => update("marketplacePhone", event.target.value)} placeholder={draft.phone || "Main profile number"} /></label>
              <label className={styles.fullField}><span>Contact email</span><input value={draft.marketplaceEmail} onChange={(event) => update("marketplaceEmail", event.target.value)} placeholder={draft.email} type="email" /></label>
              <label className={styles.fullField}><span>Contact location</span><input value={draft.marketplaceLocation} onChange={(event) => update("marketplaceLocation", event.target.value)} placeholder={profileLocation(draft)} /></label>
            </div>
          </section>

          <div className={styles.saveBar}>
            <span>{hasChanges ? "You have unsaved visibility changes." : "Your visibility settings are up to date."}</span>
            <div className={styles.saveBarActions}>
              <button type="button" className={styles.secondaryButton} disabled={!hasChanges || saving} onClick={() => { setDraft(profile); setNotice(null); }}>Discard</button>
              <button type="submit" className={styles.primaryButton} disabled={!hasChanges || saving}>{saving ? "Saving…" : "Save settings"}</button>
            </div>
          </div>
        </section>

        <aside className={styles.sideCard}>
          <div><h2>What people see</h2><p>This summary uses your saved profile plus any contact overrides above.</p></div>
          <div className={styles.detailList}>
            <div className={styles.detailRow}><span>Name</span><strong>{draft.marketplaceSellerName.trim() || displayName}</strong></div>
            <div className={styles.detailRow}><span>Phone</span><strong>{publicPhone}</strong></div>
            <div className={styles.detailRow}><span>Email</span><strong>{publicEmail}</strong></div>
            <div className={styles.detailRow}><span>Location</span><strong>{publicLocation}</strong></div>
          </div>
          <div className={styles.privacyCard}>
            <strong>{owner ? "Private by design" : "Public pin, private address"}</strong>
            <p>{owner ? "Discovery participation does not publish your street address in the partner directory." : "Only the public map pin and the contact details shown here are used for discovery. Your optional street address stays an account detail."}</p>
          </div>
        </aside>
      </form>
    </AccountSectionLayout>
  );
}
