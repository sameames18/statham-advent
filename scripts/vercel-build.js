// Vercel's build step (vercel.json "buildCommand"). Vercel serves index.html
// straight from public/, without the Node server that fills in %SITE_URL%,
// so this fills it in once, at build time, in the build's own copy.
//
// The address is SITE_URL if set, or else the project's production domain,
// which Vercel provides as VERCEL_PROJECT_PRODUCTION_URL (a bare host name).
import { readFileSync, writeFileSync } from 'node:fs';
import { fillSiteUrl, siteOrigin } from '../server/site.js';

const env = process.env;
const raw = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const origin = siteOrigin(raw);
if (origin === null) {
  console.error(`SITE_URL must be an http(s) address like https://stathmas.example.com, not "${raw}".`);
  process.exit(1);
}

const file = new URL('../public/index.html', import.meta.url);
writeFileSync(file, fillSiteUrl(readFileSync(file, 'utf8'), origin));
console.log(origin
  ? `Link previews will use ${origin}/og.jpg`
  : 'No SITE_URL or production domain: the link-preview thumbnail stays root-relative.');
