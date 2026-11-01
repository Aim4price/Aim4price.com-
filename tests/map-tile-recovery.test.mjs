import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../lib/map-tile-recovery.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { watchMapTileFailures } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function fixture() {
  const listeners = new Map();
  let recoveries = 0;
  watchMapTileFailures({ on: (event, fn) => listeners.set(event, fn) }, () => { recoveries++; });
  return { emit: (event) => listeners.get(event)(), count: () => recoveries };
}
test('one intermittent tile failure does not switch a working map', () => {
  const map = fixture();
  for (const event of ['loading', 'tileload', 'tileerror', 'load']) map.emit(event);
  assert.equal(map.count(), 0);
});
test('repeated failures trigger one recovery without retrying requests', () => {
  const map = fixture();
  map.emit('loading');
  for (let i = 0; i < 20; i++) map.emit('tileerror');
  map.emit('load');
  assert.equal(map.count(), 1);
});
test('small completely failed viewport recovers and new loads reset counts', () => {
  const map = fixture();
  for (const event of ['loading', 'tileerror', 'load']) map.emit(event);
  assert.equal(map.count(), 1);
  for (const event of ['loading', 'tileload', 'load']) map.emit(event);
  assert.equal(map.count(), 1);
  for (const event of ['loading', 'tileerror', 'load']) map.emit(event);
  assert.equal(map.count(), 2);
});
