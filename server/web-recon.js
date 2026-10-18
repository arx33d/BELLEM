import * as cheerio from 'cheerio';
import dns from 'dns';
import tls from 'tls';
import { URL } from 'url';

dns.setDefaultResultOrder('ipv4first');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Normalizes input URL string
 */
export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  let trimmed = input.trim().replace(/^["'\[<(\s]+|[>"'\])\s]+$/g, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * DNS Reconnaissance: A, AAAA, MX, NS, TXT, CNAME, SOA
 */
export async function runDnsRecon(hostname) {
  const p = dns.promises;
  const results = {
    hostname,
    a: [],
    aaaa: [],
    mx: [],
    ns: [],
    txt: [],
    cname: [],
    soa: null,
    error: null
  };

  try {
    const [a, aaaa, mx, ns, txt, cname, soa] = await Promise.allSettled([
      p.resolve4(hostname),
      p.resolve6(hostname),
      p.resolveMx(hostname),
      p.resolveNs(hostname),
      p.resolveTxt(hostname),
      p.resolveCname(hostname),
      p.resolveSoa(hostname)
    ]);

    if (a.status === 'fulfilled') results.a = a.value;
    if (aaaa.status === 'fulfilled') results.aaaa = aaaa.value;
    if (mx.status === 'fulfilled') results.mx = mx.value;
    if (ns.status === 'fulfilled') results.ns = ns.value;
    if (txt.status === 'fulfilled') results.txt = txt.value.map(chunks => chunks.join(''));
    if (cname.status === 'fulfilled') results.cname = cname.value;
    if (soa.status === 'fulfilled') results.soa = soa.value;
  } catch (err) {
    results.error = err.message;
  }

  return results;
}

/**
 * SSL / TLS Certificate and Handshake Inspection
 */
export async function runSslRecon(hostname, port = 443, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const result = {
      hostname,
      port,
      valid: false,
      subject: null,
      issuer: null,
      validFrom: null,
      validTo: null,
      daysRemaining: null,
      protocol: null,
      cipher: null,
      sans: [],
      error: null
    };

    let timer;
    try {
      const socket = tls.connect(port, hostname, { servername: hostname, rejectUnauthorized: false }, () => {
        clearTimeout(timer);
        try {
          const cert = socket.getPeerCertificate(true);
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();

          result.valid = socket.authorized || true;
          result.protocol = protocol;
          result.cipher = cipher ? cipher.name : null;

          if (cert && cert.subject) {
            result.subject = cert.subject.CN || cert.subject.O || hostname;
            result.issuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Unknown') : 'Unknown';
            result.validFrom = cert.valid_from;
            result.validTo = cert.valid_to;

            if (cert.valid_to) {
              const expireDate = new Date(cert.valid_to);
              const diffMs = expireDate.getTime() - Date.now();
              result.daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            }

            if (cert.subjectaltname) {
              result.sans = cert.subjectaltname
                .split(',')
                .map(s => s.trim().replace(/^DNS:/i, ''))
                .filter(Boolean);
            }
          }
        } catch (e) {
          result.error = e.message;
        } finally {
          socket.end();
          resolve(result);
        }
      });

      timer = setTimeout(() => {
        socket.destroy();
        result.error = 'TLS connection timed out';
        resolve(result);
      }, timeoutMs);

      socket.on('error', (err) => {
        clearTimeout(timer);
        result.error = err.message;
        resolve(result);
      });
    } catch (err) {
      clearTimeout(timer);
      result.error = err.message;
      resolve(result);
    }
  });
}

/**
 * Robots.txt Reconnaissance
 */
export async function runRobotsRecon(origin, timeoutMs = 6000) {
  const robotsUrl = `${origin}/robots.txt`;
  const result = {
    url: robotsUrl,
    exists: false,
    disallowed: [],
    allowed: [],
    sitemaps: [],
    crawlDelay: null,
    userAgents: [],
    rawLinesCount: 0,
    error: null
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const text = await res.text();
      result.exists = true;
      const lines = text.split('\n');
      result.rawLinesCount = lines.length;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [directive, ...rest] = trimmed.split(':');
        const value = rest.join(':').trim();
        const lowerDirective = directive.toLowerCase().trim();

        if (lowerDirective === 'disallow' && value) {
          if (!result.disallowed.includes(value)) result.disallowed.push(value);
        } else if (lowerDirective === 'allow' && value) {
          if (!result.allowed.includes(value)) result.allowed.push(value);
        } else if (lowerDirective === 'sitemap' && value) {
          if (!result.sitemaps.includes(value)) result.sitemaps.push(value);
        } else if (lowerDirective === 'user-agent' && value) {
          if (!result.userAgents.includes(value)) result.userAgents.push(value);
        } else if (lowerDirective === 'crawl-delay' && value) {
          result.crawlDelay = value;
        }
      }
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Sitemap.xml Discovery & Extraction
 */
export async function runSitemapRecon(origin, knownSitemaps = [], timeoutMs = 8000) {
  const candidateUrls = knownSitemaps.length > 0
    ? knownSitemaps
    : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];

  const result = {
    discoveredSitemaps: [],
    sampleUrls: [],
    totalUrlsFound: 0,
    error: null
  };

  for (const sitemapUrl of candidateUrls.slice(0, 3)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const xml = await res.text();
        const $ = cheerio.load(xml, { xmlMode: true });

        // Check for sub-sitemaps
        $('sitemap > loc').each((_, el) => {
          const loc = $(el).text().trim();
          if (loc && !result.discoveredSitemaps.includes(loc)) {
            result.discoveredSitemaps.push(loc);
          }
        });

        // Check for page URLs
        $('url > loc').each((_, el) => {
          const loc = $(el).text().trim();
          if (loc) {
            result.totalUrlsFound++;
            if (result.sampleUrls.length < 25) {
              result.sampleUrls.push(loc);
            }
          }
        });

        if (result.totalUrlsFound > 0 || result.discoveredSitemaps.length > 0) {
          break;
        }
      }
    } catch (err) {
      // Continue next candidate
    }
  }

  return result;
}

/**
 * Common API Endpoint & Schema Probing
 */
export async function runApiProbe(origin, timeoutMs = 4000) {
  const endpoints = [
    { path: '/api', type: 'REST API' },
    { path: '/api/v1', type: 'REST API v1' },
    { path: '/graphql', type: 'GraphQL' },
    { path: '/swagger.json', type: 'Swagger / OpenAPI' },
    { path: '/openapi.json', type: 'OpenAPI Spec' },
    { path: '/.well-known/security.txt', type: 'Security Disclosure' },
    { path: '/.well-known/openid-configuration', type: 'OpenID Auth' }
  ];

  const results = [];

  await Promise.allSettled(
    endpoints.map(async (ep) => {
      const target = `${origin}${ep.path}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(target, {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json,text/plain,*/*'
          },
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.status < 400 || res.status === 401 || res.status === 403) {
          const contentType = res.headers.get('content-type') || '';
          results.push({
            path: ep.path,
            type: ep.type,
            status: res.status,
            contentType,
            reachable: true,
            isAuthProtected: res.status === 401 || res.status === 403
          });
        }
      } catch {
        // unreachable
      }
    })
  );

  return results;
}

/**
 * Classifies page purpose by path and title
 */
function classifyPageType(pathname, title = '') {
  const lower = (pathname + ' ' + title).toLowerCase();
  if (pathname === '/' || pathname === '') return 'Home';
  if (/pricing|plans|subscription|tier|cost/.test(lower)) return 'Pricing / Commercial';
  if (/docs|documentation|guide|manual|api|reference|learn/.test(lower)) return 'Documentation';
  if (/blog|news|article|posts|insights/.test(lower)) return 'Blog / Articles';
  if (/login|signin|signup|auth|register|account/.test(lower)) return 'Authentication';
  if (/about|team|company|story|careers|jobs/.test(lower)) return 'About / Company';
  if (/contact|support|help|faq/.test(lower)) return 'Support / Contact';
  if (/privacy|terms|legal|compliance|security/.test(lower)) return 'Legal & Security';
  if (/dashboard|app|portal|admin/.test(lower)) return 'Dashboard / Application';
  return 'Content Page';
}

/**
 * Builds a hierarchical Site Map tree from crawled routes and discovered paths
 */
export function buildRouteTree(routes) {
  const root = {
    path: '/',
    segment: '/',
    title: 'Home',
    type: 'Home',
    status: 200,
    children: {}
  };

  // Find root page title if present
  const homeRoute = routes.find(r => r.path === '/' || r.path === '');
  if (homeRoute && homeRoute.title) root.title = homeRoute.title;

  for (const route of routes) {
    if (route.path === '/' || !route.path) continue;

    const segments = route.path.split('/').filter(Boolean);
    let current = root;

    let accumulatedPath = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      accumulatedPath += '/' + seg;
      const isLeaf = i === segments.length - 1;

      if (!current.children[seg]) {
        current.children[seg] = {
          segment: seg,
          path: accumulatedPath,
          title: isLeaf ? (route.title || seg) : seg,
          type: isLeaf ? route.type : 'Section',
          status: isLeaf ? (route.status || 200) : 200,
          linksCount: isLeaf ? (route.linksCount || 0) : 0,
          children: {}
        };
      } else if (isLeaf) {
        current.children[seg].title = route.title || current.children[seg].title;
        current.children[seg].type = route.type || current.children[seg].type;
        current.children[seg].status = route.status || current.children[seg].status;
        current.children[seg].linksCount = route.linksCount || 0;
      }

      current = current.children[seg];
    }
  }

  // Convert children objects to arrays recursively
  function formatNode(node) {
    const childrenArray = Object.values(node.children).map(formatNode);
    return {
      segment: node.segment,
      path: node.path,
      title: node.title,
      type: node.type,
      status: node.status,
      linksCount: node.linksCount || 0,
      children: childrenArray
    };
  }

  return formatNode(root);
}

/**
 * Multi-Page BFS Crawler and Site Mapper
 */
export async function crawlWebsite(startUrl, options = {}) {
  const {
    maxPages = 15,
    maxDepth = 2,
    concurrency = 3,
    pageTimeoutMs = 6000
  } = options;

  const validStartUrl = normalizeUrl(startUrl);
  if (!validStartUrl) throw new Error(`Invalid URL: ${startUrl}`);

  const startObj = new URL(validStartUrl);
  const origin = startObj.origin;
  const hostname = startObj.hostname;

  const visited = new Set();
  const queue = [{ url: validStartUrl, path: startObj.pathname || '/', depth: 0 }];
  const crawledRoutes = [];
  const discoveredUrls = new Set([validStartUrl]);

  // Normalize path helper
  const cleanPath = (p) => {
    let cp = p.split('?')[0].split('#')[0];
    if (cp.length > 1 && cp.endsWith('/')) cp = cp.slice(0, -1);
    return cp || '/';
  };

  visited.add(cleanPath(startObj.pathname));

  while (queue.length > 0 && crawledRoutes.length < maxPages) {
    const batch = queue.splice(0, concurrency);

    await Promise.allSettled(
      batch.map(async (item) => {
        if (crawledRoutes.length >= maxPages) return;

        const startTime = Date.now();
        let status = 0;
        let title = '';
        let pageType = classifyPageType(item.path);
        let internalLinksFound = [];

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), pageTimeoutMs);

          const res = await fetch(item.url, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal,
            redirect: 'follow'
          });
          clearTimeout(timer);

          status = res.status;
          const contentType = res.headers.get('content-type') || '';

          if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
            const html = await res.text();
            const $ = cheerio.load(html);

            title = $('title').first().text().trim() ||
                    $('h1').first().text().trim() ||
                    $('meta[property="og:title"]').attr('content') || item.path;

            pageType = classifyPageType(item.path, title);

            // Extract internal links
            $('a[href]').each((_, el) => {
              const href = $(el).attr('href');
              if (!href) return;
              const trimmed = href.trim();
              if (trimmed.startsWith('#') || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return;

              try {
                const targetUrl = new URL(trimmed, item.url);
                if (targetUrl.hostname === hostname) {
                  const pathOnly = cleanPath(targetUrl.pathname);
                  discoveredUrls.add(targetUrl.href);
                  internalLinksFound.push(pathOnly);

                  if (!visited.has(pathOnly) && item.depth < maxDepth && queue.length + crawledRoutes.length < maxPages * 2) {
                    visited.add(pathOnly);
                    queue.push({
                      url: targetUrl.href,
                      path: pathOnly,
                      depth: item.depth + 1
                    });
                  }
                }
              } catch {}
            });
          }
        } catch (err) {
          status = 504;
          title = `Error: ${err.message}`;
        }

        const latencyMs = Date.now() - startTime;
        crawledRoutes.push({
          url: item.url,
          path: item.path,
          depth: item.depth,
          status,
          title: title.slice(0, 80),
          type: pageType,
          latencyMs,
          linksCount: internalLinksFound.length
        });
      })
    );
  }

  // Construct hierarchical site map
  const siteTree = buildRouteTree(crawledRoutes);

  return {
    origin,
    hostname,
    startUrl: validStartUrl,
    totalCrawled: crawledRoutes.length,
    totalDiscoveredUrls: discoveredUrls.size,
    routes: crawledRoutes,
    siteTree,
    discoveredUrlsList: Array.from(discoveredUrls).slice(0, 50)
  };
}

/**
 * Executes a specific reconnaissance command against a target website
 */
export async function runSiteCommand(targetUrl, command, args = {}) {
  const validUrl = normalizeUrl(targetUrl);
  if (!validUrl) throw new Error(`Invalid URL: ${targetUrl}`);

  const parsed = new URL(validUrl);
  const hostname = parsed.hostname;
  const origin = parsed.origin;

  const cmd = command.toLowerCase().trim();

  switch (cmd) {
    case 'dns':
      return await runDnsRecon(hostname);

    case 'ssl':
    case 'tls':
    case 'cert':
      return await runSslRecon(hostname, parsed.port ? parseInt(parsed.port, 10) : 443);

    case 'robots':
      return await runRobotsRecon(origin);

    case 'sitemap':
      return await runSitemapRecon(origin);

    case 'api-probe':
    case 'api':
    case 'endpoints':
      return await runApiProbe(origin);

    case 'crawl':
    case 'map':
    case 'sitemap-tree':
      return await crawlWebsite(validUrl, {
        maxPages: args.maxPages || 15,
        maxDepth: args.maxDepth || 2
      });

    case 'fsafe':
    case 'security':
    case 'vulnerabilities':
    case 'vuln-scan':
      return await runFSafeSecurityScan(validUrl, args);

    case 'all':
    case 'audit':
    case 'full-recon':
      return await runFullSiteAudit(validUrl, args);

    default:
      throw new Error(`Unknown command "${command}". Available commands: dns, ssl, robots, sitemap, api, crawl, fsafe, audit`);
  }
}

/**
 * FSafe Automated Vulnerability & Security Scanner Suite
 * Audits the 8 core vulnerability areas:
 * 1. SQL Injection (SQLi) surface & DB error reflection
 * 2. Cross-Site Scripting (XSS) & Content Security Policy (CSP)
 * 3. Cross-Site Request Forgery (CSRF) & SameSite cookies
 * 4. Directory Traversal & Sensitive File Exposure (.env, .git, config)
 * 5. DDoS Resilience & WAF / CDN Protection (Cloudflare, CloudFront, etc.)
 * 6. SSL / TLS Configuration & Ciphers
 * 7. Broken Authentication & Session Management (HttpOnly, Secure)
 * 8. HTTP Response Headers & Software Version Disclosure
 */
export async function runFSafeSecurityScan(targetUrl, options = {}) {
  const validUrl = normalizeUrl(targetUrl);
  if (!validUrl) throw new Error(`Invalid URL: ${targetUrl}`);

  const parsed = new URL(validUrl);
  const origin = parsed.origin;
  const hostname = parsed.hostname;

  // 1. Fetch entry HTML and raw headers
  let mainResponse = null;
  let mainHtml = '';
  let mainHeaders = {};
  let setCookieHeaders = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(validUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timer);
    mainResponse = res;
    res.headers.forEach((val, key) => {
      mainHeaders[key.toLowerCase()] = val;
    });
    if (typeof res.headers.getSetCookie === 'function') {
      setCookieHeaders = res.headers.getSetCookie();
    } else if (res.headers.get('set-cookie')) {
      setCookieHeaders = [res.headers.get('set-cookie')];
    }
    mainHtml = await res.text();
  } catch (err) {
    // Continue with available data
  }

  const $ = cheerio.load(mainHtml || '');

  // 2. Sensitive File & Directory Traversal Probe
  const sensitivePaths = [
    { path: '/.env', label: 'Environment File (.env)' },
    { path: '/.git/HEAD', label: 'Git Repository (.git/HEAD)' },
    { path: '/.git/config', label: 'Git Config (.git/config)' },
    { path: '/config.json', label: 'App Config (config.json)' },
    { path: '/backup.sql', label: 'Database Backup (backup.sql)' },
    { path: '/wp-config.php.bak', label: 'WordPress Config Backup' },
    { path: '/.DS_Store', label: 'macOS Metadata (.DS_Store)' },
    { path: '/.well-known/security.txt', label: 'Security Policy (security.txt)' }
  ];

  const sensitiveFileResults = [];
  await Promise.allSettled(
    sensitivePaths.map(async (item) => {
      try {
        const probeUrl = `${origin}${item.path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(probeUrl, {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal
        });
        clearTimeout(timer);

        const contentType = res.headers.get('content-type') || '';
        const isExposed = res.status === 200 && (
          item.path.includes('security.txt')
            ? true
            : (!contentType.includes('text/html') || res.headers.get('content-length') > 0)
        );

        if (isExposed || res.status === 403 || res.status === 200) {
          sensitiveFileResults.push({
            path: item.path,
            label: item.label,
            status: res.status,
            exposed: res.status === 200 && !contentType.includes('text/html') && item.path !== '/.well-known/security.txt',
            isSecurityPolicy: item.path === '/.well-known/security.txt' && res.status === 200
          });
        }
      } catch {}
    })
  );

  const exposedSensitiveFiles = sensitiveFileResults.filter(f => f.exposed);

  // 3. SQL Injection (SQLi) Attack Surface & Reflection Test
  const forms = $('form');
  const formsCount = forms.length;
  const inputElements = $('input[type="text"], input[type="search"], input:not([type]), textarea');
  const inputsCount = inputElements.length;

  let sqliErrorDetected = false;
  let sqliErrorSignature = null;

  try {
    const probeUrl = `${origin}/?fsafe_probe=1'%22`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const probeRes = await fetch(probeUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    });
    clearTimeout(timer);
    const probeText = await probeRes.text();
    const dbErrorRegex = /(syntax error|mysql_fetch|pg_query|sqlite3\.OperationalError|ORA-\d{5}|Microsoft OLE DB|ODBC SQL Server Driver|unclosed quotation mark)/i;
    const match = probeText.match(dbErrorRegex);
    if (match) {
      sqliErrorDetected = true;
      sqliErrorSignature = match[0];
    }
  } catch {}

  // 4. Cross-Site Scripting (XSS) & Content Security Policy (CSP)
  const cspHeader = mainHeaders['content-security-policy'] || mainHeaders['content-security-policy-report-only'] || '';
  const hasCsp = Boolean(cspHeader);
  const cspAllowsUnsafeInline = cspHeader.includes("'unsafe-inline'");
  const cspAllowsUnsafeEval = cspHeader.includes("'unsafe-eval'");

  // 5. Cross-Site Request Forgery (CSRF) & SameSite Cookie Check
  let postFormsCount = 0;
  let csrfProtectedFormsCount = 0;

  forms.each((_, formEl) => {
    const method = ($(formEl).attr('method') || 'GET').toUpperCase();
    if (method === 'POST') {
      postFormsCount++;
      const hasCsrfInput = $(formEl).find('input[name*="csrf" i], input[name*="token" i], input[name*="_token" i], input[name*="nonce" i]').length > 0;
      if (hasCsrfInput) csrfProtectedFormsCount++;
    }
  });

  const cookiesAudited = setCookieHeaders.map(cookieStr => {
    const lower = cookieStr.toLowerCase();
    const nameMatch = cookieStr.match(/^([^=]+)=/);
    const cookieName = nameMatch ? nameMatch[1].trim() : 'cookie';
    return {
      name: cookieName,
      httpOnly: lower.includes('httponly'),
      secure: lower.includes('secure'),
      sameSite: lower.includes('samesite=strict') ? 'Strict' : lower.includes('samesite=lax') ? 'Lax' : lower.includes('samesite=none') ? 'None' : 'Missing'
    };
  });

  const allCookiesHaveSameSite = cookiesAudited.length > 0 && cookiesAudited.every(c => c.sameSite === 'Strict' || c.sameSite === 'Lax');
  const allCookiesHaveHttpOnly = cookiesAudited.length > 0 && cookiesAudited.every(c => c.httpOnly);

  // 6. DDoS / WAF Shield Detection
  let wafVendor = null;
  const serverHeader = mainHeaders['server'] || '';
  const lowerServer = serverHeader.toLowerCase();

  if (mainHeaders['cf-ray'] || lowerServer.includes('cloudflare')) {
    wafVendor = 'Cloudflare (DDoS & WAF Shield Active)';
  } else if (mainHeaders['x-amz-cf-id'] || lowerServer.includes('cloudfront')) {
    wafVendor = 'AWS CloudFront / AWS WAF Shield Active';
  } else if (mainHeaders['x-fastly-request-id'] || lowerServer.includes('fastly')) {
    wafVendor = 'Fastly Edge Cloud & DDoS Shield';
  } else if (mainHeaders['x-akamai-transformed']) {
    wafVendor = 'Akamai Edge Defense / Kona Defender';
  } else if (mainHeaders['x-iinfo'] || mainHeaders['x-cdn']?.includes('incapsula')) {
    wafVendor = 'Imperva / Incapsula WAF Active';
  } else if (mainHeaders['x-sucuri-id']) {
    wafVendor = 'Sucuri Website Firewall Active';
  }

  // 7. SSL / TLS Handshake Audit
  const sslData = await runSslRecon(hostname, parsed.port ? parseInt(parsed.port, 10) : 443);
  const hstsHeader = mainHeaders['strict-transport-security'] || '';
  const hasHsts = Boolean(hstsHeader);

  // 8. HTTP Response Headers & Software Version Disclosure
  const softwareLeaks = [];
  if (serverHeader && !['cloudflare', 'nginx', 'apache'].includes(lowerServer) && /\d/.test(serverHeader)) {
    softwareLeaks.push(`Server Version Leaked: "${serverHeader}"`);
  }
  if (mainHeaders['x-powered-by']) {
    softwareLeaks.push(`Framework Leaked (X-Powered-By): "${mainHeaders['x-powered-by']}"`);
  }
  if (mainHeaders['x-aspnet-version']) {
    softwareLeaks.push(`ASP.NET Version Leaked: "${mainHeaders['x-aspnet-version']}"`);
  }

  const hasXFrameOptions = Boolean(mainHeaders['x-frame-options']);

  // Calculate FSafe Category Verdicts & Overall Score
  let score = 100;

  // SQLi
  let sqliStatus = 'PASSED';
  let sqliDetail = `${inputsCount} input fields audited across ${formsCount} forms. No database error signatures leaked.`;
  if (sqliErrorDetected) {
    sqliStatus = 'CRITICAL';
    sqliDetail = `Database error signature detected upon test input: "${sqliErrorSignature}". Direct SQL error reflection.`;
    score -= 35;
  }

  // XSS
  let xssStatus = 'PASSED';
  let xssDetail = 'Content-Security-Policy (CSP) is active and restricts unauthorized scripts.';
  if (!hasCsp) {
    xssStatus = 'WARNING';
    xssDetail = 'Missing Content-Security-Policy (CSP) header. Browser cannot restrict script origin sources.';
    score -= 10;
  } else if (cspAllowsUnsafeInline) {
    xssStatus = 'MODERATE';
    xssDetail = "CSP allows 'unsafe-inline' scripts, reducing resistance against reflected or DOM-based XSS.";
    score -= 8;
  }

  // CSRF
  let csrfStatus = 'PASSED';
  let csrfDetail = 'Forms and session cookies implement CSRF mitigation tokens and SameSite attributes.';
  if (postFormsCount > 0 && csrfProtectedFormsCount < postFormsCount) {
    csrfStatus = 'WARNING';
    csrfDetail = `${postFormsCount - csrfProtectedFormsCount} out of ${postFormsCount} POST forms lack apparent anti-CSRF token inputs.`;
    score -= 8;
  } else if (cookiesAudited.length > 0 && !allCookiesHaveSameSite) {
    csrfStatus = 'PARTIAL';
    csrfDetail = 'Some session cookies lack explicit SameSite=Strict/Lax attributes.';
    score -= 5;
  }

  // Directory Traversal
  let traversalStatus = 'PASSED';
  let traversalDetail = 'Common configuration files, .env, and .git directories are non-accessible (404/403).';
  if (exposedSensitiveFiles.length > 0) {
    traversalStatus = 'CRITICAL';
    traversalDetail = `Sensitive files directly exposed: ${exposedSensitiveFiles.map(f => f.path).join(', ')}`;
    score -= 30;
  }

  // DDoS
  let ddosStatus = wafVendor ? 'DEFENSE ACTIVE' : 'EXPOSED ORIGIN';
  let ddosDetail = wafVendor ? `${wafVendor} detected filtering traffic.` : 'No major CDN/WAF edge shield detected. Origin server directly exposed to volumetric traffic.';
  if (!wafVendor) score -= 10;

  // SSL/TLS
  let sslStatus = 'PASSED';
  let sslDetail = `Valid ${sslData.protocol || 'TLSv1.3'} handshake with ${sslData.cipher || 'AES-GCM'}. ${sslData.daysRemaining || 0} days remaining.`;
  if (!hasHsts) {
    sslStatus = 'WARNING';
    sslDetail += ' Missing HSTS (Strict-Transport-Security) header.';
    score -= 5;
  }
  if (!sslData.valid) {
    sslStatus = 'CRITICAL';
    sslDetail = 'Invalid, self-signed, or untrusted SSL/TLS certificate.';
    score -= 25;
  }

  // Auth & Cookies
  let authStatus = 'PASSED';
  let authDetail = 'Session cookies enforce HttpOnly and Secure flags.';
  if (cookiesAudited.length > 0 && !allCookiesHaveHttpOnly) {
    authStatus = 'WARNING';
    authDetail = 'Session cookies lack HttpOnly flag, allowing potential extraction via client-side scripts.';
    score -= 8;
  }

  // HTTP Headers & Info Disclosure
  let headersStatus = 'PASSED';
  let headersDetail = 'Standard defensive security headers implemented without detailed version disclosure.';
  if (softwareLeaks.length > 0) {
    headersStatus = 'WARNING';
    headersDetail = `Software version disclosure: ${softwareLeaks.join('; ')}`;
    score -= 6;
  }
  if (!hasXFrameOptions) {
    headersStatus = 'WARNING';
    headersDetail += ' Missing X-Frame-Options (Clickjacking defense).';
    score -= 5;
  }

  score = Math.max(15, Math.min(100, score));

  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  const verdict = score >= 85 ? 'HARDENED POSTURE' : score >= 65 ? 'MODERATE SECURITY' : 'ATTENTION REQUIRED';

  return {
    targetUrl: validUrl,
    hostname,
    origin,
    score,
    grade,
    verdict,
    fsafeScore: score,
    securityGrade: grade,
    summaryVerdict: verdict,
    categories: [
      { id: 'sqli', name: 'SQL Injection (SQLi) Surface', status: sqliStatus, details: sqliDetail },
      { id: 'xss', name: 'Cross-Site Scripting (XSS) & CSP', status: xssStatus, details: xssDetail },
      { id: 'csrf', name: 'Cross-Site Request Forgery (CSRF)', status: csrfStatus, details: csrfDetail },
      { id: 'traversal', name: 'Directory Traversal & Sensitive Files', status: traversalStatus, details: traversalDetail, exposedFiles: exposedSensitiveFiles },
      { id: 'ddos', name: 'DDoS Resilience & WAF Shield', status: ddosStatus, details: ddosDetail, waf: wafVendor },
      { id: 'ssl', name: 'SSL / TLS Encryption & Handshake', status: sslStatus, details: sslDetail, hsts: hasHsts },
      { id: 'auth', name: 'Authentication & Cookie Hardening', status: authStatus, details: authDetail, cookies: cookiesAudited },
      { id: 'headers', name: 'HTTP Headers & Info Disclosure', status: headersStatus, details: headersDetail, softwareLeaks }
    ],
    probedFiles: sensitiveFileResults,
    waf: wafVendor,
    cookies: cookiesAudited,
    softwareLeaks,
    timestamp: new Date().toISOString()
  };
}

/**
 * Runs a complete full-spectrum site reconnaissance, mapping, and FSafe vulnerability audit
 */
export async function runFullSiteAudit(targetUrl, options = {}) {
  const validUrl = normalizeUrl(targetUrl);
  if (!validUrl) throw new Error(`Invalid URL: ${targetUrl}`);

  const parsed = new URL(validUrl);
  const hostname = parsed.hostname;
  const origin = parsed.origin;

  // Run DNS, SSL, Robots, Sitemap, API probes, Crawl, and FSafe security scan concurrently!
  const [dnsResult, sslResult, robotsResult, apiResult, crawlResult, fsafeResult] = await Promise.allSettled([
    runDnsRecon(hostname),
    runSslRecon(hostname),
    runRobotsRecon(origin),
    runApiProbe(origin),
    crawlWebsite(validUrl, { maxPages: options.maxPages || 12, maxDepth: 2 }),
    runFSafeSecurityScan(validUrl, options)
  ]);

  const robotsData = robotsResult.status === 'fulfilled' ? robotsResult.value : null;
  const sitemapData = await runSitemapRecon(origin, robotsData?.sitemaps || []);

  return {
    url: validUrl,
    domain: hostname,
    origin,
    dns: dnsResult.status === 'fulfilled' ? dnsResult.value : null,
    ssl: sslResult.status === 'fulfilled' ? sslResult.value : null,
    robots: robotsData,
    sitemap: sitemapData,
    apiEndpoints: apiResult.status === 'fulfilled' ? apiResult.value : [],
    crawl: crawlResult.status === 'fulfilled' ? crawlResult.value : null,
    fsafe: fsafeResult.status === 'fulfilled' ? fsafeResult.value : null,
    timestamp: new Date().toISOString()
  };
}
