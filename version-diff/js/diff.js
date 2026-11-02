/*
	逐字比對
	--------
	中文沒有詞界，所以直接以「字」為單位做最長共同子序列（LCS），
	再把結果併成一段一段的 same / del / ins。一節經文大約幾十個字，
	一章幾十節，DP 的量很小，瀏覽器裡瞬間跑完。

	段落的 type：
	  same   = 兩邊都有
	  del    = 只有和合本有（要標色）
	  ins    = 只有恢復本有（要標色）
	  puncta = 和合本的標點，沒參與比對（只在和合本那一欄當普通文字顯示）
	  punctb = 恢復本的標點，同理

	所以一次 diffChars(和合本, 恢復本) 的結果可以同時畫出兩欄：
	  和合本欄顯示 same / del / puncta，恢復本欄顯示 same / ins / punctb。
*/
'use strict';

(function (root) {

	/* 比對時要不要忽略的字元：標點與空白。
	   兩個版本的標點習慣本來就不同，不濾掉的話整章都會被標成「有差異」。 */
	var PUNCT_RE = /[\s，。、；：？！「」『』（）〔〕【】—…·《》〈〉,.;:?!"'()\[\]\-]/g;

	function strip(s) {
		return String(s == null ? '' : s).replace(PUNCT_RE, '');
	}

	function chars(s) {
		/* 用 Array.from 以免把非 BMP 字元（罕用字）切成兩半 */
		return Array.from(String(s == null ? '' : s));
	}

	/*
		回傳 [{ type: 'same'|'del'|'ins', text: '…' }, …]
		ignorePunct 為真時，標點不參與比對，但仍會原樣保留在輸出裡
		（掛在它前面那一段上，所以讀起來還是通順的句子）。
	*/
	function diffChars(aStr, bStr, ignorePunct) {
		var a = chars(aStr), b = chars(bStr);

		/* 建立「參與比對的位置」索引 */
		var ai = [], bi = [];
		for (var i = 0; i < a.length; i++) if (!ignorePunct || !PUNCT_RE.test(a[i])) ai.push(i);
		for (var j = 0; j < b.length; j++) if (!ignorePunct || !PUNCT_RE.test(b[j])) bi.push(j);
		PUNCT_RE.lastIndex = 0;

		var n = ai.length, m = bi.length;

		/* LCS 長度表 */
		var dp = [];
		for (var x = 0; x <= n; x++) dp.push(new Uint32Array(m + 1));
		for (var x1 = n - 1; x1 >= 0; x1--) {
			for (var y1 = m - 1; y1 >= 0; y1--) {
				dp[x1][y1] = (a[ai[x1]] === b[bi[y1]])
					? dp[x1 + 1][y1 + 1] + 1
					: Math.max(dp[x1 + 1][y1], dp[x1][y1 + 1]);
			}
		}

		/* 回溯成 op 串，順便把被濾掉的標點補回原位 */
		var ops = [];
		var p = 0, q = 0, pa = 0, pb = 0;

		/* 被 ignorePunct 濾掉的標點：原樣留著，但標成中性的 puncta/punctb，
		   只在「自己那一欄」當普通文字顯示，不會被當成差異標色。 */
		function flushA(upto) {
			while (pa < upto) { ops.push(['puncta', a[pa]]); pa++; }
		}
		function flushB(upto) {
			while (pb < upto) { ops.push(['punctb', b[pb]]); pb++; }
		}

		while (p < n && q < m) {
			if (a[ai[p]] === b[bi[q]]) {
				/* 相同字：先把它前面被跳過的標點各自吐出來 */
				flushA(ai[p]); flushB(bi[q]);
				ops.push(['same', a[ai[p]]]);
				pa = ai[p] + 1; pb = bi[q] + 1;
				p++; q++;
			} else if (dp[p + 1][q] >= dp[p][q + 1]) {
				flushA(ai[p]);
				ops.push(['del', a[ai[p]]]);
				pa = ai[p] + 1;
				p++;
			} else {
				flushB(bi[q]);
				ops.push(['ins', b[bi[q]]]);
				pb = bi[q] + 1;
				q++;
			}
		}
		while (p < n) { flushA(ai[p]); ops.push(['del', a[ai[p]]]); pa = ai[p] + 1; p++; }
		while (q < m) { flushB(bi[q]); ops.push(['ins', b[bi[q]]]); pb = bi[q] + 1; q++; }
		flushA(a.length); flushB(b.length);

		/* 併成連續的段 */
		var segs = [];
		ops.forEach(function (op) {
			var last = segs[segs.length - 1];
			if (last && last.type === op[0]) last.text += op[1];
			else segs.push({ type: op[0], text: op[1] });
		});
		return segs;
	}

	/* 兩節是否有實質差異（忽略標點後仍不同） */
	function differs(aStr, bStr) {
		return strip(aStr) !== strip(bStr);
	}

	/*
		差異的「量」：不同的字數 ÷ 較長一邊的字數，0～1。
		只用來排序與分級（細微／明顯），不是什麼精密指標。
	*/
	function magnitude(aStr, bStr) {
		var a = strip(aStr), b = strip(bStr);
		if (!a && !b) return 0;
		var segs = diffChars(a, b, false);
		var changed = 0;
		segs.forEach(function (s) { if (s.type !== 'same') changed += Array.from(s.text).length; });
		var denom = Math.max(Array.from(a).length, Array.from(b).length) || 1;
		return Math.min(1, changed / (denom * 2));
	}

	/* 把差異的片語抽出來，給清單當摘要用（只取片段，不是整節） */
	function phrases(aStr, bStr, ignorePunct) {
		var segs = diffChars(aStr, bStr, ignorePunct !== false);
		var unv = [], rcv = [];
		segs.forEach(function (s) {
			if (s.type === 'del' && strip(s.text)) unv.push(s.text);
			if (s.type === 'ins' && strip(s.text)) rcv.push(s.text);
		});
		return { unv: unv, rcv: rcv };
	}

	var mod = {
		diffChars: diffChars,
		differs: differs,
		magnitude: magnitude,
		phrases: phrases,
		strip: strip,
	};
	if (typeof module !== 'undefined' && module.exports) module.exports = mod;
	else root.VDDiff = mod;

})(typeof window !== 'undefined' ? window : this);
