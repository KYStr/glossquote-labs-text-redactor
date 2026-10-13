# 介面與 SEO 規格：自訂文字遮蔽

狀態：SPEC_ONLY；畫面、SEO 和 browser API 均未驗收。

## Product App 畫布

第一屏展示來源大文字區，來源旁有顯眼的「只遮蔽你明確列出的字串」說明。下方是目標字串規則列表、加規則按鈕與「遮蔽指定字串」主動作。結果在輸入下方，清晰標為「處理後副本」，整段顯示，旁邊只有「複製遮蔽結果」「下載遮蔽結果」。不把來源和結果混在同一文字框或報告中。

桌面為單一寬畫布：來源 textarea → 遮蔽目標逐條列表（順序清楚）→ primary process action → 命中數 → 結果 textarea。手機 320px 使用單欄；規則每條獨立可編輯、刪除按鈕有標籤；來源與結果可垂直捲動但不造成整頁水平溢出。行動裝置虛擬鍵盤不得遮住目前焦點或主要動作。

## 介面文案

常駐警示：「只替換你列出的字串。工具不會自動找出其他個資；分享前請逐段檢查輸出。」
英文：“Only the exact strings you list are replaced. This tool does not detect other personal data. Review the full output before sharing.”

- 空來源：「貼入你要檢查的文字。」英文 “Paste the text you want to review.”
- 空規則：「新增至少一個要遮蔽的字串。」英文 “Add at least one string to redact.”
- 匹配成功：「已替換 N 處。這不是完整的個資偵測；請檢查全文。」零命中要說「找不到指定字串，輸出與來源相同。」
- target 欄標籤「要遮蔽的原字串 1」；help 說明大小寫與空白都精確匹配。目標只能是一行；換行與控制字元會被拒絕，前後空白不會被刪除。英文 help: “Match is case- and space-sensitive. Enter one line; line breaks and control characters are rejected. Leading and trailing spaces are kept.”
- replacement 固定說明：「每次符合都會替換為 [REDACTED]。」
- source 改動後：「來源或規則已變更；舊結果已清除，請重新處理。」
- 來源超限/錯誤不得回顯原文；目標重複指出第幾條衝突，但不在 console 印其內容。
- 清除確認明說清掉來源、規則和結果；取消保留目前畫面。
- Copy API reject 時選取輸出並說明如何手動複製，無成功提示。
- 刷新提示：「重新載入會清除目前文字和規則。下載結果前請先自行確認。」

結果旁持續顯示限制聲明。0 match 可複製/下載，但提醒輸出原文完全未變，不要把按鈕標成「已匿名化」。Source editing、rule changes、dialog cancel 都應保持焦點預期；狀態用文字與 icon，不只顏色。200% zoom、keyboard、reduced motion、screen reader labels 必須驗。

## SEO 草案

Slug text-redactor；預定 host redact.glossquote.com，尚未部署。預覽 noindex/nofollow/Disallow:/，不含正式 canonical/sitemap。

繁中 title：自訂文字遮蔽工具｜GlossQuote Tools
description：貼上文字並指定要遮蔽的字串，在瀏覽器本機逐字替換。工具不會自動偵測其他個資，分享前請自行檢查結果。
H1：自訂文字遮蔽
intro：只替換你列出的確切文字，固定以 [REDACTED] 取代。它不是自動個資偵測器。
FAQ：「會自動找出姓名或 email 嗎？」不會，只會替換你列出的字串，請檢查全文。「大小寫或空白一樣嗎？」大小寫和空白精確比對；目標限單行，拒絕換行和控制字元，也不 trim 或正規化。「原文會上傳嗎？」文字依設計在目前瀏覽器分頁處理，不提交給工具服務；不需要帳號或雲端，重新載入會清除目前文字。

English title: Custom Text Redactor | GlossQuote Tools
description: Replace exact strings you specify in text, locally in your browser. The tool does not detect other personal data; review the result before sharing.
H1: Redact strings you specify
English FAQ: “Does this find all personal data?” No. It only replaces strings you list; review the full output. “Do case and spaces matter?” Yes. Matching is case- and space-sensitive; targets must be one line, and line breaks/control characters are rejected. “Is my text uploaded?” The text is processed in this browser tab and is not submitted to the tool service by design. No account or cloud is required; reloading clears the text.

M2 才寫正式 HTTPS canonical、zh-Hant/en/x-default reciprocal hreflang、OG metadata、robots/sitemap 與和可見頁面一致的 WebApplication JSON-LD。禁止安全、合規、完全匿名、用戶量或排名宣稱。
