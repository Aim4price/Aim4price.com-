import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const footer = readFileSync(new URL('../components/AppFooter.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../components/AppFooter.module.css', import.meta.url), 'utf8');

test('footer links match the signed-in account type', () => {
  assert.match(footer, /label: 'Owner tools'[\s\S]*?\/asset-register[\s\S]*?\/maintenance[\s\S]*?\/fuel/);
  assert.match(footer, /label: 'Dealer tools'[\s\S]*?\/leads[\s\S]*?\/tracking[\s\S]*?\/dealer-costs/);
  assert.match(footer, /const publicWorkspace[\s\S]*?label: 'Explore'[\s\S]*?\/marketplace/);
  assert.match(footer, /session\?\.accountType === 'owner'/);
  assert.match(footer, /session\?\.accountType === 'dealer'/);
  assert.match(footer, /return publicWorkspace/);
  assert.match(footer, /refreshCachedHeaderSession\(\)/);
});

test('footer uses concise copy without decorative pills', () => {
  assert.match(footer, /Asset Intelligence, Management &amp; Pricing/);
  assert.match(footer, /One secure place to value, manage and share information for South African/);
  assert.match(footer, /machinery, vehicles, equipment and property/);
  assert.doesNotMatch(footer, /brandEyebrow|trustRow|Owner-controlled records|Permission-based collaboration/);
  assert.doesNotMatch(styles, /border-radius: 999px/);
});

test('footer remains responsive and accessible', () => {
  assert.match(footer, /aria-label=\{isExpanded \? 'Collapse footer' : 'Open footer'\}/);
  assert.match(footer, /aria-expanded=\{isExpanded\}/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
