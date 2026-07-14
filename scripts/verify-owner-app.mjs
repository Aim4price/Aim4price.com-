import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(process.cwd());
const failures = [];
const expectedHashes = new Map([
  ['app/layout.tsx', '056b119fb2a0102a350c58799490508a2c7138cb59a40f392f84fbcadd7204b5'],
  ['app/dealer/layout.tsx', '23f0a63b0cd18c2784c29a9ea970b7c07748cc3ad27d396749d353fadeffe406'],
  ['app/dealer/login/dealer-login-client.tsx', 'f348f42cb021a407c0037a5af6e512d6779ae33d72c6d7ae471dde60659fe280'],
  ['app/dealer/manifest.webmanifest/route.ts', 'e8727d7a3042a63e71e6f9e9992db0f8762d1d33cd6eeaac4404c639e88c7140'],
  ['public/dealer-sw.js', '79356414eb16750e518c46b1de1a52592cca8a80e933b8dbc6eadc30a7a33dcd'],
  ['app/field-manager/layout.tsx', '6cd8d2b14475f806464dc23db49d98132a645444a8cee3a9fef531623b7d2832'],
  ['app/field-manager/field-manager-login-client.tsx', '705bebad18afa417ed70bc6abe12bd02dbbfe06603f1132cf0950e1b15e0531c'],
  ['app/field-manager/manifest.webmanifest/route.ts', '7ce502d2796f7cbc94d7df8c568197aaccb0208f6782533bdb9d346241e787de'],
  ['public/field-manager-sw.js', '6dbc9741b1a7bc36b516e910d5f48c4b4a78809374bfc2d9178b3356588ad4cd'],
]);

function fail(message) { failures.push(message); }
function read(path) { return readFileSync(join(root, path), 'utf8'); }
function hash(path) { return createHash('sha256').update(readFileSync(join(root, path))).digest('hex'); }
function walk(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (['.git', '.next', 'node_modules'].includes(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path)); else files.push(path);
  }
  return files;
}

for (const [path, expected] of expectedHashes) {
  if (!existsSync(join(root, path)) || hash(path) !== expected) fail(`${path} changed from the supplied baseline.`);
}
if (existsSync(join(root, 'app/app'))) fail('Forbidden app/app directory exists.');

const ownerAssetsRoutePath = 'app/api/owner-app/assets/route.ts';
if (!existsSync(join(root, ownerAssetsRoutePath))) {
  fail(`${ownerAssetsRoutePath} is missing.`);
} else {
  const ownerAssetsRoute = read(ownerAssetsRoutePath);
  for (const required of [
    'export async function GET',
    'export async function POST',
    'getOwnerAppAccess',
    'listAllOwnerAppAssets',
  ]) {
    if (!ownerAssetsRoute.includes(required)) fail(`${ownerAssetsRoutePath} lacks ${required}.`);
  }
}

const ownerLayout = read('app/owner-app/layout.tsx');
for (const forbidden of ['AppFooter', 'globals.css', '<html', '<body']) {
  if (ownerLayout.includes(forbidden)) fail(`Owner App layout contains forbidden text: ${forbidden}`);
}
const manifest = read('app/owner-app/manifest.webmanifest/route.ts');
if (!manifest.includes("scope: '/owner-app'")) fail('Owner App manifest scope is not exactly /owner-app.');
if (!manifest.includes("start_url: '/owner-app/login?source=owner-app'")) fail('Owner App start URL is incorrect.');

const worker = read('public/owner-app-sw.js');
if (!worker.includes("requestUrl.pathname === OWNER_APP_ROOT") || !worker.includes("requestUrl.pathname.startsWith(`${OWNER_APP_ROOT}/`)")) {
  fail('Owner App worker lacks an exact-root and slash-bounded path check.');
}
if (worker.includes("pathname.startsWith(OWNER_APP_ROOT)")) fail('Owner App worker uses an unsafe loose prefix.');
if (/cache|caches\.open|push|notification/i.test(worker.replace(/network-only/gi, ''))) fail('Owner App worker contains caching or push behavior.');

const workerListeners = new Map();
runInNewContext(worker, {
  URL,
  fetch: () => Promise.resolve({ ok: true }),
  self: {
    location: { origin: 'https://example.test' },
    skipWaiting() {},
    clients: { claim() {} },
    addEventListener(type, listener) { workerListeners.set(type, listener); },
  },
});
const fetchListener = workerListeners.get('fetch');
if (typeof fetchListener !== 'function') fail('Owner App worker does not register a fetch handler.');
for (const [pathname, shouldHandle] of [
  ['/owner-app', true],
  ['/owner-app/assets', true],
  ['/', false],
  ['/account', false],
  ['/asset-register', false],
  ['/dealer', false],
  ['/field-manager', false],
  ['/owner-application', false],
]) {
  let handled = false;
  fetchListener?.({
    request: { method: 'GET', url: `https://example.test${pathname}` },
    respondWith() { handled = true; },
  });
  if (handled !== shouldHandle) fail(`Owner App worker handling was ${handled} for ${pathname}; expected ${shouldHandle}.`);
}

const sourceFiles = walk(root).filter((path) => /\.(?:js|mjs|ts|tsx)$/.test(path));
for (const absolute of sourceFiles) {
  const path = relative(root, absolute).replaceAll('\\', '/');
  const source = readFileSync(absolute, 'utf8');
  if (path === 'scripts/verify-owner-app.mjs') continue;
  if (source.includes("register('/owner-app-sw.js") && !path.startsWith('app/owner-app/')) {
    fail(`Owner App worker is registered outside app/owner-app: ${path}`);
  }
  if (!path.startsWith('app/owner-app/') && !path.startsWith('app/account/owner-app/') && !path.startsWith('lib/owner-app')) {
    const automaticOwnerNavigation = /(?:router\.(?:push|replace)|window\.location\.(?:replace|assign)|redirect)\(\s*['"`]\/owner-app(?:\/login)?/;
    if (automaticOwnerNavigation.test(source)) fail(`Automatic Owner App navigation exists outside an Owner App route: ${path}`);
  }
  if (/OwnerMobileAppGate|\/app\/login|app\/app/.test(source)) fail(`Forbidden Owner App naming or gate found in ${path}.`);
  const isOwnerAppSource = path.includes('owner-app') || /owner_app_users|aim4price_owner_app/.test(source);
  if (isOwnerAppSource && /password_(?:display|plain)|display_password|plain_password/i.test(source)) fail(`Readable Owner App password field found in ${path}.`);
  if (isOwnerAppSource && /console\.(?:log|info|warn|error)\([^\n]*(?:password|password_hash)/i.test(source)) fail(`Possible Owner App password logging found in ${path}.`);
}

const rootLayout = read('app/layout.tsx');
if (/owner-app|owner app|manifest\.webmanifest|serviceWorker/i.test(rootLayout)) fail('Normal root layout references Owner App behavior.');

if (failures.length) {
  console.error(`Owner App assertions failed (${failures.length}):`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}
console.log('Owner App source assertions passed.');
