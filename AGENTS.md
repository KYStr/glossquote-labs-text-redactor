# 自訂文字遮蔽專案規則

狀態：SPEC_ONLY；本規則對後續 feature chat 自包含。

- 先讀 START-HERE、PRODUCT、TECHNICAL、UX-SEO、ACCEPTANCE、TASKS、docs；每次只做一個 milestone。
- 只做使用者逐字列出的替換。不可加入自動個資偵測、AI、regex、OCR 或平台整合。
- 最大 source 100000 UTF-16 units；最多 50 targets，每個 1–200 units。拒絕空、重複、control target 和 unpaired surrogate。source 與 target 都不 trim、不 normalize。
- 以 codepoint trie 依左至右、最長字串優先、非重疊 single-pass 替換。替換結果不得重新掃描；不得回 partial output。
- replacement 固定 [REDACTED]。每次結果旁明示只能遮蔽已指定字串，人工 review 後才可分享。
- source/rule 改動立即 invalidate result/matches/copy/download。原生 async copy single-flight + busy/revision/requestId；fallback 只選 output，不偽稱成功。
- 下載只含 output，固定檔名、UTF-8 no BOM、保留換行、不追加 LF；不得下載原文或規則。
- 全部內容只在當前頁面 memory，不進 storage、URL、console、network 或 telemetry；textContent/value 呈現不可信文字。
- Node >=24 ESM built-ins，tests offline fake data；browser clipboard/download manual evidence 不以 mock 替代。loopback 127.0.0.1:4204；工具鏈限制遵 docs/ENGINEERING。
- 保留既有工作；不讀 credentials、不動 persistent Windows state、不做根 repo destructive git。只依 TASKS allowed paths。
- GitHub public source 只可在 primary M1 release gate 後按 docs/RELEASE；Cloudflare/homepage 由主代理處理。
