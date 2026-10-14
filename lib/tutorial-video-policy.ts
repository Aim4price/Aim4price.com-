export const MAX_TUTORIAL_VIDEO_BYTES = 100 * 1024 * 1024;
export function tutorialVideoType(bytes: Uint8Array): 'video/mp4' | 'video/webm' | null {
  if(bytes.length >= 12 && String.fromCharCode(...bytes.slice(4,8)) === 'ftyp') return 'video/mp4';
  if(bytes.length >= 4 && bytes[0]===0x1a && bytes[1]===0x45 && bytes[2]===0xdf && bytes[3]===0xa3) return 'video/webm';
  return null;
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
