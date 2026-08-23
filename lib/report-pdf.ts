import { existsSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser, type HTTPRequest, type Page } from 'puppeteer-core';
import { buildBrandedReportPdfFromHtml } from './branded-report-pdf';

const DEFAULT_RENDER_TIMEOUT_MS = 45_000;
const RESOURCE_SETTLE_TIMEOUT_MS = 12_000;
const CLEANUP_TIMEOUT_MS = 5_000;

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(maximum, parsed)) : fallback;
}

const MAX_CONCURRENT_RENDERS = boundedInteger(process.env.REPORT_PDF_MAX_CONCURRENCY, 1, 2);
const MAX_QUEUED_RENDERS = boundedInteger(process.env.REPORT_PDF_MAX_QUEUE, 6, 20);

type BrowserState = {
  promise: Promise<Browser> | null;
};

type RenderPermit = () => void;

type RenderWaiter = {
  settled: boolean;
  resolve: (release: RenderPermit) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

type RenderSemaphoreState = {
  active: number;
  queue: RenderWaiter[];
};

type ReportPdfGlobal = typeof globalThis & {
  __aim4priceReportPdfBrowser?: BrowserState;
  __aim4priceReportPdfSemaphore?: RenderSemaphoreState;
};

export type RenderReportPdfOptions = {
  baseUrl?: string;
  cookie?: string;
  timeoutMs?: number;
};

const reportPdfGlobal = globalThis as ReportPdfGlobal;
const browserState = reportPdfGlobal.__aim4priceReportPdfBrowser ?? { promise: null };
const semaphoreState = reportPdfGlobal.__aim4priceReportPdfSemaphore ?? { active: 0, queue: [] };

if (!reportPdfGlobal.__aim4priceReportPdfBrowser) {
  reportPdfGlobal.__aim4priceReportPdfBrowser = browserState;
}

if (!reportPdfGlobal.__aim4priceReportPdfSemaphore) {
  reportPdfGlobal.__aim4priceReportPdfSemaphore = semaphoreState;
}

class ReportPdfTimeoutError extends Error {
  readonly code = 'REPORT_PDF_TIMEOUT';
}

function timeoutError(label: string, timeoutMs: number): Error {
  return new ReportPdfTimeoutError(`${label} timed out after ${timeoutMs}ms.`);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof ReportPdfTimeoutError
    || (error instanceof Error && (error.name === 'TimeoutError' || /timed?\s*out/i.test(error.message)));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function createRenderPermit(): RenderPermit {
  let released = false;

  return () => {
    if (released) return;
    released = true;
    semaphoreState.active = Math.max(0, semaphoreState.active - 1);

    while (semaphoreState.queue.length) {
      const waiter = semaphoreState.queue.shift();
      if (!waiter || waiter.settled) continue;
      waiter.settled = true;
      if (waiter.timer) clearTimeout(waiter.timer);
      semaphoreState.active += 1;
      waiter.resolve(createRenderPermit());
      break;
    }
  };
}

async function acquireRenderPermit(timeoutMs: number): Promise<RenderPermit> {
  if (semaphoreState.active < MAX_CONCURRENT_RENDERS) {
    semaphoreState.active += 1;
    return createRenderPermit();
  }

  if (semaphoreState.queue.length >= MAX_QUEUED_RENDERS) {
    throw new Error('The report PDF renderer is busy. Please try again shortly.');
  }

  return new Promise<RenderPermit>((resolve, reject) => {
    const waiter: RenderWaiter = {
      settled: false,
      resolve,
      reject,
      timer: null,
    };

    waiter.timer = setTimeout(() => {
      if (waiter.settled) return;
      waiter.settled = true;
      const index = semaphoreState.queue.indexOf(waiter);
      if (index >= 0) semaphoreState.queue.splice(index, 1);
      reject(timeoutError('Report render queue', timeoutMs));
    }, timeoutMs);
    waiter.timer.unref?.();
    semaphoreState.queue.push(waiter);
  });
}

function normaliseBaseUrl(value: string | undefined): string {
  if (!value) return '';

  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || isPrivateNetworkHostname(url.hostname)) return '';
    url.username = '';
    url.password = '';
    if (url.hostname.endsWith('.')) url.hostname = normaliseHostname(url.hostname);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Keeps the canonical report markup and styles intact while removing every
 * script. Reports are static documents; scripts are unnecessary for the PDF
 * and must not run while saved image/font resources are loaded server-side.
 */
export function prepareReportHtmlForPdf(html: string, baseUrl?: string): string {
  const withoutScripts = String(html ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const resolvedBaseUrl = normaliseBaseUrl(baseUrl);

  if (!resolvedBaseUrl || /<base\b/i.test(withoutScripts)) {
    return withoutScripts;
  }

  const baseTag = `<base href="${resolvedBaseUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`;

  if (/<head\b[^>]*>/i.test(withoutScripts)) {
    return withoutScripts.replace(/<head\b[^>]*>/i, (head) => `${head}\n    ${baseTag}`);
  }

  return `${baseTag}\n${withoutScripts}`;
}

async function launchReportBrowser(): Promise<Browser> {
  const sparticuzFontConfigPath = resolve(tmpdir(), 'fonts');
  if (
    process.env.FONTCONFIG_PATH === sparticuzFontConfigPath
    && existsSync('/etc/fonts/fonts.conf')
  ) {
    process.env.FONTCONFIG_PATH = '/etc/fonts';
  }

  const configuredExecutablePath = String(
    process.env.PUPPETEER_EXECUTABLE_PATH
      ?? process.env.CHROME_EXECUTABLE_PATH
      ?? '',
  ).trim();
  const defaultCachedExecutablePath = resolve(tmpdir(), 'chromium');

  async function executableIsEmpty(executablePath: string): Promise<boolean> {
    const details = await stat(executablePath).catch(() => null);
    return !details?.isFile() || details.size === 0;
  }

  async function resolveExecutablePath(): Promise<string> {
    if (configuredExecutablePath) {
      if (await executableIsEmpty(configuredExecutablePath)) {
        throw new Error('The configured Chromium executable is missing or empty.');
      }
      return configuredExecutablePath;
    }

    let executablePath = await chromium.executablePath();
    if (resolve(executablePath) === defaultCachedExecutablePath && await executableIsEmpty(executablePath)) {
      await unlink(defaultCachedExecutablePath).catch(() => undefined);
      executablePath = await chromium.executablePath();
    }

    if (await executableIsEmpty(executablePath)) {
      throw new Error('The Chromium executable is missing or empty.');
    }

    return executablePath;
  }

  let executablePath = await resolveExecutablePath();

  const launch = () => puppeteer.launch({
    args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    defaultViewport: {
      width: 1_440,
      height: 900,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true,
    },
    executablePath,
    headless: 'shell',
  });

  try {
    return await launch();
  } catch (error) {
    if (
      configuredExecutablePath
      || resolve(executablePath) !== defaultCachedExecutablePath
      || !(await executableIsEmpty(executablePath))
    ) throw error;

    await unlink(defaultCachedExecutablePath).catch(() => undefined);
    executablePath = await resolveExecutablePath();
    return launch();
  }
}

async function getReportBrowser(): Promise<Browser> {
  if (browserState.promise) {
    try {
      const browser = await browserState.promise;
      if (browser.connected) return browser;
    } catch {
      // A failed launch is cleared below so the next request can retry.
    }

    browserState.promise = null;
  }

  const launchPromise = launchReportBrowser();
  browserState.promise = launchPromise;

  try {
    const browser = await launchPromise;
    browser.once('disconnected', () => {
      if (browserState.promise === launchPromise) browserState.promise = null;
    });
    return browser;
  } catch (error) {
    if (browserState.promise === launchPromise) browserState.promise = null;
    throw error;
  }
}

async function recycleReportBrowser(browser: Browser | null = null): Promise<void> {
  const cachedPromise = browserState.promise;
  browserState.promise = null;
  const browserPromise = browser ? Promise.resolve(browser) : cachedPromise;
  if (!browserPromise) return;

  try {
    const resolvedBrowser = await withTimeout(browserPromise, CLEANUP_TIMEOUT_MS, 'Report browser cleanup');
    if (!resolvedBrowser.connected) return;

    try {
      await withTimeout(resolvedBrowser.close(), CLEANUP_TIMEOUT_MS, 'Report browser close');
    } catch {
      resolvedBrowser.process()?.kill('SIGKILL');
      if (resolvedBrowser.connected) resolvedBrowser.disconnect();
    }
  } catch {
    void browserPromise.then((lateBrowser) => {
      if (!lateBrowser.connected) return;
      void withTimeout(lateBrowser.close(), CLEANUP_TIMEOUT_MS, 'Late report browser close').catch(() => {
        lateBrowser.process()?.kill('SIGKILL');
        if (lateBrowser.connected) lateBrowser.disconnect();
      });
    }).catch(() => undefined);
  }
}

async function waitForReportResources(page: Page): Promise<void> {
  await page.evaluate(async (timeoutMs) => {
    const settle = new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    });
    const images = Array.from(document.images ?? []);
    const imagesReady = Promise.all(images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      }

      if (typeof image.decode === 'function') {
        await image.decode().catch(() => undefined);
      }
    }));
    const fontsReady = document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();

    await Promise.race([
      Promise.all([imagesReady, fontsReady]).then(() => undefined),
      settle,
    ]);
  }, RESOURCE_SETTLE_TIMEOUT_MS);
}

function normaliseHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/g, '');
}

function ipv4Octets(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((part) => part >= 0 && part <= 255) ? octets : null;
}

function mappedIpv4Octets(value: string): number[] | null {
  const mapped = value.match(/^(?:::ffff:|0:0:0:0:0:ffff:)(.+)$/i)?.[1];
  if (!mapped) return null;
  const dotted = ipv4Octets(mapped);
  if (dotted) return dotted;

  const groups = mapped.split(':');
  if (groups.length !== 2 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  return [high >>> 8, high & 0xff, low >>> 8, low & 0xff];
}

function isNonPublicIpv4(octets: number[]): boolean {
  const [first, second, third] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && third === 0)
    || (first === 192 && second === 0 && third === 2)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224;
}

function isPrivateNetworkHostname(hostname: string): boolean {
  const value = normaliseHostname(hostname);
  if (
    value === 'localhost'
    || value === '0.0.0.0'
    || value === '::1'
    || value.endsWith('.local')
    || value.endsWith('.internal')
  ) return true;

  const ipv4 = ipv4Octets(value) ?? mappedIpv4Octets(value);
  if (ipv4) return isNonPublicIpv4(ipv4);

  return value === '::'
    || /^(?:fc|fd|fe8|fe9|fea|feb|fec|fed|fee|fef|ff)/i.test(value)
    || /^2001:db8(?::|$)/i.test(value);
}

const BUILT_IN_RESOURCE_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const BUILT_IN_RESOURCE_SUFFIXES = ['.amazonaws.com', '.cloudfront.net'];

function configuredResourceHosts(): Set<string> {
  return new Set(
    String(process.env.REPORT_PDF_RESOURCE_HOSTS ?? '')
      .split(',')
      .map((host) => normaliseHostname(host.trim().replace(/^\.+/, '')))
      .filter((host) => /^[a-z0-9.-]+$/.test(host) && !isPrivateNetworkHostname(host)),
  );
}

type ReportResourcePolicy = {
  allowed: boolean;
  sameOrigin: boolean;
};

export function isAllowedReportPdfResourceUrl(value: string, baseUrl?: string): boolean {
  try {
    const url = new URL(value, normaliseBaseUrl(baseUrl) || undefined);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return true;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (url.username || url.password || isPrivateNetworkHostname(url.hostname)) return false;

    const safeBaseUrl = normaliseBaseUrl(baseUrl);
    const baseOrigin = safeBaseUrl ? new URL(safeBaseUrl).origin : '';
    const sameOrigin = Boolean(baseOrigin) && url.origin === baseOrigin;
    const hostname = normaliseHostname(url.hostname);
    const explicitlyConfigured = configuredResourceHosts().has(hostname);
    const trustedStorage = BUILT_IN_RESOURCE_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    const trustedFont = BUILT_IN_RESOURCE_HOSTS.has(hostname);
    return sameOrigin || explicitlyConfigured || trustedStorage || trustedFont;
  } catch {
    return false;
  }
}

function reportResourcePolicy(request: HTTPRequest, baseOrigin: string): ReportResourcePolicy {
  const resourceType = request.resourceType();
  if (!['image', 'font', 'stylesheet'].includes(resourceType)) return { allowed: false, sameOrigin: false };

  try {
    const url = new URL(request.url());
    const sameOrigin = Boolean(baseOrigin) && url.origin === baseOrigin;

    return {
      allowed: isAllowedReportPdfResourceUrl(url.toString(), baseOrigin),
      sameOrigin,
    };
  } catch {
    return { allowed: false, sameOrigin: false };
  }
}

async function renderReportHtmlToPdfWithChromium(
  html: string,
  options: RenderReportPdfOptions = {},
): Promise<Buffer> {
  const timeoutMs = Math.max(5_000, options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS);
  const safeBaseUrl = normaliseBaseUrl(options.baseUrl);
  const baseOrigin = safeBaseUrl ? new URL(safeBaseUrl).origin : '';
  const sameOriginCookie = String(options.cookie ?? '').replace(/[\r\n]/g, '').trim();
  const releasePermit = await acquireRenderPermit(timeoutMs);
  let browser: Browser | null = null;
  let page: Page | null = null;
  let shouldRecycleBrowser = false;

  try {
    browser = await withTimeout(getReportBrowser(), timeoutMs, 'Report browser launch');
    page = await withTimeout(browser.newPage(), timeoutMs, 'Report page creation');
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);
    // Canonical reports are static HTML. Disabling page JavaScript also blocks
    // inline event handlers if a malformed client payload reaches this layer;
    // Puppeteer's own page.evaluate calls still work for resource settling.
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const policy = reportResourcePolicy(request, baseOrigin);
      let operation: Promise<void>;

      if (policy.allowed) {
        const headers = { ...request.headers() };
        delete headers.cookie;
        delete headers.authorization;
        delete headers['proxy-authorization'];
        if (policy.sameOrigin && sameOriginCookie) headers.cookie = sameOriginCookie;
        operation = request.continue({ headers });
      } else {
        operation = request.abort('blockedbyclient');
      }

      void operation.catch(() => undefined);
    });
    await page.emulateMediaType('print');
    await withTimeout(
      page.setContent(prepareReportHtmlForPdf(html, safeBaseUrl), {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      }),
      timeoutMs,
      'Report HTML loading',
    );
    await withTimeout(waitForReportResources(page), timeoutMs, 'Report fonts and images');

    const pdf = await withTimeout(
      page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        waitForFonts: false,
      }),
      timeoutMs,
      'Report PDF rendering',
    );
    const buffer = Buffer.from(pdf);

    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Chromium returned an invalid PDF document.');
    }

    return buffer;
  } catch (error) {
    shouldRecycleBrowser = isTimeoutError(error);
    throw error;
  } finally {
    if (page && !page.isClosed()) {
      try {
        await withTimeout(page.close(), CLEANUP_TIMEOUT_MS, 'Report page close');
      } catch {
        shouldRecycleBrowser = true;
      }
    }

    if (shouldRecycleBrowser) await recycleReportBrowser(browser);
    releasePermit();
  }
}

/**
 * Chromium preserves the canonical HTML/CSS report byte-for-byte and remains
 * the primary renderer. Some production containers cannot start the bundled
 * headless binary (or can temporarily exhaust its queue), so every normal and
 * shared PDF route also has one common, dependency-free fallback. Keeping the
 * fallback here is important: share flows receive the exact same artifact as
 * the normal report endpoint instead of rebuilding a second share-only PDF.
 */
export async function renderReportHtmlToPdf(
  html: string,
  options: RenderReportPdfOptions = {},
): Promise<Buffer> {
  try {
    return await renderReportHtmlToPdfWithChromium(html, options);
  } catch (error) {
    console.warn('Chromium report rendering failed; using the common PDF fallback.', error);
    const fallback = buildBrandedReportPdfFromHtml(html, {
      subtitle: 'Prepared from the standard Aim4price report',
    });

    if (fallback.length < 5 || fallback.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw error;
    }

    return fallback;
  }
}

export async function closeReportPdfBrowser(): Promise<void> {
  await recycleReportBrowser();
}
