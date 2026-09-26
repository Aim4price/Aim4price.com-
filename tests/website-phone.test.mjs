import assert from 'node:assert/strict';
import test from 'node:test';
import { read, typescript, websiteCanvas } from './helpers/site-layout-audit.mjs';
const source = typescript.transpileModule(await read('lib/website-phone.ts'), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function('require', 'exports', source)(() => websiteCanvas, exports);
const { shouldShowPhoneLandscapeEntry: show, listenToMediaQuery } = exports;
const phone = { width: 390, height: 844, screenWidth: 390, screenHeight: 844, touch: true };

test('orientation survives keyboards, zoom, desktop mode and delayed viewport rotation', () => {
  assert.equal(show(phone), true);
  for (const orientation of ['portrait-primary', 'portrait-secondary']) {
    assert.equal(show({ ...phone, width: 980, height: 400, orientation }), true);
  }
  for (const orientation of ['landscape-primary', 'landscape-secondary']) {
    assert.equal(show({ ...phone, orientation }), false);
  }
  for (const legacyAngle of [0, 180, -180]) assert.equal(show({ ...phone, height: 200, legacyAngle }), true);
  for (const legacyAngle of [90, -90, 270]) assert.equal(show({ ...phone, legacyAngle }), false);
  assert.equal(show({ ...phone, width: 844, height: 390 }), false);
});
test('desktop and tablet touchscreens are excluded; missing screen uses layout viewport', () => {
  assert.equal(show({ ...phone, touch: false }), false);
  assert.equal(show({ ...phone, screenWidth: 768, screenHeight: 1024 }), false);
  assert.equal(show({ ...phone, screenWidth: 1920, screenHeight: 1080 }), false);
  assert.equal(show({ ...phone, screenWidth: 0, screenHeight: 0 }), true);
  assert.equal(show({ ...phone, screenWidth: 0, screenHeight: 0, width: NaN }), false);
});
test('modern and legacy media query subscriptions clean up the exact listener', () => {
  for (const modern of [true, false]) {
    const calls = [];
    const callback = () => {};
    const query = modern ? {
      addEventListener: (...args) => calls.push(args), removeEventListener: (...args) => calls.push(args),
    } : { addListener: (...args) => calls.push(args), removeListener: (...args) => calls.push(args) };
    const stop = listenToMediaQuery(query, callback);
    stop();
    assert.deepEqual(calls, modern ? [['change', callback], ['change', callback]] : [[callback], [callback]]);
  }
  assert.doesNotThrow(() => listenToMediaQuery({}, () => {})());
});
