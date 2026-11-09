'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDealerAppRoot } from '../../lib/use-dealer-app-root';
import { dealerRoleCan } from '../../lib/dealer-app-access';
import type { DealerStaffRole } from '../../lib/dealer-app';
import OwnerIcon from '../owner-app/owner-icon';
import styles from '../owner-app/owner-mobile.module.css';

export default function DealerBottomNav() {
  const pathname = usePathname();
  const root = useDealerAppRoot();
  const path = pathname.slice(root.length).replace(/\/$/, '');
  const browsing = ['', '/leads', '/maintenance', '/overview', '/inventory', '/parts', '/discovery', '/marketplace', '/showroom', '/account', '/notifications'].includes(path);
  const [role, setRole] = useState<DealerStaffRole | null>(null);
  useEffect(() => {
    if (!browsing) return;
    const controller = new AbortController();
    setRole(null);
    fetch(`/api${root}/session`, {credentials: 'include', cache: 'no-store', signal: controller.signal})
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const value = payload?.ok ? payload.session?.role : null;
        if (!controller.signal.aborted && ['owner', 'sales', 'parts', 'technician'].includes(value)) setRole(value);
      }).catch(() => { if (!controller.signal.aborted) setRole(null); });
    return () => controller.abort();
  }, [root, pathname, browsing]);
  if (!browsing || !role) return null;
  const middleman = root === '/middleman';
  const tabs = [
    {label:'Home', href:root, icon:'home'},
    ...(middleman && dealerRoleCan(role,'discovery') ? [{label:'Discover',href:`${root}/discovery`,icon:'search'}]
      : !middleman && dealerRoleCan(role,'maintenance') ? [{label:'Work',href:`${root}/maintenance`,icon:'work'}] : []),
    ...(dealerRoleCan(role,'marketplace') ? [{label:'Marketplace',href:`${root}/marketplace`,icon:'marketplace'}] : []),
    {label:'Account',href:`${root}/account`,icon:'account'},
  ];
  return <><div className={styles.bottomSpace} aria-hidden="true" />
    <nav className={styles.bottomNav} aria-label={`${middleman ? 'Middleman' : 'Dealer'} bottom navigation`}>
      {tabs.map(tab => <Link key={tab.href} className={styles.bottomTab} href={tab.href} prefetch={false} aria-current={pathname===tab.href ? 'page' : undefined}><OwnerIcon name={tab.icon} /><span>{tab.label}</span></Link>)}
    </nav></>;
}
