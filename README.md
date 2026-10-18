# 🌐 BELLEM

**BELLEM** is a private, web-connected AI chat workspace with Google Gemini aesthetics, built specifically for local LLMs (Ollama & LM Studio). It features deep behind-the-scenes website inspection, multi-page crawling, hierarchical site mapping, live technical reconnaissance, and the **FSafe Automated Security & Vulnerability Auditing Protocol**.

---

## 🚀 Quick Start

### 1. One-Click Launch (Windows)
Double-click `start.bat`. It will launch the background server and open **[http://localhost:3002](http://localhost:3002)** in your browser.

### 2. Terminal
```bash
npm install
npm run build
npm start
```
Then visit **[http://localhost:3002](http://localhost:3002)**.

*(For developers wanting hot-reload: run `npm run server` and `npm run dev`)*

---

## ✨ Key Capabilities

### 🛡️ FSafe Automated Security Protocol
Automatically executes defensive security scans on target websites across 8 core vulnerability areas without passive checklists or refusals:
1. **SQL Injection (SQLi) Surface**: Scans form input parameters, tests reflection, and checks for database syntax error leaks.
2. **Cross-Site Scripting (XSS) & CSP**: Audits Content Security Policy (CSP) directives (`unsafe-inline`, `unsafe-eval`) and parameter reflection.
3. **Cross-Site Request Forgery (CSRF)**: Audits POST forms for hidden anti-CSRF tokens and verifies `SameSite` session cookie attributes.
4. **Directory Traversal & Sensitive File Exposure**: Probes `/.env`, `/.git/HEAD`, `/.git/config`, `/config.json`, `/backup.sql`, `/.well-known/security.txt` for unintended public exposure.
5. **DDoS Resilience & WAF Shield**: Detects edge WAFs/CDNs (Cloudflare, AWS CloudFront/WAF, Fastly, Akamai, Imperva) and rate-limiting headers.
6. **SSL / TLS Encryption & Handshake**: Live TLS handshake, cipher suite validation, certificate authority, days remaining, and HSTS status.
7. **Broken Authentication & Cookie Hardening**: Audits `HttpOnly`, `Secure`, and `SameSite` cookie flags and login form transport security.
8. **HTTP Response Headers & Information Disclosure**: Detects software version disclosures (`Server`, `X-Powered-By`) and missing security headers (`X-Frame-Options`, `X-Content-Type-Options`).

### 🗺️ Multi-Page Crawl & Route Mapping
- **BFS Web Crawler**: Explores internal sub-routes to construct full site topology trees.
- **Route Classifier**: Categorizes discovered routes into functional hubs (*Docs*, *Pricing*, *Authentication*, *Dashboard / App*, *Blog*, *Legal*).
- **Interactive Site Map Explorer**: Filter, search, and view internal link counts and status codes.

### ⚡ Live Technical Reconnaissance
Direct diagnostic command runner in chat:
- **`dns`**: Resolves `A`, `AAAA`, `MX` (mail servers with priority), `NS` (nameservers), `TXT` (SPF records, domain verifications), and `SOA`.
- **`ssl`**: Performs live TLS handshake, reporting issuer, cipher suite, validity dates, and SANs.
- **`robots`**: Parses crawler directives and disallowed routes in `/robots.txt`.
- **`sitemap`**: Queries `/sitemap.xml` for indexed endpoints.
- **`api`**: Probes common REST, GraphQL, and Swagger endpoints.

### 🧠 Local LLM Integration & Gemini UX
- **Ollama & LM Studio**: Connect to local models (e.g. `llama3.2`, `deepseek-r1`, `qwen2.5`, `mistral`, `phi4`).
- **Dark Minimalist Canvas**: Refined `#131314` theme with smooth token streaming, KaTeX LaTeX math, syntax-highlighted code blocks, and collapsible reasoning thoughts (`<think>`).
- **Full Chat Management**: History grouped by date, pinning, title generation, export/import, and multimodal image uploads.
