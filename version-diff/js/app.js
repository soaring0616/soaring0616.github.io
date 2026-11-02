/*
	版本對讀 — 介面
	----------------
	一次做三件事：
	  1. 對讀某一章：兩欄並排，逐字標出不一樣的地方
	  2. 掃描整卷：把整卷有差異的節一次列出來（這是「依卷書列出不一樣的地方」的主力）
	  3. 我的記錄：data/diffs.js 裡自己寫下的觀察，會掛在對應的節上
*/
'use strict';

(function () {

	var $ = function (id) { return document.getElementById(id); };

	var els = {
		book: $('sel-book'), chapter: $('sel-chapter'), go: $('btn-go'),
		scan: $('btn-scan'), onlyDiff: $('chk-only-diff'), ignorePunct: $('chk-ignore-punct'),
		status: $('status'), summary: $('summary'), verses: $('verses'),
		progress: $('progress'), progressBar: $('progress-bar'),
		progressText: $('progress-text'), cancel: $('btn-cancel'),
		notesPanel: $('notes-panel'), notesList: $('notes-list'), notesCount: $('notes-count'),
	};

	var state = {
		book: BOOK_BY_CODE[49],   /* 預設以弗所書 */
		chapter: 4,
		onlyDiff: true,
		ignorePunct: true,
		scanning: false,
		cancelled: false,
	};

	/* ---------- 小工具 ---------- */

	function el(tag, cls, text) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	function setStatus(msg, kind) {
		els.status.textContent = msg || '';
		els.status.className = 'status' + (kind ? ' ' + kind : '');
		els.status.hidden = !msg;
	}

	function verseNums(unv, rcv) {
		var set = {};
		Object.keys(unv || {}).forEach(function (k) { set[k] = true; });
		Object.keys(rcv || {}).forEach(function (k) { set[k] = true; });
		return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
	}

	/* ---------- 記錄（data/diffs.js） ---------- */

	function noteFor(code, chapter, verse) {
		if (typeof DIFF_NOTES === 'undefined') return null;
		for (var i = 0; i < DIFF_NOTES.length; i++) {
			var n = DIFF_NOTES[i];
			if (n.code === code && n.chapter === chapter && n.verse === verse) return n;
		}
		return null;
	}

	function renderNotesPanel() {
		if (typeof DIFF_NOTES === 'undefined' || !DIFF_NOTES.length) {
			els.notesPanel.hidden = true;
			return;
		}
		els.notesCount.textContent = DIFF_NOTES.length;
		els.notesList.textContent = '';

		var byBook = {};
		DIFF_NOTES.forEach(function (n) { (byBook[n.code] = byBook[n.code] || []).push(n); });

		Object.keys(byBook).map(Number).sort(function (a, b) { return a - b; }).forEach(function (code) {
			var book = BOOK_BY_CODE[code];
			if (!book) return;
			var group = el('div', 'note-group');
			group.appendChild(el('h3', null, book.name));
			var ul = el('ul');
			byBook[code]
				.slice()
				.sort(function (a, b) { return a.chapter - b.chapter || a.verse - b.verse; })
				.forEach(function (n) {
					var li = el('li');
					var a = el('a', 'note-ref', book.abbr + ' ' + n.chapter + ':' + n.verse);
					a.href = '#' + code + '.' + n.chapter + '.' + n.verse;
					li.appendChild(a);
					if (n.tag) li.appendChild(el('span', 'tag', n.tag));
					if (n.note) li.appendChild(el('span', 'note-text', n.note));
					ul.appendChild(li);
				});
			group.appendChild(ul);
			els.notesList.appendChild(group);
		});
		els.notesPanel.hidden = false;
	}

	/* ---------- 下拉選單 ---------- */

	function fillBooks() {
		[['舊約', true], ['新約', false]].forEach(function (pair) {
			var g = el('optgroup');
			g.label = pair[0];
			BOOKS.filter(function (b) { return b.ot === pair[1]; }).forEach(function (b) {
				var o = el('option', null, b.name);
				o.value = b.code;
				g.appendChild(o);
			});
			els.book.appendChild(g);
		});
	}

	function fillChapters() {
		var cur = state.chapter;
		els.chapter.textContent = '';
		for (var c = 1; c <= state.book.chapters; c++) {
			var o = el('option', null, '第 ' + c + ' 章');
			o.value = c;
			els.chapter.appendChild(o);
		}
		state.chapter = Math.min(cur, state.book.chapters) || 1;
		els.chapter.value = state.chapter;
	}

	function syncControls() {
		els.book.value = state.book.code;
		fillChapters();
		els.onlyDiff.checked = state.onlyDiff;
		els.ignorePunct.checked = state.ignorePunct;
		els.scan.textContent = '掃描' + state.book.name + '整卷';
	}

	/* ---------- 一節的呈現 ---------- */

	/*
		一節的一欄。segs 是「整節只算一次」的 diffChars(和合本, 恢復本) 結果，
		兩欄共用同一份，所以左右兩邊標出來的一定是同一組差異。

		side = 'unv' → 顯示 same / del（標色）/ puncta
		side = 'rcv' → 顯示 same / ins（標色）/ punctb
	*/
	function diffLine(label, text, segs, side) {
		var row = el('div', 'col');
		row.appendChild(el('span', 'ver-label', label));
		var body = el('span', 'ver-text');

		if (text == null) {
			body.appendChild(el('em', 'missing', '（此版本無此節）'));
			row.appendChild(body);
			return row;
		}
		if (!segs) {
			/* 另一邊沒有資料可比，就原樣顯示 */
			body.textContent = text;
			row.appendChild(body);
			return row;
		}

		var mark = side === 'unv' ? 'del' : 'ins';
		var punct = side === 'unv' ? 'puncta' : 'punctb';

		segs.forEach(function (sg) {
			if (sg.type === 'same' || sg.type === punct) {
				body.appendChild(document.createTextNode(sg.text));
			} else if (sg.type === mark) {
				body.appendChild(el('mark', mark, sg.text));
			}
			/* 其餘（另一邊獨有的字、另一邊的標點）不出現在這一欄 */
		});
		row.appendChild(body);
		return row;
	}

	function verseBlock(book, chapter, v, unvText, rcvText, footnotes) {
		var wrap = el('article', 'verse');
		wrap.id = 'v' + v;

		var head = el('header', 'verse-head');
		head.appendChild(el('span', 'num', book.abbr + ' ' + chapter + ':' + v));

		var both = unvText != null && rcvText != null;
		if (!both) {
			head.appendChild(el('span', 'badge warn', unvText == null ? '和合本無此節' : '恢復本無此節'));
			wrap.classList.add('is-diff');
		} else if (VDDiff.differs(unvText, rcvText)) {
			var mag = VDDiff.magnitude(unvText, rcvText);
			head.appendChild(el('span', 'badge diff', mag > 0.25 ? '明顯不同' : '用字不同'));
			wrap.classList.add('is-diff');
		} else {
			head.appendChild(el('span', 'badge same', '相同'));
		}

		var note = noteFor(book.code, chapter, v);
		if (note) head.appendChild(el('span', 'badge noted', '有記錄'));

		wrap.appendChild(head);

		var segs = both ? VDDiff.diffChars(unvText, rcvText, state.ignorePunct) : null;

		var cols = el('div', 'cols');
		cols.appendChild(diffLine('和合本', unvText, segs, 'unv'));
		cols.appendChild(diffLine('恢復本', rcvText, segs, 'rcv'));
		wrap.appendChild(cols);

		if (note) {
			var nb = el('div', 'note-box');
			if (note.tag) nb.appendChild(el('span', 'tag', note.tag));
			if (note.note) nb.appendChild(el('p', null, note.note));
			if (note.original) nb.appendChild(el('p', 'orig', '原文：' + note.original));
			wrap.appendChild(nb);
		}

		/* 恢復本註解常常就解釋了為什麼這樣翻，收在摺疊區 */
		var fns = footnotes && footnotes[v];
		if (fns && fns.length) {
			var d = el('details', 'footnotes');
			d.appendChild(el('summary', null, '恢復本註解（' + fns.length + '）'));
			fns.forEach(function (f) {
				d.appendChild(el('p', null, (f.num ? f.num + '　' : '') + f.content));
			});
			wrap.appendChild(d);
		}

		var links = el('nav', 'links');
		Sources.linksFor(book, chapter, v).forEach(function (l) {
			var a = el('a', 'src-link', l.label);
			a.href = l.href;
			a.target = '_blank';
			a.rel = 'noopener';
			a.title = l.title;
			links.appendChild(a);
		});

		/* 想把這一節記下來時，一鍵複製要貼進 data/diffs.js 的那幾行 */
		var copy = el('button', 'src-link copy', '複製記錄範本');
		copy.type = 'button';
		copy.title = '複製一段可貼進 data/diffs.js 的範本';
		copy.addEventListener('click', function () {
			var ph = (both && VDDiff.differs(unvText, rcvText))
				? VDDiff.phrases(unvText, rcvText, state.ignorePunct)
				: { unv: [], rcv: [] };
			var tpl = '\t{\n'
				+ '\t\tcode: ' + book.code + ', chapter: ' + chapter + ', verse: ' + v
				+ ',  /* ' + book.abbr + ' ' + chapter + ':' + v + ' */\n'
				+ '\t\ttag: \'\',\n'
				+ '\t\tnote: \'\',\n'
				+ '\t\toriginal: \'\',\n'
				+ '\t\t/* 和合本：' + (ph.unv.join('／') || '—') + '\n'
				+ '\t\t   恢復本：' + (ph.rcv.join('／') || '—') + ' */\n'
				+ '\t},';
			var done = function () { copy.textContent = '已複製'; setTimeout(function () { copy.textContent = '複製記錄範本'; }, 1500); };
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(tpl).then(done, function () { window.prompt('複製下面這段：', tpl); });
			} else {
				window.prompt('複製下面這段：', tpl);
			}
		});
		links.appendChild(copy);

		wrap.appendChild(links);
		return wrap;
	}

	/* ---------- 對讀一章 ---------- */

	function loadChapter(book, chapter, focusVerse) {
		setStatus('讀取' + book.name + '第 ' + chapter + ' 章…');
		els.verses.textContent = '';
		els.summary.textContent = '';

		var rcvP = VDApi.getRcvChapter(book.code, chapter);
		var unvP = VDApi.getUnvChapter(book, chapter);
		var fnP = VDApi.getRcvFootnotes(book.code, chapter).catch(function () { return {}; });

		/* 和合本抓不到（例如對方沒開 CORS）也要能看恢復本，所以各自容錯 */
		return Promise.all([
			rcvP.catch(function (e) { return { __error: e }; }),
			unvP.catch(function (e) { return { __error: e }; }),
			fnP,
		]).then(function (res) {
			var rcv = res[0], unv = res[1], footnotes = res[2];
			var rcvErr = rcv && rcv.__error, unvErr = unv && unv.__error;

			if (rcvErr) rcv = (rcvErr.staleData) || null;
			if (unvErr) unv = (unvErr.staleData) || null;

			if (!rcv && !unv) {
				setStatus('兩邊都讀不到。可能是沒有網路，或兩個來源站暫時無法連線。', 'error');
				return;
			}

			var msgs = [];
			if (rcvErr && !rcv) msgs.push('恢復本讀取失敗（' + rcvErr.message + '）');
			if (unvErr && !unv) msgs.push('和合本讀取失敗（' + unvErr.message + '）── 瀏覽器可能擋下了對信望愛的跨網域請求，可以用每節的「信望愛」按鈕自行開啟對照。');
			setStatus(msgs.join('　'), msgs.length ? 'warn' : '');

			var nums = verseNums(unv, rcv);
			var diffCount = 0;
			var frag = document.createDocumentFragment();

			nums.forEach(function (v) {
				var a = unv ? (unv[v] != null ? unv[v] : null) : null;
				var b = rcv ? (rcv[v] != null ? rcv[v] : null) : null;
				var isDiff = (a == null || b == null) ? true : VDDiff.differs(a, b);
				if (isDiff) diffCount++;
				if (state.onlyDiff && !isDiff) return;
				frag.appendChild(verseBlock(book, chapter, v, a, b, footnotes));
			});

			els.verses.appendChild(frag);

			var parts = [book.name + ' 第 ' + chapter + ' 章，共 ' + nums.length + ' 節'];
			if (unv && rcv) parts.push('其中 ' + diffCount + ' 節有差異');
			else parts.push('（只有單邊資料，無法比對）');
			if (state.onlyDiff && unv && rcv) parts.push('目前只顯示有差異的節');
			els.summary.textContent = parts.join('　·　');

			if (state.onlyDiff && diffCount === 0 && unv && rcv) {
				els.verses.appendChild(el('p', 'empty', '這一章兩個版本在用字上沒有差異（已忽略標點）。'));
			}

			if (focusVerse) {
				var target = document.getElementById('v' + focusVerse);
				if (target) {
					target.classList.add('focused');
					target.scrollIntoView({ block: 'center' });
				}
			}
		});
	}

	/* ---------- 掃描整卷 ---------- */

	function scanBook(book) {
		if (state.scanning) return;
		state.scanning = true;
		state.cancelled = false;
		els.scan.disabled = true;
		els.go.disabled = true;
		els.progress.hidden = false;
		els.verses.textContent = '';
		els.summary.textContent = '';
		setStatus('');

		var total = book.chapters;
		var done = 0;
		var findings = [];   /* { chapter, verse, unv, rcv, kind } */
		var failed = [];

		function tick() {
			done++;
			var pct = Math.round(done / total * 100);
			els.progressBar.style.width = pct + '%';
			els.progressText.textContent = '掃描中 ' + done + ' / ' + total + ' 章　（已找到 ' + findings.length + ' 處差異）';
		}

		function oneChapter(c) {
			return Promise.all([
				VDApi.getRcvChapter(book.code, c).catch(function () { return null; }),
				VDApi.getUnvChapter(book, c).catch(function () { return null; }),
			]).then(function (r) {
				var rcv = r[0], unv = r[1];
				if (!rcv || !unv) { failed.push(c); tick(); return; }
				verseNums(unv, rcv).forEach(function (v) {
					var a = unv[v] != null ? unv[v] : null;
					var b = rcv[v] != null ? rcv[v] : null;
					if (a == null || b == null) {
						findings.push({ chapter: c, verse: v, unv: a, rcv: b, kind: 'missing' });
					} else if (VDDiff.differs(a, b)) {
						findings.push({ chapter: c, verse: v, unv: a, rcv: b, kind: 'text' });
					}
				});
				tick();
			});
		}

		/* 同時最多 2 個請求，對兩個來源站客氣一點 */
		var next = 1;
		function worker() {
			if (state.cancelled || next > total) return Promise.resolve();
			var c = next++;
			return oneChapter(c).then(worker);
		}

		return Promise.all([worker(), worker()])
			.then(function () {
				renderScan(book, findings, failed, total);
			})
			.finally(function () {
				state.scanning = false;
				els.scan.disabled = false;
				els.go.disabled = false;
				els.progress.hidden = true;
				els.progressBar.style.width = '0%';
			});
	}

	function renderScan(book, findings, failed, total) {
		els.verses.textContent = '';

		var head = [book.name + ' 全書 ' + total + ' 章'];
		if (state.cancelled) head.push('（掃描已中止，以下是已掃到的部分）');
		head.push('找到 ' + findings.length + ' 處差異');
		els.summary.textContent = head.join('　·　');

		if (failed.length) {
			setStatus('有 ' + failed.length + ' 章讀取失敗，未納入比對：第 ' + failed.sort(function (a, b) { return a - b; }).join('、') + ' 章。', 'warn');
		}

		if (!findings.length) {
			els.verses.appendChild(el('p', 'empty', '沒有找到差異（已忽略標點）。'));
			return;
		}

		var byChapter = {};
		findings.forEach(function (f) { (byChapter[f.chapter] = byChapter[f.chapter] || []).push(f); });

		var frag = document.createDocumentFragment();
		Object.keys(byChapter).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
			var sec = el('section', 'scan-chapter');
			var h = el('h2');
			var link = el('a', null, book.name + ' 第 ' + c + ' 章');
			link.href = '#' + book.code + '.' + c;
			h.appendChild(link);
			h.appendChild(el('span', 'chapter-count', byChapter[c].length + ' 處'));
			sec.appendChild(h);

			var ul = el('ul', 'scan-list');
			byChapter[c].forEach(function (f) {
				var li = el('li');
				var a = el('a', 'note-ref', c + ':' + f.verse);
				a.href = '#' + book.code + '.' + c + '.' + f.verse;
				li.appendChild(a);

				if (f.kind === 'missing') {
					li.appendChild(el('span', 'badge warn', f.unv == null ? '和合本無此節' : '恢復本無此節'));
				} else {
					var ph = VDDiff.phrases(f.unv, f.rcv, state.ignorePunct);
					var pv = el('span', 'phrases');
					pv.appendChild(el('span', 'ph unv', ph.unv.join('／') || '—'));
					pv.appendChild(el('span', 'arrow', '→'));
					pv.appendChild(el('span', 'ph rcv', ph.rcv.join('／') || '—'));
					li.appendChild(pv);
				}
				if (noteFor(book.code, c, f.verse)) li.appendChild(el('span', 'badge noted', '有記錄'));
				ul.appendChild(li);
			});
			sec.appendChild(ul);
			frag.appendChild(sec);
		});
		els.verses.appendChild(frag);
	}

	/* ---------- 網址 hash：#49.4 或 #49.4.15 ---------- */

	function readHash() {
		var m = (location.hash || '').replace(/^#/, '').match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
		if (!m) return null;
		var book = BOOK_BY_CODE[Number(m[1])];
		if (!book) return null;
		var ch = Math.min(Number(m[2]), book.chapters) || 1;
		return { book: book, chapter: ch, verse: m[3] ? Number(m[3]) : null };
	}

	function writeHash(book, chapter, verse) {
		var h = '#' + book.code + '.' + chapter + (verse ? '.' + verse : '');
		if (location.hash !== h) {
			history.replaceState(null, '', h);
		}
	}

	function applyHash() {
		var h = readHash();
		if (!h) return false;
		state.book = h.book;
		state.chapter = h.chapter;
		syncControls();
		loadChapter(h.book, h.chapter, h.verse);
		return true;
	}

	/* ---------- 啟動 ---------- */

	function go() {
		state.book = BOOK_BY_CODE[Number(els.book.value)];
		state.chapter = Number(els.chapter.value);
		writeHash(state.book, state.chapter);
		loadChapter(state.book, state.chapter);
	}

	function init() {
		fillBooks();
		syncControls();
		renderNotesPanel();

		els.book.addEventListener('change', function () {
			state.book = BOOK_BY_CODE[Number(els.book.value)];
			syncControls();
		});
		els.chapter.addEventListener('change', function () {
			state.chapter = Number(els.chapter.value);
		});
		els.go.addEventListener('click', go);

		els.scan.addEventListener('click', function () {
			var book = BOOK_BY_CODE[Number(els.book.value)];
			if (book.chapters > 40 && !window.confirm(
				book.name + '有 ' + book.chapters + ' 章，掃描會對兩個來源站發出約 '
				+ (book.chapters * 2) + ' 個請求，可能要等一兩分鐘。要繼續嗎？\n\n'
				+ '（抓過的章會快取 30 天，第二次就很快。）')) return;
			scanBook(book);
		});

		els.cancel.addEventListener('click', function () {
			state.cancelled = true;
			els.cancel.disabled = true;
			setTimeout(function () { els.cancel.disabled = false; }, 1000);
		});

		els.onlyDiff.addEventListener('change', function () {
			state.onlyDiff = els.onlyDiff.checked;
			if (!state.scanning) loadChapter(state.book, state.chapter);
		});
		els.ignorePunct.addEventListener('change', function () {
			state.ignorePunct = els.ignorePunct.checked;
			if (!state.scanning) loadChapter(state.book, state.chapter);
		});

		window.addEventListener('hashchange', function () {
			if (!state.scanning) applyHash();
		});

		if (!applyHash()) {
			writeHash(state.book, state.chapter);
			loadChapter(state.book, state.chapter);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();

})();
