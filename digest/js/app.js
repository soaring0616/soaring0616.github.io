/* 職事文摘導覽
 *
 * 資料是建置時抓好的（scripts/build_digest_index.py）。
 * ministrydigest.twgbr.org 沒有 API，是純靜態 HTML，而且沒有回
 * Access-Control-Allow-Origin，瀏覽器直抓會被擋，所以一律讀建好的索引。
 *
 * 刻意拆成「輕索引 + 一期一檔」，開頁只讀前兩個（約 86K gzip），
 * 點到哪一期才抓那一期（單檔最大 40K）：
 *   data/index.json       卷期 → 分類 → 篇題、頁碼、錨點、書號
 *   data/books.json       書號、書名、被哪幾期哪幾篇引用（只有 期+錨點）
 *   data/issues/{期}.json 該期每篇的出處書名、篇章、讀經經節
 *
 * 這頁不存也不顯示任何信息內文，只有書目資料，內文一律連回原站。
 *
 * 網址 hash：#1101.no1-1 某一篇 ／ #b.2418 某一本書 ／ #i.1101 某一期
 */
(function () {
	'use strict';

	var PRODUCT = 'https://www.twgbr.org.tw/products?query=';
	var TOP_BOOKS = 30;           // 書單預設只列前 30 本，不要一次給太多
	var SECTIONS = ['真理', '生命', '事奉', '福音', '唱詩人'];

	var el = function (id) { return document.getElementById(id); };
	var index = [], books = [], articles = [], byAnchor = {}, byBook = {};
	var details = {};             // 期 → Promise(該期細節)
	var lastPicked = null, showAllBooks = false;

	/* ── 整理輕索引 ─────────────────────────────────────── */

	function prepare() {
		articles = [];
		index.forEach(function (iss) {
			(iss.sections || []).forEach(function (sec) {
				(sec.articles || []).forEach(function (a) {
					var row = {
						issue: iss.id, label: iss.label, vol: iss.vol, num: iss.issue,
						issueUrl: iss.url, section: sec.title,
						title: a.title, page: a.page, anchor: a.anchor,
						books: a.books || []
					};
					articles.push(row);
					byAnchor[row.issue + '.' + row.anchor] = row;
				});
			});
		});
		books.forEach(function (b) { byBook[b.no] = b; });
	}

	function bookName(no) {
		var b = byBook[no];
		return (b && b.title) || ('書號 ' + no);
	}

	/* ── 一期一檔，點到才抓 ─────────────────────────────── */

	function detailOf(id) {
		if (!details[id]) {
			details[id] = fetch('data/issues/' + id + '.json')
				.then(function (r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					return r.json();
				})
				.then(function (d) {
					var map = {};
					(d.sections || []).forEach(function (sec) {
						(sec.articles || []).forEach(function (a) { map[a.anchor] = a; });
					});
					return map;
				});
			details[id].catch(function () { delete details[id]; });
		}
		return details[id];
	}

	/* ── 小工具 ─────────────────────────────────────────── */

	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
		});
	}

	function link(href, text) {
		return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(text) + '</a>';
	}

	/* ── 讀一篇 ─────────────────────────────────────────── */

	// 「換一篇」只抽**對到書**的篇（1676／2252）。這頁的用處是從一個題目走到一本書，
	// 抽到沒有出處書的篇（多半是唱詩人那段只連音檔的詩歌）就走不過去了。
	// 那些篇還是能從「依期」點進來看。
	function filtered() {
		var sec = el('sel-section').value, iss = el('sel-issue').value;
		return articles.filter(function (a) {
			return a.books.length &&
				(!sec || a.section === sec) && (!iss || a.issue === iss);
		});
	}

	function pick() {
		var pool = filtered();
		if (!pool.length) return null;
		if (pool.length > 1 && lastPicked) {
			pool = pool.filter(function (a) { return a !== lastPicked; });
		}
		return pool[Math.floor(Math.random() * pool.length)];
	}

	function renderOne(a) {
		if (!a) {
			el('card').innerHTML = '<p class="status">這個分類／卷期沒有篇目。</p>';
			return;
		}
		lastPicked = a;
		setHash(a.issue + '.' + a.anchor);

		// 先畫輕索引就有的部分，細節到了再補；換一篇不會先變空白
		var head = '<p class="meta"><span class="sec">' + esc(a.section) + '</span>　' +
			esc(a.label) + (a.page ? '　第 ' + a.page + ' 頁' : '') + '</p>' +
			'<h2>' + esc(a.title) + '</h2>';
		el('card').innerHTML = head + '<div id="card-rest"></div>';

		detailOf(a.issue).then(function (map) {
			if (lastPicked !== a) return;          // 期間又換過一篇就不要蓋回去
			render_rest(a, map[a.anchor] || {});
		}, function () {
			if (lastPicked !== a) return;
			var rest = el('card-rest');
			if (rest) {
				rest.innerHTML = '<p class="tail">' +
					link(a.issueUrl + '#' + a.anchor, '在職事文摘看這一篇') + '</p>';
			}
		});
	}

	function render_rest(a, d) {
		var h = [];
		if (d.reading) {
			h.push('<p class="reading"><span class="lbl">讀經</span><br />' + esc(d.reading) + '</p>');
		}
		var sources = d.sources || [];
		var real = sources.filter(function (s) { return !s.audio; });
		if (real.length) {
			h.push('<div class="sources"><span class="lbl">出自</span>');
			real.forEach(function (s) {
				h.push('<div class="source">');
				h.push('<div class="book">' + esc(s.book || s.label) +
					(s.chapter ? '　<span class="chapter">' + esc(s.chapter) + '</span>' : '') +
					'</div>');
				var ls = [];
				if (s.no) ls.push(link(PRODUCT + s.no, '到書房看這本書'));
				ls.push(link(a.issueUrl + s.webpg, '讀這一篇'));
				h.push('<div class="links">' + ls.join('') + '</div>');
				h.push('</div>');
			});
			h.push('</div>');
		}
		var tail = [];
		var audio = sources.filter(function (s) { return s.audio; });
		if (audio.length) tail.push(link(a.issueUrl + audio[0].webpg, '信息朗讀'));
		tail.push(link(a.issueUrl + '#' + a.anchor, '在職事文摘看這一期'));
		h.push('<p class="tail">' + tail.join('') + '</p>');
		el('card-rest').innerHTML = h.join('');
	}

	/* ── 依書 ───────────────────────────────────────────── */

	function renderBooks() {
		el('book-detail').hidden = true;
		el('book-list').hidden = false;
		var shown = showAllBooks ? books : books.slice(0, TOP_BOOKS);
		var h = ['<p class="list-head">共 ' + books.length + ' 本書被引用過，依引用篇數排序。' +
			(showAllBooks ? '' : '先列前 ' + TOP_BOOKS + ' 本。') +
			' <button id="btn-all-books" class="btn small">' +
			(showAllBooks ? '只看前 ' + TOP_BOOKS + ' 本' : '列出全部') + '</button></p>'];
		shown.forEach(function (b) {
			h.push('<div class="row" data-no="' + esc(b.no) + '">' +
				'<span class="name">' + esc(bookName(b.no)) + '</span>' +
				'<span class="count">' + b.refs.length + ' 篇</span></div>');
		});
		el('book-list').innerHTML = h.join('');
		el('btn-all-books').onclick = function () { showAllBooks = !showAllBooks; renderBooks(); };
		Array.prototype.forEach.call(el('book-list').querySelectorAll('.row'), function (row) {
			row.onclick = function () { renderBook(row.getAttribute('data-no')); };
		});
	}

	function renderBook(no) {
		var b = byBook[no];
		if (!b) return renderBooks();
		el('book-list').hidden = true;
		el('book-detail').hidden = false;
		setHash('b.' + b.no);

		var h = ['<a href="#" class="back-link" id="back-books">← 書單</a>'];
		h.push('<h2>' + esc(bookName(b.no)) + '</h2>');
		h.push('<p class="sub">書號 ' + esc(b.no) + '　被 ' + b.refs.length + ' 篇文摘引用</p>');
		h.push('<p class="buy">' + link(PRODUCT + b.no, '到書房看這本書') + '</p>');

		// 依分類分組，看得出這本書的幅度
		var groups = {};
		b.refs.forEach(function (r) {
			var a = byAnchor[r.issue + '.' + r.anchor];
			if (a) (groups[a.section] = groups[a.section] || []).push(a);
		});
		var order = SECTIONS.concat(Object.keys(groups).filter(function (k) {
			return SECTIONS.indexOf(k) < 0;
		}));
		order.forEach(function (sec) {
			var rs = groups[sec];
			if (!rs) return;
			h.push('<div class="ref-group"><p class="gh">' + esc(sec) + '　' + rs.length + ' 篇</p>');
			rs.sort(function (x, y) { return x.issue < y.issue ? -1 : 1; });
			rs.forEach(function (a) {
				h.push('<div class="ref">' +
					'<div class="t"><a href="#" data-go="' + esc(a.issue + '.' + a.anchor) + '">' +
					esc(a.title) + '</a></div>' +
					'<div class="s">' + esc(a.label) +
					link(a.issueUrl + '#' + a.anchor, '讀這一篇') + '</div></div>');
			});
			h.push('</div>');
		});
		el('book-detail').innerHTML = h.join('');
		el('back-books').onclick = function (e) {
			e.preventDefault(); setHash(''); renderBooks();
		};
		wireGo(el('book-detail'));
	}

	/* ── 依期 ───────────────────────────────────────────── */

	function renderIssues() {
		el('issue-detail').hidden = true;
		el('issue-list').hidden = false;
		var h = ['<p class="list-head">共 ' + index.length + ' 期，新的在上面。</p>'];
		index.slice().reverse().forEach(function (iss) {
			var n = 0;
			(iss.sections || []).forEach(function (s) { n += (s.articles || []).length; });
			h.push('<div class="row" data-id="' + esc(iss.id) + '">' +
				'<span class="name">' + esc(iss.label) + '</span>' +
				'<span class="count">' + n + ' 篇</span></div>');
		});
		el('issue-list').innerHTML = h.join('');
		Array.prototype.forEach.call(el('issue-list').querySelectorAll('.row'), function (row) {
			row.onclick = function () { renderIssue(row.getAttribute('data-id')); };
		});
	}

	function renderIssue(id) {
		var iss = index.filter(function (i) { return i.id === id; })[0];
		if (!iss) return renderIssues();
		el('issue-list').hidden = true;
		el('issue-detail').hidden = false;
		setHash('i.' + id);

		var h = ['<a href="#" class="back-link" id="back-issues">← 期數</a>'];
		h.push('<h2>' + esc(iss.label) + '</h2>');
		h.push('<p class="sub">' + link(iss.url, '在職事文摘打開這一期') + '</p>');
		(iss.sections || []).forEach(function (sec) {
			if (!(sec.articles || []).length) return;
			h.push('<div class="ref-group"><p class="gh">' + esc(sec.title) + '</p>');
			sec.articles.forEach(function (a) {
				var names = (a.books || []).map(bookName);
				h.push('<div class="ref">' +
					'<div class="t"><a href="#" data-go="' + esc(iss.id + '.' + a.anchor) + '">' +
					esc(a.title) + '</a></div>' +
					(names.length ? '<div class="s">' + esc(names.join('、')) + '</div>' : '') +
					'</div>');
			});
			h.push('</div>');
		});
		el('issue-detail').innerHTML = h.join('');
		el('back-issues').onclick = function (e) {
			e.preventDefault(); setHash(''); renderIssues();
		};
		wireGo(el('issue-detail'));
	}

	function wireGo(scope) {
		Array.prototype.forEach.call(scope.querySelectorAll('[data-go]'), function (a) {
			a.onclick = function (e) {
				e.preventDefault();
				show('one');
				renderOne(byAnchor[a.getAttribute('data-go')]);
			};
		});
	}

	/* ── 分頁切換與 hash ───────────────────────────────── */

	var VIEWS = { one: 'tab-one', books: 'tab-books', issues: 'tab-issues' };

	function show(name) {
		Object.keys(VIEWS).forEach(function (k) {
			el('view-' + k).hidden = k !== name;
			el(VIEWS[k]).classList.toggle('is-on', k === name);
		});
		el('filter-row').hidden = name !== 'one';
		if (name === 'books' && !el('book-list').innerHTML) renderBooks();
		if (name === 'issues' && !el('issue-list').innerHTML) renderIssues();
	}

	var muteHash = false;
	function setHash(h) {
		muteHash = true;
		if (h) location.hash = h;
		else if (location.hash) history.replaceState(null, '', location.pathname);
		setTimeout(function () { muteHash = false; }, 0);
	}

	function fromHash() {
		var h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
		if (!h) return false;
		if (h.indexOf('b.') === 0 && byBook[h.slice(2)]) {
			show('books'); renderBook(h.slice(2)); return true;
		}
		if (h.indexOf('i.') === 0) { show('issues'); renderIssue(h.slice(2)); return true; }
		if (byAnchor[h]) { show('one'); renderOne(byAnchor[h]); return true; }
		return false;
	}

	/* ── 啟動 ───────────────────────────────────────────── */

	function fillSelects() {
		var secs = [];
		articles.forEach(function (a) {
			if (secs.indexOf(a.section) < 0) secs.push(a.section);
		});
		secs.sort(function (x, y) {
			var i = SECTIONS.indexOf(x), j = SECTIONS.indexOf(y);
			return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
		});
		secs.forEach(function (s) {
			el('sel-section').insertAdjacentHTML('beforeend',
				'<option value="' + esc(s) + '">' + esc(s) + '</option>');
		});
		index.slice().reverse().forEach(function (i) {
			el('sel-issue').insertAdjacentHTML('beforeend',
				'<option value="' + esc(i.id) + '">' + esc(i.label) + '</option>');
		});
	}

	function boot() {
		prepare();
		fillSelects();
		el('status').hidden = true;
		el('btn-next').onclick = function () { renderOne(pick()); };
		el('sel-section').onchange = el('sel-issue').onchange = function () {
			lastPicked = null; renderOne(pick());
		};
		Object.keys(VIEWS).forEach(function (k) {
			el(VIEWS[k]).onclick = function () { setHash(''); show(k); };
		});
		window.addEventListener('hashchange', function () {
			if (!muteHash) fromHash();
		});
		if (!fromHash()) { show('one'); renderOne(pick()); }
	}

	Promise.all([
		fetch('data/index.json').then(function (r) { return r.json(); }),
		fetch('data/books.json').then(function (r) { return r.json(); })
	]).then(function (res) {
		index = res[0]; books = res[1];
		boot();
	}).catch(function (err) {
		el('status').textContent = '索引讀不到：' + err;
		el('status').hidden = false;
	});
})();
