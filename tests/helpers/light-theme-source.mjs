import { readFileSync as read } from 'node:fs';

/** Existing design assertions describe the light theme. Resolve only the app
 * theme's explicit fallbacks, keeping their original values and assertions.
 * Browser tests and app-theme.test.mjs exercise the dark values separately. */
export function lightThemeSource(source) {
  let value = source;
  const prefix = /var\(--app-[\w-]+\s*,/g;
  let match;
  while ((match = prefix.exec(value))) {
    const start = prefix.lastIndex;
    let end = start, depth = 1;
    while (end < value.length && depth) {
      if (value[end] === '(') depth++;
      if (value[end] === ')') depth--;
      end++;
    }
    if (depth) throw new Error('Unbalanced app theme fallback');
    value = value.slice(0, match.index) + value.slice(start, end - 1).trimStart() + value.slice(end);
    prefix.lastIndex = match.index;
  }
  return value;
}

export function readFileSync(path, options) {
  const content = read(path, options);
  return String(path).endsWith('.css') && typeof content === 'string' ? lightThemeSource(content) : content;
}

export async function readFile(path, options) {
  const { readFile: readAsync } = await import('node:fs/promises');
  const content = await readAsync(path, options);
  return String(path).endsWith('.css') && typeof content === 'string' ? lightThemeSource(content) : content;
}
