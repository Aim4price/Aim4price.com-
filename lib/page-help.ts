/** Short, task-focused help. Keep copy independent of private account data. */
export const pageHelp = {
  registers: {
    title: 'Manage Asset Registers',
    purpose: 'Organise your assets into separate registers, such as businesses, farms or sites. Combined Asset Registers brings them together in one view.',
    actions: ['Select Add Register to create a separate register.', 'Select Open to view its assets, or Manage to change its details and settings.', 'Use Summary or Download to review your registers and their values.'],
    start: 'Open an existing register, or select Add Register if you need a new one.',
  },
  desktopUsers: {
    title: 'Desktop users',
    purpose: 'Give each person their own sign-in to your desktop workspace and control what they can access.',
    actions: ['Select Add user to create access and choose permissions and assets.', 'Select Manage users to review permissions or remove access.', 'Copy the user sign-in link and give it to the person who will use it.'],
    start: 'Select Add user and choose only the access that person needs.',
  },
  managerUsers: {
    title: 'Manager App Users',
    purpose: 'Create separate phone app logins for people who work with your assets.',
    actions: ['Select Add login and choose the person’s role and asset access.', 'Use Manage logins to update permissions or deactivate a login.', 'Scan the QR code or share the app link to open the Manager App on a phone.'],
    start: 'Create a login, then give the person their sign-in details and the app link.',
  },
  aiConnections: {
    title: 'AI connections',
    purpose: 'Let an AI assistant read the Aim4price information available to your account so you can ask questions about it.',
    actions: ['Select Connect AI, choose your assistant and follow the setup steps.', 'Approve read-only access. Your assistant cannot add, edit or delete records.', 'Use Manage to review connections or disconnect an assistant.'],
    start: 'Select Connect AI. After connecting, try a question such as “Which maintenance is overdue?”',
  },
  transfers: {
    title: 'Asset transfers',
    purpose: 'Move an asset’s portable record between Aim4price accounts when it changes owner.',
    actions: ['Choose Incoming to claim an asset using the transfer details provided to you.', 'Choose Outgoing to review sent assets and manage their one-time transfer codes.', 'Asset details and eligible history can move. Private invoices, finance, insurance and account access stay with the original account.'],
    start: 'Receiving an asset? Choose Incoming. For an asset you have sent, choose Outgoing.',
  },
  showroom: {
    title: 'My Advert Showroom',
    purpose: 'Keep your adverts together and share one showroom link with interested buyers.',
    actions: ['Select Create advert to add equipment you want to advertise.', 'Use Manage advert to update a listing, or Manage showroom to change showroom settings.', 'Select Open showroom to view it. Share showroom is available when the showroom is public.'],
    start: 'Create your first advert, or find an existing advert and select Manage advert.',
  },
  invoiceDrop: {
    title: 'Drop Invoice',
    purpose: 'Send an invoice to Aim4price for checking and delivery to the correct asset owner. You do not need access to their account.',
    actions: ['Select Add invoice and identify the asset using the available code or serial/VIN options.', 'Attach one invoice as a PDF or photos of the same invoice, then add your contact details.', 'Review and send it. Aim4price checks the submission before routing it; sending a file does not give you access to asset records.'],
    start: 'Have the invoice and asset reference ready, then select Add invoice.',
  },
  recentAdverts: {
    title: 'Recently Advertised',
    purpose: 'Browse recently advertised equipment and see the availability shown on each advert.',
    actions: ['Search by equipment, advertiser, location or condition.', 'Select Open to view an advert and its available contact options.', 'Use Refresh to reload the list, or the switch button beside the heading to change views.'],
    start: 'Search for the equipment you need, open a matching advert and confirm availability with the advertiser.',
  },
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
    start: 'Find an existing asset and select Manage, or use Add Asset to create a new record.',
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
    actions: ['Select Add Cost to record an expense or upload an invoice.', 'Use Invoice Drop when you need a link for someone to send in an invoice.', 'Find saved costs with search and filters, or Download your records.'],
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
    actions: ['Add storage tanks and keep their details organised.', 'Select Manage on a tank to record deliveries, fuel issued and other movements.', 'Review tank activity and switch to Fuel Slips for asset fuel receipts.'],
    start: 'Select Add Storage Tank for a new tank, or Manage on an existing tank to view and record activity.',
  },
  documents: {
    title: 'Document Vault',
    purpose: 'Store finance, accounting, insurance and licensing documents in one place. Files stay at account level unless you link them to assets.',
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
    actions: ['Use Discovery to explore assets their owners have made discoverable. These are not necessarily for sale.', 'Use Marketplace to browse adverts for equipment offered for sale.', 'Open an asset or advert to review its details and available contact options.'],
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
