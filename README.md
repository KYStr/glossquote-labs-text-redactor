# Custom Text Redactor / 自訂文字遮蔽

Only the exact strings you list are replaced. This tool does not detect other personal data; review the full output before sharing.

Exact, case- and space-sensitive, longest-match-first, non-overlapping replacement with the fixed token [REDACTED]. Text stays in the current browser tab by design. No account, runtime packages, remote fonts, analytics or automatic storage. Reloading clears drafts.

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

Production origin: https://redact.glossquote.com. Source release candidate; live deployment and bilingual homepage inclusion are separate primary-owned gates and are not verified by this repository.

Limits: source 100000 UTF-16 units; 1–50 targets, 1–200 units each. Empty/duplicate/control/unpaired-surrogate targets are rejected. Source and targets are never trimmed or normalized. Copy/download contains only the output.

Testing evidence: M1 owner and independent primary offline tests 44/44 passed. Native clipboard, bilingual flows, keyboard and measured 320px passed. Downloaded file bytes, actual 200% browser zoom, full Network/Storage, physical device/IME/assistive technology and BFCache/pending OS clipboard ordering remain NOT_RUN. M2 release tests cover production metadata, headers, 404, safe builds and fixed-source archive verification. Mock tests do not replace native checks.

Original specification status labels describe the initial contract; current release status is here and in HANDOFF.md. No license grant is inferred from public source publication.
