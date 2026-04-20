// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import mermaid from 'astro-mermaid';

import rehypePrettyCode from 'rehype-pretty-code';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// https://astro.build/config
export default defineConfig({
  site: 'https://gyandev.org',

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
    sitemap(),
  ],
});
