/** Short, task-focused help. Keep copy independent of private account data. */
export const pageHelp = {
  valuation: {
    title: 'Value Asset',
    purpose: 'Estimate what an asset is worth using its details, age, usage and condition.',
    actions: ['Choose the asset sector, type, brand and model.', 'Work through the available pricing and condition questions.', 'Review the estimate and save it to your asset register. An estimate is a guide, not a guaranteed selling price.'],
    start: 'Choose the sector your asset belongs to, then follow the steps using the most accurate details you have.',
  },
  register: {
    title: 'Asset Register',
    purpose: 'Know what you own, what it is worth and what needs attention, with records connected to each asset.',
    actions: ['Add assets and organise them into registers. Use umbrellas to group related assets while keeping their individual records.', 'Open Manage on an asset to update details and build its cost, fuel and maintenance history.', 'Review totals, share selected information and download reports.'],
    start: 'Select Add Asset to begin. The Start here guide below the search bar walks you through adding an asset, building its history and viewing reports.',
  },
  maintenance: {
    title: 'Maintenance',
    purpose: 'Keep track of planned work and completed maintenance so you can look after your assets.',
    actions: ['Add maintenance for an asset and record work already done or schedule upcoming work.', 'Use checklists and review work that is due or overdue.', 'Record completion and keep the details available for future reference.'],
    start: 'Select Add Maintenance, choose the asset and follow the steps for the work you want to record or schedule.',
  },
  costsEntry: {
    title: 'Manage your costs',
    purpose: 'Bring actual expenses and planned spending together so you can understand what your assets cost to run.',
    actions: ['Open Cost Ledger to record and review expenses.', 'Open Budgets to plan spending and review progress.', 'Connect costs to assets so their history stays useful.'],
    start: 'Choose Cost Ledger for an expense, or Budgets to set up a spending plan.',
  },
  costs: {
    title: 'Cost Ledger',
    purpose: 'Keep a clear record of expenses and connect them to the assets they relate to.',
    actions: ['Add a cost and attach supporting documents where available.', 'Find saved costs using search and filters.', 'Download records and switch to Budgets to review planned spending.'],
    start: 'Select Add Cost and choose the option that suits your record. Check the amount, date and asset before saving.',
  },
  budgets: {
    title: 'Budgets',
    purpose: 'Plan spending and compare it with recorded costs to see where your money is going.',
    actions: ['Create a budget for the period and assets you want to track.', 'Review spending against the budget and keep recorded costs up to date.', 'Use alerts and downloads to keep track of your plans.'],
    start: 'Select Add Budget, choose what it covers and enter the planned amount and period.',
  },
  fuelEntry: {
    title: 'Manage your fuel',
    purpose: 'Track fuel in storage and fuel recorded against your assets.',
    actions: ['Open Storage Tanks to manage tanks and their fuel movements.', 'Open Fuel Slips to record and review fuel receipts.', 'Keep fuel records linked to the right assets.'],
    start: 'Choose Storage Tanks for stored fuel, or Fuel Slips for fuel receipts and asset usage.',
  },
  fuelSlips: {
    title: 'Fuel Slips',
    purpose: 'Record fuel against your assets so you can review usage and spending over time.',
    actions: ['Add fuel records with the date, quantity, cost and relevant asset details.', 'Search and filter saved records to find a specific fill-up.', 'Download fuel records for review and reporting.'],
    start: 'Select Add Fuel Slip and choose the asset. Enter the fuel details and attach the receipt if you have one.',
  },
  fuelStorage: {
    title: 'Storage Tanks',
    purpose: 'Keep a record of your fuel storage tanks and the fuel moving into and out of them.',
    actions: ['Add storage tanks and keep their details organised.', 'Record fuel movements to keep the stored balance useful.', 'Review tank activity and switch to Fuel Slips for asset fuel receipts.'],
    start: 'Select Add Storage Tank to create your first tank, or open an existing tank to manage its activity.',
  },
  documents: {
    title: 'Document Vault',
    purpose: 'Keep important documents together and link them to the assets they support.',
    actions: ['Upload documents and choose a suitable document type.', 'Link documents to assets and use filters to find them again.', 'Review removed documents in the Recycle Bin.'],
    start: 'Select Upload documents, add your file and link it to the relevant asset where applicable.',
  },
  map: {
    title: 'Asset Map & Tracking',
    purpose: 'See saved asset locations and review available tracking information in one place.',
    actions: ['Add an asset to the map and save its location.', 'Search or filter mapped assets and open their details.', 'Review available tracking records and download map information. A saved location is not necessarily a live position.'],
    start: 'Select Add asset to map to save a location, or choose an existing mapped asset to see its details.',
  },
  marketplaceEntry: {
    title: 'Explore assets',
    purpose: 'Find assets through Discovery or browse equipment advertised for sale.',
    actions: ['Use Discovery to explore assets their owners have made discoverable.', 'Use Marketplace to browse adverts for equipment offered for sale.', 'Open an asset or advert to review its details and available contact options.'],
    start: 'Choose Discovery to explore owner-approved assets, or Marketplace to browse sale listings.',
  },
  discovery: {
    title: 'Discovery',
    purpose: 'Explore assets that owners have chosen to make discoverable. Discoverable assets are not necessarily for sale.',
    actions: ['Search and filter to find relevant equipment.', 'Open an asset to review the information its owner has made available.', 'Use the available contact options to discuss your interest.'],
    start: 'Search for the equipment you need, then open a matching asset to learn more.',
  },
  marketplace: {
    title: 'Marketplace',
    purpose: 'Browse equipment advertised for sale and find listings that match what you need.',
    actions: ['Search and filter adverts by the available equipment details.', 'Review photos, prices and listing information.', 'Use the contact options to discuss availability and details with the seller.'],
    start: 'Search for a brand or model, or use the filters to narrow the listings.',
  },
  account: {
    title: 'Your account',
    purpose: 'Manage your business details, account access and the connections you use with Aim4price.',
    actions: ['Keep your profile and contact information up to date.', 'Manage registers, desktop users, app access and AI connections through the available quick actions.', 'Review billing and manage your password and security settings.'],
    start: 'Choose the quick action for what you want to manage. Access settings control what other people can use.',
  },
} as const;

export type PageHelpTopic = keyof typeof pageHelp;
