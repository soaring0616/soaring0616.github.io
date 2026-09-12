import type {
  Hymn,
  HymnCandidate,
  MeetingType,
  SectionResult,
  SelectOptions,
} from '../types';

/**
 * 選詩歌的核心邏輯。
 *
 * 設計原則：**純函式、無副作用**。
 * 不 fetch、不讀 localStorage，所以同樣的輸入永遠得到同樣的輸出 —— 這也是它好測試的原因。
 * React 元件只負責「拿資料 → 呼叫它 → 畫出來」。
 */

/** 書別對熟悉度的基礎值：大本流傳最廣，新歌通常最少人會唱 */
const BOOK_FAMILIARITY: Record<Hymn['book'], number> = {
  hymnal: 0.6,
  supplement: 0.45,
  new: 0.3,
  children: 0.5,
};

const BOOK_LABEL: Record<Hymn['book'], string> = {
  hymnal: '大本',
  supplement: '補充本',
  new: '新歌',
  children: '兒童詩歌',
};

export function bookLabel(book: Hymn['book']): string {
  return BOOK_LABEL[book];
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** 這首詩歌命中了 include 裡的哪些類別 */
function matchedCategories(hymn: Hymn, include: string[]): string[] {
  return hymn.categories.filter((c) => include.includes(c));
}

/** 這首詩歌命中了 exclude 裡的哪些類別 */
function blockedCategories(hymn: Hymn, exclude: string[]): string[] {
  return hymn.categories.filter((c) => exclude.includes(c));
}

/** 這首詩帶了哪些被勾選的主題關鍵字 */
function matchedTags(hymn: Hymn, selected: string[]): string[] {
  if (selected.length === 0) return [];
  return (hymn.tags ?? []).filter((t) => selected.includes(t));
}

/** theme 關鍵字有沒有出現在標題 / 首句 / 類別 / 主題關鍵字（tags）裡 */
function matchesTheme(hymn: Hymn, theme: string): boolean {
  const q = normalize(theme);
  if (!q) return false;
  const haystack = [hymn.title, hymn.firstLine ?? '', ...hymn.categories, ...(hymn.tags ?? [])]
    .map(normalize)
    .join(' | ');
  return haystack.includes(q);
}

/** 把 weights 正規化成總和 1，避免有人把權重寫成 3/2/5 之類 */
function normalizedWeights(w: MeetingType['weights']) {
  const familiarity = Math.max(0, w.familiarity);
  const chorus = Math.max(0, w.chorus);
  const themeMatch = Math.max(0, w.themeMatch);
  const total = familiarity + chorus + themeMatch;
  if (total === 0) return { familiarity: 0, chorus: 0, themeMatch: 1 };
  return {
    familiarity: familiarity / total,
    chorus: chorus / total,
    themeMatch: themeMatch / total,
  };
}

/**
 * 對單一首詩歌打分，並產生「為什麼選它」的理由清單。
 * 匯出是為了讓測試可以單獨檢查評分，元件端一般只需要 selectHymns。
 */
export function scoreHymn(
  hymn: Hymn,
  meetingType: MeetingType,
  opts: SelectOptions = {},
): HymnCandidate {
  const reasons: string[] = [];
  const include = meetingType.include ?? [];
  const w = normalizedWeights(meetingType.weights);

  // --- themeMatch：與聚會類別 / 主題關鍵字的吻合度 ---
  let themeMatch: number;
  if (include.length === 0) {
    // 不限類別的聚會（出遊、特別聚會、自訂）給中間值，避免壓過其他權重
    themeMatch = 0.5;
  } else {
    const hits = matchedCategories(hymn, include);
    themeMatch = hits.length / include.length;
    // 命中一個就已經很有意義，用 sqrt 讓「命中 1/5」不會被壓到只剩 0.2
    themeMatch = Math.sqrt(themeMatch);
    hits.forEach((c) => reasons.push(`類別：${c}`));
  }
  if (opts.theme && matchesTheme(hymn, opts.theme)) {
    themeMatch = Math.min(1, themeMatch + 0.35);
    reasons.push(`主題相符：${opts.theme}`);
  }
  // 勾選的主題關鍵字：每命中一個加 0.35，上限 1（過濾在 selectHymns 做，這裡只算分）
  const tagHits = matchedTags(hymn, opts.tags ?? []);
  if (tagHits.length > 0) {
    themeMatch = Math.min(1, themeMatch + 0.35 * tagHits.length);
    tagHits.forEach((t) => reasons.push(`主題：${t}`));
  }

  // --- familiarity：大家會不會唱。資料有填就用資料的，沒填就依書別 ---
  const bookDefault = BOOK_FAMILIARITY[hymn.book];
  const familiarity =
    hymn.familiarity === undefined
      ? bookDefault
      : Math.min(1, Math.max(0, hymn.familiarity));
  reasons.push(`${BOOK_LABEL[hymn.book]}第 ${hymn.no} 首`);
  if (hymn.familiarity !== undefined) {
    reasons.push(familiarity < bookDefault ? '會眾較不熟，往後排' : '會眾熟悉');
  }

  // --- chorus：有副歌比較好帶 ---
  const chorus = hymn.hasChorus ? 1 : 0;
  if (hymn.hasChorus) reasons.push('有副歌，容易跟唱');

  const score =
    w.themeMatch * themeMatch + w.familiarity * familiarity + w.chorus * chorus;

  return { hymn, score: round(score), reasons };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * 依聚會類型過濾並排序詩歌。
 *
 * 過濾規則：
 *   1. 命中任一 exclude 類別 → 排除
 *   2. include 非空時，至少要命中一個 include 類別 → 否則排除
 *   3. 有勾選主題關鍵字（opts.tags）時，至少要帶一個 → 否則排除
 * 排序規則：分數高的在前；同分時依 書別(大本→補充本→新歌) → 號碼 排，讓結果穩定可重現。
 *
 * 回傳「全部」通過過濾的候選（不截斷）。要幾首請自行 slice(meetingType.suggestedCount)，
 * 這樣 UI 才有辦法做「再多看幾首」。
 */
export function selectHymns(
  hymns: Hymn[],
  meetingType: MeetingType,
  opts: SelectOptions = {},
): HymnCandidate[] {
  const include = meetingType.include ?? [];
  const exclude = meetingType.exclude ?? [];

  const tags = opts.tags ?? [];

  const candidates = hymns
    .filter((h) => blockedCategories(h, exclude).length === 0)
    .filter((h) => include.length === 0 || matchedCategories(h, include).length > 0)
    .filter((h) => tags.length === 0 || matchedTags(h, tags).length > 0)
    .map((h) => scoreHymn(h, meetingType, opts));

  const bookOrder: Hymn['book'][] = ['hymnal', 'supplement', 'new', 'children'];
  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byBook =
      bookOrder.indexOf(a.hymn.book) - bookOrder.indexOf(b.hymn.book);
    if (byBook !== 0) return byBook;
    return a.hymn.no - b.hymn.no;
  });
}

/**
 * 有 sections 的聚會（例如擘餅：記念主 → 敬拜父）用這個。
 * 每一段套用自己的 include，但沿用聚會層級的 exclude 與 weights。
 * 沒有 sections 時回傳單一段落，方便 UI 統一處理。
 *
 * 同一首詩只會出現在一個段落：歸到「命中該段 include 類別最多」的段落，
 * 平手時放前面的段落。不然像「讚美主＋記念主」的詩會在記念主、敬拜父兩段都列一次。
 * include 為空的段落當「一般」段：收下沒命中任何主題段落的詩，再用聚會層級的 include 過濾
 * （小排：先列「願意受成全」「加強」兩個主題段，其餘仍只留召會生活／經歷神／感恩／安慰）。
 */
export function selectBySections(
  hymns: Hymn[],
  meetingType: MeetingType,
  opts: SelectOptions = {},
): SectionResult[] {
  const sections = meetingType.sections;
  if (!sections || sections.length === 0) {
    return [
      { label: meetingType.label, candidates: selectHymns(hymns, meetingType, opts) },
    ];
  }

  // 每首詩的「歸屬段落」索引。
  // include 為空的段落是「一般」段：收容沒命中任何主題段落的詩，
  // 過濾時沿用聚會層級的 include（小排就仍只留召會生活／經歷神…，特別聚會則不限）。
  // 一個都沒命中、又沒有一般段的詩不會有歸屬（後面 selectHymns 也會濾掉）。
  const catchAll = sections.findIndex((s) => s.include.length === 0);
  const home = new Map<string, number>();
  hymns.forEach((h) => {
    let best = -1;
    let bestHits = 0;
    sections.forEach((s, i) => {
      const hits = matchedCategories(h, s.include).length;
      if (hits > bestHits) {
        best = i;
        bestHits = hits;
      }
    });
    if (best < 0) best = catchAll;
    if (best >= 0) home.set(h.id, best);
  });

  return sections.map((section, i) => ({
    label: section.label,
    candidates: selectHymns(
      hymns.filter((h) => home.get(h.id) === i),
      {
        ...meetingType,
        include: i === catchAll ? meetingType.include : section.include,
        sections: undefined,
      },
      opts,
    ),
  }));
}
