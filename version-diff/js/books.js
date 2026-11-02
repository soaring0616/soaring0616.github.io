/*
	66 卷書卷表 + 各來源站的書卷代號
	--------------------------------
	code 1–66 與恢復本 API 的 chapter_code 一致（和 crossref/js/books.js 同一套編號）。

	每一卷另外帶四個外部站的識別碼，欄位對應下表（都已實地確認過格式，見 sources.js）：
	  fhl  信望愛的中文經卷縮寫      → read.php?chineses=弗
	  hub  biblehub 的英文 slug      → biblehub.com/ephesians/4-15.htm
	  cut  cut.ibibles.net 的檔名    → cut.ibibles.net/110Ephesians.htm
	  bro  bibleread.online 的 slug  → bibleread.online/bible/the-epistle-of-paul-to-the-ephesians/4/

	※ fhl 欄位用的是通行的和合本縮寫；只有「約一／約二／約三」這三卷
	  （約翰壹、貳、參書）我沒有在信望愛站上逐一確認過，若按鈕開錯頁面，
	  改這三行的 fhl 值即可，其餘程式都不用動。
*/
'use strict';

var BOOKS = [
	{ code: 1,  name: '創世記',     abbr: '創',   chapters: 50,  ot: true,  fhl: '創',   hub: 'genesis',          cut: '001Genesis.htm',        bro: 'genesis' },
	{ code: 2,  name: '出埃及記',   abbr: '出',   chapters: 40,  ot: true,  fhl: '出',   hub: 'exodus',           cut: '002Exodus.htm',         bro: 'exodus' },
	{ code: 3,  name: '利未記',     abbr: '利',   chapters: 27,  ot: true,  fhl: '利',   hub: 'leviticus',        cut: '003Leviticus.htm',      bro: 'leviticus' },
	{ code: 4,  name: '民數記',     abbr: '民',   chapters: 36,  ot: true,  fhl: '民',   hub: 'numbers',          cut: '004Numbers.htm',        bro: 'numbers' },
	{ code: 5,  name: '申命記',     abbr: '申',   chapters: 34,  ot: true,  fhl: '申',   hub: 'deuteronomy',      cut: '005Deuteronomy.htm',    bro: 'deuteronomy' },
	{ code: 6,  name: '約書亞記',   abbr: '書',   chapters: 24,  ot: true,  fhl: '書',   hub: 'joshua',           cut: '006Joshua.htm',         bro: 'joshua' },
	{ code: 7,  name: '士師記',     abbr: '士',   chapters: 21,  ot: true,  fhl: '士',   hub: 'judges',           cut: '007Judges.htm',         bro: 'judges' },
	{ code: 8,  name: '路得記',     abbr: '得',   chapters: 4,   ot: true,  fhl: '得',   hub: 'ruth',             cut: '008Ruth.htm',           bro: 'ruth' },
	{ code: 9,  name: '撒母耳記上', abbr: '撒上', chapters: 31,  ot: true,  fhl: '撒上', hub: '1_samuel',         cut: '009Samuel1.htm',        bro: 'first-samuel' },
	{ code: 10, name: '撒母耳記下', abbr: '撒下', chapters: 24,  ot: true,  fhl: '撒下', hub: '2_samuel',         cut: '010Samuel2.htm',        bro: 'second-samuel' },
	{ code: 11, name: '列王紀上',   abbr: '王上', chapters: 22,  ot: true,  fhl: '王上', hub: '1_kings',          cut: '011Kings1.htm',         bro: 'first-kings' },
	{ code: 12, name: '列王紀下',   abbr: '王下', chapters: 25,  ot: true,  fhl: '王下', hub: '2_kings',          cut: '012Kings2.htm',         bro: 'second-kings' },
	{ code: 13, name: '歷代志上',   abbr: '代上', chapters: 29,  ot: true,  fhl: '代上', hub: '1_chronicles',     cut: '013Chronicles1.htm',    bro: 'first-chronicles' },
	{ code: 14, name: '歷代志下',   abbr: '代下', chapters: 36,  ot: true,  fhl: '代下', hub: '2_chronicles',     cut: '014Chronicles2.htm',    bro: 'second-chronicles' },
	{ code: 15, name: '以斯拉記',   abbr: '拉',   chapters: 10,  ot: true,  fhl: '拉',   hub: 'ezra',             cut: '015Ezra.htm',           bro: 'ezra' },
	{ code: 16, name: '尼希米記',   abbr: '尼',   chapters: 13,  ot: true,  fhl: '尼',   hub: 'nehemiah',         cut: '016Nehemiah.htm',       bro: 'nehemiah' },
	{ code: 17, name: '以斯帖記',   abbr: '斯',   chapters: 10,  ot: true,  fhl: '斯',   hub: 'esther',           cut: '017Esther.htm',         bro: 'esther' },
	{ code: 18, name: '約伯記',     abbr: '伯',   chapters: 42,  ot: true,  fhl: '伯',   hub: 'job',              cut: '018Job.htm',            bro: 'job' },
	{ code: 19, name: '詩篇',       abbr: '詩',   chapters: 150, ot: true,  fhl: '詩',   hub: 'psalms',           cut: '019Psalms.htm',         bro: 'psalms' },
	{ code: 20, name: '箴言',       abbr: '箴',   chapters: 31,  ot: true,  fhl: '箴',   hub: 'proverbs',         cut: '020Proverbs.htm',       bro: 'proverbs' },
	{ code: 21, name: '傳道書',     abbr: '傳',   chapters: 12,  ot: true,  fhl: '傳',   hub: 'ecclesiastes',     cut: '021Ecclesiastes.htm',   bro: 'ecclesiastes' },
	{ code: 22, name: '雅歌',       abbr: '歌',   chapters: 8,   ot: true,  fhl: '歌',   hub: 'songs',            cut: '022Songs.htm',          bro: 'song-of-songs' },
	{ code: 23, name: '以賽亞書',   abbr: '賽',   chapters: 66,  ot: true,  fhl: '賽',   hub: 'isaiah',           cut: '023Isaiah.htm',         bro: 'isaiah' },
	{ code: 24, name: '耶利米書',   abbr: '耶',   chapters: 52,  ot: true,  fhl: '耶',   hub: 'jeremiah',         cut: '024Jeremiah.htm',       bro: 'jeremiah' },
	{ code: 25, name: '耶利米哀歌', abbr: '哀',   chapters: 5,   ot: true,  fhl: '哀',   hub: 'lamentations',     cut: '025Lamentations.htm',   bro: 'lamentations' },
	{ code: 26, name: '以西結書',   abbr: '結',   chapters: 48,  ot: true,  fhl: '結',   hub: 'ezekiel',          cut: '026Ezekiel.htm',        bro: 'ezekiel' },
	{ code: 27, name: '但以理書',   abbr: '但',   chapters: 12,  ot: true,  fhl: '但',   hub: 'daniel',           cut: '027Daniel.htm',         bro: 'daniel' },
	{ code: 28, name: '何西阿書',   abbr: '何',   chapters: 14,  ot: true,  fhl: '何',   hub: 'hosea',            cut: '028Hosea.htm',          bro: 'hosea' },
	{ code: 29, name: '約珥書',     abbr: '珥',   chapters: 3,   ot: true,  fhl: '珥',   hub: 'joel',             cut: '029Joel.htm',           bro: 'joel' },
	{ code: 30, name: '阿摩司書',   abbr: '摩',   chapters: 9,   ot: true,  fhl: '摩',   hub: 'amos',             cut: '030Amos.htm',           bro: 'amos' },
	{ code: 31, name: '俄巴底亞書', abbr: '俄',   chapters: 1,   ot: true,  fhl: '俄',   hub: 'obadiah',          cut: '031Obadiah.htm',        bro: 'obadiah' },
	{ code: 32, name: '約拿書',     abbr: '拿',   chapters: 4,   ot: true,  fhl: '拿',   hub: 'jonah',            cut: '032Jonah.htm',          bro: 'jonah' },
	{ code: 33, name: '彌迦書',     abbr: '彌',   chapters: 7,   ot: true,  fhl: '彌',   hub: 'micah',            cut: '033Micah.htm',          bro: 'micah' },
	{ code: 34, name: '那鴻書',     abbr: '鴻',   chapters: 3,   ot: true,  fhl: '鴻',   hub: 'nahum',            cut: '034Nahum.htm',          bro: 'nahum' },
	{ code: 35, name: '哈巴谷書',   abbr: '哈',   chapters: 3,   ot: true,  fhl: '哈',   hub: 'habakkuk',         cut: '035Habakkuk.htm',       bro: 'habakkuk' },
	{ code: 36, name: '西番雅書',   abbr: '番',   chapters: 3,   ot: true,  fhl: '番',   hub: 'zephaniah',        cut: '036Zephaniah.htm',      bro: 'zephaniah' },
	{ code: 37, name: '哈該書',     abbr: '該',   chapters: 2,   ot: true,  fhl: '該',   hub: 'haggai',           cut: '037Haggai.htm',         bro: 'haggai' },
	{ code: 38, name: '撒迦利亞書', abbr: '亞',   chapters: 14,  ot: true,  fhl: '亞',   hub: 'zechariah',        cut: '038Zechariah.htm',      bro: 'zechariah' },
	{ code: 39, name: '瑪拉基書',   abbr: '瑪',   chapters: 4,   ot: true,  fhl: '瑪',   hub: 'malachi',          cut: '039Malachi.htm',        bro: 'malachi' },
	{ code: 40, name: '馬太福音',   abbr: '太',   chapters: 28,  ot: false, fhl: '太',   hub: 'matthew',          cut: '101Matthew.htm',        bro: 'the-gospel-according-to-matthew' },
	{ code: 41, name: '馬可福音',   abbr: '可',   chapters: 16,  ot: false, fhl: '可',   hub: 'mark',             cut: '102Mark.htm',           bro: 'the-gospel-according-to-mark' },
	{ code: 42, name: '路加福音',   abbr: '路',   chapters: 24,  ot: false, fhl: '路',   hub: 'luke',             cut: '103Luke.htm',           bro: 'the-gospel-according-to-luke' },
	{ code: 43, name: '約翰福音',   abbr: '約',   chapters: 21,  ot: false, fhl: '約',   hub: 'john',             cut: '104John.htm',           bro: 'the-gospel-according-to-john' },
	{ code: 44, name: '使徒行傳',   abbr: '徒',   chapters: 28,  ot: false, fhl: '徒',   hub: 'acts',             cut: '105Acts.htm',           bro: 'the-acts-of-the-apostles' },
	{ code: 45, name: '羅馬書',     abbr: '羅',   chapters: 16,  ot: false, fhl: '羅',   hub: 'romans',           cut: '106Romans.htm',         bro: 'the-epistle-of-paul-to-the-romans' },
	{ code: 46, name: '哥林多前書', abbr: '林前', chapters: 16,  ot: false, fhl: '林前', hub: '1_corinthians',    cut: '107Corinthians1.htm',   bro: 'the-first-epistle-of-paul-to-the-corinthians' },
	{ code: 47, name: '哥林多後書', abbr: '林後', chapters: 13,  ot: false, fhl: '林後', hub: '2_corinthians',    cut: '108Corinthians2.htm',   bro: 'the-second-epistle-of-paul-to-the-corinthians' },
	{ code: 48, name: '加拉太書',   abbr: '加',   chapters: 6,   ot: false, fhl: '加',   hub: 'galatians',        cut: '109Galatians.htm',      bro: 'the-epistle-of-paul-to-the-galatians' },
	{ code: 49, name: '以弗所書',   abbr: '弗',   chapters: 6,   ot: false, fhl: '弗',   hub: 'ephesians',        cut: '110Ephesians.htm',      bro: 'the-epistle-of-paul-to-the-ephesians' },
	{ code: 50, name: '腓立比書',   abbr: '腓',   chapters: 4,   ot: false, fhl: '腓',   hub: 'philippians',      cut: '111Philippians.htm',    bro: 'the-epistle-of-paul-to-the-philippians' },
	{ code: 51, name: '歌羅西書',   abbr: '西',   chapters: 4,   ot: false, fhl: '西',   hub: 'colossians',       cut: '112Colossians.htm',     bro: 'the-epistle-of-paul-to-the-colossians' },
	{ code: 52, name: '帖撒羅尼迦前書', abbr: '帖前', chapters: 5, ot: false, fhl: '帖前', hub: '1_thessalonians', cut: '113Thessalonians1.htm', bro: 'the-first-epistle-of-paul-to-the-thessalonians' },
	{ code: 53, name: '帖撒羅尼迦後書', abbr: '帖後', chapters: 3, ot: false, fhl: '帖後', hub: '2_thessalonians', cut: '114Thessalonians2.htm', bro: 'the-second-epistle-of-paul-to-the-thessalonians' },
	{ code: 54, name: '提摩太前書', abbr: '提前', chapters: 6,   ot: false, fhl: '提前', hub: '1_timothy',        cut: '115Timothy1.htm',       bro: 'the-first-epistle-of-paul-to-timothy' },
	{ code: 55, name: '提摩太後書', abbr: '提後', chapters: 4,   ot: false, fhl: '提後', hub: '2_timothy',        cut: '116Timothy2.htm',       bro: 'the-second-epistle-of-paul-to-timothy' },
	{ code: 56, name: '提多書',     abbr: '多',   chapters: 3,   ot: false, fhl: '多',   hub: 'titus',            cut: '117Titus.htm',          bro: 'the-epistle-of-paul-to-titus' },
	{ code: 57, name: '腓利門書',   abbr: '門',   chapters: 1,   ot: false, fhl: '門',   hub: 'philemon',         cut: '118Philemon.htm',       bro: 'the-epistle-of-paul-to-philemon' },
	{ code: 58, name: '希伯來書',   abbr: '來',   chapters: 13,  ot: false, fhl: '來',   hub: 'hebrews',          cut: '119Hebrews.htm',        bro: 'the-epistle-to-the-hebrews' },
	{ code: 59, name: '雅各書',     abbr: '雅',   chapters: 5,   ot: false, fhl: '雅',   hub: 'james',            cut: '120James.htm',          bro: 'the-epistle-of-james' },
	{ code: 60, name: '彼得前書',   abbr: '彼前', chapters: 5,   ot: false, fhl: '彼前', hub: '1_peter',          cut: '121Peter1.htm',         bro: 'the-first-epistle-of-peter' },
	{ code: 61, name: '彼得後書',   abbr: '彼後', chapters: 3,   ot: false, fhl: '彼後', hub: '2_peter',          cut: '122Peter2.htm',         bro: 'the-second-epistle-of-peter' },
	{ code: 62, name: '約翰壹書',   abbr: '約壹', chapters: 5,   ot: false, fhl: '約一', hub: '1_john',           cut: '123John1.htm',          bro: 'the-first-epistle-of-john' },
	{ code: 63, name: '約翰貳書',   abbr: '約貳', chapters: 1,   ot: false, fhl: '約二', hub: '2_john',           cut: '124John2.htm',          bro: 'the-second-epistle-of-john' },
	{ code: 64, name: '約翰參書',   abbr: '約參', chapters: 1,   ot: false, fhl: '約三', hub: '3_john',           cut: '125John3.htm',          bro: 'the-third-epistle-of-john' },
	{ code: 65, name: '猶大書',     abbr: '猶',   chapters: 1,   ot: false, fhl: '猶',   hub: 'jude',             cut: '126Jude.htm',           bro: 'the-epistle-of-jude' },
	{ code: 66, name: '啟示錄',     abbr: '啟',   chapters: 22,  ot: false, fhl: '啟',   hub: 'revelation',       cut: '127Revelation.htm',     bro: 'revelation' },
];

var BOOK_BY_CODE = {};
BOOKS.forEach(function (b) { BOOK_BY_CODE[b.code] = b; });

/* 縮寫 → 書卷，最長優先（約壹 要先於 約、撒上 要先於 撒） */
var BOOK_BY_ABBR = {};
BOOKS.forEach(function (b) { BOOK_BY_ABBR[b.abbr] = b; });

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { BOOKS: BOOKS, BOOK_BY_CODE: BOOK_BY_CODE, BOOK_BY_ABBR: BOOK_BY_ABBR };
}
