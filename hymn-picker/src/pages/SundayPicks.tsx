import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Hymn, SundayPicksFile } from '../types';
import { loadHymns, loadSundayPicks } from '../lib/data';
import { bookLabel } from '../lib/select';
import styles from './SundayPicks.module.css';

/**
 * 主日詩歌豫選紀錄：一週一列，四段各一首。
 * 資料來自 public/data/sunday_picks.json；詩歌標題從 hymns.json 對出來，
 * 還沒收錄的詩只顯示號碼。最新的一週排最上面。
 */
export default function SundayPicks() {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [file, setFile] = useState<SundayPicksFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadHymns(), loadSundayPicks()])
      .then(([h, f]) => {
        if (cancelled) return;
        setHymns(h);
        setFile(f);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(hymns.map((h) => [h.id, h])), [hymns]);

  // 最常唱的前幾首，給人一眼看出「常備曲目」
  const top = useMemo(() => {
    if (!file) return [];
    const count = new Map<string, number>();
    file.weeks.forEach((w) => w.picks.forEach((p) => count.set(p.hymn, (count.get(p.hymn) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [file]);

  if (error) return <p className={`${styles.status} ${styles.error}`}>載入失敗：{error}</p>;
  if (!file) return <p className={styles.status}>載入紀錄中…</p>;

  const weeks = [...file.weeks].sort((a, b) => (a.date < b.date ? 1 : -1));

  const cell = (id: string) => {
    const h = byId.get(id);
    const [pre, no] = id.split('-');
    const num = `${bookLabel(pre === 'h' ? 'hymnal' : pre === 's' ? 'supplement' : pre === 'c' ? 'children' : 'new')} ${no}`;
    return h ? (
      <Link className={styles.hymnLink} to={`/hymn/${id}`}>
        <span className={styles.num}>{num}</span>
        {h.title}
      </Link>
    ) : (
      <span className={styles.missing} title="還沒收進 hymns.json">
        <span className={styles.num}>{num}</span>（未收錄）
      </span>
    );
  };

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/">
        ← 回選詩頁
      </Link>
      <h2 className={styles.title}>主日詩歌豫選紀錄</h2>
      <p className={styles.intro}>
        共 {file.weeks.length} 週，段落依序是 {file.slots.join(' → ')}。這份紀錄也用來算每首詩「主日唱過幾次」，
        唱過的段落會直接決定它在擘餅推薦裡的分段。
        要加新的一週，改 <code>public/data/sunday_picks.json</code> 即可。
      </p>

      {top.length > 0 && (
        <p className={styles.top}>
          最常唱：
          {top.map(([id, n], i) => (
            <span key={id}>
              {i > 0 && '、'}
              {cell(id)}
              <span className={styles.count}>×{n}</span>
            </span>
          ))}
        </p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>日期</th>
              {file.slots.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.date}>
                <td className={styles.date}>{w.date}</td>
                {file.slots.map((slot) => {
                  const p = w.picks.find((x) => x.slot === slot);
                  return (
                    <td key={slot}>
                      {p ? (
                        <>
                          {cell(p.hymn)}
                          {p.morningRevival && (
                            <span className={styles.badge} title="本週晨興聖言詩歌">
                              晨興
                            </span>
                          )}
                          {p.note && <span className={styles.note}>{p.note}</span>}
                        </>
                      ) : (
                        <span className={styles.dash}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
