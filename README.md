# 節奏練習台

Obsidian 外掛：打擊基本功練習、練習記錄、教材卡。桌機與手機版 Obsidian 都能用。

> 目前是**階段 0（手機可行性測試版）**，只有安裝測試與節拍器測試，還不會建立練習記錄。

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

更新：設定 → BRAT → Check for updates。

## 開發

```bash
npm install
npm test
npm run build
```

## 隱私

不做帳號、雲端、遙測。外掛只讀寫 vault 裡你指定的資料夾。
