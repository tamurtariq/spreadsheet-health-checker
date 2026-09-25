import type { APIRoute } from 'astro';

// @astrojs/sitemap generates sitemap-index.xml (see astro.config.mjs), not
// sitemap.xml. Search engines and crawlers conventionally probe /sitemap.xml
// directly even when robots.txt points elsewhere, so redirect that path to
// the real sitemap index instead of letting it 404.
export const GET: APIRoute = () => {
  return new Response(null, {
    status: 301,
    headers: {
      Location: '/sitemap-index.xml',
    },
  });
};
