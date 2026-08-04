import type { ReactNode } from "react";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import type { AccountProfile } from "./account-types";
import { accountTypeLabel, profileDisplayName, profileLocation } from "./account-types";
import styles from "./account-system.module.css";

type Props = {
  profile: AccountProfile;
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
};

function initials(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "A").toUpperCase();
}

export default function AccountSectionLayout({
  profile,
  eyebrow,
  title,
  description,
  badge,
  children,
}: Props) {
  const displayName = profileDisplayName(profile);

  return (
    <div className={styles.screen}>
      <AppHeader active="account" />
      <main className={styles.page}>
        <div className={styles.shell}>
          <Link href="/account" className={styles.backLink}>
            <span aria-hidden="true">←</span>
            Back to account
          </Link>

          <section className={styles.sectionHero}>
            <div className={styles.heroAvatar}>
              {profile.logoUrl ? <img src={profile.logoUrl} alt="" /> : <span>{initials(displayName)}</span>}
            </div>
            <div className={styles.sectionHeroCopy}>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
              <div className={styles.heroMeta}>
                <span>{accountTypeLabel(profile)}</span>
                <span aria-hidden="true">•</span>
                <span>{profileLocation(profile)}</span>
              </div>
            </div>
            {badge ? <span className={styles.heroBadge}>{badge}</span> : null}
          </section>

          {children}
        </div>
      </main>
    </div>
  );
}
