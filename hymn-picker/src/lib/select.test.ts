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

describe('selectHymns', () => {
  it('排除命中 exclude 類別的詩歌', () => {
    const ids = selectHymns(HYMNS, TABLE).map((c) => c.hymn.id);
    expect(ids).not.toContain('h-3');
  });

  it('include 非空時，只留下至少命中一個 include 類別的詩歌', () => {
    const ids = selectHymns(HYMNS, TABLE).map((c) => c.hymn.id);
    expect(ids.sort()).toEqual(['h-1', 'h-2', 's-4']);
    expect(ids).not.toContain('n-5'); // 福音類，不在 include 裡
  });

  it('include 為空時不限類別，全部都是候選', () => {
    const ids = selectHymns(HYMNS, OPEN).map((c) => c.hymn.id);
    expect(ids).toHaveLength(HYMNS.length);
  });

  it('依分數由高到低排序，且每首都附上可解釋的 reasons', () => {
    const result = selectHymns(HYMNS, TABLE);
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

  it('同分時依書別排序：大本在補充本前面', () => {
    // h-2 與 s-4 各只命中一個類別、都沒有副歌，差別只在書別的熟悉度
    const ids = selectHymns(HYMNS, TABLE).map((c) => c.hymn.id);
    expect(ids.indexOf('h-2')).toBeLessThan(ids.indexOf('s-4'));
  });

  it('familiarity 欄位會蓋過書別預設：不常唱的往後排並標註', () => {
    const common = hymn({ id: 'h-10', no: 10, categories: ['記念主'] });
    const rare = hymn({ id: 'h-11', no: 11, categories: ['記念主'], familiarity: 0.1 });
    const ids = selectHymns([rare, common], TABLE).map((c) => c.hymn.id);
    expect(ids).toEqual(['h-10', 'h-11']);
    const rareScored = scoreHymn(rare, TABLE);
    expect(rareScored.reasons).toContain('會眾較不熟，往後排');
    expect(scoreHymn(common, TABLE).reasons).not.toContain('會眾較不熟，往後排');
  });

  it('勾選主題關鍵字時只留下帶該 tag 的詩，命中越多分越高並逐一標註', () => {
    const list = [
      hymn({ id: 'h-50', no: 50, categories: ['記念主'], tags: ['憂慮', '安慰'] }),
      hymn({ id: 'h-51', no: 51, categories: ['記念主'], tags: ['憂慮'] }),
      hymn({ id: 'h-52', no: 52, categories: ['記念主'] }),
    ];
    const result = selectHymns(list, OPEN, { tags: ['憂慮', '安慰'] });
    expect(result.map((c) => c.hymn.id)).toEqual(['h-50', 'h-51']);
    expect(result[0].reasons).toContain('主題：憂慮');
    expect(result[0].reasons).toContain('主題：安慰');
    expect(result[0].score).toBeGreaterThan(result[1].score);
    // 沒勾選時不過濾
    expect(selectHymns(list, OPEN).map((c) => c.hymn.id)).toHaveLength(3);
  });

  it('theme 關鍵字命中標題時加分並標註', () => {
    const withTheme = scoreHymn(HYMNS[4], OPEN, { theme: '天上的家' });
    const without = scoreHymn(HYMNS[4], OPEN);
    expect(withTheme.score).toBeGreaterThan(without.score);
    expect(withTheme.reasons).toContain('主題相符：天上的家');
  });

  it('是純函式：不會改到傳進來的陣列，重複呼叫結果相同', () => {
    const input = [...HYMNS];
    const a = selectHymns(input, TABLE);
    const b = selectHymns(input, TABLE);
    expect(input).toEqual(HYMNS); // 原陣列順序沒被 sort 改掉
    expect(a).toEqual(b);
  });
});

describe('selectBySections', () => {
  it('依 sections 分段，各段套用自己的 include', () => {
    const sections = selectBySections(HYMNS, TABLE);
    expect(sections.map((s) => s.label)).toEqual(['記念主', '敬拜父']);
    expect(sections[0].candidates.map((c) => c.hymn.id).sort()).toEqual([
      'h-1',
      's-4',
    ]);
    expect(sections[1].candidates.map((c) => c.hymn.id)).toEqual(['h-2']);
  });

  it('include 為空的段落是「一般」段：收下沒命中主題段的詩，並沿用聚會層級的 include', () => {
    const smallgroup: MeetingType = {
      id: 'smallgroup',
      label: '小排',
      include: ['經歷神', '安慰'],
      exclude: [],
      weights: { familiarity: 0.4, chorus: 0.2, themeMatch: 0.4 },
      sections: [
        { label: '願意受成全', include: ['受成全'] },
        { label: '一般', include: [] },
      ],
      suggestedCount: 3,
    };
    const list = [
      // 命中主題段 → 歸主題段，即使它也命中聚會層級 include 兩個類別
      hymn({ id: 'h-30', no: 30, categories: ['受成全', '經歷神', '安慰'] }),
      // 沒命中主題段、但符合聚會 include → 一般段
      hymn({ id: 'h-31', no: 31, categories: ['安慰'] }),
      // 兩者都不符 → 不出現
      hymn({ id: 'h-32', no: 32, categories: ['福音'] }),
    ];
    const sections = selectBySections(list, smallgroup);
    expect(sections.map((s) => s.label)).toEqual(['願意受成全', '一般']);
    expect(sections[0].candidates.map((c) => c.hymn.id)).toEqual(['h-30']);
    expect(sections[1].candidates.map((c) => c.hymn.id)).toEqual(['h-31']);
  });

  it('聚會層級 include 也為空時，一般段收下其餘全部', () => {
    const special: MeetingType = {
      ...OPEN,
      sections: [
        { label: '加強', include: ['加強'] },
        { label: '一般', include: [] },
      ],
    };
    const list = [
      hymn({ id: 'h-40', no: 40, categories: ['加強'] }),
      hymn({ id: 'h-41', no: 41, categories: ['福音'] }),
    ];
    const sections = selectBySections(list, special);
    expect(sections[0].candidates.map((c) => c.hymn.id)).toEqual(['h-40']);
    expect(sections[1].candidates.map((c) => c.hymn.id)).toEqual(['h-41']);
  });

  it('同一首詩只歸到一個段落：命中類別最多的那段；平手看 categories 的順序', () => {
    const table2: MeetingType = {
      ...TABLE,
      sections: [
        { label: '記念主', include: ['記念主', '主的救贖'] },
        { label: '敬拜父', include: ['敬拜父', '讚美主'] },
      ],
    };
    const both = [
      // 兩段各命中 1 個 → 平手 → 看 categories 誰在前：記念主
      hymn({ id: 'h-20', no: 20, categories: ['記念主', '敬拜父'] }),
      // 記念主段命中 1、敬拜父段命中 2 → 「敬拜父」
      hymn({ id: 'h-21', no: 21, categories: ['主的救贖', '敬拜父', '讚美主'] }),
      // 平手，但 categories 裡敬拜父在前 → 「敬拜父」（即使記念主段排在前面）
      hymn({ id: 'h-22', no: 22, categories: ['敬拜父', '記念主'] }),
      // 第一個類別是讚美主 → 直接歸敬拜父段，即使記念主段命中比較多（記念主＋主的救贖）
      hymn({ id: 'h-23', no: 23, categories: ['讚美主', '記念主', '主的救贖'] }),
    ];
    const sections = selectBySections(both, table2);
    expect(sections[0].candidates.map((c) => c.hymn.id)).toEqual(['h-20']);
    expect(sections[1].candidates.map((c) => c.hymn.id).sort()).toEqual(['h-21', 'h-22', 'h-23']);
  });

  it('主日在這種聚會唱過的詩，不受 exclude 限制', () => {
    const sung = hymn({
      id: 's-836',
      no: 836,
      book: 'supplement',
      categories: ['調靈', '福音'],
      usage: { count: 2, slots: { 調靈: 2 }, last: '2025-11-16' },
    });
    const notSung = hymn({ id: 's-837', no: 837, book: 'supplement', categories: ['福音'] });
    const table3: MeetingType = {
      ...TABLE,
      include: ['調靈', '記念主', '主的救贖', '敬拜父'],
      exclude: ['福音'],
      sections: [{ label: '調靈', include: ['調靈'] }, ...(TABLE.sections ?? [])],
    };
    const sections = selectBySections([sung, notSung], table3);
    expect(sections[0].candidates.map((c) => c.hymn.id)).toEqual(['s-836']);
    expect(sections.flatMap((s) => s.candidates.map((c) => c.hymn.id))).not.toContain('s-837');
  });

  it('沒有 sections 時回傳單一段落，label 用聚會名稱', () => {
    const sections = selectBySections(HYMNS, OPEN);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('出遊');
  });
});
