/**
 * 全專案共用的型別定義。
 * 這裡是「資料的合約」：public/data/*.json 的欄位、以及 lib/select.ts 的輸入輸出，
 * 都以本檔為準。改 JSON 欄位時請同步改這裡，TypeScript 才擋得住打錯字。
 */

/** 註解的種類：摘句 / 故事背景 / 相關經節 / 帶詩歌的小提醒 */
export type NoteType = 'excerpt' | 'story' | 'scripture' | 'tip';

/** 一則註解。text 一到兩句就好，長篇請用 url 連出去。 */
export interface Note {
  type: NoteType;
  /** 一到兩句的摘要，卡片上直接顯示 */
  text: string;
  /** 出處名稱，例如「hymnal.net 詩歌背景」「生命讀經」 */
  source: string;
  /** 全文連結；沒有就不顯示「閱讀全文 →」 */
  url?: string;
}

/** 詩歌本別：大本詩歌 / 補充本 / hymnal.net 新歌 */
export type HymnBook = 'hymnal' | 'supplement' | 'new';

export interface Hymn {
  /** 'h-623' 大本 / 's-12' 補充本 / 'n-1158' hymnal.net 新歌 */
  id: string;
  book: HymnBook;
  no: number;
  title: string;
  firstLine?: string;
  /** 中文類別，對應 hymnal.net 的類別/子類別，例如 ['記念主', '主的救贖'] */
  categories: string[];
  key?: string;
  time?: string;
  meter?: string;
  hasChorus: boolean;
  /** hymnal.net 英文號 */
  enNo?: number;
  urls: { hymnal?: string; luke54?: string[] };
  notes: Note[];
}

/** 一種聚會的選詩規則 */
export interface MeetingType {
  id: string;
  label: string;
  /** 允許的類別（空陣列 = 不限） */
  include: string[];
  /** 排除的類別（命中任一則整首排除） */
  exclude: string[];
  weights: {
    /** 熟悉度：大家會不會唱 */
    familiarity: number;
    /** 有副歌加分（好帶、容易跟） */
    chorus: number;
    /** 與 include / theme 的吻合度 */
    themeMatch: number;
  };
  /** 例如擘餅分「記念主」「敬拜父」兩段 */
  sections?: { label: string; include: string[] }[];
  suggestedCount: number;
}

/** history: { [hymnId]: 最後一次唱的 ISO 日期字串, 例如 '2026-08-01' } */
export type SungHistory = Record<string, string>;

export interface SelectOptions {
  /** 使用者輸入的主題關鍵字，會比對標題 / 首句 / 類別 */
  theme?: string;
  /** 各首詩歌最後一次唱的日期 */
  history?: SungHistory;
  /**
   * 「現在」是什麼時候。預設 new Date()。
   * 之所以開這個參數，是為了讓 selectHymns 保持純函式、測試可重現。
   */
  now?: Date | string;
  /** 幾天內唱過就算「最近唱過」，預設 30 */
  recentDays?: number;
}

/** selectHymns 的輸出：詩歌 + 分數 + 可解釋的理由 */
export interface HymnCandidate {
  hymn: Hymn;
  /** 0..1 的加權總分（越高越前面） */
  score: number;
  /** 給人看的理由，例如「類別：記念主」「30 天內未唱過」 */
  reasons: string[];
}

/** 有分段的聚會（例如擘餅）用的結果 */
export interface SectionResult {
  label: string;
  candidates: HymnCandidate[];
}
