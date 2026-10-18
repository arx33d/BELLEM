import * as cheerio from 'cheerio';
import url from 'url';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

// User-Agent simulating a modern neutral browser
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Normalizes input string to a valid HTTP/HTTPS URL
 */
export function normalizeUrl(input) {
  let trimmed = input.trim();
  // Strip quotes or brackets
  trimmed = trimmed.replace(/^["'\[<(\s]+|[>"'\])\s]+$/g, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.href;
  } catch (err) {
    return null;
  }
}

/**
 * Detects technologies, libraries, and frameworks from HTML, scripts, and headers
 */
function detectTechStack($, html, headers) {
  const techs = new Set();
  const lowerHtml = html.toLowerCase();
  const headerStr = JSON.stringify(headers).toLowerCase();

  // Server & CDN
  if (headers['server']) {
    const s = headers['server'].toLowerCase();
    if (s.includes('cloudflare')) techs.add('Cloudflare');
    if (s.includes('nginx')) techs.add('Nginx');
    if (s.includes('apache')) techs.add('Apache');
    if (s.includes('caddy')) techs.add('Caddy');
    if (s.includes('openresty')) techs.add('OpenResty');
  }
  if (headers['x-powered-by']) {
    techs.add(`Powered by: ${headers['x-powered-by']}`);
  }
  if (headers['cf-ray'] || headers['cf-cache-status']) techs.add('Cloudflare CDN');
  if (headers['x-vercel-id']) techs.add('Vercel Hosting');
  if (headers['x-nf-request-id']) techs.add('Netlify Hosting');
  if (headers['x-amz-cf-id']) techs.add('AWS CloudFront');
  if (headers['fastly-debug-digest'] || headers['x-fastly-request-id']) techs.add('Fastly CDN');

  // Frontend Frameworks & Libraries
  if (lowerHtml.includes('__next') || lowerHtml.includes('/_next/')) techs.add('Next.js');
  if (lowerHtml.includes('__nuxt') || lowerHtml.includes('/_nuxt/')) techs.add('Nuxt.js');
  if (lowerHtml.includes('react') || $('[data-reactroot], [data-reactid]').length > 0) techs.add('React');
  if (lowerHtml.includes('vue.js') || lowerHtml.includes('vue.min.js') || $('[data-v-]').length > 0) techs.add('Vue.js');
  if (lowerHtml.includes('angular') || $('[ng-app], [ng-version]').length > 0) techs.add('Angular');
  if (lowerHtml.includes('svelte')) techs.add('Svelte');
  if (lowerHtml.includes('alpine.js') || lowerHtml.includes('x-data=')) techs.add('Alpine.js');
  if (lowerHtml.includes('jquery') || $('script[src*="jquery"]').length > 0) techs.add('jQuery');

  // CSS Frameworks
  if (lowerHtml.includes('tailwind') || lowerHtml.includes('tailwindcss')) techs.add('Tailwind CSS');
  if (lowerHtml.includes('bootstrap') || $('link[href*="bootstrap"]').length > 0) techs.add('Bootstrap');
  if (lowerHtml.includes('bulma')) techs.add('Bulma');
  if (lowerHtml.includes('chakra')) techs.add('Chakra UI');

  // CMS & E-Commerce
  if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes') || $('meta[name="generator"][content*="WordPress"]').length > 0) techs.add('WordPress');
  if (lowerHtml.includes('shopify') || lowerHtml.includes('cdn.shopify.com')) techs.add('Shopify');
  if (lowerHtml.includes('webflow') || $('html[data-wf-page]').length > 0) techs.add('Webflow');
  if (lowerHtml.includes('ghost.org') || $('meta[name="generator"][content*="Ghost"]').length > 0) techs.add('Ghost CMS');
  if (lowerHtml.includes('wix.com')) techs.add('Wix');
  if (lowerHtml.includes('squarespace')) techs.add('Squarespace');

  // Analytics & Marketing
  if (lowerHtml.includes('google-analytics.com') || lowerHtml.includes('googletagmanager.com') || lowerHtml.includes('gtag(')) techs.add('Google Analytics / Tag Manager');
  if (lowerHtml.includes('posthog')) techs.add('PostHog Analytics');
  if (lowerHtml.includes('segment.com') || lowerHtml.includes('analytics.js')) techs.add('Segment');
  if (lowerHtml.includes('hotjar')) techs.add('Hotjar');
  if (lowerHtml.includes('mixpanel')) techs.add('Mixpanel');
  if (lowerHtml.includes('intercom')) techs.add('Intercom Chat');
  if (lowerHtml.includes('sentry.io')) techs.add('Sentry Error Tracking');

  // Fonts
  if ($('link[href*="fonts.googleapis.com"]').length > 0) techs.add('Google Fonts');
  if ($('link[href*="use.typekit.net"]').length > 0) techs.add('Adobe Typekit');
  if ($('link[href*="font-awesome"], link[href*="fontawesome"]').length > 0) techs.add('FontAwesome');

  return Array.from(techs);
}

/**
 * Evaluates security headers
 */
function auditSecurityHeaders(headers) {
  const securityKeys = [
    { key: 'strict-transport-security', name: 'HSTS (Strict-Transport-Security)' },
    { key: 'content-security-policy', name: 'CSP (Content-Security-Policy)' },
    { key: 'x-frame-options', name: 'X-Frame-Options (Clickjacking Protection)' },
    { key: 'x-content-type-options', name: 'X-Content-Type-Options (MIME Sniffing Protection)' },
    { key: 'referrer-policy', name: 'Referrer-Policy' },
    { key: 'permissions-policy', name: 'Permissions-Policy' }
  ];

  const present = [];
  const missing = [];

  for (const item of securityKeys) {
    if (headers[item.key]) {
      present.push({ name: item.name, value: headers[item.key] });
    } else {
      missing.push(item.name);
    }
  }

  let grade = 'A';
  if (missing.length >= 4) grade = 'D';
  else if (missing.length >= 2) grade = 'C';
  else if (missing.length === 1) grade = 'B';

  return { grade, present, missing };
}

/**
 * Deep Analysis of a Website URL
 */
export async function analyzeWebsite(targetUrl) {
  const validUrl = normalizeUrl(targetUrl);
  if (!validUrl) {
    throw new Error(`Invalid URL provided: "${targetUrl}"`);
  }

  const parsedUrl = new URL(validUrl);
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response;
  try {
    response = await fetch(validUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Website request timed out after 12s: ${validUrl}`);
    }
    throw new Error(`Failed to fetch website: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Date.now() - startTime;
  const rawHeaders = {};
  response.headers.forEach((value, key) => {
    rawHeaders[key.toLowerCase()] = value;
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract Metadata
  const title = $('title').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') || 'No Title Found';

  const description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      $('meta[name="twitter:description"]').attr('content') || '';

  const canonical = $('link[rel="canonical"]').attr('href') || validUrl;
  const robots = $('meta[name="robots"]').attr('content') || 'index, follow (default)';

  // OpenGraph tags
  const ogTags = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) ogTags[prop.replace('og:', '')] = content;
  });

  // Tech stack & Security
  const technologies = detectTechStack($, html, rawHeaders);
  const securityAudit = auditSecurityHeaders(rawHeaders);

  // Assets & Structure
  const scripts = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) scripts.push(src);
  });

  const stylesheets = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) stylesheets.push(href);
  });

  const h1s = [];
  $('h1').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) h1s.push(text);
  });

  const h2s = [];
  $('h2').slice(0, 10).each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) h2s.push(text);
  });

  const internalLinks = new Set();
  const externalLinks = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const resolved = new URL(href, validUrl);
      if (resolved.hostname === parsedUrl.hostname) {
        internalLinks.add(resolved.pathname);
      } else {
        externalLinks.add(resolved.hostname);
      }
    } catch (e) {}
  });

  // Extract clean text content (strip noise)
  const clone = cheerio.load(html);
  clone('script, style, noscript, svg, nav, footer, iframe, header, form').remove();
  let cleanText = clone('body').text()
    .replace(/[ \t]+/g, ' ')
    .replace(/(\r\n|\r|\n)+/g, '\n')
    .trim();

  if (cleanText.length > 5000) {
    cleanText = cleanText.slice(0, 5000) + '... [truncated]';
  }

  return {
    url: response.url || validUrl,
    domain: parsedUrl.hostname,
    status: response.status,
    statusText: response.statusText,
    latencyMs,
    htmlSizeBytes: Buffer.byteLength(html, 'utf8'),
    title,
    description,
    canonical,
    robots,
    openGraph: ogTags,
    technologies,
    security: securityAudit,
    serverHeaders: {
      server: rawHeaders['server'] || 'Undisclosed',
      poweredBy: rawHeaders['x-powered-by'] || 'None declared',
      contentEncoding: rawHeaders['content-encoding'] || 'identity',
      cacheControl: rawHeaders['cache-control'] || 'None'
    },
    structure: {
      h1: h1s,
      h2: h2s,
      scriptsCount: scripts.length,
      stylesheetsCount: stylesheets.length,
      internalLinksCount: internalLinks.size,
      externalLinksCount: externalLinks.size,
      sampleScripts: scripts.slice(0, 8),
      sampleStylesheets: stylesheets.slice(0, 5)
    },
    textContent: cleanText
  };
}

/**
 * Searches the web via DuckDuckGo HTML endpoint without requiring API keys
 */
export async function searchWeb(query, maxResults = 5) {
  if (!query || typeof query !== 'string') return [];

  const cleanQuery = query.trim();
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `q=${encodeURIComponent(cleanQuery)}&b=`,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Search provider returned status: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.result').each((_, el) => {
      if (results.length >= maxResults) return false;

      const titleEl = $(el).find('.result__title a');
      const snippetEl = $(el).find('.result__snippet');
      const urlEl = $(el).find('.result__url');

      const title = titleEl.text().trim();
      let rawHref = titleEl.attr('href') || '';
      const snippet = snippetEl.text().trim();

      // DuckDuckGo redirects often look like /l/?kh=-1&uddg=https%3A%2F%2Fexample.com
      let cleanUrl = rawHref;
      if (rawHref.includes('uddg=')) {
        try {
          const match = rawHref.match(/uddg=([^&]+)/);
          if (match && match[1]) {
            cleanUrl = decodeURIComponent(match[1]);
          }
        } catch (e) {}
      } else if (rawHref.startsWith('//')) {
        cleanUrl = 'https:' + rawHref;
      }

      if (title && cleanUrl && !cleanUrl.includes('duckduckgo.com')) {
        results.push({
          title,
          url: cleanUrl,
          snippet
        });
      }
    });

    return results;
  } catch (err) {
    console.error('Web search error:', err.message);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extracts URL from user message if one is present
 */
export function extractUrlFromText(text) {
  if (!text) return null;
  // Match standard URLs or domain-like strings: e.g. https://google.com or stripe.com or www.reddit.com
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`\[\]]+/i;
  const match = text.match(urlRegex);
  if (match) {
    return normalizeUrl(match[0]);
  }

  // Also check domain words like "analyze github.com"
  const domainRegex = /\b([a-zA-Z0-9-]+\.(?:com|org|net|io|ai|co|dev|app|edu|gov|ca|fr|de|uk|info|tech|me))\b/i;
  const domainMatch = text.match(domainRegex);
  if (domainMatch) {
    return normalizeUrl(domainMatch[1]);
  }

  return null;
}
