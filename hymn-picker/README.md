# 聚會選詩歌 hymn-picker

<https://soaring0616.github.io/hymn-picker/>

幫主持聚會的人預備詩歌：選一個聚會類型，依「類別吻合、會眾熟悉度、有沒有副歌」排出候選，
每一首都附上**推薦理由**，可以直接拿去跟服事的弟兄姊妹討論。

純前端靜態網站：Vite + React 18 + TypeScript，資料全放在 `public/data/*.json`，沒有後端。
這是 [soaring0616.github.io](../README.md) 的一個分頁；原始碼放在這個資料夾，
build 出來的 `dist/` 不進 git，由 repo 根目錄的 GitHub Actions 建置後部署到 `/hymn-picker/`。
**改 `public/data/*.json` 直接 commit + push 就會上線**，本機不需要 Node。

---

## 資料怎麼新增

### `public/data/hymns.json`

一個陣列，每個元素是一首詩歌：

| 欄位 | 必填 | 說明 |
| --- | :-: | --- |
| `id` | ✅ | 全域唯一。`h-` 大本／`s-` 補充本／`n-` hymnal.net 新歌，後面接號碼，例如 `h-623`。**這是 React 的 `key`，一旦發布就不要再改**。 |
| `book` | ✅ | `hymnal`＝大本（hymnal.net `ch/`，1–780 首）｜`supplement`＝補充本（`ts/`）｜`new`＝hymnal.net 新歌 New Songs（`ns/`；注意 `nt/` 是 New Tunes 新調，不是新歌） |
| `no` | ✅ | 該本裡的號碼（數字，不是字串） |
| `title` | ✅ | 中文標題 |
| `firstLine` |  | 第一句歌詞，卡片上顯示在標題底下幫忙辨認 |
| `categories` | ✅ | 中文類別陣列，例如 `["記念主", "主的救贖"]`。**選詩全靠這個欄位**，見下面的類別詞彙表。 |
| `key` / `time` / `meter` |  | 調號／拍號／韻律，例如 `"降E大調"`、`"4/4"`、`"8.7.8.7 副"` |
| `hasChorus` | ✅ | 有沒有副歌（`true` 會在評分時加分，兒童／福音聚會權重最高） |
| `familiarity` |  | 會眾熟悉度 0–1。不填就依書別預設（大本 0.6／補充本 0.45／新歌 0.3）。不常唱的填低一點（例如 `0.2`）就會往後排，並在理由裡標「會眾較不熟」 |
| `enNo` |  | hymnal.net 的英文號 |
| `urls.hymnal` |  | hymnal.net 網址 |
| `urls.luke54` |  | luke54.org 網址陣列（沒有就放 `[]`） |
| `notes` | ✅ | 註解陣列，見下 |

`notes` 的每一則：

| 欄位 | 必填 | 說明 |
| --- | :-: | --- |
| `type` | ✅ | `excerpt` 摘句｜`story` 背景｜`scripture` 經節｜`tip` 帶詩歌提醒 |
| `text` | ✅ | **一到兩句**就好，長篇請放 `url` 連出去 |
| `source` | ✅ | 出處，例如「hymnal.net 歌詞（副歌）」「詩 134:1-3」 |
| `url` |  | 全文連結；沒有就不會出現「閱讀全文 →」 |

新增一首詩歌 = 在陣列尾巴加一個物件，commit、push 就會上線。
TypeScript **不會**檢查 JSON 內容（它是執行期 fetch 進來的），所以欄位打錯要靠自己看畫面。

### `public/data/meeting_types.json`

| 欄位 | 說明 |
| --- | --- |
| `id` / `label` | 內部代號／畫面上顯示的名字 |
| `include` | 允許的類別。**空陣列 = 不限**（出遊、特別聚會、自訂就是這樣） |
| `exclude` | 排除的類別，命中任一個整首排掉（優先於 `include`） |
| `weights` | `familiarity` 熟悉度（只看書別：大本 > 補充本 > 新歌）／`chorus` 有副歌／`themeMatch` 類別吻合。會自動正規化成總和 1，所以寫 `3/2/5` 或 `0.3/0.2/0.5` 效果一樣 |
| `sections` | 分段，例如擘餅的「記念主 → 敬拜父」。每段有自己的 `include`，但沿用聚會層級的 `exclude` 與 `weights`。**同一首詩只會出現在一個段落**：歸到命中該段類別最多的段落，平手放前面的段落 |
| `suggestedCount` | 建議選幾首（決定畫面上先顯示幾張卡片，其餘收在「再多看幾首」後面） |

目前的類別詞彙（`categories` 與 `include`/`exclude` 要用同一組字，多一個空格就對不上）：

> 記念主、主的救贖、基督的所是、敬拜父、讚美主、感恩、召會生活、教會、聖靈、
> 經歷神、安慰、渴慕、獻上自己、禱告、祈求、爭戰、福音、傳福音、得救的確據、
> 聖經、青年、兒童

---

## 專案結構

```
hymn-picker/
├─ public/data/
│  ├─ hymns.json            # 詩歌主資料（目前 27 首，已對照 hymnal.net 校正）
│  └─ meeting_types.json    # 12 種聚會的選詩規則
├─ src/
│  ├─ types.ts              # 所有型別定義（資料的合約）
│  ├─ lib/
│  │  ├─ select.ts          # 純函式：過濾 + 評分 + 排序
│  │  ├─ select.test.ts     # vitest 測試
│  │  └─ data.ts            # 載入 JSON（用 BASE_URL 組路徑）
│  ├─ components/
│  │  ├─ HymnCard.tsx       # 詩歌卡片（含最完整的教學註解）
│  │  ├─ MeetingSelector.tsx
│  │  └─ HymnList.tsx
│  ├─ pages/
│  │  ├─ Home.tsx           # 選聚會 → 看推薦
│  │  └─ HymnDetail.tsx     # 單首詳細頁（註解 + 外部連結）
│  ├─ App.tsx               # HashRouter 與路由表、頁首（含「回首頁」連結）
│  └─ main.tsx              # 進入點
└─ vite.config.ts           # base 預設 /hymn-picker/，可用 VITE_BASE 蓋掉

（部署用的 workflow 在 repo 根目錄 ../.github/workflows/deploy.yml，不在這個資料夾裡）
```

技術棧：Vite 4 + React 18 + TypeScript + react-router-dom 6（HashRouter）+ vitest。
樣式用 CSS Modules（`*.module.css`），沒有 UI 框架、沒有 Tailwind。

## 資料來源與校正狀態

`hymns.json` 目前的 27 首，標題、第一句、調號、拍號、韻律、有無副歌、英文號與 `notes` 裡的
摘句、作者資料，都是 2026-09-06 直接從 <https://www.hymnal.net> 對應頁面抄下來的。
**`categories` 是依歌詞內容與 hymnal.net 的分類初步對到本專案的類別詞彙**，帶詩歌的人請再校對。
`urls.luke54` 目前都是空陣列，沒有查證過的連結就不放。

`notes` 裡 `type: "tip"` 的帶詩歌提醒，以及部分作者背景，出自
[1000首詩歌 1000個吉他手](https://1000hymns.blogspot.com/search/label/%E5%94%B1%E8%A9%A9%E4%BA%BA%EF%BC%86%E5%8F%B8%E7%90%B4%E8%80%85%E5%BF%85%E8%AE%80)
「唱詩人＆司琴者必讀」標籤下的文章（擘餅點詩的 9 大禁忌、李常受弟兄談聚會中的 10 種詩歌與選詩原則等），
每則都附了原文連結。第二批的 21 首就是這些文章點名的詩歌。

新增詩歌時的兩個提醒：

- hymnal.net 對**不存在的號碼不會回 404**，而是隨機回一首字序打亂的詩歌。
  抓資料時要確認頁面上的編號標籤（例如 `C623`、`Cs201`、`NS1158`）跟你要的號碼一致，且歌詞是通順的。
  大本在 hymnal.net 只到 780 首，超過的號碼一律是這種誘餌頁。
- 早期的假資料曾把大本 786、新歌 1290 列進來，這兩個號碼在 hymnal.net 上都不存在，已移除。
