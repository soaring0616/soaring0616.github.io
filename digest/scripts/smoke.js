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
	return { getAttribute: function (n) { return n === ('data-' + k) ? v : null; }, onclick: null };
}
function query(h, sel) {
	var out = [], m, re;
	if (sel === '.row') {
		re = /class="row" data-(no|id)="([^"]*)"/g;
		while ((m = re.exec(h)) !== null) out.push(stub(m[1], m[2]));
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

print('');
print('開頁（讀一篇）');
ok('status 已隱藏', els['status'].hidden === true);
ok('只讀了輕索引兩個檔', fetched.length >= 2 &&
	fetched[0] === 'data/index.json' && fetched[1] === 'data/books.json',
	'第一批：' + fetched.slice(0, 2).join(' + '));
var card = els['card']._html;
ok('有篇題 h2', /<h2>[^<]+<\/h2>/.test(card));
ok('有分類與卷期', /class="meta"/.test(card) && /第.{1,4}卷/.test(card));
var rest = els['card-rest']._html;
ok('有「出自」區塊', /class="sources"/.test(rest));
ok('有連回書房的連結', /twgbr\.org\.tw\/products\?query=\d/.test(rest),
	(rest.match(/products\?query=([0-9A-Za-z-]+)/) || [])[0] || '');
ok('有連回文摘原頁', /ministrydigest\.twgbr\.org/.test(rest));
ok('沒有抓整包舊的 issues.json', fetched.join(' ').indexOf('data/issues.json') < 0);
ok('分類下拉有五項', (els['sel-section']._html.match(/<option/g) || []).length === 5,
	els['sel-section']._html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
ok('卷期下拉有 80 項', (els['sel-issue']._html.match(/<option/g) || []).length === 80);

print('');
print('換一篇 ×300');
var noBook = 0, noTitle = 0, seen = {};
for (var i = 0; i < 300; i++) {
	els['btn-next'].onclick(EV);
	var c = els['card']._html, r = els['card-rest']._html;
	if (!/<h2>[^<]+<\/h2>/.test(c)) noTitle++;
	if (!/products\?query=/.test(r)) noBook++;
	seen[location.hash] = 1;
}
ok('每一篇都有篇題', noTitle === 0, noTitle ? noTitle + ' 篇沒有' : '');
ok('每一篇都有書房連結', noBook === 0, noBook ? noBook + ' 篇沒有' : '');
ok('抽到不重複的篇夠多', Object.keys(seen).length > 200, Object.keys(seen).length + ' 種');
ok('hash 有設成 期.錨點', /^#\d{4}\./.test(location.hash), location.hash);

print('');
print('分類篩選');
els['sel-section'].value = '福音';
els['sel-section'].onchange(EV);
ok('切到福音有出東西', /<h2>/.test(els['card']._html));
ok('福音篇也有書房連結', /products\?query=/.test(els['card-rest']._html));
els['sel-section'].value = '唱詩人';
els['sel-section'].onchange(EV);
ok('切到唱詩人有出東西', /<h2>/.test(els['card']._html));
els['sel-section'].value = '';
els['sel-section'].onchange(EV);

print('');
print('依書');
els['tab-books'].onclick(EV);
var bl = els['book-list']._html;
ok('書單有列出來', (bl.match(/class="row"/g) || []).length === 30,
	(bl.match(/class="row"/g) || []).length + ' 列（預設前 30 本）');
ok('有「列出全部」', /btn-all-books/.test(bl));
els['btn-all-books'].onclick(EV);
ok('展開後列出全部 666 本', (els['book-list']._html.match(/class="row"/g) || []).length === 666);
els['btn-all-books'].onclick(EV);
var rows = els['book-list'].querySelectorAll('.row');
ok('書單列可點', rows.length === 30 && rows[0].getAttribute('data-no') !== null,
	'第一本書號 ' + rows[0].getAttribute('data-no'));
rows[0].onclick(EV);
var bd = els['book-detail']._html;
ok('書頁有書名與書號', /<h2>/.test(bd) && /書號/.test(bd));
ok('書頁有購書連結', /products\?query=/.test(bd));
ok('書頁有依分類分組', /class="ref-group"/.test(bd),
	(bd.match(/class="ref-group"/g) || []).length + ' 組');
ok('書頁列出引用的篇', (bd.match(/class="ref"/g) || []).length > 1,
	(bd.match(/class="ref"/g) || []).length + ' 篇');
ok('hash 設成 b.書號', /^#b\./.test(location.hash), location.hash);
var gos = els['book-detail'].querySelectorAll('[data-go]');
ok('書頁的篇可以點回「讀一篇」', gos.length > 0);
gos[0].onclick(EV);
ok('點了之後確實切到讀一篇', els['view-one'].hidden === false && /<h2>/.test(els['card']._html));

print('');
print('依期');
els['tab-issues'].onclick(EV);
var il = els['issue-list']._html;
ok('期數列出 80 期', (il.match(/class="row"/g) || []).length === 80);
ok('最新一期在最上面', il.indexOf('第十一卷') < il.indexOf('第一卷'));
var irows = els['issue-list'].querySelectorAll('.row');
irows[0].onclick(EV);
var id_ = els['issue-detail']._html;
ok('某一期有五個分類', (id_.match(/class="gh"/g) || []).length === 5,
	(id_.match(/class="gh"/g) || []).length + ' 組');
ok('篇題下面標著出自哪本書', /class="s"/.test(id_));
ok('有連回文摘該期', /ministrydigest/.test(id_));
ok('hash 設成 i.期', /^#i\./.test(location.hash), location.hash);

print('');
print('網址 hash 直接進');
// 每一篇
els['card']._html = '';
location.hash = '#1101.no3-2';
eval(readFile(BASE + '/js/app.js'));
ok('#1101.no3-2 開到那一篇', /幫助人認識並順從神內裏的運行/.test(els['card']._html),
	(els['card']._html.match(/<h2>([^<]*)</) || [])[1] || '');
ok('　而且出處書號是 2418', /products\?query=2418/.test(els['card-rest']._html));
// 某一本書
location.hash = '#b.2418';
eval(readFile(BASE + '/js/app.js'));
ok('#b.2418 開到那本書', /2418/.test(els['book-detail']._html) &&
	els['view-books'].hidden === false,
	(els['book-detail']._html.match(/<h2>([^<]*)</) || [])[1] || '');
// 某一期
location.hash = '#i.0101';
eval(readFile(BASE + '/js/app.js'));
ok('#i.0101 開到那一期', /第一卷/.test(els['issue-detail']._html) &&
	els['view-issues'].hidden === false);
// 壞 hash 不要炸
location.hash = '#b.nonexistent';
eval(readFile(BASE + '/js/app.js'));
ok('不存在的 hash 退回讀一篇', els['view-one'].hidden === false && /<h2>/.test(els['card']._html));

print('');
print(fails === 0 ? ('全部通過（' + checks + ' 項）') : (fails + ' / ' + checks + ' 項失敗'));
quit(fails === 0 ? 0 : 1);
