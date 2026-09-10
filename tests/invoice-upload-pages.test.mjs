import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { File } from 'node:buffer';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const exports = {};
const compiled = ts.transpileModule(readFileSync(new URL('../lib/invoice-upload.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, { exports });
const {validateInvoicePages, prepareInvoiceUpload} = exports;
const photo = () => new File(['image'], 'page.png', { type: 'image/png' });
const pdf = () => new File(['%PDF-test'], 'invoice.pdf', { type: 'application/pdf' });

test('one PDF passes through unchanged and photos can be grouped as one invoice', async () => {
  const file = pdf();
  assert.equal(await prepareInvoiceUpload([file]), file);
  assert.equal(validateInvoicePages([photo(), photo()]), null);
});

test('separate PDFs cannot accidentally be grouped as one invoice', async () => {
  await assert.rejects(prepareInvoiceUpload([pdf(), pdf()]), /one PDF/);
  await assert.rejects(prepareInvoiceUpload([pdf(), photo()]), /one PDF/);
});

test('empty, unsupported, oversized and excessive page selections are rejected before processing', () => {
  assert.match(validateInvoicePages([]), /Choose/);
  assert.match(validateInvoicePages([new File([], 'empty.png', {type:'image/png'})]), /between/);
  assert.match(validateInvoicePages([new File(['x'], 'x.html', {type:'text/html'})]), /Only PDF/);
  assert.match(validateInvoicePages(Array.from({length:13}, photo)), /up to 12/);
  assert.match(validateInvoicePages([{type:'image/png',size:13*1024*1024}]), /12 MB/);
  assert.match(validateInvoicePages(Array.from({length:5},()=>({type:'image/png',size:12*1024*1024}))), /48 MB/);
});
