import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Note: @astrojs/cloudflare adapter is not needed for fully static output.
// Cloudflare Pages serves the dist/ folder directly with no adapter required.
// Add the adapter back only if SSR/edge functions are needed in the future.

export default defineConfig({
  site: 'https://stayinyourhometoday.com',
  output: 'static',
  integrations: [
    sitemap(),
  ],
});
