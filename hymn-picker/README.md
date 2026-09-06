# 聚會選詩歌 hymn-picker

<https://soaring0616.github.io/hymn-picker/>

幫召會主持聚會的人預備詩歌：選一個聚會類型，依「類別吻合、會眾熟悉度、有沒有副歌、
最近是不是才唱過」排出候選，每一首都附上**推薦理由**，可以直接拿去跟服事的弟兄姊妹討論。

純前端靜態網站：Vite + React 18 + TypeScript，資料全放在 `public/data/*.json`，沒有後端。
這是 [soaring0616.github.io](../README.md) 的一個分頁；原始碼放在這個資料夾，
build 出來的 `dist/` 不進 git，由 repo 根目錄的 GitHub Actions 建置後部署到 `/hymn-picker/`。

---

## 快速開始

本機的 Node / pnpm 裝在 conda 環境 `teacher-monster` 裡，每次開新終端機先啟用：

```bash
conda activate teacher-monster
node -v   # v16.20.2
pnpm -v   # 8.15.9
cd hymn-picker
```

<details>
<summary>這台機器為什麼是 Node 16？（重要，決定了整包套件的版本）</summary>

這台是 **CentOS 7 / glibc 2.17**。Node 18 以上的官方 binary 需要 glibc 2.28，
在這裡直接跑不起來，所以本機固定用 **Node 16.20.2**，套件也跟著挑對應的版本：

| 套件 | 版本 | 原因 |
| --- | --- | --- |
| vite | 4.x | vite 5 需要 Node 18+ |
| vitest | 0.34.x | vitest 1/2 需要 Node 18+ |
| pnpm | 8.15.9 | pnpm 9 需要 Node 18+；lockfile 是 6.0 版 |
| react / react-router-dom / typescript | 最新 | 這幾個在 Node 16 上都沒問題 |

Node 是用官方 tarball 解壓到 conda 環境底下的
`$CONDA_PREFIX/opt/node16/`，再把 `node`/`npm`/`npx`/`pnpm` 連結到 `$CONDA_PREFIX/bin/`。
（`conda install nodejs` 在這台的舊版 solver 上會卡住數十分鐘，所以走這條路。
缺點是 `conda list` 看不到它，要移除就直接刪 `opt/node16/` 與那幾個 symlink。）

之後如果換到新機器（glibc ≥ 2.28，例如 Ubuntu 22.04），直接裝 Node 20 即可，
也可以把 vite 升到 5、vitest 升到 2、pnpm 升到 9，程式碼本身不用改，
但記得同步改 repo 根目錄 `.github/workflows/deploy.yml` 裡的版本。

</details>

| 指令 | 作用 |
| --- | --- |
| `pnpm install` | 安裝相依套件 |
| `pnpm dev` | 開發伺服器（<http://localhost:5173/hymn-picker/>），存檔即時更新 |
| `pnpm test` | 跑 vitest 單元測試（`src/lib/select.test.ts`） |
| `pnpm test:watch` | 邊改邊跑測試 |
| `pnpm typecheck` | 只做型別檢查 |
| `pnpm build` | 型別檢查 + 打包到 `dist/`（不進 git） |
| `pnpm preview` | 用本機伺服器預覽 `dist/`，網址同樣是 `/hymn-picker/` |

本機的網址跟正式站一樣都在 `/hymn-picker/` 子路徑底下，因為 `vite.config.ts` 的 `base`
已經寫死成 `/hymn-picker/`。開 <http://localhost:5173/> 會看到 Vite 提示你改去子路徑，這是正常的。

---

## 部署

不用手動 build。push 到 `main` 之後，repo 根目錄的 `.github/workflows/deploy.yml` 會：

1. 在 `hymn-picker/` 裡 `pnpm install → pnpm test → pnpm build`
2. 把 repo 的靜態檔（首頁、`articles/`、`crossref/` …）和 `hymn-picker/dist/` 組成完整網站
3. 部署到 GitHub Pages，這個 app 落在 <https://soaring0616.github.io/hymn-picker/>

所以**改 `public/data/*.json` 直接 commit + push 就會上線**，不需要在本機有 Node。
測試沒過（`pnpm test` 紅字）整個網站都不會部署，這是刻意的。

兩個「不這樣做就會壞」的地方：

- **`base`**：`vite.config.ts` 預設 `/hymn-picker/`（可用環境變數 `VITE_BASE` 蓋掉）。
  這個值決定 JS/CSS 與 `data/*.json` 的路徑，寫錯就會整頁 404。
- **HashRouter**：網址長成 `.../hymn-picker/#/hymn/h-623`。`#` 後面的部分不會送到伺服器，
  所以重新整理、直接貼網址都不會出現 GitHub Pages 的 404 頁。
  換成 `BrowserRouter` 就會壞掉。

---

## 學習順序

程式已經全部寫完可以跑，但**建議照這個順序讀**，每一站對應一個 React 概念，
後面附了一個小練習，做完就等於自己寫過一次。

### 0. `src/types.ts`　—　先看資料長什麼樣

所有型別的單一來源。看懂 `Hymn` / `MeetingType` / `HymnCandidate`，後面才看得懂資料怎麼流。

### 1. `src/lib/select.ts`　—　純函式（還不是 React）

`selectHymns(hymns, meetingType, opts)` 做過濾＋評分＋排序，回傳每首詩歌的 `score` 與 `reasons`。
它不 fetch、不碰 `localStorage`、連「現在幾點」都是從 `opts.now` 傳進來的，所以同樣輸入永遠同樣輸出。

> **這是整個專案最重要的觀念**：把「算什麼」跟「畫什麼」分開。
> 邏輯在純函式裡 → 好測試（見 `select.test.ts` 的 10 個測試）；React 只負責顯示。

🔧 練習：加一條規則「同一個聚會裡，大本、補充本、新歌盡量分散」，並補一個測試。

### 2. `src/components/HymnCard.tsx`　—　元件與 props

一個 React 元件就是「吃 props、吐 JSX」的函式。這個檔案的開頭有三段註解，說明
props 型別怎麼定、**為什麼這個元件完全沒有 state**、**為什麼 `key` 一定要用 `hymn.id`**。

🔧 練習：加一個 `compact?: boolean` prop，為 true 時不顯示 notes。

### 3. `src/components/HymnList.tsx`　—　`useState`＋清單渲染

第一個有 state 的元件。`expanded`（有沒有按「再多看幾首」）只有它自己在乎、
離開畫面就可以忘掉，所以放這裡剛剛好，不用往上抬。

🔧 練習：加一個「收合」按鈕，讓展開後可以收回去。

### 4. `src/pages/Home.tsx`（前半）　—　`useEffect` 抓資料

`useEffect(..., [])` 表示「元件出現在畫面上之後跑一次」。
`cancelled` 旗標是為了避免資料還沒回來使用者就離開頁面，對已卸載的元件 `setState`。

🔧 練習：把載入中的文字換成骨架畫面（灰色方塊）。

### 5. `src/pages/Home.tsx`（後半）　—　`useMemo` 算衍生資料

`sections` 是由 `hymns` / `meetingType` / `theme` / `history` **算出來**的，
不是另一份獨立狀態。衍生資料千萬不要再開一個 `useState` 去存 —— 那會有兩份真相、
遲早不同步。`useMemo` 只是省掉重複排序的效能優化。

🔧 練習：加一個「只看大本」的篩選，注意它應該是 state，而篩選後的清單是衍生資料。

### 6. `Home.tsx` ↔ `MeetingSelector.tsx`　—　狀態抬升

`MeetingSelector` 自己不記選了哪個聚會，只顯示 `selectedId` 並在使用者操作時呼叫 `onSelect`。
狀態放在 `Home`，因為 `Home` 也要拿它去跑 `selectHymns` —— 兩個元件都要用的東西，
就放到它們共同的父層。這叫 lifting state up，`MeetingSelector` 這種寫法叫受控元件。

🔧 練習：加一個「重設」按鈕，一次把聚會與主題關鍵字回到預設值。

### 7. `src/App.tsx` + `src/pages/HymnDetail.tsx`　—　路由

`HashRouter` 定義兩條路由，`HymnDetail` 用 `useParams()` 從網址取出 `:id`。
`App.tsx` 開頭有註解說明為什麼 GitHub Pages 一定要用 HashRouter。

🔧 練習：加一頁 `/about` 說明選詩規則，並在頁尾放連結。

---

## 資料怎麼新增

### `public/data/hymns.json`

一個陣列，每個元素是一首詩歌：

| 欄位 | 必填 | 說明 |
| --- | :-: | --- |
| `id` | ✅ | 全域唯一。`h-` 大本／`s-` 補充本／`n-` hymnal.net 新歌，後面接號碼，例如 `h-623`。**這是 React 的 `key`，一旦發布就不要再改**。 |
| `book` | ✅ | `hymnal`＝大本｜`supplement`＝補充本｜`new`＝新歌 |
| `no` | ✅ | 該本裡的號碼（數字，不是字串） |
| `title` | ✅ | 中文標題 |
| `firstLine` |  | 第一句歌詞，卡片上顯示在標題底下幫忙辨認 |
| `categories` | ✅ | 中文類別陣列，例如 `["記念主", "主的救贖"]`。**選詩全靠這個欄位**，見下面的類別詞彙表。 |
| `key` / `time` / `meter` |  | 調號／拍號／韻律，例如 `"降E大調"`、`"4/4"`、`"8.7.8.7 副"` |
| `hasChorus` | ✅ | 有沒有副歌（`true` 會在評分時加分，兒童／福音聚會權重最高） |
| `enNo` |  | hymnal.net 的英文號 |
| `urls.hymnal` |  | hymnal.net 網址 |
| `urls.luke54` |  | luke54.org 網址陣列（沒有就放 `[]`） |
| `notes` | ✅ | 註解陣列，見下 |

`notes` 的每一則：

| 欄位 | 必填 | 說明 |
| --- | :-: | --- |
| `type` | ✅ | `excerpt` 摘句｜`story` 背景｜`scripture` 經節｜`tip` 帶詩歌提醒 |
| `text` | ✅ | **一到兩句**就好，長篇請放 `url` 連出去 |
| `source` | ✅ | 出處，例如「hymnal.net 詩歌背景」「羅 12:1」 |
| `url` |  | 全文連結；沒有就不會出現「閱讀全文 →」 |

新增一首詩歌 = 在陣列尾巴加一個物件，存檔，`pnpm dev` 會自己重載。
`pnpm typecheck` **不會**檢查 JSON 內容（它是執行期 fetch 進來的），
所以欄位打錯要靠自己看畫面 —— 這是刻意的取捨，換來不用重 build 就能改資料。

### `public/data/meeting_types.json`

| 欄位 | 說明 |
| --- | --- |
| `id` / `label` | 內部代號／畫面上顯示的名字 |
| `include` | 允許的類別。**空陣列 = 不限**（出遊、特別聚會、自訂就是這樣） |
| `exclude` | 排除的類別，命中任一個整首排掉（優先於 `include`） |
| `weights` | `familiarity` 熟悉度／`chorus` 有副歌／`themeMatch` 類別吻合。會自動正規化成總和 1，所以寫 `3/2/5` 或 `0.3/0.2/0.5` 效果一樣 |
| `sections` | 分段，例如擘餅的「記念主 → 敬拜父」。每段有自己的 `include`，但沿用聚會層級的 `exclude` 與 `weights` |
| `suggestedCount` | 建議選幾首（決定畫面上先顯示幾張卡片，其餘收在「再多看幾首」後面） |

目前的類別詞彙（`categories` 與 `include`/`exclude` 要用同一組字，多一個空格就對不上）：

> 記念主、主的救贖、基督的所是、敬拜父、讚美主、感恩、召會生活、教會、聖靈、
> 經歷神、安慰、渴慕、獻上自己、禱告、祈求、爭戰、福音、傳福音、得救的確據、
> 聖經、青年、兒童

### 唱過的紀錄

存在瀏覽器的 `localStorage`（key：`hymn-picker/history/v1`），格式是 `{ "h-623": "2026-09-06" }`。
在詩歌詳細頁按「標記今天唱過」就會寫進去；預設 30 天內唱過的會被降分並在理由裡標註。
它是**每台裝置各自的紀錄**，不會跟著部署走，也不會同步到別人那裡。

---

## 專案結構

```
hymn-picker/
├─ public/data/
│  ├─ hymns.json            # 詩歌主資料（8 首範例）
│  └─ meeting_types.json    # 12 種聚會的選詩規則
├─ src/
│  ├─ types.ts              # 所有型別定義（資料的合約）
│  ├─ lib/
│  │  ├─ select.ts          # 純函式：過濾 + 評分 + 排序
│  │  ├─ select.test.ts     # vitest 測試
│  │  ├─ data.ts            # 載入 JSON（用 BASE_URL 組路徑）
│  │  └─ history.ts         # localStorage 唱過紀錄
│  ├─ components/
│  │  ├─ HymnCard.tsx       # 詩歌卡片（含最完整的教學註解）
│  │  ├─ MeetingSelector.tsx
│  │  └─ HymnList.tsx
│  ├─ pages/
│  │  ├─ Home.tsx           # 選聚會 → 看推薦
│  │  └─ HymnDetail.tsx     # 單首詳細頁 + 標記唱過
│  ├─ App.tsx               # HashRouter 與路由表、頁首（含「回首頁」連結）
│  └─ main.tsx              # 進入點
└─ vite.config.ts           # base 預設 /hymn-picker/，可用 VITE_BASE 蓋掉

（部署用的 workflow 在 repo 根目錄 ../.github/workflows/deploy.yml，不在這個資料夾裡）
```

技術棧：Vite 4 + React 18 + TypeScript + react-router-dom 6（HashRouter）+ vitest。
樣式用 CSS Modules（`*.module.css`），沒有 UI 框架、沒有 Tailwind。

## 範例資料的免責聲明

`hymns.json` 裡的 8 首是**示範用假資料**：號碼、標題、調號、類別都只是合理的佔位值，
`notes` 的網址用了 hymnal.net / luke54.org / cwwl.twgbr.org 的真實網域但路徑是編的。
正式使用前請以 <https://www.hymnal.net> 為準逐首校正。
