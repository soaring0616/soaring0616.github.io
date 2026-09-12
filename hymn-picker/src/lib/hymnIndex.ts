import type { CategoryMap, Hymn, HymnIndexEntry } from '../types';

/**
 * 用詩歌本目錄（hymn_index.json）自動補類別。
 *
 * 純函式：吃 hymns + index + map，吐出新的 hymns 陣列，不動原本的物件。
 * 規則：
 *   1. 依 (book, no) 找到這首詩在目錄裡的位置（section／sub）。
 *      補充本目錄不完整，但它的號碼本身就分段（1xx 靈與生命、2xx 享受基督…），
 *      找不到時用百位數推回大類。
 *   2. 查 category_map：先「大類／細目」再「大類」，命中的取聯集。
 *      兒童詩歌的大類名稱會跟大本撞（都有「傳揚福音」），所以它的鍵一律寫成
 *      「兒童詩歌／大類」，而且不再退回查「大類」。
 *   3. 手填的 categories 排前面、目錄補的排後面；重複的不再加。
 *   4. hymn.ignoreIndex 為 true 就只填 index，不動 categories。
 */

/** 補充本的號碼段對應的大類（目錄頁缺漏時用） */
const SUPPLEMENT_SECTION_BY_HUNDREDS: Record<number, string> = {
  0: '讚美的話',
  1: '靈與生命',
  2: '享受基督',
  3: '愛慕耶穌',
  4: '追求與長大',
  5: '召會的異象',
  6: '建造與合一',
  7: '召會的生活',
  8: '事奉與福音',
  9: '盼望與預備',
  10: '神的經綸',
};

/** 目錄大類與細目之間的分隔號，category_map.json 的鍵也用它 */
export const INDEX_SEPARATOR = '／';

/** 兒童詩歌在 category_map.json 裡的鍵前綴 */
export const CHILDREN_KEY_PREFIX = `兒童詩歌${INDEX_SEPARATOR}`;

export function indexKey(book: Hymn['book'], no: number): string {
  return `${book}:${no}`;
}

export function buildIndexLookup(entries: HymnIndexEntry[]): Map<string, HymnIndexEntry> {
  const map = new Map<string, HymnIndexEntry>();
  entries.forEach((e) => map.set(indexKey(e.book, e.no), e));
  return map;
}

/** 找這首詩的目錄位置；補充本找不到時用號碼推 */
export function lookupIndex(
  hymn: Pick<Hymn, 'book' | 'no'>,
  lookup: Map<string, HymnIndexEntry>,
): HymnIndexEntry | undefined {
  const hit = lookup.get(indexKey(hymn.book, hymn.no));
  if (hit) return hit;
  if (hymn.book === 'supplement') {
    const section = SUPPLEMENT_SECTION_BY_HUNDREDS[Math.floor(hymn.no / 100)];
    if (section) return { book: 'supplement', no: hymn.no, section };
  }
  return undefined;
}

/** 給人看的目錄位置：「讚美主／祂的受苦」或「追求與長大」 */
export function indexLabel(entry: HymnIndexEntry): string {
  return entry.sub ? `${entry.section}${INDEX_SEPARATOR}${entry.sub}` : entry.section;
}

/** 目錄位置 → 本專案類別（可能是空陣列） */
export function categoriesFromIndex(entry: HymnIndexEntry, map: CategoryMap): string[] {
  const out: string[] = [];
  const add = (key: string) => {
    (map[key] ?? []).forEach((c) => {
      if (!out.includes(c)) out.push(c);
    });
  };
  if (entry.book === 'children') {
    add(CHILDREN_KEY_PREFIX + entry.section);
    return out;
  }
  if (entry.sub) add(indexLabel(entry));
  add(entry.section);
  return out;
}

export function enrichHymns(
  hymns: Hymn[],
  entries: HymnIndexEntry[],
  map: CategoryMap,
): Hymn[] {
  const lookup = buildIndexLookup(entries);
  return hymns.map((h) => {
    const entry = lookupIndex(h, lookup);
    if (!entry) return h;
    if (h.ignoreIndex) return { ...h, index: entry };
    const extra = categoriesFromIndex(entry, map).filter((c) => !h.categories.includes(c));
    return { ...h, index: entry, categories: [...h.categories, ...extra] };
  });
}
