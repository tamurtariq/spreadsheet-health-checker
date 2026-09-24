import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Authenticated/utility pages aren't content to index - keep the public
// sitemap limited to marketing/tool pages.
const EXCLUDED_FROM_SITEMAP = ['/dashboard', '/login', '/email-prefs', '/auth/verify'];

export default defineConfig({
  site: 'https://tools.foviq.com',
  adapter: cloudflare(),
  output: 'server',
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '') || '/';
        return !EXCLUDED_FROM_SITEMAP.includes(path);
      },
    }),
  ],
});