import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account hub is server-loaded and routes editing to focused pages", async () => {
  const [page, hub] = await Promise.all([
    read("app/account/page.tsx"),
    read("app/account/account-client.tsx"),
  ]);

  assert.match(page, /Promise\.all/);
  assert.match(page, /getAccountProfile/);
  assert.match(page, /getAccountScanPinStatus/);
  assert.doesNotMatch(hub, /"use client"/);
  assert.doesNotMatch(hub, /fetch\(/);
  assert.match(hub, /href="\/account\/profile"/);
  assert.match(hub, /href="\/account\/visibility"/);
  assert.match(hub, /href="\/account\/security"/);
  assert.doesNotMatch(hub, /Delete account/);
});

test("account actions preserve dedicated staff management pages", async () => {
  const hub = await read("app/account/account-client.tsx");
  assert.match(hub, /\/account\/owner-app/);
  assert.match(hub, /\/account\/field-manager/);
  assert.match(hub, /\/account\/dealer-app/);
  assert.match(hub, /Partner directory/);
  assert.match(hub, /Edit business details/);
});

test("profile page separates private account location from public visibility", async () => {
  const profile = await read("app/account/profile/profile-client.tsx");
  assert.match(profile, /Profile & location/);
  assert.match(profile, /Town \/ city/);
  assert.match(profile, /Owners remain private/);
  assert.match(profile, /Saving this address does not automatically expose it/);
  assert.match(profile, /syncPrimaryLogoToRegister/);
});

test("visibility page is role-aware and provides a public partner map pin", async () => {
  const visibility = await read("app/account/visibility/visibility-client.tsx");
  assert.match(visibility, /Participate in Discovery/);
  assert.match(visibility, /Show my business in the Aim4price directory/);
  assert.match(visibility, /Public map location/);
  assert.match(visibility, /Use current location/);
  assert.match(visibility, /Your precise location remains private/);
  assert.match(visibility, /partnerDirectoryEnabled/);
});

test("security page contains protected actions and the only deletion flow", async () => {
  const security = await read("app/account/security/security-client.tsx");
  assert.match(security, /\/api\/auth\/change-password/);
  assert.match(security, /\/api\/auth\/request-password-reset/);
  assert.match(security, /\/api\/account-profile\/scan-pin/);
  assert.match(security, /Type DELETE/);
  assert.match(security, /\/api\/auth\/delete-user/);
});

test("signup collects town and explicit partner-directory participation", async () => {
  const [client, auth, profile] = await Promise.all([
    read("app/auth/auth-client.tsx"),
    read("lib/auth.ts"),
    read("lib/account-profile.ts"),
  ]);
  assert.match(client, /name="townCity"/);
  assert.match(client, /directoryParticipation/);
  assert.match(client, /partnerDirectoryEnabled/);
  assert.match(auth, /readSignupField\(context, "townCity"\)/);
  assert.match(auth, /"partnerDirectoryEnabled"/);
  assert.match(profile, /town_city/);
  assert.match(profile, /initialPartnerDirectoryEnabled/);
});
