# Tutorial video manager

`/admin/videos` uses the existing admin page and API guards. It manages Owners, Dealers, Businesses and Sharing help. Each audience has an introduction and stable feature IDs. Tutorial pages remain limited to the existing private-preview allowlist, including published video delivery. Publishing does not make a page public.

Upload MP4 (prefer H.264/AAC) or WebM, maximum 100 MiB. The client shows progress, then previews the draft through the authenticated media endpoint. Publish requires explicit confirmation and the current draft ID and revision. Replacements leave the published recording intact until publishing. Unpublish retains the recording as a draft. Concurrent stale changes return 409. Old recordings are retained, not irreversibly deleted.

Recordings are stored durably in PostgreSQL (`tutorial_video_files`), separate from small slot metadata (`tutorial_video_slots`). Tables are created idempotently using the application's existing lazy-schema pattern. Upload bodies are read with an enforced byte limit before storing. Lists never select video bytes; playback streams bounded 1 MiB SQL chunks and supports HTTP byte ranges. No public bucket, new credential or separate login is introduced. This is a bounded initial library; migrate video bytes to private object storage if the recording library grows substantially. Retained revisions consume storage.

Routes:
- `/tutorials`: Owners
- `/tutorials/dealers`: Dealers
- `/tutorials/businesses`: Businesses
- `/tutorials/sharing`: Sharing help (not yet inserted into sharing modals)

Checks:
- `npm run typecheck`
- `node --test tests/tutorial-videos.test.mjs`
- `CANVAS_BROWSER_PATH=/path/to/chromium node scripts/verify-tutorial-videos.cjs`

The browser test uses a generated one-second WebM and a synthetic API, never production account data. Server tests cover ranges, format checks, stale revisions, keeping published videos during replacement, unpublishing, admin/CSRF rejection and anonymous media rejection. Real recordings should be previewed before publishing to confirm their codec plays in the administrator's browser.
