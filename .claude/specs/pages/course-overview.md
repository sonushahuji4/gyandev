# Course Overview Page Spec — Placeholder (content coming)
Replace the contents of .claude/specs/pages/course-overview.md with this exact content:

---
title: GyanDev — Course Overview Page Spec
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
route: /courses/[course]
phase: 1
---

# Course Overview Page

The landing page for each course — explains what the course covers, who it's for, and shows the full chapter list grouped by season.

## 1. Purpose

1. **Orient** the reader to this specific course
2. **Show chapter list** with completion state
3. **Guide** them to start (fresh) or resume (in progress)
4. **Link to prerequisites** if they're not ready

## 2. Target Audience

- Visitors from search ("learn Node.js", "system design course")
- Visitors from home/all-courses page
- Returning readers checking their progress

## 3. Page Sections

### Section 1: Breadcrumbs

```
Home > Courses > Node.js
```

### Section 2: Course Hero

```
┌──────────────────────────────────────────────┐
│  ┌────────┐                                  │
│  │ Logo   │   Node.js                        │
│  │ Icon   │   Server-side JavaScript...      │
│  └────────┘                                  │
│                                              │
│  12 chapters · ~10 hours · Intermediate      │
│                                              │
│  [Resume: Chapter 6 →]   [Start Chapter 1]   │
└──────────────────────────────────────────────┘
```

Left column (or top on mobile):
- Course logo
- Course name (H1)
- Full description (2-3 lines)
- Stats bar

Right column:
- Resume CTA (if progress exists) with specific chapter
- Start from Chapter 1 CTA

### Section 3: "What You'll Learn"

```
┌──────────────────────────────────────────────┐
│  What You'll Learn                           │
│                                              │
│  1. How V8 compiles JS to machine code       │
│  2. Event loop phases and microtask timing   │
│  3. Stream backpressure and piping           │
│  4. Production patterns for Node services    │
│  5. ...                                      │
└──────────────────────────────────────────────┘
```

- Numbered list of 5-8 learning objectives
- Specific, outcome-focused
- Pulled from course frontmatter `learning_objectives` array

### Section 4: Prerequisites (Optional)

```
┌──────────────────────────────────────────────┐
│  Before You Start                            │
│                                              │
│  You should be comfortable with:             │
│  • JavaScript basics (closures, async/await) │
│  • Command line usage                        │
│  • Git fundamentals                          │
│                                              │
│  → See our [JavaScript course]               │
└──────────────────────────────────────────────┘
```

- Pulled from course `prerequisites` array
- Links to prerequisite courses if we have them

### Section 5: Chapters List (Grouped by Season)

```
┌──────────────────────────────────────────────┐
│  Season 1: Foundations                       │
│  12 chapters · 6 hours                       │
│  ──────────────────────                      │
│                                              │
│  01 ✓ The Origin Story                       │
│     Why Ryan Dahl built Node.js              │
│     15 min · Beginner · ● ● ●                │
│                                              │
│  02 ✓ JavaScript on the Server               │
│     ...                                      │
│                                              │
│  03 ● Let's Write Some Code                  │  ← current
│     ...                                      │
│                                              │
│  04 ○ Modules & Exports                      │
│     ...                                      │
│                                              │
│  Season 2: Deep Dives                        │
│  ...                                         │
└──────────────────────────────────────────────┘
```

Per chapter row:
- Order number (zero-padded 01, 02, ...)
- Completion icon: ✓ (read), ● (current), ○ (not started)
- Title (links to chapter)
- 1-line excerpt (muted text)
- Meta: reading time · difficulty · tab-availability dots (Full, Revision, Flow)

Season groupings:
- H2 for each season
- Season meta: chapter count, combined time
- Visual divider between seasons

Tab-availability dots:
- ● (filled): tab exists and published
- ○ (empty): tab not yet available ("coming soon")

### Section 6: Sidebar (Desktop Only)

Right sidebar at `lg+`:

```
┌─────────────────┐
│  Your Progress  │
│  ──────────     │
│  3 of 12 read   │
│  [progress bar] │
│                 │
│  ──────────     │
│  Download       │
│  • PDF bundle   │  (Phase 2)
│  • MDX archive  │  (Phase 2)
│                 │
│  ──────────     │
│  Related        │
│  • JavaScript   │
│  • System Design│
│                 │
│  ──────────     │
│  Contribute     │
│  → Edit course  │
│  → Report issue │
└─────────────────┘
```

- Progress widget (reads localStorage)
- Download options (Phase 2)
- Related courses
- Contribute links

### Section 7: Footer

Shared global footer.

## 4. Responsive Behavior

### Mobile
- Hero: stacked (logo top, text below, CTAs at bottom)
- Sidebar: collapses into sections below chapter list
- Chapter rows: compact, excerpt may truncate

### Tablet
- Hero: side-by-side but tighter
- Sidebar: still below chapter list

### Desktop (lg+)
- Full two-column layout with sidebar
- Chapter rows: wider, full excerpts visible

## 5. Data Sources

| Data | Source |
|---|---|
| Course metadata | Content Collection: course by slug |
| Chapter list | Content Collection: chapters where `course == slug`, sorted by order |
| Season grouping | Chapter frontmatter `season` field |
| Progress | localStorage (`gyandev:v1.progress.completed`) |
| Related courses | Course frontmatter `related` array or shared tags |

## 6. Interactions

- Chapter title: clicks to chapter Full Notes tab
- Resume CTA: deep-links to current chapter + scroll position
- Download links (Phase 2): trigger download, not navigate
- Sidebar "Edit course" → GitHub repo link

## 7. Meta Tags

```html
<title>Node.js — GyanDev</title>
<meta name="description" content="Learn Node.js from V8 internals to production patterns. 12 chapters, ~10 hours, with Full Notes, Quick Revision, and Flow Diagram views.">
<link rel="canonical" href="https://gyandev.org/courses/nodejs">
```

## 8. Structured Data

`Course` schema with `hasCourseInstance` (see `shared/seo.md`).

Plus `BreadcrumbList`:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type":"ListItem","position":1,"name":"Home","item":"https://gyandev.org"},
    {"@type":"ListItem","position":2,"name":"Courses","item":"https://gyandev.org/courses"},
    {"@type":"ListItem","position":3,"name":"Node.js","item":"https://gyandev.org/courses/nodejs"}
  ]
}
```

## 9. Performance

- Static HTML, all data baked in
- No runtime fetching
- Progress widget hydrates client-side (tiny JS)
- Target: < 50KB total page weight

## 10. Accessibility

- Single H1: course name
- H2 for each season
- Chapter list as `<ol>` (ordered)
- Completion state announced via `aria-label` on icons
- Progress bar has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Keyboard: Tab through CTAs → through each chapter row

## 11. States

### Progress states
- **Fresh (no progress)**: Hide Resume CTA, show only "Start Chapter 1"
- **In progress**: Show Resume CTA prominently
- **Complete**: Show celebratory banner + "Review any chapter" CTA

### Content states
- **Draft/upcoming course**: Show "Coming soon" page with email signup
- **No chapters yet**: Placeholder "First chapters coming soon"

## 12. Success Criteria

- [ ] Hero shows all metadata correctly
- [ ] Chapter list grouped by season with correct counts
- [ ] Completion icons accurate per localStorage state
- [ ] Resume CTA links to correct chapter
- [ ] Mobile/tablet/desktop layouts verified
- [ ] WCAG 2.2 AA pass
- [ ] Breadcrumb schema validated
- [ ] Course schema validated

## 13. Open Questions

- [ ] Should courses without seasons just show a flat list?
- [ ] Should we show author avatars per chapter?
- [ ] Should chapters show published date or only "updated"?
- [ ] Is the download feature worth building in Phase 1?

## 14. References

- Shared: [shared/website-overview.md](../shared/website-overview.md)
- Sibling: [pages/chapter.md](chapter.md)
- Plan: [plans/pages/course-overview.md](../../plans/pages/course-overview.md) *(to be created)*

After saving, do NOT commit. Do NOT create any other files.