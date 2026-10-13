# 發布契約：自訂文字遮蔽

狀態：2026-10-13 M1 已獨立主驗通過並正式放行 M2。M2 source candidate 已實作，公開來源及固定 ZIP 的實際結果由本地 HANDOFF 與專用 evidence 記錄；live hosting/首頁/外部驗收仍是後續 gate。

預定 HTTPS origin https://redact.glossquote.com，中文 /index.html，英文 /en/index.html；目前沒有部署。M1 preview 必須 noindex/nofollow/Disallow:/ 且無正式 canonical/sitemap。

正式 production origin 固定 https://redact.glossquote.com。Preview `public/` 與 `dist/` 保持 M1 固定八檔 SHA256/noindex；`npm run build:production` 只寫本工具獨立 `dist-production/` 的十三個 allowlisted assets；`npm run check:production` 驗證每檔預期 bytes、部署配置與不變的 M1 基線。

正式雙語 self canonical 為 /index.html、/en/index.html；reciprocal zh-Hant/en 與 x-default 中文、OG/Twitter summary、robots/sitemap、符合可見 description 的 WebApplication JSON-LD。只有 head metadata 不同，body 與 app/state/core/i18n/CSS 原 bytes 不變。SEO 不宣稱安全或自動個資偵測，也無假評分、使用者數或認證。

Cloudflare assets-only 配置使用 `html_handling: none`，保持明確 index.html canonical；_redirects 將 /、/en、/en/ 指到各自 canonical。`not_found_handling: 404-page` 與雙語 404.html 用於 missing paths，禁止 SPA 200 fallback。_headers 使用 default deny CSP（connect-src none、自家 script/style、JSON-LD 兩個 exact SHA256），nosniff/DENY/no-referrer、permissions、HSTS、same-origin 及 no-store。Wrangler metrics、logpush、observability/logs/traces 關閉，沒有 Worker entrypoint、vars、帳號 ID 或憑證。

配置語義核對官方文件：[HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)、[Custom 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)、[Headers](https://developers.cloudflare.com/workers/static-assets/headers/)、[Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)。本地 `npm run preview:production` 是 Node loopback HTTP model，可測真 404 status/headers/MIME，但不冒充 Cloudflare edge；Wrangler deployment、Cloudflare live response 與 route/header 實測由 M3 主代理驗收。

按已授權來源發布，使用 reviewed independent copy 發布 public repo KYStr/glossquote-labs-text-redactor；必要 checks 通過後核對 repo visibility、remote HEAD/commit。ZIP 由固定 Git blob 產生，解壓逐 blob 比對、從解壓副本重新 build/check。禁止 root repo push、force push、捎帶其它工具、輸入、secrets、node_modules、.runs 或 dist evidence。公開 source 不是 LICENSE 授權。

`scripts/source-release.mjs` 的 42-file source allowlist 排除 DISPATCH、TASK-ENTRY、生成產物和本地證據；只替換四個公開 summary（README、START-HERE、HANDOFF、project.json）以移除 private chat/machine metadata，產品程式、spec/test/tooling 逐 bytes 保持。從 reviewed copy 的固定 Git commit 以 git archive ZIP，中央/本地 entry、path allowlist、mode、CRC、size、每個 Git blob bytes 全部先驗證，再解壓到全新目錄。重新跑 test/check/build/build:production/check:production，核對重建產物。

發布前 capture、結束後 verify 孵化器 Git settings guard；只記 existence/size/SHA256，不印設定內容。使用已登入官方 gh CLI；不得 gh auth setup-git/login/refresh、global/system Git 寫入、讀取 token 或改 Windows env。Git authentication、hooks/attributes/line-ending 與 author 設定僅用該命令的 `git -c`，不得 force。任何 gate/permission/source drift 停止回報，不能猜測恢复。

M3 由主代理 Cloudflare free deploy，驗 live雙語流程、真實 network/privacy範圍、SEO/headers/404/首頁回鏈。Feature chat 不部署不改首頁。已上線後標 awaiting external review；外部確認前不稱完成。
