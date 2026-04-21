# SEO Spec — Placeholder (content coming)
Replace the contents of .claude/specs/shared/seo.md with this exact content:

---
title: GyanDev — SEO Standards
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
applies_to: all pages
---

# SEO Standards

This spec defines how GyanDev pages are optimized for search engines and social sharing. Every page must implement these standards — SEO is a ranking factor, and a technical education site that doesn't rank is invisible.

## 1. Why SEO Matters

- **Discovery**: 95%+ of educational content traffic comes from organic search
- **Trust**: Users trust content that ranks well
- **Free**: Unlike paid acquisition, good SEO compounds over time
- **Durable**: A well-optimized chapter ranks for years with minimal maintenance

## 2. Meta Tag Requirements

Every page must have these meta tags in `<head>`:

### Required tags
```html
<!-- Primary -->
<title>Origin Story — Node.js — GyanDev</title>
<meta name="description" content="Why Ryan Dahl created Node.js in 2009: the Apache C10K problem, the bet on V8, and the event-driven revolution that changed server-side JavaScript.">
<link rel="canonical" href="https://gyandev.org/courses/nodejs/origin-story">

<!-- Character encoding and viewport -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- Robots -->
<meta name="robots" content="index, follow, max-image-preview:large">

<!-- Theme for mobile browsers -->
<meta name="theme-color" content="#faf7f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#131210" media="(prefers-color-scheme: dark)">
```

### Title rules
- **Format**: `[Specific Topic] — [Course (if applicable)] — GyanDev`
- **Length**: Under 60 characters (Google truncates at ~600px)
- **Unique per page**: Never duplicate titles
- **Front-load keywords**: Most important word first
- **No clickbait**: Descriptive, honest

### Description rules
- **Length**: 150-155 characters ideal (Google shows ~160)
- **Unique per page**: Auto-generated from frontmatter `description` field
- **Action-oriented**: "Learn how to…", "Understand why…", "Master the…"
- **Include primary keyword** naturally (no stuffing)

## 3. Open Graph (Facebook, LinkedIn, WhatsApp, Slack)

Social sharing metadata — affects how links preview on social platforms.

```html
<!-- Basic OG -->
<meta property="og:title" content="Origin Story — Node.js">
<meta property="og:description" content="Why Ryan Dahl created Node.js in 2009...">
<meta property="og:type" content="article">
<meta property="og:url" content="https://gyandev.org/courses/nodejs/origin-story">
<meta property="og:site_name" content="GyanDev">
<meta property="og:locale" content="en_US">

<!-- OG Image (required — 1200×630) -->
<meta property="og:image" content="https://gyandev.org/og/nodejs-origin-story.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Node.js Origin Story — GyanDev">

<!-- Article-specific (for chapter pages) -->
<meta property="article:published_time" content="2026-04-20T10:00:00Z">
<meta property="article:modified_time" content="2026-04-20T15:30:00Z">
<meta property="article:author" content="https://gyandev.org/about">
<meta property="article:section" content="Node.js">
<meta property="article:tag" content="nodejs">
<meta property="article:tag" content="history">
```

## 4. Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@gyandev">
<meta name="twitter:creator" content="@sonushahuji4">
<meta name="twitter:title" content="Origin Story — Node.js">
<meta name="twitter:description" content="Why Ryan Dahl created Node.js in 2009...">
<meta name="twitter:image" content="https://gyandev.org/og/nodejs-origin-story.png">
<meta name="twitter:image:alt" content="Node.js Origin Story — GyanDev">
```

## 5. OG Image Generation

Every page has a unique OG image (1200×630 PNG).

### Strategy
- **Auto-generated at build time** via `@vercel/og` or Satori
- Template includes: title, course name, author, GyanDev logo
- Cached at CDN edge — regenerated only when content changes

### OG image design
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  Node.js  •  Chapter 1                                 │
│                                                        │
│  The Origin Story                                      │
│  ───────────────────                                   │
│                                                        │
│  Why Ryan Dahl created Node.js in 2009:                │
│  the Apache C10K problem and the bet on V8.            │
│                                                        │
│  ────────────────────────────────                      │
│  Sonu Shahuji                       GyanDev logo       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Fallback
If auto-generation fails at build, use a default OG image: `/og/default.png`.

## 6. Structured Data (JSON-LD)

Schema.org structured data helps search engines understand content type.

### Every page: WebSite schema (in homepage only)
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "GyanDev",
  "url": "https://gyandev.org",
  "description": "Deep notes for modern developers",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://gyandev.org/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

### Chapter pages: TechArticle schema
```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Origin Story",
  "description": "Why Ryan Dahl created Node.js in 2009...",
  "author": {
    "@type": "Person",
    "name": "Sonu Shahuji",
    "url": "https://gyandev.org/about"
  },
  "datePublished": "2026-04-20T10:00:00Z",
  "dateModified": "2026-04-20T15:30:00Z",
  "publisher": {
    "@type": "Organization",
    "name": "GyanDev",
    "logo": {
      "@type": "ImageObject",
      "url": "https://gyandev.org/logo.png"
    }
  },
  "image": "https://gyandev.org/og/nodejs-origin-story.png",
  "mainEntityOfPage": "https://gyandev.org/courses/nodejs/origin-story",
  "articleSection": "Node.js",
  "keywords": "nodejs, history, v8, event-loop",
  "inLanguage": "en-US",
  "proficiencyLevel": "Beginner",
  "dependencies": "JavaScript basics",
  "timeRequired": "PT15M"
}
```

### Course overview pages: Course schema
```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Node.js",
  "description": "Server-side JavaScript from V8 internals to production patterns",
  "provider": {
    "@type": "Organization",
    "name": "GyanDev",
    "sameAs": "https://gyandev.org"
  },
  "courseCode": "nodejs",
  "educationalLevel": "Intermediate",
  "about": "Node.js runtime, event loop, modules, streams",
  "timeRequired": "PT10H",
  "inLanguage": "en-US",
  "isAccessibleForFree": true,
  "hasCourseInstance": {
    "@type": "CourseInstance",
    "courseMode": "online",
    "courseWorkload": "PT10H"
  }
}
```

### Breadcrumb schema (every page with nav)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://gyandev.org"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Courses",
      "item": "https://gyandev.org/courses"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Node.js",
      "item": "https://gyandev.org/courses/nodejs"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Origin Story",
      "item": "https://gyandev.org/courses/nodejs/origin-story"
    }
  ]
}
```

## 7. Canonical URLs

Covered in detail in `routing-and-urls.md`. Summary:

- Every page declares canonical URL
- Chapter Revision/Flow tabs point canonical to Full Notes
- Full Notes is the "source of truth" for search ranking

## 8. Sitemap

### Auto-generated via `@astrojs/sitemap`
- Path: `/sitemap-index.xml`
- Includes every published page
- Excludes: `/404`, `/search`, draft pages
- Updated on every build

### Per-page metadata
```xml
<url>
  <loc>https://gyandev.org/courses/nodejs/origin-story</loc>
  <lastmod>2026-04-20</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

### Priority hierarchy
| Page type | Priority |
|---|---|
| Home | 1.0 |
| Course overviews | 0.9 |
| Chapter pages (Full Notes) | 0.8 |
| All Courses | 0.7 |
| About | 0.5 |
| Privacy / Terms | 0.3 |
| Chapter Revision/Flow tabs | (excluded — canonical points to Full Notes) |

### Submission
- Submit `/sitemap-index.xml` to Google Search Console on launch
- Submit to Bing Webmaster Tools
- Ping on content update via IndexNow API (Cloudflare handles this)

## 9. Robots.txt

```
# /public/robots.txt
User-agent: *
Allow: /

# Block search page (not useful content)
Disallow: /search

# Block admin paths (if any ever exist)
Disallow: /admin

# Sitemap location
Sitemap: https://gyandev.org/sitemap-index.xml
```

### Phase 1 philosophy
- Allow all crawlers by default
- Block only non-content paths
- No AI-crawler blocks (we want ChatGPT/Claude citations — free traffic)

### Phase 2 (if needed)
May add specific AI crawler policies based on traffic patterns.

## 10. RSS / Atom / JSON Feed

### Three feed formats
```
/rss.xml       — RSS 2.0 (traditional readers)
/atom.xml      — Atom 1.0 (more modern RSS)
/feed.json     — JSON Feed 1.1 (developer-friendly)
```

### Per-course feeds (Phase 2)
```
/courses/nodejs/rss.xml
/courses/nodejs/atom.xml
/courses/nodejs/feed.json
```

### Feed contents
- Latest 20 chapters across all courses
- Full content (not just excerpts — readers prefer full text)
- Canonical URLs only (Full Notes)
- Author attribution
- `<link rel="alternate">` tags in HTML `<head>` for discovery

### HTML discovery tags
```html
<link rel="alternate" type="application/rss+xml" title="GyanDev RSS" href="https://gyandev.org/rss.xml">
<link rel="alternate" type="application/atom+xml" title="GyanDev Atom" href="https://gyandev.org/atom.xml">
<link rel="alternate" type="application/feed+json" title="GyanDev JSON Feed" href="https://gyandev.org/feed.json">
```

## 11. Internal Linking Strategy

### Rules
- **Every chapter links to** its course overview + previous/next chapter
- **Use descriptive anchor text** — not "click here"
- **Link to prerequisites** explicitly ("Before reading this, see [X]")
- **Cross-link between courses** when topics overlap (e.g., "See also: JavaScript closures")

### Anchor text examples
| ✅ Good | ❌ Bad |
|---|---|
| "The event loop's phases are detailed in [libuv & Async I/O](...)" | "Read more [here](...)" |
| "See the [Node.js course overview](...) for prerequisites" | "[Click here](...) for the course" |

### "Related chapters" section
Every chapter page has a "Related" block at the bottom:
- 3-5 chapters from same course
- Bonus: 1-2 from different courses with shared tags
- Auto-generated from frontmatter `tags` field

## 12. URL Semantics

URLs themselves are SEO signals. Our conventions (detailed in `routing-and-urls.md`) produce clean, keyword-rich URLs:

```
✅ gyandev.org/courses/nodejs/event-loop
❌ gyandev.org/page?id=42
❌ gyandev.org/nodejs-chapter-6-article.html
```

## 13. Content Optimization

### Heading hierarchy
- One `<h1>` per page = primary keyword phrase
- `<h2>` sections break up content (secondary keywords)
- `<h3>` for sub-topics

### Keyword placement
- Primary keyword in: Title, H1, first paragraph, URL, meta description, OG title
- Don't keyword-stuff — write naturally

### Content freshness
- Update `updated_at` frontmatter when content changes materially
- `lastmod` in sitemap reflects real updates (not cosmetic)
- Annual review of evergreen content

### Length guidelines
- **Chapter Full Notes**: 1,500-4,000 words typical
- **Quick Revision**: 200-500 words
- **Flow Diagram page**: Minimal text, diagram-focused
- **Course overviews**: 500-1,000 words

Note: Word count is not a ranking factor directly. Depth and utility are.

## 14. Image SEO

### File naming
- ✅ `node-event-loop-phases.svg`
- ❌ `image1.png`, `IMG_4523.jpg`

### Alt text (also covered in accessibility.md)
- Descriptive, natural language
- Include keywords when contextually appropriate
- Never keyword-stuff alt attributes

### Image sitemap (Phase 2)
Currently not needed. If we add many infographics, consider `image:image` in sitemap.

## 15. Mobile-First Indexing

Google uses mobile version for ranking. We must:
- Show same content on mobile and desktop (no desktop-only sections)
- Structured data consistent across breakpoints
- All internal links accessible on mobile
- Touch targets meet WCAG (covered in accessibility.md)

## 16. Core Web Vitals as Ranking Factor

CWV targets are covered in `performance.md`. For SEO:
- Pages with "Poor" CWV get ranking penalty
- Pages with "Good" CWV get minor ranking boost
- Monitor Search Console's CWV report weekly

## 17. Analytics and Search Console

### Google Search Console (mandatory)
- Verify ownership via DNS TXT record
- Submit sitemap on launch
- Monitor: Coverage, Performance, Core Web Vitals, Enhancements
- Fix every "Error" status immediately

### Bing Webmaster Tools
- Same setup as Google
- Lower priority but free traffic

### Cloudflare Web Analytics
- Privacy-first RUM data
- Pageviews, top pages, referrers
- No cookies, no banner needed

### What NOT to use
- ❌ Google Analytics (privacy concerns, cookie banner required)
- ❌ Facebook Pixel
- ❌ Any tracker requiring consent

## 18. International SEO (Phase 3+)

When we add locales:
- `hreflang` tags for each language version
- Locale-specific sitemaps: `/sitemap-en.xml`, `/sitemap-hi.xml`
- Canonical URLs self-reference per locale

Not needed in Phase 1.

## 19. Common SEO Anti-Patterns to Avoid

### Don't do these
- ❌ Duplicate content across pages
- ❌ Hidden text (white on white, `display: none` for SEO)
- ❌ Keyword stuffing
- ❌ Deceptive redirects
- ❌ Thin content (chapters under 500 words with no depth)
- ❌ Clickbait titles that mismatch content
- ❌ Auto-generated low-quality content
- ❌ Doorway pages
- ❌ Link farms / paid link schemes

## 20. SEO Checklist (Per Page)

Before any page ships:

### Meta tags
- [ ] Unique, descriptive title (< 60 chars)
- [ ] Unique meta description (< 155 chars)
- [ ] Canonical URL declared
- [ ] Robots meta tag set correctly
- [ ] OG tags complete (title, description, image, type)
- [ ] Twitter Card tags complete
- [ ] OG image exists and is 1200×630

### Structured data
- [ ] JSON-LD schema present (WebSite / TechArticle / Course as applicable)
- [ ] BreadcrumbList schema on nav pages
- [ ] Validated via schema.org validator

### Content
- [ ] One H1 per page
- [ ] Logical heading hierarchy (no skips)
- [ ] Primary keyword in title, H1, first paragraph
- [ ] Internal links with descriptive anchor text
- [ ] External links (when used) with proper attributes

### Technical
- [ ] Page in sitemap (or explicitly excluded)
- [ ] No broken internal links
- [ ] Canonical URL accessible (not 404)
- [ ] No `noindex` unless intentional
- [ ] Fast (meets CWV targets)

## 21. Success Criteria

This spec is complete when:
- [ ] All meta tag requirements automated via Astro layouts
- [ ] OG image generation pipeline working
- [ ] Structured data validated for every page type
- [ ] Sitemap auto-generated and submitted
- [ ] Search Console set up and monitored
- [ ] Per-page SEO checklist integrated into content review

## 22. Open Questions

- [ ] Do we add FAQ schema to chapters with Q&A sections? — evaluate Phase 2
- [ ] Course ratings/reviews schema (requires user reviews — Phase 3+)
- [ ] Video schema when we add videos? — not Phase 1
- [ ] `NewsArticle` for blog posts? — no blog planned

## 23. References

- Google Search Central: https://developers.google.com/search/docs
- Schema.org TechArticle: https://schema.org/TechArticle
- Schema.org Course: https://schema.org/Course
- OG Protocol: https://ogp.me/
- JSON-LD Playground: https://json-ld.org/playground/
- Rich Results Test: https://search.google.com/test/rich-results
- Spec: [shared/routing-and-urls.md](routing-and-urls.md)
- Spec: [shared/performance.md](performance.md)
- Spec: [shared/accessibility.md](accessibility.md)
- Plan: [plans/shared/seo.md](../../plans/shared/seo.md) *(to be created)*

After saving, do NOT commit. Do NOT create any other files. Just overwrite this file and confirm.