/**
 * Programmatic screen-reader announcements via the singleton LiveRegion.
 *
 * Writes to `<div id="a11y-announcer" aria-live="…">`. Two politeness levels:
 *   - default (polite): waits for the reader to finish its current utterance.
 *   - assertive: interrupts the reader. Reserve for errors / urgent state.
 *
 * Empty-then-set: we clear the node first and set the message on a microtask
 * so assistive tech treats repeated identical messages as new announcements.
 *
 * Consumers: ThemeToggle ("Dark mode on"), chapter hydrate ("Bookmark added"),
 * view-transition-a11y ("<page title>"), SearchModal open/close, etc.
 */

const ANNOUNCER_ID = 'a11y-announcer';

export interface AnnounceOptions {
  assertive?: boolean;
}

export function announce(message: string, opts: AnnounceOptions = {}): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(ANNOUNCER_ID);
  if (!el) return;

  el.setAttribute('aria-live', opts.assertive ? 'assertive' : 'polite');
  el.textContent = '';
  queueMicrotask(() => {
    el.textContent = message;
  });
}
