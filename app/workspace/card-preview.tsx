import type { PageHelpTopic } from '../../lib/page-help';
import type { CardKey, WorkspaceRole } from '../../lib/workspace-navigation';
import styles from './workspace.module.css';

type Preview = { topic: PageHelpTopic; rows: [string, string][]; video?: string };

// Public demonstration content only. A preview never loads the destination page.
const previews: Record<CardKey, Preview> = {
  register: {topic:'register', rows:[['Toyota Hilux','Vehicle'],['New Holland TS90','Tractor']]},
  registers: {topic:'registers', rows:[['Vehicles','9 assets'],['Farm equipment','6 assets']]},
  shared: {topic:'sharedEnquiries', rows:[['Vehicles','9 assets'],['Toyota Hilux','Shared']]},
  value: {topic:'valuation', rows:[['Year model','2023'],['Condition','Good'],['Usage','117 587 km']]},
  marketplace: {topic:'marketplace', rows:[], video:'/marketplace/Aim4price_Marketplace.mp4'},
  discovery: {topic:'discovery', rows:[], video:'/discovery/Aim4price_Discovery.mp4'},
  map: {topic:'map', rows:[['Tractor','North field'],['Pickup','Workshop']]},
  maintenance: {topic:'maintenance', rows:[['Engine service','Upcoming'],['Oil change','Completed']]},
  tracking: {topic:'dealerTracking', rows:[['Toyota Hilux','Service due'],['New Holland TS90','Completed']]},
  costs: {topic:'costs', rows:[['Workshop invoice','Repairs'],['Fuel delivery','Diesel']]},
  businessCosts: {topic:'dealerCosts', rows:[['Service invoice','Toyota Hilux'],['Parts invoice','Tractor']]},
  budgets: {topic:'budgets', rows:[['Maintenance','Annual budget'],['Fuel','Monthly budget']]},
  fuel: {topic:'fuelSlips', rows:[['Tractor','80 L'],['Pickup','55 L']]},
  storage: {topic:'fuelStorage', rows:[['Main tank','1 200 L'],['Field tank','450 L']]},
  documents: {topic:'documents', rows:[['Service invoice','PDF'],['Valuation report','PDF']]},
  parts: {topic:'partsStock', rows:[['Oil filter','12 in stock'],['Drive belt','4 in stock']]},
  showroom: {topic:'showroom', rows:[['Toyota Hilux','Listed'],['New Holland TS90','Listed']]},
  template: {topic:'adTemplate', rows:[['Business logo','Branding'],['Contact details','Footer']]},
  advert: {topic:'adCreator', rows:[['Toyota Hilux','Asset photo'],['Asking price','Advert details']]},
  account: {topic:'account', rows:[['Business details','Profile'],['Sign-in settings','Security']]},
};

export function cardTopic(key: CardKey, role: WorkspaceRole, href: string, free: boolean): PageHelpTopic {
  if (key === 'shared' && href === '/leads') return 'partnerLeads';
  if (key === 'account' && role === 'middleman') return 'middlemanAccount';
  if (key === 'account' && role === 'business') return free ? 'sharingAccount' : 'dealerAccount';
  return previews[key].topic;
}

export default function CardPreview({cardKey, label}: {cardKey: CardKey; label: string}) {
  const preview = previews[cardKey];
  return <span className={styles.preview} aria-hidden="true">
    {preview.video ? <video muted playsInline autoPlay loop src={preview.video} /> :
      <span className={styles.sheet}>
        <b>{label}</b>
        {preview.rows.map(([name, detail]) => <span className={styles.sampleRow} key={name}>
          <span>{name}</span><small>{detail}</small>
        </span>)}
      </span>}
  </span>;
}
