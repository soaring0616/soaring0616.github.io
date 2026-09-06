import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Hymn } from '../types';
import { loadHymns } from '../lib/data';
import HymnCard from '../components/HymnCard';
import styles from './HymnDetail.module.css';

/**
 * 單一首詩歌的詳細頁，網址是 #/hymn/h-623。
 *
 * React 概念：**路由參數**。
 * useParams() 把網址上的 :id 拿出來（型別要自己標，router 不知道你寫了什麼）。
 * 這一頁自己再 fetch 一次 hymns.json —— 因為使用者可能直接貼網址進來，
 * 不保證先經過首頁。瀏覽器會把同一個檔案快取起來，重複 fetch 成本很低。
 */

export default function HymnDetail() {
  const { id } = useParams<{ id: string }>();

  const [hymns, setHymns] = useState<Hymn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHymns()
      .then((data) => {
        if (!cancelled) setHymns(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className={styles.status}>載入失敗：{error}</p>;
  if (!hymns) return <p className={styles.status}>載入中…</p>;

  const hymn = hymns.find((h) => h.id === id);
  if (!hymn)
    return (
      <div className={styles.page}>
        <p className={styles.status}>找不到編號為「{id}」的詩歌。</p>
        <Link className={styles.back} to="/">
          ← 回選詩頁
        </Link>
      </div>
    );

  const luke54 = hymn.urls.luke54 ?? [];

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/">
        ← 回選詩頁
      </Link>

      {/* linkToDetail={false}：已經在詳細頁了，標題不用再連到自己 */}
      <HymnCard hymn={hymn} linkToDetail={false} />

      {(hymn.urls.hymnal || luke54.length > 0) && (
        <div className={styles.links}>
          <h2 className={styles.linksTitle}>外部連結</h2>
          <ul className={styles.linkList}>
            {hymn.urls.hymnal && (
              <li>
                <a
                  className={styles.link}
                  href={hymn.urls.hymnal}
                  target="_blank"
                  rel="noreferrer"
                >
                  hymnal.net 歌譜與錄音 →
                </a>
              </li>
            )}
            {luke54.map((url) => (
              <li key={url}>
                <a
                  className={styles.link}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  luke54.org 相關資料 →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
