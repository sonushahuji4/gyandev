/**
 * Focus + scroll restoration for Astro's `<ClientRouter />`.
 *
 * Responsibilities (per PHASE-1-ROADMAP §2 ratifications):
 *
 * - R1: Read/write the per-pathname scrollY map via `scrollKey()` from
 *   `storage.ts` — NEVER a raw string. The map lives in sessionStorage so it
 *   clears with the tab, matching the browser's native back/forward
 *   restoration window.
 *
 * - R3: On page load, land focus on the fresh `<h1>` (or `<main>` as a
 *   fallback) so screen readers announce the new page. Chapter tab swaps
 *   persist TopNav + breadcrumbs + tab bar but swap the H1 — keeping the
 *   H1 in the swapped content is what makes this work.
 *
 * - Announces the new document title via the polite live region so the
 *   announcement survives reduced-motion contexts and users without
 *   client-side nav animations.
 *
 * Runs once per module load. `<ClientRouter />` keeps module state alive
 * across navigations, so binding the listeners once is correct.
 */

import { get, set, scrollKey, type ScrollData } from '../storage';
import { announce } from './announce';

function readScrollMap(): ScrollData {
  return get<ScrollData>(scrollKey(), 'session') ?? {};
}

function writeScrollMap(map: ScrollData): void {
  set<ScrollData>(scrollKey(), map, 'session');
}

function persistCurrentScroll(): void {
  if (typeof window === 'undefined') return;
  const map = readScrollMap();
  map[window.location.pathname] = window.scrollY;
  writeScrollMap(map);
}

function restoreScroll(): void {
  if (typeof window === 'undefined') return;
  // Anchor navigation (e.g. `/chapter#slug`) should win over the stored
  // scroll — the browser has already aligned to the anchor by the time
  // `astro:page-load` fires, so we skip restoration when a hash is present.
  if (window.location.hash) return;

  const map = readScrollMap();
  const y = map[window.location.pathname];
  if (typeof y === 'number') {
    window.scrollTo({ top: y, left: 0, behavior: 'auto' });
  }
}

function landFocusOnMain(): void {
  if (typeof document === 'undefined') return;
  const main = document.getElementById('main');
  if (!main) return;
  // Prefer the fresh H1 — it matches the page's title and is what the user
  // expects to hear announced.
  const target = main.querySelector<HTMLElement>('h1') ?? main;
  // `tabindex="-1"` lets us focus without adding to the Tab order.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

function install(): void {
  if (typeof document === 'undefined') return;

  // Disable the browser's own scroll restoration so ours is authoritative.
  if ('scrollRestoration' in history) {
    try {
      history.scrollRestoration = 'manual';
    } catch {
      /* not writable on some embeds */
    }
  }

  // Save scroll before any view-transition swap…
  document.addEventListener('astro:before-swap', persistCurrentScroll);
  // …and also on the bfcache-friendly pagehide, for hard nav / close.
  window.addEventListener('pagehide', persistCurrentScroll);

  // After the swap completes, restore scroll, land focus, announce title.
  const onPageLoad = (): void => {
    restoreScroll();
    landFocusOnMain();
    if (document.title) announce(document.title);
  };
  document.addEventListener('astro:page-load', onPageLoad);
  // First load also fires page-load, but fire a synchronous pass too in case
  // the module is imported after the event already dispatched.
  if (document.readyState === 'complete') onPageLoad();
}

install();
