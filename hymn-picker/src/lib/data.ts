import type { Hymn, MeetingType } from '../types';

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

export function loadHymns(): Promise<Hymn[]> {
  return fetchJson<Hymn[]>('data/hymns.json');
}

export function loadMeetingTypes(): Promise<MeetingType[]> {
  return fetchJson<MeetingType[]>('data/meeting_types.json');
}

/** 一次載入兩份資料，Home 頁的 useEffect 用這個最方便 */
export function loadAll(): Promise<{ hymns: Hymn[]; meetingTypes: MeetingType[] }> {
  return Promise.all([loadHymns(), loadMeetingTypes()]).then(
    ([hymns, meetingTypes]) => ({ hymns, meetingTypes }),
  );
}
