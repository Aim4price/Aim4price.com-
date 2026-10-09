/** Repair sticky positioning when a browser scrolls the zoomed stage out of view. */
export function homeStoryPositionCorrection(
  sectionTop: number,
  travel: number,
  stickyTop: number,
  renderedTop: number,
  previousCorrection: number,
  scale: number,
): number {
  const offset = Math.max(0, Math.min(travel, stickyTop - sectionTop));
  const expectedTop = sectionTop + offset;
  const naturalTop = renderedTop - previousCorrection * scale;
  const correction = (expectedTop - naturalTop) / scale;
  return Math.abs(correction) < 1 ? 0 : correction;
}

/** Small canvas scales can end the document before the nominal story track ends. */
export function homeStoryScrollTravel(travel: number, trackStart: number): number {
  const available = document.documentElement.scrollHeight - window.innerHeight - trackStart;
  return Math.max(1, Math.min(travel, Number.isFinite(available) ? available : travel));
}
