# 驗收規格：自訂文字遮蔽

狀態：SPEC_ONLY；下列全部 NOT_RUN。自動核心測試與 browser 原生 copy/download 分開判定。

## 自動案例

| ID | 輸入/操作 | 預期 |
|---|---|---|
| A01 | source Alice email: a@example.test；target a@example.test | output Alice email: [REDACTED]；total=1 |
| A02 | targets Ann, Anna；source Anna Ann | [REDACTED] [REDACTED]；Ann=1、Anna=1 |
| A03 | targets A, AB；source AB | [REDACTED]；AB rule=1、A=0 |
| A04 | source xAxA、target A | x[REDACTED]x[REDACTED]；count=2 |
| A05 | source ababa、target aba | [REDACTED]ba；左至右非重疊 |
| A06 | source [REDACTED]、target [REDACTED] | [REDACTED]；single pass、count=1 |
| A07 | source x[REDACTED]、target x | [REDACTED][REDACTED]；替代結果不重新掃描 |
| A08 | source Anna、rule Anna first, Ann second | [REDACTED]；長字串優先，rule order deterministic |
| A09 | source ann、target Ann | 0 match，output ann 原樣，total=0 |
| A10 | source A A、target A␠（最後一格是空格） | output [REDACTED]A；不 trim target |
| A11 | target 空字串 | TARGET_EMPTY，不執行 |
| A12 | whitespace-only target 單一空格、source a b | 接受，單一空格被替換一次 |
| A13 | 完全重複 target | DUPLICATE_TARGET，整批不產生 output |
| A14 | 50 條有效 target | 接受；51 條 TOO_MANY_RULES |
| A15 | target 200 UTF-16 units | 接受；201 TARGET_TOO_LONG |
| A16 | source 100000 UTF-16 units | 接受上限內驗證 |
| A17 | source 100001 UTF-16 units | SOURCE_TOO_LONG、output absent |
| A18 | source unpaired high/low surrogate | INVALID_UNICODE |
| A19 | target unpaired surrogate | INVALID_UNICODE |
| A20 | target 含 U+000A | TARGET_CONTROL_CHARACTER |
| A21 | target 含 U+0085 | TARGET_CONTROL_CHARACTER |
| A22 | source 含 CRLF、emoji、漢字，target 漢字 | 只替換 matching scalar；原 CRLF/其餘 emoji 完整保留 |
| A23 | regex 特殊文字 .*+?[] | 只照字面匹配，不當 regex |
| A24 | 不同 Unicode normalization 形式 target | 不相等，不 normalize，不誤命中 |
| A25 | 0 rules | NO_RULES，不產生 output |
| A26 | output 0 match | output 等於 source、total=0、顯示未偵測其他個資警告 |
| A27 | 一碼點 source 全部命中最多 100000 次 | output <=1,000,000 UTF-16 units，count=100000 |
| A28 | 固定 output replacement 文字 | replacement 只能是 [REDACTED]，不可從輸入改掉 |
| A29 | 一個規則目標 10 次、另一個 0 次 | perRule counts 10 和 0；總數 10 |
| A30 | source 含 <script> 及 </textarea> | 全部只當 text，不執行/建立 DOM |
| A31 | source/rule 改動後 | result/counts 立即 null，copy/download disabled |
| A32 | clear confirm cancel | source/rules/results 完全保留 |
| A33 | clear confirm accept | source empty、1 empty draft rule、output absent |
| A34 | trie 最大限制值 targets/source | nodes <=10001；edge transitions <=20,000,000；沒有 regex backtracking |
| A35 | source 100000 個 A，target A | output 含 100000 個 fixed tokens，精確 count 100000，不溢位 |
| A36 | request 有 extra symbol/non-enumerable/accessor/missing key；另測 rules sparse/extra-key/accessor array | request fixtures 各回 INVALID_REQUEST；rules fixtures 各回 INVALID_RULES；getter call count=0，failure 不含 output |

## 真實瀏覽器 M1

- B01 繁中輸入 email 與重疊目標，執行後核對完整輸出與各規則命中數。
- B02 英文頁同樣完成來源、規則、執行、閱讀結果；無漏翻且固定 token 相同。
- B03 修改來源和 rule 各一次，確認舊 output、counts、copy/download 立即失效。
- B04 使用者點擊後只複製 redacted result；原生 clipboard 可讀回實際內容。若環境不能讀，標 NOT_RUN，不把 API mock 當 PASS。
- B05 下載檔案並檢查名稱、UTF-8 no BOM、內容完全等於 output、換行保留且無尾端新 LF；無真實下載能力標 NOT_RUN。
- B06 clear dialog 取消保留資料、確認清掉，focus restored。
- B07 keyboard-only 執行、查看 output、download/copy controls，focus 可見且順序合理。
- B08 320px viewport 必須實測：source/result/每條規則和主要動作可達，無整頁水平溢出。
- B09 200% zoom 若現有工具無法調整，單獨記 NOT_RUN，不和 B08 合併 PASS。
- B10 DevTools Network/Storage 觀察使用者輸入不離開本機、無持久存儲；缺乏完整工具時標 NOT_RUN。
- B11 pagehide/刷新提示準確，無自動恢復資料；console 沒有輸入字串。
- B12 source 含 CRLF/emoji 時可編輯，輸出相對於 textarea.value 完整保留；貼上來源若被瀏覽器標準化則不要求還原外部 bytes。目標含 newline 必須顯示 TARGET_CONTROL_CHARACTER 並拒絕處理。
- B13 故意輸入未列出的 email：工具不自動遮蔽，警告仍可見，避免誤認為已偵測。

## Gate

所有自動 A cases 必須通過。B01–B03、B06–B08、B11–B13 是 M1 真 browser 必驗；B08 的 320px viewport 必須實測。B09 zoom 與 B10 Network/Storage 在工具不支援時可分別記 NOT_RUN。原生 clipboard/download 如設備限制可記 NOT_RUN，但不可宣稱完成 M1 所需能力已人工通過。Network/Storage 能力不足同樣保留 NOT_RUN，不以靜態掃描冒充。
