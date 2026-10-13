# Source release handoff

Version 0.1.0. M1 independent primary acceptance passed with explicit native NOT_RUN items. M1 browser/runtime bytes are frozen; M2 adds head metadata and independent production assets/tooling.

Only the exact strings you list are replaced. This tool does not detect other personal data; review the full output before sharing.

Source repository: https://github.com/KYStr/glossquote-labs-text-redactor. The commit and its Git blobs identify this source snapshot; generate production assets from those bytes. Local preview and source publication do not prove live hosting. Cloudflare deployment, bilingual family homepage inclusion and external confirmation remain separate gates.

Native NOT_RUN: downloaded file name/UTF-8 bytes, actual 200% browser zoom, full Network/Storage, physical phone/IME/assistive technology, and BFCache/pending OS clipboard ordering. Preserve these statuses.

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

Publication must use a reviewed independent copy, per-command Git options and existing CLI authentication. Never configure global/system Git or authentication, expose credentials, or infer a source license.
