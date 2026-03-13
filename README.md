# BOM Comparison Tool

BOM（Bill of Materials）比對工具，用於比較兩期 BOM 檔案的差異，快速找出價格與數量的變動。

## 功能特色

- **雙檔案比對** — 上傳 Current / Prior BOM Excel 檔案，自動進行 Full Outer Join
- **智慧合併** — 自動合併內容完全相同的 Product，減少重複顯示
- **彙總樞紐表** — 以 MtlGroup × Product 呈現金額差異矩陣
- **三分類明細** — 將變動分為「數量差異」「價格差異」「價格與數量差異」三區
- **Drill-down 互動** — 點擊彙總表數值即可查看該交叉的明細
- **篩選 & 門檻** — 依 Project 篩選，或設定 Change% / AmtDiff 門檻過濾小幅變動
- **折疊/展開** — Pivot 群組支援收合，收合時顯示 AmtDiff 小計
- **雙語切換** — 支援英文 / 繁體中文即時切換
- **Excel 匯出** — 下載包含 Summary 與 Detail 兩個工作表的 .xlsx 檔案
- **範本下載** — 提供標準 BOM 格式範本
- **RWD 響應式** — 支援桌面與行動裝置

## 專案結構

```
bom_comparison/
├── index.html              # HTML 頁面結構 & script 載入
├── css/
│   └── styles.css          # 所有 CSS 樣式（設計系統變數、元件、RWD）
└── js/
    ├── state.js            # 全域狀態變數
    ├── i18n.js             # 翻譯字典 & 語言切換函式
    ├── file-handler.js     # 檔案上傳、拖放、Excel 讀取
    ├── bom-processor.js    # BOM 核心邏輯（processBOM, fullOuterJoin, buildSummary, mergeIdenticalProducts）
    ├── filter.js           # 篩選邏輯 & 門檻控制
    ├── render.js           # 所有 DOM 渲染函式（統計、彙總表、明細表、filter tags）
    ├── export.js           # Excel 匯出（downloadTemplate, downloadExcel）
    └── app.js              # 主流程（runComparison）& 狀態訊息
```

## 使用方式

1. 用瀏覽器直接開啟 `index.html`（無需安裝任何套件或伺服器）
2. 上傳 **Current BOM** 與 **Prior BOM** 兩個 Excel 檔案
3. 點擊 **Compare** 執行比對
4. 檢視統計數字、彙總表與明細表
5. 可透過 **Download (.xlsx)** 匯出完整比對結果

## BOM 檔案格式

Excel 檔案需包含以下欄位（或使用 Template 下載範本）：

| 欄位 | 說明 |
|------|------|
| Project | 專案名稱 |
| Product | 產品名稱 |
| MtlGroup | 材料群組 |
| Material | 料號 |
| Desc/Spec | 描述/規格 |
| Unit Cost | 單價（也接受 `Price(USD)` 欄位名稱） |
| Ttl. Usage | 總用量 |

工作表名稱建議為 `BOM Data`，若無則自動使用第一個工作表。

## 外部依賴

- [SheetJS (xlsx)](https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js) — 透過 CDN 載入，用於 Excel 檔案讀寫

## 授權

&copy; 2026 BOM Comparison Tool
