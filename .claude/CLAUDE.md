# GyanDev — Claude Context

## Project
Technical education site. Every chapter has three synchronized views: Full Notes, Quick Revision, Flow Diagram.

## Tech Stack
- Astro 6 + MDX + TypeScript
- Tailwind CSS v4
- Shiki for code highlighting
- Pagefind for search
- Mermaid + KaTeX for diagrams
- Cloudflare Pages for hosting
- No backend, no database (Phase 1)
- Content stored as MDX in `content/courses/`

## Code Standards
- TypeScript strict mode
- No `any` types without comment justifying
- Components in `src/components/` grouped by purpose
- All content validated via Zod schemas in `src/content/config.ts`
- Commit messages: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)

## File Conventions
- Astro components: PascalCase (`ChapterNav.astro`)
- Utilities: camelCase (`progress.ts`)
- MDX content: kebab-case folders (`01-event-loop/`)
- CSS custom properties: kebab-case (`--text-muted`)

## Content Structure