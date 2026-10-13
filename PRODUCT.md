# 產品規格：自訂文字遮蔽

狀態：SPEC_ONLY；工作情境與價值仍為假設。尚無產品或測試證據。

## 使用者與工作

使用者準備把一小段訊息交給別人，希望先移除他已知道要隱藏的精確字串，例如某個 email 或參考編號。使用者貼入來源，新增遮蔽目標，查看替換後的完整輸出，自行逐行檢查，再複製或下載結果。

## 功能需求

- **FR-01 輸入：** 來源最多 100000 UTF-16 code units；空來源可輸入但不能執行遮蔽。拒絕 unpaired surrogate，合法 Unicode 原文保持 code point 順序，不 trim、不做 NFC/NFKC 或大小寫正規化。來源可含換行與一般控制字元，當作純文字處理。
- **FR-02 規則：** 最多 50 個依畫面順序排列的目標字串。每個目標長度 1–200 UTF-16 code units；精確、大小寫敏感、空白敏感，不 trim。空字串拒絕；單一空格或多個空格是有效字面目標。拒絕完全相同的重複目標和不成對 surrogate。目標是單行 literal；拒絕所有 C0/C1 控制碼（U+0000–001F、U+007F–009F），因此不接受換行。來源可含換行；工具處理 textarea.value 當下的字串且不再 normalize，瀏覽器貼上行為可能已把外部 CRLF/CR 轉成 LF。
- **FR-03 預設替代字串：** 所有匹配固定替換為 [REDACTED]，中英文介面一致；不提供自訂 replacement。固定詞不會再當作輸入掃描或觸發第二輪替換。
- **FR-04 字面比對：** 只做原文逐字比對；regex 特殊字元是一般文字。比對精確大小寫與 code point，不轉換標點、不正規化。從來源左至右一次消耗，不重疊替換。若多個目標同一起點匹配，最長目標優先；長度以 Unicode code point 計，若同長按規則順序先者優先。精確重複已拒絕，因此同起點同長 tie 僅為防禦性規則。
- **FR-05 重疊結果：** 規則 Ann、Anna，來源 Anna Ann，輸出 [REDACTED] [REDACTED]；Anna 命中 1 次、Ann 命中 1 次。若規則依序為 A、AB，來源 AB 應由較長 AB 命中。
- **FR-06 命中摘要：** 顯示總命中數與每條規則的命中數；未匹配規則顯示 0。命中計數是非重疊實際替換次數，不是候選重疊數。允許 0 次命中，明確顯示輸出與來源相同，並提醒要人工核對。
- **FR-07 執行與失效：** 只按「遮蔽指定字串」執行，不在每次輸入時處理。改來源或任一目標、增刪規則後立即清除舊輸出、命中數、copy/download 狀態。invalid 欄位不可沿用先前結果。
- **FR-08 複製：** 只提供複製遮蔽後輸出，不複製來源或報告。按下後捕捉 revision/requestId 和固定輸出 snapshot；單次 async clipboard busy 期間鎖定來源/規則/處理/清除/其它複製控制直到 resolve/reject。只在 request 仍最新時更新狀態。API 不存在或拒絕時選取輸出 textarea，提供手動複製指示，不顯示成功。
- **FR-09 TXT 下載：** 使用者按「下載遮蔽結果」才以原生 Blob/download 產生固定檔名 glossquote-redacted.txt；UTF-8 no BOM，文本內容不追加 LF，保留輸出原換行。mime 為 text/plain;charset=utf-8。沒有 metadata/timestamp/IP；不下載來源、規則或命中報告。
- **FR-10 警示：** 輸入與結果兩區明確分開。每次結果旁固定提醒：「只替換你列出的字串；工具不會自動偵測其他個資。分享前請自行檢查完整輸出。」不得聲稱匿名化、保證安全或刪除所有個資。
- **FR-11 清除確認：** 清除來源、規則與輸出需確認；取消保留所有目前資料/結果。確認回到空來源、一條空目標、無結果。Escape 等同取消，關 dialog 後還原焦點。
- **FR-12 邊界：** 來源長度 >100000、目標 >200、超過 50 條、空目標、重複目標、source/target invalid surrogate、C0/C1 target control 全部拒絕且不回傳部分 output。固定 replacement 長度 10 code units；最多 100000 個單碼點命中，output <=1,000,000 UTF-16 units。
- **FR-13 雙語：** 中文 /index.html、英文 /en/index.html。固定 replacement 保持英文標記兩語一致；所有告警、錯誤、數量複數和 controls 完整翻譯。
- **FR-14 隱私與生命週期：** 無 localStorage/IndexedDB/cookie/URL state、帳號、網路、telemetry、API。來源、規則、輸出只活在本分頁記憶體；pagehide 清理應用程式 references。錯誤/console/network 不得寫來源、目標或輸出。
- **FR-15 DOM 安全：** 所有來源、規則與輸出為不可信文字，只用 input.value/textContent。不得 innerHTML、eval、動態 code、regex construction 或標記語言解讀。
- **FR-16 下載與複製結果：** download/copy 只含處理結果；零命中也可以匯出，但仍顯示零命中提醒。原始來源永遠不加入下載副本。

## 非目標

不做智慧偵測、個資分類、格式檔案讀取、replacement 設定、規則匯出、批次處理、undo 歷史、雲端儲存、保證匿名化或法律/安全判斷。
