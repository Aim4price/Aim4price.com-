import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const options = { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 };
const helperModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(readFileSync('lib/owner-asset-location.ts', 'utf8'), { compilerOptions: options }).outputText)(helperModule, helperModule.exports);
const helpers = helperModule.exports;
const asset = { lastKnownLat: -34.024005, lastKnownLng: 22.383826, lastKnownLocationText: 'Farm', lastScannedAtIso: '2026-11-09' };
const saved = helpers.assetLocationDraft(asset);
const source = readFileSync('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx', 'utf8');
const component = source.slice(source.indexOf('function LocationSection('), source.indexOf('function MarketplaceSection('));
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
function fixture() {
  const states = [], refs = [], writes = [];
  let cursor = 0, refCursor = 0, location = { ...saved };
  const jsx = (type, props) => ({ type, props });
  const useState = initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; };
  const useRef = initial => { const i = refCursor++; return refs[i] ||= { current: initial }; };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'useState', 'useRef', 'useEffect', 'assetLocationDraft', 'validLocationCoordinates', 'hasLocationChanges', 'styles', 'dateTime', ts.transpileModule(component + '\nmodule.exports = LocationSection;', { compilerOptions: options }).outputText)(
    () => ({ jsx, jsxs: jsx }), mod, mod.exports, useState, useRef, () => {}, helpers.assetLocationDraft, helpers.validLocationCoordinates, helpers.hasLocationChanges, {}, String,
  );
  return {
    writes,
    location: () => location,
    setLocation: value => { location = value; },
    render: () => { cursor = 0; refCursor = 0; return nodes(mod.exports({ draft: asset, location, setLocation: value => { location = typeof value === 'function' ? value(location) : value; }, action: async (...args) => { writes.push(args); }, busy: false })); },
  };
}
function button(elements, text) { return elements.find(node => node.type === 'button' && (node.props.children === text || nodes(node).some(child => child.type === 'strong' && child.props.children === text))); }

test('location validation accepts zero, rejects missing and out-of-range coordinates', () => {
  assert.equal(helpers.validLocationCoordinates({ ...saved, latitude: '0', longitude: '0' }), true);
  for (const latitude of ['', ' ', 'NaN', 'Infinity', '91', '-91']) assert.equal(helpers.validLocationCoordinates({ ...saved, latitude }), false);
  assert.equal(helpers.validLocationCoordinates({ ...saved, longitude: '181' }), false);
  assert.equal(helpers.validLocationCoordinates({ ...saved, latitude: '-90', longitude: '180' }), true);
});
test('dirty tracking detects coordinates and descriptions but not harmless numeric formatting', () => {
  assert.equal(helpers.hasLocationChanges(saved, { ...saved, latitude: '-34.0240050' }), false);
  assert.equal(helpers.hasLocationChanges(saved, { ...saved, latitude: '-34.024006' }), true);
  assert.equal(helpers.hasLocationChanges(saved, { ...saved, locationText: 'Other farm' }), true);
  assert.equal(helpers.hasLocationChanges(helpers.assetLocationDraft({}), { locationText: '', latitude: '0', longitude: '0' }), true);
});
test('unsaved coordinates do not replace the saved-position display or Maps destination', () => {
  const f = fixture();
  f.setLocation({ ...saved, latitude: '-33' });
  const tree = f.render();
  assert.ok(tree.some(node => node.type === 'strong' && node.props.children === '-34.024005, 22.383826'));
  assert.equal(tree.find(node => node.type === 'a').props.href, 'https://www.google.com/maps?q=-34.024005,22.383826');
});
test('device location is only proposed until the user explicitly saves it', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: { getCurrentPosition: success => success({ coords: { latitude: -33, longitude: 23 } }) } } });
    const f = fixture();
    button(f.render(), 'Use this device').props.onClick();
    assert.equal(f.writes.length, 0);
    assert.equal(f.location().latitude, '-33.000000');
    const tree = f.render();
    assert.ok(tree.some(node => node.props?.role === 'status'));
    const save = button(tree, 'Save GPS location');
    assert.equal(save.props.disabled, false);
    await save.props.onClick();
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0][0].source, 'device');
    assert.equal(f.writes[0][0].latitude, '-33.000000');
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});
test('location save stays disabled for unchanged or invalid coordinates', () => {
  const f = fixture();
  button(f.render(), 'Enter GPS').props.onClick();
  assert.equal(button(f.render(), 'Save GPS location').props.disabled, true);
  f.setLocation({ ...saved, latitude: '95' });
  assert.equal(button(f.render(), 'Save GPS location').props.disabled, true);
  f.setLocation({ ...saved, locationText: 'Updated description' });
  assert.equal(button(f.render(), 'Save GPS location').props.disabled, false);
});
test('the existing leave-page guard includes the separate location draft', () => {
  assert.match(source, /section === 'location' && hasLocationChanges\(assetLocationDraft\(baseline.current\), location\)/);
  assert.match(source, /Discard your unsaved changes\?/);
});

test('leaving a dirty editor can be cancelled; opening Maps in another tab does not discard it', () => {
  const original = Object.fromEntries(['window', 'document', 'Element'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const handlers = {}, removed = [];
  let confirmations = 0, cleanup;
  const address = new URL('https://www.aim4price.com/owner-app/assets/example/manage/location');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: address, confirm: () => { confirmations++; return false; }, addEventListener: (name, handler) => { handlers[name] = handler; }, removeEventListener: name => removed.push(name) } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener: (name, handler) => { handlers[name] = handler; }, removeEventListener: name => removed.push(name) } });
    class Target { constructor(link) { this.link = link; } closest() { return this.link; } }
    Object.defineProperty(globalThis, 'Element', { configurable: true, value: Target });
    const start = source.indexOf('  useEffect(() => {\n    if (!hasUnsavedChanges)');
    const end = source.indexOf('}, [hasUnsavedChanges]);', start) + '}, [hasUnsavedChanges]);'.length;
    new Function('useEffect', 'hasUnsavedChanges', ts.transpileModule(source.slice(start, end), { compilerOptions: options }).outputText)(effect => { cleanup = effect(); }, true);
    const click = (target = '', ctrlKey = false) => {
      const event = { button: 0, ctrlKey, target: new Target({ href: 'https://www.aim4price.com/owner-app', target, hasAttribute: () => false }), prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
      handlers.click(event); return event;
    };
    assert.equal(click().prevented, true);
    assert.equal(confirmations, 1);
    assert.equal(click('_blank').prevented, false);
    assert.equal(click('', true).prevented, false);
    assert.equal(confirmations, 1);
    const unload = { prevented: false, preventDefault() { this.prevented = true; } };
    handlers.beforeunload(unload);
    assert.equal(unload.prevented, true);
    cleanup();
    assert.deepEqual(removed.sort(), ['beforeunload', 'click']);
  } finally {
    for (const [key, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
