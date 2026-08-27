'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
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
    <main className={styles.page}>
      {showAppHeader ? <AppHeader active="asset-register" /> : null}

      <section className={styles.shell}>
        <section className={`${styles.registerPanel} ${styles.dealerRegisterGateway}`}>
          <div className={styles.dealerRegisterGatewayHeader}>
            <span>Dealer workspace</span>
            <h1>ASSET REGISTER</h1>
            <p>Choose whether you are working with the dealership&apos;s own assets or an Asset Register managed for a client.</p>
          </div>

          <div className={styles.dealerRegisterChoiceGrid}>
            {dealerRegister ? (
              <Link
                className={`${styles.dealerRegisterChoiceCard} ${styles.dealerRegisterChoiceDealer}`}
                href={registerHref(dealerRegister, 'dealer', workspacePath)}
              >
                <span className={styles.dealerRegisterChoiceKicker}>Dealership assets</span>
                <strong>Dealer Asset Register</strong>
                <p>Open your own stock, trade-ins and dealer-owned assets.</p>
                <small>{dealerRegister.assetCount} {dealerRegister.assetCount === 1 ? 'asset' : 'assets'} · {money(dealerRegister.totalValue)}</small>
                <b>Open register</b>
              </Link>
            ) : (
              <Link className={styles.dealerRegisterChoiceCard} href={registerManagementHref}>
                <span className={styles.dealerRegisterChoiceKicker}>Dealership assets</span>
                <strong>Create Dealer Asset Register</strong>
                <p>Create the dealership&apos;s own register before adding stock or trade-ins.</p>
                <b>Create register</b>
              </Link>
            )}

            <button
              type="button"
              className={`${styles.dealerRegisterChoiceCard} ${styles.dealerRegisterChoiceClient}`}
              onClick={() => setIsClientPickerOpen(true)}
            >
              <span className={styles.dealerRegisterChoiceKicker}>Managed accounts</span>
              <strong>Client Asset Registers</strong>
              <p>Open and manage a client&apos;s complete Asset Register with the same tools and asset cards.</p>
              <small>{clientRegisters.length} {clientRegisters.length === 1 ? 'client register' : 'client registers'}</small>
              <b>Choose client</b>
            </button>
          </div>
        </section>
      </section>

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
                <span>Client Asset Registers</span>
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
                  <b>Open</b>
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
