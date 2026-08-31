'use client';

import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import valuationStyles from '../valuation/page.module.css';
import entryStyles from '../marketplace/marketplace-entry.module.css';

type DealerRegisterOption = {
  id: string;
  businessName: string;
  addressLine1: string;
  assetCount: number;
  totalValue: number;
  isPrimary: boolean;
};

function registerHref(register: DealerRegisterOption, view: 'dealer' | 'client', workspacePath: string): string {
  const params = new URLSearchParams({
    dealerView: view,
    registerId: register.id,
  });
  return `${workspacePath}?${params.toString()}`;
}

export default function DealerRegisterGateway({
  registers,
  showAppHeader = true,
  workspacePath = '/asset-register',
  registerManagementHref = '/asset-registers',
}: {
  registers: DealerRegisterOption[];
  showAppHeader?: boolean;
  workspacePath?: string;
  registerManagementHref?: string;
}) {
  const dealerRegister = registers.find((register) => register.isPrimary) ?? registers[0] ?? null;

  return (
    <main className={valuationStyles.page}>
      {showAppHeader ? <AppHeader active="asset-register" brandAlignment="standard-shell" /> : null}

      <div className={`${valuationStyles.container} ${entryStyles.entryContainer}`}>
        <section className={`${valuationStyles.wizardShell} ${valuationStyles.sectorWizardShell} ${entryStyles.entryShell}`}>
          <div className={`${valuationStyles.wizardCard} ${valuationStyles.sectorWizardCard} ${entryStyles.entryCard}`}>
            <div className={`${valuationStyles.stepContent} ${valuationStyles.sectorStepContent} ${entryStyles.entryContent}`}>
              <div className={`${valuationStyles.sectorStart} ${entryStyles.entryStart}`}>
                <div className={`${valuationStyles.sectorIntro} ${entryStyles.entryIntro}`}>
                  <h1 className={`${valuationStyles.stepTitle} ${entryStyles.entryTitle}`}>Choose an Asset Register</h1>
                  <p className={`${valuationStyles.stepText} ${entryStyles.entryText}`}>
                    Work with the dealership&apos;s own assets or open an Asset Register managed for a client.
                  </p>
                </div>

                <nav className={`${valuationStyles.sectorLargeGrid} ${entryStyles.entryGrid}`} aria-label="Asset Register choices">
                  {dealerRegister ? (
                    <Link
                      href={registerHref(dealerRegister, 'dealer', workspacePath)}
                      className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive} ${entryStyles.entryChoiceCard}`}
                      style={{ textDecoration: 'none' }}
                      aria-label="Open Dealer Asset Register"
                    >
                      <span className={valuationStyles.sectorVideoOverlay} />
                      <span className={`${valuationStyles.sectorBigCardContent} ${entryStyles.entryChoiceContent}`}>
                        <span className={valuationStyles.sectorLabelWrap}>
                          <strong className={valuationStyles.sectorLabel}>Dealer Asset Register</strong>
                          <span className={valuationStyles.sectorCardHint}>Manage dealership assets</span>
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <Link
                      href={registerManagementHref}
                      className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive} ${entryStyles.entryChoiceCard}`}
                      style={{ textDecoration: 'none' }}
                      aria-label="Create Dealer Asset Register"
                    >
                      <span className={valuationStyles.sectorVideoOverlay} />
                      <span className={`${valuationStyles.sectorBigCardContent} ${entryStyles.entryChoiceContent}`}>
                        <span className={valuationStyles.sectorLabelWrap}>
                          <strong className={valuationStyles.sectorLabel}>Create Dealer Asset Register</strong>
                          <span className={valuationStyles.sectorCardHint}>Create the dealership register</span>
                        </span>
                      </span>
                    </Link>
                  )}

                  <Link
                    href={registerManagementHref}
                    className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive} ${entryStyles.entryChoiceCard}`}
                    style={{ textDecoration: 'none' }}
                    aria-label="Manage Client Asset Registers"
                  >
                    <span className={valuationStyles.sectorVideoOverlay} />
                    <span className={`${valuationStyles.sectorBigCardContent} ${entryStyles.entryChoiceContent}`}>
                      <span className={valuationStyles.sectorLabelWrap}>
                        <strong className={valuationStyles.sectorLabel}>Client Asset Registers</strong>
                        <span className={valuationStyles.sectorCardHint}>Manage client assets</span>
                      </span>
                    </span>
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </section>
      </div>

    </main>
  );
}
