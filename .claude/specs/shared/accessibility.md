# Accessibility Spec — Placeholder (content coming)
Replace the contents of .claude/specs/shared/accessibility.md with this exact content:

---
title: GyanDev — Accessibility Standards
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
applies_to: all pages
compliance_target: WCAG 2.2 Level AA
---

# Accessibility Standards

Every page on GyanDev must meet WCAG 2.2 Level AA as a floor — not a ceiling. Accessibility is a non-negotiable quality bar, not a feature.

## 1. Why This Matters

- **Legal**: EU Accessibility Act (2025), ADA in the US, UK Equality Act, India RPwD Act — all apply to public websites
- **Ethical**: 15%+ of users have some disability; excluding them is unacceptable for an educational site
- **Practical**: Accessibility overlaps with SEO, mobile UX, and keyboard users (power users)

## 2. Compliance Target

**Minimum**: WCAG 2.2 Level AA — every success criterion applies.

Three particularly important 2.2 additions:
- **2.4.11 Focus Not Obscured** — focused element must not be hidden by sticky headers
- **2.5.7 Dragging Movements** — any drag-based action has a non-drag alternative
- **2.5.8 Target Size (Minimum)** — 24×24px minimum (we exceed this with 44×44px)

**Stretch goal**: WCAG 2.2 Level AAA where low-cost (contrast 7:1 in key places, reading level).

## 3. Semantic HTML

Use HTML elements for their meaning, not just styling.

### Required landmarks on every page
```html
<header>         <!-- Site header with logo + nav -->
<nav>            <!-- Navigation (can have multiple, label them) -->
<main>           <!-- Primary content — exactly one per page -->
<aside>          <!-- Sidebars (left tree, right TOC) -->
<footer>         <!-- Site footer -->
```

### Heading hierarchy
- **Exactly one `<h1>` per page** — matches the page's primary title
- Never skip levels: h1 → h2 → h3, never h1 → h3
- Headings create an outline — test with a screen reader

### Correct vs incorrect
```html
<!-- ✅ Correct -->
<main>
  <article>
    <h1>Origin Story</h1>
    <h2>The Problem Ryan Faced</h2>
    <h3>Apache's Limitations</h3>
    <h2>The Solution</h2>
  </article>
</main>

<!-- ❌ Wrong -->
<div class="main">                  <!-- not semantic -->
  <div class="title">Origin Story</div>  <!-- no heading tag -->
  <h3>The Problem</h3>              <!-- skipped h2 -->
</div>
```

### Lists
- Use `<ul>`, `<ol>`, `<dl>` for lists — not `<div>` stacks
- Nested lists use nested `<ul>`, not indented divs

### Buttons vs links
- **Button**: triggers an action (`<button>`)
- **Link**: navigates to a URL (`<a href="...">`)
- Never use `<div onclick>` — breaks keyboard + screen readers

## 4. Keyboard Navigation

Every interactive element must be reachable and operable via keyboard.

### Required keyboard shortcuts

| Key | Action |
|---|---|
| `Tab` | Move to next focusable element |
| `Shift + Tab` | Move to previous focusable element |
| `Enter` / `Space` | Activate button or link |
| `Esc` | Close modal, drawer, or menu |
| `/` | Focus search input (global) |
| `Cmd/Ctrl + K` | Open search modal |
| `←` / `→` | Previous / next chapter (in chapter view) |
| `g then h` | Go to home (like GitHub) — optional |

### Focus trap in modals
When a modal/drawer opens:
- Focus moves to the first focusable element inside
- Tab cycles within the modal (doesn't escape to background)
- Esc closes the modal
- Focus returns to the element that triggered the modal

### Skip link (first focusable element)
```html
<a href="#main" class="skip-link">Skip to main content</a>
```
- Hidden by default, visible only when focused
- Top-left of viewport when visible
- Target ID must exist (`<main id="main">`)

### No keyboard traps
Users must always be able to Tab out of any element. No element catches focus permanently.

## 5. Focus Indicators

Every focusable element must show a clear visual focus state.

### Requirements
- **Visible outline** — minimum 2px, 3:1 contrast against background
- **Never remove outlines** without a replacement
- **Consistent across elements** — same style everywhere

### Recommended pattern
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Only remove default outline when :focus-visible is used */
:focus:not(:focus-visible) { outline: none; }
```

### WCAG 2.2 SC 2.4.11 — Focus Not Obscured
Sticky headers must not cover focused elements. Ensure scroll padding:
```css
html { scroll-padding-top: 80px; }  /* matches sticky header height */
```

## 6. Color and Contrast

### Minimum contrast ratios
| Element | Ratio | WCAG SC |
|---|---|---|
| Body text | 4.5:1 | 1.4.3 AA |
| Large text (18px+ bold, 24px+ regular) | 3:1 | 1.4.3 AA |
| UI components (buttons, icons) | 3:1 | 1.4.11 AA |
| Focus indicators | 3:1 | 2.4.7 AA |

### Both themes must pass
- Light mode: verify body text on `#faf7f0` background
- Dark mode: verify body text on `#131210` background
- Use tools: WebAIM Contrast Checker, axe DevTools, Lighthouse

### Color is never the only signal
Don't rely on color alone to convey meaning:
- ❌ "Click the green button" (colorblind users miss it)
- ✅ "Click the green **Save** button" (label + color)

### Difficulty badges
- Don't use just red/yellow/green
- Include icon + label: 🟢 Beginner, 🟡 Intermediate, 🔴 Advanced

## 7. Images and Media

### Alt text rules

| Image type | Alt text |
|---|---|
| Decorative | `alt=""` (empty, not missing) |
| Meaningful image | Describe what it shows |
| Informational diagram | Short alt + long description (aria-describedby) |
| Icon beside text label | `alt=""` (label covers it) |
| Icon-only button | `aria-label` describes action |

### Good alt text
```html
<!-- ✅ Good -->
<img src="event-loop.svg" alt="Event loop phases diagram showing timers, pending callbacks, poll, check, and close callbacks stages">

<!-- ❌ Bad -->
<img src="event-loop.svg" alt="diagram">
<img src="event-loop.svg" alt="event-loop.svg">
```

### Complex diagrams
For Mermaid/SVG diagrams, provide both short alt and longer description:
```html
<figure>
  <div role="img" aria-labelledby="fig-1-title" aria-describedby="fig-1-desc">
    <svg>...</svg>
  </div>
  <figcaption id="fig-1-title">Node.js architecture stack</figcaption>
  <p id="fig-1-desc" class="sr-only">
    A stack diagram showing JavaScript code on top, Node.js bindings in the middle,
    and V8 engine plus libuv at the bottom, connected by arrows indicating data flow.
  </p>
</figure>
```

### Icons
- Decorative icons: `aria-hidden="true"` + empty alt
- Icon buttons: `aria-label="Close menu"` or visually-hidden text
- Never rely on icon meaning alone — add label or tooltip

## 8. Forms

GyanDev has minimal forms (contact, newsletter), but must follow standards:

### Labels
- Every input has a visible `<label>` (not just placeholder)
- `for` attribute matches input `id`

```html
<!-- ✅ Correct -->
<label for="email">Email address</label>
<input type="email" id="email" name="email" required>

<!-- ❌ Wrong -->
<input type="email" placeholder="Email">  <!-- no label -->
```

### Required fields
- Marked with text ("Required") or `*` with explanation, not color
- `required` attribute + `aria-required="true"`

### Error messages
- Appear below the field, not in a toast
- Linked via `aria-describedby`
- Clear and actionable: "Enter a valid email" not "Invalid input"

## 9. Motion and Animation

### Respect `prefers-reduced-motion`
Users can opt out of animations:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Animation rules
- Nothing flashes more than 3 times per second (seizure risk)
- No auto-playing animations longer than 5 seconds
- Pause/stop controls for any video or animated content
- Smooth scroll is OK, but respect reduced motion

## 10. Screen Reader Support

### Visually-hidden utility class
For text that's only for screen readers:

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### ARIA — use sparingly
First rule of ARIA: don't use ARIA.
- Use semantic HTML whenever possible
- ARIA is a last resort for complex widgets
- Bad ARIA is worse than no ARIA

### Common patterns

**Tab panels (three-tab chapter)**:
```html
<div role="tablist" aria-label="Chapter views">
  <button role="tab" aria-selected="true" aria-controls="panel-full">Full Notes</button>
  <button role="tab" aria-selected="false" aria-controls="panel-rev">Quick Revision</button>
  <button role="tab" aria-selected="false" aria-controls="panel-flow">Flow Diagram</button>
</div>
<div id="panel-full" role="tabpanel">…</div>
<div id="panel-rev" role="tabpanel" hidden>…</div>
<div id="panel-flow" role="tabpanel" hidden>…</div>
```

**Live regions** (for dynamic updates):
```html
<div aria-live="polite" aria-atomic="true" class="sr-only">
  <!-- Content appears here, announced by screen reader -->
</div>
```

## 11. Language Declaration

### Root HTML element
```html
<html lang="en">
```

### Inline language changes
```html
<p>The French phrase <span lang="fr">je ne sais quoi</span> means…</p>
```

### Code blocks
Don't mark code as a language — screen readers handle `<pre><code>` correctly.

## 12. Page Titles

Every page must have a unique, descriptive title.

### Format
```
<Page Topic> — <Course (if applicable)> — GyanDev
```

### Examples
```
Origin Story — Node.js — GyanDev
All Courses — GyanDev
Privacy Policy — GyanDev
```

### Rules
- Most specific info first (not "GyanDev — Origin Story")
- Under 60 characters when possible
- Unique per page

## 13. Zoom and Text Resize

### Support up to 200% zoom
Layout must remain functional when browser zoom is 200% or text size is 200%.

Test by:
- Browser zoom `Cmd/Ctrl + +` repeatedly
- Set browser font size to largest in settings
- Verify: no horizontal scroll, no text cut off, all interactive elements reachable

### Reflow (SC 1.4.10)
At 320px viewport width with 200% zoom, content reflows to single column without loss.

## 14. Tables

### Accessible table structure
```html
<table>
  <caption>Node.js release timeline</caption>
  <thead>
    <tr>
      <th scope="col">Version</th>
      <th scope="col">Released</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Node 20</th>
      <td>April 2023</td>
      <td>Active LTS</td>
    </tr>
  </tbody>
</table>
```

### Rules
- `<caption>` describes the table's purpose
- `<th scope="col">` for column headers
- `<th scope="row">` for row headers
- Don't use tables for layout — only tabular data

## 15. Testing Protocol

### Automated testing (CI)
Run on every PR:
- **axe-core** — catches ~30% of issues
- **Lighthouse Accessibility** — must score 95+
- **Pa11y** — catches more than axe alone

### Manual testing (before ship)
- [ ] Navigate entire page with keyboard only (unplug mouse)
- [ ] Use screen reader for one full page walkthrough:
  - macOS: VoiceOver (Cmd + F5)
  - Windows: NVDA (free)
  - iOS: VoiceOver
  - Android: TalkBack
- [ ] Zoom browser to 200% — verify no broken layout
- [ ] Enable Windows High Contrast mode — verify readability
- [ ] Test in grayscale — no meaning lost without color

### User testing
- Recruit real users with disabilities quarterly
- Pay for their time ($75+/hour)
- NOT optional — automated tests miss real issues

## 16. Excluded WCAG Criteria (Explicit Decisions)

### Not applicable
- **1.2 Time-based Media** — no audio/video content currently
- **1.3.4 Orientation** — site works in both orientations
- **2.1.4 Character Key Shortcuts** — we use modifier-based shortcuts only

### Deferred (not Phase 1)
- **1.4.13 Content on Hover** — Phase 2 when we add tooltips
- **4.1.3 Status Messages** — Phase 2 when we add real-time updates

## 17. Success Criteria

This spec is complete when:
- [ ] All pages pass automated axe-core checks (zero critical issues)
- [ ] Lighthouse Accessibility score ≥ 95 on all pages
- [ ] One full keyboard-only walkthrough completed per page type
- [ ] One screen reader walkthrough completed per page type
- [ ] 200% zoom tested on all pages
- [ ] Manual contrast check for both themes
- [ ] Focus indicators visible everywhere
- [ ] Every image has appropriate alt text

## 18. Open Questions

- [ ] Do we provide a dedicated accessibility statement page? — recommend yes, Phase 1
- [ ] Should we offer a dyslexia-friendly font toggle? — Atkinson Hyperlegible as option in Phase 2
- [ ] Should we support custom focus ring colors? — defer

## 19. Resources

- WCAG 2.2 Quick Reference: https://www.w3.org/WAI/WCAG22/quickref/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- axe DevTools: https://www.deque.com/axe/devtools/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- A11y Project Checklist: https://www.a11yproject.com/checklist/
- Inclusive Components (Heydon Pickering): https://inclusive-components.design/

## 20. References

- Spec: [shared/website-overview.md](website-overview.md)
- Spec: [shared/responsive-breakpoints.md](responsive-breakpoints.md)
- Plan: [plans/shared/accessibility.md](../../plans/shared/accessibility.md) *(to be created)*

After saving, do NOT commit. Do NOT create any other files. Just overwrite this file and confirm.