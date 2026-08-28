'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import valuationStyles from '../valuation/page.module.css';
import entryStyles from '../marketplace/marketplace-entry.module.css';
import styles from './page.module.css';

type DealerRegisterOption = {
  id: string;
  businessName: string;
  addressLine1: string;
  assetCount: number;
  totalValue: number;
  isPrimary: boolean;
};

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function registerHref(register: DealerRegisterOption, view: 'dealer' | 'client', workspacePath: string): string {
  const params = new URLSearchParams({
    dealerView: view,
    registerId: register.id,
  });
  return `${workspacePath}?${params.toString()}`;
}

export default function DealerRegisterGateway({
  registers,
  openClientPicker = false,
  showAppHeader = true,
  workspacePath = '/asset-register',
  registerManagementHref = '/asset-registers',
}: {
  registers: DealerRegisterOption[];
  openClientPicker?: boolean;
  showAppHeader?: boolean;
  workspacePath?: string;
  registerManagementHref?: string;
}) {
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(openClientPicker);
  const [search, setSearch] = useState('');
  const dealerRegister = registers.find((register) => register.isPrimary) ?? registers[0] ?? null;
  const clientRegisters = useMemo(
    () => registers.filter((register) => register.id !== dealerRegister?.id),
    [dealerRegister?.id, registers],
  );
  const visibleClientRegisters = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clientRegisters;
    return clientRegisters.filter((register) => [
      register.businessName,
      register.addressLine1,
      String(register.assetCount),
    ].some((value) => String(value ?? '').toLowerCase().includes(query)));
  }, [clientRegisters, search]);

  useEffect(() => {
    if (openClientPicker) setIsClientPickerOpen(true);
  }, [openClientPicker]);

  function closeClientPicker() {
    setIsClientPickerOpen(false);
    setSearch('');
  }

  return (
    <main className={valuationStyles.page}>
      {showAppHeader ? <AppHeader active="asset-register" /> : null}

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

                  <button
                    type="button"
                    className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive} ${entryStyles.entryChoiceCard}`}
                    style={{ width: '100%', appearance: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => setIsClientPickerOpen(true)}
                    aria-label="Choose a Client Asset Register"
                  >
                    <span className={valuationStyles.sectorVideoOverlay} />
                    <span className={`${valuationStyles.sectorBigCardContent} ${entryStyles.entryChoiceContent}`}>
                      <span className={valuationStyles.sectorLabelWrap}>
                        <strong className={valuationStyles.sectorLabel}>Client Asset Registers</strong>
                        <span className={valuationStyles.sectorCardHint}>Manage client assets</span>
                      </span>
                    </span>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isClientPickerOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeClientPicker} />
          <section
            className={`${styles.modalCard} ${styles.dealerClientPickerModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dealer-client-register-title"
          >
            <div className={styles.dealerClientPickerHeader}>
              <div>
                <h2 id="dealer-client-register-title">Choose a client register</h2>
                <p>Open a complete client Asset Register, then switch between clients from inside the register.</p>
              </div>
              <button type="button" onClick={closeClientPicker} aria-label="Close client Asset Register picker">×</button>
            </div>

            <label className={styles.dealerClientPickerSearch}>
              <span>Search client registers</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by client, address or asset count"
                autoFocus
              />
            </label>

            <div className={styles.dealerClientRegisterList}>
              {visibleClientRegisters.map((register) => (
                <Link key={register.id} href={registerHref(register, 'client', workspacePath)} className={styles.dealerClientRegisterRow}>
                  <span>
                    <strong>{register.businessName || 'Client Asset Register'}</strong>
                    <small>{register.addressLine1 || 'No address saved'}</small>
                  </span>
                  <span>
                    <strong>{register.assetCount} {register.assetCount === 1 ? 'asset' : 'assets'}</strong>
                    <small>{money(register.totalValue)} current value</small>
                  </span>
                  <b style={{ padding: 0, borderRadius: 0, background: 'transparent', color: '#0b6e5b', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>Open register →</b>
                </Link>
              ))}

              {!visibleClientRegisters.length ? (
                <div className={styles.dealerClientRegisterEmpty}>
                  <strong>{clientRegisters.length ? 'No client registers match your search.' : 'No client Asset Registers yet.'}</strong>
                  <p>{clientRegisters.length ? 'Clear the search to see every available client.' : 'Create a separate Asset Register for the first client.'}</p>
                </div>
              ) : null}
            </div>

            <div className={styles.dealerClientPickerFooter}>
              <button type="button" onClick={closeClientPicker}>Cancel</button>
              <Link href={registerManagementHref}>Manage or create registers</Link>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
