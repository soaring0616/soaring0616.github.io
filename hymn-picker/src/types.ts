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
  /**
   * 會眾熟悉度 0–1。不填就依書別的預設（大本 0.6／補充本 0.45／新歌 0.3）。
   * 不常唱的詩填低一點（例如 0.2）就會往後排；大家都會的填高一點。
   */
  familiarity?: number;
  /** hymnal.net 英文號 */
  enNo?: number;
  urls: { hymnal?: string; luke54?: string[] };
  notes: Note[];
  /**
   * 設 true 就不用詩歌本目錄補類別（例如 288 只想留「安慰」）。
   * 預設 false：載入時會把目錄對出來的類別加進 categories。
   */
  ignoreIndex?: boolean;
  /**
   * 這首詩在詩歌本目錄裡的位置，載入時由 hymn_index.json 填上（JSON 裡不用寫）。
   * 大本有細目（讚美主／祂的受苦），補充本只有大類。
   */
  index?: HymnIndexEntry;
}

/** public/data/hymn_index.json 的一筆：詩歌本目錄裡的一首詩 */
export interface HymnIndexEntry {
  book: HymnBook;
  no: number;
  /** 目錄大類，例如「讚美主」「追求與長大」 */
  section: string;
  /** 大本的細目，例如「祂的受苦」；補充本沒有 */
  sub?: string | null;
  /** 補充本目錄有標題，大本目錄只有號碼 */
  title?: string;
}

/**
 * public/data/category_map.json：目錄大類（或「大類／細目」）→ 本專案的類別。
 * 以 _ 開頭的鍵是給人看的說明，程式會略過。
 */
export type CategoryMap = Record<string, string[]>;

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

export interface SelectOptions {
  /** 使用者輸入的主題關鍵字，會比對標題 / 首句 / 類別 */
  theme?: string;
}

/** selectHymns 的輸出：詩歌 + 分數 + 可解釋的理由 */
export interface HymnCandidate {
  hymn: Hymn;
  /** 0..1 的加權總分（越高越前面） */
  score: number;
  /** 給人看的理由，例如「類別：記念主」「有副歌，容易跟唱」 */
  reasons: string[];
}

/** 有分段的聚會（例如擘餅）用的結果 */
export interface SectionResult {
  label: string;
  candidates: HymnCandidate[];
}
