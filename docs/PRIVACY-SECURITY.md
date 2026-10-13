# 隱私與安全：自訂文字遮蔽

狀態：SPEC_ONLY；privacy 行為未實測。

此工具處理可能敏感的原文，只在目前 browser tab 的記憶體工作。無 server endpoint、account、cloud、analytics、telemetry、crash reporting、URL state、localStorage、IndexedDB、cookie 或外部 fonts/CDN/packages。正式站也只提供靜態 assets。

明確警示其能力有限：只替換使用者列出的字串。未列出的個資保留在輸出。每次輸出可見「請自己檢查完整內容」提示，零命中時指出 output 完全等於 source。不得用 safe/anonymized 憑證或絕對保證。

Source max 100000 UTF-16; 1–50 exact literal targets, 1–200 UTF-16 each; unpaired surrogate/duplicates/control targets reject; no trim or Unicode normalization. Trie bounds work; no regex evaluation, HTML interpretation, or second pass on replacements. Errors and logs never contain raw source, target or output.

Copy/download are explicit gestures and contain output only. TXT fixed filename and format, no original source, rule list, count receipt, metadata, timestamp or IP. Copy failure fallback manually selects output and reports no automatic success. Pagehide clears references; browser/OS erase beyond app control is not claimed.

M1 needs real browser flow and manual download evidence. If complete Network/Storage inspection isn't available, record NOT_RUN; static scans do not prove no runtime request. Local server only loopback.
