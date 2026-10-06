# Account directory listings

Free Business and Dealer accounts can request a basic directory listing from their shared enquiries account page. An active account and verified email are required. Listing is optional and does not change asset permissions or Desktop access.

The form collects business name, phone, town, areas served, services, optional website and optional PNG/JPEG/WebP logo (2 MB maximum, validated image structure, dimensions at most 4096 by 4096). The enquiry email is taken from the signed-in account, never from the request payload. Coordinates are not required for town-based directory entries.

Requests use the existing business_network directory and Admin > Business Directory approval workflow. New requests and edits are pending until an admin chooses Approve and publish. Hide listing removes it from the directory immediately. Account-owned entries cannot be edited using legacy management tokens. Existing listings with the same email are not silently claimed: users are asked to contact Aim4price to connect them.

Apply migration 134-account-directory-listings.sql after the existing business network migrations. Runtime setup also creates the table. Logos are kept separately from directory JSON and served by the directory-logo route. Pending and hidden logos are available only to the account owner and admin; published logos are public. The general directory response contains the logo URL, not the image data.

Manual checks:
1. Sign in to a verified free Business account, open Directory listing, and request a listing with a logo.
2. Confirm Pending review and absence from the owner directory.
3. In Admin > Business Directory, inspect the logo, services and contact details, then Approve and publish.
4. Search the owner's directory for the business and inspect its logo and details.
5. Edit the listing: confirm it returns to Pending review and is hidden until approved again.
6. Hide the listing and verify it disappears. Repeat with a free Dealer account under Shared enquiries.
7. Upload an invalid image or use an unverified account: confirm the request is rejected.
