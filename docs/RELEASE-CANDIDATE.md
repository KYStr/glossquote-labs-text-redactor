# 發布候選紀錄：自訂文字遮蔽

狀態：2026-10-13 主代理 M1 驗收通過並正式放行 REDACT-M2-T01。M1 preview/runtime 保持凍結，M2 source candidate 已實作；實際公開來源／ZIP結果另記 HANDOFF/evidence，未發布 hosting。

| Gate | 狀態 |
|---|---|
| M1 fixed manifest / source hash | PASS，fixed-manifest.json 含 source/code/runtime/dist 的每檔 bytes/SHA256 |
| Node version / test/check/build | PASS，Node v24.14.0 / npm 11.9.0；三個必要命令 exit 0 |
| Auto cases A01–A36 | PASS，44 項測試；無 skipped/failed |
| zh/en browser main flow | PASS，真 Edge；完整來源／規則／輸出／命中數見 browser-cases.json |
| clipboard/download real-browser result | clipboard PASS；download 落盤檔案/bytes NOT_RUN（native click 已嘗試，事件未返回路徑） |
| 320px / 200% / keyboard | 兩語 320px PASS；keyboard PASS；實際 200% browser zoom NOT_RUN |
| Network / Storage | NOT_RUN |
| M1 primary acceptance | PASS，獨立 44 tests/check/build、真 browser 主流程、copy/clear/320；授權 M2 only |
| production SEO / headers / 404 | 已實作 13 檔，release tests/http model 已通過；最終 gates/Cloudflare edge 證據分開記錄 |
| GitHub visibility / commit / blob ZIP | NOT_RUN |
| Cloudflare / home / external reviewer | NOT_RUN |

Evidence：../../../.runs/text-redactor/m1-2026-10-13-01a133ac/。完整 Network/Storage、真手機／虛擬鍵盤／IME／screen reader 未測；靜態檢查不代替原生人工證據。

Code SHA256：b9f1a9539f8a184ec201b42d56d8cb57ff44f84e29697147e781e412c5fa1011。
Runtime SHA256：169709438bbb273b1f62021014c30e8a4f69472ede4318dfeda076ae65134faa。
Dist SHA256：e0531338d32c6aac5efd0b8571ffcd144cd9c442ba41aa93a1a833df400d3688。

M1 Windows before/after 的完整 Snapshots 完全相同，包含 HKCU/HKLM PATH hash/type/length、ephemeral entries 與完整 Environment key fingerprint。M1 preview 保持可用。M2 另有新的 before/after Environment 及 Git settings guard，不挪用 M1 快照冒充 source-publication block 的保護。
