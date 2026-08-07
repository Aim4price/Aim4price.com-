'use client';

import styles from './AppLoginWelcome.module.css';

type AppLoginWelcomeProps = {
  displayName: string;
  companyName: string;
  logoUrl: string;
};

export default function AppLoginWelcome({ displayName, companyName, logoUrl }: AppLoginWelcomeProps) {
  return (
    <section className={styles.card} aria-live="polite" aria-label={`Welcome ${displayName}`}>
      <div className={styles.logoFrame}>
        {/* Company logos are account uploads and can come from different storage hosts. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl || '/icon.png'}
          alt={companyName ? `${companyName} logo` : 'Aim4price'}
          onError={(event) => {
            if (!event.currentTarget.src.endsWith('/icon.png')) event.currentTarget.src = '/icon.png';
          }}
        />
      </div>
      <span className={styles.eyebrow}>Welcome</span>
      <h1>{displayName}</h1>
      {companyName ? <p>{companyName}</p> : null}
      <div className={styles.progress} aria-hidden="true"><span /></div>
    </section>
  );
}
