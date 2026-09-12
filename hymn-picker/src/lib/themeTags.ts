import type { Hymn, TagCount, TagGroup, ThemeTagFile } from '../types';

/** 沒歸進任何組的 tag 放這一組 */
export const OTHER_GROUP = '其他';

/**
 * 數「這批詩歌」裡每個 tag 各有幾首。
 * 傳「通過聚會過濾的候選」進來，數字就是在這種聚會裡用得上的首數；
 * allTags 是全資料的 tag 清單，讓沒命中的 tag 也以 0 出現（畫成灰的，而不是消失）。
 */
export function countTags(hymns: Hymn[], allTags: string[]): TagCount[] {
  const count = new Map<string, number>(allTags.map((t) => [t, 0]));
  hymns.forEach((h) => (h.tags ?? []).forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
  return [...count.entries()]
    .map(([tag, n]) => ({ tag, count: n }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hant'));
}

/** 依 theme_tags.json 的 groups 把 tag 分列；組的順序照檔案，「其他」永遠最後 */
export function groupTags(
  counts: TagCount[],
  groups: Record<string, string[]> = {},
): TagGroup[] {
  const byTag = new Map(counts.map((c) => [c.tag, c]));
  const placed = new Set<string>();
  const out: TagGroup[] = [];
  Object.entries(groups).forEach(([group, tags]) => {
    const list = tags
      .filter((t) => byTag.has(t) && !placed.has(t))
      .map((t) => {
        placed.add(t);
        return byTag.get(t) as TagCount;
      })
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hant'));
    if (list.length > 0) out.push({ group, tags: list });
  });
  const rest = counts.filter((c) => !placed.has(c.tag));
  if (rest.length > 0) out.push({ group: OTHER_GROUP, tags: rest });
  return out;
}

/**
 * 把「主題關鍵字」（theme_tags.json）掛到詩歌上。
 *
 * 純函式：吃 hymns + 檔案內容，吐新的陣列，不動原物件。
 * 一個出處（例如合聲響應的一集）有一組 tags 和它點名的詩歌 id；
 * 同一首詩被多個出處點名，tags 取聯集、出處都留著。
 * 出處裡列了但 hymns 裡還沒有的 id 會被略過（先列著，等詩歌加進來就生效）。
 */
export function applyThemeTags(hymns: Hymn[], file: ThemeTagFile): Hymn[] {
  const byId = new Map<string, { tags: string[]; sources: { label: string; url?: string }[] }>();
  file.sources.forEach((src) => {
    src.hymns.forEach((id) => {
      const cur = byId.get(id) ?? { tags: [], sources: [] };
      src.tags.forEach((t) => {
        if (!cur.tags.includes(t)) cur.tags.push(t);
      });
      cur.sources.push({ label: src.label, url: src.url });
      byId.set(id, cur);
    });
  });

  return hymns.map((h) => {
    const hit = byId.get(h.id);
    if (!hit) return h;
    const tags = [...(h.tags ?? [])];
    hit.tags.forEach((t) => {
      if (!tags.includes(t)) tags.push(t);
    });
    return { ...h, tags, tagSources: [...(h.tagSources ?? []), ...hit.sources] };
  });
}
