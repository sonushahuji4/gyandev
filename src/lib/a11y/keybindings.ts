/**
 * Global keyboard shortcut manager.
 *
 * One module owns the `keydown` listener and dispatches to registered
 * bindings — prevents the "every component attaches its own keydown" drift
 * and gives us one place to document + govern the shortcut surface.
 *
 * Default bindings (auto-registered when this module is first imported):
 *
 *   ⌘K / Ctrl+K    open `#search-modal`
 *   /              open `#search-modal`
 *   Escape         close the topmost open `<dialog>`
 *   ArrowLeft      prev chapter (only on chapter routes)
 *   ArrowRight     next chapter (only on chapter routes)
 *
 * Guard: if focus is inside `<input>` / `<textarea>` / `contenteditable`, we
 * ignore all bindings except `Escape` so typing never gets hijacked. Also,
 * bindings that depend on page context check
 * `document.getElementById('main')?.dataset.page === '<scope>'` — pages opt
 * in by setting `data-page="chapter"` etc. on the `<main>` landmark.
 */

export interface Binding {
  /** Key spec — e.g. `'Mod+K'`, `'Escape'`, `'/'`, `'ArrowLeft'`. */
  keys: string;
  /** Optional gate — binding only fires when this returns true. */
  when?: () => boolean;
  /** Handler. Called with the original event; `preventDefault()` is applied for us. */
  run: (e: KeyboardEvent) => void;
  /** Keep default browser behavior even when this binding runs. Default false. */
  passthrough?: boolean;
}

const bindings: Binding[] = [];

export function registerBinding(binding: Binding): () => void {
  bindings.push(binding);
  return () => {
    const idx = bindings.indexOf(binding);
    if (idx !== -1) bindings.splice(idx, 1);
  };
}

/** Test seam — primarily so unit tests can reset between cases. */
export function _resetBindingsForTest(): void {
  bindings.length = 0;
}

// ---------------------------------------------------------------------------
// Key-spec parser
// ---------------------------------------------------------------------------

interface ParsedKey {
  mod: boolean;          // `Mod` — Cmd on macOS, Ctrl elsewhere
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;           // canonical event.key
}

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

function parseKey(spec: string): ParsedKey {
  const parts = spec.split('+').map((p) => p.trim());
  const parsed: ParsedKey = {
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
    key: '',
  };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'mod') parsed.mod = true;
    else if (lower === 'ctrl' || lower === 'control') parsed.ctrl = true;
    else if (lower === 'cmd' || lower === 'meta') parsed.meta = true;
    else if (lower === 'alt' || lower === 'option') parsed.alt = true;
    else if (lower === 'shift') parsed.shift = true;
    else parsed.key = part;
  }
  return parsed;
}

function matches(event: KeyboardEvent, spec: string): boolean {
  const p = parseKey(spec);
  const modActive = p.mod ? (IS_MAC ? event.metaKey : event.ctrlKey) : true;
  const ctrlOk = p.mod ? modActive : event.ctrlKey === p.ctrl;
  const metaOk = p.mod ? modActive : event.metaKey === p.meta;
  const altOk = event.altKey === p.alt;
  const shiftOk = event.shiftKey === p.shift;

  // Loose key comparison — case-insensitive for letters; exact for named keys.
  const expected = p.key;
  const actual = event.key;
  const keyOk =
    expected.length === 1
      ? expected.toLowerCase() === actual.toLowerCase()
      : expected === actual;

  return keyOk && altOk && shiftOk && (p.mod ? modActive : ctrlOk && metaOk);
}

// ---------------------------------------------------------------------------
// Editable-target guard
// ---------------------------------------------------------------------------

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// ---------------------------------------------------------------------------
// Page-context helpers (bindings use these in their `when` gates).
// ---------------------------------------------------------------------------

export function currentPageScope(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.getElementById('main')?.dataset.page;
}

export function topmostOpenDialog(): HTMLDialogElement | null {
  if (typeof document === 'undefined') return null;
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  return open.length ? open[open.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Default bindings (registered on module init in the browser only).
// ---------------------------------------------------------------------------

function openSearchModal(): void {
  const modal = document.getElementById('search-modal');
  if (modal && 'showModal' in modal && typeof (modal as HTMLDialogElement).showModal === 'function') {
    // Don't stack open dialogs — if already open, no-op.
    if (!(modal as HTMLDialogElement).open) (modal as HTMLDialogElement).showModal();
  }
}

function closeTopDialog(): boolean {
  const top = topmostOpenDialog();
  if (top) {
    top.close();
    return true;
  }
  return false;
}

function navigateChapter(direction: 'prev' | 'next'): void {
  const main = document.getElementById('main');
  if (!main || main.dataset.page !== 'chapter') return;
  const selector =
    direction === 'prev'
      ? '[data-chapter-prev] a[href], a[data-chapter-prev][href]'
      : '[data-chapter-next] a[href], a[data-chapter-next][href]';
  const link = document.querySelector<HTMLAnchorElement>(selector);
  if (link) link.click();
}

function registerDefaults(): void {
  registerBinding({
    keys: 'Mod+K',
    run: () => openSearchModal(),
  });
  registerBinding({
    keys: '/',
    run: () => openSearchModal(),
  });
  registerBinding({
    keys: 'Escape',
    run: () => closeTopDialog(),
    passthrough: true, // let native `<dialog>` Esc handling still run
  });
  registerBinding({
    keys: 'ArrowLeft',
    when: () => currentPageScope() === 'chapter',
    run: () => navigateChapter('prev'),
  });
  registerBinding({
    keys: 'ArrowRight',
    when: () => currentPageScope() === 'chapter',
    run: () => navigateChapter('next'),
  });
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

let installed = false;

export function installKeybindings(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  registerDefaults();

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const editable = isEditable(event.target);
    // Even in editable targets, Esc must still close overlays.
    if (editable && event.key !== 'Escape') return;

    for (const binding of bindings) {
      if (!matches(event, binding.keys)) continue;
      if (binding.when && !binding.when()) continue;
      if (!binding.passthrough) event.preventDefault();
      binding.run(event);
      return;
    }
  });

  // Restore focus to the trigger when a dialog closes (Safari reliability —
  // native `<dialog>` should do this but doesn't always).
  document.addEventListener(
    'close',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLDialogElement)) return;
      const opener = (target as HTMLDialogElement & { _opener?: HTMLElement })._opener;
      if (opener && typeof opener.focus === 'function') {
        opener.focus();
      }
    },
    true
  );

  // Remember the opener before a dialog goes modal.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const trigger = target.closest<HTMLElement>(
        '[data-drawer-trigger], [data-search-trigger]'
      );
      if (!trigger) return;
      const id =
        trigger.dataset.drawerTrigger || trigger.dataset.searchTrigger || '';
      const dialog = id ? document.getElementById(id) : null;
      if (dialog instanceof HTMLDialogElement) {
        (dialog as HTMLDialogElement & { _opener?: HTMLElement })._opener = trigger;
      }
    },
    true
  );
}

// Auto-install on first import in the browser.
if (typeof document !== 'undefined') {
  installKeybindings();
}
