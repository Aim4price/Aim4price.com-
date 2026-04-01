import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const standaloneDir = '.next/standalone';
const staticDir = '.next/static';

if (!existsSync(standaloneDir)) {
  console.warn('Standalone output was not found. Skipping asset copy step.');
  process.exit(0);
}

if (existsSync('public')) {
  cpSync('public', join(standaloneDir, 'public'), { recursive: true });
}

if (existsSync(staticDir)) {
  mkdirSync(join(standaloneDir, '.next'), { recursive: true });
  cpSync(staticDir, join(standaloneDir, '.next', 'static'), { recursive: true });
}

console.log('Copied public and .next/static into .next/standalone.');
