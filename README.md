# To Seek Him

個人網站：<https://soaring0616.github.io/>

- `/` — 首頁（HTML5 UP "Story" 模板）
- `/articles/` — 信仰札記（Hexo 預建輸出，勿手動編輯）
- `/crossref/` — [串珠探索](crossref/README.md)：互動式恢復本經節關聯圖
- `/hymn-picker/` — [聚會選詩歌](hymn-picker/README.md)：依聚會類型排出候選詩歌（Vite + React，原始碼在 `hymn-picker/`，由 CI 建置）

## 部署

push 到 `main` 後，`.github/workflows/deploy.yml` 會建置 `hymn-picker/`、把它的 `dist/` 和其餘靜態檔組成完整網站，再部署到 GitHub Pages。
repo 的 Settings → Pages → Source 需設為 **GitHub Actions**（第一次跑 workflow 會嘗試自動切換）。

Credits: [Story](https://html5up.net) by HTML5 UP（CCA 3.0）、[Unsplash](https://unsplash.com)、參考 <https://github.com/HSNUCRC44/hsnucrc44.github.io>
