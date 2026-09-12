import type { Hymn, SundayPicksFile } from '../types';

/**
 * 把主日豫選紀錄（sunday_picks.json）掛到詩歌上。
 *
 * 純函式：吃 hymns + 檔案，吐新陣列，不動原物件。做兩件事：
 *   1. hymn.usage：唱過幾次、各段幾次、最近一次日期（給分段與 exclude 例外用，卡片上不顯示）。
 *   2. categories：把唱過的段落名（調靈／讚美主／記念主／敬拜父）依次數多到少插到最前面，
 *      這樣擘餅的分段會照你們實際的用法（見 select.ts：categories 第一個類別決定段落）。
 * 刻意**不**動 familiarity：每個地方對同一首詩的熟悉度不一樣，這份紀錄只代表一處召會的用法。
 * 紀錄裡有、hymns 裡沒有的 id 會被略過。
 */

export function applySundayPicks(hymns: Hymn[], file: SundayPicksFile): Hymn[] {
  const byId = new Map<string, { count: number; slots: Record<string, number>; last: string }>();
  file.weeks.forEach((w) => {
    w.picks.forEach((p) => {
      const cur = byId.get(p.hymn) ?? { count: 0, slots: {}, last: '' };
      cur.count += 1;
      cur.slots[p.slot] = (cur.slots[p.slot] ?? 0) + 1;
      if (w.date > cur.last) cur.last = w.date;
      byId.set(p.hymn, cur);
    });
  });

  return hymns.map((h) => {
    const usage = byId.get(h.id);
    if (!usage) return h;
    const slotsByCount = Object.entries(usage.slots)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))
      .map(([slot]) => slot);
    const categories = [
      ...slotsByCount,
      ...h.categories.filter((c) => !slotsByCount.includes(c)),
    ];
    return { ...h, usage, categories };
  });
}
