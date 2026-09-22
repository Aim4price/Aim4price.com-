# Directory profiles and outside asset links

The directory keeps accepted external listings distinct from Aim4price accounts. Internal accounts receive the existing lead flow. External businesses continue through the same Email/WhatsApp sharing component as a normal outside share.

Google profile fields are fetched on selection using the configured `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and the listing's Google place ID. Maps JavaScript and Places access must be enabled for that key; restrict it to approved site origins. Photos, ratings, review counts and opening hours appear only when returned. These fields and their attributions stay in browser memory, rather than being copied into business records. Confirmed listing details remain the fallback. No Google key or billing settings are changed by this PR.

## Asset page links

Create an asset link in the outside-share panel, then include it in the email/WhatsApp message or copy it. It opens `/asset-share/<random-token>` without signing in. Reopen outside sharing for the same selection and photo choice to find or disable that link.

- Links have no automatic expiry. Creation reuses an active link for the same account, asset selection and photo choice.
- Details are a saved snapshot. Disable the old link and create another to share updated details.
- The public page contains only cards, optional photos, snapshot date and valuation note. It omits application navigation and actions.
- Only authenticated, active owner/dealer accounts with register access can create/manage links. Every selected asset must belong to the authenticated account. Delegated accountant access cannot publish another owner's assets.
- Public reads require an unguessable 256-bit token, an active link and continued ownership of every included asset. Revocation, deletion or transfer makes the page unavailable.
- Public fields are explicitly allowlisted. Private documents, notes, finance data, owner identifiers, QR codes and location history are excluded. Reports remain separate attachments.
- Optional photos reference existing saved media; this is not an independent photo archive. Removing a saved file can remove that photo from an older snapshot.
- Pages are dynamic, no-store, no-referrer and excluded from indexing. Anyone who receives/forwards the link can view it; previously downloaded content cannot be recalled.

Migration `111-asset-share-links.sql` adds the durable links table and unique active-selection index. The server also initializes this idempotent schema on first use, consistent with existing database helpers. No existing asset or lead tables are changed.

Validation: `npm run typecheck`; `node --test tests/asset-share-links.test.cjs`; existing external-share/file-share/business-network tests; `CANVAS_BROWSER_PATH=/path/to/chromium node scripts/verify-asset-share-links.cjs`; `scripts/verify-directory-sharing.cjs`. Browser fixtures are local only and are removed by the runners. Google browser validation uses a mocked API response; the deployed key still needs a live smoke test after configuration.
