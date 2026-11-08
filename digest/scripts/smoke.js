/* digest/ 的煙霧測試：用 Rhino 把 js/app.js 真的跑起來，拿 data/ 的真實資料
 * 走過三個畫面（讀一篇、依書、依期）與網址 hash。
 *
 *   cd digest && rhino scripts/smoke.js
 *
 * Rhino 1.7 沒有 Promise、也沒有瀏覽器環境，所以這裡自備同步 Promise、
 * 假 DOM 與讀檔版的 fetch。那些替身只是為了跑測試，不是 app.js 的一部分。
 * 這台機器上沒有 node，有的話也可以改寫成 node 版。
 */

var BASE = (typeof arguments !== 'undefined' && arguments.length) ? String(arguments[0]) : '.';
var fails = 0, checks = 0;
var EV = { preventDefault: function () {} };   // 替身事件：app.js 的連結處理會呼叫 preventDefault
function ok(name, cond, extra) {
	checks++;
	if (!cond) { fails++; print('  ✗ ' + name + (extra ? '　' + extra : '')); }
	else print('  ✓ ' + name + (extra ? '　' + extra : ''));
}

/* ── 老 Rhino 缺的東西 ───────────────────────────── */
if (!Array.prototype.forEach) Array.prototype.forEach = function (f) {
	for (var i = 0; i < this.length; i++) f(this[i], i, this);
};
if (!Array.prototype.filter) Array.prototype.filter = function (f) {
	var o = []; for (var i = 0; i < this.length; i++) if (f(this[i], i, this)) o.push(this[i]); return o;
};
if (!Array.prototype.map) Array.prototype.map = function (f) {
	var o = []; for (var i = 0; i < this.length; i++) o.push(f(this[i], i, this)); return o;
};
if (!Array.prototype.some) Array.prototype.some = function (f) {
	for (var i = 0; i < this.length; i++) if (f(this[i], i, this)) return true; return false;
};
if (!Array.prototype.indexOf) Array.prototype.indexOf = function (v) {
	for (var i = 0; i < this.length; i++) if (this[i] === v) return i; return -1;
};
if (typeof Object.keys !== 'function') Object.keys = function (o) {
	var k = []; for (var n in o) if (o.hasOwnProperty(n)) k.push(n); return k;
};
if (typeof JSON === 'undefined') {
	JSON = { parse: function (s) { return eval('(' + s + ')'); } };
}

/* ── 同步 Promise ────────────────────────────────── */
function P(v, e, bad) { this.v = v; this.e = e; this.bad = !!bad; }
function wrap(r) { return (r instanceof P) ? r : new P(r); }
P.prototype.then = function (onOk, onErr) {
	try {
		if (this.bad) return onErr ? wrap(onErr(this.e)) : this;
		return wrap(onOk ? onOk(this.v) : this.v);
	} catch (err) { return new P(undefined, err, true); }
};
P.prototype['catch'] = function (onErr) { return this.then(null, onErr); };
Promise = {
	resolve: function (v) { return (v instanceof P) ? v : new P(v); },
	reject: function (e) { return new P(undefined, e, true); },
	all: function (a) {
		var out = [];
		for (var i = 0; i < a.length; i++) {
			if (a[i].bad) return new P(undefined, a[i].e, true);
			out.push(a[i].v);
		}
		return new P(out);
	}
};

/* ── fetch：從檔案讀 ─────────────────────────────── */
var fetched = [];
function fetch(url) {
	fetched.push(url);
	var txt = null;
	try { txt = readFile(BASE + '/' + url); } catch (e) { txt = null; }
	if (txt === null || txt === undefined) {
		return new P({ ok: false, status: 404, json: function () { throw 'no json'; } });
	}
	return new P({ ok: true, status: 200, json: function () { return JSON.parse(txt); } });
}

/* ── 假 DOM ──────────────────────────────────────── */
var els = {};
function stub(k, v) {
	return {
		getAttribute: function (n) { return n === ('data-' + k) ? v : null; },
		onclick: null, className: ''
	};
}
function query(h, sel) {
	var out = [], m, re;
	if (sel === '.row') {
		re = /class="row" data-(no|id)="([^"]*)"/g;
		while ((m = re.exec(h)) !== null) out.push(stub(m[1], m[2]));
	} else if (sel === '.tab') {
		re = /<button class="tab[^"]*" data-key="([^"]*)"/g;
		while ((m = re.exec(h)) !== null) out.push(stub('key', m[1]));
	} else if (sel === '[data-go]') {
		re = /data-go="([^"]*)"/g;
		while ((m = re.exec(h)) !== null) out.push(stub('go', m[1]));
	}
	return out;
}
function register(h) {
	var re = /id="([A-Za-z0-9_-]+)"/g, m;
	while ((m = re.exec(h)) !== null) if (!els[m[1]]) els[m[1]] = mkEl(m[1]);
}
function mkEl(id) {
	var e = {
		id: id, hidden: false, _html: '', textContent: '', onclick: null, onchange: null,
		value: '', classList: { toggle: function () {} },
		_q: {},
		querySelectorAll: function (sel) {
			var key = sel + '\u0000' + this._html;
			if (!this._q[key]) this._q[key] = query(this._html, sel);
			return this._q[key];
		},
		insertAdjacentHTML: function (pos, html) { this._html += html; register(html); }
	};
	e.__defineGetter__('innerHTML', function () { return this._html; });
	e.__defineSetter__('innerHTML', function (v) { this._html = v; this._q = {}; register(v); });
	return e;
}
document = {
	getElementById: function (id) {
		if (!els[id]) els[id] = mkEl(id);
		return els[id];
	}
};
// 瀏覽器裡 location.hash = 'x' 之後讀回來是 '#x'，替身也照辦
var _hash = '';
location = {
	pathname: '/digest/',
	set hash(v) { _hash = v ? (v.charAt(0) === '#' ? v : '#' + v) : ''; },
	get hash() { return _hash; }
};
history = { replaceState: function (a, b, p) { location.hash = ''; } };
window = { addEventListener: function () {} };
setTimeout = function (f) { f(); };

register(readFile(BASE + '/index.html'));

/* ── 跑起來 ──────────────────────────────────────── */
print('載入 app.js');
eval(readFile(BASE + '/js/app.js'));

function tab(key) {
	var ts = els['tabs'].querySelectorAll('.tab');
	for (var i = 0; i < ts.length; i++) {
		if (ts[i].getAttribute('data-key') === key) return ts[i];
	}
	return null;
}
function cards() {
	var h = els['cards']._html;
	return (h.match(/<article class="card">/g) || []).length;
}

print('');
print('開頁');
ok('只抓了 manifest', fetched.length >= 1 && fetched[0] === 'data/cards/manifest.json',
	'第一個請求：' + fetched[0]);
ok('沒有一開頁就抓完整索引',
	fetched.join(' ').indexOf('data/index.json') < 0 &&
	fetched.join(' ').indexOf('data/books.json') < 0);
var tabKeys = [];
var tl = els['tabs'].querySelectorAll('.tab');
for (var i = 0; i < tl.length; i++) tabKeys.push(tl[i].getAttribute('data-key'));
ok('七個分頁：五類 + 依書 + 依期', tabKeys.length === 7, tabKeys.join(' '));
ok('分類分頁是 no1~no5',
	tabKeys.slice(0, 5).join(',') === 'c.no1,c.no2,c.no3,c.no4,c.no5');
ok('頁面上第五類叫「詩歌」', /詩歌/.test(els['tabs']._html) && !/唱詩人/.test(els['tabs']._html));
ok('預設開真理', /^#c\.no1$/.test(location.hash), location.hash);
ok('預設就有九張卡', cards() === 9, cards() + ' 張');

print('');
print('卡片內容');
var h = els['cards']._html;
ok('每張卡都有節錄', (h.match(/class="excerpt"/g) || []).length === 9);
ok('每張卡都註明書名', (h.match(/class="book"/g) || []).length === 9);
ok('每張卡都有「試讀」連回文摘',
	(h.match(/ministrydigest\.twgbr\.org[^"]*webpg[^"]*"[^>]*>試讀/g) || []).length === 9);
ok('每張卡都有「購買資訊」連回書房',
	(h.match(/products\?query=[^"]+"[^>]*>購買資訊/g) || []).length === 9);
// 節錄字數
var lens = [], re2 = /<p class="excerpt">([^<]*)<\/p>/g, m2;
while ((m2 = re2.exec(h)) !== null) lens.push(m2[1].length);
var lo = Math.min.apply(null, lens), hi = Math.max.apply(null, lens);
ok('節錄落在 120~175 字', lo >= 120 && hi <= 175, lo + '~' + hi + ' 字');
ok('真理分類沒有詩歌連結', h.indexOf('hymnal.net') < 0);

print('');
print('再換九段：前六輪只該抓一兩塊');
function chunksOf(slug) {
	return fetched.filter(function (u) { return u.indexOf('data/cards/' + slug + '-') === 0; }).length;
}
for (var k6 = 0; k6 < 6; k6++) els['btn-more'].onclick(EV);
ok('前六輪沒有把整個分類拉下來', chunksOf('no1') <= 3, chunksOf('no1') + ' 塊 / 共 8 塊');

print('');
print('再換九段 ×40');
var before = els['cards']._html, changed = 0, bad = 0;
for (var k = 0; k < 40; k++) {
	els['btn-more'].onclick(EV);
	if (cards() !== 9) bad++;
	if (els['cards']._html !== before) changed++;
	before = els['cards']._html;
}
ok('每一輪都是九張', bad === 0, bad ? bad + ' 輪不是' : '');
ok('每一輪內容都換了', changed === 40, changed + '/40');
ok('按久了會抓到更多塊（越看越廣）', chunksOf('no1') > 1, chunksOf('no1') + ' 塊');

print('');
print('五個分類都點一遍');
for (var si = 1; si <= 5; si++) {
	var key = 'c.no' + si;
	tab(key).onclick(EV);
	ok('  ' + key + ' 有九張卡', cards() === 9, els['cards']._html.match(/class="count-line">([^<]*)</)[1]);
}
ok('詩歌分類有 hymnal.net 連結', els['cards']._html.indexOf('hymnal.net') > 0,
	(els['cards']._html.match(/hymnal\.net\/zh\/[a-z\/]*/) || [])[0] || '');

print('');
print('依書');
tab('books').onclick(EV);
ok('依書才去抓完整索引', fetched.join(' ').indexOf('data/index.json') >= 0);
var bl = els['book-list']._html;
ok('書單列出前 30 本', (bl.match(/class="row"/g) || []).length === 30);
els['btn-all-books'].onclick(EV);
ok('展開列出全部 666 本', (els['book-list']._html.match(/class="row"/g) || []).length === 666);
els['btn-all-books'].onclick(EV);
var rows = els['book-list'].querySelectorAll('.row');
rows[0].onclick(EV);
var bd = els['book-detail']._html;
ok('書頁有書名、書號、購買資訊', /<h2>/.test(bd) && /書號/.test(bd) && /購買資訊/.test(bd));
ok('書頁列出引用的篇，連回文摘', /class="ref"/.test(bd) && /ministrydigest/.test(bd),
	(bd.match(/class="ref"/g) || []).length + ' 篇');
ok('書頁的分組用「詩歌」而非「唱詩人」', bd.indexOf('唱詩人') < 0);

print('');
print('依期');
tab('issues').onclick(EV);
ok('期數列出 80 期', (els['issue-list']._html.match(/class="row"/g) || []).length === 80);
els['issue-list'].querySelectorAll('.row')[0].onclick(EV);
var idt = els['issue-detail']._html;
ok('某一期有五個分類', (idt.match(/class="gh"/g) || []).length === 5);
ok('篇題連回文摘該篇', /ministrydigest[^"]*#no/.test(idt));

print('');
print('網址 hash 直接進');
location.hash = '#c.no3';
eval(readFile(BASE + '/js/app.js'));
ok('#c.no3 開到事奉', /事奉/.test(els['cards']._html) && cards() === 9);
location.hash = '#b.2418';
eval(readFile(BASE + '/js/app.js'));
ok('#b.2418 開到那本書', els['view-books'].hidden === false && /2418/.test(els['book-detail']._html),
	(els['book-detail']._html.match(/<h2>([^<]*)</) || [])[1] || '');
location.hash = '#i.0101';
eval(readFile(BASE + '/js/app.js'));
ok('#i.0101 開到那一期', els['view-issues'].hidden === false && /第一卷/.test(els['issue-detail']._html));
location.hash = '#c.bogus';
eval(readFile(BASE + '/js/app.js'));
ok('壞 hash 退回真理', els['view-cards'].hidden === false && cards() === 9);

print('');
print(fails === 0 ? ('全部通過（' + checks + ' 項）') : (fails + ' / ' + checks + ' 項失敗'));
quit(fails === 0 ? 0 : 1);
