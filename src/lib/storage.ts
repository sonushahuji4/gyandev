/**
 * Typed localStorage / sessionStorage wrapper for GyanDev.
 *
 * Per PHASE-1-ROADMAP §2.R1: every key follows `gyandev:v<N>:<domain>:<id-or-field>`
 * and every value is wrapped in `{ v, data }` so future schema bumps can be migrated
 * sequentially. No callers should construct keys by string concatenation — import
 * the builders below.
 */

export const STORAGE_VERSION = 1 as const;
const KEY_PREFIX = `gyandev:v${STORAGE_VERSION}` as const;

export type StorageEnvelope<T> = {
  v: number;
  data: T;
};

export type StorageArea = 'local' | 'session';

// ---------------------------------------------------------------------------
// Domain value types — kept here so consumers share one source of truth for
// the envelopes that flow between writers (chapter-hydrate) and readers
// (home, all-courses, course-overview).
// ---------------------------------------------------------------------------

export type ThemePref = 'light' | 'dark' | 'system';
export type ActiveTabPref = 'full' | 'revision' | 'flow';

export type ProgressData = {
  /** Slugs of chapters the user has marked read within one course. */
  read: string[];
};

export type LastReadData = {
  courseSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  readingMinutes: number;
  /**
   * Denormalized copy of the parent course's `title` field (per roadmap Q#28).
   * Lets the home Continue-Reading card render without a second collection lookup.
   */
  courseLabel: string;
};

export type BookmarkEntry = {
  courseSlug: string;
  chapterSlug: string;
  title: string;
  addedAt: number;
};

export type BookmarksData = {
  items: BookmarkEntry[];
};

/** Map of route pathname → last known scrollY, for view-transition restoration. */
export type ScrollData = Record<string, number>;

// ---------------------------------------------------------------------------
// Key builders — the only sanctioned way to produce a storage key.
// ---------------------------------------------------------------------------

/** `gyandev:v1:progress:<courseSlug>` — per-course read-set envelope. */
export function progressKey(courseSlug: string): string {
  return `${KEY_PREFIX}:progress:${courseSlug}`;
}

/** `gyandev:v1:prefs:<field>` — single user preference (e.g. `theme`, `activeTab`). */
export function prefsKey(field: string): string {
  return `${KEY_PREFIX}:prefs:${field}`;
}

/** `gyandev:v1:dismiss:<id>` — sticky dismissal flag, typically in sessionStorage. */
export function dismissKey(id: string): string {
  return `${KEY_PREFIX}:dismiss:${id}`;
}

/** `gyandev:v1:progress:lastRead` — most-recently-read chapter pointer. */
export function lastReadKey(): string {
  return `${KEY_PREFIX}:progress:lastRead`;
}

/** `gyandev:v1:bookmarks` — bookmarked chapters across all courses. */
export function bookmarksKey(): string {
  return `${KEY_PREFIX}:bookmarks`;
}

/** `gyandev:v1:scroll` — per-URL scrollY map for view-transition restoration. */
export function scrollKey(): string {
  return `${KEY_PREFIX}:scroll`;
}

// ---------------------------------------------------------------------------
// Migrations — sequential `v(n) → v(n+1)` table. Empty for Phase 1; the next
// schema bump appends a `1: (data) => …` entry that produces v2 shape.
// ---------------------------------------------------------------------------

type Migration = (data: unknown) => unknown;
const MIGRATIONS: Record<number, Migration> = {};

// ---------------------------------------------------------------------------
// SSR-safe storage access
// ---------------------------------------------------------------------------

function getStore(area: StorageArea): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return area === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Storage can throw on access in privacy modes / sandboxed iframes.
    return null;
  }
}

function isEnvelope(value: unknown): value is StorageEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    'data' in value &&
    typeof (value as { v: unknown }).v === 'number'
  );
}

function isQuotaExceeded(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // QuotaExceededError on modern browsers; NS_ERROR_DOM_QUOTA_REACHED on legacy Firefox.
  return err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function migrate<T>(envelope: StorageEnvelope<unknown>): StorageEnvelope<T> | null {
  let current = envelope;
  while (current.v < STORAGE_VERSION) {
    const step = MIGRATIONS[current.v];
    if (!step) return null;
    current = { v: current.v + 1, data: step(current.data) };
  }
  return current as StorageEnvelope<T>;
}

// ---------------------------------------------------------------------------
// get / set / remove
// ---------------------------------------------------------------------------

/**
 * Read a typed value from storage. Returns `null` when:
 * - running on the server (no `window`),
 * - the key is absent,
 * - the stored payload is malformed JSON or missing the envelope shape,
 * - the stored version is newer than `STORAGE_VERSION` (downgrade refusal),
 * - migration from an older version has no registered step.
 *
 * On a successful migration the migrated value is written back so the next
 * read takes the fast path.
 */
export function get<T>(key: string, area: StorageArea = 'local'): T | null {
  const store = getStore(area);
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isEnvelope(parsed)) return null;

  if (parsed.v === STORAGE_VERSION) {
    return parsed.data as T;
  }
  if (parsed.v > STORAGE_VERSION) return null;

  const migrated = migrate<T>(parsed);
  if (!migrated) return null;
  set(key, migrated.data, area);
  return migrated.data;
}

/**
 * Write a typed value, wrapping it in the current-version envelope.
 * Returns `true` on success, `false` on SSR, quota-exceeded, or other write failures.
 * Quota errors are swallowed by design — callers decide whether to surface or evict.
 */
export function set<T>(key: string, data: T, area: StorageArea = 'local'): boolean {
  const store = getStore(area);
  if (!store) return false;

  const envelope: StorageEnvelope<T> = { v: STORAGE_VERSION, data };
  try {
    store.setItem(key, JSON.stringify(envelope));
    return true;
  } catch (err) {
    if (isQuotaExceeded(err)) return false;
    return false;
  }
}

/** Remove a key. No-op on SSR or when storage access throws. */
export function remove(key: string, area: StorageArea = 'local'): void {
  const store = getStore(area);
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Cross-tab sync via the `storage` event (localStorage only — sessionStorage
// is per-tab and never fires this event).
// ---------------------------------------------------------------------------

export type StorageChangeListener<T> = (newValue: T | null, oldValue: T | null) => void;

/**
 * Subscribe to cross-tab changes for a single localStorage key.
 * Returns an unsubscribe function. No-op on SSR.
 */
export function subscribe<T>(key: string, listener: StorageChangeListener<T>): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: StorageEvent): void => {
    if (event.storageArea !== window.localStorage) return;
    if (event.key !== key) return;
    listener(decodeRaw<T>(event.newValue), decodeRaw<T>(event.oldValue));
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

function decodeRaw<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return null;
    if (parsed.v !== STORAGE_VERSION) return null;
    return parsed.data as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// `pagehide` flush — for hydrate scripts that batch writes in memory and need
// a final, synchronous persist before the page unloads or backgrounds.
// `pagehide` is preferred over `beforeunload` because it fires reliably on the
// bfcache path (Safari, Firefox).
// ---------------------------------------------------------------------------

type FlushCallback = () => void;
const flushCallbacks = new Set<FlushCallback>();
let pageHideInstalled = false;

function installPageHideHandler(): void {
  if (pageHideInstalled || typeof window === 'undefined') return;
  pageHideInstalled = true;
  window.addEventListener('pagehide', () => {
    for (const cb of flushCallbacks) {
      try {
        cb();
      } catch {
        // one bad callback shouldn't poison the rest
      }
    }
  });
}

/**
 * Register a callback to run on `pagehide`. Returns an unregister function.
 * No-op on SSR.
 */
export function onPageHide(callback: FlushCallback): () => void {
  if (typeof window === 'undefined') return () => undefined;
  flushCallbacks.add(callback);
  installPageHideHandler();
  return () => {
    flushCallbacks.delete(callback);
  };
}
