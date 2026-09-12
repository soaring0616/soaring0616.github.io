import { describe, it, expect } from 'vitest';
import { categoriesFromIndex, enrichHymns, lookupIndex, buildIndexLookup } from './hymnIndex';
import type { CategoryMap, Hymn, HymnIndexEntry } from '../types';

function hymn(partial: Partial<Hymn> & Pick<Hymn, 'id' | 'book' | 'no'>): Hymn {
  return {
    title: `詩歌 ${partial.no}`,
    categories: [],
    hasChorus: false,
    urls: {},
    notes: [],
    ...partial,
  };
}

const INDEX: HymnIndexEntry[] = [
  { book: 'hymnal', no: 82, section: '讚美主', sub: '祂的受苦' },
  { book: 'hymnal', no: 193, section: '讚美主', sub: '一般' },
  { book: 'hymnal', no: 288, section: '羨慕', sub: '安息' },
  { book: 'supplement', no: 433, section: '追求與長大', title: '踏上更高之地' },
];

const MAP: CategoryMap = {
  _說明: ['給人看的，程式略過'],
  讚美主: ['讚美主'],
  '讚美主／祂的受苦': ['記念主', '主的救贖'],
  羨慕: ['渴慕', '受成全'],
  追求與長大: ['受成全', '渴慕'],
  召會的生活: ['召會生活'],
};

describe('categoriesFromIndex', () => {
  it('先查「大類／細目」再查「大類」，取聯集且不重複', () => {
    expect(categoriesFromIndex(INDEX[0], MAP)).toEqual(['記念主', '主的救贖', '讚美主']);
  });
  it('細目沒對照時只用大類', () => {
    expect(categoriesFromIndex(INDEX[1], MAP)).toEqual(['讚美主']);
  });
  it('都沒對照就是空陣列', () => {
    expect(categoriesFromIndex({ book: 'hymnal', no: 1, section: '不存在' }, MAP)).toEqual([]);
  });
});

describe('lookupIndex', () => {
  const lookup = buildIndexLookup(INDEX);
  it('依書別＋號碼找到目錄位置', () => {
    expect(lookupIndex({ book: 'hymnal', no: 82 }, lookup)?.sub).toBe('祂的受苦');
  });
  it('補充本目錄缺的號碼用百位數推大類', () => {
    expect(lookupIndex({ book: 'supplement', no: 713 }, lookup)).toEqual({
      book: 'supplement',
      no: 713,
      section: '召會的生活',
    });
  });
  it('大本找不到就 undefined（不亂猜）', () => {
    expect(lookupIndex({ book: 'hymnal', no: 999 }, lookup)).toBeUndefined();
  });
});

describe('enrichHymns', () => {
  it('手填的類別排前面，目錄補的排後面，重複不再加', () => {
    const [h] = enrichHymns(
      [hymn({ id: 'h-82', book: 'hymnal', no: 82, categories: ['讚美主', '記念主'] })],
      INDEX,
      MAP,
    );
    expect(h.categories).toEqual(['讚美主', '記念主', '主的救贖']);
    expect(h.index).toEqual(INDEX[0]);
  });

  it('ignoreIndex 的詩只填 index，不動 categories', () => {
    const [h] = enrichHymns(
      [hymn({ id: 'h-288', book: 'hymnal', no: 288, categories: ['安慰'], ignoreIndex: true })],
      INDEX,
      MAP,
    );
    expect(h.categories).toEqual(['安慰']);
    expect(h.index?.section).toBe('羨慕');
  });

  it('補充本靠號碼推出來的大類也會補類別', () => {
    const [h] = enrichHymns([hymn({ id: 's-713', book: 'supplement', no: 713 })], INDEX, MAP);
    expect(h.categories).toEqual(['召會生活']);
  });

  it('是純函式：不改原本的物件', () => {
    const input = [hymn({ id: 'h-82', book: 'hymnal', no: 82, categories: ['讚美主'] })];
    const snapshot = JSON.parse(JSON.stringify(input));
    enrichHymns(input, INDEX, MAP);
    expect(input).toEqual(snapshot);
  });
});
