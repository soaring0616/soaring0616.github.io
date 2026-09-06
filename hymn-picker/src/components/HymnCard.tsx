import { Link } from 'react-router-dom';
import type { Hymn, NoteType } from '../types';
import { bookLabel } from '../lib/select';
import styles from './HymnCard.module.css';

/**
 * ─────────────────────────────────────────────────────────────
 * HymnCard：一首詩歌的卡片。本專案唯一「寫完」的元件，
 * 其他元件請照這個樣子做。
 * ─────────────────────────────────────────────────────────────
 *
 * ■ props 型別
 *   React 元件就是一個「吃 props、吐 JSX」的函式。props 的型別用 interface 定義，
 *   寫在元件正上方，這樣呼叫端打錯字或漏傳必填欄位時，TypeScript 會先擋下來。
 *   慣例：必填不加 `?`（hymn），選填加 `?` 並在函式參數處給預設值（reasons = []）。
 *
 * ■ 為什麼這個元件沒有 state
 *   state 是「會隨使用者互動改變、而且只有這個元件在乎」的資料。
 *   這張卡片顯示的每一個字都來自 props：詩歌內容是載進來的 JSON，
 *   reasons 是 lib/select.ts 算出來的。它自己不會改變任何東西，
 *   所以不需要 useState —— 這種元件叫「受控的呈現元件 (presentational component)」。
 *   好處是：同樣的 props 永遠畫出同樣的畫面，好測試、好重用、不會有同步不一致的 bug。
 *   如果之後要加「收藏這首」的按鈕，收藏狀態不該放這裡，
 *   而是放在管理整份清單的父元件，再用 props 把 isFavorite / onToggle 傳下來（狀態抬升）。
 *
 * ■ 為什麼 key 要用 hymn.id
 *   （key 是給「呼叫這個元件的地方」用的，例如 hymns.map(h => <HymnCard key={h.id} .../>)）
 *   React 用 key 來認出「重新渲染前後，哪一個項目其實是同一個」。
 *   用陣列 index 當 key，一旦排序改變（我們的清單本來就會依分數重排）或中間插入一首，
 *   index 就對到不同的詩歌，React 會誤以為是同一個元件只是內容變了，
 *   於是沿用舊的 DOM 與內部狀態 —— 捲動位置、輸入框內容、動畫都會錯亂。
 *   hymn.id（'h-623'）在整份資料裡唯一且不隨排序改變，所以是正確的 key。
 */

/** note.type 對應的中文標籤 */
const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  excerpt: '摘句',
  story: '背景',
  scripture: '經節',
  tip: '提醒',
};

interface HymnCardProps {
  /** 要顯示的詩歌（必填） */
  hymn: Hymn;
  /** 由 selectHymns 產生的推薦理由；沒有就不顯示那一區 */
  reasons?: string[];
  /** 是否把標題做成連到詳細頁的連結，預設 true */
  linkToDetail?: boolean;
}

export default function HymnCard({
  hymn,
  reasons = [],
  linkToDetail = true,
}: HymnCardProps) {
  const meta = [
    hymn.key && `調號 ${hymn.key}`,
    hymn.time && `拍號 ${hymn.time}`,
    hymn.meter && `韻律 ${hymn.meter}`,
    hymn.enNo && `英文 #${hymn.enNo}`,
  ].filter(Boolean) as string[];

  const title = linkToDetail ? (
    <Link className={styles.titleLink} to={`/hymn/${hymn.id}`}>
      {hymn.title}
    </Link>
  ) : (
    hymn.title
  );

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <span className={styles.number}>
          {bookLabel(hymn.book)} {hymn.no}
        </span>
        <h3 className={styles.title}>{title}</h3>
      </header>

      {hymn.firstLine && <p className={styles.firstLine}>{hymn.firstLine}</p>}

      {hymn.categories.length > 0 && (
        <ul className={styles.chips}>
          {/* 類別字串本身在一首詩歌內不重複，可以直接當 key */}
          {hymn.categories.map((c) => (
            <li key={c} className={styles.chip}>
              {c}
            </li>
          ))}
        </ul>
      )}

      {meta.length > 0 && <p className={styles.meta}>{meta.join('　')}</p>}

      {hymn.notes.length > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>註解</h4>
          <ul className={styles.notes}>
            {hymn.notes.map((note, i) => (
              // 註解沒有自己的 id，而且同一首詩歌的註解順序固定、不會重排，
              // 這是少數可以安全用 index 當 key 的情況。
              // 之後若允許使用者增刪註解，就要幫 Note 加上 id。
              <li key={`${hymn.id}-note-${i}`} className={styles.note}>
                <span className={styles.noteType}>
                  {NOTE_TYPE_LABEL[note.type]}
                </span>
                {note.text}
                <span className={styles.noteFooter}>
                  — {note.source}
                  {note.url && (
                    <a
                      className={styles.noteLink}
                      href={note.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      閱讀全文 →
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reasons.length > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>為什麼推薦</h4>
          <ul className={styles.reasons}>
            {reasons.map((r) => (
              <li key={r} className={styles.reason}>
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
