export const GLOBAL_LOADING_START_EVENT = 'aim4price:global-loading-start';
export const GLOBAL_LOADING_STOP_EVENT = 'aim4price:global-loading-stop';

export type GlobalLoadingEventDetail = {
  key?: string;
};

const GLOBAL_LOADING_DISABLED_PATHS = new Set([
  '/',
  '/valuation',
  '/valuations',
  '/auth',
  '/account',
  '/accounts',
]);

const GLOBAL_LOADING_DISABLED_PREFIXES = [
  '/valuation/',
  '/valuations/',
  '/auth/',
  '/account/',
  '/accounts/',
];

function normalisePathname(pathname: string) {
  const [withoutQuery] = pathname.split('?');
  const [withoutHash] = withoutQuery.split('#');
  const trimmed = withoutHash.trim() || '/';
  const leadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (leadingSlash === '/') {
    return '/';
  }

  return leadingSlash.replace(/\/+$/, '');
}

export function isGlobalLoadingDisabledPath(pathname: string | null | undefined) {
  if (!pathname) {
    return false;
  }

  const normalisedPathname = normalisePathname(pathname);

  return (
    GLOBAL_LOADING_DISABLED_PATHS.has(normalisedPathname) ||
    GLOBAL_LOADING_DISABLED_PREFIXES.some((prefix) => normalisedPathname.startsWith(prefix))
  );
}

export function setGlobalLoading(isLoading: boolean, key = 'app') {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<GlobalLoadingEventDetail>(
      isLoading ? GLOBAL_LOADING_START_EVENT : GLOBAL_LOADING_STOP_EVENT,
      { detail: { key } },
    ),
  );
}
