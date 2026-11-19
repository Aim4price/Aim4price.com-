import Link from 'next/link';
import AppHeader from '../../../../components/AppHeader';
import { listAllOwnerAppAssets } from '../../../../lib/owner-app-assets';
import { accountingOwner } from '../../../../lib/accounting-owner';
import ExportPreview from './preview';
import styles from '../../sage-za/sage.module.css';

export const dynamic='force-dynamic';
export default async function SageExportPage(){
  const {items}=await listAllOwnerAppAssets(await accountingOwner());
  return <><AppHeader active="none"/><main className={styles.panel}><Link href="/my-invoices/accounting">Accounting connections</Link>
    <h1>Sage export preview</h1><ExportPreview assets={items.map(({title,serialNumber})=>({title,serialNumber}))}/></main></>;
}
