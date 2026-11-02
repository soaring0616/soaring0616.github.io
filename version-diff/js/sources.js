/*
	外部來源的逐節連結
	------------------
	下面每一個網址格式都實地開過、確認會到正確的頁面，確認結果寫在各函式上面。
	若哪天對方改版，只要改這個檔案。
*/
'use strict';

(function (root) {

	/* 恢復本（台灣福音書房「網上聖經恢復本」）
	   逐章網址格式為 /verse/{書卷號}/{章}，書卷號就是 books.js 的 code（1–66）。
	   這站是前端渲染的，任何路徑都回 200 和同一份空殼，連 /verse/999/999 也一樣，
	   所以無法從伺服器回應驗證；格式由站主提供。 */
	function recoveryVersion(book, chapter) {
		if (!book) return 'https://www.recoveryversion.com.tw/';
		return 'https://www.recoveryversion.com.tw/verse/' + book.code + '/' + (chapter || 1);
	}

	/* 信望愛 — 版本對照（確認可用，伺服器端算好的 HTML）
	   這是最有用的一個連結：信望愛同時收了和合本「和」恢復本，
	   所以一頁就能看到兩個中文版本並排原文。
	   （該站頁尾註明恢復本經文由台灣福音書房授權給信望愛網路刊載。）

	   新約：和合本 + 恢復本 + UBS6 希臘文 + 希中逐字對照
	     VERSION1=unv&VERSION8=recover&VERSION25=gnt6&VERSION24=interubs4
	   舊約：和合本 + 恢復本 + 馬索拉原文（舊約沒有逐字對照的版本代號）
	     VERSION1=unv&VERSION8=recover&VERSION2=bhs

	   VERSION 後面的編號實測換別的數字也收（recover 用 8 或 3、bhs 用 2 或 92
	   都出得來），伺服器似乎只認 VERSION 開頭的參數，不在意編號。
	   帶 &sec= 只顯示那一節，不帶就是整章；兩種都確認過。 */
	function fhl(book, chapter, verse) {
		var versions = book.ot
			? 'VERSION1=unv&VERSION8=recover&VERSION2=bhs'
			: 'VERSION1=unv&VERSION8=recover&VERSION25=gnt6&VERSION24=interubs4';
		var url = 'https://bible.fhl.net/new/read.php?' + versions
			+ '&strongflag=0&TABFLAG=1'
			+ '&chineses=' + encodeURIComponent(book.fhl)
			+ '&chap=' + chapter;
		if (verse) url += '&sec=' + verse;
		return url + '&sub2=' + encodeURIComponent('版本對照');
	}

	/* cut.ibibles.net — 和合本（只到「章」，站上沒有逐節的 anchor）
	   例：https://cut.ibibles.net/019Psalms.htm#019-76 */
	function ibibles(book, chapter) {
		var num = book.cut.slice(0, 3); /* 檔名前三位＝該站的書卷號，錨點也用它 */
		return 'https://cut.ibibles.net/' + book.cut + '#' + num + '-' + chapter;
	}

	/* biblehub — 逐節頁（英文各譯本 + 原文區塊）
	   例：https://biblehub.com/ephesians/4-15.htm */
	function biblehub(book, chapter, verse) {
		if (!verse) return 'https://biblehub.com/' + book.hub + '/' + chapter + '.htm';
		return 'https://biblehub.com/' + book.hub + '/' + chapter + '-' + verse + '.htm';
	}

	/* biblehub 原文逐字對照（希伯來文／希臘文 + Strong's 編號）── 「連到原文」用這個
	   例：https://biblehub.com/interlinear/psalms/76-11.htm */
	function interlinear(book, chapter, verse) {
		if (!verse) return 'https://biblehub.com/interlinear/' + book.hub + '/' + chapter + '.htm';
		return 'https://biblehub.com/interlinear/' + book.hub + '/' + chapter + '-' + verse + '.htm';
	}

	/* bibleread.online — 英文恢復本（逐節 anchor 是純數字 id）
	   例：https://bibleread.online/bible/psalms/76/#11 */
	function bibleread(book, chapter, verse) {
		var url = 'https://bibleread.online/bible/' + book.bro + '/' + chapter + '/';
		if (verse) url += '#' + verse;
		return url;
	}

	/* 一節經文的全部外部連結，依「原文優先」排序 */
	function linksFor(book, chapter, verse) {
		return [
			{ key: 'fhl',         label: '信望愛版本對照', title: book.ot ? '信望愛：和合本、恢復本並排舊約馬索拉原文' : '信望愛：和合本、恢復本並排 UBS6 希臘文與希中逐字對照', href: fhl(book, chapter, verse) },
			{ key: 'interlinear', label: 'biblehub 原文逐字', title: 'biblehub 原文逐字對照（含 Strong’s 編號）', href: interlinear(book, chapter, verse) },
			{ key: 'biblehub',    label: 'biblehub 譯本', title: 'biblehub 逐節頁（英文各譯本與原文）',           href: biblehub(book, chapter, verse) },
			{ key: 'bibleread',   label: '英文恢復本', title: 'bibleread.online（英文恢復本）',              href: bibleread(book, chapter, verse) },
			{ key: 'ibibles',     label: '和合本',   title: 'cut.ibibles.net 和合本（只能到整章）',          href: ibibles(book, chapter) },
			{ key: 'recovery',    label: '恢復本站', title: '網上聖經恢復本的這一章',                        href: recoveryVersion(book, chapter) },
		];
	}

	var sources = {
		recoveryVersion: recoveryVersion,
		fhl: fhl,
		ibibles: ibibles,
		biblehub: biblehub,
		interlinear: interlinear,
		bibleread: bibleread,
		linksFor: linksFor,
	};
	if (typeof module !== 'undefined' && module.exports) module.exports = sources;
	else root.Sources = sources;

})(typeof window !== 'undefined' ? window : this);
