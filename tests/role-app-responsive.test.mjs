import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const roleApps = [
  {
    name: 'Dealer App',
    layout: new URL('../app/dealer/layout.tsx', import.meta.url),
    manifest: new URL('../app/dealer/manifest.webmanifest/route.ts', import.meta.url),
    styles: new URL('../app/dealer/dealer.module.css', import.meta.url),
    widePhoneLayout: /@media\s*\(max-width:\s*767px\)[\s\S]*?\.launcher\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    tabletLayout: /@media\s*\(min-width:\s*768px\)[\s\S]*?\.launcher\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/,
    phoneInputLayout: /@media\s*\(max-width:\s*767px\)[\s\S]*?font-size:\s*1rem\s*!important/,
  },
  {
    name: 'Owner App',
    layout: new URL('../app/owner-app/layout.tsx', import.meta.url),
    manifest: new URL('../app/owner-app/manifest.webmanifest/route.ts', import.meta.url),
    styles: new URL('../app/owner-app/owner-app.module.css', import.meta.url),
    widePhoneLayout: /@media\s*\(min-width:\s*540px\)\s*and\s*\(max-width:\s*767px\)[\s\S]*?\.homeLauncher\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    tabletLayout: /@media\s*\(min-width:\s*768px\)[\s\S]*?\.homeLauncher\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/,
    phoneInputLayout: /@media\s*\(max-width:\s*539px\)[\s\S]*?font-size:\s*1rem\s*!important/,
  },
  {
    name: 'Field Manager App',
    layout: new URL('../app/field-manager/layout.tsx', import.meta.url),
    manifest: new URL('../app/field-manager/manifest.webmanifest/route.ts', import.meta.url),
    styles: new URL('../app/field-manager/page.module.css', import.meta.url),
    widePhoneLayout: /@media\s*\(min-width:\s*540px\)\s*and\s*\(max-width:\s*767px\)[\s\S]*?\.homeActionGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    tabletLayout: /@media\s*\(min-width:\s*768px\)[\s\S]*?\.homeActionGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/,
    phoneInputLayout: /@media\s*\(max-width:\s*767px\)[\s\S]*?font-size:\s*1rem\s*!important/,
  },
];

test('role apps explicitly keep a scalable device-width viewport', async () => {
  for (const roleApp of roleApps) {
    const source = await readFile(roleApp.layout, 'utf8');

    assert.match(source, /width:\s*['"]device-width['"]/, `${roleApp.name} must use the device width`);
    assert.match(source, /initialScale:\s*1/, `${roleApp.name} must start at a readable scale`);
    assert.match(source, /userScalable:\s*true/, `${roleApp.name} must allow pinch zoom`);
    assert.doesNotMatch(source, /maximumScale|minimumScale/, `${roleApp.name} must not restrict zoom`);
  }
});

test('role apps adapt to tablet and landscape screens', async () => {
  for (const roleApp of roleApps) {
    const [manifest, styles] = await Promise.all([
      readFile(roleApp.manifest, 'utf8'),
      readFile(roleApp.styles, 'utf8'),
    ]);

    assert.match(manifest, /orientation:\s*['"]any['"]/, `${roleApp.name} must not lock portrait orientation`);
    assert.match(styles, roleApp.widePhoneLayout, `${roleApp.name} must keep wide phones single-column`);
    assert.match(styles, roleApp.tabletLayout, `${roleApp.name} must provide a tablet layout`);
    assert.match(
      styles,
      roleApp.phoneInputLayout,
      `${roleApp.name} must keep phone form controls readable without focus zoom`,
    );
  }
});
