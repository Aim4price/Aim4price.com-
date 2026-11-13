'use client';
import { useSearchParams } from 'next/navigation';
import { PageHelpHeading } from '../../components/PageHelp';
import { pageHelp, type PageHelpTopic } from '../../lib/page-help';
import AppHeader from '../../components/AppHeader';
import WorkspaceViewSwitch from '../../components/WorkspaceViewSwitch';
import register from '../../app/asset-register/page.module.css';
import fuel from '../../app/fuel/page.module.css';
import costs from '../../app/my-invoices/page.module.css';
import map from '../../app/asset-map/page.module.css';
import maintenance from '../../app/maintenance/page.module.css';
import documents from '../../app/documents/page.module.css';
import registers from '../../app/asset-registers/page.module.css';
import access from '../../app/account/app-access-management.module.css';
import { WorkspaceTitlePanel } from '../../components/WorkspacePrimitives';
import BudgetTracking from '../../app/budgets/BudgetTracking';
import InvoiceDropClient from '../../app/drop-invoice/invoice-drop-client';

export default function PageHelpFixture() {
  const requested = useSearchParams().get('topic') || 'register';
  const topic = (requested in pageHelp ? requested : 'register') as PageHelpTopic;
  let title = <PageHelpHeading topic={topic}><h1>{pageHelp[topic].title}</h1></PageHelpHeading>;
  if (topic === 'register') title = <div className={`${register.registerTitleBlock} ${register.businessRegisterTitleBlock}`}><div className={register.businessRegisterTitleCard}><PageHelpHeading topic={topic}><h1>Combined Asset Registers</h1></PageHelpHeading><WorkspaceViewSwitch label="Switch Asset Register" onClick={()=>{}} /></div></div>;
  if (topic === 'fuelSlips' || topic === 'fuelStorage') title = <div className={fuel.pageTitleBlock}><PageHelpHeading inset reserveSwitch topic={topic}><h1>{topic === 'fuelSlips' ? 'FUEL SLIP TRACKING' : 'FUEL TRACKING SYSTEM'}</h1></PageHelpHeading><div className={fuel.titleViewSwitch}><WorkspaceViewSwitch label="Switch fuel view" onClick={()=>{}} /></div></div>;
  if (topic === 'costs' || topic === 'budgets') title = <section className={costs.pageTitleBlock}><div><PageHelpHeading topic={topic}><h1>{topic === 'costs' ? 'COST TRACKING SYSTEM' : 'BUDGET TRACKING SYSTEM'}</h1></PageHelpHeading><WorkspaceViewSwitch label="Switch cost view" onClick={()=>{}} /></div></section>;
  if (topic === 'map') title = <div className={map.pageTitleBlock}><PageHelpHeading inset topic={topic}><h1>Asset Map &amp; Tracking</h1></PageHelpHeading></div>;
  if (topic === 'maintenance') title = <section className={maintenance.pageTitleBlock}><div><PageHelpHeading topic={topic}><h1>ASSET MAINTENANCE</h1></PageHelpHeading></div></section>;
  if (topic === 'documents') title = <section className={documents.hero}><PageHelpHeading topic={topic}><h1>Document Vault</h1></PageHelpHeading></section>;
  if (topic === 'registers') title = <div className={registers.pageTitleBlock}><PageHelpHeading inset topic={topic}><h1>MANAGE ASSET REGISTERS</h1></PageHelpHeading></div>;
  if (['desktopUsers', 'managerUsers', 'aiConnections', 'transfers'].includes(topic)) title = <section className={access.launcher}><div className={access.launcherIntro}><PageHelpHeading topic={topic}><h1>{pageHelp[topic].title}</h1></PageHelpHeading><p>{pageHelp[topic].purpose}</p></div></section>;
  if (topic === 'showroom') title = <WorkspaceTitlePanel title="MY ADVERT SHOWROOM" helpTopic={topic} />;
  if (topic === 'budgets') title = <BudgetTracking budgets={[]} loading={false} error="" onRetry={()=>{}} onAdd={()=>{}} onEdit={()=>{}} onDelete={()=>{}} />;
  if (topic === 'invoiceDrop') return <main><AppHeader active="none"/><InvoiceDropClient /></main>;
  return <main><AppHeader active="asset-register"/><div style={{padding:'3rem', minHeight:'120vh'}}>{title}<button style={{marginTop:32}}>Unrelated page action</button></div></main>;
}
