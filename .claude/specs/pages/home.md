# Home Page Spec — Placeholder (content coming)

Replace the contents of .claude/specs/pages/home.md with this exact content:

---
title: GyanDev — Home Page Spec
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
route: /
phase: 1
---

# Home Page

The entry point for first-time visitors and returning readers. Must instantly communicate: what GyanDev is, what courses exist, and where to start.

## 1. Purpose

Three jobs, in priority order:

1. **Orient first-time visitors** — "What is this site?"
2. **Guide returning readers back to their progress** — "Continue where you left off"
3. **Surface fresh content** — "What's new, what's featured"

## 2. Target Audience

- **Primary**: Search traffic landing on home (brand search, generic queries)
- **Secondary**: Referral traffic (social, newsletters, blog posts)
- **Tertiary**: Direct traffic (returning readers)

## 3. Page Sections (Top to Bottom)

### Section 1: Hero
**Purpose**: Brand identity + primary CTA

```
┌──────────────────────────────────────────────┐
│  [Small badge: "Deep notes for developers"]  │
│                                              │
│  Learn how things                            │
│  actually work                               │
│                                              │
│  JavaScript, Node.js, System Design,         │
│  DSA — the nuances textbooks skip.           │
│                                              │
│  [Start with Node.js →]  [All courses]       │
└──────────────────────────────────────────────┘
```

- Large display heading (Instrument Serif)
- Tagline sub-text
- Primary CTA button → featured course (Node.js for now)
- Secondary CTA link → `/courses`
- Optional subtle background pattern or accent shape

### Section 2: Continue Reading (Conditional)
**Purpose**: Bring returning readers back to their last chapter

Only renders if localStorage `gyandev:v1.progress.lastRead` exists.

```
┌──────────────────────────────────────────────┐
│  👋 Continue where you left off              │
│                                              │
│  [Chapter card]                              │
│  "libuv & Async I/O"                         │
│  Node.js · Chapter 6 · 28 min read           │
│  [Resume →]                                  │
└──────────────────────────────────────────────┘
```

- Reads last-visited chapter from localStorage
- Shows chapter metadata (title, course, reading time)
- "Resume" CTA → deep-link to chapter + scroll position
- Dismissible (X icon, hides for session only)

### Section 3: All Courses
**Purpose**: Primary content discovery

```
┌──────────────────────────────────────────────┐
│  All Courses                                 │
│  Pick your path                              │
│                                              │
│  [Course Card] [Course Card] [Course Card]   │
│  [Course Card] [Course Card] [Course Card]   │
└──────────────────────────────────────────────┘
```

Course card anatomy:
- Course icon/logo
- Course name (H3)
- One-line description
- Stats: chapter count · total reading time · difficulty
- "Coming soon" badge if course not yet populated

Layout: 3 cols (lg+), 2 cols (md), 1 col (mobile)

### Section 4: Featured Chapters
**Purpose**: Surface editor's picks across courses

```
┌──────────────────────────────────────────────┐
│  Featured Reads                              │
│                                              │
│  [Chapter Card] [Chapter Card] [Chapter Card]│
│  [Chapter Card] [Chapter Card] [Chapter Card]│
└──────────────────────────────────────────────┘
```

- 5-6 hand-picked chapters
- Mix of difficulty levels
- Mix of courses
- Manually curated in `src/content/featured.yml`

Chapter card anatomy:
- Course name (small, muted, clickable)
- Chapter title (H3)
- 2-line excerpt
- Meta: difficulty · reading time
- Thumbnail image (optional, Phase 2)

### Section 5: Recently Updated
**Purpose**: Show the site is alive and growing

```
┌──────────────────────────────────────────────┐
│  Recently Updated                            │
│                                              │
│  ● JavaScript Closures — updated 2 days ago  │
│  ● Node Event Loop — new, 5 days ago         │
│  ● libuv Deep Dive — updated 1 week ago      │
│  ● ...                                       │
└──────────────────────────────────────────────┘
```

- Last 5 updated chapters
- Relative time stamps ("2 days ago")
- Distinguish new vs updated via dot color
- Auto-generated at build time from `updated_at` frontmatter

### Section 6: Footer
Shared global footer (see `shared/website-overview.md`).

## 4. Interactions

### Dismissing "Continue Reading"
- X icon in top-right of card
- Hides for current session only (sessionStorage flag)
- Returns on next page load or new session

### Course Card Click
- Whole card is clickable (not just title)
- Hover: subtle lift + border color change
- Focus: visible outline (keyboard access)

### Featured Chapter Click
- Whole card clickable
- Opens chapter in current tab (Full Notes)

## 5. Responsive Behavior

### Mobile (< 768px)
- Hero: tighter padding, smaller heading
- Continue card: full width
- Courses: 1 column
- Featured: 1 column (horizontal scroll optional)
- Recent: dense list

### Tablet (768-1024px)
- Hero: standard
- Courses: 2 columns
- Featured: 2 columns

### Desktop (1024px+)
- Full layout as specified
- Max container width 1200px

## 6. Data Sources

| Section | Source |
|---|---|
| Hero | Hard-coded in layout |
| Continue Reading | localStorage (`gyandev:v1.progress.lastRead`) |
| All Courses | Content Collection query: all courses |
| Featured | `src/content/featured.yml` (curated) |
| Recently Updated | Content Collection: sorted by `updated_at` desc, top 5 |

## 7. Meta Tags

```html
<title>GyanDev — Deep notes for modern developers</title>
<meta name="description" content="Learn how JavaScript, Node.js, System Design, and DSA actually work. In-depth notes with three views: Full Notes, Quick Revision, Flow Diagrams.">
<link rel="canonical" href="https://gyandev.org/">
<meta property="og:type" content="website">
<meta property="og:title" content="GyanDev — Deep notes for modern developers">
<meta property="og:description" content="Learn how things actually work. Multi-format notes for developers.">
<meta property="og:image" content="https://gyandev.org/og/home.png">
```

## 8. Structured Data

WebSite schema + SearchAction (see `shared/seo.md`).

## 9. Performance Targets

- LCP: < 2.0s (tighter than default — hero is usually LCP)
- CLS: < 0.05 (hero must not shift)
- First course card interactive: < 1s
- No client-side JS needed except for theme toggle + Continue Reading visibility

## 10. Accessibility

- Single H1: "Learn how things actually work" (or equivalent)
- Section headings H2
- Course/chapter cards are `<a>` with descriptive text (not generic "read more")
- Keyboard navigation: Tab through hero CTAs → Continue card → each course card → each featured → recent items
- "Continue Reading" dismiss button has `aria-label="Dismiss resume card"`

## 11. States

### Empty states
- **No courses yet** (shouldn't happen post-launch): Show "Courses coming soon" placeholder
- **No featured chapters**: Hide section entirely
- **No recent updates**: Hide section entirely
- **No progress in localStorage**: Hide "Continue Reading" section

### Error states
- Build-time errors fail the deploy (no runtime fetch = no runtime errors)

## 12. Success Criteria

- [ ] Loads in < 2s on 4G (LCP target met)
- [ ] All course cards clickable and keyboard-accessible
- [ ] "Continue Reading" shows correctly for returning users
- [ ] "Featured" surfaces exactly 5-6 chapters
- [ ] Mobile layout tested at 375px, 768px, 1024px
- [ ] Passes WCAG 2.2 AA
- [ ] Meta tags complete (title, description, OG, Twitter)
- [ ] OG image generated at `/og/home.png`

## 13. Open Questions

- [ ] Should "Continue Reading" show multiple in-progress chapters (up to 3)?
- [ ] Should we add a newsletter signup section? — defer to Phase 2
- [ ] Should hero include a demo animation/SVG? — start text-only, add later
- [ ] Should we show "total articles read" stat for returning users? — defer

## 14. References

- Shared: [shared/website-overview.md](../shared/website-overview.md)
- Shared: [shared/responsive-breakpoints.md](../shared/responsive-breakpoints.md)
- Shared: [shared/seo.md](../shared/seo.md)
- Plan: [plans/pages/home.md](../../plans/pages/home.md) *(to be created)*
- Prototype: `/mnt/user-data/outputs/devnotes-prototype.html`

After saving, do NOT commit. Do NOT create any other files.