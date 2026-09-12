import { useEffect, useMemo, useState } from 'react';
import type { Hymn, MeetingType } from '../types';
import { loadAll } from '../lib/data';
import { selectBySections } from '../lib/select';
import { countTags, groupTags } from '../lib/themeTags';
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
  const [tagGroupDefs, setTagGroupDefs] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 使用者的選擇（狀態抬升到這裡，MeetingSelector 只是顯示與回報）──
  const [meetingId, setMeetingId] = useState('table');
  const [theme, setTheme] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then(({ hymns, meetingTypes, tagGroups }) => {
        if (cancelled) return;
        setHymns(hymns);
        setMeetingTypes(meetingTypes);
        setTagGroupDefs(tagGroups);
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

  // 全資料的 tag 清單（不含首數），讓在目前聚會裡是 0 首的 tag 也能以灰色出現
  const allTagNames = useMemo(() => {
    const set = new Set<string>();
    hymns.forEach((h) => (h.tags ?? []).forEach((t) => set.add(t)));
    return [...set];
  }, [hymns]);

  // 通過「目前聚會」過濾（不含勾選的 tags）的候選 —— chip 上的首數就是數這一批，
  // 所以切換聚會類型，數字會跟著變，0 首的 tag 會變灰
  const baseCandidates = useMemo(() => {
    if (!meetingType) return [];
    return selectBySections(hymns, meetingType, { theme }).flatMap((s) =>
      s.candidates.map((c) => c.hymn),
    );
  }, [hymns, meetingType, theme]);

  const tagGroups = useMemo(
    () => groupTags(countTags(baseCandidates, allTagNames), tagGroupDefs),
    [baseCandidates, allTagNames, tagGroupDefs],
  );

  // 衍生資料：由 hymns / meetingType / theme / tags 算出來
  const sections = useMemo(() => {
    if (!meetingType) return [];
    return selectBySections(hymns, meetingType, { theme, tags });
  }, [hymns, meetingType, theme, tags]);

  // 勾了 tags 卻一首都沒有時，算一下這些主題在別種聚會各有幾首，讓使用者一鍵切過去
  const totalShown = sections.reduce((n, s) => n + s.candidates.length, 0);
  const elsewhere = useMemo(() => {
    if (tags.length === 0 || totalShown > 0) return [];
    return meetingTypes
      .filter((m) => m.id !== meetingId)
      .map((m) => ({
        meeting: m,
        count: selectBySections(hymns, m, { theme, tags }).reduce(
          (n, s) => n + s.candidates.length,
          0,
        ),
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [hymns, meetingTypes, meetingId, theme, tags, totalShown]);

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
        tagGroups={tagGroups}
        selectedTags={tags}
        onTagsChange={setTags}
      />

      {tags.length > 0 && totalShown === 0 && (
        <div className={styles.status}>
          {meetingType?.label}裡沒有帶「{tags.join('、')}」的詩歌。
          {elsewhere.length > 0 ? (
            <>
              這些主題在別種聚會有：
              <ul className={styles.elsewhere}>
                {elsewhere.map(({ meeting, count }) => (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      className={styles.switchBtn}
                      onClick={() => setMeetingId(meeting.id)}
                    >
                      {meeting.label}（{count} 首）
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            '其他聚會也沒有，試試少勾一個。'
          )}
        </div>
      )}

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
