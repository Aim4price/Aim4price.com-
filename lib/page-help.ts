/** Short, task-focused help. Keep copy independent of private account data. */
export const pageHelp = {
  registers: {
    title: 'Manage Asset Registers',
    purpose: 'Organise assets by business, farm or site. Open Combined Asset Registers to see them together.',
    actions: ['Select Add Register to create a separate register.', 'Select Open to view its assets, or Manage to change its details and settings.', 'Use Summary or Download to review your registers and their values.'],
    start: 'Open an existing register, or select Add Register if you need a new one.',
  },
  desktopUsers: {
    title: 'Desktop users',
    purpose: 'Give team members their own desktop sign-in and choose the assets and features they can use.',
    actions: ['Select Add user to create access and choose permissions and assets.', 'Select Manage users to review permissions or remove access.', 'Use Copy user sign-in link to give your team the correct login page.'],
    start: 'Select Add user and choose only the access that person needs.',
  },
  managerUsers: {
    title: 'Manager App Users',
    purpose: 'Give people access to your assets on their phones using separate Manager App logins.',
    actions: ['Select Add login and choose the person’s role and asset access.', 'Use Manage logins to update permissions or deactivate a login.', 'Scan the QR code or share the app link to open the Manager App on a phone.'],
    start: 'Create a login, then give the person their sign-in details and the app link.',
  },
  aiConnections: {
    title: 'AI connections',
    purpose: 'Connect an AI assistant to ask questions about the Aim4price records your account can access.',
    actions: ['Select Connect AI, choose your assistant and follow the setup steps.', 'Approve read-only access. Your assistant cannot add, edit or delete records.', 'Use Manage to review connections or disconnect an assistant.'],
    start: 'Select Connect AI. After connecting, try a question such as “Which maintenance is overdue?”',
  },
  transfers: {
    title: 'Asset transfers',
    purpose: 'Transfer an asset and its portable history to its next owner’s Aim4price account.',
    actions: ['Choose Incoming to claim an asset using the transfer details provided to you.', 'Choose Outgoing to review sent assets and manage their one-time transfer codes.', 'Private invoices, finance, insurance and account access stay with the original account.'],
    start: 'Receiving an asset? Choose Incoming. For an asset you have sent, choose Outgoing.',
  },
  showroom: {
    title: 'My Advert Showroom',
    purpose: 'Manage your adverts in one place and share your public showroom with interested buyers.',
    actions: ['Select Create advert to add equipment you want to advertise.', 'Use Manage advert to update a listing, or Manage showroom to change showroom settings.', 'Select Open showroom to view it. Share showroom is available when the showroom is public.'],
    start: 'Create your first advert, or find an existing advert and select Manage advert.',
  },
  invoiceDrop: {
    title: 'Drop Invoice',
    purpose: 'Send an invoice to the correct asset owner through Aim4price, without needing access to their account.',
    actions: ['Select Add invoice and identify the asset using the available code or serial/VIN options.', 'Attach one invoice as a PDF or photos of the same invoice, then add your contact details.', 'Review and send. Aim4price checks the invoice before routing it; asset records remain private.'],
    start: 'Have the invoice and asset reference ready, then select Add invoice.',
  },
  recentAdverts: {
    title: 'Recently Advertised',
    purpose: 'Find recently advertised equipment and check the availability shown by the advertiser.',
    actions: ['Search by equipment, advertiser, location or condition.', 'Select Open to view an advert and its available contact options.', 'Use Refresh to reload the list, or the switch button beside the heading to change views.'],
    start: 'Search for the equipment you need, open a matching advert and confirm availability with the advertiser.',
  },
  valuation: {
    title: 'Value Asset',
    purpose: 'Estimate what an asset is worth using its details, age, usage and condition.',
    actions: ['Choose the asset sector, type, brand and model.', 'Enter the asset’s year, usage, condition and pricing details as prompted.', 'Review and save the estimate. It is a guide to value, not a guaranteed selling price.'],
    start: 'Choose the sector your asset belongs to, then follow the steps using the most accurate details you have.',
  },
  register: {
    title: 'Asset Register',
    purpose: 'See what you own, what it is worth and what needs attention. Keep each asset’s records together.',
    actions: ['Add assets to registers. Group related assets under an umbrella while keeping their individual records.', 'Select Manage on an asset to update its details and record costs, fuel and maintenance.', 'Review totals, share selected information and download reports.'],
    start: 'Find an existing asset and select Manage, or use Add Asset to create a new record.',
  },
  maintenance: {
    title: 'Maintenance',
    purpose: 'Schedule services, inspections and repairs, and keep a history of completed work for each asset.',
    actions: ['Add maintenance for an asset and record work already done or schedule upcoming work.', 'Use checklists and review work that is due or overdue.', 'Record completed work and review its details when planning the next service or repair.'],
    start: 'Select Add Maintenance, choose the asset and follow the steps for the work you want to record or schedule.',
  },
  costsEntry: {
    title: 'Manage your costs',
    purpose: 'Choose whether to record actual expenses or plan future spending for your assets.',
    actions: ['Open Cost Ledger to record and review expenses.', 'Open Budgets to plan spending and review progress.', 'Link expenses to the correct assets to build a reliable cost history.'],
    start: 'Choose Cost Ledger for an expense, or Budgets to set up a spending plan.',
  },
  costs: {
    title: 'Cost Ledger',
    purpose: 'Record asset expenses, keep supporting invoices and find past costs when you need them.',
    actions: ['Select Add Cost to record an expense or upload an invoice.', 'Use Invoice Drop when you need a link for someone to send in an invoice.', 'Find saved costs with search and filters, or Download your records.'],
    start: 'Select Add Cost and choose the option that suits your record. Check the amount, date and asset before saving.',
  },
  budgets: {
    title: 'Budgets',
    purpose: 'Set spending limits for a period and compare them with the costs you have recorded.',
    actions: ['Create a budget for the period and assets you want to track.', 'Review spending against the budget and keep recorded costs up to date.', 'Open Alerts to review budget warnings, or Download to export your budget information.'],
    start: 'Select Add Budget, choose what it covers and enter the planned amount and period.',
  },
  fuelEntry: {
    title: 'Manage your fuel',
    purpose: 'Choose whether to manage stored fuel or record fuel purchases for your assets.',
    actions: ['Open Storage Tanks to manage tanks and their fuel movements.', 'Open Fuel Slips to record and review fuel receipts.', 'Link fuel records to the correct assets to review their usage and spending.'],
    start: 'Choose Storage Tanks for stored fuel, or Fuel Slips for fuel receipts and asset usage.',
  },
  fuelSlips: {
    title: 'Fuel Slips',
    purpose: 'Keep a fuel history for each asset, including quantities, costs and usage readings where available.',
    actions: ['Add fuel records with the date, quantity, cost and relevant asset details.', 'Search and filter saved records to find a specific fill-up.', 'Download fuel records for review and reporting.'],
    start: 'Select Add Fuel Slip and choose the asset. Enter the fuel details and attach the receipt if you have one.',
  },
  fuelStorage: {
    title: 'Storage Tanks',
    purpose: 'See how much fuel is in each tank and record deliveries and fuel issued to assets.',
    actions: ['Add storage tanks and keep their details organised.', 'Select Manage on a tank to record deliveries, fuel issued and other movements.', 'Review tank activity and switch to Fuel Slips for asset fuel receipts.'],
    start: 'Select Add Storage Tank for a new tank, or Manage on an existing tank to view and record activity.',
  },
  documents: {
    title: 'Document Vault',
    purpose: 'Keep important documents in one place. Files belong to your account unless you link them to specific assets.',
    actions: ['Upload finance, accounting, insurance or licensing documents and choose their document type.', 'Link documents to assets and use filters to find them again.', 'Review removed documents in the Recycle Bin.'],
    start: 'Select Upload documents, add your file and link it to the relevant asset where applicable.',
  },
  map: {
    title: 'Asset Map & Tracking',
    purpose: 'Find your assets on the map and review their saved locations and available tracking history.',
    actions: ['Add an asset to the map and save its location.', 'Search or filter mapped assets and open their details.', 'Review tracking records and Download map information. A saved location may not be the asset’s current position.'],
    start: 'Select Add asset to map to save a location, or choose an existing mapped asset to see its details.',
  },
  marketplaceEntry: {
    title: 'Explore assets',
    purpose: 'Choose Discovery to explore owner-approved assets, or Marketplace to browse equipment for sale.',
    actions: ['Open Discovery to find assets their owners have made visible. They are not necessarily for sale.', 'Use Marketplace to browse adverts for equipment offered for sale.', 'Open an asset or advert to review its details and available contact options.'],
    start: 'Choose Discovery to explore owner-approved assets, or Marketplace to browse sale listings.',
  },
  discovery: {
    title: 'Discovery',
    purpose: 'Explore assets their owners have made visible to others. Being discoverable does not mean an asset is for sale.',
    actions: ['Search and filter to find relevant equipment.', 'Open an asset to review the information its owner has made available.', 'Use the available contact options to discuss your interest.'],
    start: 'Search for the equipment you need, then open a matching asset to learn more.',
  },
  marketplace: {
    title: 'Marketplace',
    purpose: 'Find equipment advertised for sale and compare its details, photos and asking price.',
    actions: ['Search and filter adverts by the available equipment details.', 'Review photos, prices and listing information.', 'Use the contact options to discuss availability and details with the seller.'],
    start: 'Search for a brand or model, or use the filters to narrow the listings.',
  },
  account: {
    title: 'Your account',
    purpose: 'Update your business details and manage the people, apps and connections linked to your account.',
    actions: ['Keep your profile and contact information up to date.', 'Manage registers, desktop users, app access and AI connections through the available quick actions.', 'Review billing and manage your password and security settings.'],
    start: 'Choose the quick action for what you want to manage. Access settings control what other people can use.',
  },
} as const;

export type PageHelpTopic = keyof typeof pageHelp;
