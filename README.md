# To Seek Him

個人網站，部署於 GitHub Pages：<https://soaring0616.github.io/>

## 網站內容

| 路徑 | 內容 |
|------|------|
| `/` | 首頁（HTML5 UP "Story" 模板，手寫靜態 HTML） |
| `/articles/` | 信仰札記——Hexo + NexT 主題預先建置的部落格輸出（勿手動編輯） |
| `/crossref/` | 串珠探索——互動式恢復本經節關聯圖 |

另有連往 Instagram 的追求材料與日文回訪材料。

## 串珠探索（/crossref/）

以「一節經文＝一個節點、串珠＝連線」的互動節點圖（vis-network）。
選一節聖經展開它的串珠，點任一節點可繼續往下追。

- 經文、串珠、註解資料即時取自[網上聖經恢復本](https://www.recoveryversion.com.tw/)公開 API，並以 localStorage 快取；repo 內不存任何經文資料。
- 「查職事文集」按鈕以表單 POST 在新分頁開啟[李常受文集線上索引](https://cwwl.twgbr.org/)該節的搜尋結果。
- 純靜態、無建置步驟：`books.js`（書卷表）、`parser.js`（串珠縮寫解析，如「約七50，十九39」）、`api.js`（API 與快取）、`app.js`（圖與介面）。

本機預覽：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000/crossref/（?test=1 可在 console 執行解析器自測）
```

## Credits

- 首頁模板：[Story](https://html5up.net) by HTML5 UP（CCA 3.0），使用 jQuery、Scrollex、Font Awesome
- 首頁圖片：[Unsplash](https://unsplash.com)
- 部落格：[Hexo](https://hexo.io) + [NexT](https://theme-next.js.org)
- 關聯圖：[vis-network](https://visjs.org)
- 參考：<https://github.com/HSNUCRC44/hsnucrc44.github.io>
