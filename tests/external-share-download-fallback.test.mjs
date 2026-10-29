import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8');

test('every prepared attachment has a download, including selections below the PDF threshold', () => {
  assert.match(component, /preparation\.status === 'ready'\s*\? preparation\.files\.map/);
  assert.match(component, /downloadFiles\.map\([\s\S]*?href=\{url\} download=\{file\.name\}/);
  assert.doesNotMatch(component, /usePdf && pdfUrl/);
  assert.match(component, /downloads\.forEach\(\(\{url\}\) => URL\.revokeObjectURL\(url\)\)/);
});

test('downloads require current consent and ready files, but do not require native sharing to fail first', () => {
  assert.match(component, /\{accepted && pendingShare\.key === consentKey && !isPreparing && preparation\.status === 'ready' && downloadFiles\.length > 0 && <div/);
  assert.match(component, /href=\{pendingShare\.target === 'email' \? emailHref : whatsappHref\}/);
  assert.match(component, /Downloaded files are not attached automatically/);
  assert.match(component, /navigator\.canShare\(shareData\)/);
  assert.match(component, /await navigator\.share\(shareData\)/);
});
