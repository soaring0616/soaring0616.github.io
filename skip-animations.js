/*
	首頁動畫可跳過（skip）
	----------------------
	搭配 skip-animations.css。在 assets/js/main.js 之後載入，
	此時 jQuery 與 scrollex 都已就緒，首頁各區塊的 .is-inactive 也已經掛上。

	狀態放在 <html> 的 .anim-skip（<head> 的 inline script 會先讀 localStorage
	搶在第一次 paint 前掛好，避免閃一下動畫再跳掉），選擇記在 localStorage。
*/

(function ($) {

	var KEY = 'skip-animations',
		$html = $('html'),
		$body = $('body'),
		$button = $('#skip-animations');

	function isSkipping() {
		return $html.hasClass('anim-skip');
	}

	function remember(skip) {
		try {
			if (skip)
				window.localStorage.setItem(KEY, '1');
			else
				window.localStorage.removeItem(KEY);
		}
		catch (e) {
			// 無痕模式或 localStorage 被停用：這次仍然有效，只是不會記住。
		}
	}

	// 把 main.js 架起來的動畫狀態拆掉，讓所有內容立刻顯示。
	function revealAll() {

		// unscrollex 會觸發 terminate，也就是 main.js 裡的 removeClass('is-inactive')。
		$('#wrapper').children().unscrollex();
		$('.items').unscrollex();
		$('.gallery').unscrollex();

		// 保險：不管是誰加上的起始狀態，一律清掉。
		$body.removeClass('is-preload');
		$('.is-inactive').removeClass('is-inactive');

	}

	function syncButton() {
		if (!$button.length)
			return;

		var skipping = isSkipping();

		$button
			.text(skipping ? '重播動畫' : '跳過動畫')
			.attr('aria-pressed', skipping ? 'true' : 'false')
			.attr('title', skipping ? '把首頁動畫放回來' : '略過進場與捲動淡入動畫，直接顯示全部內容');
	}

	// 作業系統設定了減少動態效果，就當作已經跳過（但不寫進 localStorage，交給系統設定決定）。
	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
		$html.addClass('anim-skip');

	// 這次載入就是無動畫狀態（記住的選擇或系統設定）→ 直接全部顯示。
	if (isSkipping())
		revealAll();

	syncButton();

	$button.on('click', function (event) {

		event.preventDefault();

		if (isSkipping()) {
			// 重播：忘掉偏好並重新整理，從頭再看一次動畫。
			remember(false);
			window.location.reload();
			return;
		}

		$html.addClass('anim-skip');
		remember(true);
		revealAll();
		syncButton();

	});

})(jQuery);
