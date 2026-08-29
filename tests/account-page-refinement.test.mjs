import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account overview stays compact and gives the update date secondary weight", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.equal((source.match(/className=\{styles\.metricTile\}/g) ?? []).length, 4);
  assert.match(
    source,
    /className=\{styles\.overviewUpdated\}[\s\S]*?Last updated[\s\S]*?\{updatedLabel\}/,
  );
  assert.match(source, /role="progressbar"/);
  assert.match(source, /aria-valuenow=\{completionPercentage\}/);
});

test("quick actions keep their button treatment while gaining clear groups", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /className=\{styles\.quickActionGroups\}/);
  assert.match(source, /Account &amp; assets/);
  assert.match(source, /Apps &amp; visibility/);
  assert.match(source, /Manage asset registers/);
  assert.match(source, /Manage Field Manager access/);
  assert.match(source, /Manage Owner App access/);
  assert.match(source, /Marketplace contact details/);
  assert.match(source, /<strong>Field Manager access<\/strong>/);
  assert.match(source, /<strong>Owner App access<\/strong>/);
  assert.match(source, /<strong>Marketplace contact<\/strong>/);
  assert.match(source, /Discovery settings/);

  const quickActionsStart = source.indexOf("styles.quickActionsCard");
  const securityStart = source.indexOf("styles.securityCard", quickActionsStart);
  const quickActionsMarkup = source.slice(quickActionsStart, securityStart);

  assert.doesNotMatch(quickActionsMarkup, /Delete account/);
  assert.match(quickActionsMarkup, /quickActionChevron\} aria-hidden="true"/);
});

test("password controls are compact on the dashboard and edit inside a modal", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /\| "password"/);
  assert.match(source, /openActionModal\("password"\)/);
  assert.match(source, /className=\{styles\.securityActionsGrid\}/);
  assert.match(source, /activeAccountModal === "password"/);
  assert.match(
    source,
    /activeAccountModal === "password"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?onSubmit=\{handlePasswordChangeSubmit\}/,
  );
  assert.match(source, /autoComplete="current-password"[\s\S]*?autoFocus/);
  assert.match(source, /className=\{`\$\{styles\.modalInlineNotice\}/);
  assert.equal(
    (source.match(/<ModalInlineNotice notice=\{actionModalNotice\} \/>/g) ?? [])
      .length,
    5,
  );
  assert.match(source, /setActiveAccountModal\(null\)[\s\S]*?Password changed successfully/);
});

test("dangerous account removal sits in its own guarded bottom section", async () => {
  const [source, styles] = await Promise.all([
    read("app/account/account-client.tsx"),
    read("app/account/page.module.css"),
  ]);

  assert.match(source, /styles\.accountDeleteCard\} \$\{styles\.dangerZone/);
  assert.match(source, /Danger zone/);
  assert.match(source, /onClick=\{openDeleteDialog\}/);
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /ref=\{deleteDialogRef\}/);
  assert.match(source, /deleteModalError/);
  assert.match(source, /className=\{styles\.dangerZoneButtonIcon\}/);
  assert.doesNotMatch(source, /QuickActionIcon name="delete"/);
  assert.match(
    source,
    /value=\{deletePassword\}[\s\S]*?disabled=\{isDeletingAccount\}/,
  );
  assert.match(
    source,
    /onClick=\{closeDeleteDialog\}[\s\S]*?disabled=\{isDeletingAccount\}[\s\S]*?autoFocus/,
  );
  assert.match(
    styles,
    /\.dangerZoneButton \{[^}]*min-height: 3\.25rem;[^}]*border-radius: 0\.95rem;[^}]*background:/,
  );
  assert.match(styles, /\.dangerZoneButtonIcon \{[^}]*width: 2\.3rem;[^}]*background:/);
  assert.match(styles, /\.dangerZoneButtonIcon svg \{[^}]*width: 1\.16rem;[^}]*height: 1\.16rem;/);
  assert.match(styles, /\.dangerZoneButton:hover:not\(:disabled\) \{[^}]*box-shadow:/);
});

test("account dialogs restore focus and keep keyboard focus contained", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /ACCOUNT_DIALOG_FOCUSABLE_SELECTOR/);
  assert.match(source, /keepFocusInsideAccountDialog\(event, dialog\)/);
  assert.match(source, /returnFocusTarget\.focus\(\)/);
  assert.match(source, /ref=\{activeDialogRef\}/);
  assert.match(source, /tabIndex=\{-1\}/);
});

test("dashboard styling balances desktop cards and remains touch safe", async () => {
  const styles = await read("app/account/page.module.css");

  assert.match(
    styles,
    /Account dashboard refinement, August 2026[\s\S]*?\.accountDashboard \{[\s\S]*?grid-template-areas:[\s\S]*?"overview quick"[\s\S]*?"security quick"/,
  );
  assert.match(
    styles,
    /\.quickActionGroups \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(styles, /\.heroAvatarEditBadge \{/);
  assert.match(
    styles,
    /\.modalCloseButton \{[^}]*border-radius: 14px;[^}]*color: #254733;[^}]*background: #f7faf8;/,
  );
  const refinementStyles = styles.slice(
    styles.indexOf("/* === Account dashboard refinement, August 2026 === */"),
  );
  assert.doesNotMatch(
    refinementStyles,
    /\.accountScrollableModalCard \.modalCloseButton \{[^}]*#(?:5b8bee|315fbe)/,
  );
  assert.doesNotMatch(
    refinementStyles,
    /\.accountScrollableModalCard \.modalCloseButton \{[^}]*border-radius: 999px/,
  );
  assert.match(
    styles,
    /\.quickActionGroup \.quickActionButton strong \{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 760px\)[\s\S]*?\.accountHero \{[\s\S]*?flex-direction: column;[\s\S]*?align-items: flex-start/,
  );
  assert.match(
    styles,
    /@media \(max-width: 760px\)[\s\S]*?\.quickActionGroups,[\s\S]*?\.securityActionsGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
  );
  assert.match(styles, /min-height: var\(--tap-target-min, 44px\)/);
});

test("logo editing and account feedback are always discoverable and announced", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /className=\{styles\.heroAvatarEditBadge\}/);
  assert.match(source, /role=\{notice\.tone === "error" \? "alert" : "status"\}/);
  assert.match(source, /aria-live=\{notice\.tone === "error" \? "assertive" : "polite"\}/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /if \(!notice \|\| notice\.tone === "error"\) return undefined/);
  assert.match(source, /className=\{styles\.noticeDismissButton\}/);
});
