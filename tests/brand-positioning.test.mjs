import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const layout = read('app/layout.tsx');
const homePage = read('app/page.tsx');
const aboutPage = read('app/about-us/page.tsx');
const footer = read('components/AppFooter.tsx');
const readme = read('README.md');
const publicBrandSources = [layout, homePage, aboutPage, footer, readme].join('\n');

test('uses the new Aim4price expansion in browser and social metadata', () => {
  assert.match(layout, /Aim4price \| Asset Intelligence, Management & Pricing/);
  assert.match(layout, /applicationName: 'Aim4price'/);
  assert.match(layout, /openGraph:[\s\S]*?title: brandTitle[\s\S]*?description: brandDescription/);
  assert.match(layout, /twitter:[\s\S]*?title: brandTitle[\s\S]*?description: brandDescription/);
});

test('introduces the expansion consistently on core public pages', () => {
  assert.match(homePage, /Asset Intelligence, Management &amp; Pricing/);
  assert.match(aboutPage, /Aim4price stands for Asset Intelligence, Management &amp;[\s\S]*?Pricing/);
  assert.match(footer, /Asset Intelligence, Management &amp; Pricing/);
  assert.match(readme, /Asset Intelligence, Management & Pricing/);
});

test('removes the retired agricultural and industrial pricing expansion', () => {
  assert.doesNotMatch(publicBrandSources, /Agricultural & Industrial Machinery Pricing/i);
  assert.doesNotMatch(publicBrandSources, /Asset management for South Africa/i);
});
