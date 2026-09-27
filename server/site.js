// The site's public address, for the link-preview thumbnail. Crawlers (Slack,
// iMessage, X) want og:image as an absolute URL, and only the deployment
// knows its domain, so index.html carries a %SITE_URL% placeholder that is
// filled in on the way out: by the Node server as it serves the page, and on
// Vercel by scripts/vercel-build.js when the site is built.

// The origin of an http(s) address, '' for an empty value, or null if the
// value is not an http(s) address at all.
export function siteOrigin(value) {
  if (!value) return '';
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
}

// Empty leaves the thumbnail root-relative (/og.jpg), which not every
// crawler resolves.
export const fillSiteUrl = (html, origin) => html.replaceAll('%SITE_URL%', origin);
