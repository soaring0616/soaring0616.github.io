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

	/* ---------- 原文逐字 ---------- */

	/*
		一個原文字。滑過去（或用鍵盤 focus）就顯示字根、詞性、語法分析和中文解釋 ──
		這些 qp.php 一次就全給了，不必再發請求。
		點下去才去查原文字典（sd.php），拿完整的中文與英文詞條。
	*/
	function wordChip(w, n, onPick) {
		var chip = el('button', 'ow');
		chip.type = 'button';
		chip.appendChild(el('span', 'ow-word', w.word));

		var tip = el('span', 'ow-tip');
		if (w.orig && w.orig !== w.word) tip.appendChild(el('span', 'ow-lemma', w.orig));
		var gram = [w.pro, w.wform].filter(Boolean).join('　');
		if (gram) tip.appendChild(el('span', 'ow-gram', gram));
		if (w.exp) tip.appendChild(el('span', 'ow-exp', w.exp));
		if (w.sn) tip.appendChild(el('span', 'ow-sn', (n ? 'H' : 'G') + w.sn.replace(/^0+/, '')));
		chip.appendChild(tip);

		/* 滑鼠不在時，螢幕閱讀器與無 hover 的裝置還是要讀得到 */
		chip.setAttribute('aria-label', [w.word, w.orig, gram, w.exp].filter(Boolean).join('，'));
		chip.title = '';

		chip.addEventListener('click', function () { onPick(w, chip); });
		return chip;
	}

	/* 原文字典的內容：中文、英文各一塊，可切換 */
	function renderLexicon(box, w, entry, n) {
		box.textContent = '';

		var head = el('div', 'lex-head');
		head.appendChild(el('span', 'lex-orig', entry.orig || w.orig || w.word));
		if (w.sn) head.appendChild(el('span', 'lex-sn', (n ? 'H' : 'G') + w.sn.replace(/^0+/, '')));
		var gram = [w.pro, w.wform].filter(Boolean).join('　');
		if (gram) head.appendChild(el('span', 'lex-gram', gram));
		box.appendChild(head);

		var hasZh = !!entry.zh, hasEn = !!entry.en;
		var bodyZh = el('pre', 'lex-body', entry.zh);
		var bodyEn = el('pre', 'lex-body', entry.en);
		bodyEn.hidden = true;

		if (hasZh && hasEn) {
			var tabs = el('div', 'lex-tabs');
			var bZh = el('button', 'lex-tab is-on', '中文');
			var bEn = el('button', 'lex-tab', 'English');
			bZh.type = bEn.type = 'button';
			function pick(zh) {
				bodyZh.hidden = !zh;
				bodyEn.hidden = zh;
				bZh.className = 'lex-tab' + (zh ? ' is-on' : '');
				bEn.className = 'lex-tab' + (zh ? '' : ' is-on');
			}
			bZh.addEventListener('click', function () { pick(true); });
			bEn.addEventListener('click', function () { pick(false); });
			tabs.appendChild(bZh);
			tabs.appendChild(bEn);
			box.appendChild(tabs);
		}

		if (hasZh) box.appendChild(bodyZh);
		if (hasEn) box.appendChild(bodyEn);
		if (!hasZh && !hasEn) box.appendChild(el('p', 'hint', '這個編號在原文字典裡沒有詞條。'));

		if (entry.same && entry.same.length) {
			var d = el('details', 'lex-same');
			d.appendChild(el('summary', null, '同源字（' + entry.same.length + '）'));
			var ul = el('ul');
			entry.same.forEach(function (c) {
				var li = el('li');
				li.appendChild(el('span', 'lex-orig small', c.word));
				if (c.cexp) li.appendChild(el('span', 'note-text', c.cexp));
				if (c.ccnt != null) li.appendChild(el('span', 'lex-gram', '出現 ' + c.ccnt + ' 次'));
				ul.appendChild(li);
			});
			d.appendChild(ul);
			box.appendChild(d);
		}

		box.appendChild(el('p', 'fineprint', '原文字彙分析與原文字典：信望愛聖經工具'));
		box.hidden = false;
	}

	/* 一節的原文區塊，第一次展開時才去抓 */
	function originalBlock(book, chapter, v) {
		var panel = el('div', 'orig-panel');
		panel.hidden = true;
		var loaded = false;

		panel.load = function () {
			if (loaded) return;
			loaded = true;
			panel.appendChild(el('p', 'hint', '讀取原文…'));

			VDApi.getParsing(book, chapter, v).then(function (data) {
				panel.textContent = '';

				if (data.literal) {
					var lit = el('p', 'orig-literal');
					lit.appendChild(el('span', 'ver-label', '原文直譯'));
					lit.appendChild(el('span', null, data.literal));
					panel.appendChild(lit);
				}

				var row = el('div', 'orig-words' + (data.n ? ' rtl' : ''));
				if (data.n) row.dir = 'rtl';

				var box = el('div', 'lex-box');
				box.hidden = true;
				var current = null;

				function pick(w, chip) {
					/* 再點同一個字就收起來 */
					if (current === chip && !box.hidden) {
						box.hidden = true;
						chip.classList.remove('is-on');
						current = null;
						return;
					}
					row.querySelectorAll('.ow.is-on').forEach(function (c) { c.classList.remove('is-on'); });
					chip.classList.add('is-on');
					current = chip;

					box.textContent = '';
					box.appendChild(el('p', 'hint', '查字典…'));
					box.hidden = false;

					if (!w.sn) {
						box.textContent = '';
						box.appendChild(el('p', 'hint', '這個字沒有 Strong\u2019s 編號。'));
						return;
					}
					VDApi.getStrong(data.n, w.sn).then(function (entry) {
						if (current !== chip) return; /* 期間換了字就不要蓋掉 */
						renderLexicon(box, w, entry, data.n);
					}).catch(function (err) {
						if (current !== chip) return;
						box.textContent = '';
						box.appendChild(el('p', 'hint', '查不到字典詞條（' + err.message + '）。'));
					});
				}

				data.words.forEach(function (w) { row.appendChild(wordChip(w, data.n, pick)); });
				panel.appendChild(row);
				panel.appendChild(el('p', 'hint', '滑過或用鍵盤移到任一個字看詞性與解釋，點下去查完整的原文字典。'));
				panel.appendChild(box);

			}).catch(function (err) {
				panel.textContent = '';
				var msg = el('p', 'hint', '讀不到原文（' + err.message + '）。');
				panel.appendChild(msg);
				var a = el('a', 'src-link', '改在信望愛開啟');
				a.href = Sources.fhl(book, chapter, v);
				a.target = '_blank';
				a.rel = 'noopener';
				panel.appendChild(a);
				loaded = false; /* 允許再試一次 */
			});
		};

		return panel;
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

		wrap.appendChild(head);

		var segs = both ? VDDiff.diffChars(unvText, rcvText, state.ignorePunct) : null;

		var cols = el('div', 'cols');
		cols.appendChild(diffLine('和合本', unvText, segs, 'unv'));
		cols.appendChild(diffLine('恢復本', rcvText, segs, 'rcv'));
		wrap.appendChild(cols);

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

		var orig = originalBlock(book, chapter, v);
		wrap.appendChild(orig);

		var links = el('nav', 'links');

		/* 原文就在頁面上展開，不用跳出去 */
		var origBtn = el('button', 'src-link orig-toggle', '原文逐字');
		origBtn.type = 'button';
		origBtn.setAttribute('aria-expanded', 'false');
		origBtn.title = '在這一頁展開這節的原文，每個字可看解釋';
		origBtn.addEventListener('click', function () {
			var open = orig.hidden;
			orig.hidden = !open;
			origBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
			origBtn.classList.toggle('is-on', open);
			if (open) orig.load();
		});
		links.appendChild(origBtn);

		Sources.linksFor(book, chapter, v).forEach(function (l) {
			var a = el('a', 'src-link', l.label);
			a.href = l.href;
			a.target = '_blank';
			a.rel = 'noopener';
			a.title = l.title;
			links.appendChild(a);
		});

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
