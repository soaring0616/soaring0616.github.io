import { useState } from 'react';
import type { HymnCandidate } from '../types';
import HymnCard from './HymnCard';
import { bookLabel } from '../lib/select';
import styles from './HymnList.module.css';

/**
 * 把 selectHymns 回傳的候選畫成一排 HymnCard。
 *
 * 這裡有兩個 useState：expanded（有沒有按「再多看幾首」）、open（哪幾首被點開）。
 * 判斷標準是「這份資料只有這個元件在乎，而且離開畫面就可以忘掉」——
 * 展開與否不影響選詩結果，也沒有別的元件需要知道，所以放這裡剛剛好，
 * 不必抬到 Home（對照 HymnCard 完全沒有 state 的理由）。
 */

interface HymnListProps {
  /** 已排序的候選 */
  candidates: HymnCandidate[];
  /** 段落標題，例如「記念主」；沒有就不顯示 */
  title?: string;
  /** 預設顯示幾首；其餘收在「再多看幾首」後面。不給就全部顯示 */
  limit?: number;
}

export default function HymnList({ candidates, title, limit }: HymnListProps) {
  const [expanded, setExpanded] = useState(false);
  // 哪幾首被點開看詳細。用 Set 存 id：可以同時展開多首，切換聚會時清單重算、這裡也跟著失效沒關係。
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev); // 不能直接改 prev：React 靠新物件才知道要重畫
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapsed = typeof limit === 'number' && !expanded;
  const shown = collapsed ? candidates.slice(0, limit) : candidates;
  const hidden = candidates.length - shown.length;

  return (
    <section className={styles.section}>
      {title && (
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.count}>{candidates.length} 首符合</span>
        </div>
      )}

      {candidates.length === 0 ? (
        <p className={styles.empty}>
          這個聚會目前沒有符合的詩歌。試著清掉主題關鍵字，或到
          public/data/hymns.json 補上這個類別的詩歌。
        </p>
      ) : (
        <>
          {/* 結果先只列「號碼 + 曲名」，點一列才展開完整卡片。
              key 用 hymn.id：清單會依分數重排，用 index 會對錯項目（見 HymnCard.tsx 開頭）。 */}
          <ol className={styles.list}>
            {shown.map((c) => {
              const isOpen = open.has(c.hymn.id);
              return (
                <li key={c.hymn.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.rowBtn}
                    aria-expanded={isOpen}
                    onClick={() => toggle(c.hymn.id)}
                  >
                    <span className={styles.caret}>{isOpen ? '▾' : '▸'}</span>
                    <span className={styles.number}>
                      {bookLabel(c.hymn.book)} {c.hymn.no}
                    </span>
                    <span className={styles.rowTitle}>{c.hymn.title}</span>
                    {c.hymn.firstLine && (
                      <span className={styles.rowFirst}>{c.hymn.firstLine}</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className={styles.detail}>
                      <HymnCard hymn={c.hymn} reasons={c.reasons} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {hidden > 0 && (
            <button className={styles.more} onClick={() => setExpanded(true)}>
              再多看 {hidden} 首 ↓
            </button>
          )}
        </>
      )}
    </section>
  );
}
