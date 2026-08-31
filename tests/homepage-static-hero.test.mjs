import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const page = read('app/page.tsx');
const styles = read('app/page.module.css');

test('the homepage keeps the existing header and admin redirect contract', () => {
  assert.match(page, /await redirectAdminToAdmin\(\)/);
  assert.match(page, /<AppHeader active="home" \/>/);
  assert.equal((page.match(/<h1/g) ?? []).length, 1);
});

test('the homepage replaces the video hero with the approved static message', () => {
  assert.doesNotMatch(page, /HomeHeroVideo|AIM4PRICE\.mp4|home-hero-poster/);
  assert.match(page, /Asset intelligence for South Africa/);
  assert.match(page, /Know every asset\./);
  assert.match(page, /Understand every value\./);
  assert.match(
    page,
    /Manage, value and share the machinery, vehicles and equipment behind your business\./,
  );
  assert.match(page, /href="#choose-your-path"/);
  assert.match(page, /href="\/about-us"/);
  assert.match(styles, /\.heroSection\s*{[^}]*min-height:\s*calc\(100svh - 5\.75rem\)/s);
  assert.match(styles, /\.heroTitle\s*{[^}]*font-size:\s*clamp\(4rem, 6\.1vw, 6\.4rem\)/s);
});

test('the homepage ends with functional Owner and Dealer choices', () => {
  assert.match(page, /Are you an owner or a dealer\?/);
  assert.match(page, /role: 'Owner'/);
  assert.match(page, /role: 'Dealer'/);
  assert.equal((page.match(/href="\/auth#signup"/g) ?? []).length, 1);
  assert.doesNotMatch(page, /href="\/(?:owner|dealer)(?:"|\/)/);
  assert.doesNotMatch(page, /productSteps|rolePlayers|rolesSection|productSection/);
  assert.match(styles, /\.audienceGrid\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*?\.audienceGrid\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
  );
});

test('homepage actions remain keyboard, touch and reduced-motion safe', () => {
  assert.match(styles, /\.primaryCta:focus-visible,[\s\S]*?\.audienceCard:focus-visible/);
  assert.match(styles, /outline:\s*3px solid #168660/);
  assert.match(styles, /\.heroActions > \*\s*{[^}]*min-height:\s*var\(--tap-target-min, 44px\)/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.audienceCard:hover,[\s\S]*?transform:\s*none/);
});
