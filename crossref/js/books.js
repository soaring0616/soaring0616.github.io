/* 恢復本 66 卷書卷表：code = 1–66（與 API chapter_code、cwwl f_BookNo 一致） */
'use strict';

var BOOKS = [
  { code: 1,  name: '創世記',       abbr: '創',   chapters: 50, ot: true },
  { code: 2,  name: '出埃及記',     abbr: '出',   chapters: 40, ot: true },
  { code: 3,  name: '利未記',       abbr: '利',   chapters: 27, ot: true },
  { code: 4,  name: '民數記',       abbr: '民',   chapters: 36, ot: true },
  { code: 5,  name: '申命記',       abbr: '申',   chapters: 34, ot: true },
  { code: 6,  name: '約書亞記',     abbr: '書',   chapters: 24, ot: true },
  { code: 7,  name: '士師記',       abbr: '士',   chapters: 21, ot: true },
  { code: 8,  name: '路得記',       abbr: '得',   chapters: 4,  ot: true },
  { code: 9,  name: '撒母耳記上',   abbr: '撒上', chapters: 31, ot: true },
  { code: 10, name: '撒母耳記下',   abbr: '撒下', chapters: 24, ot: true },
  { code: 11, name: '列王紀上',     abbr: '王上', chapters: 22, ot: true },
  { code: 12, name: '列王紀下',     abbr: '王下', chapters: 25, ot: true },
  { code: 13, name: '歷代志上',     abbr: '代上', chapters: 29, ot: true },
  { code: 14, name: '歷代志下',     abbr: '代下', chapters: 36, ot: true },
  { code: 15, name: '以斯拉記',     abbr: '拉',   chapters: 10, ot: true },
  { code: 16, name: '尼希米記',     abbr: '尼',   chapters: 13, ot: true },
  { code: 17, name: '以斯帖記',     abbr: '斯',   chapters: 10, ot: true },
  { code: 18, name: '約伯記',       abbr: '伯',   chapters: 42, ot: true },
  { code: 19, name: '詩篇',         abbr: '詩',   chapters: 150, ot: true },
  { code: 20, name: '箴言',         abbr: '箴',   chapters: 31, ot: true },
  { code: 21, name: '傳道書',       abbr: '傳',   chapters: 12, ot: true },
  { code: 22, name: '雅歌',         abbr: '歌',   chapters: 8,  ot: true },
  { code: 23, name: '以賽亞書',     abbr: '賽',   chapters: 66, ot: true },
  { code: 24, name: '耶利米書',     abbr: '耶',   chapters: 52, ot: true },
  { code: 25, name: '耶利米哀歌',   abbr: '哀',   chapters: 5,  ot: true },
  { code: 26, name: '以西結書',     abbr: '結',   chapters: 48, ot: true },
  { code: 27, name: '但以理書',     abbr: '但',   chapters: 12, ot: true },
  { code: 28, name: '何西阿書',     abbr: '何',   chapters: 14, ot: true },
  { code: 29, name: '約珥書',       abbr: '珥',   chapters: 3,  ot: true },
  { code: 30, name: '阿摩司書',     abbr: '摩',   chapters: 9,  ot: true },
  { code: 31, name: '俄巴底亞書',   abbr: '俄',   chapters: 1,  ot: true },
  { code: 32, name: '約拿書',       abbr: '拿',   chapters: 4,  ot: true },
  { code: 33, name: '彌迦書',       abbr: '彌',   chapters: 7,  ot: true },
  { code: 34, name: '那鴻書',       abbr: '鴻',   chapters: 3,  ot: true },
  { code: 35, name: '哈巴谷書',     abbr: '哈',   chapters: 3,  ot: true },
  { code: 36, name: '西番雅書',     abbr: '番',   chapters: 3,  ot: true },
  { code: 37, name: '哈該書',       abbr: '該',   chapters: 2,  ot: true },
  { code: 38, name: '撒迦利亞書',   abbr: '亞',   chapters: 14, ot: true },
  { code: 39, name: '瑪拉基書',     abbr: '瑪',   chapters: 4,  ot: true },
  { code: 40, name: '馬太福音',     abbr: '太',   chapters: 28, ot: false },
  { code: 41, name: '馬可福音',     abbr: '可',   chapters: 16, ot: false },
  { code: 42, name: '路加福音',     abbr: '路',   chapters: 24, ot: false },
  { code: 43, name: '約翰福音',     abbr: '約',   chapters: 21, ot: false },
  { code: 44, name: '使徒行傳',     abbr: '徒',   chapters: 28, ot: false },
  { code: 45, name: '羅馬書',       abbr: '羅',   chapters: 16, ot: false },
  { code: 46, name: '哥林多前書',   abbr: '林前', chapters: 16, ot: false },
  { code: 47, name: '哥林多後書',   abbr: '林後', chapters: 13, ot: false },
  { code: 48, name: '加拉太書',     abbr: '加',   chapters: 6,  ot: false },
  { code: 49, name: '以弗所書',     abbr: '弗',   chapters: 6,  ot: false },
  { code: 50, name: '腓立比書',     abbr: '腓',   chapters: 4,  ot: false },
  { code: 51, name: '歌羅西書',     abbr: '西',   chapters: 4,  ot: false },
  { code: 52, name: '帖撒羅尼迦前書', abbr: '帖前', chapters: 5, ot: false },
  { code: 53, name: '帖撒羅尼迦後書', abbr: '帖後', chapters: 3, ot: false },
  { code: 54, name: '提摩太前書',   abbr: '提前', chapters: 6,  ot: false },
  { code: 55, name: '提摩太後書',   abbr: '提後', chapters: 4,  ot: false },
  { code: 56, name: '提多書',       abbr: '多',   chapters: 3,  ot: false },
  { code: 57, name: '腓利門書',     abbr: '門',   chapters: 1,  ot: false },
  { code: 58, name: '希伯來書',     abbr: '來',   chapters: 13, ot: false },
  { code: 59, name: '雅各書',       abbr: '雅',   chapters: 5,  ot: false },
  { code: 60, name: '彼得前書',     abbr: '彼前', chapters: 5,  ot: false },
  { code: 61, name: '彼得後書',     abbr: '彼後', chapters: 3,  ot: false },
  { code: 62, name: '約翰壹書',     abbr: '約壹', chapters: 5,  ot: false },
  { code: 63, name: '約翰貳書',     abbr: '約貳', chapters: 1,  ot: false },
  { code: 64, name: '約翰參書',     abbr: '約參', chapters: 1,  ot: false },
  { code: 65, name: '猶大書',       abbr: '猶',   chapters: 1,  ot: false },
  { code: 66, name: '啟示錄',       abbr: '啟',   chapters: 22, ot: false },
];

var BOOK_BY_CODE = {};
BOOKS.forEach(function (b) { BOOK_BY_CODE[b.code] = b; });

/* 縮寫比對表：長度遞減，最長優先（約壹 先於 約；撒上 先於 撒） */
var ABBR_LIST = BOOKS.slice().sort(function (a, b) {
  return b.abbr.length - a.abbr.length;
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BOOKS: BOOKS, BOOK_BY_CODE: BOOK_BY_CODE, ABBR_LIST: ABBR_LIST };
}
