import { useState } from 'react';
import type { HymnCandidate } from '../types';
import HymnCard from './HymnCard';
import styles from './HymnList.module.css';

/**
 * 把 selectHymns 回傳的候選畫成一排 HymnCard。
 *
 * 這裡有一個 useState：expanded（有沒有按「再多看幾首」）。
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
          <div className={styles.grid}>
            {/* key 用 hymn.id：清單會依分數重排，用 index 會對錯項目。
                完整理由見 HymnCard.tsx 開頭的註解。 */}
            {shown.map((c) => (
              <HymnCard key={c.hymn.id} hymn={c.hymn} reasons={c.reasons} />
            ))}
          </div>
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
