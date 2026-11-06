// A 10,000-asset confirmation exceeds the shared small-form body limit.
// Bound bytes while reading, including when Content-Length is omitted or wrong.
export const ANNUAL_REVIEW_BODY_LIMIT = 2_000_000;
export async function readAnnualReviewBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') || 0) > ANNUAL_REVIEW_BODY_LIMIT) {
    throw new Error('This request is too large.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid review request.');
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ANNUAL_REVIEW_BODY_LIMIT) {
        await reader.cancel();
        throw new Error('This request is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new Error('Invalid review request.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid review request.');
  return body as Record<string, unknown>;
}
