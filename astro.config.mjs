import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://tools.foviq.com';

// Authenticated/utility pages aren't content to index - keep the public
// sitemap limited to marketing/tool pages.
const EXCLUDED_FROM_SITEMAP = ['/dashboard', '/login', '/email-prefs', '/auth/verify'];

// blog/[slug].astro is a plain SSR dynamic route (see the comment in that
// file for why it isn't prerendered), so @astrojs/sitemap can't discover
// individual posts from the build manifest the way it does static pages.
// List them explicitly via customPages instead, derived from the same
// content directory the glob() loader in content.config.ts reads.
const BLOG_CONTENT_DIR = fileURLToPath(new URL('./src/content/blog', import.meta.url));
const blogPostUrls = readdirSync(BLOG_CONTENT_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => `${SITE}/blog/${file.replace(/\.md$/, '')}/`);

export default defineConfig({
  site: SITE,
  adapter: cloudflare(),
  output: 'server',
  integrations: [
    react(),
    sitemap({
      customPages: blogPostUrls,
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '') || '/';
        return !EXCLUDED_FROM_SITEMAP.includes(path);
      },
    }),
  ],
});