import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyDropdownOverlayGeometry,
  calculateDropdownOverlayPosition,
  DROPDOWN_OVERLAY_Z_INDEX,
} from '../lib/dropdown-overlay-position.ts';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

async function listSourceFiles(relativeDirectory) {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(relativePath));
    } else if (/\.(?:tsx|jsx)$/.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

function openingTagAt(source, roleIndex) {
  const start = source.lastIndexOf('<', roleIndex);
  assert.notEqual(start, -1, 'Listbox role must be inside a JSX opening tag.');

  let quote = null;
  let braceDepth = 0;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (character === quote && previous !== '\\') quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') {
      braceDepth += 1;
      continue;
    }
    if (character === '}' && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }
    if (character === '>' && braceDepth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error('Unterminated JSX opening tag containing role="listbox".');
}

function rect({ left, top, width, height }) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

test('dropdown geometry opens in available space and never leaves the viewport', () => {
  const viewport = { left: 0, top: 0, width: 1000, height: 800 };
  const below = calculateDropdownOverlayPosition({
    anchor: rect({ left: 100, top: 100, width: 220, height: 44 }),
    viewport,
    contentWidth: 400,
    contentHeight: 180,
    gap: 8,
    gutter: 12,
    maxHeight: 360,
    matchAnchorWidth: true,
  });
  assert.deepEqual(
    { placement: below.placement, left: below.left, top: below.top, width: below.width },
    { placement: 'bottom', left: 100, top: 152, width: 220 },
  );

  const above = calculateDropdownOverlayPosition({
    anchor: rect({ left: 100, top: 650, width: 220, height: 44 }),
    viewport,
    contentWidth: 220,
    contentHeight: 300,
    gap: 8,
    gutter: 12,
    maxHeight: 360,
    matchAnchorWidth: true,
  });
  assert.equal(above.placement, 'top');
  assert.equal(above.top, 342);

  const rightEdge = calculateDropdownOverlayPosition({
    anchor: rect({ left: 280, top: 40, width: 80, height: 44 }),
    viewport: { left: 0, top: 0, width: 320, height: 480 },
    contentWidth: 80,
    contentHeight: 120,
    gap: 8,
    gutter: 12,
    maxHeight: 360,
    matchAnchorWidth: true,
  });
  assert.equal(rightEdge.left, 228);
  assert.equal(rightEdge.left + rightEdge.width, 308);

  const contentWidth = calculateDropdownOverlayPosition({
    anchor: rect({ left: 20, top: 40, width: 100, height: 44 }),
    viewport: { left: 0, top: 0, width: 500, height: 500 },
    contentWidth: 260,
    contentHeight: 120,
    gap: 8,
    gutter: 12,
    maxHeight: 360,
    matchAnchorWidth: false,
  });
  assert.equal(contentWidth.width, 260);

  const minimumWidth = calculateDropdownOverlayPosition({
    anchor: rect({ left: 20, top: 40, width: 100, height: 44 }),
    viewport: { left: 0, top: 0, width: 500, height: 500 },
    contentWidth: 120,
    contentHeight: 120,
    gap: 8,
    gutter: 12,
    maxHeight: 360,
    matchAnchorWidth: false,
    minimumWidth: 352,
  });
  assert.equal(minimumWidth.width, 352);

  const constrained = calculateDropdownOverlayPosition({
    anchor: rect({ left: 20, top: 80, width: 180, height: 40 }),
    viewport: { left: 0, top: 0, width: 320, height: 200 },
    contentWidth: 180,
    contentHeight: 500,
    gap: 8,
    gutter: 12,
    maxHeight: 360,
    matchAnchorWidth: true,
  });
  assert.equal(constrained.maxHeight, 60);
  assert.equal(constrained.top, 128);
  assert.ok(constrained.top + constrained.maxHeight <= 188);
});

test('dropdown geometry cannot be overridden by modal CSS modules', () => {
  const declarations = new Map();
  const style = {
    setProperty(property, value, priority) {
      declarations.set(property, { value, priority });
    },
  };

  applyDropdownOverlayGeometry(style, {
    position: { left: 420, top: 680, width: 510, maxHeight: 240 },
    fallbackMaxHeight: 360,
  });

  assert.deepEqual(declarations.get('position'), { value: 'fixed', priority: 'important' });
  assert.deepEqual(declarations.get('left'), { value: '420px', priority: 'important' });
  assert.deepEqual(declarations.get('top'), { value: '680px', priority: 'important' });
  assert.deepEqual(declarations.get('width'), { value: '510px', priority: 'important' });
  assert.deepEqual(declarations.get('visibility'), { value: 'visible', priority: 'important' });
  assert.deepEqual(declarations.get('z-index'), {
    value: String(DROPDOWN_OVERLAY_Z_INDEX),
    priority: 'important',
  });

  applyDropdownOverlayGeometry(style, {
    position: null,
    fallbackMaxHeight: 360,
  });
  assert.deepEqual(declarations.get('visibility'), { value: 'hidden', priority: 'important' });
  assert.deepEqual(declarations.get('pointer-events'), { value: 'none', priority: 'important' });
});

test('shared overlay is body-portalled, viewport-aware, and always above modal layers', async () => {
  const [component, styles] = await Promise.all([
    read('components/DropdownOverlay.tsx'),
    read('app/globals.css'),
  ]);

  assert.match(component, /createPortal\([\s\S]*document\.body/);
  assert.match(component, /new ResizeObserver\(schedulePositionUpdate\)/);
  assert.match(component, /window\.addEventListener\('scroll', schedulePositionUpdate, true\)/);
  assert.match(component, /window\.visualViewport\?\.addEventListener\('resize'/);
  assert.match(component, /resolveFallbackAnchor/);
  assert.match(component, /\[role="combobox"\]\[aria-expanded="true"\]/);
  assert.match(component, /applyDropdownOverlayGeometry\(menu\.style/);
  assert.match(component, /ref=\{attachMenuRef\}/);
  assert.match(component, /event\.stopPropagation\(\)/);
  assert.match(styles, /body > \[data-dropdown-overlay='true'\][\s\S]*position: fixed !important;/);
  assert.match(styles, /body > \[data-dropdown-overlay='true'\][\s\S]*z-index: 2147483647 !important;/);
  assert.match(styles, /body > \[data-dropdown-overlay-portal='true'\][\s\S]*z-index: 2147483647 !important;/);
});

test('every custom listbox uses the shared overlay or a verified body portal', async () => {
  const sourceFiles = [
    ...await listSourceFiles('app'),
    ...await listSourceFiles('components'),
  ];
  const violations = [];
  let listboxCount = 0;

  for (const relativePath of sourceFiles) {
    const source = await read(relativePath);
    for (const match of source.matchAll(/role\s*=\s*(["'])listbox\1/g)) {
      listboxCount += 1;
      const tag = openingTagAt(source, match.index);
      const tagName = /^<([A-Za-z][A-Za-z0-9.]*)/.exec(tag)?.[1] ?? '';
      const sharedOverlay = tagName === 'DropdownOverlay';
      const verifiedPortal = /data-dropdown-overlay-(?:portal|contained)="true"/.test(tag)
        && source.includes('createPortal')
        && source.includes('document.body');
      if (!sharedOverlay && !verifiedPortal) {
        violations.push(`${relativePath}: ${tag.replace(/\s+/g, ' ').slice(0, 160)}`);
      }
    }

    if (/<DropdownOverlay(?:\s|>)/.test(source)) {
      assert.match(source, /import DropdownOverlay from /, `${relativePath} must import DropdownOverlay`);
    }
  }

  assert.ok(listboxCount >= 25, `Expected the global audit to find all custom listboxes; found ${listboxCount}.`);
  assert.deepEqual(violations, []);

  const assetRegister = await read('app/asset-register/asset-register-client.tsx');
  assert.match(assetRegister, /usePortal = true/);
  assert.doesNotMatch(assetRegister, /usePortal\s*=\s*\{false\}/);
});

test('marketplace filters use branded listboxes instead of browser-native selects', async () => {
  const [marketplace, filterSelect, styles] = await Promise.all([
    read('app/marketplace/marketplace-client.tsx'),
    read('app/marketplace/marketplace-filter-select.tsx'),
    read('app/marketplace/page.module.css'),
  ]);

  assert.match(marketplace, /import MarketplaceFilterSelect from '\\.\\/marketplace-filter-select'/);
  assert.equal((marketplace.match(/<MarketplaceFilterSelect/g) ?? []).length, 3);
  assert.doesNotMatch(marketplace, /<select\\b/);
  assert.match(filterSelect, /import DropdownOverlay from '\\.\\.\\/\\.\\.\\/components\\/DropdownOverlay'/);
  assert.match(filterSelect, /<DropdownOverlay[\\s\\S]*?role="listbox"/);
  assert.match(filterSelect, /aria-haspopup="listbox"/);
  assert.match(filterSelect, /event\\.key === 'ArrowDown'/);
  assert.match(filterSelect, /event\\.key === 'ArrowUp'/);
  assert.match(filterSelect, /event\\.key !== 'Escape'/);
  assert.match(styles, /\\.filterSelectMenu \\{[\\s\\S]*?border-radius: 0\\.9rem;[\\s\\S]*?box-shadow:/);
  assert.match(styles, /\\.filterSelectOptionActive \\{[\\s\\S]*?background: #e8f3ee/);
});

test('report, modal, maintenance, fuel, invoice, and document dropdowns are migrated', async () => {
  const criticalFiles = [
    'components/asset-register/AssetGroupManagerModal.tsx',
    'components/DealerMaintenanceReportModal.tsx',
    'components/DealerCostOfOwnershipReportModal.tsx',
    'components/DealerMaintenanceScheduleModal.tsx',
    'app/asset-register/asset-register-client.tsx',
    'app/maintenance/maintenance-client.tsx',
    'app/fuel/fuel-client.tsx',
    'app/fuel/missing-fuel-entry-modal.tsx',
    'app/my-invoices/my-invoices-client.tsx',
    'app/documents/documents-client.tsx',
    'components/documents/AssetDocumentUploadModal.tsx',
  ];

  for (const relativePath of criticalFiles) {
    const source = await read(relativePath);
    assert.match(source, /<DropdownOverlay/, `${relativePath} must render dropdowns in the global overlay`);
  }
});
