# Chapter Page Spec — Placeholder (content coming)
Replace the contents of .claude/specs/pages/chapter.md with this exact content:

---
title: GyanDev — Chapter Page Spec (3 Tabs)
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
routes:
  - /courses/[course]/[chapter]              (Full Notes — canonical)
  - /courses/[course]/[chapter]/revision     (Quick Revision)
  - /courses/[course]/[chapter]/flow         (Flow Diagram)
phase: 1
---

# Chapter Page (Three-Tab Model)

The core content page of GyanDev. Each chapter has three synchronized views: Full Notes (deep study), Quick Revision (bullet recap), Flow Diagram (visual recall).

## 1. Purpose

1. **Deliver deep, usable technical content** (Full Notes)
2. **Support fast re-reading for interview prep** (Quick Revision)
3. **Enable visual recall and big-picture understanding** (Flow Diagram)
4. **Navigate sequentially through the course** (prev/next)

## 2. Target Audience

- Engineers learning concepts for the first time (Full Notes)
- Engineers refreshing before interviews (Quick Revision)
- Visual thinkers + anyone doing final cramming (Flow Diagram)

## 3. URL Scheme

Three URLs per chapter, sharing a canonical:

| Tab | URL | Canonical? | Indexed? |
|---|---|---|---|
| Full Notes | `/courses/[course]/[chapter]` | ✅ Yes | Yes |
| Quick Revision | `/courses/[course]/[chapter]/revision` | No (points to Full Notes) | No (noindex, follow) |
| Flow Diagram | `/courses/[course]/[chapter]/flow` | No (points to Full Notes) | No (noindex, follow) |

Rationale covered in `shared/routing-and-urls.md` and `shared/seo.md`.

## 4. Page Sections (All Three Tabs)

### Section 1: Top Navigation
Shared global header (sticky).

### Section 2: Breadcrumbs

```
Home > Courses > Node.js > The Origin Story
```

### Section 3: Chapter Header

```
┌──────────────────────────────────────────────┐
│  [TUTORIAL] [INTERMEDIATE]                   │
│                                              │
│  The Origin Story                            │
│  Why Ryan Dahl created Node.js in 2009       │
│                                              │
│  15 min read · Updated Apr 20, 2026          │
│  [Mark as read] [🔖 Bookmark] [Edit on GH]   │
└──────────────────────────────────────────────┘
```

- Type badge (tutorial / howto / reference / explanation)
- Difficulty badge (beginner / intermediate / advanced)
- H1: chapter title
- Subtitle (1 line)
- Meta bar: reading time, last updated, author (Phase 2)
- Action buttons

### Section 4: Tab Bar

```
┌──────────────────────────────────────────────┐
│  [●Full Notes] [ Quick Revision] [ Flow]     │
└──────────────────────────────────────────────┘
```

Three-tab switcher:
- Active tab: filled underline + bold
- Inactive tabs: muted, underline on hover
- Missing tabs (content not yet written): grayed + "Coming soon" label
- Click → navigates to tab URL (full page load, SSG)
- Active tab persists in localStorage (`gyandev:v1.prefs.activeTab`)
- When navigating to next chapter, respect the active tab preference

Keyboard:
- Tab + Enter to switch
- Arrow keys when tab bar has focus (←/→)

### Section 5: Content Area

**Full Notes tab**:
- Long-form prose with MDX components
- Code blocks (Shiki dual themes)
- Callouts, diagrams, examples
- Headings create TOC entries

**Quick Revision tab**:
- Bullet-point format
- Mnemonics and memory hooks
- Shorter code snippets
- "If you remember nothing else..." sections
- ~3-5 minutes to read

**Flow Diagram tab**:
- Single Mermaid diagram dominates
- Minimal prose, just annotations
- Captions per phase or step
- Optional: multiple diagrams for complex topics

### Section 6: Chapter Footer

```
┌──────────────────────────────────────────────┐
│  ← Previous: JavaScript on the Server        │
│  Next: Let's Write Some Code →               │
│                                              │
│  [Bookmark this]  [Mark as complete]         │
│                                              │
│  Contribute: [Edit on GitHub] [Report issue] │
└──────────────────────────────────────────────┘
```

- Prev chapter link (title + arrow)
- Next chapter link (title + arrow)
- Keyboard shortcuts: ← and → arrow keys navigate prev/next
- Action buttons
- Contribution links

### Section 7: Comments (Giscus)

```
┌──────────────────────────────────────────────┐
│  Discussion                                  │
│                                              │
│  [Giscus iframe loads here]                  │
└──────────────────────────────────────────────┘
```

- Loaded lazily (client:visible) to avoid CWV hit
- Dark/light mode synced with site theme
- Threaded conversations via GitHub Discussions
- "Sign in with GitHub to comment" if not signed in

### Section 8: Left Sidebar (Desktop Only, lg+)

Chapter tree for the current course, grouped by season:

```
┌─────────────────┐
│  Node.js        │
│                 │
│  Season 1       │
│  ✓ 01. Origin   │
│  ✓ 02. JS Server│
│  ● 03. Write    │  ← current
│  ○ 04. Modules  │
│  ○ 05. Deep Mod │
│                 │
│  Season 2       │
│  ○ 01. libuv    │
│  ○ 02. Sync/Asy │
│                 │
│  [Back to course]│
└─────────────────┘
```

- Width: 260px
- Sticky, scrolls independently
- Completion icons (✓ ● ○)
- Current chapter highlighted
- Seasons collapsible (optional)

### Section 9: Right TOC (Desktop Only, xl+)

On-page table of contents:

```
┌─────────────────┐
│  On This Page   │
│                 │
│  ● Introduction │
│    The Problem  │
│    The Bet      │
│  ○ Background   │
│  ○ Aftermath    │
│                 │
│  [↑ Back to top]│
└─────────────────┘
```

- Width: 220px
- Auto-generated from H2/H3 headings
- Active heading highlighted (IntersectionObserver)
- Progress indicator based on scroll
- Only shows at `xl+` (1280px+)

## 5. Tab-Specific Considerations

### Full Notes
- Reading time 15-45 minutes typical
- Heavy MDX use (all components available)
- Code examples run-verifiable
- Assumes reader has time

### Quick Revision
- Reading time 3-7 minutes
- Bullet-heavy format
- "You remember because..." framing
- Includes common interview questions at end (Phase 2)
- No walls of text

### Flow Diagram
- Reading time 1-3 minutes
- One or two Mermaid diagrams
- Minimal text, high visual density
- Reader can screenshot for reference

## 6. Responsive Behavior

### Mobile (< 768px)
- No sidebars (left + right hidden)
- Chapter tree accessible via hamburger
- TOC accessible via "On this page" bottom sheet
- Tab bar: full-width, horizontally scrollable if needed
- Content: edge-to-edge with 16px padding
- Code blocks: horizontal scroll

### Tablet (768-1024px)
- No left sidebar (drawer only)
- No right TOC (bottom sheet)
- Content centered with breathing room

### Desktop (lg 1024-1280px)
- Left sidebar visible
- No right TOC yet
- Content centered between sidebar and edge

### Large Desktop (xl 1280px+)
- Both sidebars visible
- Content centered in middle column
- Max content width: 720px

## 7. Data Sources

| Data | Source |
|---|---|
| Chapter content | MDX file (one per tab) |
| Chapter metadata | `_chapter.yml` frontmatter |
| Course chapter list | Content Collection query |
| Prev/next | Computed from order field |
| Progress | localStorage |
| Comments | Giscus (GitHub Discussions) |

## 8. Interactions

- **Tab switch**: full page navigation (SSG)
- **Mark as read**: toggle in localStorage, show visual state
- **Bookmark**: toggle in localStorage, optional server-sync Phase 2
- **Copy code**: copy button on each code block (top-right)
- **TOC click**: smooth scroll to heading, update URL hash
- **Prev/Next**: keyboard arrow keys + visible buttons
- **Edit on GitHub**: opens GitHub edit URL for current file

## 9. Meta Tags (Per Tab)

### Full Notes
```html
<title>Origin Story — Node.js — GyanDev</title>
<meta name="description" content="...">
<link rel="canonical" href="https://gyandev.org/courses/nodejs/origin-story">
<meta name="robots" content="index, follow, max-image-preview:large">
```

### Quick Revision
```html
<title>Origin Story Revision — Node.js — GyanDev</title>
<meta name="description" content="Quick revision of Origin Story...">
<link rel="canonical" href="https://gyandev.org/courses/nodejs/origin-story">
<meta name="robots" content="noindex, follow">
```

### Flow Diagram
```html
<title>Origin Story Flow — Node.js — GyanDev</title>
<meta name="description" content="Visual flow of Origin Story...">
<link rel="canonical" href="https://gyandev.org/courses/nodejs/origin-story">
<meta name="robots" content="noindex, follow">
```

## 10. Structured Data (Full Notes Only)

`TechArticle` schema with full article metadata (see `shared/seo.md`).

Revision and Flow tabs inherit but use `isPartOf` to point at Full Notes.

## 11. Performance Targets

- LCP < 2.5s (chapter title is usually LCP)
- INP < 200ms (tab switching must be fast)
- CLS < 0.1 (Giscus iframe reserves height)
- Total weight < 500KB excluding Mermaid (which loads only on Flow tab)

### Tab-specific notes
- **Flow tab**: Mermaid JS loads dynamically (~300KB) — budget-exempt
- **Full Notes**: May include many code blocks — Shiki pre-renders at build

## 12. Accessibility

- H1 = chapter title (never tab name)
- Tab bar uses ARIA `tablist` pattern (see `shared/accessibility.md`)
- Keyboard navigation between tabs + between chapters
- Screen reader announces tab change
- Code blocks have `role="figure"` with caption when labeled
- Mermaid diagrams have text alternative in `<figcaption>`

## 13. States

### Missing tab content
- **Revision/Flow not written yet**: Tab grayed, shows "Coming soon" message
- Body: "This tab is coming soon. [Contribute via GitHub →]"

### Draft chapter
- `status: draft` in frontmatter: excluded from build in production
- Accessible via special `?preview=true` query in dev mode

### Missing MDX file
- Build fails — must be caught before deploy

## 14. Success Criteria

- [ ] All three tabs render correctly for each chapter
- [ ] Canonical URLs point to Full Notes
- [ ] Revision/Flow have noindex
- [ ] Prev/Next navigation works across course boundary (end of course → overview page)
- [ ] Keyboard navigation fully supported
- [ ] Giscus comments load without breaking CWV
- [ ] Tab preference persists across chapters
- [ ] "Coming soon" states show correctly for incomplete tabs

## 15. Open Questions

- [ ] Should we track time spent reading per chapter for revision scheduling?
- [ ] Should bookmarks sync across devices (requires backend)? — defer
- [ ] Should we support dark mode for Mermaid diagrams? — yes (astro-mermaid autoTheme)
- [ ] Should the flow diagram be interactive (pan/zoom)? — Phase 2

## 16. References

- Shared: [shared/website-overview.md](../shared/website-overview.md)
- Shared: [shared/routing-and-urls.md](../shared/routing-and-urls.md)
- Shared: [shared/seo.md](../shared/seo.md)
- Shared: [shared/accessibility.md](../shared/accessibility.md)
- Plan: [plans/pages/chapter.md](../../plans/pages/chapter.md) *(to be created)*

After saving, do NOT commit. Do NOT create any other files.