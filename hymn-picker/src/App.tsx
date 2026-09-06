import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import HymnDetail from './pages/HymnDetail';
import styles from './App.module.css';

/**
 * React 概念：**路由**。
 *
 * 這裡用 HashRouter 而不是 BrowserRouter。
 * BrowserRouter 的網址長這樣：/hymn-picker/hymn/h-623
 * ——重新整理時瀏覽器會真的去跟伺服器要那個路徑，而 GitHub Pages 沒有那個檔案 → 404。
 * HashRouter 把路徑放在 # 後面：/hymn-picker/#/hymn/h-623
 * 井號後面的部分不會送到伺服器，伺服器永遠只回 index.html，重整、直接貼網址都不會壞。
 */
export default function App() {
  return (
    <HashRouter>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.brand}>
            <Link className={styles.brandLink} to="/">
              聚會選詩歌
            </Link>
          </h1>
          <span className={styles.tagline}>依聚會類型排出候選，附推薦理由</span>
          {/* 回到 soaring0616.github.io 首頁。這是站內另一頁，不走 React Router，用一般 <a> */}
          <a className={styles.homeLink} href="/">
            ← 回首頁
          </a>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/hymn/:id" element={<HymnDetail />} />
            {/* 打錯網址就回首頁 */}
            <Route path="*" element={<Home />} />
          </Routes>
        </main>

        <footer className={styles.footer}>
          詩歌資料為範例，請以 hymnal.net 為準。唱過的紀錄只存在這台裝置的瀏覽器裡。
        </footer>
      </div>
    </HashRouter>
  );
}
