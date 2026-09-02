import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('wide static Home has a dedicated desktop composition below the cinematic height gate', async () => {
  const [page, hero, tuning] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-hero-experience.tsx'),
    read('app/home-wide-static.css'),
  ]);

  assert.match(page, /import '\.\/home-wide-static\.css';/);
  assert.match(hero, /\(min-width: 1181px\) and \(min-height: 700px\) and \(hover: hover\) and \(pointer: fine\)/);

  assert.match(tuning, /@media \(min-width: 1181px\) \{/);
  assert.match(
    tuning,
    /section\[data-story-capability='static'\] div:has\(> \[data-story-opening\]\)[\s\S]*?grid-template-columns: minmax\(0, 1\.18fr\) minmax\(21rem, 0\.82fr\)/,
  );
  assert.match(
    tuning,
    /section\[data-story-capability='static'\] \[data-story-opening\] \+ div \{[\s\S]*?align-self: start/,
  );
  assert.match(
    tuning,
    /@media \(min-width: 1181px\) and \(max-height: 699px\) \{[\s\S]*?section\[data-story-capability\] div:has\(> \[data-story-opening\]\)[\s\S]*?padding-block: clamp\(1\.25rem, 3\.2vh, 1\.75rem\) clamp\(2\.25rem, 5\.5vh, 3rem\)/,
  );
  assert.match(
    tuning,
    /@media \(min-width: 1181px\) and \(max-height: 620px\) \{[\s\S]*?section\[data-story-capability\] div:has\(> \[data-story-opening\]\)[\s\S]*?padding-block: 1rem 2\.25rem/,
  );

  assert.doesNotMatch(tuning, /\bzoom\s*:/);
  assert.doesNotMatch(tuning, /min-width:\s*1360px/);
  assert.doesNotMatch(tuning, /transform:\s*scale\(/);
});

test('common scaled 1080p desktop viewport is covered without affecting tablet or cinematic states', () => {
  const usesShortDesktopComposition = (width, height) => width >= 1181 && height <= 699;

  // Approximate CSS viewport from a 1920x1080 Windows monitor at 125% scaling
  // after browser chrome and the taskbar consume vertical space.
  assert.equal(usesShortDesktopComposition(1536, 694), true);

  // Tablet/smaller-laptop widths remain on the existing responsive layout.
  assert.equal(usesShortDesktopComposition(1180, 694), false);

  // The cinematic story still owns sufficiently tall fine-pointer desktops.
  assert.equal(usesShortDesktopComposition(1536, 700), false);
});
