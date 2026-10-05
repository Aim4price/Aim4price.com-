import {Suspense} from 'react';
import AppHeader from '../../../../components/AppHeader';
import ValueReviewLink from '../../../../components/ValueReviewLink';
export const dynamic='force-dynamic';
export const metadata={title:'Review asset value',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function Page({params}:{params:{assetId:string;requestId:string}}){return <><Suspense fallback={null}><AppHeader active="none"/></Suspense><ValueReviewLink {...params}/></>;}
