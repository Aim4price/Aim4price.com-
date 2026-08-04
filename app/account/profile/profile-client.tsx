"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import AccountSectionLayout from "../account-section-layout";
import type { AccountProfile, AccountProfileResponse } from "../account-types";
import {
  SOUTH_AFRICAN_PROVINCES,
  accountTypeLabel,
  buildProfileUpdatePayload,
  isOwnerProfile,
  profileCompletion,
  profileDisplayName,
  profileLocation,
  readResponseError,
} from "../account-types";
import styles from "../account-system.module.css";

type Props = { initialProfile: AccountProfile };
type Notice = { tone: "success" | "error"; message: string } | null;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function initials(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "A").toUpperCase();
}

export default function ProfileClient({ initialProfile }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(initialProfile);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const owner = isOwnerProfile(profile);
  const completion = useMemo(() => profileCompletion(draft), [draft]);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(profile);

  function update<K extends keyof AccountProfile>(key: K, value: AccountProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      setNotice({ tone: "error", message: "Choose a JPG, PNG or WEBP logo." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setNotice({ tone: "error", message: "Your logo must be smaller than 2 MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => update("logoUrl", typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setNotice({ tone: "error", message: "We could not read that logo." });
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.displayName.trim()) {
      setNotice({ tone: "error", message: owner ? "Enter your full name." : "Enter a profile name." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/account-profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProfileUpdatePayload(profile, {
          displayName: draft.displayName.trim(),
          logoUrl: draft.logoUrl,
          websiteUrl: draft.websiteUrl.trim(),
          businessName: draft.businessName.trim(),
          phone: draft.phone.trim(),
          vatNumber: draft.vatNumber.trim(),
          province: draft.province,
          townCity: draft.townCity.trim(),
          addressLine1: draft.addressLine1.trim(),
          addressLine2: draft.addressLine2.trim(),
          marketplaceEmail: draft.marketplaceEmail.trim(),
          syncPrimaryLogoToRegister: owner,
        })),
      });
      const payload = (await response.json().catch(() => null)) as AccountProfileResponse | null;
      if (!response.ok || !payload?.ok || !payload.profile) {
        throw new Error(readResponseError(payload, "Failed to save profile details."));
      }
      setProfile(payload.profile);
      setDraft(payload.profile);
      setNotice({ tone: "success", message: "Profile and location saved." });
      window.dispatchEvent(new CustomEvent("aim4price-account-profile-updated", { detail: payload.profile }));
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to save profile details." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountSectionLayout
      profile={profile}
      eyebrow="Account details"
      title="Profile & location"
      description="Keep your identity, contact details and main location accurate across Aim4price."
      badge={`${completion.completed}/${completion.total} complete`}
    >
      <form className={styles.contentGrid} onSubmit={save}>
        <section className={styles.formCard}>
          {notice ? <div className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}>{notice.message}</div> : null}

          <section className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h2>Profile image</h2>
              <p>Use one clear logo or profile image. It will appear across your Aim4price account.</p>
            </div>
            <div className={styles.logoPanel}>
              <div className={styles.logoPreview}>
                {draft.logoUrl ? <img src={draft.logoUrl} alt="Current profile logo" /> : <span>{initials(profileDisplayName(draft))}</span>}
              </div>
              <div>
                <div className={styles.logoControls}>
                  <label className={styles.primaryButton}>
                    {draft.logoUrl ? "Replace image" : "Upload image"}
                    <input className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogo} />
                  </label>
                  {draft.logoUrl ? <button type="button" className={styles.secondaryButton} onClick={() => update("logoUrl", "")}>Remove</button> : null}
                </div>
                <p className={styles.fieldHint}>JPG, PNG or WEBP. Maximum 2 MB.</p>
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h2>{owner ? "Personal details" : "Business details"}</h2>
              <p>These details are used throughout the account. Public information is controlled separately under Visibility & Contact.</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>{owner ? "Full name" : "Primary contact name"}</span><input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} autoComplete="name" /></label>
              {!owner ? <label className={styles.field}><span>Business name</span><input value={draft.businessName} onChange={(event) => update("businessName", event.target.value)} autoComplete="organization" /></label> : null}
              <label className={styles.field}><span>Account email</span><input value={draft.email} disabled /></label>
              <label className={styles.field}><span>Contact number</span><input value={draft.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" /></label>
              <label className={styles.field}><span>Website</span><input value={draft.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="https://your-business.co.za" inputMode="url" /></label>
              {!owner ? <label className={styles.field}><span>Business email</span><input value={draft.marketplaceEmail} onChange={(event) => update("marketplaceEmail", event.target.value)} placeholder={draft.email} autoComplete="email" /></label> : null}
              {!owner ? <label className={styles.field}><span>VAT number</span><input value={draft.vatNumber} onChange={(event) => update("vatNumber", event.target.value)} /></label> : null}
            </div>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h2>Account location</h2>
              <p>Add a reliable home or business location. Owners remain private; business directory visibility is controlled separately.</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Province</span><select value={draft.province} onChange={(event) => update("province", event.target.value)}><option value="">Select a province</option>{SOUTH_AFRICAN_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
              <label className={styles.field}><span>Town / city</span><input value={draft.townCity} onChange={(event) => update("townCity", event.target.value)} placeholder="Example: Oudtshoorn" autoComplete="address-level2" /></label>
              <label className={styles.fullField}><span>Address line 1 <em>(optional)</em></span><input value={draft.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} autoComplete="address-line1" /></label>
              <label className={styles.fullField}><span>Address line 2 <em>(optional)</em></span><input value={draft.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} autoComplete="address-line2" /></label>
            </div>
          </section>

          <div className={styles.saveBar}>
            <span>{hasChanges ? "You have unsaved changes." : "Your profile is up to date."}</span>
            <div className={styles.saveBarActions}>
              <button type="button" className={styles.secondaryButton} disabled={!hasChanges || saving} onClick={() => { setDraft(profile); setNotice(null); }}>Discard</button>
              <button type="submit" className={styles.primaryButton} disabled={!hasChanges || saving}>{saving ? "Saving…" : "Save profile"}</button>
            </div>
          </div>
        </section>

        <aside className={styles.sideCard}>
          <div><h2>Account summary</h2><p>A quick check before you save.</p></div>
          <div className={styles.detailList}>
            <div className={styles.detailRow}><span>Account type</span><strong>{accountTypeLabel(profile)}</strong></div>
            <div className={styles.detailRow}><span>Display name</span><strong>{profileDisplayName(draft)}</strong></div>
            <div className={styles.detailRow}><span>Location</span><strong>{profileLocation(draft)}</strong></div>
            <div className={styles.detailRow}><span>Profile setup</span><strong>{completion.completed} of {completion.total} essentials complete</strong></div>
          </div>
          <div className={styles.privacyCard}>
            <strong>{owner ? "Your location stays private" : "You control what becomes public"}</strong>
            <p>{owner ? "Your account location is used for relevant Aim4price tools, but it is not published in the business directory." : "Saving this address does not automatically expose it. Choose your public map pin and directory status under Visibility & Contact."}</p>
          </div>
        </aside>
      </form>
    </AccountSectionLayout>
  );
}
