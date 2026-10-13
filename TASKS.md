# 任務與里程碑：自訂文字遮蔽

狀態：SPEC_ONLY。依序執行；每任務檢查只針對固定輸入。規格矛盾或安全邊界不明時停止回報。

## M1 / T00：雙語本機完整 MVP

前置：讀本資料夾六份產品文件與 docs/；確認 Node >=24；讀根 safety instructions；記錄初始 working-tree/path/hash 和 Windows env guard。若目標已有其他人修改/寫入，停止，不覆寫。

T00 allowed paths：public/**；scripts/serve.mjs、check.mjs、build.mjs、validation.mjs 及本工具必要 scripts/*.mjs helper；test/** 僅假資料；package.json、.gitignore、本工具 dist/**。交付狀態可更新本工具 HANDOFF.md、project.json、START-HERE.md、docs/RELEASE-CANDIDATE.md；TASK-ENTRY.md 僅 append。禁止改父目錄/根首頁/其它工具、Git root、憑證或外部服務。

1. 建 private ESM Node24 package 和真實 loopback-only server 127.0.0.1:4204，加入 test/check/build，先測 server/allowlist。
2. 實作 Unicode validation、target validation、trie 和單 pass longest-match redactor；測試 A01–A36 與 20M 上限/最壞多規則 fixtures，確認沒 partial output。
3. 實作來源/規則編輯、增刪、命中摘要、兩語輸出、立即 invalidate 與人工檢查提示；純文字 DOM。
4. 實作 async native copy busy/revision/requestId，拒絕 fallback，以及固定 UTF-8 no BOM TXT 原生下載/object URL cleanup。
5. 加入 clear confirm、keyboard/mobile/320/IME/privacy tests 與雙語 preview noindex；B08 的 320px 必實測，B09 的 200% zoom 依能力分開記錄，勿和 B08 合併；不得加 runtime dependency。
6. 僅在 scripts 建成後跑 npm test、npm run check、npm run build；手動完成 B01–B03、B06–B08、B11–B13。B08 的 320px 必須實測；B09 200% zoom、B10 Network/Storage 可依能力分開記 NOT_RUN。B04/B05 原生 clipboard/download 必須嘗試真 browser；缺能力時逐項標 NOT_RUN，不以 mock PASS。
7. 核對 Windows guard，固定 manifest/hash、append TASK-ENTRY、更新 HANDOFF/project.json，凍結交主代理。M1 gate 通過前不可進 M2。

M1 gate：A01–A36 與 npm test/check/build 通過；B01–B03、B06–B08、B11–B13 真 browser evidence 完成，涵蓋雙語主流程、即時失效、清除對話框、keyboard、必驗 320px、刷新與未列出個資警告。B09 zoom、B10 Network/Storage 可在工具能力不足時分項 NOT_RUN。B04/B05 原生 clipboard/download 若設備無法手動驗證可分項 NOT_RUN；mock 不可冒充人工通過。

## M2 / T01：production SEO 與 public GitHub source

前置：主代理明確放行 M1。allowed paths：本工具 public/**、scripts release/build/check/manifest helpers、test/** release tests、package.json、wrangler.jsonc、.gitignore、docs/RELEASE.md、docs/RELEASE-CANDIDATE.md、專用 publishing copy evidence。實作 canonical/hreflang/x-default、robots/sitemap、符合可見內容 JSON-LD、headers/404、production check/build。source ZIP 只含 reviewed tool files。

必要 tests 完成、diff 窄化後，用 reviewed copy 發布 KYStr/glossquote-labs-text-redactor public repository。驗 visibility、remote commit、固定 Git blob ZIP 與解壓副本 rebuild/check；不 force、不部署、不改首頁。記錄命令、SHA、manifest、NOT_RUN；遇權限或路徑漂移停止。

## M3 / T02：主代理部署與外部驗收

只由主代理做 Cloudflare free deploy、正式 header/SEO/功能驗證和雙語首頁 catalog。原 chat 不部署、不改首頁。已部署標 awaiting external review；外部報告交回原對話按具體問題返工、測試、公開更新，再由主代理重驗/部署。確認前不可標版本完成。
