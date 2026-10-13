# 工程契約：自訂文字遮蔽

狀態：SPEC_ONLY；未執行 build、test 或 persistent environment guard。

Browser 靜態原生 ESM + HTML/CSS，Node >=24 只做開發工具和 node:test。無 runtime dependency。預覽 server 僅 127.0.0.1:4204，GET/HEAD，public-only、path containment、拒絕 traversal、hidden、symlink/junction escape；4204 被占用時保留既有服務，改由 OS 分配 loopback 暫用 port，輸出並記錄實際 URL。M1 建立 npm run dev/test/check/build 後才執行；不跑未建立的 script。

core 避免 regex/backtracking，使用 codepoint trie、固定 max source/target/rules 和最壞 20,000,000 edge traversal 上界。先驗證全輸入，錯誤無 partial output；replacement 固定；輸出不重掃。輸入文字一律 textContent/value，不可 innerHTML/eval。

Async clipboard 只在 click 呼叫。busy lock 限制編輯期間，revision/requestId 確認完成回呼仍對應當前結果；拒絕時選取 readonly output textarea。原生下載需真實 browser 測試：UTF-8 no BOM，無新增 newline；Blob mock 不足以證明落盤 bytes。pagehide 釋放 state references / object URLs。

source、targets、output、命中數不記 console/network/storage/URL。測試使用合成 fake text、offline only。Check 是有限靜態檢查，不可宣稱替代 Network/storage 人工確認。Build 只複製 allowlisted public 到本工具 dist，保護 unknown stale / hardlink / junction /外部 sentinel。

長 build/test 前後遵守根 AGENTS persistent environment safety，記錄 PATH hash/type/length/ephemeral count/full Environment fingerprint，確保前後不變；絕不改 User/Machine env、registry、services、PATH、TEMP/TMP。不要讀 credential 或改根 git state。

Port fallback: request 127.0.0.1:4204 first. On EADDRINUSE leave the existing service untouched and use OS-assigned free loopback port; print and record the actual preview URL.
