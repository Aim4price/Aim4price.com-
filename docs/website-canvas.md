# Canonical website canvas

The normal website has one 1440 logical CSS-pixel composition. `lib/website-canvas.ts` owns the width, scale formula, manual limits, storage contract and native route boundary. `SiteWorkspaceZoom` owns the single CSS `zoom` value. Its name remains for import continuity; the former content-only zoom system has been replaced.

Auto uses `min(1.2, availableUnzoomedBrowserWidth / WEBSITE_DESIGN_WIDTH)`. Width changes magnification continuously. A 900 logical-pixel reference height resolves former visual `vh` values; actual screen height never selects a composition or determines scale. The document remains the vertical scroll owner. Auto fits the canvas; manual sizes above the fit width allow horizontal scrolling.

The header, pattern background, page, footer, tracker and website portal root are descendants of the same canvas. Header discovery attaches only the existing page-size toolbar. It does not decide whether a route gets scaled. Minus/plus start from the current scale, change by ten percentage points and clamp to 15–150%. Clicking the percentage restores Auto. Only `aim4price.website-canvas.v2` is read; legacy preferences cannot leak into the new architecture.

## Overlays and viewport mechanics

`WebsitePortal` redirects body portals to the canvas's overlay root in website context. It resolves the host after commit, including initially open dialogs. Native app portals and explicit in-page portal targets keep their original host. Normal components import this wrapper instead of `react-dom` for body portals.

CSS zoom scales fixed descendants while preserving their viewport attachment. `websiteLogicalRect` and `websiteVisibleViewport` convert rendered anchor/viewport coordinates to logical pixels for shared dropdown positioning. `DropdownOverlay` observes the mounted portal element and responds to scrolling, resizing and `aim4price:canvas-geometry`. Account and register custom selects use the same conversion helpers. The account scrollbar converts pointer movement once; map and Home scroll geometry distinguish rendered distances from logical offsets.

`--website-visible-height` represents the visible viewport divided by the canvas scale. It is used only for overlay scrolling limits. `--website-dialog-reference-width` freezes percentage-based dialog widths to the canonical canvas minus the overlay’s logical padding. It prevents a manually enlarged modal from narrowing its text and cards to the physical viewport. `data-website-overlay` roots allow safe alignment and scrolling when a manually enlarged dialog exceeds the visible viewport. Decorative background geometry uses the canonical dimensions, with its fixed origin aligned to the canvas during horizontal navigation.

## Native product boundary

These prefixes, with exact segment boundaries, bypass the canvas entirely:

- `/owner-app/**`, `/dealer/**`, `/field-manager/**`
- `/admin/**`
- `/scan/**`, `/fuel-scan/**`

The dedicated app implementations and nested device-width viewports are unchanged. Admin and the two scan workflows explicitly retain the previous 980 viewport inherited from the former root. Account pages that manage app access remain normal website pages.

Shared responsive styles remain scoped to documents without a website canvas. Canonical equivalents use the website context and fixed design variables. Website clients that reuse Dealer/Field Manager controls select extracted website CSS through `useWebsiteStyles`; the original app styles remain intact. Accessibility, print, hover and pointer media behavior is retained. Valuation's coarse-pointer/video-autoplay detection is interaction behavior, not a layout selector.

## Removed architecture

The normal root no longer uses a 980 viewport. The compact desktop continuity and header tuning stylesheets are removed. Their applicable desktop design values belong to Home/header CSS. Normal website width, height and orientation media branches no longer select layouts. Viewport-dependent visual values resolve against the fixed design dimensions. Shared native branches retain their original responsive behavior. `asset-register-view-tuning.css` remains because its product styling is not a responsive scaling layer.

## Validation and limits

Run `node scripts/verify-website-canvas.cjs` for real-component checks at 1920, 1600, 1440, 1366, 1280, 1024, 768 and 430 pixels, plus height, controls, portals, footer, header and native mobile boundary checks. The runner temporarily installs `tests/fixtures/website-canvas-page.tsx`, intercepts data APIs with synthetic test records and removes the route on exit. It never exercises production writes. Set `CANVAS_BASELINE_URL` to compare native login geometry against a separately running base checkout. Evidence is written to `.next/canvas-validation`; CI uploads it.

Chromium rounds thin borders and text metrics at fractional CSS zoom, so geometry comparisons allow accumulated border-pixel rounding while checking the fixed width, composition, typography, scrolling and scale separately. Screenshot rasterization is not pixel-identical across magnifications.

Browsers do not expose a standard cross-platform unzoomed content-width API. `outerWidth` is the stable width proxy so browser zoom is not immediately cancelled by Auto; unusual browser side panels, frames or docked developer tools can make that proxy wider than the content area. Manual sizing remains available. Native pinch/browser magnification is enabled. The automated zoom check simulates the browser's CSS-viewport/DPR change with a fixed outer width; it is not an operating-system accessibility test.

Data-backed browser checks use fixtures. Actual authenticated app workspaces, live maps, uploads and report/database integrations require staging credentials and services. The change does not modify their business logic.

## Recorded validation for this change

The clean production build completed successfully, including all 97 generated static pages. Its changed app/component/library files were byte-compared with the proposed source. The initial workspace build hit a temporary export-directory cleanup error; the clean checkout resolved that environment issue without changing the build configuration.

All requested npm suites passed: dropdown overlays (7), asset cards (25), umbrella modal design (36), signup (4), account app access (7), Owner operations (8), Dealer fast loading (4), and app umbrella access (4). Additional Field Manager parity, Dealer session and inventory checks passed (20). The final all-test sweep passed 1,082 of 1,137 tests. All 55 failures also occurred on the unchanged base commit; the base passed 1,077 of 1,136 with 59 failures. The full failure-name list and the 48 browser width results are recorded in [validation.json](website-canvas-evidence/validation.json).

Owner, Dealer and Field Manager login screenshots at 430 pixels were pixel-identical to the base checkout, in addition to matching DOM geometry and viewport metadata. This comparison covers their login surfaces, not authenticated operational workflows.

Review screenshots: [Home at 1440](website-canvas-evidence/home-1440.png), [Home at 430](website-canvas-evidence/home-430.png), [modal in Auto](website-canvas-evidence/register-modal-auto-430.png), [the same modal at 150%, scrolled horizontally](website-canvas-evidence/register-modal-manual-430.png).
