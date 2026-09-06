import type { SungHistory } from '../types';

/**
 * 「上次唱過的日期」紀錄，存在瀏覽器的 localStorage。
 *
 * 為什麼不放在 JSON？因為這是每個人自己的紀錄，而且會一直變；
 * public/data/*.json 是所有人共用、跟著 build 一起部署的靜態資料。
 *
 * 這一層刻意跟 select.ts 分開：select.ts 是純函式（不碰瀏覽器 API），
 * 讀寫瀏覽器的副作用全部集中在這裡，測試時只要餵 history 物件就好。
 */

const STORAGE_KEY = 'hymn-picker/history/v1';

/** 讀取紀錄；壞掉或不存在時回傳空物件，不讓整個畫面掛掉 */
export function loadHistory(): SungHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: SungHistory = {};
    for (const [id, date] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof date === 'string') out[id] = date;
    }
    return out;
  } catch {
    return {};
  }
}

function save(history: SungHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // 無痕模式或容量滿了：紀錄丟失不影響選詩，安靜忽略
  }
}

/** YYYY-MM-DD（用本地時區，避免半夜跨日誤差） */
export function todayISO(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 標記某首詩歌在某天唱過，回傳更新後的完整紀錄 */
export function markSung(
  hymnId: string,
  date: string = todayISO(),
  base: SungHistory = loadHistory(),
): SungHistory {
  const next = { ...base, [hymnId]: date };
  save(next);
  return next;
}

/** 取消某首詩歌的紀錄，回傳更新後的完整紀錄 */
export function unmarkSung(
  hymnId: string,
  base: SungHistory = loadHistory(),
): SungHistory {
  const next = { ...base };
  delete next[hymnId];
  save(next);
  return next;
}

/** 清空全部紀錄 */
export function clearHistory(): SungHistory {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上，安靜忽略
  }
  return {};
}
