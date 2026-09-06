import { useEffect, useMemo, useState } from 'react';
import type { Hymn, MeetingType } from '../types';
import { loadAll } from '../lib/data';
import { selectBySections } from '../lib/select';
import MeetingSelector from '../components/MeetingSelector';
import HymnList from '../components/HymnList';
import styles from './Home.module.css';

/**
 * 首頁：選聚會 → 看推薦。
 *
 * 這一頁示範了三個 React 概念，順序就是資料流動的順序：
 *
 *  1. useEffect 抓資料
 *     元件第一次出現在畫面上之後才去 fetch JSON。依賴陣列是 []，代表「只跑一次」。
 *     cancelled 旗標是為了避免「還沒回來使用者就離開這頁」時對已卸載的元件 setState。
 *
 *  2. useState 存「使用者的選擇」與「外面來的資料」
 *     meetingId / theme 是使用者的選擇；hymns / meetingTypes 是載進來的資料。
 *     兩者都會變、都要重畫，所以都是 state。
 *
 *  3. useMemo 算「衍生資料」
 *     sections 是從上面那些 state「算」出來的，不是另一份獨立的狀態。
 *     衍生資料絕對不要再開一個 useState 去存（那會有兩份真相、容易不同步），
 *     直接算就好；useMemo 只是避免每次重畫都重跑排序，是效能優化而非正確性需求。
 */

export default function Home() {
  // ── 外部資料 ───────────────────────────────────────────────
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 使用者的選擇（狀態抬升到這裡，MeetingSelector 只是顯示與回報）──
  const [meetingId, setMeetingId] = useState('table');
  const [theme, setTheme] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then(({ hymns, meetingTypes }) => {
        if (cancelled) return;
        setHymns(hymns);
        setMeetingTypes(meetingTypes);
        // 萬一預設的 'table' 不在資料裡，就退回第一個
        if (!meetingTypes.some((m) => m.id === 'table') && meetingTypes[0]) {
          setMeetingId(meetingTypes[0].id);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const meetingType = useMemo(
    () => meetingTypes.find((m) => m.id === meetingId),
    [meetingTypes, meetingId],
  );

  // 衍生資料：由 hymns / meetingType / theme 算出來
  const sections = useMemo(() => {
    if (!meetingType) return [];
    return selectBySections(hymns, meetingType, { theme });
  }, [hymns, meetingType, theme]);

  if (loading) return <p className={styles.status}>載入詩歌資料中…</p>;
  if (error)
    return (
      <p className={`${styles.status} ${styles.error}`}>
        載入失敗：{error}
        <br />
        （檢查 public/data/ 底下的 JSON，以及 vite.config.ts 的 base 設定）
      </p>
    );

  return (
    <div className={styles.page}>
      <p className={styles.intro}>
        選一個聚會類型，下面會依「類別吻合、會眾熟悉度、有無副歌」排出候選，
        每首都附上推薦理由。點標題可以看詳細資料與外部連結。
      </p>

      <MeetingSelector
        meetingTypes={meetingTypes}
        selectedId={meetingId}
        onSelect={setMeetingId}
        theme={theme}
        onThemeChange={setTheme}
      />

      <div className={styles.sections}>
        {sections.map((s) => (
          <HymnList
            key={s.label}
            title={s.label}
            candidates={s.candidates}
            limit={meetingType?.suggestedCount}
          />
        ))}
      </div>
    </div>
  );
}
