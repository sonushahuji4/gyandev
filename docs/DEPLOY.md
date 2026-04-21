# Deployment runbook

Owner plans: [00-infrastructure.md](../.claude/plans/00-infrastructure.md), [shared/routing-and-urls.md](../.claude/plans/shared/routing-and-urls.md). This document is the operational companion — Cloudflare Pages + GitHub Actions configuration, preview branches, env vars, DNS, and rollback.

## Overview

GyanDev is a fully static Astro site hosted on Cloudflare Pages. There is no backend, no database, no Worker in Phase 1. Every deployable artifact is a tree of `.html`, `.css`, `.js`, `.woff2`, `.png`, and `.xml` files served from Cloudflare's edge.

- **Source of truth:** `main` branch of `github.com/<owner>/gyandev`.
- **Build environment:** GitHub Actions (`.github/workflows/ci.yml`) for validation; Cloudflare Pages' own builder for deploy.
- **Preview branches:** every non-`main` branch pushed to GitHub auto-deploys to `<branch>.gyandev.pages.dev`.
- **Production:** `main` → `gyandev.org` (apex) via Cloudflare Pages domain attachment + a zone-level Redirect Rule `www → apex`.
- **Rollback:** Cloudflare Pages dashboard → Deployments → Rollback (one-click to any prior build).

## Infrastructure diagram

```
                   ┌──────────────────────────┐
                   │  Author (local machine)  │
                   │  npm run check           │
                   │  git push origin <br>    │
                   └───────────┬──────────────┘
                               │
                               ▼
                   ┌──────────────────────────┐
                   │   GitHub (origin repo)   │
                   └──────┬────────────┬──────┘
              push event  │            │  push/PR event
                          ▼            ▼
  ┌────────────────────────────┐   ┌────────────────────────────┐
  │   Cloudflare Pages build   │   │   GitHub Actions: ci.yml   │
  │                            │   │                            │
  │  1. npm ci                 │   │  1. npm ci                 │
  │  2. npm run build          │   │  2. npm run check          │
  │  3. wrangler pages deploy  │   │  3. axe + Pa11y            │
  │                            │   │  4. Lighthouse CI          │
  │  Env: PUBLIC_*, PAGES_*    │   │  5. check:schema / :csp    │
  └───────────┬────────────────┘   └────────────────────────────┘
              │                      (runs on PR for merge gate)
              ▼
  ┌──────────────────────────────────────────────────┐
  │   Cloudflare edge (global)                       │
  │   ┌──────────────┐     ┌──────────────────────┐  │
  │   │ main build   │     │ preview branch build │  │
  │   │ gyandev.org  │     │ <br>.gyandev.pages   │  │
  │   └──────┬───────┘     └──────────────────────┘  │
  │          │                                        │
  │   Redirect Rule: www.gyandev.org → gyandev.org    │
  │   (zone-level, not in _redirects)                 │
  └──────────────────────────────────────────────────┘
              │
              ▼
  ┌──────────────────────────┐
  │   Post-deploy smoke test │   ← .github/workflows/ci.yml post-merge job
  │   scripts/smoke-deploy   │     (PR-6.2). HTTP checks for canonical
  │                          │     URLs, sitemap, RSS, OG, /search.
  └──────────────────────────┘
```

## Cloudflare Pages dashboard config

All of these are set once in the Cloudflare Pages dashboard (Pages → `gyandev` → Settings) and persist across deployments. Owner: **sonushahuji4**.

### Build configuration

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (blank — repo root) |
| Node.js version | From `.nvmrc` (currently `22`) |
| Install command | `npm ci` |

### Branch deployments

| Setting | Value |
|---|---|
| Production branch | `main` |
| Preview branch | All non-production branches |
| Preview branch aliases | `<branch>.gyandev.pages.dev` |
| Preview deployment comments on PRs | Enabled |

`wrangler pages deploy dist --branch=<branch>` can deploy manually if the Git integration is paused; rarely needed.

### Custom domains

| Domain | Target | Purpose |
|---|---|---|
| `gyandev.org` | Production (main) | Canonical apex |
| `www.gyandev.org` | Redirect → `https://gyandev.org` | Zone-level Redirect Rule, not a Pages custom domain |

### Environment variables

Set in **Cloudflare Pages → Settings → Environment variables** for both **Production** and **Preview** environments. Preview can diverge from Production for Giscus / analytics to keep preview comments and analytics isolated.

| Variable | Scope | Notes |
|---|---|---|
| `PUBLIC_SITE_URL` | Production + Preview | `https://gyandev.org` in prod; preview uses the branch alias |
| `PUBLIC_GOOGLE_VERIFY` | Production | Search Console verification token |
| `PUBLIC_BING_VERIFY` | Production | Bing Webmaster verification token |
| `PUBLIC_GISCUS_REPO` | Production + Preview | `owner/repo` — preview can point at a test repo |
| `PUBLIC_GISCUS_REPO_ID` | Production + Preview | From Giscus config generator |
| `PUBLIC_GISCUS_CATEGORY_ID` | Production + Preview | From Giscus config generator |
| `SITEMAP_SUBMIT_TOKEN` | Production only | IndexNow token for `scripts/submit-sitemap.mjs`; leave blank to skip |

All of these are `PUBLIC_*` except `SITEMAP_SUBMIT_TOKEN`. `PUBLIC_*` vars are inlined into the client bundle at build time — **never put secrets behind that prefix**. `SITEMAP_SUBMIT_TOKEN` is only read by the Node submit script (not the Astro build), so it's safe as a server-only env var.

Mirror of this list lives in `.env.example` (tracked in repo) for local development.

### Giscus configuration

Giscus drives per-chapter comments via `src/components/pages/chapter/ChapterComments.astro`, which reads three `PUBLIC_GISCUS_*` vars at build time. If any are missing, `ChapterComments` renders a "Comments are disabled in this environment" placeholder instead of mounting the widget — silently, so the build still succeeds. The pre-deploy checklist and `npm run verify:giscus` (below) exist to catch that.

**Required env vars:**

| Variable | Example value | Where to get it |
|---|---|---|
| `PUBLIC_GISCUS_REPO` | `sonushahuji4/gyandev` | The GitHub repo that hosts the Discussions. Format is `owner/name`. |
| `PUBLIC_GISCUS_REPO_ID` | `R_kgDO…` (opaque GraphQL node ID) | Generated by giscus.app's config wizard after selecting the repo. |
| `PUBLIC_GISCUS_CATEGORY_ID` | `DIC_kwDO…` (opaque) | Generated by the same wizard after selecting the Discussion category (the "Comments" category on the gyandev repo). |

**One-time setup (manual, dashboard + browser):**

1. Enable Discussions on the target GitHub repo if not already enabled: Repo → Settings → General → Features → Discussions.
2. Create a Discussion category called **Comments** with type **Announcement** (restricts new top-level threads to maintainers; replies remain open).
3. Install the [Giscus GitHub App](https://github.com/apps/giscus) on the repo. Required for Giscus to create Discussions on behalf of commenters.
4. Visit [giscus.app](https://giscus.app) and walk the config wizard:
    - Repository: enter `owner/name`. The page confirms the app is installed.
    - Page ↔ Discussion mapping: **Specific term in page title or URL** (the codebase passes `term={courseSlug}/{chapterSlug}`).
    - Discussion category: **Comments**.
    - Features: leave defaults.
5. Scroll to the "Enable giscus" snippet near the bottom. Copy the three values:
    - `data-repo="..."` → `PUBLIC_GISCUS_REPO`
    - `data-repo-id="..."` → `PUBLIC_GISCUS_REPO_ID`
    - `data-category-id="..."` → `PUBLIC_GISCUS_CATEGORY_ID`
6. Cloudflare dashboard → Pages → `gyandev` → Settings → Environment variables → add all three under **Production** (and **Preview**, optionally pointing at a test repo).
7. Trigger a redeploy. CF Pages only picks up new env vars on a fresh build; the "Retry deployment" button on the latest deployment is enough.

**Post-deploy verification:**

Run the smoke script against the deployed site after setting the env vars + redeploying:

```sh
# Against production
BASE_URL=https://gyandev.org \
PUBLIC_GISCUS_REPO=sonushahuji4/gyandev \
PUBLIC_GISCUS_REPO_ID=... \
PUBLIC_GISCUS_CATEGORY_ID=... \
  npm run verify:giscus
```

The script:

1. Confirms all three env vars are set in the calling shell (so you catch a mismatch before blaming the deploy).
2. Fetches `${BASE_URL}/courses/javascript/event-loop` and inspects the HTML for the `<section id="comments" data-giscus-repo=...>` container and the `giscus.app/client.js` script reference.
3. Exits 0 on success; exits 1 with a specific error + hint per check on failure.

Against a local build, set `VERIFY_GISCUS_FILE` instead of `BASE_URL`:

```sh
npm run build
VERIFY_GISCUS_FILE=dist/courses/javascript/event-loop.html npm run verify:giscus
```

The script is **not** wired into `npm run check` — it depends on a real build environment with populated env vars and cannot run in a clean local clone.

**Troubleshooting — comments don't appear:**

| Symptom | Likely cause | Fix |
|---|---|---|
| Chapter page shows "Comments are disabled in this environment" placeholder | One or more `PUBLIC_GISCUS_*` env vars were empty at the time of the CF Pages build | Set the env vars in the CF dashboard → Retry deployment. Env vars are snapshotted at build time; changing them without a rebuild has no effect. |
| Placeholder replaced by "Loading comments…" that never resolves | `https://giscus.app/client.js` not loaded at runtime — runtime injection wiring is missing or broken | Check `src/components/performance/GiscusLazy.astro`: a `giscus:ready` listener must inject the Giscus `<script>` with the data attributes from the comments container. DevTools Network tab should show `client.js` fetched when the comments section scrolls into view. |
| Giscus iframe loads but shows "Discussions is not enabled on this repository" | Step 1 of one-time setup skipped | Repo → Settings → General → Features → tick Discussions. |
| Iframe loads and shows "giscus is not installed on this repository" | Step 3 of one-time setup skipped | Install the Giscus GitHub App on the repo. |
| Iframe loads but posting a comment fails with a 403-like error | Category ID is wrong, or the Giscus App lost permission | Re-run the giscus.app wizard to regenerate the category ID; confirm the GitHub App's repo access in Settings → Integrations. |
| Two chapter tabs show different Discussion threads | `term` prop passed to `ChapterComments` differs between tabs | `term` must be `{courseSlug}/{chapterSlug}` — identical across Full Notes / Revision / Flow. Check `ChapterLayout.astro`. |
| CSP violation in DevTools: "Refused to load `https://giscus.app/...`" | CSP missing `giscus.app` in `frame-src` or `connect-src` | `public/_headers` already includes `frame-src https://giscus.app` and `connect-src 'self' https://giscus.app`. If a newer Giscus version adds a second origin, extend the CSP directive and `npm run check:csp`. |
| Comments load but theme does not follow the page toggle | `theme-change` CustomEvent not dispatched, or `GiscusLazy` listener not attached | Check `ThemeToggle.astro` fires `theme-change`; check `GiscusLazy.astro` listens for it and updates `data-giscus-theme` on the comments container; check the runtime injector postMessages the resolved theme into the Giscus iframe. |

## Deploy flow

### Feature branch → preview

```sh
git checkout -b feat/my-change
# ... work ...
npm run check                   # full local gate; see docs/PERF.md + docs/A11Y.md
git push -u origin feat/my-change
```

On push:

1. GitHub Actions `ci.yml` runs (validate, build, axe, Pa11y, Lighthouse, schema, CSP, bundle).
2. Cloudflare Pages builds in parallel and deploys to `feat-my-change.gyandev.pages.dev`.
3. Opening a PR attaches both statuses (CI check + Pages preview link).
4. Merge requires CI green. Preview deploy is informational — a red preview still blocks release by convention.

### Merge to `main` → production

```sh
# via GitHub PR merge button
```

On merge:

1. Cloudflare Pages builds `main` and deploys to `gyandev.org` (atomic swap — users never see a half-deployed state).
2. GitHub Actions runs the same `ci.yml` on the merge commit plus the post-deploy smoke test (PR-6.2, `scripts/smoke-deploy.mjs`).
3. If post-deploy smoke fails, **it does not auto-rollback** — the deploy is already live. Human triage: either forward-fix with a follow-up PR or roll back via the Cloudflare dashboard.

### Manual deploy (emergency)

If GitHub is unreachable, deploy directly from a local clone:

```sh
npm ci
npm run build
npx wrangler pages deploy dist --project-name=gyandev --branch=main
```

Requires `CLOUDFLARE_API_TOKEN` with `Pages:Edit` scope. Token lives in 1Password under "Cloudflare API — Pages deploy"; not committed.

## Rollback procedure

**Use the dashboard for rollback; do not `git revert && push` unless the rollback itself needs a code change.**

### One-click rollback (preferred)

1. Cloudflare dashboard → Pages → `gyandev` → Deployments.
2. Find the last known-good deployment (deployments are labeled by commit SHA + message).
3. Click **...** → **Rollback**. Confirms via dialog; atomic swap at the edge within ~30 s.
4. Post in the release-log issue: SHA rolled back to, reason, next step.
5. File a follow-up PR to revert the offending commit on `main` so the Git history matches what's live. The follow-up PR is low-urgency now that production is stable.

### When rollback is not enough

A rollback reverts the *built artifact*. It cannot undo:

- **Content published to Search Console / social networks.** If a bad canonical leaked and Google indexed it, you need a content fix (corrected canonical + re-submit to Search Console), not a rollback.
- **OG images already scraped by Facebook/LinkedIn.** 24 h – 30 d cache; see `docs/SEO.md#og-image-troubleshooting`.
- **CSP / header changes** that already broke a third-party iframe integration. Rollback + re-test in preview before re-attempting.

### Rollback testing

Per §5.9 of PHASE-1-ROADMAP, we test the rollback flow exactly once before launch:

1. Deploy a benign "rollback test" PR to `main` (e.g., add a tiny CSS comment).
2. Confirm it's live.
3. Roll it back via the dashboard.
4. Confirm the prior deployment is live (cache headers may require a hard refresh).
5. Record the test result on the launch issue.

The test is not re-run per release. The goal is confirming the dashboard flow works and the DNS resolves cleanly after a swap.

## DNS + Redirect Rules

DNS is not managed in this repo. Owner: **sonushahuji4** (domain registrar account holder).

| Record | Type | Value | Purpose |
|---|---|---|---|
| `gyandev.org` | CNAME (flattened to A) | Cloudflare Pages project hostname | Apex → Pages |
| `www.gyandev.org` | CNAME | `gyandev.org` | Eligible for Redirect Rule |
| `_dmarc`, SPF, DKIM | TXT | (email provider) | Email auth, not serving |

### www → apex Redirect Rule

Set in Cloudflare dashboard → `gyandev.org` zone → Rules → Redirect Rules:

- **When incoming requests match:** Hostname equals `www.gyandev.org`
- **Then:** Static redirect to `https://gyandev.org${http.request.uri.path}` with status code **301 Permanent** and preserve query string.

Not in `public/_redirects` — Redirect Rules run at the edge before Pages and are more efficient than in-app redirects for a hostname-level concern. See `00-infrastructure.md` §9.

### Verification TXT records

Prefer meta-tag verification via `PUBLIC_GOOGLE_VERIFY` / `PUBLIC_BING_VERIFY` env vars. TXT-record verification is the fallback; if used, values go in the DNS zone (not this repo).

## Preview branches

Preview deploys are Cloudflare Pages' headline feature. How we use them:

- **Every PR gets a preview URL.** Posted by the Cloudflare GitHub app as a status check + PR comment.
- **Preview is noindex-by-default.** Pages auto-sets `X-Robots-Tag: noindex` on non-production deployments; we don't rely on in-app `<meta robots="noindex">` for previews.
- **Preview env vars can differ from production.** Giscus preview repo is the typical use case — comments from preview tests don't pollute production threads.
- **Preview URLs are stable per branch.** Pushing new commits to a branch updates the same `<branch>.gyandev.pages.dev` URL — link-sharable in PR reviews.
- **Preview deploys are retained for 30 days** by default. A long-running branch whose preview was ever referenced in a design review stays reachable.

## Post-deploy smoke tests

`scripts/smoke-deploy.mjs` (PR-6.2) runs post-merge as a step in `ci.yml`. Asserts:

- Canonical URLs return 200 (`/`, `/courses`, `/about`, `/privacy`, `/terms`, `/search`, `/404`).
- `sitemap-index.xml`, `sitemap-0.xml` return XML with correct `Content-Type`.
- `/rss.xml`, `/atom.xml`, `/feed.json` return feeds with correct `Content-Type`.
- `/og/default.png` returns 200 with `image/png`.
- `/search` loads Pagefind WASM without CSP violations (script probes the HTML for the expected inline bootstrap).
- `_headers` applied: `Cache-Control`, `Content-Security-Policy`, `Strict-Transport-Security` present on `/`.

Failure → Slack/GitHub notification (config TBD); no auto-rollback. Investigate, forward-fix, or roll back manually.

## Common deploy issues + fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Build passes locally, fails on Cloudflare Pages | Node version mismatch | `.nvmrc` pins Node 22; CF uses it. If CF uses a different version, set `NODE_VERSION` in CF env vars. |
| Build fails with `canvaskit-wasm` / `astro-og-canvas` error | Native dep fetch failure during `npm ci` on CF builder | Retry the build (CF dashboard → "Retry deployment"). Persistent → pin the version and rebuild. |
| `404` on a page that exists in `src/pages/` | `trailingSlash` mismatch. Pages configured for `trailingSlash: 'never'` + `build.format: 'file'` (00-infrastructure §1) | Verify `astro.config.mjs`; do not remove these settings. |
| CSS missing on first load, appears after navigation | `inlineStylesheets: 'auto'` didn't inline; preload missing | Check `<head>` of the failing page in the preview. Ensure BaseLayout mounts styles. |
| CSP violation in DevTools on a specific page | Inline script/style added without updating CSP | Update `public/_headers` CSP directive; `npm run check:csp` catches known-bad patterns locally. |
| Preview URL 404s / never deploys | CF Git integration disconnected or rate-limited | Dashboard → Pages → `gyandev` → Settings → Git → Reconnect. |
| Post-deploy smoke flags `/og/default.png` missing | Committed PNG was accidentally `git rm`d | Restore from git history (`git checkout <sha> -- public/og/default.png`) + commit. |
| Cloudflare Analytics not showing data after deploy | JS snippet not included (deferred until after launch per §11.5) | Expected in Phase 1; will be added post-launch. |

## Secrets + rotation

- **`CLOUDFLARE_API_TOKEN`** (emergency manual deploy): 1Password → "Cloudflare API — Pages deploy". Rotate yearly or if a machine with the token is compromised.
- **`SITEMAP_SUBMIT_TOKEN`**: 1Password → "IndexNow". Rotate if IndexNow reports abuse.
- **Giscus repo/category IDs** are not secrets (they're visible in the client bundle). No rotation needed; regenerate via giscus.app if the underlying GitHub repo changes.
- **Search Console / Bing verification tokens** are not secrets. Regenerate only if a new verification is required.

## Resources

- [Cloudflare Pages — Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).
- [Cloudflare Pages — Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/).
- [Cloudflare Pages — Environment variables](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables).
- [Cloudflare Pages — Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).
- [Cloudflare — Redirect Rules](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/).
- [Cloudflare Pages — `_headers`](https://developers.cloudflare.com/pages/configuration/headers/).
- [Cloudflare Pages — `_redirects`](https://developers.cloudflare.com/pages/configuration/redirects/).
- [`wrangler pages deploy`](https://developers.cloudflare.com/workers/wrangler/commands/#pages-deploy) for emergency CLI deploys.

## Things this doc does NOT cover

- **Staging environment.** Preview branches replace staging in Phase 1.
- **Blue/green canary.** Cloudflare's atomic swap is the Phase 1 model; canary is not a Pages feature.
- **Multi-region failover.** Cloudflare's edge is the failover; no secondary hosting planned.
- **Backup strategy.** The site is the repo; Git + GitHub + `gh auth` is the backup. No separate artifact store.
- **Worker / Functions deploys.** None in Phase 1; if added, document in a separate `docs/WORKERS.md`.
