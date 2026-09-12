import { describe, it, expect } from 'vitest';
import { applySundayPicks } from './sundayPicks';
import type { Hymn, SundayPicksFile } from '../types';

function hymn(id: string, extra: Partial<Hymn> = {}): Hymn {
  const no = Number(id.split('-')[1]);
  return { id, book: 'hymnal', no, title: `詩歌 ${no}`, categories: [], hasChorus: false, urls: {}, notes: [], ...extra };
}

const FILE: SundayPicksFile = {
  slots: ['調靈', '讚美主', '記念主', '敬拜父'],
  weeks: [
    { date: '2025-02-16', picks: [{ slot: '記念主', hymn: 'h-178' }, { slot: '敬拜父', hymn: 'h-9' }] },
    { date: '2025-03-02', picks: [{ slot: '記念主', hymn: 'h-178' }, { slot: '讚美主', hymn: 'h-9' }] },
    { date: '2025-03-09', picks: [{ slot: '敬拜父', hymn: 'h-9' }, { slot: '調靈', hymn: 'h-999' }] },
  ],
};

describe('applySundayPicks', () => {
  it('算次數、各段次數、最近日期', () => {
    const [h] = applySundayPicks([hymn('h-9')], FILE);
    expect(h.usage).toEqual({ count: 3, slots: { 敬拜父: 2, 讚美主: 1 }, last: '2025-03-09' });
  });

  it('把唱過的段落依次數插到 categories 最前面，原有的類別留在後面且不重複', () => {
    const [h] = applySundayPicks([hymn('h-9', { categories: ['讚美主', '感恩'] })], FILE);
    expect(h.categories).toEqual(['敬拜父', '讚美主', '感恩']);
  });

  it('不動熟悉度：各地熟悉度不同，紀錄只用來分段', () => {
    const [a, b] = applySundayPicks(
      [hymn('h-178'), hymn('h-9', { familiarity: 0.9 })],
      FILE,
    );
    expect(a.familiarity).toBeUndefined();
    expect(b.familiarity).toBe(0.9);
  });

  it('沒唱過的詩不動；紀錄裡多出來的 id 不會報錯', () => {
    const [h] = applySundayPicks([hymn('h-1')], FILE);
    expect(h.usage).toBeUndefined();
    expect(h.familiarity).toBeUndefined();
  });
});
