/** Smoothly scroll an element into view with easing and a sticky-header offset. */
export function smoothScrollToId(id: string, offset = 84): void {
  const el = document.getElementById(id);
  if (!el) return;

  const startY = window.scrollY;
  const targetY = el.getBoundingClientRect().top + window.scrollY - offset;
  const dist = targetY - startY;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || Math.abs(dist) < 4) {
    window.scrollTo(0, targetY);
    return;
  }

  // Distance-aware duration so short hops aren't sluggish and long ones aren't abrupt.
  const duration = Math.min(1100, Math.max(480, Math.abs(dist) * 0.5));
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let start: number | null = null;
  function step(ts: number) {
    if (start === null) start = ts;
    const p = Math.min(1, (ts - start) / duration);
    window.scrollTo(0, startY + dist * easeInOutCubic(p));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
