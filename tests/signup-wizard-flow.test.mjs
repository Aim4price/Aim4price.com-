import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  assert.notEqual(startIndex, -1, `Missing section marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing section marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("signup uses a three-step umbrella-style progress flow", async () => {
  const [source, styles] = await Promise.all([
    read("app/auth/auth-client.tsx"),
    read("app/auth/page.module.css"),
  ]);

  assert.match(source, /type SignupStep = 1 \| 2 \| 3/);
  assert.match(source, /step: 1, label: "Workspace"/);
  assert.match(source, /step: 2, label: "Your details"/);
  assert.match(source, /step: 3, label: "Secure account"/);
  assert.match(source, /<ol className=\{styles\.signupProgress\} aria-label="Account setup progress">/);
  assert.match(source, /aria-current=\{isCurrent \? "step" : undefined\}/);
  assert.match(source, /isComplete \? "✓" : step/);
  assert.match(source, /Complete one short step at a time\. Your account is created on the final step\./);

  assert.match(styles, /\.signupShell\s*\{[\s\S]*?52rem/);
  assert.match(styles, /\.signupProgressStep:not\(:last-child\)::after[\s\S]*?height: 2px/);
  assert.match(styles, /\.signupProgressStepCurrent > span[\s\S]*?box-shadow: 0 0 0 5px/);
  assert.match(styles, /\.signupProgressStep[\s\S]*?color: #667971/);
  assert.match(styles, /\.signupStepCard[\s\S]*?border-radius: 1\.3rem/);
  assert.match(styles, /\.signupStepCard:focus[\s\S]*?outline: 3px solid #168660/);
  assert.match(styles, /\.signupFieldGrid[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*?\.signupProgress[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none/);
  assert.match(
    styles,
    /@media \(max-width: 360px\)[\s\S]*?\.signupFooter[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
  );
});

test("signup renders one focused panel at a time", async () => {
  const source = await read("app/auth/auth-client.tsx");
  const workspaceStep = sectionBetween(
    source,
    "{signupStep === 1 ? (",
    "{signupStep === 2 ? (",
  );
  const detailsStep = sectionBetween(
    source,
    "{signupStep === 2 ? (",
    "{signupStep === 3 ? (",
  );
  const accountStep = sectionBetween(
    source,
    "{signupStep === 3 ? (",
    '<div className={styles.signupFooter}>',
  );

  assert.match(workspaceStep, /name="accountType"/);
  assert.match(workspaceStep, /name="accountSubtype"/);
  assert.match(workspaceStep, /directoryParticipation/);
  assert.doesNotMatch(workspaceStep, /name="email"|name="password"/);

  for (const field of [
    'name="name"',
    'name="phone"',
    'name="introducedByOption"',
    'name="province"',
    'name="townCity"',
  ]) {
    assert.match(detailsStep, new RegExp(field));
  }
  assert.doesNotMatch(detailsStep, /name="email"|name="password"/);

  assert.match(accountStep, /name="email"/);
  assert.match(accountStep, /name="password"/);
  assert.match(accountStep, /name="confirmPassword"/);
  assert.match(accountStep, /acceptTerms/);
  assert.match(source, /ariaLabel="What would you like to use Aim4price for\?"/);
  assert.match(source, /ariaLabel="Which best describes your work\?"/);
  assert.match(source, /ariaLabel="Who introduced you to Aim4price\?"/);
  assert.match(source, /ariaLabel="Province"/);
});

test("the submit guard advances early steps without creating an account", async () => {
  const source = await read("app/auth/auth-client.tsx");
  const earlyStepGuard = source.indexOf("if (signupStep < 3)");
  const signupRequest = source.indexOf('postAuth("/sign-up/email"');

  assert.ok(earlyStepGuard >= 0, "The early-step submit guard is missing");
  assert.ok(signupRequest > earlyStepGuard, "The signup request must follow the early-step guard");
  assert.match(
    source.slice(earlyStepGuard, signupRequest),
    /moveToSignupStep\(\(signupStep \+ 1\) as SignupStep\)[\s\S]*?return;/,
  );
  assert.match(source, /signupStep === 1[\s\S]*?<Link href="\/" className=\{styles\.secondaryButton\}>\s*Cancel/);
  assert.match(source, /signupStep - 1/);
  assert.match(source, /signupStep < 3\s*\? "Next"\s*: "Create account"/);
  assert.match(source, /signupPanelRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /signupFlowRef\.current\?\.scrollIntoView/);
  assert.match(source, /setSignupForm\(initialSignupState\);\s*setSignupStep\(1\);/);
  assert.match(
    source,
    /const nextMode = getModeFromHash\(window\.location\.hash\);[\s\S]*?nextMode === "signup"[\s\S]*?setSignupStep\(1\)/,
  );
});

test("the staged flow preserves signup account and activation rules", async () => {
  const source = await read("app/auth/auth-client.tsx");

  assert.match(source, /accountType: signupForm\.accountType === "middleman" \? "dealer"/);
  assert.match(source, /signupForm\.accountType !== "owner" &&\s*signupForm\.accountType !== "middleman" &&\s*signupForm\.directoryParticipation/);
  assert.match(source, /signupForm\.accountType === "middleman" \? "\/my-showroom"/);
  assert.match(source, /Free workspace for valuation-backed adverts and your public showroom/);
  assert.match(source, /awaiting payment\/admin approval/);
});
