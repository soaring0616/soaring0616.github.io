/* 恢復本 API 包裝：以「章」為單位快取（in-memory Map + localStorage） */
'use strict';

(function (root) {
  var BASE = 'https://www.recoveryversion.com.tw/api/';
  var LS_PREFIX = 'rvx1:';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; /* 30 天 */

  var mem = new Map(); /* key → Promise（含進行中的請求，去重用） */

  function lsGet(key, allowExpired) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!allowExpired && Date.now() - obj.t > TTL_MS) return null;
      return obj.d;
    } catch (e) { return null; }
  }

  function lsSet(key, data) {
    var val = JSON.stringify({ t: Date.now(), d: data });
    try {
      localStorage.setItem(LS_PREFIX + key, val);
    } catch (e) {
      /* 空間不足：刪最舊 20 筆再試一次 */
      try {
        var entries = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(LS_PREFIX) === 0) {
            var t = 0;
            try { t = JSON.parse(localStorage.getItem(k)).t || 0; } catch (e2) {}
            entries.push([t, k]);
          }
        }
        entries.sort(function (a, b) { return a[0] - b[0]; });
        entries.slice(0, 20).forEach(function (p) { localStorage.removeItem(p[1]); });
        localStorage.setItem(LS_PREFIX + key, val);
      } catch (e3) { /* 放棄持久化，僅記憶體快取 */ }
    }
  }

  function fetchWithTimeout(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 10000);
    return fetch(url, { signal: ctrl.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  /* 取資料：記憶體 → localStorage → 網路（失敗重試一次 → 過期快取墊底） */
  function cachedFetch(key, url, transform) {
    if (mem.has(key)) return mem.get(key);
    var stored = lsGet(key, false);
    if (stored !== null) {
      var p0 = Promise.resolve(stored);
      mem.set(key, p0);
      return p0;
    }
    var p = fetchWithTimeout(url)
      .catch(function () { return fetchWithTimeout(url); })
      .then(function (json) {
        if (!Array.isArray(json)) throw new Error('unexpected response');
        var data = transform(json);
        lsSet(key, data);
        return data;
      })
      .catch(function (err) {
        mem.delete(key); /* 失敗不留在記憶體，之後可重試 */
        var stale = lsGet(key, true);
        if (stale !== null) {
          err.staleData = stale;
        }
        throw err;
      });
    mem.set(key, p);
    return p;
  }

  /* → { "16": "神愛世人…", ... }（節號 → 經文） */
  function getChapterVerses(b, c) {
    var url = BASE + 'getVerses?VERSION=1&output[]=content&output[]=segment_code'
      + '&chapter_code=' + b + '&section_code=' + c + '&ORDER=segment_code';
    return cachedFetch('verses:' + b + '.' + c, url, function (rows) {
      var map = {};
      rows.forEach(function (r) {
        if (r.segment_code > 0) map[r.segment_code] = r.content;
      });
      return map;
    });
  }

  /* → { "1": [{beaded:"a", content:"約七50…"}], ... }（節號 → 串珠列） */
  function getChapterFoots(b, c) {
    var url = BASE + 'getFoots?VERSION=1&chapter_code=' + b + '&section_code=' + c;
    return cachedFetch('foots:' + b + '.' + c, url, function (rows) {
      var map = {};
      rows.forEach(function (r) {
        (map[r.segment_code] = map[r.segment_code] || []).push({
          beaded: r.beaded, content: r.beaded_content,
        });
      });
      return map;
    });
  }

  /* → { "16": [{num:1, content:"直譯，…"}], ... }（節號 → 註解列） */
  function getChapterFootnotes(b, c) {
    var url = BASE + 'getFootnotes?VERSION=1&chapter_code=' + b + '&section_code=' + c;
    return cachedFetch('notes:' + b + '.' + c, url, function (rows) {
      var map = {};
      rows.forEach(function (r) {
        (map[r.segment_code] = map[r.segment_code] || []).push({
          num: r.note_num, content: r.note_content,
        });
      });
      return map;
    });
  }

  var api = {
    getChapterVerses: getChapterVerses,
    getChapterFoots: getChapterFoots,
    getChapterFootnotes: getChapterFootnotes,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RVApi = api;
})(typeof window !== 'undefined' ? window : this);
