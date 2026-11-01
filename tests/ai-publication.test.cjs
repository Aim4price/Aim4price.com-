const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = {exports:{}};
new Function('exports', ts.transpileModule(fs.readFileSync('lib/ai-connection/publication.ts','utf8'), {
 compilerOptions:{module:ts.ModuleKind.CommonJS}
}).outputText)(mod.exports);
const {chatGptListingUrl} = mod.exports;
test('listing handover accepts only actual ChatGPT listing paths', () => {
 for (const value of [undefined,'','https://chatgpt.com/','https://chatgpt.com/plugins',
 'https://chatgpt.com.evil.test/plugins/app','https://evil.test/plugins/app',
 'http://chatgpt.com/plugins/app','https://user:secret@chatgpt.com/plugins/app',
 'https://chatgpt.com/plugins/app?redirect=evil','https://chatgpt.com/plugins/app#secret',
 'https://chatgpt.com:444/plugins/app','https://www.aim4price.com/api/ai/mcp']) {
  assert.equal(chatGptListingUrl(value), undefined, value);
 }
 assert.equal(chatGptListingUrl('https://chatgpt.com/plugins/aim4price_123'), 'https://chatgpt.com/plugins/aim4price_123');
 assert.equal(chatGptListingUrl('https://chatgpt.com/apps/aim4price-123'), 'https://chatgpt.com/apps/aim4price-123');
});
