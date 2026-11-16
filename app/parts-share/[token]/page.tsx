import { Suspense } from 'react';
import type { Metadata } from 'next';
import AppHeader from '../../../components/AppHeader';
import SharedParts from '../../../components/SharedParts';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Parts shared with you',robots:{index:false,follow:false,noarchive:true},referrer:'no-referrer'};
export default function Page({params}:{params:{token:string}}){return <><Suspense fallback={null}><AppHeader active="none"/></Suspense><SharedParts token={params.token}/></>;}
