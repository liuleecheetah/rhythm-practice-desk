# 節奏練習台

Obsidian 外掛：打擊基本功練習、練習記錄、教材卡。桌機與手機版 Obsidian 都能用。

> 目前是**階段 4**：練習記錄、進度推導、今日頁、節拍器、29 個練習腳本、等級與徽章、成效檢視頁、節奏卡（鼓譜、變形、影片段落）。資料格式見 [docs/資料格式.md](docs/資料格式.md)。

## 結構

| 位置 | 內容 | 依賴 Obsidian |
| --- | --- | --- |
| `packages/learning-core` | 學習模組：練習記錄讀寫、進度推導、教材卡。可重複用於其他學習外掛 | 是 |
| `packages/rhythm` | 節奏練習：節拍器引擎、練習腳本、課程資料 | 否（有測試檢查） |
| `src/` | 外掛外殼，把兩個模組接起來 | 是 |

## 用 BRAT 安裝（iPhone 與 Mac 相同）

1. Obsidian → 設定 → 第三方外掛 → 瀏覽，搜尋並安裝 **BRAT**，啟用。
2. 設定 → BRAT → **Add Beta plugin**，填入 `liuleecheetah/rhythm-practice-desk`，按 Add Plugin。
3. 設定 → 第三方外掛 → 啟用「節奏練習台」。
4. 設定 → 節奏練習台 → 把「筆記資料夾」設成你要的資料夾（相對於 vault 根目錄）。
5. 把課程檔 `COURSE.md` 放在筆記資料夾裡（或在設定指定路徑）。練習說明頁從這個檔案顯示做法；課程全文不放進這個 repo。

更新：設定 → BRAT → Check for updates。

## 開發

```bash
npm install
npm test
npm run build
```

## 授權

保留所有權利，見 [LICENSE](LICENSE)。

## 隱私

不做帳號、雲端、遙測。外掛只讀寫 vault 裡你指定的資料夾。
