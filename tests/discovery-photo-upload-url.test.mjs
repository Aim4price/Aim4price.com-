import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/asset-discovery.ts', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function internalUploadId('), source.indexOf('function isSafeRemotePhotoUrl('));
const code = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const parse = new Function(`${code}; return internalUploadId;`)();
const ids = ['93de249e-293f-4d12-aef8-420cb8a83f0b', 'bkt-93de249e-293f-4d12-aef8-420cb8a83f0b'];
test('protected Discovery photos resolve relative and first-party absolute upload URLs', () => {
  for (const id of ids) for (const origin of ['', 'https://aim4price.com', 'https://www.aim4price.com']) {
    assert.equal(parse(`${origin}/api/asset-register/uploads/${id}?download=1`), id);
  }
});
test('external hosts and malformed paths never resolve as internal uploads', () => {
  for (const source of ['https://evil.example/api/asset-register/uploads/'+ids[0], 'https://aim4price.com.evil.example/api/asset-register/uploads/'+ids[0], 'http://aim4price.com/api/asset-register/uploads/'+ids[0], '/api/asset-register/uploads/not-an-id', '/api/other/'+ids[0]]) assert.equal(parse(source), '');
});
