/** Only enable the customer handover after a real listing has been published. */
export function chatGptListingUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'chatgpt.com' || url.port ||
        url.username || url.password || url.search || url.hash ||
        !/^\/(apps|plugins)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) return undefined;
    return url.href;
  } catch { return undefined; }
}
