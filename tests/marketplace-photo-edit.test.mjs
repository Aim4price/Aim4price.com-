import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/marketplace-db.ts', import.meta.url), 'utf8');
const start = source.indexOf('  const incomingPhotos = Array.isArray(input.photos)');
const end = source.indexOf("  updateAssignments.push('updated_at = now()');", start);
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
function savedPhotos(input) {
  const values = [], assignments = [];
  new Function('input','row','updateValues','updateAssignments','safeImage','brandKit','toAdBrandSnapshot','mergePhotoLists','buildPhotoList','getWritablePhotoColumns',code)(input, {}, values, assignments, value => value, null, () => null, (...lists) => [...new Set(lists.flat())], () => ['old-a','old-b'], () => ['photo_urls']);
  const assignment = assignments.find(value => value.startsWith('photo_urls'));
  return assignment ? JSON.parse(values[Number(assignment.match(/\$(\d+)/)[1])-1]) : null;
}
test('editing replaces photos, allowing removed photos to stay removed', () => {
  assert.deepEqual(savedPhotos({photos:['old-b','new'],replacePhotos:true}), ['old-b','new']);
});
test('editing can remove the final photo', () => {
  assert.deepEqual(savedPhotos({photos:[],replacePhotos:true}), []);
});
test('existing append callers retain saved photos and omitted photos do not overwrite', () => {
  assert.deepEqual(savedPhotos({photos:['new']}), ['old-a','old-b','new']);
  assert.equal(savedPhotos({}), null);
});
test('replacement rejects more than twelve photos', () => {
  assert.throws(() => savedPhotos({photos:Array.from({length:13},(_,i)=>`photo-${i}`),replacePhotos:true}), /up to 12/);
});
