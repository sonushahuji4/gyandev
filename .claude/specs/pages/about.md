# About Page Spec — Placeholder (content coming)
Replace the contents of .claude/specs/pages/about.md with this exact content:

---
title: GyanDev — About Page Spec
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
route: /about
phase: 1
---

# About Page

The "who and why" of GyanDev. Builds trust with readers landing from search or social, and introduces the author.

## 1. Purpose

1. **Establish trust** — who runs this, what are their credentials?
2. **Explain the philosophy** — why three-tab content, why free, why open source?
3. **Show the mission** — what problem we're solving
4. **Enable contact** — how to reach the author or contribute

## 2. Target Audience

- Visitors evaluating whether to trust the content
- Journalists/bloggers seeking site info
- Potential contributors
- Job recruiters (yes, really)

## 3. Page Sections

### Section 1: Hero

```
┌──────────────────────────────────────────────┐
│  About GyanDev                               │
│                                              │
│  Deep notes for modern developers —          │
│  built by developers, for developers.        │
└──────────────────────────────────────────────┘
```

- H1: "About GyanDev"
- One-line tagline

### Section 2: Why This Exists

```
┌──────────────────────────────────────────────┐
│  Why GyanDev                                 │
│                                              │
│  Most technical content falls into two       │
│  traps: shallow tutorials that don't         │
│  explain why, or dense docs that assume      │
│  you already know...                         │
│                                              │
│  GyanDev is built on three beliefs:          │
│  1. Deep understanding over surface tips     │
│  2. One concept, multiple learning modes     │
│  3. Free forever, open forever               │
└──────────────────────────────────────────────┘
```

- 2-3 paragraphs explaining the motivation
- Three-belief list

### Section 3: The Three-Tab Model

```
┌──────────────────────────────────────────────┐
│  Why Three Tabs Per Chapter                  │
│                                              │
│  Every chapter has:                          │
│                                              │
│  📖 Full Notes                               │
│     Deep study when you have time            │
│                                              │
│  ⚡ Quick Revision                           │
│     Fast recap before interviews             │
│                                              │
│  🔄 Flow Diagram                             │
│     Visual recall for big-picture            │
│                                              │
│  Same content. Three cognitive modes.        │
│  You pick what you need, when you need it.  │
└──────────────────────────────────────────────┘
```

- Visual breakdown of the three modes
- Explanation of when to use which

### Section 4: Who Runs This

```
┌──────────────────────────────────────────────┐
│  Who Runs GyanDev                            │
│                                              │
│  [Avatar]                                    │
│                                              │
│  Sonu Shahuji                                │
│  Software Engineer · Mumbai, India           │
│                                              │
│  Short bio (2-3 sentences)                   │
│                                              │
│  [LinkedIn] [GitHub] [Twitter]               │
└──────────────────────────────────────────────┘
```

- Author photo (optional)
- Name, role, location
- Short credibility-building bio
- Social links

### Section 5: Open Source & License

```
┌──────────────────────────────────────────────┐
│  Open Source, Open Content                   │
│                                              │
│  GyanDev is free forever:                    │
│  • Content licensed CC BY-SA 4.0             │
│  • Code licensed MIT                         │
│  • Hosted on GitHub — PRs welcome            │
│                                              │
│  [View repo on GitHub →]                     │
└──────────────────────────────────────────────┘
```

- Explains licensing clearly
- Links to GitHub repo

### Section 6: How to Contribute

```
┌──────────────────────────────────────────────┐
│  How to Contribute                           │
│                                              │
│  • Found a typo? → Edit on GitHub            │
│  • Have a correction? → Open an issue        │
│  • Want to write a chapter? → Read CONTRIB   │
│  • Want to sponsor? → [Sponsor link]         │
└──────────────────────────────────────────────┘
```

- Actionable contribution paths
- Link to CONTRIBUTING.md (Phase 2)

### Section 7: Contact

```
┌──────────────────────────────────────────────┐
│  Contact                                     │
│                                              │
│  Email: hello@gyandev.org                    │
│  GitHub: @sonushahuji4                       │
│  Response time: usually within 48 hours      │
└──────────────────────────────────────────────┘
```

- Primary contact methods
- Expectation setting on response time

### Section 8: Changelog (Optional)

```
┌──────────────────────────────────────────────┐
│  Recent Updates                              │
│                                              │
│  • Apr 2026 — Launched Node.js course        │
│  • Mar 2026 — GyanDev rebranded from DevNotes│
│  • ...                                       │
└──────────────────────────────────────────────┘
```

- Last 5-10 notable updates
- Keeps the site feeling alive

## 4. Layout

Uses AboutLayout — editorial prose style:
- Max-width 720px (prose column)
- Generous vertical spacing between sections
- Serif headings (Instrument Serif)
- Body text at 18px, 1.6 line-height

No sidebars. Single-column read.

## 5. Responsive Behavior

- Mobile: 100% width, 16px padding
- Tablet: centered, 600px max width
- Desktop: centered, 720px max width

## 6. Data Sources

All content is hard-coded or pulled from a single `about.yml`:

```yaml
author:
  name: Sonu Shahuji
  role: Software Engineer
  location: Mumbai, India
  avatar: /images/author.jpg
  socials:
    github: https://github.com/sonushahuji4
    linkedin: https://linkedin.com/in/...
    twitter: https://twitter.com/sonushahuji4

contact:
  email: hello@gyandev.org
  response_time: "usually within 48 hours"

changelog:
  - date: 2026-04-20
    event: Launched Node.js course
  - date: 2026-03-15
    event: GyanDev rebranded from DevNotes
```

## 7. Meta Tags

```html
<title>About — GyanDev</title>
<meta name="description" content="GyanDev is a free, open-source technical education site. Deep notes on JavaScript, Node.js, System Design, and DSA. Built by Sonu Shahuji.">
<link rel="canonical" href="https://gyandev.org/about">
```

## 8. Structured Data

`AboutPage` + `Person`:

```json
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "mainEntity": {
    "@type": "Person",
    "name": "Sonu Shahuji",
    "jobTitle": "Software Engineer",
    "url": "https://gyandev.org/about",
    "sameAs": [
      "https://github.com/sonushahuji4",
      "https://linkedin.com/in/...",
      "https://twitter.com/sonushahuji4"
    ]
  }
}
```

## 9. Performance

- Static page, no JS
- If author photo included: AVIF/WebP, < 50KB
- Total page weight < 100KB

## 10. Accessibility

- H1: "About GyanDev"
- H2 for each major section
- Author photo has meaningful alt text
- Social links labeled with `aria-label` if icon-only

## 11. Success Criteria

- [ ] All sections have real content (no lorem ipsum)
- [ ] Author bio is accurate and up-to-date
- [ ] Contact email is monitored
- [ ] Social links work and point to real accounts
- [ ] GitHub repo link is correct
- [ ] Mobile layout verified

## 12. Open Questions

- [ ] Should we include a "Press / Media" section if coverage happens?
- [ ] Should we add a sponsor list (if any)?
- [ ] Should we include stats ("X readers, Y chapters, Z GitHub stars")?

## 13. References

- Shared: [shared/website-overview.md](../shared/website-overview.md)
- Sibling: [pages/legal.md](legal.md)
- Plan: [plans/pages/about.md](../../plans/pages/about.md) *(to be created)*

After saving, do NOT commit. Do NOT create any other files.