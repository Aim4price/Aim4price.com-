import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account restores the original modal-based quick actions", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /openActionModal\("business"\)/);
  assert.match(source, /openActionModal\("marketplace"\)/);
  assert.match(source, /openActionModal\("partnerDirectory"\)/);
  assert.match(source, /activeAccountModal === "business"/);
  assert.match(source, /activeAccountModal === "marketplace"/);
  assert.match(source, /activeAccountModal === "partnerDirectory"/);
  assert.match(source, /Password & security/);
});

test("dedicated staff-management pages remain intact", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /window\.location\.assign\("\/account\/dealer-app"\)/);
  assert.match(source, /window\.location\.assign\("\/account\/owner-app"\)/);
  assert.match(source, /window\.location\.assign\("\/account\/field-manager"\)/);
  assert.match(source, /Manage Dealer App staff/);
});

test("the restored account receives server-preloaded profile and PIN data", async () => {
  const [page, source] = await Promise.all([
    read("app/account/page.tsx"),
    read("app/account/account-client.tsx"),
  ]);

  assert.match(page, /const \[profile, scanPinStatus\] = await Promise\.all/);
  assert.match(page, /initialProfile=\{profile\}/);
  assert.match(page, /initialScanPinStatus=\{scanPinStatus\}/);
  assert.match(source, /useState<AccountProfile \| null>\(initialProfile\)/);
  assert.match(source, /useState\(!initialProfile\)/);
  assert.match(source, /if \(!initialProfile\)/);
  assert.match(source, /if \(!initialScanPinStatus\)/);
});

test("business modal uses a short contact, address and logo workflow", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /businessDetailsModalCard/);
  assert.match(source, /labels=\{\["Contact info", "Business address", "Business logo"\]\}/);
  assert.match(source, /businessDetailsStep === 1/);
  assert.match(source, /businessDetailsStep === 2/);
  assert.match(source, /businessDetailsStep === 3/);
  assert.match(source, /addressLine2: event\.target\.value/);
  assert.match(source, /Your changes are saved\s+together on the final step/);
});

test("partner directory separates visibility, map and additional information", async () => {
  const source = await read("app/account/account-client.tsx");

  assert.match(source, /labels=\{\["Visibility", "Map", "Additional info"\]\}/);
  assert.match(source, /partnerDirectoryStep === 1/);
  assert.match(source, /partnerDirectoryStep === 2/);
  assert.match(source, /partnerDirectoryStep === 3/);
  assert.match(source, /partnerDirectoryStep !== 2/);
  assert.match(source, /goToPartnerDirectoryStep/);
});

test("modal CSS defines focused widths, spacing and sticky actions", async () => {
  const styles = await read("app/account/page.module.css");

  assert.match(styles, /Restored account modal workflow/);
  assert.match(styles, /\.businessDetailsModalCard[\s\S]*?70rem/);
  assert.match(styles, /\.marketplaceModalCard[\s\S]*?58rem/);
  assert.match(styles, /\.partnerDirectoryModalCard[\s\S]*?72rem/);
  assert.match(styles, /\.modalSectionHeading/);
  assert.match(styles, /\.businessDetailsModalCard \.businessLogoPreview/);
  assert.match(styles, /\.accountScrollableModalCard \.modalActions[\s\S]*?bottom:/);
  assert.match(styles, /\.modalStepProgress/);
  assert.match(styles, /\.wizardStepPanel/);
  assert.match(styles, /\.accountScrollableModalCard \.accountModalScrollThumb/);
});

test("password security presents compact update and reset-email paths", async () => {
  const [source, styles] = await Promise.all([
    read("app/account/account-client.tsx"),
    read("app/account/page.module.css"),
  ]);

  assert.match(source, /className=\{styles\.securityActionsGrid\}/);
  assert.match(source, /Email a reset link/);
  assert.match(source, /activeAccountModal === "password"/);
  assert.match(source, /onSubmit=\{handlePasswordChangeSubmit\}/);
  assert.match(source, /disabled=\{!canSubmitPasswordChange\}/);
  assert.match(source, /The new passwords do not match/);
  assert.match(styles, /\.securityActionCard/);
  assert.match(styles, /\.passwordModalCard/);
});

test("signup retains town and explicit directory participation", async () => {
  const [client, auth, profile] = await Promise.all([
    read("app/auth/auth-client.tsx"),
    read("lib/auth.ts"),
    read("lib/account-profile.ts"),
  ]);

  assert.match(client, /name="townCity"/);
  assert.match(client, /directoryParticipation/);
  assert.match(auth, /readSignupField\(context, "townCity"\)/);
  assert.match(profile, /initialPartnerDirectoryEnabled/);
});
