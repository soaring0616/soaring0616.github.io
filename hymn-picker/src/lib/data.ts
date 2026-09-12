import type { CategoryMap, Hymn, HymnIndexEntry, MeetingType, ThemeTagFile } from '../types';
import { enrichHymns } from './hymnIndex';
import { applyThemeTags } from './themeTags';

/**
 * 靜態 JSON 的載入函式。沒有後端，全部靠 fetch public/ 底下的檔案。
 *
 * 重點：**不要寫死 '/data/hymns.json'**。
 * 部署到 GitHub Pages 子路徑時網站根目錄是 /<repo>/，寫死斜線開頭會 404。
 * import.meta.env.BASE_URL 由 vite.config.ts 的 base 決定（見 VITE_BASE），
 * 本機是 '/'，部署時是 '/hymn-picker/'，用它組路徑就兩邊都對。
 */
function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL; // 保證以 '/' 結尾
  return `${base}${path.replace(/^\//, '')}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = assetUrl(path);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`載入 ${url} 失敗：${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * 載入詩歌，並用詩歌本目錄（hymn_index.json + category_map.json）補上類別與目錄位置，
 * 再用 theme_tags.json 掛上主題關鍵字。
 * 兩個頁面（Home、HymnDetail）都走這裡，所以看到的類別一致。
 */
export function loadHymns(): Promise<Hymn[]> {
  return Promise.all([
    fetchJson<Hymn[]>('data/hymns.json'),
    fetchJson<HymnIndexEntry[]>('data/hymn_index.json'),
    fetchJson<CategoryMap>('data/category_map.json'),
    loadThemeTags(),
  ]).then(([hymns, index, map, tags]) =>
    applyThemeTags(enrichHymns(hymns, index, map), tags),
  );
}

export function loadThemeTags(): Promise<ThemeTagFile> {
  return fetchJson<ThemeTagFile>('data/theme_tags.json');
}

export function loadMeetingTypes(): Promise<MeetingType[]> {
  return fetchJson<MeetingType[]>('data/meeting_types.json');
}

/** 一次載入首頁要的全部資料（theme_tags.json 會被 fetch 兩次，瀏覽器快取會接住） */
export function loadAll(): Promise<{
  hymns: Hymn[];
  meetingTypes: MeetingType[];
  tagGroups: Record<string, string[]>;
}> {
  return Promise.all([loadHymns(), loadMeetingTypes(), loadThemeTags()]).then(
    ([hymns, meetingTypes, tagFile]) => ({
      hymns,
      meetingTypes,
      tagGroups: tagFile.groups ?? {},
    }),
  );
}
