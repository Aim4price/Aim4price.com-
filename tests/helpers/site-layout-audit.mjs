import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isNativeWorkspace } from '../../lib/website-canvas.ts';
const require = createRequire(import.meta.url);
export const postcss = require('postcss');
export const typescript = require('typescript');
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const read = (file) => readFile(path.join(root, file), 'utf8');
export async function sourceFiles(directory) {
  const result = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await sourceFiles(file));
    else if (/\.(tsx?|css|m?js)$/.test(file)) result.push(file);
  }
  return result;
}
export function nativeFile(file) {
  return file.startsWith('app/') && isNativeWorkspace(`/${file.slice(4)}`);
}
export async function websiteStylesheets() {
  const files = [...await sourceFiles('app'), ...await sourceFiles('components'), ...await sourceFiles('lib')];
  const available = new Set(files), seen = new Set();
  const pending = files.filter(file => file.startsWith('app/') && !file.startsWith('app/api/') && !nativeFile(file));
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith('.css')) continue;
    for (const match of (await read(file)).matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
      const stem = specifier.startsWith('@/') ? specifier.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const dependency = [stem, ...['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'].map(ext => stem + ext)].find(candidate => available.has(candidate));
      if (dependency) pending.push(dependency);
    }
  }
  return [...seen].filter(file => file.endsWith('.css') && !nativeFile(file));
}
export function assertNoWebsiteReflow(source, file) {
  postcss.parse(source).walkAtRules('media', media => {
    if (!/\b(width|height|orientation)\b/.test(media.params)) return;
    media.walkRules(rule => assert.ok(rule.selector.includes(':not(:has([data-website-canvas]))'), `${file}: ${media.params} must be confined to native workspaces (${rule.selector}).`));
  });
}
