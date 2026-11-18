/** Accept a YouTube video URL or its copied iframe. Only the video ID is retained. */
export function youtubeEmbed(input: string): string | null {
  const text = input.trim();
  if (!text || text.length > 4096) return null;
  const iframe = /^<iframe\b[^>]*?\ssrc\s*=\s*(["'])([^"']+)\1[^>]*>\s*<\/iframe>$/i.exec(text);
  try {
    const url = new URL(iframe ? iframe[2] : text);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname;
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v')
        : /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export function videoByteRange(header:string|null,size:number): {start:number;end:number}|null {
  if(!header) return {start:0,end:size-1};
  const m=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!m || (!m[1]&&!m[2]))return null;
  const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
  const end=m[1]?(m[2]?Math.min(Number(m[2]),size-1):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
  return {start,end};
}
