/*
	外部來源的逐節連結
	------------------
	下面每一個網址格式都實地開過、確認會到正確的頁面，確認結果寫在各函式上面。
	若哪天對方改版，只要改這個檔案。
*/
'use strict';

(function (root) {

	/* 恢復本（台灣福音書房「網上聖經恢復本」）
	   這站是前端渲染的，沒有可以直接跳到某卷某章的網址，所以只能連到首頁。
	   經文本身由 api.js 走它公開的 API 取得，不靠這個連結。 */
	function recoveryVersion() {
		return 'https://www.recoveryversion.com.tw/';
	}

	/* 信望愛 — 和合本（確認可用，伺服器端算好的 HTML，直接定位到該節）
	   例：https://bible.fhl.net/new/read.php?chineses=弗&chap=4&sec=15 */
	function fhl(book, chapter, verse) {
		var url = 'https://bible.fhl.net/new/read.php?chineses=' + encodeURIComponent(book.fhl)
			+ '&chap=' + chapter;
		if (verse) url += '&sec=' + verse;
		return url;
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
			{ key: 'interlinear', label: '原文逐字', title: 'biblehub 原文逐字對照（含 Strong’s 編號）', href: interlinear(book, chapter, verse) },
			{ key: 'biblehub',    label: 'biblehub', title: 'biblehub 逐節頁（英文各譯本與原文）',           href: biblehub(book, chapter, verse) },
			{ key: 'bibleread',   label: '英文恢復本', title: 'bibleread.online（英文恢復本）',              href: bibleread(book, chapter, verse) },
			{ key: 'fhl',         label: '信望愛',   title: '信望愛聖經工具（和合本，可切換多種中文譯本）',  href: fhl(book, chapter, verse) },
			{ key: 'ibibles',     label: '和合本',   title: 'cut.ibibles.net 和合本（只能到整章）',          href: ibibles(book, chapter) },
			{ key: 'recovery',    label: '恢復本站', title: '網上聖經恢復本首頁（該站無法直接連到章節）',    href: recoveryVersion() },
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
