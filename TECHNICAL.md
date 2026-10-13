# 技術規格：自訂文字遮蔽

狀態：SPEC_ONLY；以下介面與驗收尚未實作，均 NOT_RUN。

## 架構與檔案

純靜態繁中/英文 HTML/CSS/ESM。Browser 記憶體執行遮蔽、原生 clipboard/download。Node.js >=24 只提供 loopback preview、node:test/check/build。無 runtime dependency、worker、Server API、CDN/外部字體。

目標檔案：package.json；.gitignore；public/index.html、public/en/index.html；public/styles/app.css；public/js/app.mjs、i18n.mjs、state.mjs；public/js/core/text-redactor.mjs；scripts/serve.mjs、check.mjs、build.mjs、validation.mjs；test/text-redactor.test.mjs、test/ui-contract.test.mjs、test/toolchain.test.mjs。dev 預設 127.0.0.1:4204，隔離 spikePort 5204。port occupied 時不停止/kill既有程序，退回 OS 分配的空閒 loopback port，印出並記錄實際 URL。

## Core API、精確輸入 shape 與錯誤

唯一公開純函式為 redactText(request)。只接受 plain object（prototype 為 Object.prototype 或 null），exact own keys 僅 source 與 rules。兩欄都必須是 own enumerable data properties；拒絕額外/缺漏/symbol/non-enumerable/accessor key、getter/setter 和其它 prototype，不讀取任何 getter。

rules 是密集 string[]，不是 {target} object array。Array 的 own keys 僅可為標準 length 與 0..length-1 canonical 連續 numeric keys；length 是 non-enumerable、non-configurable data property，index 都必須是 enumerable data property。拒絕 holes、額外鍵、symbol、非 canonical index 和 accessor；index 的 writable/configurable flags 不修改也不要求特定值。所有 shape 先以 Reflect.ownKeys/descriptor 讀取，不呼叫 user-supplied getter。

- validateSource(source) → {ok:true,codePointLength,utf16Length} 或 {ok:false,code}。source 必須 string、UTF-16長度<=100000、不含 unpaired surrogate、非空；不 normalize。空 source 回 SOURCE_EMPTY。
- validateRules(rules) → {ok:true,validatedRules:string[]} 或 {ok:false,code,ruleIndex:null|number}。rules 必須密集 Array；length 0 回 NO_RULES，>50 回 TOO_MANY_RULES。按原始 index 逐條驗 string type、raw UTF-16 length<=200、非空、well-formed surrogate、無 C0/C1 control、與較早規則完全相同目標不重複。目標逐字保留，不 trim。ruleIndex 為 1-based；不是單一 target 錯誤時為 null。
- redactText(request) success exact result {ok:true,output,totalMatches,perRule:[{ruleIndex,matchCount}],sourceCodePointCount,outputCodeUnitLength}。perRule 按原始 1-based 順序，不包含 target text。
- failure exact union {ok:false,code,ruleIndex:null|number}；rule-specific errors 有 1-based index，其它錯誤 null。failure 不含 output/partial output/計數。
- 錯誤優先序固定：request object/prototype/exact keys/descriptors → validateSource（type、size、surrogate、empty）→ rules 必須為 Array 且 length descriptor 正確 → length>50 時 TOO_MANY_RULES（先於掃描 index，避免巨大 sparse length）；再檢 exact own keys/dense data index → length=0 時 NO_RULES → 按 index 順序逐條檢查 type、length、empty、surrogate、control、duplicate。第一個失敗回傳，沒有 partial output。
- codes 固定：INVALID_REQUEST、INVALID_SOURCE、SOURCE_TOO_LONG、INVALID_UNICODE、SOURCE_EMPTY、NO_RULES、TOO_MANY_RULES、INVALID_RULES、TARGET_TOO_LONG、TARGET_EMPTY、TARGET_CONTROL_CHARACTER、DUPLICATE_TARGET。
- Source/target 不做 trim、Unicode normalization、case folding；UTF-16 units 用於輸入硬上限，Unicode code points 用於 trie match 長度。HTML textarea.value 是 UI 當下 source；瀏覽器可能在貼上時先正規化換行，MVP 不承諾還原貼上前原始 newline bytes。source 可包含控制字元；target 不可包含任何 C0/C1 control（包括 tab、CR、LF）。
- UI 以 ruleDrafts 保存目前文字。可提供一個空白編輯列；該列若送出會得到 TARGET_EMPTY，不能 trim、忽略或轉成 NO_RULES。使用者刪除全部列後送出才是 NO_RULES。此區分保留空白 target 可被精確匹配的規則。

## 有界字面比對

每次執行先驗證 source/rules 全部有效，否則回錯且 output 不存在。將 source 與每條 target 轉成 code point arrays。建立 trie：每個邊是一個完整 code point；terminal stores rule index。最多 50 rules、每條 <=200 UTF-16 units，總 trie 節點上限 <=10001（根節點加所有目標 code points），沒有 regex、backtracking 或動態生成程式碼。

左至右遍歷來源 token index i。從 i 沿 trie 最多走 200 code points，記錄遇到的最深 terminal；找到匹配就輸出固定 [REDACTED]、對該規則計數加一，並讓 i 前進匹配長度（不重疊）；未匹配就輸出一個原 token、i+1。只讀原 source，輸出 token 不再掃描。最長 terminal 勝出；若同長則較小 ruleIndex 勝出。因完全相同 target 在驗證時拒絕，同一起點同長 tie 只保留防禦性規則。

Worst case trie walking <= sourceCodePoints × 200 <= 20,000,000 edge checks；source scan <=100,000 steps；target trie <=10,001 nodes；output UTF-16 <=1,000,000 units；所有值為固定上限。這給出明確操作上限，不承諾特定手機完成時間。同步處理，不新增 worker/cancel 介面。不得在失敗時回傳局部 output。

## State、async 與檔案

UI state exact conceptual fields: source:string、ruleDrafts:string[]、revision:number、output:string|null、matchCounts:null|array、totalMatches:number|null、fieldErrors、copy:{busy,requestId,revision,status}、notice、disposed:boolean。source 與 ruleDrafts 只在目前分頁記憶體；提交前不產生 output。

來源或任一 target draft 有改動時 revision++，同步 output=null、matchCounts=null、totalMatches=null，disable copy/download。只有明確 submit 且 core 成功時安裝 output；core failure 清空所有舊結果。ruleDrafts 依顯示順序逐字傳給 core，不 trim/normalize/過濾空字串。

clipboard writeText 僅由 user gesture。發出 request 前若 busy 或 disposed 就拒絕，不建立第二個並行請求。開始時 latestRequestId++、busy=true，鎖住編輯/清除/重新處理，保存不可變 output snapshot 與 revision。resolve/reject 及 finally 都先核對 latestRequestId、revision、disposed；只有目前 request 可更新通知或解除 busy。API 不存在或 reject 時將仍有效的 output 放入 readonly textarea、focus/select，顯示手動複製，不偽稱成功。pagehide 使 request 過期且 late Promise 不更新 DOM。

下載在 click handler 同步以 TextEncoder 將 output 編成 UTF-8，不加入 BOM；建立 Blob text/plain;charset=utf-8，anchor filename 固定 glossquote-redacted.txt，bytes 完全等於 output、不加 LF。click 後 object URL 延遲 60 秒 revoke，不在同步 finally 立刻撤銷；pagehide 標 disposed、revision/requestId 遞增、撤銷所有 URL 並將 source/ruleDrafts/output 引用設空。任何 late async completion 不得更新 DOM。Download 必須是真 browser evidence；mock Blob 不足以宣稱檔案 bytes 通過。