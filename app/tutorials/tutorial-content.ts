// Set videoSrc to the hosted introduction recording when it is ready.
export const ownerIntroduction: { videoSrc?: string; captionsSrc?: string } = {};

export type FeatureCategory = { id: string; title: string; description: string; icon: string };
export type Tutorial = { category: string; id: string; title: string; question: string; guideTitle: string; videoOutcome: string; description: string; where: string; steps: string[]; example: string; note: string; audience: string; href: string; action: string; keywords: string; videoSrc?: string; captionsSrc?: string };
// Add a hosted video and captions only when a recording is ready.
export const featureCategories: FeatureCategory[] = [
  {
    "id": "start",
    "title": "Getting started",
    "description": "Build your first useful asset record.",
    "icon": "spark"
  },
  {
    "id": "assets",
    "title": "Your assets",
    "description": "Keep what you own organised and easy to find.",
    "icon": "asset"
  },
  {
    "id": "values",
    "title": "Values & ownership",
    "description": "Understand value, replacement and the cost of ownership.",
    "icon": "value"
  },
  {
    "id": "costs",
    "title": "Costs & invoices",
    "description": "Put spending and paperwork in the right place.",
    "icon": "cost"
  },
  {
    "id": "fuel",
    "title": "Fuel & activities",
    "description": "See where fuel goes and what your assets do.",
    "icon": "fuel"
  },
  {
    "id": "maintenance",
    "title": "Maintenance & problems",
    "description": "Plan the next job and keep a record of the last one.",
    "icon": "tool"
  },
  {
    "id": "sharing",
    "title": "Sharing & working together",
    "description": "Bring the right people into the asset’s story.",
    "icon": "share"
  },
  {
    "id": "reports",
    "title": "Reports & decisions",
    "description": "Turn recorded information into something you can use.",
    "icon": "report"
  },
  {
    "id": "market",
    "title": "Buying & selling",
    "description": "Explore options and prepare for an asset sale.",
    "icon": "business"
  },
  {
    "id": "connections",
    "title": "Apps & AI",
    "description": "Keep records moving, wherever the work happens.",
    "icon": "connection"
  }
];
export const tutorials: Tutorial[] = [
  {
    "category": "start",
    "id": "first-asset",
    "title": "Add an asset",
    "description": "Start with one vehicle or machine and build its record over time.",
    "where": "Asset Register / Add Asset",
    "steps": [
      "Choose Add Asset and follow the estimate or manual-entry route.",
      "Review the year, usage, condition and identifying details.",
      "Save the asset, then open its card to check the record."
    ],
    "example": "Keep a tractor’s fuel purchases, repair invoices and service history together so you can review what it costs to keep running.",
    "note": "You can start before every document is ready.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Add your first asset",
    "question": "How do I start recording what I own?",
    "guideTitle": "Add your first asset",
    "videoOutcome": "Build a record you can keep adding to."
  },
  {
    "category": "start",
    "id": "capture",
    "title": "Upload assistance",
    "description": "Record information yourself or submit documents for Aim4price capture.",
    "where": "Asset Register / Add Asset; asset / Add cost",
    "steps": [
      "Choose manual entry to enter the details yourself.",
      "Choose Aim4price upload to request capture assistance.",
      "Submit readable documents, then check the capture status and completed record."
    ],
    "example": "When paperwork builds up after a busy week, submit readable documents for capture and check the completed records before using them.",
    "note": "Capture assistance and managed administration have separate allowances and pricing.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Choose how to add your information",
    "question": "Can I upload information myself or get help?",
    "guideTitle": "Choose an upload method",
    "videoOutcome": "Choose between entering details and requesting capture assistance."
  },
  {
    "category": "start",
    "id": "manage",
    "title": "Manage an asset",
    "description": "Use the asset card as the starting point for everyday work.",
    "where": "Asset card / Manage",
    "steps": [
      "Check the asset title and identifying details.",
      "Open Manage to find pricing, costs, maintenance and reports.",
      "Return to the same asset after each task to check what was saved."
    ],
    "example": "Before booking a bakkie into a workshop, open its record to check previous work and identify what needs attention.",
    "note": "",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Find your way around an asset",
    "question": "Where do I find everything for one asset?",
    "guideTitle": "Find an asset’s tools",
    "videoOutcome": "Reach the right task from one asset card."
  },
  {
    "category": "assets",
    "id": "registers",
    "title": "Asset registers",
    "description": "Keep groups of assets together without losing their individual records.",
    "where": "Asset Register / register selector",
    "steps": [
      "Open the register selector.",
      "Create or select the register for the assets you want to manage.",
      "Check the selected register before adding or finding an asset."
    ],
    "example": "Keep two businesses in separate registers so you can find each business’s vehicles and equipment more easily.",
    "note": "Owner active-asset limits apply across the account, not separately to each register.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Organise assets into registers",
    "question": "How do I keep different groups of assets organised?",
    "guideTitle": "Organise your registers",
    "videoOutcome": "Separate asset groups without mixing their records."
  },
  {
    "category": "assets",
    "id": "umbrellas",
    "title": "Asset umbrellas",
    "description": "Bring related assets together for viewing and sharing.",
    "where": "Asset Register / umbrella options",
    "steps": [
      "Create an umbrella and give it a recognisable name.",
      "Select the assets that belong together.",
      "Review the group before sharing or working with it."
    ],
    "example": "Group a tractor and its implements so you can share the working unit while retaining each asset’s individual record.",
    "note": "Each asset retains its own details and history.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Group assets into an umbrella",
    "question": "Can I group related assets together?",
    "guideTitle": "Create an asset umbrella",
    "videoOutcome": "Bring related assets together for sharing."
  },
  {
    "category": "assets",
    "id": "details",
    "title": "Asset details",
    "description": "Keep the year, usage, condition and serial / VIN accurate.",
    "where": "Asset card / Manage / Update details",
    "steps": [
      "Open the asset and choose Update details.",
      "Update the relevant year, usage, condition or serial / VIN.",
      "Save and check the updated asset card."
    ],
    "example": "Update a tractor’s hours after a week of work so the next person reviewing its record has a current reading.",
    "note": "Available editing actions depend on your access.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Update asset details",
    "question": "How do I keep my asset details accurate?",
    "guideTitle": "Update an asset’s details",
    "videoOutcome": "Keep identifying details and usage current."
  },
  {
    "category": "assets",
    "id": "documents",
    "title": "Documents",
    "description": "Find supporting paperwork without hunting through separate files.",
    "where": "Documents",
    "steps": [
      "Open Documents and select the relevant folder.",
      "Upload your paperwork and give it a recognisable name.",
      "Open the saved file to check it is the right document."
    ],
    "example": "Find the original purchase invoice before speaking to an adviser, without searching through old emails.",
    "note": "",
    "audience": "Owner",
    "href": "/documents",
    "action": "Open Documents",
    "keywords": "documents paperwork invoices files folders",
    "question": "Where can I keep my asset paperwork?",
    "guideTitle": "Organise your documents",
    "videoOutcome": "Keep useful paperwork easy to find."
  },
  {
    "category": "assets",
    "id": "photos",
    "title": "Asset photos",
    "description": "Build a clear visual record of the machine, its identity and condition.",
    "where": "Asset / photos",
    "steps": [
      "Open the asset’s photos.",
      "Add clear images of the asset, serial plate and condition.",
      "Review the saved photos; edit, download or delete them as needed."
    ],
    "example": "Save a serial-plate photo and condition photos so you can identify the machine and explain its condition when sharing it.",
    "note": "",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Manage asset photos",
    "question": "How do I build a useful visual record?",
    "guideTitle": "Build an asset photo record",
    "videoOutcome": "Capture identity and condition clearly."
  },
  {
    "category": "assets",
    "id": "history",
    "title": "Asset history",
    "description": "See the recorded changes and work behind the asset’s current state.",
    "where": "Asset / History",
    "steps": [
      "Open History on the correct asset.",
      "Review the recorded events and available details.",
      "Use the history to check what changed and what needs follow-up."
    ],
    "example": "Review previous work when a fault returns, giving the mechanic useful context instead of relying on memory.",
    "note": "",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review asset history",
    "question": "What has happened to this asset?",
    "guideTitle": "Review an asset’s history",
    "videoOutcome": "Check recorded events before deciding what to do next."
  },
  {
    "category": "assets",
    "id": "map",
    "title": "Asset map",
    "description": "See assets with recorded locations together in one view.",
    "where": "Asset Map",
    "steps": [
      "Open Asset Map.",
      "Use the search, list or filters to find the relevant assets.",
      "Select a mapped asset and review its recorded location."
    ],
    "example": "Review recorded locations before arranging site visits so you can plan which machinery to inspect together.",
    "note": "Locations depend on the information recorded; this is not live tracking.",
    "audience": "Owner",
    "href": "/asset-map",
    "action": "Open Asset Map",
    "keywords": "gps location Find assets on the map",
    "question": "Where are my assets located?",
    "guideTitle": "Find recorded asset locations",
    "videoOutcome": "Locate machinery across your sites."
  },
  {
    "category": "assets",
    "id": "status",
    "title": "Insurance & finance",
    "description": "Keep important asset status details visible alongside the record.",
    "where": "Asset / status / details",
    "steps": [
      "Open the asset’s available status controls.",
      "Record the relevant ownership, insurance, finance and licensing information.",
      "Review the saved status and keep supporting documents up to date."
    ],
    "example": "Check which vehicles are recorded as financed before preparing a discussion about selling or replacing them.",
    "note": "A saved status does not itself provide insurance or finance cover.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Record ownership, insurance and finance status",
    "question": "Which assets are insured, financed or licensed?",
    "guideTitle": "Update insurance and finance details",
    "videoOutcome": "Keep important status information with the asset."
  },
  {
    "category": "assets",
    "id": "licence",
    "title": "Licence renewals",
    "description": "Keep licensing details and renewal information with applicable assets.",
    "where": "Asset / licensing details; register overview",
    "steps": [
      "Open the asset’s licensing information.",
      "Check the registration details and requested renewal information.",
      "Review renewal alerts and update the record when renewed."
    ],
    "example": "Review a vehicle’s renewal information ahead of a busy month so you can arrange the renewal in time.",
    "note": "Licensing features apply to relevant assets. Saving information does not renew a licence.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "license renewal registration Track licence renewals",
    "question": "Which licence renewals need attention?",
    "guideTitle": "Check licence renewal details",
    "videoOutcome": "Keep upcoming renewals visible."
  },
  {
    "category": "values",
    "id": "estimate",
    "title": "Estimated value",
    "description": "Build a useful starting point for understanding an asset’s value.",
    "where": "Get Estimate",
    "steps": [
      "Choose the asset type and enter the requested specifications.",
      "Check the year, usage and condition carefully.",
      "Review the estimate and its supporting details before using it."
    ],
    "example": "Review a tractor’s estimated value alongside its repair costs before deciding whether to keep it or explore selling it.",
    "note": "An estimate is a decision aid, not a guaranteed selling price.",
    "audience": "Owner",
    "href": "/valuation",
    "action": "Get an estimate",
    "keywords": " Get an estimated value",
    "question": "What could my asset be worth?",
    "guideTitle": "Request an estimated value",
    "videoOutcome": "Get a starting point for a keep-or-sell discussion."
  },
  {
    "category": "values",
    "id": "pricing",
    "title": "Asset & replacement values",
    "description": "Keep your pricing information aligned with what you know.",
    "where": "Asset / Manage / pricing options",
    "steps": [
      "Open the asset’s pricing options.",
      "Review the available values and update the relevant information.",
      "Save and check the figures before using them in a report."
    ],
    "example": "Record a replacement value from a recent supplier quote so your next asset review uses a more current figure.",
    "note": "Recipients see only the pricing actions the owner permits.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Manage asset and replacement values",
    "question": "How do I keep asset and replacement values current?",
    "guideTitle": "Update asset and replacement values",
    "videoOutcome": "Keep saved figures aligned with current information."
  },
  {
    "category": "values",
    "id": "sale-transfer",
    "title": "Sales & transfers",
    "description": "Keep ownership changes and disposal records organised.",
    "where": "Asset sale / transfer options; Account / asset transfers",
    "steps": [
      "Open the relevant asset’s sale or transfer action.",
      "Check the asset, recipient and sale information requested.",
      "Review the confirmation and follow any pending transfer steps."
    ],
    "example": "Record a sold vehicle and follow its transfer status so you can distinguish pending changes from completed transfers.",
    "note": "A pending transfer should be checked before assuming it is complete.",
    "audience": "Owner",
    "href": "/account/asset-transfers",
    "action": "Open asset transfers",
    "keywords": " Record a sale or asset transfer",
    "question": "How do I record a sale or transfer?",
    "guideTitle": "Record a sale or transfer",
    "videoOutcome": "Keep ownership changes clear."
  },
  {
    "category": "costs",
    "id": "manual-cost",
    "title": "Add a cost",
    "description": "Link an expense to the asset it belongs to.",
    "where": "Asset / Add cost; Cost Ledger",
    "steps": [
      "Choose manual cost entry.",
      "Select the asset and enter the date, amount and expense details.",
      "Review and save, then check the entry in Cost Ledger."
    ],
    "example": "Record a replacement tyre against the bakkie it was fitted to so that expense appears in the correct vehicle’s cost record.",
    "note": "",
    "audience": "Owner",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": " Add a cost manually",
    "question": "How do I record an expense against an asset?",
    "guideTitle": "Record an asset expense",
    "videoOutcome": "Put each expense against the right asset."
  },
  {
    "category": "costs",
    "id": "invoice-capture",
    "title": "Invoice capture",
    "description": "Use the invoice itself to start recording an expense.",
    "where": "Asset / Add cost / Aim4price upload",
    "steps": [
      "Select the correct asset and upload a readable invoice.",
      "Review the submitted document and requested details.",
      "Check the capture status and resulting cost entry."
    ],
    "example": "Submit a workshop invoice for capture to reduce retyping, then check the resulting entry belongs to the correct machine.",
    "note": "Submitting an invoice and completing its capture are separate steps.",
    "audience": "Owner",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": " Submit an invoice for capture",
    "question": "Can Aim4price capture an invoice for me?",
    "guideTitle": "Submit an invoice for capture",
    "videoOutcome": "Start a cost record from the invoice itself."
  },
  {
    "category": "costs",
    "id": "invoice-drop",
    "title": "Supplier invoices",
    "description": "Get paperwork to the right asset without sharing your whole account.",
    "where": "Drop invoice",
    "steps": [
      "Identify the asset using the information requested.",
      "Attach the invoice and check the destination.",
      "Submit it for verification and capture."
    ],
    "example": "Ask a mechanic to submit a repair invoice directly so it can be checked and captured without giving them access to your account.",
    "note": "Sending a document does not give the sender access to asset records.",
    "audience": "Owner",
    "href": "/drop-invoice",
    "action": "Drop an invoice",
    "keywords": "supplier mechanic paperwork Let a supplier drop an invoice",
    "question": "Can my supplier send an invoice directly?",
    "guideTitle": "Receive a supplier invoice",
    "videoOutcome": "Bring supplier paperwork into the capture process."
  },
  {
    "category": "costs",
    "id": "budgets",
    "title": "Budgets",
    "description": "Give planned spending a place alongside actual recorded costs.",
    "where": "Cost Ledger / budgets",
    "steps": [
      "Open the budget tools and choose the relevant scope.",
      "Enter the budget period and planned amounts.",
      "Review recorded costs against the plan and investigate differences."
    ],
    "example": "Compare the season’s planned servicing spend with recorded workshop costs to spot where you need to investigate overspending.",
    "note": "Check that expenses are linked to the correct assets and period.",
    "audience": "Owner",
    "href": "/budgets",
    "action": "Open budgets",
    "keywords": " Review spending against a budget",
    "question": "Am I spending more than I planned?",
    "guideTitle": "Set and review a budget",
    "videoOutcome": "Compare planned spending with recorded costs."
  },
  {
    "category": "costs",
    "id": "ledger",
    "title": "Cost Ledger",
    "description": "See saved expenses together and inspect their supporting entries.",
    "where": "Cost Ledger",
    "steps": [
      "Open Cost Ledger.",
      "Search or filter for the asset and entries you need.",
      "Open an entry to check its amount, date and supporting information."
    ],
    "example": "Find a vehicle’s repair entries before discussing recurring costs with the workshop.",
    "note": "",
    "audience": "Owner",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": "invoice expenses spending Find and review recorded costs",
    "question": "Where can I find my recorded costs?",
    "guideTitle": "Find and review cost entries",
    "videoOutcome": "Trace recorded spending back to its supporting details."
  },
  {
    "category": "fuel",
    "id": "fuel-slip",
    "title": "Fuel purchases",
    "description": "Save the litres and cost from a fuel slip.",
    "where": "Add fuel / Fuel slip",
    "steps": [
      "Choose Fuel slip when the fuel was bought from a station or supplier.",
      "Select the asset and enter the requested date, litres, cost and readings.",
      "Review the details and save the entry."
    ],
    "example": "Record a delivery vehicle’s fill-up while the slip is available, keeping the purchase linked to the right vehicle.",
    "note": "",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "diesel petrol fill up Record a fuel purchase",
    "question": "How do I record a fuel purchase?",
    "guideTitle": "Record a fuel purchase",
    "videoOutcome": "Save the litres and amount from a fuel slip."
  },
  {
    "category": "fuel",
    "id": "fuel-storage",
    "title": "Fuel from storage",
    "description": "Track fuel issued from a tank to an asset.",
    "where": "Add fuel / From fuel storage",
    "steps": [
      "Choose the storage route rather than a purchase slip.",
      "Select the tank and receiving asset.",
      "Enter the quantity and readings requested, then review and save."
    ],
    "example": "Record diesel issued to a tractor from the farm tank so you can see which asset received it without treating it as a new fuel purchase.",
    "note": "Choose the correct source so a storage issue is not recorded as another purchase.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "diesel tank Record fuel from storage",
    "question": "How much fuel went from my tank into this asset?",
    "guideTitle": "Record fuel issued from storage",
    "videoOutcome": "Link a tank issue to the receiving asset."
  },
  {
    "category": "fuel",
    "id": "tanks",
    "title": "Fuel tanks",
    "description": "Keep tank records and fuel movements organised.",
    "where": "Fuel Ledger / storage",
    "steps": [
      "Open the storage view and select the relevant tank.",
      "Record the available delivery or issue information.",
      "Review its movements and investigate discrepancies."
    ],
    "example": "Compare recorded tank deliveries and issues when checking a stock discrepancy so you know which movements to investigate.",
    "note": "A calculated balance depends on complete, accurate entries.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": " Manage fuel storage",
    "question": "How do I keep track of my fuel storage?",
    "guideTitle": "Review tank movements",
    "videoOutcome": "Keep deliveries and issues together."
  },
  {
    "category": "fuel",
    "id": "activities",
    "title": "Saved Activities",
    "description": "Connect usage records to the work an asset performs.",
    "where": "Fuel Ledger / activities and fuel records",
    "steps": [
      "Choose the asset and an activity appropriate to it.",
      "Enter the work period and readings requested.",
      "Review activities alongside fuel records and available reports."
    ],
    "example": "Record ploughing for a tractor or deliveries for a vehicle so you can review fuel records alongside the work performed.",
    "note": "Use consistent readings and units when comparing fuel use.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "saved activities work delivery ploughing Record activities and review fuel use",
    "question": "What work is my asset doing with its fuel?",
    "guideTitle": "Record a work activity",
    "videoOutcome": "Give fuel and usage records useful context."
  },
  {
    "category": "maintenance",
    "id": "completed-work",
    "title": "Completed maintenance",
    "description": "Keep a clear record of servicing, checks and repairs.",
    "where": "Asset / Manage / Maintenance / Add maintenance",
    "steps": [
      "Choose the correct asset and maintenance action.",
      "Enter what was done, when it was done and the requested readings.",
      "Add supporting information where available, then save and review."
    ],
    "example": "Save the details of a completed service so you and the mechanic can check what was replaced at the next visit.",
    "note": "",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "service mechanic repair Record completed maintenance",
    "question": "How do I keep a record of servicing and repairs?",
    "guideTitle": "Record completed maintenance",
    "videoOutcome": "Keep a usable record of the work done."
  },
  {
    "category": "maintenance",
    "id": "schedule",
    "title": "Service schedules",
    "description": "Plan upcoming work by date or usage.",
    "where": "Asset / Manage / Maintenance / scheduling",
    "steps": [
      "Choose the asset and work that needs to happen.",
      "Set the available date or usage-based scheduling options.",
      "Review upcoming maintenance and record completion when the job is done."
    ],
    "example": "Schedule a tractor’s next service so upcoming maintenance can be reviewed before a busy working period.",
    "note": "Scheduling work does not mark it as completed.",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "due reminders upcoming service Schedule the next service",
    "question": "What needs servicing next?",
    "guideTitle": "Create a service schedule",
    "videoOutcome": "Plan upcoming work by date or usage."
  },
  {
    "category": "maintenance",
    "id": "checklists",
    "title": "Checklists",
    "description": "Give recurring checks a clear place in each asset’s record.",
    "where": "Asset / Manage / Maintenance / Checklists",
    "steps": [
      "Open the checklist for the correct asset.",
      "Review the relevant checks and record the available completion details.",
      "Check the saved result before the next job."
    ],
    "example": "Use a checklist before a vehicle’s next job so the recorded checks can be reviewed and any concerns followed up.",
    "note": "Choose the checklist that fits the asset.",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": " Use maintenance checklists",
    "question": "How do I make routine checks easier to follow?",
    "guideTitle": "Complete an asset checklist",
    "videoOutcome": "Record checks against the correct machine."
  },
  {
    "category": "maintenance",
    "id": "problems",
    "title": "Log problems",
    "description": "Keep faults visible until they have been dealt with.",
    "where": "Asset / maintenance or problem actions",
    "steps": [
      "Log the problem against the correct asset.",
      "Describe the symptom and add supporting information where available.",
      "Review the issue and confirm its resolution after the work is complete."
    ],
    "example": "Log a hydraulic leak when it is noticed so the workshop has a clear description and you can confirm when it has been resolved.",
    "note": "",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "fault issue breakdown Log and resolve problems",
    "question": "What problems still need to be fixed?",
    "guideTitle": "Log and resolve a problem",
    "videoOutcome": "Keep an issue visible until it is dealt with."
  },
  {
    "category": "maintenance",
    "id": "parts",
    "title": "Part numbers",
    "description": "Keep useful parts references with the machine they belong to.",
    "where": "Asset / Manage / Maintenance / Parts",
    "steps": [
      "Open Parts on the correct asset.",
      "Choose the relevant component and record its part information.",
      "Review the saved reference before ordering."
    ],
    "example": "Save a tractor’s filter reference after checking it so you have a useful starting point when ordering the next replacement.",
    "note": "Confirm part compatibility with the supplier before ordering.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Save and find part numbers",
    "question": "Where did I save that part number?",
    "guideTitle": "Save a part reference",
    "videoOutcome": "Keep component details ready for the next order."
  },
  {
    "category": "sharing",
    "id": "inside",
    "title": "Share inside Aim4price",
    "description": "Send an asset to a business or dealer through the platform.",
    "where": "Asset or umbrella / Share / Inside Aim4price",
    "steps": [
      "Open Share on an asset or umbrella and choose Share inside Aim4price.",
      "Find the recipient in the business directory. Use Business not listed if you need to invite them.",
      "Choose the access settings, check the recipient and confirm the share."
    ],
    "example": "Share a machine with your workshop and allow the relevant maintenance actions so work can be recorded against the correct asset.",
    "note": "Only include the actions and reports the recipient needs.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Share inside Aim4price business directory invite business not listed",
    "question": "How do I work with a business through Aim4price?",
    "guideTitle": "Share with an Aim4price business",
    "videoOutcome": "Give the intended recipient the access they need."
  },
  {
    "category": "sharing",
    "id": "outside",
    "title": "WhatsApp & email",
    "description": "Prepare asset information for a conversation outside Aim4price.",
    "where": "Asset or umbrella / Share / Outside Aim4price",
    "steps": [
      "Choose the assets and information to include.",
      "Review the message, photos and available document options.",
      "Follow the email or WhatsApp handoff and check the content before sending."
    ],
    "example": "Send a prospective buyer selected photos and details together so they can identify the machine and ask informed questions.",
    "note": "Large photo batches depend on the destination’s limits. Follow any extra sharing instructions shown.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "send email whatsapp photos PDF Share through WhatsApp or email",
    "question": "How do I send asset information by WhatsApp or email?",
    "guideTitle": "Share by WhatsApp or email",
    "videoOutcome": "Prepare clear asset information to send outside Aim4price."
  },
  {
    "category": "sharing",
    "id": "access-links",
    "title": "Share links",
    "description": "Choose view-only access or allow specific actions.",
    "where": "Share / Send link; History / link management",
    "steps": [
      "Choose View only or select the permissions required.",
      "Select any additional reports you want the recipient to see.",
      "Create and share the link; use History to review or revoke access later."
    ],
    "example": "Give an adviser view-only access to selected information, then revoke the link when the discussion is finished.",
    "note": "Recipients sign in. Maintenance and ownership-cost reports must be included explicitly.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "permissions revoke read only Create and manage an access link",
    "question": "Can I choose exactly what someone can see or do?",
    "guideTitle": "Create and manage a share link",
    "videoOutcome": "Choose what a recipient can view or contribute."
  },
  {
    "category": "sharing",
    "id": "received",
    "title": "Received assets",
    "description": "Open an asset another owner has shared with you and use the access they have allowed.",
    "where": "Received link or shared enquiry",
    "steps": [
      "Open the shared asset and sign in or follow the free-account instructions.",
      "Review the available actions and asset identity.",
      "Add the permitted information, then check the saved result."
    ],
    "example": "Open a shared machine and check its identity before adding a permitted update so your contribution reaches the right record.",
    "note": "The shared link gives access only to the records and actions its owner selected.",
    "audience": "Owner",
    "href": "/shared-enquiries",
    "action": "Open shared enquiries",
    "keywords": " Work with an asset shared with you",
    "question": "How do I work with an asset someone shared with me?",
    "guideTitle": "Open an asset shared with you",
    "videoOutcome": "Use the access the sharing owner has allowed."
  },
  {
    "category": "reports",
    "id": "valuation-report",
    "title": "Valuation reports",
    "description": "Present the saved asset details and valuation information together.",
    "where": "Asset / Manage / Reports / valuation",
    "steps": [
      "Check the asset details and pricing first.",
      "Choose the available valuation report and options.",
      "Review the downloaded document before using or sharing it."
    ],
    "example": "Prepare a dated asset summary for an adviser so the discussion starts with the same recorded details and figures.",
    "note": "Confirm the figures and report date are appropriate for the purpose.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Download a valuation report",
    "question": "How do I present my asset’s valuation information?",
    "guideTitle": "Prepare a valuation report",
    "videoOutcome": "Present saved asset details and values together."
  },
  {
    "category": "reports",
    "id": "maintenance-report",
    "title": "Maintenance reports",
    "description": "Bring completed work and maintenance information into one view.",
    "where": "Asset / Manage / Reports / maintenance",
    "steps": [
      "Check that relevant work is recorded.",
      "Choose the maintenance report and available period or options.",
      "Review the report for missing work and supporting information."
    ],
    "example": "Share recorded service history with a prospective buyer so they can review the work documented on the machine.",
    "note": "Shared recipients need permission to view maintenance reports.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review a maintenance report",
    "question": "Can I show the work recorded on this machine?",
    "guideTitle": "Prepare a maintenance report",
    "videoOutcome": "Show the work recorded on a machine."
  },
  {
    "category": "reports",
    "id": "fuel-report",
    "title": "Fuel reports",
    "description": "Review purchases, storage movements and available fuel summaries.",
    "where": "Fuel Ledger / Download",
    "steps": [
      "Choose the relevant fuel view and reporting scope.",
      "Select the available PDF or spreadsheet format.",
      "Check dates, assets and recorded entries in the downloaded file."
    ],
    "example": "Download the period’s fuel records to review purchases and supporting entries with the person responsible for fuel administration.",
    "note": "Fuel purchases alone may not represent consumption over the same period.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": " Download fuel records",
    "question": "How do I download my fuel records?",
    "guideTitle": "Download fuel records",
    "videoOutcome": "Take the relevant fuel entries into a report."
  },
  {
    "category": "reports",
    "id": "map-report",
    "title": "Asset map reports",
    "description": "Put recorded asset locations into a report you can share.",
    "where": "Asset Map / Download",
    "steps": [
      "Open Asset Map and select the relevant assets.",
      "Choose Download and review the available report options.",
      "Check the recorded locations before sharing."
    ],
    "example": "Prepare a location report for an inspection visit so the team knows where assets were last recorded.",
    "note": "Recorded locations are not live vehicle tracking.",
    "audience": "Owner",
    "href": "/asset-map",
    "action": "Open Asset Map",
    "keywords": " Download an asset map report",
    "question": "Can I share a report of asset locations?",
    "guideTitle": "Download an asset location report",
    "videoOutcome": "Share recorded locations in a usable document."
  },
  {
    "category": "reports",
    "id": "depreciation-report",
    "title": "Depreciation reports",
    "description": "See how the recorded assumptions affect an asset’s value over time.",
    "where": "Asset / Manage / Reports / depreciation",
    "steps": [
      "Check the asset values and depreciation information.",
      "Open the available depreciation report.",
      "Review the assumptions and dates before using the result."
    ],
    "example": "Review the report with your adviser when discussing replacement timing, checking the dates and assumptions before relying on the figures.",
    "note": "Review assumptions with the relevant adviser before relying on accounting figures.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review a depreciation report",
    "question": "How does the report show value changing over time?",
    "guideTitle": "Review a depreciation report",
    "videoOutcome": "Understand the figures and assumptions behind the report."
  },
  {
    "category": "reports",
    "id": "ownership-report",
    "title": "Ownership cost reports",
    "description": "Review recorded ownership costs to help decide whether to keep, repair or replace an asset.",
    "where": "Asset / Manage / Reports / ownership costs",
    "steps": [
      "Check that relevant asset costs have been recorded.",
      "Choose the ownership-cost report and available options.",
      "Review the period, included costs and gaps."
    ],
    "example": "Review a machine’s recorded ownership costs before approving another major repair, noting any missing expenses.",
    "note": "Missing costs affect the usefulness of the report.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review a cost-of-ownership report  Understand depreciation and ownership costs",
    "question": "What does owning this asset really cost?",
    "guideTitle": "Review ownership costs",
    "videoOutcome": "Bring recorded costs into a keep, repair or replace discussion."
  },
  {
    "category": "market",
    "id": "marketplace",
    "title": "Marketplace",
    "description": "Browse assets offered for sale and inspect the information available.",
    "where": "Marketplace",
    "steps": [
      "Open Marketplace and use the available filters.",
      "Open a listing to review its details and photos.",
      "Use the available enquiry options when you want to know more."
    ],
    "example": "Review replacement machines and their photos before contacting sellers to confirm condition, availability and terms.",
    "note": "Confirm condition, availability and terms with the seller.",
    "audience": "Owner",
    "href": "/marketplace",
    "action": "Open Marketplace",
    "keywords": " Explore the Marketplace",
    "question": "What assets are available on the Marketplace?",
    "guideTitle": "Browse and enquire about a listing",
    "videoOutcome": "Compare advertised assets and ask for more information."
  },
  {
    "category": "market",
    "id": "discovery",
    "title": "Asset Discovery",
    "description": "Explore machinery shared by other participating owners. Enabling participation also makes your eligible machinery discoverable.",
    "where": "Asset Discovery",
    "steps": [
      "Open Asset Discovery and review the participation requirements.",
      "Check Asset Exclusions before enabling participation.",
      "Browse other participating owners’ assets and use the enquiry options for a machine that interests you."
    ],
    "example": "Enquire about machinery in the owner network that may suit your needs, while checking which of your own assets are included in participation.",
    "note": "Discovery participation is different from advertising an asset for sale on Marketplace. Review which assets are included.",
    "audience": "Owner",
    "href": "/asset-discovery",
    "action": "Open Asset Discovery",
    "keywords": " Discover assets and buying options",
    "question": "Can I discover machinery through other owners?",
    "guideTitle": "Explore the owner network",
    "videoOutcome": "Understand participation before discovering other assets."
  },
  {
    "category": "market",
    "id": "sell",
    "title": "Sell with Aim4price",
    "description": "Understand the asset-sale service and its fees before discussing a sale.",
    "where": "Footer / Asset Sale Fees",
    "steps": [
      "Open the asset-sale fees page.",
      "Review how the service works and the published fee structure.",
      "Contact Aim4price to discuss your asset and agree the next steps."
    ],
    "example": "Discuss a machine you want to replace with Aim4price so you can agree the sale approach, scope and fees before proceeding.",
    "note": "Confirm the agreed scope and fees before proceeding.",
    "audience": "Owner",
    "href": "/selling-fees",
    "action": "View asset sale fees",
    "keywords": " Sell with Aim4price",
    "question": "How can Aim4price help me sell an asset?",
    "guideTitle": "Explore the asset-sale service",
    "videoOutcome": "Understand the process and fees before proceeding."
  },
  {
    "category": "connections",
    "id": "owner-app",
    "title": "Owner app",
    "description": "Reach your asset records while you are away from your desk.",
    "where": "Account / Owner app",
    "steps": [
      "Open the Owner app setup from Account.",
      "Follow the sign-in and device instructions provided.",
      "Open an asset and use the available Manage actions to record work."
    ],
    "example": "Check a vehicle’s details while standing beside it and record information while it is still fresh.",
    "note": "App access and available actions follow your account setup.",
    "audience": "Owner",
    "href": "/account/owner-app",
    "action": "Open Owner app setup",
    "keywords": " Use the Owner app",
    "question": "Can I manage my assets away from my desk?",
    "guideTitle": "Set up the Owner app",
    "videoOutcome": "Reach asset records while away from your desk."
  },
  {
    "category": "connections",
    "id": "field-manager",
    "title": "Field Manager",
    "description": "Let a team member record the work they are authorised to handle.",
    "where": "Account / Field Manager",
    "steps": [
      "Open Field Manager from Account.",
      "Set up the team member, assigned assets and permissions.",
      "Follow the app setup instructions and check their access."
    ],
    "example": "Allow a farm manager to record fuel and maintenance on assigned machinery, reducing the need to pass notes back to the office.",
    "note": "Review access when responsibilities change or a team member leaves.",
    "audience": "Owner",
    "href": "/account/field-manager",
    "action": "Open Field Manager setup",
    "keywords": " Set up a Field Manager team access permissions staff",
    "question": "Can my manager record work in the field?",
    "guideTitle": "Set up Field Manager access",
    "videoOutcome": "Let your team record work on assigned assets."
  },
  {
    "category": "connections",
    "id": "ai",
    "title": "AI Connections",
    "description": "Connect a supported assistant to explore saved account information.",
    "where": "Account / AI Connections",
    "steps": [
      "Choose Connect and follow the assistant’s setup instructions.",
      "Review the access and terms before approving.",
      "Ask a specific question and check the answer against your records."
    ],
    "example": "Ask which assets have maintenance due next, then verify the answer against the saved schedules before planning the work.",
    "note": "AI access is read-only. Answers depend on the records available to the connection.",
    "audience": "Owner",
    "href": "/account/ai-connect",
    "action": "Open AI Connections",
    "keywords": "assistant chatgpt maintenance questions Ask AI questions about your records",
    "question": "Can I ask AI questions about my asset records?",
    "guideTitle": "Connect an AI assistant",
    "videoOutcome": "Ask questions about the records you have saved."
  },
  {
    "category": "connections",
    "id": "qr",
    "title": "Asset QR codes",
    "description": "Make the correct asset easier to open where work happens.",
    "where": "Asset / QR code",
    "steps": [
      "Open the QR code options for the relevant asset.",
      "Review the available QR access and PIN settings.",
      "Use the code to open the asset and follow the access requirements."
    ],
    "example": "Place a QR reference on a machine so authorised staff can identify its record before capturing information.",
    "note": "A QR code does not override the account’s access controls.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "qr pin scan Use asset QR access",
    "question": "Can I scan a code to open the right asset?",
    "guideTitle": "Set up asset QR access",
    "videoOutcome": "Open the right record where the asset is used."
  }
];
