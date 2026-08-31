import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('root layout mounts the phone orientation prompt before the complete app', async () => {
  const layout = await read('app/layout.tsx');

  assert.match(layout, /import MobileOrientationPrompt from '\.\.\/components\/MobileOrientationPrompt'/);
  assert.match(layout, /<body>[\s\S]*?<MobileOrientationPrompt \/>[\s\S]*?<div className="appRoot">/);
  assert.match(layout, /width: 980/);
  assert.match(layout, /initialScale: -1/);
  assert.doesNotMatch(layout, /width: 'device-width'|initialScale: 1/);
});

test('prompt clearly and accessibly tells portrait-phone users to rotate', async () => {
  const prompt = await read('components/MobileOrientationPrompt.tsx');

  assert.match(prompt, /role="dialog"/);
  assert.match(prompt, /aria-modal="true"/);
  assert.match(prompt, /aria-labelledby="mobile-orientation-title"/);
  assert.match(prompt, /aria-describedby="mobile-orientation-description"/);
  assert.match(prompt, /Turn your phone sideways/);
  assert.match(prompt, /Rotate to landscape to continue\./);
  assert.match(prompt, /aria-hidden="true"/);
});

test('installable mobile apps bypass the orientation prompt', async () => {
  const prompt = await read('components/MobileOrientationPrompt.tsx');
  const prefixSource = prompt.match(/MOBILE_APP_ROUTE_PREFIXES = \[(.*?)\] as const/)?.[1] ?? '';
  const prefixes = [...prefixSource.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const bypassesPrompt = (pathname) => prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  assert.match(prompt, /^'use client';/);
  assert.match(prompt, /usePathname/);
  assert.match(prompt, /MOBILE_APP_ROUTE_PREFIXES = \['\/owner-app', '\/dealer', '\/field-manager'\] as const/);
  assert.match(prompt, /pathname === prefix \|\| pathname\.startsWith\(`\$\{prefix\}\/`\)/);
  assert.match(prompt, /if \(isMobileAppRoute\(pathname\)\) return null/);
  assert.deepEqual(prefixes, ['/owner-app', '/dealer', '/field-manager']);

  for (const pathname of [
    '/owner-app',
    '/owner-app/assets',
    '/dealer',
    '/dealer/login',
    '/field-manager',
    '/field-manager/overview',
  ]) {
    assert.equal(bypassesPrompt(pathname), true, `${pathname} should bypass the prompt`);
  }

  for (const pathname of [
    '/',
    '/dealer-costs',
    '/account/dealer-app',
    '/account/owner-app',
    '/account/field-manager',
    '/admin',
  ]) {
    assert.equal(bypassesPrompt(pathname), false, `${pathname} should retain the prompt`);
  }
});

test('prompt gates only portrait phone widths and releases immediately in landscape', async () => {
  const styles = await read('components/MobileOrientationPrompt.module.css');

  assert.match(styles, /@media \(orientation: portrait\) and \(max-width: 767px\),[\s\S]*?\(orientation: portrait\) and \(max-device-width: 767px\)/);
  assert.match(styles, /\.prompt \{[\s\S]*?display: none/);
  assert.match(styles, /@media \(orientation: portrait\)[\s\S]*?\.prompt \{\s*display: flex;[\s\S]*?\.prompt \+ :global\(\.appRoot\) \{\s*display: none;/);
  assert.doesNotMatch(styles, /screen\.orientation|orientation\.lock/);
});

test('animation is calm, motion-safe and excluded from print exports', async () => {
  const styles = await read('components/MobileOrientationPrompt.module.css');
  const prompt = await read('components/MobileOrientationPrompt.tsx');

  assert.match(prompt, /className=\{styles\.phoneGroup\}/);
  assert.match(prompt, /orientation-phone-frame/);
  assert.match(prompt, /orientation-phone-screen/);
  assert.match(prompt, /className=\{styles\.motionTrack\}/);
  assert.match(prompt, /markerEnd="url\(#orientation-arrowhead\)"/);
  assert.equal((prompt.match(/className=\{styles\.motionTrack\}/g) ?? []).length, 1);
  assert.doesNotMatch(prompt, /styles\.orbit|styles\.arrowHead/);
  assert.match(styles, /border-radius: 2\.75rem/);
  assert.match(styles, /animation: orientationGlow 2\.8s ease-in-out infinite/);
  assert.match(styles, /animation: phoneTurn 2\.8s cubic-bezier\(0\.65, 0, 0\.25, 1\) infinite/);
  assert.match(styles, /animation: drawTurn 2\.8s ease-in-out infinite/);
  assert.match(styles, /@keyframes phoneTurn[\s\S]*?transform: rotate\(90deg\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.phoneGroup \{\s*transform: rotate\(90deg\)/);
  assert.match(styles, /@media print[\s\S]*?\.prompt \{[\s\S]*?display: none !important/);
  assert.match(styles, /\.prompt \+ :global\(\.appRoot\)[\s\S]*?display: flex !important/);
});
