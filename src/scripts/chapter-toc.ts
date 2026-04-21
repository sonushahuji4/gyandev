/**
 * Right-TOC active-heading highlight + scroll progress bar (PR-5.1,
 * chapter.md §6 Step 20).
 *
 * Mechanics:
 *   - IntersectionObserver watches every H2/H3 inside the chapter
 *     `<main>`. The "topmost visible heading wins" algorithm picks one
 *     active anchor and toggles `aria-current="location"` on the
 *     matching `[data-toc-link]` (in both the right rail and the mobile
 *     bottom-sheet).
 *   - A separate scroll listener (rAF-debounced) writes the scroll
 *     completion ratio into `[data-toc-progress]` width.
 *
 * Re-runs on `astro:page-load` so ClientRouter swaps don't leave a
 * stale observer pointing at the previous page's headings.
 */

let observer: IntersectionObserver | null = null;
let scrollHandler: (() => void) | null = null;
let observedHeadings: HTMLElement[] = [];

function reset(): void {
  observer?.disconnect();
  observer = null;
  observedHeadings = [];
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }
}

function tocLinksFor(slug: string): HTMLAnchorElement[] {
  return Array.from(
    document.querySelectorAll<HTMLAnchorElement>(`[data-toc-link][href="#${CSS.escape(slug)}"]`),
  );
}

function clearActiveLinks(): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-toc-link][aria-current="location"]')) {
    a.removeAttribute('aria-current');
  }
}

function setActiveSlug(slug: string | null): void {
  clearActiveLinks();
  if (!slug) return;
  for (const link of tocLinksFor(slug)) {
    link.setAttribute('aria-current', 'location');
  }
}

function pickActiveHeading(entries: IntersectionObserverEntry[]): HTMLElement | null {
  // Maintain a "currently intersecting" set across observer callbacks; the
  // topmost element wins so the active link travels naturally with scroll.
  for (const entry of entries) {
    const el = entry.target as HTMLElement;
    if (entry.isIntersecting) el.dataset.tocVisible = 'true';
    else delete el.dataset.tocVisible;
  }
  let topmost: HTMLElement | null = null;
  let topmostY = Infinity;
  for (const h of observedHeadings) {
    if (h.dataset.tocVisible !== 'true') continue;
    const rect = h.getBoundingClientRect();
    if (rect.top < topmostY) {
      topmost = h;
      topmostY = rect.top;
    }
  }
  return topmost;
}

function bindObserver(main: HTMLElement): void {
  const headings = Array.from(
    main.querySelectorAll<HTMLElement>('h2[id], h3[id]'),
  );
  if (headings.length === 0) return;
  observedHeadings = headings;

  observer = new IntersectionObserver(
    (entries) => {
      const active = pickActiveHeading(entries);
      const slug = active?.id ?? null;
      setActiveSlug(slug);
    },
    {
      // Heading is "active" once it's about 30% from the top — feels right
      // as the heading enters the upper-third reading area.
      rootMargin: '-30% 0px -60% 0px',
      threshold: [0, 1],
    },
  );

  for (const h of headings) observer.observe(h);
}

function bindScrollProgress(): void {
  const fills = document.querySelectorAll<HTMLElement>('[data-toc-progress]');
  if (fills.length === 0) return;

  let frame: number | null = null;
  const update = (): void => {
    frame = null;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    const pct = `${(ratio * 100).toFixed(2)}%`;
    for (const fill of fills) fill.style.width = pct;
  };
  update();

  scrollHandler = (): void => {
    if (frame !== null) return;
    frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });
}

function run(): void {
  reset();
  const main = document.getElementById('main');
  if (!main || main.dataset.page !== 'chapter') return;
  bindObserver(main);
  bindScrollProgress();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', reset);
}
