# Legal Page Spec — Placeholder (content coming)
Replace the contents of .claude/specs/pages/legal.md with this exact content:

---
title: GyanDev — Legal Pages Spec (Privacy + Terms)
status: draft
owner: sonushahuji4
created: 2026-04-20
updated: 2026-04-20
routes:
  - /privacy
  - /terms
phase: 1
---

# Legal Pages — Privacy Policy & Terms of Use

Two simple legal pages required for GDPR, UK-DPA, CCPA, and India DPDPA compliance. Both use the same layout and follow the same structural pattern.

## 1. Purpose

1. **Legal compliance** — required by GDPR, CCPA, DPDPA
2. **Transparency** — explain what data we collect (very little) and why
3. **Trust** — signal that we respect user privacy
4. **Safe harbor** — set terms of use for content

## 2. Target Audience

- EU visitors (GDPR triggers)
- California visitors (CCPA)
- Indian visitors (DPDPA 2023)
- Compliance auditors
- Concerned privacy-focused users

## 3. Shared Layout (LegalLayout)

Both pages use identical structure:

```
┌──────────────────────────────────────────────┐
│  Breadcrumbs: Home > Privacy (or Terms)      │
│                                              │
│  Privacy Policy (or Terms of Use)            │
│  Last updated: Apr 20, 2026                  │
│                                              │
│  [Table of Contents]                         │
│  • Section 1                                 │
│  • Section 2                                 │
│  • ...                                       │
│                                              │
│  ────────────────────                        │
│                                              │
│  [Content sections]                          │
│                                              │
│  ────────────────────                        │
│                                              │
│  Contact: privacy@gyandev.org                │
└──────────────────────────────────────────────┘
```

Single-column prose. Max-width 720px. No sidebars.

## 4. Privacy Policy Content

### Section 1: Introduction
- Who we are (GyanDev, operated by Sonu Shahuji)
- Contact email (privacy@gyandev.org)
- Last updated date
- Effective date

### Section 2: What We Collect
- **Nothing by default** — no accounts, no forms, no cookies for identification
- **localStorage only** — your reading progress, theme preference, bookmarks
- **Cloudflare Analytics** — anonymous, cookie-less pageview counts (IPs truncated)
- **Giscus comments** — if you comment, GitHub profile is visible per their policy

### Section 3: What We Do NOT Collect
- No personal information (name, email) unless you contact us
- No tracking cookies
- No third-party trackers (no Google Analytics, Facebook, etc.)
- No fingerprinting
- No sale of data (we have nothing to sell)

### Section 4: Cookies and Similar Technologies
- **Essential** (theme preference): localStorage, not cookies
- **Analytics**: Cloudflare Web Analytics uses no cookies
- **Third-party** (Giscus): GitHub cookies when you interact — their policy applies
- **No marketing cookies**
- **No cookie banner needed** — we use no cookies requiring consent

### Section 5: How Your Data Is Used
- localStorage: only your browser holds it; never sent to our servers
- Cloudflare Analytics: aggregate stats for improving content
- Giscus comments: visible publicly as you post them

### Section 6: Data Sharing
- We don't share your data — we have nothing to share
- Giscus comments are public on GitHub Discussions
- Cloudflare is a data processor (processes analytics on our behalf)

### Section 7: Your Rights
Depending on your jurisdiction, you may have rights to:
- Access your data (we have none stored)
- Delete your data (clear your localStorage anytime)
- Object to processing (disable localStorage in your browser)
- Data portability (export your progress JSON from /settings — Phase 2)

To exercise rights: email privacy@gyandev.org.

### Section 8: Children's Privacy
- Not directed at children under 13 (COPPA / GDPR-K)
- Don't knowingly collect data from minors
- Parents: contact us if concerned

### Section 9: International Data Transfers
- Our site is served via Cloudflare (global edge)
- Static content served from nearest edge
- No personal data transferred cross-border by us

### Section 10: Security
- HTTPS enforced everywhere
- No data stored server-side = no data to breach
- GitHub/Cloudflare security practices apply

### Section 11: Changes to This Policy
- We may update this policy
- Material changes: announced via RSS + GitHub repo
- "Last updated" date at top reflects latest change

### Section 12: Jurisdiction
- Operator based in India
- This policy aims to comply with GDPR, CCPA, DPDPA, UK-DPA
- Disputes governed by Indian law unless your local law applies

### Section 13: Contact
```
Privacy concerns: privacy@gyandev.org
General contact: hello@gyandev.org
Response time: usually within 48 hours
```

## 5. Terms of Use Content

### Section 1: Acceptance of Terms
By using GyanDev, you agree to these terms.

### Section 2: License to You
**Content** is licensed under Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0):
- You may share and adapt the content
- You must give attribution
- You must share under the same license

**Code samples** are licensed under MIT:
- Use freely in your projects
- Include copyright notice

Full licenses: link to LICENSE files in GitHub repo.

### Section 3: Your License to Us (for Contributions)
If you contribute content via GitHub PR:
- You grant us a perpetual, irrevocable, worldwide, royalty-free license
- Your contribution is automatically licensed CC BY-SA 4.0 (for prose) or MIT (for code)
- You retain copyright to your contribution
- You confirm you have the right to grant this license

### Section 4: Acceptable Use
You agree not to:
- Scrape content for commercial resale without respecting CC BY-SA
- Claim the content as your original work (attribution required)
- Use content to build competing AI training datasets without disclosure
- Attempt to disrupt the site (DDoS, exploit vulnerabilities)
- Violate applicable laws

### Section 5: No Warranty
Content is provided "as is" without warranty:
- No guarantee of accuracy (though we try hard)
- Code samples are for education, not production
- We disclaim liability for any damages from using the content

### Section 6: External Links
We link to other sites (MDN, Node docs, etc.). We don't endorse or control those sites.

### Section 7: Third-Party Services
- GitHub (hosting, comments): their terms apply
- Cloudflare (CDN, analytics): their terms apply
- Beehiiv (newsletter, Phase 2): their terms apply when you subscribe

### Section 8: Intellectual Property
- "GyanDev" name and logo are trademarks of Sonu Shahuji
- Content attribution required under CC BY-SA
- Report copyright violations to dmca@gyandev.org

### Section 9: Indemnification
You agree to indemnify us from claims arising from your misuse of the site or violation of these terms.

### Section 10: Termination
We may remove contributions that violate these terms or applicable laws.

### Section 11: Changes to Terms
We may update these terms. Continued use = acceptance of new terms. Material changes announced via RSS + GitHub.

### Section 12: Governing Law
- Operator based in India
- Disputes governed by Indian law
- Jurisdiction: courts in Mumbai, Maharashtra, India

### Section 13: Contact
```
Legal/terms: legal@gyandev.org
Copyright/DMCA: dmca@gyandev.org
General: hello@gyandev.org
```

## 6. Meta Tags

### Privacy
```html
<title>Privacy Policy — GyanDev</title>
<meta name="description" content="GyanDev's privacy policy. We collect almost nothing: no accounts, no cookies for identification, no third-party trackers.">
<link rel="canonical" href="https://gyandev.org/privacy">
```

### Terms
```html
<title>Terms of Use — GyanDev</title>
<meta name="description" content="GyanDev's terms of use. Content is CC BY-SA 4.0, code is MIT. Attribution required.">
<link rel="canonical" href="https://gyandev.org/terms">
```

## 7. Responsive Behavior

- Mobile: full width, 16px padding
- Desktop: centered 720px column
- TOC sticks to top when scrolling (Phase 2)

## 8. Data Sources

- Content: hard-coded in MDX files (privacy.mdx, terms.mdx)
- Last updated: frontmatter `updated_at` field
- Linked from every page footer

## 9. Accessibility

- H1: page title
- H2 for each numbered section
- TOC links to section anchors
- Semantic ordered list for numbered sections

## 10. Success Criteria

- [ ] Privacy policy reviewed for GDPR compliance
- [ ] Terms reviewed for CC BY-SA + MIT compatibility
- [ ] Last updated date in frontmatter matches content
- [ ] Contact emails are real and monitored
- [ ] Links to LICENSE files in repo work
- [ ] Readable in 5 minutes (not legalese)

## 11. Open Questions

- [ ] Do we need a separate Cookie Policy? — probably no, since we use no cookies
- [ ] Do we need an Imprint page (German TMG §5)? — yes, if we see German traffic
- [ ] Should we add a privacy changelog showing policy history?
- [ ] Do we need a formal DPA (Data Processing Agreement) with Cloudflare?

## 12. References

- Shared: [shared/website-overview.md](../shared/website-overview.md)
- Plan: [plans/pages/legal.md](../../plans/pages/legal.md) *(to be created)*
- Cloudflare DPA: https://www.cloudflare.com/cloudflare-customer-dpa/
- GDPR: https://gdpr.eu/
- CCPA: https://oag.ca.gov/privacy/ccpa

After saving, do NOT commit. Do NOT create any other files.