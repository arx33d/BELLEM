# BELLEM

BELLEM is a local LLM chat interface with live web access, site crawling, DNS/SSL reconnaissance, and automated security vulnerability auditing (FSafe).

It runs on top of local model backends like Ollama and LM Studio.

## Quick Start

### Windows
Run `start.bat`. It starts the local server and opens http://localhost:3002 in your default browser.

### Manual Setup
```bash
npm install
npm run build
npm start
```
Open http://localhost:3002.

For development with hot-reload:
```bash
npm run server  # Backend on port 3002
npm run dev     # Frontend on port 5173
```

## Features

### FSafe Security Scanner
Automated defensive vulnerability scanner targeting 8 core web security vectors:
1. SQL Injection (SQLi): audits input parameters, reflection behavior, and database error signatures.
2. Cross-Site Scripting (XSS): evaluates CSP headers (unsafe-inline, unsafe-eval) and reflected parameters.
3. Cross-Site Request Forgery (CSRF): checks POST forms for anti-CSRF tokens and SameSite cookie attributes.
4. Directory Traversal and File Exposure: probes for accessible sensitive files (/.env, /.git/HEAD, /config.json, /backup.sql, /.well-known/security.txt).
5. DDoS and WAF: detects Cloudflare, CloudFront, Fastly, Akamai, Imperva, and rate-limiting headers.
6. SSL and TLS: validates certificate issuer, cipher suite, validity period, and HSTS headers.
7. Authentication and Cookies: audits HttpOnly, Secure, and SameSite attributes on session cookies.
8. HTTP Response Headers: flags software version leaks (Server, X-Powered-By) and missing security headers.

### Web Crawling and Site Mapping
- BFS crawler explores internal routes up to configurable depth limits.
- Automatically groups discovered URLs into hubs (documentation, pricing, authentication, app, blog).
- Generates a route hierarchy with HTTP status codes, latency, and link counts.

### Site Commands
Run diagnostic commands against target websites from chat or via the API:
- `dns`: resolves A, AAAA, MX, NS, TXT, and SOA records.
- `ssl`: inspects TLS version, cipher, certificate chain, and validity dates.
- `robots`: parses robots.txt directives and crawl rules.
- `sitemap`: discovers and parses sitemap.xml files.
- `api`: probes standard API endpoints (/api, /graphql, /swagger.json).
- `fsafe`: executes the 8-point automated security scan.

### Chat Interface
- Model selection for local Ollama and LM Studio instances.
- Token streaming with speed metrics (tokens/second, duration).
- Collapsible reasoning sections for models outputting think tags.
- LaTeX math support via KaTeX.
- Syntax highlighting and code copying.
- Chat history persistence, export, import, and pinning.

## API Endpoints

- `POST /api/chat`: streaming SSE chat completions with web grounding and audit data.
- `GET /api/models`: list installed models across Ollama and LM Studio.
- `POST /api/web/audit`: full website reconnaissance, crawl, and FSafe scan.
- `POST /api/web/fsafe`: standalone 8-point security audit for a URL.
- `POST /api/web/command`: run a single recon command (dns, ssl, robots, sitemap, api, crawl, fsafe).
- `POST /api/web/crawl`: crawl internal routes on a domain.
- `GET /api/settings` and `POST /api/settings`: read and update configuration.

## License
MIT
