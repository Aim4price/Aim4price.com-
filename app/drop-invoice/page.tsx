import type { Metadata } from 'next';
import AppHeader from '../../components/AppHeader';
import InvoiceDropClient from './invoice-drop-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoice Drop',
  description:
    'Send an invoice for an Aim4price asset without creating an account. Aim4price will verify and route it to the correct record.',
};

export default function DropInvoicePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <InvoiceDropClient />
    </main>
  );
}
