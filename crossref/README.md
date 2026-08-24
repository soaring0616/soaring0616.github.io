# 串珠探索

<https://soaring0616.github.io/crossref/>

以「一節經文＝一個節點、串珠＝連線」的互動節點圖（vis-network）。
選一節聖經展開它的串珠，點任一節點可繼續往下追；網址 hash 可分享，如 `#45.8.1` 直接開羅馬書 8:1。

**焦點模式**：貼上一份經節清單（如「彼前二4～5，亞三9，四10，約十11～16，結三四11～31」），
只畫出這些段落彼此之間的串珠與被兩處以上共同引用的橋接經節，不會無限擴張；
焦點清單也會寫進網址 hash（`#f=…`），可以直接分享給聖徒。

## 資料來源

- 經文、串珠、註解即時取自[網上聖經恢復本](https://www.recoveryversion.com.tw/)公開 API（`getVerses` / `getFoots` / `getFootnotes`，CORS 開放），以 localStorage 快取 30 天；repo 內不存任何經文資料。
- 「查職事文集」按鈕以表單 POST（該站無 CORS，僅能跳轉）在新分頁開啟[李常受文集線上索引](https://cwwl.twgbr.org/)該節的搜尋結果。

## 結構

純靜態、無建置步驟：

| 檔案 | 職責 |
|------|------|
| `js/books.js` | 66 卷書卷表（書卷號、縮寫、章數） |
| `js/parser.js` | 串珠縮寫解析（「約七50，十九39」「詩一○四14」→ 書.章.節） |
| `js/api.js` | API 包裝與兩層快取（記憶體 + localStorage） |
| `js/app.js` | 節點圖、側欄、選單、cwwl 表單 |

API 欄位命名注意：`chapter_code`＝書卷號（1–66）、`section_code`＝章、`segment_code`＝節。

## 本機預覽

```bash
python3 -m http.server 8000
# http://localhost:8000/crossref/（加 ?test=1 可在 console 執行解析器自測）
```
