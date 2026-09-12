import type { Hymn, ThemeTagFile } from '../types';

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
