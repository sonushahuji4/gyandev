// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import mermaid from 'astro-mermaid';

import rehypePrettyCode from 'rehype-pretty-code';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// https://astro.build/config
export default defineConfig({
  site: 'https://gyandev.org',

  // Routing hygiene per shared/routing-and-urls.md:
  //   - `trailingSlash: 'never'` enforces the canonical no-slash form (spec Rule 3).
  //   - `build.format: 'file'` emits flat `<route>.html` so Cloudflare Pages serves
  //     no-slash URLs directly without the default 308 redirect from `/path` to
  //     `/path/`. See RESEARCH.md Topic 12.
  //   - `build.inlineStylesheets: 'auto'` lets Astro inline small CSS into the
  //     HTML head (PR-1.4 / performance.md §3.4). Stable default since Astro 4;
  //     kept explicit so changing the trade-off is one-file.
  //   - `image.service: sharp` is the default; explicit so adding per-service
  //     options (quality presets, remote patterns) later edits one place.
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    syntaxHighlight: false,
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [
        rehypePrettyCode,
        {
          theme: {
            light: 'github-light',
            dark: 'github-dark-dimmed',
          },
          keepBackground: true,
          defaultLang: 'plaintext',
        },
      ],
      rehypeKatex,
    ],
  },

  integrations: [
    mermaid({
      theme: 'default',
      autoTheme: true,
    }),
    mdx({
      syntaxHighlight: false,
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [
          rehypePrettyCode,
          {
            theme: {
              light: 'github-light',
              dark: 'github-dark-dimmed',
            },
            keepBackground: true,
            defaultLang: 'plaintext',
          },
        ],
        rehypeKatex,
      ],
    }),
    sitemap({
      // Per seo.md §4.8 + spec §8: exclude non-canonical routes.
      // `/revision` and `/flow` tabs point canonical to Full Notes; `/404` and
      // `/search` aren't content; `/og/*` are image endpoints, not pages.
      // Coming-soon courses are served with `noindex` and should stay out of
      // the sitemap entirely (Sprint 7 launch strategy — Node.js live first).
      // The list mirrors `status: 'coming-soon'` in `src/content/courses/*/course.mdx`;
      // when a course flips to `published`, drop its slug from this set.
      filter: (page) => {
        if (page.endsWith('/revision') || page.endsWith('/revision/')) return false;
        if (page.endsWith('/flow') || page.endsWith('/flow/')) return false;
        if (page.endsWith('/404') || page.endsWith('/404/')) return false;
        if (page.endsWith('/search') || page.endsWith('/search/')) return false;
        if (page.includes('/og/')) return false;
        const COMING_SOON = new Set(['javascript', 'reactjs', 'typescript', 'nextjs', 'dsa']);
        const m = page.match(/\/courses\/([^/?#]+)\/?$/);
        if (m && COMING_SOON.has(m[1])) return false;
        return true;
      },
      // Priority hierarchy per spec §8 table.
      serialize(item) {
        const url = item.url;
        if (url === 'https://gyandev.org/' || url === 'https://gyandev.org') {
          item.priority = 1.0;
          item.changefreq = ChangeFreqEnum.WEEKLY;
        } else if (/\/courses\/[^/]+\/[^/]+$/.test(url)) {
          // Chapter Full Notes
          item.priority = 0.8;
          item.changefreq = ChangeFreqEnum.WEEKLY;
        } else if (/\/courses\/[^/]+\/?$/.test(url)) {
          // Course overview
          item.priority = 0.9;
          item.changefreq = ChangeFreqEnum.WEEKLY;
        } else if (url.endsWith('/courses') || url.endsWith('/courses/')) {
          item.priority = 0.7;
          item.changefreq = ChangeFreqEnum.WEEKLY;
        } else if (url.endsWith('/about') || url.endsWith('/about/')) {
          item.priority = 0.5;
          item.changefreq = ChangeFreqEnum.MONTHLY;
        } else if (
          url.endsWith('/privacy') || url.endsWith('/privacy/') ||
          url.endsWith('/terms') || url.endsWith('/terms/')
        ) {
          item.priority = 0.3;
          item.changefreq = ChangeFreqEnum.YEARLY;
        } else {
          item.priority = 0.5;
          item.changefreq = ChangeFreqEnum.MONTHLY;
        }
        return item;
      },
    }),
  ],
});
