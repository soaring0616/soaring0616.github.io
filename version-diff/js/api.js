/*
	經文來源：兩邊都「現取現用」，repo 裡不存任何經文
	------------------------------------------------
	  恢復本  → 台灣福音書房「網上聖經恢復本」公開 API（CORS 開放，crossref/ 也是用這組）
	  和合本  → 信望愛 bible.fhl.net 的 qb.php JSON API（和合本 version=unv）

	兩邊都以「章」為單位抓，存在 localStorage 快取 30 天，和 crossref/js/api.js 同一套做法。

	※ 信望愛那支 API 回傳的資料我確認過格式正確，但它是否開放跨網域（CORS）我沒有
	  在瀏覽器裡實測過。若瀏覽器擋下來，getUnvChapter() 會 reject，介面會改成只顯示
	  恢復本一欄＋每節一顆「在信望愛開啟」的按鈕，不會整頁壞掉。
*/
'use strict';

(function (root) {

	var RV_BASE = 'https://www.recoveryversion.com.tw/api/';
	var FHL_JSON = 'https://bible.fhl.net/json/';
	var LS_PREFIX = 'vdx1:';
	var TTL_MS = 30 * 24 * 60 * 60 * 1000; /* 30 天 */
	var TIMEOUT_MS = 10000;

	var mem = new Map(); /* key → Promise，順便讓同時發出的同一請求去重 */

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
			/* 空間不足：丟掉最舊的 20 筆再試一次 */
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
			} catch (e3) { /* 放棄持久化，只留記憶體快取 */ }
		}
	}

	/* 信望愛的 API 出錯時回的是 HTTP 200 加上 status:"Fail:…"，所以要自己檢查 */
	function requireSuccess(json) {
		if (!json || typeof json !== 'object') throw new Error('unexpected response');
		if (typeof json.status === 'string' && json.status.indexOf('Fail') === 0) {
			throw new Error(json.status);
		}
		return json;
	}

	function fetchJson(url) {
		var ctrl = new AbortController();
		var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
		return fetch(url, { signal: ctrl.signal })
			.then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status);
				return res.json();
			})
			.finally(function () { clearTimeout(timer); });
	}

	/* 記憶體 → localStorage → 網路（失敗重試一次；再失敗時把過期快取附在錯誤上當墊底） */
	function cachedFetch(key, url, transform) {
		if (mem.has(key)) return mem.get(key);
		var stored = lsGet(key, false);
		if (stored !== null) {
			var hit = Promise.resolve(stored);
			mem.set(key, hit);
			return hit;
		}
		var p = fetchJson(url)
			.catch(function () { return fetchJson(url); })
			.then(function (json) {
				var data = transform(json);
				if (!data || !Object.keys(data).length) throw new Error('empty response');
				lsSet(key, data);
				return data;
			})
			.catch(function (err) {
				mem.delete(key); /* 失敗不留在記憶體，之後還能重試 */
				var stale = lsGet(key, true);
				if (stale !== null) err.staleData = stale;
				throw err;
			});
		mem.set(key, p);
		return p;
	}

	/* 恢復本一整章 → { "15": "經文…", … }（節號 → 經文；詩篇題記是 segment_code 0，略過） */
	function getRcvChapter(code, chapter) {
		var url = RV_BASE + 'getVerses?VERSION=1&output[]=content&output[]=segment_code'
			+ '&chapter_code=' + code + '&section_code=' + chapter + '&ORDER=segment_code';
		return cachedFetch('rcv:' + code + '.' + chapter, url, function (rows) {
			var map = {};
			if (!Array.isArray(rows)) throw new Error('unexpected response');
			rows.forEach(function (r) {
				if (r.segment_code > 0) map[r.segment_code] = String(r.content || '');
			});
			return map;
		});
	}

	/* 恢復本註解（有些差異的原因直接寫在註解裡，面板要用） */
	function getRcvFootnotes(code, chapter) {
		var url = RV_BASE + 'getFootnotes?VERSION=1&chapter_code=' + code + '&section_code=' + chapter;
		return cachedFetch('note:' + code + '.' + chapter, url, function (rows) {
			var map = {};
			if (!Array.isArray(rows)) throw new Error('unexpected response');
			rows.forEach(function (r) {
				(map[r.segment_code] = map[r.segment_code] || []).push({
					num: r.note_num, content: String(r.note_content || ''),
				});
			});
			return map;
		});
	}

	/* 和合本一整章 → { "15": "經文…", … } */
	function getUnvChapter(book, chapter) {
		var url = FHL_JSON + 'qb.php?chineses=' + encodeURIComponent(book.fhl)
			+ '&chap=' + chapter + '&version=unv&gb=0';
		return cachedFetch('unv:' + book.code + '.' + chapter, url, function (json) {
			var rows = requireSuccess(json).record;
			if (!Array.isArray(rows)) throw new Error('unexpected response');
			var map = {};
			rows.forEach(function (r) {
				if (r.sec > 0) map[r.sec] = String(r.bible_text || '');
			});
			return map;
		});
	}

	/*
		原文字彙分析（信望愛 qp.php）→ 一節的逐字原文
		  { n: 0 新約希臘文 / 1 舊約希伯來文,
		    literal: '原文直譯',
		    words: [{ wid, word, sn, pro, wform, orig, exp, remark }, …] }

		wid=0 那筆是整節的表頭（word = 整節原文、exp = 原文直譯），
		wid>=1 才是一個字一筆。每個字自帶中文解釋 exp，
		所以滑過去顯示解釋不需要再發請求。
	*/
	function getParsing(book, chapter, verse) {
		var url = FHL_JSON + 'qp.php?engs=' + encodeURIComponent(book.engs)
			+ '&chap=' + chapter + '&sec=' + verse + '&gb=0';
		return cachedFetch('qp:' + book.code + '.' + chapter + '.' + verse, url, function (json) {
			var rows = requireSuccess(json).record;
			if (!Array.isArray(rows) || !rows.length) throw new Error('unexpected response');
			var out = { n: Number(json.N) || 0, literal: '', words: [] };
			rows.forEach(function (r) {
				if (Number(r.wid) === 0) {
					out.literal = String(r.exp || '');
					return;
				}
				out.words.push({
					wid: Number(r.wid),
					word: String(r.word || ''),
					sn: String(r.sn || ''),
					pro: String(r.pro || ''),
					wform: String(r.wform || ''),
					orig: String(r.orig || ''),
					exp: String(r.exp || ''),
					remark: String(r.remark || ''),
				});
			});
			if (!out.words.length) throw new Error('no words');
			return out;
		});
	}

	/*
		原文字典（信望愛 sd.php）→ 一個 Strong's 編號的完整解釋
		  { sn, orig, zh: 中文詞條, en: 英文詞條, same: [同源字] }
		N：0 = 新約希臘文、1 = 舊約希伯來文（和 getParsing 回的 n 一致）。

		只用 sd.php。另外兩支中文字典 sbdag.php / stwcbhdic.php 在信望愛的
		說明裡註明僅授權該站使用，所以這裡不碰。
	*/
	function getStrong(n, sn) {
		var url = FHL_JSON + 'sd.php?N=' + (n ? 1 : 0) + '&k=' + encodeURIComponent(sn) + '&gb=0';
		return cachedFetch('sd:' + (n ? 1 : 0) + '.' + sn, url, function (json) {
			var rows = requireSuccess(json).record;
			if (!Array.isArray(rows) || !rows.length) throw new Error('not found');
			var r = rows[0];
			return {
				sn: String(r.sn || sn),
				orig: String(r.orig || ''),
				zh: String(r.dic_text || ''),
				en: String(r.edic_text || ''),
				same: Array.isArray(r.same) ? r.same.map(function (c) {
					return {
						word: String(c.word || ''), csn: String(c.csn || ''),
						ccnt: c.ccnt, cexp: String(c.cexp || ''),
					};
				}) : [],
			};
		});
	}

	var api = {
		getRcvChapter: getRcvChapter,
		getRcvFootnotes: getRcvFootnotes,
		getUnvChapter: getUnvChapter,
		getParsing: getParsing,
		getStrong: getStrong,
	};
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	else root.VDApi = api;

})(typeof window !== 'undefined' ? window : this);
