import Link from 'next/link';
import { redirect } from 'next/navigation';
import AssetRegisterClient from '../../asset-register/asset-register-client';
import DealerRegisterGateway from '../../asset-register/dealer-register-gateway';
import { getAssetRegisterAccountAccess } from '../../../lib/asset-register-account-access';
import { listAssetRegisters } from '../../../lib/asset-registers';
import { getServerSession } from '../../../lib/auth-session';
import styles from './inventory.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerInventoryPage({
  searchParams,
}: {
  searchParams?: { dealerView?: string; registerId?: string };
}) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const access = await getAssetRegisterAccountAccess(session);
  if (!access || access.accountType !== 'dealer') redirect('/dealer');

  const registers = await listAssetRegisters(session.user.id);
  const dealerRegister = registers.find((register) => register.isPrimary) ?? registers[0] ?? null;
  const requestedRegisterId = String(searchParams?.registerId ?? '').trim();
  const requestedRegister = registers.find((register) => register.id === requestedRegisterId) ?? null;
  const requestedView = String(searchParams?.dealerView ?? '').trim().toLowerCase();

  if (requestedView === 'dealer' && dealerRegister && requestedRegister?.id !== dealerRegister.id) {
    redirect(`/dealer/inventory?dealerView=dealer&registerId=${encodeURIComponent(dealerRegister.id)}`);
  }

  const registerMode = requestedRegister
    ? requestedRegister.id === dealerRegister?.id ? 'dealer' : 'client'
    : null;

  if (requestedView === 'client' && registerMode !== 'client') {
    redirect('/dealer/inventory/registers');
  }

  if (!registerMode) {
    return (
      <DealerRegisterGateway
        registers={registers}
        showAppHeader={false}
        workspacePath="/dealer/inventory"
        registerManagementHref="/dealer/inventory/registers"
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.contextBar}>
        <div>
          <span>{registerMode === 'dealer' ? 'Dealer-owned assets' : 'Managed client assets'}</span>
          <strong>{registerMode === 'dealer' ? 'Dealer Asset Register' : requestedRegister?.businessName || 'Client Asset Register'}</strong>
          <p>{registerMode === 'dealer' ? 'Your own stock and trade-ins stay separate from the Asset Registers you manage for clients.' : 'Manage this client with the same complete Asset Register used by an owner account.'}</p>
        </div>
        <Link href={registerMode === 'dealer' ? '/dealer/inventory/transfers' : '/dealer/inventory/registers'} prefetch={false}>
          {registerMode === 'dealer' ? 'Claim or send asset' : 'Manage client registers'}
        </Link>
      </header>
      <AssetRegisterClient
        showAppHeader={false}
        registerManagementHref="/dealer/inventory/registers"
        dealerRegisterMode={registerMode}
        dealerRegisterBaseHref="/dealer/inventory"
      />
    </div>
  );
}
