import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import type { AccountProfile, AccountScanPinStatus } from "./account-types";
import {
  accountTypeLabel,
  isDealerProfile,
  isOwnerProfile,
  profileCompletion,
  profileDisplayName,
  profileLocation,
} from "./account-types";
import styles from "./account-system.module.css";

type Props = {
  initialProfile: AccountProfile;
  initialScanPinStatus: AccountScanPinStatus;
};

type ActionIcon = "profile" | "visibility" | "staff" | "field" | "security";

function ActionGlyph({ icon }: { icon: ActionIcon }) {
  return (
    <span className={styles.actionIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icon === "profile" ? <><path d="M4.5 20V8.5L12 3l7.5 5.5V20" /><path d="M8.5 20v-6h7v6M8.5 9.5h7" /></> : null}
        {icon === "visibility" ? <><path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></> : null}
        {icon === "staff" ? <><circle cx="9" cy="8" r="3" /><path d="M3.8 20c.5-3.8 2.3-5.8 5.2-5.8s4.7 2 5.2 5.8" /><path d="M15.5 6.5a2.6 2.6 0 0 1 0 5M16 15c2.4.4 3.8 2 4.2 4.6" /></> : null}
        {icon === "field" ? <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.2 12.2 2.5 2.5 5.3-5.4" /></> : null}
        {icon === "security" ? <><path d="M6.5 10V7.8a5.5 5.5 0 0 1 11 0V10" /><rect x="4.5" y="10" width="15" height="10" rx="2.5" /><path d="M12 14v2" /></> : null}
      </svg>
    </span>
  );
}

function AccountAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ActionIcon;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className={styles.actionRow}>
      <ActionGlyph icon={icon} />
      <span className={styles.actionCopy}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className={styles.actionChevron} aria-hidden="true">›</span>
    </Link>
  );
}

function initials(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "A").toUpperCase();
}

export default function AccountClient({ initialProfile: profile, initialScanPinStatus }: Props) {
  const owner = isOwnerProfile(profile);
  const dealer = isDealerProfile(profile);
  const displayName = profileDisplayName(profile);
  const completion = profileCompletion(profile);
  const visibilityLabel = owner
    ? profile.discoveryParticipationEnabled ? "Discovery active" : "Private"
    : profile.partnerDirectoryEnabled ? "Directory visible" : "Directory hidden";
  const accessLabel = owner
    ? "Owner App & Field Managers"
    : dealer
      ? "Dealer App staff"
      : "Main account access";

  return (
    <div className={styles.screen}>
      <AppHeader active="account" />
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.accountHero}>
            <div className={styles.accountAvatar}>
              {profile.logoUrl ? <img src={profile.logoUrl} alt="" /> : <span>{initials(displayName)}</span>}
            </div>
            <div className={styles.accountHeroCopy}>
              <span className={styles.eyebrow}>Aim4price account</span>
              <h1>{displayName}</h1>
              <p>{profile.email}</p>
              <div className={styles.heroMeta}>
                <span>{accountTypeLabel(profile)}</span>
                <span aria-hidden="true">•</span>
                <span>{profileLocation(profile)}</span>
              </div>
            </div>
            <div className={styles.heroBadges}>
              <span>Active</span>
              <span>{visibilityLabel}</span>
            </div>
          </section>

          {!completion.complete ? (
            <Link href="/account/profile" className={styles.setupBanner}>
              <span className={styles.setupProgress}>{completion.completed}/{completion.total}</span>
              <span>
                <strong>Finish setting up your account</strong>
                <small>Add {completion.missing.slice(0, 2).join(" and ")} so your Aim4price profile is ready to use.</small>
              </span>
              <b aria-hidden="true">›</b>
            </Link>
          ) : null}

          <section className={styles.hubGrid}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Account overview</h2>
                <p>The information that matters at a glance.</p>
              </div>
              <div className={styles.metricGrid}>
                <div className={styles.metricTile}><span>Account type</span><strong>{accountTypeLabel(profile)}</strong></div>
                <div className={styles.metricTile}><span>Location</span><strong>{profileLocation(profile)}</strong></div>
                <div className={styles.metricTile}><span>Visibility</span><strong>{visibilityLabel}</strong></div>
                <div className={styles.metricTile}><span>App access</span><strong>{accessLabel}</strong></div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Quick actions</h2>
                <p>Open the area you want to manage.</p>
              </div>
              <div className={styles.actionList}>
                <AccountAction
                  href="/account/profile"
                  icon="profile"
                  title={owner ? "Profile & location" : "Edit business details"}
                  description="Branding, contact information and your main account location."
                />
                <AccountAction
                  href="/account/visibility"
                  icon="visibility"
                  title={owner ? "Visibility & Discovery" : "Partner directory"}
                  description={owner ? "Control Discovery and marketplace contact details." : "Manage your public profile, location and service area."}
                />
                {owner ? (
                  <>
                    <AccountAction href="/account/owner-app" icon="staff" title="Manage Owner App users" description="Create and manage dedicated Owner App access." />
                    <AccountAction href="/account/field-manager" icon="field" title="Manage Field Managers" description="Control field access for daily asset work." />
                  </>
                ) : null}
                {dealer ? (
                  <AccountAction href="/account/dealer-app" icon="staff" title="Manage Dealer App staff" description="Create and manage dedicated Dealer App logins." />
                ) : null}
                <AccountAction
                  href="/account/security"
                  icon="security"
                  title={owner ? "Security & QR access" : "Password & security"}
                  description={owner
                    ? `Password, reset email and QR PIN (${initialScanPinStatus.hasPin ? "configured" : "not set"}).`
                    : "Password, reset email and protected account actions."}
                />
              </div>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
