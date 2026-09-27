// The Vercel function. vercel.json rewrites every /api/* request here; the
// static site in public/ is served by Vercel directly.
//
// The rewrite also passes the original path as ?__path=, and this puts it
// back: depending on the platform version, req.url arrives either as the
// original /api/doors/7/open or as the rewrite's destination, and this way
// both work.

import { createHandler } from '../server/app.js';
import { loadCatalog } from '../server/catalog.js';
import { readConfig } from '../server/config.js';

export function restorePath(rawUrl) {
  const url = new URL(rawUrl, 'http://localhost');
  const path = url.searchParams.get('__path');
  if (path === null) return rawUrl;
  url.searchParams.delete('__path');
  return `/api/${path.replace(/^\/+/, '')}${url.search}`;
}

let handler;
let failure;

export default async function stathmas(req, res) {
  if (!handler && !failure) {
    try {
      const config = readConfig(process.env, []);
      handler = createHandler(loadCatalog({ secret: config.secret }), { ...config, serveStatic: false });
    } catch (err) {
      failure = err;
    }
  }
  if (failure) {
    // Most likely CALENDAR_SECRET is missing: say so in the function logs,
    // and keep the details out of the response.
    console.error(`Stathmas is not configured: ${failure.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Server error' }));
    return;
  }
  req.url = restorePath(req.url);
  await handler(req, res);
}
