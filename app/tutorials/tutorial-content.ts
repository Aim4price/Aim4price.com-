export type FeatureCategory = { id: string; title: string; description: string; icon: string };
export type Tutorial = { category: string; id: string; title: string; description: string; where: string; steps: string[]; example: string; note: string; audience: string; href: string; action: string; keywords: string; videoSrc?: string; captionsSrc?: string };
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
    "id": "business",
    "title": "Dealer & business tools",
    "description": "Manage stock, client assets and enquiries.",
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
    "id": "accounts",
    "title": "Choose the right account",
    "description": "Find the workspace that fits the way you work.",
    "where": "Pricing → Owner, Dealer or Business",
    "steps": [
      "Read the description of each account.",
      "Explore the package or access options that match your work.",
      "Check included access and any separate services before registering."
    ],
    "example": "An owner records their own fleet; a mechanic works with assets clients share.",
    "note": "Business shared access follows the owner’s permissions. Dealer client registers are billed separately.",
    "audience": "Everyone",
    "href": "/pricing",
    "action": "Explore account options",
    "keywords": ""
  },
  {
    "category": "start",
    "id": "first-asset",
    "title": "Add your first asset",
    "description": "Start with one vehicle or machine and build its record over time.",
    "where": "Asset Register → Add Asset",
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
    "keywords": ""
  },
  {
    "category": "start",
    "id": "capture",
    "title": "Choose how to add your information",
    "description": "Record information yourself or submit documents for Aim4price capture.",
    "where": "Asset Register → Add Asset; asset → Add cost",
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
    "keywords": ""
  },
  {
    "category": "start",
    "id": "manage",
    "title": "Find your way around an asset",
    "description": "Use the asset card as the starting point for everyday work.",
    "where": "Asset card → Manage",
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
    "keywords": ""
  },
  {
    "category": "assets",
    "id": "registers",
    "title": "Organise assets into registers",
    "description": "Keep groups of assets together without losing their individual records.",
    "where": "Asset Register → register selector",
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
    "keywords": ""
  },
  {
    "category": "assets",
    "id": "umbrellas",
    "title": "Group assets into an umbrella",
    "description": "Bring related assets together for viewing and sharing.",
    "where": "Asset Register → umbrella options",
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
    "keywords": ""
  },
  {
    "category": "assets",
    "id": "details-photos",
    "title": "Keep details and photos current",
    "description": "Make each asset easy to identify and recognise.",
    "where": "Asset card → Manage → Update details; photos",
    "steps": [
      "Check the year, usage, condition and serial / VIN.",
      "Update the relevant fields and save.",
      "Open the photos to add or manage images, then review the result."
    ],
    "example": "Record the latest hour reading and add a photo of the serial plate.",
    "note": "Available editing actions depend on your access.",
    "audience": "Owners & permitted recipients",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": ""
  },
  {
    "category": "assets",
    "id": "documents-map",
    "title": "Find documents, history and locations",
    "description": "Keep the supporting information close to the asset.",
    "where": "Documents; asset → History; Asset Map",
    "steps": [
      "Use Documents to find supporting paperwork.",
      "Open the asset’s History to review recorded changes and work.",
      "Use Asset Map to view assets with recorded locations."
    ],
    "example": "Find the paperwork and last recorded location before arranging a visit.",
    "note": "Recorded locations are not a promise of live GPS tracking.",
    "audience": "Owner",
    "href": "/asset-map",
    "action": "Open Asset Map",
    "keywords": "GPS location papers history documents"
  },
  {
    "category": "values",
    "id": "estimate",
    "title": "Get an estimated value",
    "description": "Build a useful starting point for understanding an asset’s value.",
    "where": "Get Estimate",
    "steps": [
      "Choose the asset type and enter the requested specifications.",
      "Check the year, usage and condition carefully.",
      "Review the estimate and its supporting details before using it."
    ],
    "example": "Estimate a tractor before deciding whether to keep or sell it.",
    "note": "An estimate is a decision aid, not a guaranteed selling price.",
    "audience": "Everyone",
    "href": "/valuation",
    "action": "Get an estimate",
    "keywords": ""
  },
  {
    "category": "values",
    "id": "pricing",
    "title": "Manage asset and replacement values",
    "description": "Keep your pricing information aligned with what you know.",
    "where": "Asset → Manage → pricing options",
    "steps": [
      "Open the asset’s pricing options.",
      "Review the available values and update the relevant information.",
      "Save and check the figures before using them in a report."
    ],
    "example": "Update a replacement value after obtaining a current supplier quote.",
    "note": "Recipients see only the pricing actions the owner permits.",
    "audience": "Owners & permitted recipients",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": ""
  },
  {
    "category": "values",
    "id": "ownership",
    "title": "Understand depreciation and ownership costs",
    "description": "Look beyond the purchase price when reviewing an asset.",
    "where": "Asset → Manage → Reports",
    "steps": [
      "Review the saved asset values and costs first.",
      "Choose the depreciation or ownership-cost report available for the asset.",
      "Check its assumptions, dates and missing records before comparing results."
    ],
    "example": "Compare running costs with the asset’s value when considering replacement.",
    "note": "Incomplete records can make a cost comparison misleading.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": ""
  },
  {
    "category": "values",
    "id": "sale-transfer",
    "title": "Record a sale or asset transfer",
    "description": "Keep ownership changes and disposal records organised.",
    "where": "Asset sale / transfer options; Account → asset transfers",
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
    "keywords": ""
  },
  {
    "category": "costs",
    "id": "manual-cost",
    "title": "Add a cost manually",
    "description": "Link an expense to the asset it belongs to.",
    "where": "Asset → Add cost; Cost Ledger",
    "steps": [
      "Choose manual cost entry.",
      "Select the asset and enter the date, amount and expense details.",
      "Review and save, then check the entry in Cost Ledger."
    ],
    "example": "Record a replacement tyre against the vehicle it was fitted to.",
    "note": "",
    "audience": "Owners & permitted recipients",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": ""
  },
  {
    "category": "costs",
    "id": "invoice-capture",
    "title": "Submit an invoice for capture",
    "description": "Use the invoice itself to start recording an expense.",
    "where": "Asset → Add cost → Aim4price upload",
    "steps": [
      "Select the correct asset and upload a readable invoice.",
      "Review the submitted document and requested details.",
      "Check the capture status and resulting cost entry."
    ],
    "example": "Submit a workshop invoice instead of retyping every detail.",
    "note": "Submitting an invoice and completing its capture are separate steps.",
    "audience": "Owners & permitted recipients",
    "href": "/my-invoices",
    "action": "Open Cost Ledger",
    "keywords": ""
  },
  {
    "category": "costs",
    "id": "invoice-drop",
    "title": "Let a supplier drop an invoice",
    "description": "Get paperwork to the right asset without sharing your whole account.",
    "where": "Drop invoice",
    "steps": [
      "Identify the asset using the information requested.",
      "Attach the invoice and check the destination.",
      "Submit it for verification and capture."
    ],
    "example": "Ask a supplier to send the repair invoice directly into the capture process.",
    "note": "Sending a document does not give the sender access to asset records.",
    "audience": "Everyone",
    "href": "/drop-invoice",
    "action": "Drop an invoice",
    "keywords": "supplier mechanic paperwork"
  },
  {
    "category": "costs",
    "id": "budgets",
    "title": "Review spending against a budget",
    "description": "Give planned spending a place alongside actual recorded costs.",
    "where": "Cost Ledger → budgets",
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
    "keywords": ""
  },
  {
    "category": "fuel",
    "id": "fuel-slip",
    "title": "Record a fuel purchase",
    "description": "Save the litres and cost from a fuel slip.",
    "where": "Add fuel → Fuel slip",
    "steps": [
      "Choose Fuel slip when the fuel was bought from a station or supplier.",
      "Select the asset and enter the requested date, litres, cost and readings.",
      "Review the details and save the entry."
    ],
    "example": "Record a diesel fill-up against the truck that received it.",
    "note": "",
    "audience": "Owners & permitted recipients",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "diesel petrol fill up"
  },
  {
    "category": "fuel",
    "id": "fuel-storage",
    "title": "Record fuel from storage",
    "description": "Track fuel issued from a tank to an asset.",
    "where": "Add fuel → From fuel storage",
    "steps": [
      "Choose the storage route rather than a purchase slip.",
      "Select the tank and receiving asset.",
      "Enter the quantity and readings requested, then review and save."
    ],
    "example": "Record diesel issued from your farm tank to a tractor.",
    "note": "Choose the correct source so a storage issue is not recorded as another purchase.",
    "audience": "Owners & permitted recipients",
    "href": "/fuel",
    "action": "Open Fuel Ledger",
    "keywords": "diesel tank"
  },
  {
    "category": "fuel",
    "id": "tanks",
    "title": "Manage fuel storage",
    "description": "Keep tank records and fuel movements organised.",
    "where": "Fuel Ledger → storage",
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
    "keywords": ""
  },
  {
    "category": "fuel",
    "id": "activities",
    "title": "Record activities and review fuel use",
    "description": "Connect usage records to the work an asset performs.",
    "where": "Fuel Ledger → activities and fuel records",
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
    "keywords": "saved activities work delivery ploughing"
  },
  {
    "category": "maintenance",
    "id": "completed-work",
    "title": "Record completed maintenance",
    "description": "Keep a clear record of servicing, checks and repairs.",
    "where": "Asset → Manage → Maintenance → Add maintenance",
    "steps": [
      "Choose the correct asset and maintenance action.",
      "Enter what was done, when it was done and the requested readings.",
      "Add supporting information where available, then save and review."
    ],
    "example": "Record an oil and filter change at the current hour reading.",
    "note": "",
    "audience": "Owners & permitted recipients",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "service mechanic repair"
  },
  {
    "category": "maintenance",
    "id": "schedule",
    "title": "Schedule the next service",
    "description": "Plan upcoming work by date or usage.",
    "where": "Asset → Manage → Maintenance → scheduling",
    "steps": [
      "Choose the asset and work that needs to happen.",
      "Set the available date or usage-based scheduling options.",
      "Review upcoming maintenance and record completion when the job is done."
    ],
    "example": "Schedule the tractor’s next service after its current service is recorded.",
    "note": "Scheduling work does not mark it as completed.",
    "audience": "Owners & permitted recipients",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "due reminders upcoming service"
  },
  {
    "category": "maintenance",
    "id": "checklists-parts",
    "title": "Use checklists and save part numbers",
    "description": "Keep practical service information with the right machine.",
    "where": "Asset → Manage → Maintenance → Checklists / Parts",
    "steps": [
      "Open the checklist relevant to the asset.",
      "Review the tasks and record the available completion information.",
      "Save useful part numbers under Parts and check them before the next job."
    ],
    "example": "Keep filter references with the tractor’s service checklist.",
    "note": "Confirm compatibility before ordering a part.",
    "audience": "Owners & permitted recipients",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": ""
  },
  {
    "category": "maintenance",
    "id": "problems",
    "title": "Log and resolve problems",
    "description": "Keep faults visible until they have been dealt with.",
    "where": "Asset → maintenance or problem actions",
    "steps": [
      "Log the problem against the correct asset.",
      "Describe the symptom and add supporting information where available.",
      "Review the issue and confirm its resolution after the work is complete."
    ],
    "example": "Log a hydraulic leak so the next person sees it before using the machine.",
    "note": "",
    "audience": "Owners & permitted recipients",
    "href": "/maintenance",
    "action": "Open Maintenance",
    "keywords": "fault issue breakdown"
  },
  {
    "category": "sharing",
    "id": "inside",
    "title": "Share inside Aim4price",
    "description": "Send an asset to a business or dealer through the platform.",
    "where": "Asset or umbrella → Share → Inside Aim4price",
    "steps": [
      "Choose the asset or umbrella to share.",
      "Find the intended recipient and choose the access options offered.",
      "Review the recipient and settings before confirming the share."
    ],
    "example": "Share a tractor with a workshop to discuss upcoming repairs.",
    "note": "Only include the actions and reports the recipient needs.",
    "audience": "Owners & permitted senders",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": ""
  },
  {
    "category": "sharing",
    "id": "outside",
    "title": "Share through WhatsApp or email",
    "description": "Prepare asset information for a conversation outside Aim4price.",
    "where": "Asset or umbrella → Share → Outside Aim4price",
    "steps": [
      "Choose the assets and information to include.",
      "Review the message, photos and available document options.",
      "Follow the email or WhatsApp handoff and check the content before sending."
    ],
    "example": "Send a clearly labelled group of machines to a prospective buyer.",
    "note": "Large photo batches depend on the destination’s limits. Follow any extra sharing instructions shown.",
    "audience": "Owners & permitted senders",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "send email whatsapp photos PDF"
  },
  {
    "category": "sharing",
    "id": "access-links",
    "title": "Create and manage an access link",
    "description": "Choose view-only access or allow specific actions.",
    "where": "Share → Send link; History → link management",
    "steps": [
      "Choose View only or select the permissions required.",
      "Select any additional reports you want the recipient to see.",
      "Create and share the link; use History to review or revoke access later."
    ],
    "example": "Let a mechanic add maintenance while keeping unrelated information private.",
    "note": "Recipients sign in. Maintenance and ownership-cost reports must be included explicitly.",
    "audience": "Owners & permitted senders",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": "permissions revoke read only"
  },
  {
    "category": "sharing",
    "id": "received",
    "title": "Work with an asset shared with you",
    "description": "Contribute to a client’s record within the access they allow.",
    "where": "Received link or shared enquiry",
    "steps": [
      "Open the shared asset and sign in or follow the free-account instructions.",
      "Review the available actions and asset identity.",
      "Add the permitted information, then check the saved result."
    ],
    "example": "Add service details and photos to the tractor a client shared.",
    "note": "Ask the owner if the action you need is unavailable. Shared access does not open their entire account.",
    "audience": "Shared recipients",
    "href": "/shared-enquiries",
    "action": "Open shared enquiries",
    "keywords": ""
  },
  {
    "category": "reports",
    "id": "valuation-report",
    "title": "Download a valuation report",
    "description": "Present the saved asset details and valuation information together.",
    "where": "Asset → Manage → Reports → valuation",
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
    "keywords": ""
  },
  {
    "category": "reports",
    "id": "maintenance-report",
    "title": "Review a maintenance report",
    "description": "Bring completed work and maintenance information into one view.",
    "where": "Asset → Manage → Reports → maintenance",
    "steps": [
      "Check that relevant work is recorded.",
      "Choose the maintenance report and available period or options.",
      "Review the report for missing work and supporting information."
    ],
    "example": "Show the service history when discussing a machine with a buyer.",
    "note": "Shared recipients need permission to view maintenance reports.",
    "audience": "Owners & permitted recipients",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": ""
  },
  {
    "category": "reports",
    "id": "fuel-report",
    "title": "Download fuel records",
    "description": "Review purchases, storage movements and available fuel summaries.",
    "where": "Fuel Ledger → Download",
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
    "keywords": ""
  },
  {
    "category": "reports",
    "id": "ownership-map-reports",
    "title": "Choose a report for the decision",
    "description": "Use ownership, depreciation or map reports for different questions.",
    "where": "Asset → Reports; Asset Map → Download",
    "steps": [
      "Start with the question you need to answer.",
      "Choose the relevant available report and scope.",
      "Review the figures, assumptions and missing records before sharing."
    ],
    "example": "Use an ownership-cost report for replacement planning, or a map report to organise visits.",
    "note": "Available reports depend on the asset, saved information and your access.",
    "audience": "Owner",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": ""
  },
  {
    "category": "business",
    "id": "dealer-stock",
    "title": "Manage dealership stock",
    "description": "Keep the machines you are selling organised.",
    "where": "Dealer workspace → stock register",
    "steps": [
      "Open the dealership’s stock workspace.",
      "Add or select the stock asset and review its details and photos.",
      "Keep its pricing, history and availability current."
    ],
    "example": "Prepare a stock machine’s information before responding to an enquiry.",
    "note": "",
    "audience": "Dealer",
    "href": "/account",
    "action": "Open Account",
    "keywords": ""
  },
  {
    "category": "business",
    "id": "client-registers",
    "title": "Manage client registers",
    "description": "Maintain separate client asset records through your dealership.",
    "where": "Dealer workspace → client registers",
    "steps": [
      "Choose the client-register tools.",
      "Select or create the client register using the available setup flow.",
      "Check which client is selected before recording assets or work."
    ],
    "example": "Keep a customer’s fleet separate from dealership stock.",
    "note": "Client registers are billed separately to the dealer. These managed clients have no login.",
    "audience": "Dealer",
    "href": "/account",
    "action": "Open Account",
    "keywords": ""
  },
  {
    "category": "business",
    "id": "enquiries",
    "title": "Handle leads and shared enquiries",
    "description": "Keep the asset and the conversation’s next actions together.",
    "where": "Dealer / Business workspace → leads or shared enquiries",
    "steps": [
      "Open the relevant enquiry and check the asset and sender.",
      "Review the available information and permitted Manage actions.",
      "Record permitted work or respond through the available options."
    ],
    "example": "Review a client’s shared machine before discussing repairs or a trade-in.",
    "note": "Your actions depend on the access attached to that enquiry.",
    "audience": "Dealer & Business",
    "href": "/leads",
    "action": "Open enquiries",
    "keywords": ""
  },
  {
    "category": "business",
    "id": "directory",
    "title": "Find or invite a business",
    "description": "Choose who should receive an asset or enquiry.",
    "where": "Share inside Aim4price → business directory",
    "steps": [
      "Use the directory to find the intended business.",
      "Check the business details before selecting it.",
      "If it is missing, use Business not listed and review the invitation details."
    ],
    "example": "Find a specialist workshop before sharing the relevant asset.",
    "note": "Check the recipient before sending information or an invitation.",
    "audience": "Owners & permitted senders",
    "href": "/asset-register",
    "action": "Open Asset Register",
    "keywords": ""
  },
  {
    "category": "connections",
    "id": "owner-app",
    "title": "Use the Owner app",
    "description": "Reach your asset records while you are away from your desk.",
    "where": "Account → Owner app",
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
    "keywords": ""
  },
  {
    "category": "connections",
    "id": "field-manager",
    "title": "Set up a Field Manager",
    "description": "Let a team member record the work they are authorised to handle.",
    "where": "Account → Field Manager",
    "steps": [
      "Open the Field Manager settings.",
      "Review the user, assigned access and app setup instructions.",
      "Check the available assets and actions with the team member."
    ],
    "example": "Let a farm manager record fuel and maintenance on assigned machinery.",
    "note": "Give each person only the access their work requires.",
    "audience": "Owner",
    "href": "/account/field-manager",
    "action": "Open Field Manager setup",
    "keywords": ""
  },
  {
    "category": "connections",
    "id": "dealer-app",
    "title": "Use the Dealer app",
    "description": "Keep dealership work accessible to authorised staff.",
    "where": "Account → Dealer app",
    "steps": [
      "Open Dealer app setup.",
      "Review staff access and follow the provided sign-in instructions.",
      "Use the relevant asset’s available actions and check saved records."
    ],
    "example": "Let authorised staff update a stock asset’s work records.",
    "note": "Staff permissions determine which records and actions are available.",
    "audience": "Dealer",
    "href": "/account/dealer-app",
    "action": "Open Dealer app setup",
    "keywords": ""
  },
  {
    "category": "connections",
    "id": "ai",
    "title": "Ask AI questions about your records",
    "description": "Connect a supported assistant to explore saved account information.",
    "where": "Account → AI Connections",
    "steps": [
      "Choose Connect and follow the setup for an available assistant.",
      "Review the requested access and terms before approving.",
      "Ask a specific question, verify the answer, and manage or disconnect access when needed."
    ],
    "example": "Ask: “Which assets have maintenance due next?”",
    "note": "AI access is read-only. Answers depend on the records available to the connection.",
    "audience": "Eligible accounts",
    "href": "/account/ai-connect",
    "action": "Open AI Connections",
    "keywords": "assistant chatgpt maintenance questions"
  }
];
