import PetrolStationFuelClient from '../../../owner-app/operations/fuel/petrol-station/petrol-station-fuel-client';
import FieldManagerNavLink from '../../field-manager-nav-link';
import styles from '../../page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function FieldManagerPetrolStationPage() {
  return (
    <main className={`${styles.mobilePage} ${styles.homePage}`}>
      <div className={styles.fuelFlowShell}>
        <header className={styles.fuelFlowNav} aria-label="Field Manager petrol station controls">
          <FieldManagerNavLink href="/field-manager/diesel" label="Back" />
          <FieldManagerNavLink href="/field-manager" label="Home" tone="home" />
        </header>
        <PetrolStationFuelClient operatorName="" fieldManagerMode />
      </div>
    </main>
  );
}
