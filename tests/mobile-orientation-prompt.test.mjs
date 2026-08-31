import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('root layout mounts the phone orientation prompt before the complete app', async () => {
  const layout = await read('app/layout.tsx');

  assert.match(layout, /import MobileOrientationPrompt from '\.\.\/components\/MobileOrientationPrompt'/);
  assert.match(layout, /<body>[\s\S]*?<MobileOrientationPrompt \/>[\s\S]*?<div className="appRoot">/);
  assert.match(layout, /width: 980/);
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

test('prompt gates only portrait phone widths and releases immediately in landscape', async () => {
  const styles = await read('components/MobileOrientationPrompt.module.css');

  assert.match(styles, /@media \(orientation: portrait\) and \(max-width: 767px\),[\s\S]*?\(orientation: portrait\) and \(max-device-width: 767px\)/);
  assert.match(styles, /\.prompt \{[\s\S]*?display: none/);
  assert.match(styles, /@media \(orientation: portrait\)[\s\S]*?\.prompt \{\s*display: flex;[\s\S]*?\.prompt \+ :global\(\.appRoot\) \{\s*display: none;/);
  assert.doesNotMatch(styles, /screen\.orientation|orientation\.lock/);
});

test('animation is calm, motion-safe and excluded from print exports', async () => {
  const styles = await read('components/MobileOrientationPrompt.module.css');

  assert.match(styles, /animation: orientationSignal 1\.55s ease-in-out infinite/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none/);
  assert.match(styles, /@media print[\s\S]*?\.prompt \{[\s\S]*?display: none !important/);
  assert.match(styles, /\.prompt \+ :global\(\.appRoot\)[\s\S]*?display: flex !important/);
});
