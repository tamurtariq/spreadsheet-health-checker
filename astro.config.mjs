import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

export default defineConfig({
  adapter: cloudflare(),
  output: 'server',
  integrations: [react()],
});