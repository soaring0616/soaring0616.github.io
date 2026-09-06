import { describe, it, expect } from 'vitest';
import { selectHymns, selectBySections, scoreHymn } from './select';
import type { Hymn, MeetingType } from '../types';

// 測試用假資料。刻意寫死在檔案裡，不 fetch 真的 JSON，
// 這樣測試才不會因為之後新增詩歌而壞掉。
function hymn(partial: Partial<Hymn> & Pick<Hymn, 'id' | 'no' | 'categories'>): Hymn {
  const base: Hymn = {
    id: partial.id,
    no: partial.no,
    categories: partial.categories,
    book: 'hymnal',
    title: `詩歌 ${partial.no}`,
    hasChorus: false,
    urls: {},
    notes: [],
  };
  return { ...base, ...partial };
}

const HYMNS: Hymn[] = [
  hymn({ id: 'h-1', no: 1, categories: ['記念主', '主的救贖'], hasChorus: true }),
  hymn({ id: 'h-2', no: 2, categories: ['敬拜父'] }),
  hymn({ id: 'h-3', no: 3, categories: ['祈求', '渴慕'] }),
  hymn({ id: 's-4', no: 4, book: 'supplement', categories: ['記念主'] }),
  hymn({ id: 'n-5', no: 5, book: 'new', categories: ['福音'], title: '天上的家' }),
];

const TABLE: MeetingType = {
  id: 'table',
  label: '擘餅',
  include: ['記念主', '主的救贖', '敬拜父'],
  exclude: ['祈求'],
  weights: { familiarity: 0.3, chorus: 0.15, themeMatch: 0.55 },
  sections: [
    { label: '記念主', include: ['記念主', '主的救贖'] },
    { label: '敬拜父', include: ['敬拜父'] },
  ],
  suggestedCount: 4,
};

const OPEN: MeetingType = {
  id: 'outing',
  label: '出遊',
  include: [],
  exclude: [],
  weights: { familiarity: 0.7, chorus: 0.2, themeMatch: 0.1 },
  suggestedCount: 5,
};

const NOW = '2026-09-06T00:00:00Z';

describe('selectHymns', () => {
  it('排除命中 exclude 類別的詩歌', () => {
    const ids = selectHymns(HYMNS, TABLE, { now: NOW }).map((c) => c.hymn.id);
    expect(ids).not.toContain('h-3');
  });

  it('include 非空時，只留下至少命中一個 include 類別的詩歌', () => {
    const ids = selectHymns(HYMNS, TABLE, { now: NOW }).map((c) => c.hymn.id);
    expect(ids.sort()).toEqual(['h-1', 'h-2', 's-4']);
    expect(ids).not.toContain('n-5'); // 福音類，不在 include 裡
  });

  it('include 為空時不限類別，全部都是候選', () => {
    const ids = selectHymns(HYMNS, OPEN, { now: NOW }).map((c) => c.hymn.id);
    expect(ids).toHaveLength(HYMNS.length);
  });

  it('依分數由高到低排序，且每首都附上可解釋的 reasons', () => {
    const result = selectHymns(HYMNS, TABLE, { now: NOW });
    const scores = result.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    result.forEach((c) => {
      expect(c.reasons.length).toBeGreaterThan(0);
    });
    // 命中兩個類別 + 有副歌的 h-1 應該排第一
    expect(result[0].hymn.id).toBe('h-1');
    expect(result[0].reasons).toContain('類別：記念主');
    expect(result[0].reasons).toContain('有副歌，容易跟唱');
  });

  it('30 天內唱過的會被降分並標註理由', () => {
    const history = { 'h-1': '2026-09-01' }; // 5 天前
    const before = selectHymns(HYMNS, TABLE, { now: NOW });
    const after = selectHymns(HYMNS, TABLE, { now: NOW, history });

    const h1Before = before.find((c) => c.hymn.id === 'h-1')!;
    const h1After = after.find((c) => c.hymn.id === 'h-1')!;

    expect(h1After.score).toBeLessThan(h1Before.score);
    expect(h1After.reasons.some((r) => r.includes('天前唱過'))).toBe(true);
  });

  it('超過 30 天沒唱的，理由標成「30 天內未唱過」且不扣分', () => {
    const history = { 'h-1': '2026-01-01' };
    const c = selectHymns(HYMNS, TABLE, { now: NOW, history }).find(
      (x) => x.hymn.id === 'h-1',
    )!;
    expect(c.reasons.some((r) => r.includes('30 天內未唱過'))).toBe(true);
    // 唱過會提高熟悉度，所以分數應該不低於沒有紀錄時
    const noHistory = selectHymns(HYMNS, TABLE, { now: NOW }).find(
      (x) => x.hymn.id === 'h-1',
    )!;
    expect(c.score).toBeGreaterThanOrEqual(noHistory.score);
  });

  it('theme 關鍵字命中標題時加分並標註', () => {
    const withTheme = scoreHymn(HYMNS[4], OPEN, { now: NOW, theme: '天上的家' });
    const without = scoreHymn(HYMNS[4], OPEN, { now: NOW });
    expect(withTheme.score).toBeGreaterThan(without.score);
    expect(withTheme.reasons).toContain('主題相符：天上的家');
  });

  it('是純函式：不會改到傳進來的陣列，重複呼叫結果相同', () => {
    const input = [...HYMNS];
    const a = selectHymns(input, TABLE, { now: NOW });
    const b = selectHymns(input, TABLE, { now: NOW });
    expect(input).toEqual(HYMNS); // 原陣列順序沒被 sort 改掉
    expect(a).toEqual(b);
  });
});

describe('selectBySections', () => {
  it('依 sections 分段，各段套用自己的 include', () => {
    const sections = selectBySections(HYMNS, TABLE, { now: NOW });
    expect(sections.map((s) => s.label)).toEqual(['記念主', '敬拜父']);
    expect(sections[0].candidates.map((c) => c.hymn.id).sort()).toEqual([
      'h-1',
      's-4',
    ]);
    expect(sections[1].candidates.map((c) => c.hymn.id)).toEqual(['h-2']);
  });

  it('沒有 sections 時回傳單一段落，label 用聚會名稱', () => {
    const sections = selectBySections(HYMNS, OPEN, { now: NOW });
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('出遊');
  });
});
