/* 基督徒書報介紹
 *
 * 五個分類（真理／生命／事奉／福音／詩歌），點一個分類就給九段書報內容，
 * 每一段下面是「試讀」（回職事文摘原頁）與「購買資訊」（回書房產品頁）。
 * 詩歌那一類多一條 hymnal.net 的連結。
 *
 * 資料是建置時抓好的（scripts/build_digest_index.py）。ministrydigest.twgbr.org
 * 沒有 API，也不回 Access-Control-Allow-Origin，瀏覽器直抓會被擋。
 *
 *   data/cards/manifest.json  每個分類有幾張卡、切成幾塊
 *   data/cards/{分類}-{塊}.json  一塊 120 張卡（一次只抓一塊，約 27K gzip）
 *   data/index.json / books.json / issues/{期}.json  「依書」「依期」用的
 *
 * 節錄一頁只取一段，一定附書名篇名與回原站的連結；整篇請走「試讀」。
 *
 * 網址 hash：#c.no1 某個分類 ／ #b.2418 某一本書 ／ #i.1101 某一期
 */
(function () {
	'use strict';

	var PRODUCT = 'https://www.twgbr.org.tw/products?query=';
	var PER_DRAW = 9;             // 一次九段
	var TOP_BOOKS = 30;

	// 資料裡第五類叫「唱詩人」，頁面上叫「詩歌」
	var SECTIONS = [
		{ slug: 'no1', name: '真理' },
		{ slug: 'no2', name: '生命' },
		{ slug: 'no3', name: '事奉' },
		{ slug: 'no4', name: '福音' },
		{ slug: 'no5', name: '詩歌', data: '唱詩人' }
	];
	var SECTION_NAMES = ['真理', '生命', '事奉', '福音', '唱詩人'];

	var el = function (id) { return document.getElementById(id); };

	var manifest = {}, pools = {}, got = {}, draws = {};   // 分類 → 卡片／抓過的塊／抓過幾輪
	var index = null, books = null, byAnchor = {}, byBook = {};
	var current = null, lastDraw = [];

	/* ── 小工具 ─────────────────────────────────────────── */

	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
		});
	}

	function link(href, text) {
		return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(text) + '</a>';
	}

	function getJSON(url) {
		return fetch(url).then(function (r) {
			if (!r.ok) throw new Error('HTTP ' + r.status);
			return r.json();
		});
	}

	function shuffle(a) {
		for (var i = a.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1)), t = a[i];
			a[i] = a[j]; a[j] = t;
		}
		return a;
	}

	/* ── 分類卡片 ───────────────────────────────────────── */

	// 一個分類切成好幾塊，一次只抓一塊（還沒抓過的隨機挑一塊），抓到的累積在 pools 裡。
	// 第一次一定抓；之後每按三輪「再換九段」就再抓一塊，所以越看越廣，
	// 又不會一開頁就把整個分類（最多 275K）拉下來。
	function ensure(slug) {
		var info = manifest[slug];
		if (!info) return Promise.resolve([]);
		pools[slug] = pools[slug] || [];
		got[slug] = got[slug] || {};
		draws[slug] = (draws[slug] || 0) + 1;
		var left = [];
		for (var n = 0; n < info.chunks; n++) if (!got[slug][n]) left.push(n);
		var want = !pools[slug].length || draws[slug] % 3 === 1;
		if (!left.length || !want) {
			return Promise.resolve(pools[slug]);
		}
		var pickChunk = left[Math.floor(Math.random() * left.length)];
		got[slug][pickChunk] = true;
		var name = slug + '-' + (pickChunk < 10 ? '0' : '') + pickChunk + '.json';
		return getJSON('data/cards/' + name).then(function (rows) {
			pools[slug] = pools[slug].concat(rows);
			return pools[slug];
		}, function () {
			return pools[slug];
		});
	}

	function draw(slug) {
		var pool = pools[slug] || [];
		if (!pool.length) {
			el('cards').innerHTML = '<p class="status">這個分類還沒有內容。</p>';
			return;
		}
		// 盡量不要和上一輪重複
		var fresh = pool.filter(function (c) { return lastDraw.indexOf(c) < 0; });
		if (fresh.length < PER_DRAW) fresh = pool.slice();
		var picked = shuffle(fresh.slice()).slice(0, Math.min(PER_DRAW, fresh.length));
		lastDraw = picked;

		var info = manifest[slug] || {};
		var h = ['<p class="count-line">' + esc(nameOf(slug)) + '　共 ' +
			(info.total || pool.length) + ' 段，這裡隨機九段。</p>', '<div class="cards">'];
		picked.forEach(function (c) {
			h.push('<article class="card">');
			h.push('<p class="excerpt">' + esc(c.text) + '</p>');
			h.push('<p class="src"><span class="book">《' + esc(c.book || ('書號 ' + c.no)) +
				'》</span>' + (c.chapter ? '　' + esc(c.chapter) : '') +
				'<span class="issue">《職事文摘》' + esc(c.label) + '</span></p>');
			var ls = [link(c.read, '試讀'), link(PRODUCT + c.no, '購買資訊')];
			if (c.hymn) ls.push(link(c.hymn, '這首詩歌'));
			h.push('<p class="links">' + ls.join('') + '</p>');
			h.push('</article>');
		});
		h.push('</div>');
		el('cards').innerHTML = h.join('');
	}

	function nameOf(slug) {
		for (var i = 0; i < SECTIONS.length; i++) {
			if (SECTIONS[i].slug === slug) return SECTIONS[i].name;
		}
		return slug;
	}

	function openCategory(slug) {
		current = slug;
		lastDraw = [];
		show('cards');
		markTab('c.' + slug);
		setHash('c.' + slug);
		el('cards').innerHTML = '<p class="status">正在讀…</p>';
		ensure(slug).then(function () { draw(slug); });
	}

	/* ── 依書、依期（要用到完整索引，點到才讀） ───────── */

	function needIndex() {
		if (index && books) return Promise.resolve();
		return Promise.all([
			getJSON('data/index.json'), getJSON('data/books.json')
		]).then(function (res) {
			index = res[0]; books = res[1];
			index.forEach(function (iss) {
				(iss.sections || []).forEach(function (sec) {
					(sec.articles || []).forEach(function (a) {
						byAnchor[iss.id + '.' + a.anchor] = {
							issue: iss.id, label: iss.label, url: iss.url,
							section: sec.title, title: a.title, anchor: a.anchor,
							books: a.books || []
						};
					});
				});
			});
			books.forEach(function (b) { byBook[b.no] = b; });
		});
	}

	function bookName(no) {
		var b = byBook[no];
		return (b && b.title) || ('書號 ' + no);
	}

	var showAllBooks = false;

	function renderBooks() {
		el('book-detail').hidden = true;
		el('book-list').hidden = false;
		var shown = showAllBooks ? books : books.slice(0, TOP_BOOKS);
		var h = ['<p class="count-line">共 ' + books.length + ' 本書被《職事文摘》引用過，依引用篇數排序。' +
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
		h.push('<p class="sub">書號 ' + esc(b.no) + '　被 ' + b.refs.length + ' 篇引用</p>');
		h.push('<p class="buy">' + link(PRODUCT + b.no, '購買資訊') + '</p>');

		var groups = {};
		b.refs.forEach(function (r) {
			var a = byAnchor[r.issue + '.' + r.anchor];
			if (a) (groups[a.section] = groups[a.section] || []).push(a);
		});
		SECTION_NAMES.concat(Object.keys(groups).filter(function (k) {
			return SECTION_NAMES.indexOf(k) < 0;
		})).forEach(function (sec) {
			var rs = groups[sec];
			if (!rs) return;
			h.push('<div class="ref-group"><p class="gh">' +
				esc(sec === '唱詩人' ? '詩歌' : sec) + '　' + rs.length + ' 篇</p>');
			rs.sort(function (x, y) { return x.issue < y.issue ? -1 : 1; });
			rs.forEach(function (a) {
				h.push('<div class="ref"><div class="t">' +
					link(a.url + '#' + a.anchor, a.title) + '</div>' +
					'<div class="s">' + esc(a.label) + '</div></div>');
			});
			h.push('</div>');
		});
		el('book-detail').innerHTML = h.join('');
		el('back-books').onclick = function (e) {
			e.preventDefault(); setHash(''); renderBooks();
		};
	}

	function renderIssues() {
		el('issue-detail').hidden = true;
		el('issue-list').hidden = false;
		var h = ['<p class="count-line">《職事文摘》共 ' + index.length + ' 期，新的在上面。</p>'];
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
			h.push('<div class="ref-group"><p class="gh">' +
				esc(sec.title === '唱詩人' ? '詩歌' : sec.title) + '</p>');
			sec.articles.forEach(function (a) {
				var names = (a.books || []).map(bookName);
				h.push('<div class="ref"><div class="t">' +
					link(iss.url + '#' + a.anchor, a.title) + '</div>' +
					(names.length ? '<div class="s">' + esc(names.join('、')) + '</div>' : '') +
					'</div>');
			});
			h.push('</div>');
		});
		el('issue-detail').innerHTML = h.join('');
		el('back-issues').onclick = function (e) {
			e.preventDefault(); setHash(''); renderIssues();
		};
	}

	/* ── 分頁、畫面切換與 hash ─────────────────────────── */

	var VIEWS = ['cards', 'books', 'issues'];

	function show(name) {
		VIEWS.forEach(function (v) { el('view-' + v).hidden = v !== name; });
		el('status').hidden = true;
	}

	function markTab(key) {
		Array.prototype.forEach.call(el('tabs').querySelectorAll('.tab'), function (t) {
			t.className = 'tab' + (t.getAttribute('data-key') === key ? ' is-on' : '');
		});
	}

	function buildTabs() {
		var h = [];
		SECTIONS.forEach(function (s) {
			h.push('<button class="tab" data-key="c.' + s.slug + '">' + esc(s.name) + '</button>');
		});
		h.push('<span class="tab-gap"></span>');
		h.push('<button class="tab alt" data-key="books">依書</button>');
		h.push('<button class="tab alt" data-key="issues">依期</button>');
		el('tabs').innerHTML = h.join('');
		Array.prototype.forEach.call(el('tabs').querySelectorAll('.tab'), function (t) {
			t.onclick = function () { go(t.getAttribute('data-key')); };
		});
	}

	function go(key) {
		if (key.indexOf('c.') === 0) return openCategory(key.slice(2));
		if (key === 'books') {
			markTab('books'); setHash('');
			return needIndex().then(function () { show('books'); renderBooks(); });
		}
		if (key === 'issues') {
			markTab('issues'); setHash('');
			return needIndex().then(function () { show('issues'); renderIssues(); });
		}
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
		if (h.indexOf('c.') === 0 && manifest[h.slice(2)]) { openCategory(h.slice(2)); return true; }
		if (h.indexOf('b.') === 0) {
			markTab('books');
			needIndex().then(function () { show('books'); renderBook(h.slice(2)); });
			return true;
		}
		if (h.indexOf('i.') === 0) {
			markTab('issues');
			needIndex().then(function () { show('issues'); renderIssue(h.slice(2)); });
			return true;
		}
		return false;
	}

	/* ── 啟動 ───────────────────────────────────────────── */

	getJSON('data/cards/manifest.json').then(function (m) {
		manifest = m;
		buildTabs();
		el('btn-more').onclick = function () {
			if (!current) return;
			ensure(current).then(function () { draw(current); });
		};
		window.addEventListener('hashchange', function () {
			if (!muteHash) fromHash();
		});
		if (!fromHash()) openCategory(SECTIONS[0].slug);
	}).catch(function (err) {
		el('status').textContent = '讀不到資料：' + err;
		el('status').hidden = false;
	});
})();
