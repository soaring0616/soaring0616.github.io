import { describe, it, expect } from 'vitest';
import { applyThemeTags } from './themeTags';
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
