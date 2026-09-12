import { describe, it, expect } from 'vitest';
import { applyThemeTags, countTags, groupTags } from './themeTags';
import { scoreHymn } from './select';
import type { Hymn, MeetingType, ThemeTagFile } from '../types';

function hymn(id: string, extra: Partial<Hymn> = {}): Hymn {
  const no = Number(id.split('-')[1]);
  return {
    id,
    book: 'hymnal',
    no,
    title: `詩歌 ${no}`,
    categories: [],
    hasChorus: false,
    urls: {},
    notes: [],
    ...extra,
  };
}

const FILE: ThemeTagFile = {
  sources: [
    { id: 'EP41', label: '合聲響應 EP41', url: 'https://example.test/41', tags: ['主愛', '憂慮'], hymns: ['h-286', 'h-232'] },
    { id: 'EP14', label: '合聲響應 EP14', url: 'https://example.test/14', tags: ['憂慮', '難關'], hymns: ['h-286', 'h-999'] },
  ],
};

describe('applyThemeTags', () => {
  it('把出處的 tags 掛到被點名的詩上，多個出處取聯集', () => {
    const [a, b] = applyThemeTags([hymn('h-286'), hymn('h-232')], FILE);
    expect(a.tags).toEqual(['主愛', '憂慮', '難關']);
    expect(a.tagSources?.map((s) => s.label)).toEqual(['合聲響應 EP41', '合聲響應 EP14']);
    expect(b.tags).toEqual(['主愛', '憂慮']);
  });

  it('沒被點名的詩不動；手填的 tags 保留在前面', () => {
    const [plain, manual] = applyThemeTags(
      [hymn('h-1'), hymn('h-232', { tags: ['擘餅'] })],
      FILE,
    );
    expect(plain.tags).toBeUndefined();
    expect(manual.tags).toEqual(['擘餅', '主愛', '憂慮']);
  });

  it('出處裡有、hymns 裡沒有的 id 會被略過，不會報錯', () => {
    expect(() => applyThemeTags([hymn('h-1')], FILE)).not.toThrow();
  });

  it('countTags：數這批詩裡每個 tag 幾首，沒命中的 tag 以 0 保留', () => {
    const tagged = applyThemeTags([hymn('h-286'), hymn('h-232')], FILE);
    const counts = countTags([tagged[0]], ['主愛', '憂慮', '難關', '出遊']);
    expect(counts).toEqual([
      { tag: '主愛', count: 1 },
      { tag: '憂慮', count: 1 },
      { tag: '難關', count: 1 },
      { tag: '出遊', count: 0 },
    ]);
  });

  it('groupTags：照 groups 分列，沒歸組的放「其他」在最後，組內依首數排', () => {
    const counts = [
      { tag: '憂慮', count: 1 },
      { tag: '出遊', count: 3 },
      { tag: '主愛', count: 2 },
      { tag: '容易唱錯', count: 1 },
    ];
    const groups = groupTags(counts, { 心情處境: ['憂慮', '主愛'], 場合: ['出遊', '不存在的'] });
    expect(groups.map((g) => g.group)).toEqual(['心情處境', '場合', '其他']);
    expect(groups[0].tags.map((t) => t.tag)).toEqual(['主愛', '憂慮']);
    expect(groups[2].tags.map((t) => t.tag)).toEqual(['容易唱錯']);
  });

  it('主題關鍵字搜尋會比對 tags', () => {
    const [h] = applyThemeTags([hymn('h-286')], FILE);
    const open: MeetingType = {
      id: 'custom',
      label: '自訂',
      include: [],
      exclude: [],
      weights: { familiarity: 0.5, chorus: 0.2, themeMatch: 0.3 },
      suggestedCount: 3,
    };
    expect(scoreHymn(h, open, { theme: '憂慮' }).reasons).toContain('主題相符：憂慮');
    expect(scoreHymn(h, open, { theme: '出遊' }).reasons).not.toContain('主題相符：出遊');
  });
});
