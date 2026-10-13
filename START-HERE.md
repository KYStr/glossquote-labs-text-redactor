# Start here

Only the exact strings you list are replaced. This tool does not detect other personal data; review the full output before sharing.

Node.js 24+; no dependency installation required.

```sh
npm test
npm run check
npm run build
npm run build:production
npm run check:production
npm run dev
```

Preview: http://127.0.0.1:4204/index.html and /en/index.html; loopback only with occupied-port fallback. Preview is noindex. Production goes to a separate dist-production/ directory.

Read PRODUCT.md, TECHNICAL.md, ACCEPTANCE.md and docs/ before changes. Production static assets are built for the exact origin https://redact.glossquote.com, with canonical URLs /index.html and /en/index.html, reciprocal hreflang, JSON-LD, robots/sitemap, bilingual 404 and security headers. Hosting and external review are NOT_RUN in this source candidate.
