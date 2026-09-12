import type { Hymn, SundayPicksFile } from '../types';

/**
 * 把主日豫選紀錄（sunday_picks.json）掛到詩歌上。
 *
 * 純函式：吃 hymns + 檔案，吐新陣列，不動原物件。做三件事：
 *   1. hymn.usage：唱過幾次、各段幾次、最近一次日期。
 *   2. categories：把唱過的段落名（調靈／讚美主／記念主／敬拜父）依次數多到少插到最前面，
 *      這樣擘餅的分段會照你們實際的用法（見 select.ts 的平手規則：categories 越前面越優先）。
 *   3. familiarity：唱過越多次越熟。沒填的以書別預設起算，每唱一次 +0.05，上限 0.95，只升不降。
 * 紀錄裡有、hymns 裡沒有的 id 會被略過。
 */

const BOOK_DEFAULT: Record<Hymn['book'], number> = {
  hymnal: 0.6,
  supplement: 0.45,
  new: 0.3,
  children: 0.5,
};

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
    const base = h.familiarity ?? BOOK_DEFAULT[h.book];
    const familiarity = Math.max(base, Math.min(0.95, base + 0.05 * usage.count));
    return { ...h, usage, categories, familiarity };
  });
}

/** 給人看的：「主日唱過 13 次（記念主 13）」 */
export function usageLabel(usage: NonNullable<Hymn['usage']>): string {
  const parts = Object.entries(usage.slots)
    .sort((a, b) => b[1] - a[1])
    .map(([slot, n]) => `${slot} ${n}`)
    .join('、');
  return `主日唱過 ${usage.count} 次（${parts}）`;
}
