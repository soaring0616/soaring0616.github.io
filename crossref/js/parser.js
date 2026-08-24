/* 恢復本串珠（beaded_content）解析器
 * 輸入如「約七50，十九39」「利一9，12」「參創一26，27」「伯三八31～33」
 * 輸出 {refs:[{b,c,v,vEnd?,cf?,text}], unparsed:[...]}
 * 上下文規則：token 未寫書卷則沿用前一個書卷；未寫章則沿用前一個章。
 */
'use strict';

(function (root) {
  var books = (typeof module !== 'undefined' && module.exports)
    ? require('./books.js')
    : { ABBR_LIST: root.ABBR_LIST, BOOK_BY_CODE: root.BOOK_BY_CODE };

  var DIGITS = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  var ZEROS = { '○': 0, '〇': 0 };
  var NUM_CHARS = '一二三四五六七八九○〇十廿卅百';

  /* 從 str[pos] 起掃描最長中文數字，回 {value,nextPos} 或 null。
   * 支援兩種寫法（串珠資料中並存）：
   *  - 十進式：十=10 十九=19 二十=20 廿一=21 一百五十=150
   *  - 逐位式：三八=38 五一=51 一○四=104 一三九=139 */
  function scanChineseNum(str, pos) {
    var end = pos;
    while (end < str.length && NUM_CHARS.indexOf(str[end]) !== -1) end++;
    if (end === pos) return null;
    var run = str.slice(pos, end);
    var val = interpretNum(run);
    if (val === null) return null;
    return { value: val, nextPos: end };
  }

  function interpretNum(run) {
    if (/[十廿卅百]/.test(run)) return interpretTraditional(run);
    var val = 0;
    for (var i = 0; i < run.length; i++) {
      var d = (run[i] in DIGITS) ? DIGITS[run[i]] : (run[i] in ZEROS ? 0 : null);
      if (d === null) return null;
      val = val * 10 + d;
    }
    return val > 0 ? val : null;
  }

  function interpretTraditional(run) {
    var i = 0, val = 0, d;
    if (i + 1 < run.length && run[i] in DIGITS && run[i + 1] === '百') {
      val += DIGITS[run[i]] * 100; i += 2;
    } else if (run[i] === '百') {
      val += 100; i += 1;
    }
    if (i + 1 < run.length && run[i] in DIGITS && run[i + 1] === '十') {
      val += DIGITS[run[i]] * 10; i += 2;
    } else if (run[i] === '十') {
      val += 10; i += 1;
    } else if (run[i] === '廿') {
      val += 20; i += 1;
    } else if (run[i] === '卅') {
      val += 30; i += 1;
    }
    if (i < run.length && run[i] in DIGITS) {
      val += DIGITS[run[i]]; i += 1;
    }
    if (i !== run.length || val === 0) return null;
    return val;
  }

  /* 節數（阿拉伯數字），可帶範圍與半節標記：50 / 14～16 / 10上 / 1下～4 / 36～四2（跨章範圍只取起點） */
  var VERSE_RE = /^(\d+)[上下]?(?:[～~\-—–]([一二三四五六七八九○〇十廿卅百]*)(\d+)[上下]?)?$/;

  function parseBeaded(str, srcBook, srcChapter) {
    var refs = [], unparsed = [];
    var ctx = { book: srcBook || null, chapter: srcChapter || null };
    /* 括號視為分隔（「78（臨到眷顧）」「約壹四2（參約壹四3）」） */
    var tokens = String(str || '').replace(/[（）()]/g, '，').split(/[，、；,;]/);

    for (var ti = 0; ti < tokens.length; ti++) {
      var raw = tokens[ti];
      var t = raw.replace(/[\s。．.]+$/g, '').replace(/^\s+/, '');
      if (!t) continue;

      /* 平行經文映射「1～17：申五4～21」→ 只取冒號右側 */
      var colon = t.lastIndexOf('：');
      if (colon !== -1) t = t.slice(colon + 1);
      /* 「羅十7與註1」→ 去掉註解後綴 */
      t = t.replace(/與?註\d*$/, '');
      if (!t) continue;

      var cf = false;
      if (t[0] === '參') { cf = true; t = t.slice(1); }

      var pos = 0, bookMatched = null;
      for (var bi = 0; bi < books.ABBR_LIST.length; bi++) {
        var b = books.ABBR_LIST[bi];
        if (t.lastIndexOf(b.abbr, 0) === 0) { bookMatched = b; break; }
      }
      if (bookMatched) {
        ctx.book = bookMatched.code;
        ctx.chapter = null;
        pos = bookMatched.abbr.length;
      }

      var num = scanChineseNum(t, pos);
      if (num) {
        ctx.chapter = num.value;
        pos = num.nextPos;
      } else if (bookMatched && bookMatched.chapters === 1) {
        ctx.chapter = 1;  /* 單章書可省略章數，如「猶4」 */
      }

      var m = VERSE_RE.exec(t.slice(pos));
      if (!m || ctx.book === null || ctx.chapter === null) {
        unparsed.push(raw.trim());
        continue;
      }
      var ref = {
        b: ctx.book, c: ctx.chapter, v: parseInt(m[1], 10),
        text: raw.trim(),
      };
      if (m[3] && !m[2]) ref.vEnd = parseInt(m[3], 10);
      if (cf) ref.cf = true;
      refs.push(ref);
    }
    return { refs: refs, unparsed: unparsed };
  }

  function selfTest() {
    var cases = [
      /* [beaded_content, srcBook, srcChapter, expected refs as "b.c.v"] */
      ['約七50，十九39', 43, 3, ['43.7.50', '43.19.39']],
      ['林前十五45', 1, 2, ['46.15.45']],
      ['利一9，12', 3, 1, ['3.1.9', '3.1.12']],
      ['伯三八31～33', 18, 38, ['18.38.31']],
      ['詩一○四14，一四五15，16', 1, 9, ['19.104.14', '19.145.15', '19.145.16']],
      ['猶4', 66, 1, ['65.1.4']],
      ['參創一26，27', 1, 1, ['1.1.26', '1.1.27']],
      ['約壹三2～3', 18, 42, ['62.3.2']],
      ['何一10，林後六18，約一12，約壹三1，羅八14～16', 45, 8,
        ['28.1.10', '47.6.18', '43.1.12', '62.3.1', '45.8.14']],
      ['箴二十27', 38, 12, ['20.20.27']],
      ['耶五一15', 38, 12, ['24.51.15']],
      ['代下三六16', 40, 23, ['14.36.16']],
      ['王下二20，21', 3, 2, ['12.2.20', '12.2.21']],
      ['啟二一10', 1, 1, ['66.21.10']],
      ['出二五9，四十2，啟七15，十三6', 66, 21, ['2.25.9', '2.40.2', '66.7.15', '66.13.6']],
      ['撒上十六7', 1, 1, ['9.16.7']],
      ['創九3，詩一○四14', 1, 9, ['1.9.3', '19.104.14']],
      ['太二三37', 24, 1, ['40.23.37']],
      ['帖前五23', 1, 2, ['52.5.23']],
      ['創五2，太十九4，可十6，參創二18，21～23', 40, 19,
        ['1.5.2', '40.19.4', '41.10.6', '1.2.18', '1.2.21']],
    ];
    var pass = 0, fail = 0;
    cases.forEach(function (c) {
      var got = parseBeaded(c[0], c[1], c[2]).refs.map(function (r) {
        return r.b + '.' + r.c + '.' + r.v;
      });
      var ok = JSON.stringify(got) === JSON.stringify(c[3]);
      if (ok) { pass++; }
      else {
        fail++;
        console.error('[parser selfTest] FAIL:', c[0], 'got', got, 'want', c[3]);
      }
    });
    console.log('[parser selfTest] ' + pass + ' passed, ' + fail + ' failed');
    return fail === 0;
  }

  var api = { parseBeaded: parseBeaded, scanChineseNum: scanChineseNum, selfTest: selfTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RVParser = api;
})(typeof window !== 'undefined' ? window : this);
