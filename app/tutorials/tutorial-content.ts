export type FeatureCategory = { id: string; title: string; description: string; icon: string };
export type Tutorial = { category: string; id: string; title: string; question: string; description: string; where: string; steps: string[]; example: string; note: string; audience: string; href: string; action: string; keywords: string; videoSrc?: string; captionsSrc?: string };
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
    "example": "Start with your tractor, then add its next service and fuel purchase.",
    "note": "You can start before every document is ready.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Add your first asset",
    "question": "How do I start recording what I own?"
  },
  {
    "category": "start",
    "id": "capture",
    "title": "Upload assistance",
    "description": "Record information yourself or submit documents for Aim4price capture.",
    "where": "Asset Register / Add Asset; asset / Add cost",
    "steps": [
      "Choose manual entry when you have the details ready.",
      "Choose the available Aim4price upload option when you need capture assistance.",
      "Submit clear documents and check the capture status before treating the record as complete."
    ],
    "example": "Upload an invoice for capture, then review the resulting asset cost.",
    "note": "Capture assistance and managed administration have separate allowances and pricing.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Choose how to add your information",
    "question": "Can I upload information myself or get help?"
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
    "example": "Open your bakkie and go straight to its maintenance history.",
    "note": "",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Find your way around an asset",
    "question": "Where do I find everything for one asset?"
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
    "example": "Keep one farm’s equipment together and another business’s vehicles in a separate register.",
    "note": "Owner active-asset limits apply across the account, not separately to each register.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Organise assets into registers",
    "question": "How do I keep different groups of assets organised?"
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
    "example": "Group a tractor and its implements into one working unit.",
    "note": "Each asset retains its own details and history.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Group assets into an umbrella",
    "question": "Can I group related assets together?"
  },
  {
    "category": "assets",
    "id": "details",
    "title": "Asset details",
    "description": "Keep the year, usage, condition and serial / VIN accurate.",
    "where": "Asset card / Manage / Update details",
    "steps": [
      "Open the correct asset and choose its update-details action.",
      "Check the identifying details and current usage.",
      "Save your changes and review the asset card."
    ],
    "example": "Update the tractor’s hour reading after a week of work.",
    "note": "Available editing actions depend on your access.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Update asset details",
    "question": "How do I keep my asset details accurate?"
  },
  {
    "category": "assets",
    "id": "documents",
    "title": "Documents",
    "description": "Find supporting paperwork without hunting through separate files.",
    "where": "Documents",
    "steps": [
      "Open Documents and find the relevant file or folder.",
      "Use the available upload and organisation tools to keep records clear.",
      "Check the document before using or sharing it."
    ],
    "example": "Find a purchase invoice before discussing an asset with an adviser.",
    "note": "",
    "audience": "Owner",
    "href": "/documents",
    "action": "Open Documents",
    "keywords": "documents paperwork invoices files folders",
    "question": "Where can I keep my asset paperwork?"
  },
  {
    "category": "assets",
    "id": "photos",
    "title": "Asset photos",
    "description": "Build a clear visual record of the machine, its identity and condition.",
    "where": "Asset / photos",
    "steps": [
      "Open the correct asset’s photos.",
      "Add clear images or use the available edit, download and delete actions.",
      "Review the saved photos and keep the useful ones easy to recognise."
    ],
    "example": "Keep an overview photo, serial-plate photo and photos of important condition details.",
    "note": "",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Manage asset photos",
    "question": "How do I build a useful visual record?"
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
    "example": "Look back at work recorded before a machine developed a problem.",
    "note": "",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review asset history",
    "question": "What has happened to this asset?"
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
    "example": "Plan a visit to machinery spread across different sites.",
    "note": "Locations depend on the information recorded; this is not live tracking.",
    "audience": "Owner",
    "href": "/asset-map",
    "action": "Open Asset Map",
    "keywords": "gps location Find assets on the map",
    "question": "Where are my assets located?"
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
    "example": "Identify which assets still have finance attached.",
    "note": "A saved status does not itself provide insurance or finance cover.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Record ownership, insurance and finance status",
    "question": "Which assets are insured, financed or licensed?"
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
    "example": "Keep a vehicle’s next licence renewal visible.",
    "note": "Licensing features apply to relevant assets. Saving information does not renew a licence.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "license renewal registration Track licence renewals",
    "question": "Which licence renewals need attention?"
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
    "example": "Estimate a tractor before deciding whether to keep or sell it.",
    "note": "An estimate is a decision aid, not a guaranteed selling price.",
    "audience": "Owner",
    "href": "/valuation",
    "action": "Get an estimate",
    "keywords": " Get an estimated value",
    "question": "What could my asset be worth?"
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
    "example": "Update a replacement value after obtaining a current supplier quote.",
    "note": "Recipients see only the pricing actions the owner permits.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Manage asset and replacement values",
    "question": "How do I keep asset and replacement values current?"
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
    "example": "Record a sold vehicle and track the transfer to its next owner.",
    "note": "A pending transfer should be checked before assuming it is complete.",
    "audience": "Owner",
    "href": "/account/asset-transfers",
    "action": "Open asset transfers",
    "keywords": " Record a sale or asset transfer",
    "question": "How do I record a sale or transfer?"
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
    "example": "Record a replacement tyre against the vehicle it was fitted to.",
    "note": "",
    "audience": "Owner",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": " Add a cost manually",
    "question": "How do I record an expense against an asset?"
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
    "example": "Submit a workshop invoice instead of retyping every detail.",
    "note": "Submitting an invoice and completing its capture are separate steps.",
    "audience": "Owner",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": " Submit an invoice for capture",
    "question": "Can Aim4price capture an invoice for me?"
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
    "example": "Ask a supplier to send the repair invoice directly into the capture process.",
    "note": "Sending a document does not give the sender access to asset records.",
    "audience": "Owner",
    "href": "/drop-invoice",
    "action": "Drop an invoice",
    "keywords": "supplier mechanic paperwork Let a supplier drop an invoice",
    "question": "Can my supplier send an invoice directly?"
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
    "example": "Compare planned servicing spend with workshop costs recorded this season.",
    "note": "Check that expenses are linked to the correct assets and period.",
    "audience": "Owner",
    "href": "/budgets",
    "action": "Open budgets",
    "keywords": " Review spending against a budget",
    "question": "Am I spending more than I planned?"
  },
  {
    "category": "costs",
    "id": "ledger",
    "title": "Cost Ledger",
    "description": "See saved expenses together and inspect their supporting entries.",
    "where": "Cost Ledger",
    "steps": [
      "Open Cost Ledger and select the relevant scope.",
      "Use the available search and filters to find entries.",
      "Open an entry and review the asset, amount, date and supporting information."
    ],
    "example": "Find all repair costs recorded for a particular vehicle.",
    "note": "",
    "audience": "Owner",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": "invoice expenses spending Find and review recorded costs",
    "question": "Where can I find my recorded costs?"
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
    "example": "Record a diesel fill-up against the truck that received it.",
    "note": "",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "diesel petrol fill up Record a fuel purchase",
    "question": "How do I record a fuel purchase?"
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
    "example": "Record diesel issued from your farm tank to a tractor.",
    "note": "Choose the correct source so a storage issue is not recorded as another purchase.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "diesel tank Record fuel from storage",
    "question": "How much fuel went from my tank into this asset?"
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
    "example": "Check recorded deliveries and issues for the farm’s diesel tank.",
    "note": "A calculated balance depends on complete, accurate entries.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": " Manage fuel storage",
    "question": "How do I keep track of my fuel storage?"
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
    "example": "Record ploughing for a tractor or delivery work for a vehicle.",
    "note": "Use consistent readings and units when comparing fuel use.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "saved activities work delivery ploughing Record activities and review fuel use",
    "question": "What work is my asset doing with its fuel?"
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
    "example": "Record an oil and filter change at the current hour reading.",
    "note": "",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "service mechanic repair Record completed maintenance",
    "question": "How do I keep a record of servicing and repairs?"
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
    "example": "Schedule the tractor’s next service after its current service is recorded.",
    "note": "Scheduling work does not mark it as completed.",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "due reminders upcoming service Schedule the next service",
    "question": "What needs servicing next?"
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
    "example": "Work through a tractor’s service checks before it returns to work.",
    "note": "Choose the checklist that fits the asset.",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": " Use maintenance checklists",
    "question": "How do I make routine checks easier to follow?"
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
    "example": "Log a hydraulic leak so the next person sees it before using the machine.",
    "note": "",
    "audience": "Owner",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "fault issue breakdown Log and resolve problems",
    "question": "What problems still need to be fixed?"
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
    "example": "Save oil and fuel filter numbers for the next tractor service.",
    "note": "Confirm part compatibility with the supplier before ordering.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Save and find part numbers",
    "question": "Where did I save that part number?"
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
    "example": "Share a tractor with a workshop to discuss upcoming repairs.",
    "note": "Only include the actions and reports the recipient needs.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Share inside Aim4price business directory invite business not listed",
    "question": "How do I work with a business through Aim4price?"
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
    "example": "Send a clearly labelled group of machines to a prospective buyer.",
    "note": "Large photo batches depend on the destination’s limits. Follow any extra sharing instructions shown.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "send email whatsapp photos PDF Share through WhatsApp or email",
    "question": "How do I send asset information by WhatsApp or email?"
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
    "example": "Let a mechanic add maintenance while keeping unrelated information private.",
    "note": "Recipients sign in. Maintenance and ownership-cost reports must be included explicitly.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "permissions revoke read only Create and manage an access link",
    "question": "Can I choose exactly what someone can see or do?"
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
    "example": "Review a machine shared by a neighbouring owner before discussing its condition.",
    "note": "The shared link gives access only to the records and actions its owner selected.",
    "audience": "Owner",
    "href": "/shared-enquiries",
    "action": "Open shared enquiries",
    "keywords": " Work with an asset shared with you",
    "question": "How do I work with an asset someone shared with me?"
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
    "example": "Prepare an asset summary for a discussion with an adviser.",
    "note": "Confirm the figures and report date are appropriate for the purpose.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Download a valuation report",
    "question": "How do I present my asset’s valuation information?"
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
    "example": "Show the service history when discussing a machine with a buyer.",
    "note": "Shared recipients need permission to view maintenance reports.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review a maintenance report",
    "question": "Can I show the work recorded on this machine?"
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
    "example": "Review fuel slips for the vehicles used on a delivery route.",
    "note": "Fuel purchases alone may not represent consumption over the same period.",
    "audience": "Owner",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": " Download fuel records",
    "question": "How do I download my fuel records?"
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
    "example": "Prepare a location report before organising site visits.",
    "note": "Recorded locations are not live vehicle tracking.",
    "audience": "Owner",
    "href": "/asset-map",
    "action": "Open Asset Map",
    "keywords": " Download an asset map report",
    "question": "Can I share a report of asset locations?"
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
    "example": "Use the report as part of a discussion about replacement timing.",
    "note": "Review assumptions with the relevant adviser before relying on accounting figures.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review a depreciation report",
    "question": "How does the report show value changing over time?"
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
    "example": "Compare a machine’s recorded running costs with the work it performs.",
    "note": "Missing costs affect the usefulness of the report.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": " Review a cost-of-ownership report  Understand depreciation and ownership costs",
    "question": "What does owning this asset really cost?"
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
    "example": "Compare available machines while planning a replacement.",
    "note": "Confirm condition, availability and terms with the seller.",
    "audience": "Owner",
    "href": "/marketplace",
    "action": "Open Marketplace",
    "keywords": " Explore the Marketplace",
    "question": "What assets are available on the Marketplace?"
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
    "example": "Explore machinery in the owner network and enquire whether an owner would consider a sale.",
    "note": "Discovery participation is different from advertising an asset for sale on Marketplace. Review which assets are included.",
    "audience": "Owner",
    "href": "/asset-discovery",
    "action": "Open Asset Discovery",
    "keywords": " Discover assets and buying options",
    "question": "Can I discover machinery through other owners?"
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
    "example": "Discuss a fair asking price and the sale process for a machine you want to replace.",
    "note": "Confirm the agreed scope and fees before proceeding.",
    "audience": "Owner",
    "href": "/selling-fees",
    "action": "View asset sale fees",
    "keywords": " Sell with Aim4price",
    "question": "How can Aim4price help me sell an asset?"
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
    "example": "Check a vehicle’s details and record information while standing beside it.",
    "note": "App access and available actions follow your account setup.",
    "audience": "Owner",
    "href": "/account/owner-app",
    "action": "Open Owner app setup",
    "keywords": " Use the Owner app",
    "question": "Can I manage my assets away from my desk?"
  },
  {
    "category": "connections",
    "id": "field-manager",
    "title": "Field Manager",
    "description": "Let a team member record the work they are authorised to handle.",
    "where": "Account / Field Manager",
    "steps": [
      "Open Field Manager from Account.",
      "Set up the team member and review their assigned assets and permissions.",
      "Follow the app setup instructions, then check that they can access the intended assets."
    ],
    "example": "Let a farm manager record fuel and maintenance on assigned machinery.",
    "note": "Review access when responsibilities change or a team member leaves.",
    "audience": "Owner",
    "href": "/account/field-manager",
    "action": "Open Field Manager setup",
    "keywords": " Set up a Field Manager team access permissions staff",
    "question": "Can my manager record work in the field?"
  },
  {
    "category": "connections",
    "id": "ai",
    "title": "AI Connections",
    "description": "Connect a supported assistant to explore saved account information.",
    "where": "Account / AI Connections",
    "steps": [
      "Choose Connect and follow the setup for an available assistant.",
      "Review the requested access and terms before approving.",
      "Ask a specific question, verify the answer, and manage or disconnect access when needed."
    ],
    "example": "Ask: “Which assets have maintenance due next?”",
    "note": "AI access is read-only. Answers depend on the records available to the connection.",
    "audience": "Owner",
    "href": "/account/ai-connect",
    "action": "Open AI Connections",
    "keywords": "assistant chatgpt maintenance questions Ask AI questions about your records",
    "question": "Can I ask AI questions about my asset records?"
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
    "example": "Place an asset’s QR reference where authorised staff can identify the machine.",
    "note": "A QR code does not override the account’s access controls.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "qr pin scan Use asset QR access",
    "question": "Can I scan a code to open the right asset?"
  }
];
