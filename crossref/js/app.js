/* 串珠探索 — 選單 / 節點圖 / 側欄 / cwwl 的協調 */
'use strict';

(function () {
  var ACCENT = '#47D3E5', ACCENT_DARK = '#1ebdd1';
  var NODE_CAP = 300;

  var $ = function (id) { return document.getElementById(id); };
  var selBook = $('sel-book'), selChapter = $('sel-chapter'), selVerse = $('sel-verse');
  var btnGo = $('btn-go'), btnClear = $('btn-clear');
  var panel = $('panel'), graphEl = $('graph');
  var errorBanner = $('error-banner'), errorMsg = $('error-msg');
  var btnRetry = $('btn-retry'), btnErrorClose = $('btn-error-close');
  var toastEl = $('toast'), toastTimer = null;
  var cwwlForm = $('cwwl-form');

  var nodes = new vis.DataSet();
  var edges = new vis.DataSet();
  var expanded = {};          /* nodeId → true */
  var selectedId = null;
  var capNotified = false;
  var network = null;

  /* ── helpers ── */

  function key(b, c, v) { return b + '.' + c + '.' + v; }

  function refLabel(b, c, v) {
    var bk = BOOK_BY_CODE[b];
    return (bk ? bk.abbr : '?') + ' ' + c + ':' + v;
  }

  function nodeColors(state) {
    if (state === 'selected') {
      return {
        color: { background: ACCENT, border: ACCENT_DARK,
          highlight: { background: ACCENT, border: ACCENT_DARK } },
        font: { color: '#fff' },
      };
    }
    if (state === 'expanded') {
      return {
        color: { background: '#fff', border: ACCENT,
          highlight: { background: 'rgba(71,211,229,0.15)', border: ACCENT_DARK } },
        font: { color: '#111' },
      };
    }
    return {
      color: { background: '#fff', border: '#c9c9c9',
        highlight: { background: 'rgba(71,211,229,0.15)', border: ACCENT } },
      font: { color: '#555' },
    };
  }

  function nodeState(id) {
    if (id === selectedId) return 'selected';
    return expanded[id] ? 'expanded' : 'frontier';
  }

  function restyleNode(id) {
    if (nodes.get(id)) nodes.update(Object.assign({ id: id }, nodeColors(nodeState(id))));
  }

  function ensureNode(b, c, v) {
    var id = key(b, c, v);
    if (!nodes.get(id)) {
      nodes.add(Object.assign({ id: id, label: refLabel(b, c, v) }, nodeColors(nodeState(id))));
    }
    return id;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3000);
  }

  function showError(retryFn) {
    errorMsg.textContent = '無法連接恢復本經文網（recoveryversion.com.tw），請檢查網路後重試。';
    errorBanner.hidden = false;
    btnRetry.onclick = function () { errorBanner.hidden = true; retryFn(); };
  }

  function hideError() { errorBanner.hidden = true; }

  function setBusy(busy) {
    btnGo.disabled = busy;
    btnGo.textContent = busy ? '載入中…' : '查詢';
  }

  /* 網路失敗但 localStorage 有過期快取 → 用快取並回報 */
  function withStale(promise, flag) {
    return promise.catch(function (err) {
      if (err && err.staleData !== undefined) { flag.stale = true; return err.staleData; }
      throw err;
    });
  }

  /* ── selectors ── */

  function populateBooks() {
    var ogOT = document.createElement('optgroup'); ogOT.label = '舊約';
    var ogNT = document.createElement('optgroup'); ogNT.label = '新約';
    BOOKS.forEach(function (bk) {
      var opt = document.createElement('option');
      opt.value = bk.code;
      opt.textContent = bk.name;
      (bk.ot ? ogOT : ogNT).appendChild(opt);
    });
    selBook.appendChild(ogOT);
    selBook.appendChild(ogNT);
  }

  function fillChapters(b) {
    var bk = BOOK_BY_CODE[b];
    selChapter.innerHTML = '';
    for (var i = 1; i <= bk.chapters; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      selChapter.appendChild(opt);
    }
  }

  function fillVerses(b, c) {
    selVerse.innerHTML = '<option value="">…</option>';
    return RVApi.getChapterVerses(b, c).then(function (verses) {
      var nums = Object.keys(verses).map(Number).sort(function (x, y) { return x - y; });
      selVerse.innerHTML = '';
      nums.forEach(function (n) {
        var opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        selVerse.appendChild(opt);
      });
    }).catch(function () {
      /* 章節數未知時退而求其次：給 1–80 讓使用者仍可查詢 */
      selVerse.innerHTML = '';
      for (var i = 1; i <= 80; i++) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        selVerse.appendChild(opt);
      }
    });
  }

  function setSelectors(b, c, v) {
    selBook.value = b;
    fillChapters(b);
    selChapter.value = c;
    fillVerses(b, c).then(function () { selVerse.value = v; });
  }

  /* ── main flow ── */

  function navigateTo(b, c, v) {
    setSelectors(b, c, v);
    showVerse(b, c, v);
  }

  function showVerse(b, c, v) {
    if (history.replaceState) history.replaceState(null, '', '#' + key(b, c, v));
    setBusy(true);
    var flag = { stale: false };
    Promise.all([
      withStale(RVApi.getChapterVerses(b, c), flag),
      withStale(RVApi.getChapterFoots(b, c), flag),
    ]).then(function (results) {
      hideError();
      var verses = results[0], foots = results[1];
      var prev = selectedId;
      selectedId = ensureNode(b, c, v);
      if (prev && prev !== selectedId) restyleNode(prev);
      addToGraph(b, c, v, foots[v] || []);
      renderPanel(b, c, v, verses, foots, flag.stale);
      network.focus(key(b, c, v), { scale: Math.max(network.getScale(), 0.8), animation: { duration: 500 } });
    }).catch(function () {
      showError(function () { showVerse(b, c, v); });
    }).finally(function () { setBusy(false); });
  }

  function addToGraph(b, c, v, footEntries) {
    var id = ensureNode(b, c, v);
    var refs = [];
    footEntries.forEach(function (e) {
      refs = refs.concat(RVParser.parseBeaded(e.content, b, c).refs);
    });
    if (!capNotified && nodes.length + refs.length > NODE_CAP) {
      capNotified = true;
      toast('圖形節點較多，可按「清除圖形」重新開始');
    }
    refs.forEach(function (r) {
      var rid = key(r.b, r.c, r.v);
      if (rid === id) return; /* 平行經文映射可能自我參照，跳過 */
      ensureNode(r.b, r.c, r.v);
      var eid = id + '->' + rid;
      if (!edges.get(eid)) {
        edges.add({
          id: eid, from: id, to: rid,
          dashes: !!r.cf,
          color: { color: '#bbb', highlight: ACCENT },
        });
      }
    });
    expanded[id] = true;
    restyleNode(id);
  }

  /* ── side panel ── */

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderPanel(b, c, v, verses, foots, stale) {
    var bk = BOOK_BY_CODE[b];
    panel.innerHTML = '';

    panel.appendChild(el('div', 'verse-ref', bk.name + ' ' + c + ':' + v));
    if (stale) panel.appendChild(el('p', 'status-note', '目前無法連線，顯示快取內容。'));
    panel.appendChild(el('div', 'verse-text', verses[v] || '（查無此節經文）'));

    /* 串珠 */
    panel.appendChild(el('div', 'section-label', '串　珠'));
    var entries = foots[v] || [];
    if (!entries.length) {
      panel.appendChild(el('p', 'empty-note', '本節沒有串珠。'));
    } else {
      entries.forEach(function (e) {
        var row = el('div', 'foot-row');
        if (e.beaded) row.appendChild(el('span', 'foot-letter', e.beaded));
        var parsed = RVParser.parseBeaded(e.content, b, c);
        parsed.refs.forEach(function (r) {
          var label = refLabel(r.b, r.c, r.v) + (r.vEnd ? '-' + r.vEnd : '');
          var chip = el('button', 'ref-chip' + (r.cf ? ' cf' : ''), (r.cf ? '參 ' : '') + label);
          chip.title = r.text;
          chip.onclick = function () { navigateTo(r.b, r.c, r.v); };
          row.appendChild(chip);
        });
        parsed.unparsed.forEach(function (u) {
          row.appendChild(el('span', 'unparsed-text', u));
        });
        panel.appendChild(row);
      });
    }

    /* 註解（第一次展開才載入） */
    panel.appendChild(el('div', 'section-label', '註　解'));
    var details = el('details', 'notes');
    var summary = el('summary', null, '展開本節註解');
    var notesBody = el('div', null);
    details.appendChild(summary);
    details.appendChild(notesBody);
    panel.appendChild(details);
    var notesLoaded = false;
    details.addEventListener('toggle', function () {
      if (!details.open || notesLoaded) return;
      notesLoaded = true;
      notesBody.appendChild(el('p', 'status-note', '載入中…'));
      RVApi.getChapterFootnotes(b, c).then(function (notes) {
        notesBody.innerHTML = '';
        var list = notes[v] || [];
        if (!list.length) {
          notesBody.appendChild(el('p', 'empty-note', '本節沒有註解。'));
          return;
        }
        list.forEach(function (n) {
          var item = el('div', 'note-item');
          item.appendChild(el('span', 'note-num', '註' + n.num));
          item.appendChild(document.createTextNode(n.content));
          notesBody.appendChild(item);
        });
      }).catch(function () {
        notesBody.innerHTML = '';
        notesLoaded = false;
        notesBody.appendChild(el('p', 'status-note', '註解載入失敗，收合後再展開可重試。'));
      });
    });

    /* cwwl 職事文集 */
    var actions = el('div', 'panel-actions');
    var btn = el('button', 'btn', '查職事文集（李常受文集）↗');
    btn.onclick = function () {
      /* 必須在點擊 handler 內同步 submit，快顯封鎖才會放行 */
      cwwlForm.elements.f_BookNo.value = b;
      cwwlForm.elements.f_ChapterNo.value = c;
      cwwlForm.elements.f_VerseNo.value = v;
      cwwlForm.submit();
    };
    actions.appendChild(btn);
    actions.appendChild(el('p', 'fine-print', '在新分頁開啟李常受文集中引用本節的信息段落。'));
    panel.appendChild(actions);
  }

  /* ── init ── */

  function initNetwork() {
    network = new vis.Network(graphEl, { nodes: nodes, edges: edges }, {
      nodes: {
        shape: 'box',
        shapeProperties: { borderRadius: 6 },
        borderWidth: 1.5,
        margin: 8,
        font: { face: '"Source Sans Pro","Noto Sans TC","Microsoft JhengHei",sans-serif', size: 15 },
      },
      edges: {
        arrows: { to: { enabled: true, scaleFactor: 0.6 } },
        width: 1,
        smooth: { type: 'dynamic' },
      },
      physics: {
        barnesHut: { gravitationalConstant: -3500, springLength: 130, springConstant: 0.02 },
        stabilization: { iterations: 200 },
      },
      interaction: { hover: true },
    });

    network.on('click', function (params) {
      if (!params.nodes.length) return;
      var parts = String(params.nodes[0]).split('.').map(Number);
      navigateTo(parts[0], parts[1], parts[2]);
    });
  }

  function init() {
    populateBooks();
    initNetwork();

    selBook.addEventListener('change', function () {
      fillChapters(Number(selBook.value));
      fillVerses(Number(selBook.value), Number(selChapter.value));
    });
    selChapter.addEventListener('change', function () {
      fillVerses(Number(selBook.value), Number(selChapter.value));
    });

    btnGo.addEventListener('click', function () {
      var b = Number(selBook.value), c = Number(selChapter.value), v = Number(selVerse.value);
      if (!b || !c || !v) return;
      showVerse(b, c, v);
    });

    btnClear.addEventListener('click', function () {
      nodes.clear();
      edges.clear();
      expanded = {};
      selectedId = null;
      capNotified = false;
    });

    btnErrorClose.addEventListener('click', hideError);

    if (/[?&]test=1/.test(location.search)) RVParser.selfTest();

    var m = /^#(\d+)\.(\d+)\.(\d+)$/.exec(location.hash);
    if (m) {
      navigateTo(Number(m[1]), Number(m[2]), Number(m[3]));
    } else {
      /* 預設起點：約翰福音 3:16 */
      setSelectors(43, 3, 16);
    }
  }

  init();
})();
