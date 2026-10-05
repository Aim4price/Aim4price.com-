import {Suspense} from 'react';
import AppHeader from '../../../components/AppHeader';
import MaintenanceReminderDialog from '../../../components/MaintenanceReminderDialog';
export const dynamic='force-dynamic';
export const metadata={title:'Maintenance reminder',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function Page({params}:{params:{id:string}}){return <><Suspense fallback={null}><AppHeader active="none"/></Suspense><MaintenanceReminderDialog id={params.id}/></>;}
