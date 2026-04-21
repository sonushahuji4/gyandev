# All Courses Page Spec — Placeholder (content coming)
Replace the contents of .claude/specs/pages/all-courses.md with this exact content:

---
title: GyanDev — All Courses Page Spec
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
route: /courses
phase: 1
---

# All Courses Page

The course catalog — a single page listing every course on GyanDev with filtering options.

## 1. Purpose

1. **Catalog view** of all available courses
2. **Filter/sort** to find relevant courses
3. **Progression indicator** for returning readers (which courses they've started)

## 2. Target Audience

- Visitors browsing courses before committing
- Returning readers checking progress across courses
- Search traffic landing on "learn X" queries

## 3. Page Sections

### Section 1: Page Header

```
┌──────────────────────────────────────────────┐
│  Breadcrumbs: Home > Courses                 │
│                                              │
│  All Courses                                 │
│  Everything we teach, in depth.              │
│                                              │
│  [X courses · Y chapters · Z hours total]    │
└──────────────────────────────────────────────┘
```

- H1: "All Courses"
- Sub-line with short pitch
- Stats bar: total courses, total chapters, total reading time

### Section 2: Filter Bar (Phase 2)

Defer to Phase 2. For Phase 1, no filters — simple grid.

When built (Phase 2):
```
[All] [Frontend] [Backend] [System] [DSA] [Beginner] [Intermediate] [Advanced]
```

### Section 3: Course Grid

```
┌──────────────────────────────────────────────┐
│  [Course Card] [Course Card] [Course Card]   │
│  [Course Card] [Course Card] [Course Card]   │
└──────────────────────────────────────────────┘
```

Course card (same as home page):
- Course logo/icon
- Course name
- One-line description
- Stats: chapters, reading time, difficulty
- Progress indicator if started (e.g., "3 of 12 chapters read")
- "Coming soon" badge if not published

Layout:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

Sort order:
- Published courses first
- Alphabetical within "Published" group
- "Coming soon" courses below, alphabetical

### Section 4: CTA Section (Optional)

```
┌──────────────────────────────────────────────┐
│  Want a course on something specific?        │
│  [Suggest a course on GitHub →]              │
└──────────────────────────────────────────────┘
```

Links to a GitHub issue template for course requests.

## 4. Responsive Behavior

Standard grid adaptation:
- Mobile: single column, 16px card padding
- Tablet: 2 columns, 20px gap
- Desktop: 3 columns, 24px gap

## 5. Data Sources

| Data | Source |
|---|---|
| Course list | Content Collection: all courses |
| Chapter counts | Content Collection: aggregated per course |
| Reading times | Content Collection: sum of chapter `reading_time` |
| Progress | localStorage (`gyandev:v1.progress.completed`) |

## 6. Interactions

- Course card: full-area click
- Progress indicator: shows on hover with tooltip "5 of 12 completed"
- "Coming soon" cards: disabled click (no navigation)

## 7. Meta Tags

```html
<title>All Courses — GyanDev</title>
<meta name="description" content="Browse all GyanDev courses: JavaScript, Node.js, System Design, DSA, and more. Deep notes with Full Notes, Quick Revision, and Flow Diagram views.">
<link rel="canonical" href="https://gyandev.org/courses">
```

## 8. Structured Data

`ItemList` with `Course` items:

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "Course",
      "position": 1,
      "name": "Node.js",
      "description": "Server-side JavaScript...",
      "url": "https://gyandev.org/courses/nodejs"
    },
    ...
  ]
}
```

## 9. Performance

- Static HTML (no runtime fetch)
- Course images (if used) lazy-loaded except first row
- Estimated size: < 40KB total

## 10. Accessibility

- H1: "All Courses"
- Course cards are `<a>` elements with full content as link
- Progress indicators announced to screen readers (aria-label)
- "Coming soon" cards: `aria-disabled="true"`

## 11. States

- **No published courses**: Show "Courses coming soon" hero (unlikely after launch)
- **All courses completed**: Add celebratory banner "You've completed everything! 🎉"
- **No progress data**: Normal view, no progress indicators

## 12. Success Criteria

- [ ] All published courses listed
- [ ] Cards show correct chapter counts + reading times
- [ ] Progress indicators work for returning readers
- [ ] "Coming soon" courses visually distinct and non-clickable
- [ ] Mobile/tablet/desktop layouts verified
- [ ] WCAG 2.2 AA pass

## 13. Open Questions

- [ ] Should we show course preview thumbnails (e.g., featured diagram)?
- [ ] Should completed courses move to a "Completed" section at bottom?
- [ ] Ordering: alphabetical vs difficulty vs curated?

## 14. References

- Shared: [shared/website-overview.md](../shared/website-overview.md)
- Sibling: [pages/home.md](home.md)
- Sibling: [pages/course-overview.md](course-overview.md)
- Plan: [plans/pages/all-courses.md](../../plans/pages/all-courses.md) *(to be created)*

After saving, do NOT commit. Do NOT create any other files.