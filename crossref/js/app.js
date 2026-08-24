/* 串珠探索 — 選單 / 節點圖 / 側欄 / cwwl / 焦點模式 的協調 */
'use strict';

(function () {
  var ACCENT = '#47D3E5', ACCENT_DARK = '#1ebdd1';
  var NODE_CAP = 300;
  var BRIDGE_CAP = 60;
  var FONT_FACE = '"Source Sans Pro","Noto Sans TC","Microsoft JhengHei",sans-serif';

  var $ = function (id) { return document.getElementById(id); };
  var selBook = $('sel-book'), selChapter = $('sel-chapter'), selVerse = $('sel-verse');
  var btnGo = $('btn-go'), btnClear = $('btn-clear');
  var panel = $('panel'), graphEl = $('graph');
  var errorBanner = $('error-banner'), errorMsg = $('error-msg');
  var btnRetry = $('btn-retry'), btnErrorClose = $('btn-error-close');
  var toastEl = $('toast'), toastTimer = null;
  var cwwlForm = $('cwwl-form');
  var focusBox = $('focus-box'), focusInput = $('focus-input');
  var btnFocusBuild = $('btn-focus-build'), btnFocusExit = $('btn-focus-exit');

  var nodes = new vis.DataSet();
  var edges = new vis.DataSet();
  var expanded = {};          /* nodeId → true（一般模式） */
  var selectedId = null;
  var capNotified = false;
  var network = null;
  var introHTML = '';

  /* 焦點模式狀態：null = 一般模式 */
  var focusPassages = null;   /* [{b,c,v1,v2}] */
  var focusStats = null;      /* {directs, bridges} */

  /* ── helpers ── */

  function key(b, c, v) { return b + '.' + c + '.' + v; }

  function refLabel(b, c, v) {
    var bk = BOOK_BY_CODE[b];
    return (bk ? bk.abbr : '?') + ' ' + c + ':' + v;
  }

  function passageLabel(p) {
    var bk = BOOK_BY_CODE[p.b];
    return bk.abbr + ' ' + p.c + ':' + p.v1 + (p.v2 > p.v1 ? '-' + p.v2 : '');
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

  function focusNodeStyle() {
    return {
      borderWidth: 2,
      margin: 10,
      font: { size: 16, color: '#0e6874' },
      color: { background: 'rgba(71,211,229,0.18)', border: ACCENT,
        highlight: { background: 'rgba(71,211,229,0.32)', border: ACCENT_DARK } },
    };
  }

  function bridgeNodeStyle() {
    return {
      font: { size: 12, color: '#666' },
      color: { background: '#fff', border: '#c9c9c9',
        highlight: { background: 'rgba(71,211,229,0.15)', border: ACCENT } },
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
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 4000);
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

  function clearGraph() {
    nodes.clear();
    edges.clear();
    expanded = {};
    selectedId = null;
    capNotified = false;
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

  /* ── 一般模式主流程 ── */

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
      renderPanel(b, c, v, verses, foots, flag.stale, {});
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

  /* ── 焦點模式 ── */

  /* 「彼前二4～5，亞三9，四10」→ [{b,c,v1,v2}] */
  function parsePassageList(text) {
    var norm = String(text || '').replace(/[\r\n]+/g, '，');
    var out = RVParser.parseBeaded(norm, null, null);
    var seen = {}, ps = [];
    out.refs.forEach(function (r) {
      var v2 = r.vEnd || r.v;
      var k = r.b + '.' + r.c + '.' + r.v + '-' + v2;
      if (seen[k]) return;
      seen[k] = 1;
      ps.push({ b: r.b, c: r.c, v1: r.v, v2: v2 });
    });
    return { passages: ps, unparsed: out.unparsed };
  }

  /* 節（或節範圍）落在哪個焦點段落？回 index 或 -1 */
  function findPassage(b, c, v, vEnd) {
    var e = vEnd || v;
    for (var i = 0; i < focusPassages.length; i++) {
      var p = focusPassages[i];
      if (p.b === b && p.c === c && v <= p.v2 && e >= p.v1) return i;
    }
    return -1;
  }

  function buildFocusGraph() {
    var parsed = parsePassageList(focusInput.value);
    if (!parsed.passages.length) {
      toast('無法解析經節清單，請用如「彼前二4～5，約十11～16」的格式');
      return;
    }
    if (parsed.unparsed.length) toast('略過無法解析的：' + parsed.unparsed.join('、'));
    var ps = parsed.passages;

    var chapters = {};
    ps.forEach(function (p) { chapters[p.b + '.' + p.c] = p; });
    var chKeys = Object.keys(chapters);

    btnFocusBuild.disabled = true;
    btnFocusBuild.textContent = '載入中…';
    Promise.all(chKeys.map(function (k) {
      return RVApi.getChapterFoots(chapters[k].b, chapters[k].c);
    })).then(function (footsArr) {
      hideError();
      var footsByCh = {};
      chKeys.forEach(function (k, i) { footsByCh[k] = footsArr[i]; });

      focusPassages = ps;
      clearGraph();
      btnFocusExit.hidden = false;
      if (history.replaceState) {
        history.replaceState(null, '', '#f=' + encodeURIComponent(focusInput.value.trim()));
      }

      ps.forEach(function (p, i) {
        nodes.add(Object.assign({ id: 'p:' + i, label: passageLabel(p) }, focusNodeStyle()));
      });

      var directs = {};  /* "i>j" → [說明] */
      var bridges = {};  /* "b.c.v" → {set:{passageIdx:1}, details:[]} */
      ps.forEach(function (p, i) {
        var foots = footsByCh[p.b + '.' + p.c];
        for (var v = p.v1; v <= p.v2; v++) {
          (foots[v] || []).forEach(function (e) {
            RVParser.parseBeaded(e.content, p.b, p.c).refs.forEach(function (r) {
              var j = findPassage(r.b, r.c, r.v, r.vEnd);
              if (j === i) return; /* 段落內部串珠不畫 */
              var detail = refLabel(p.b, p.c, v) + ' → ' + refLabel(r.b, r.c, r.v);
              if (j !== -1) {
                (directs[i + '>' + j] = directs[i + '>' + j] || []).push(detail);
              } else {
                var bk = key(r.b, r.c, r.v);
                var br = (bridges[bk] = bridges[bk] || { set: {}, details: [] });
                br.set[i] = 1;
                br.details.push(detail);
              }
            });
          });
        }
      });

      Object.keys(directs).forEach(function (ek) {
        var ij = ek.split('>');
        var d = directs[ek];
        edges.add({
          id: 'e' + ek, from: 'p:' + ij[0], to: 'p:' + ij[1],
          width: Math.min(1 + d.length, 4),
          color: { color: ACCENT, highlight: ACCENT_DARK },
          title: d.join('\n'),
          label: d.length > 1 ? String(d.length) : undefined,
          font: { size: 11, color: '#888' },
        });
      });

      /* 橋接經節：被兩個以上焦點段落共同引用 */
      var bridgeKeys = Object.keys(bridges).filter(function (k) {
        return Object.keys(bridges[k].set).length >= 2;
      });
      if (bridgeKeys.length > BRIDGE_CAP) {
        bridgeKeys.sort(function (a, b) {
          return Object.keys(bridges[b].set).length - Object.keys(bridges[a].set).length;
        });
        toast('橋接經節較多，只顯示引用最多的前 ' + BRIDGE_CAP + ' 個');
        bridgeKeys = bridgeKeys.slice(0, BRIDGE_CAP);
      }
      bridgeKeys.forEach(function (k) {
        var parts = k.split('.').map(Number);
        nodes.add(Object.assign({ id: k, label: refLabel(parts[0], parts[1], parts[2]) }, bridgeNodeStyle()));
        Object.keys(bridges[k].set).forEach(function (i) {
          edges.add({
            id: 'b' + k + ':' + i, from: 'p:' + i, to: k,
            dashes: true,
            color: { color: '#ccc', highlight: ACCENT },
            title: bridges[k].details.join('\n'),
          });
        });
      });

      focusStats = { directs: Object.keys(directs).length, bridges: bridgeKeys.length };
      network.fit({ animation: { duration: 500 } });
      renderFocusSummary();
    }).catch(function () {
      showError(buildFocusGraph);
    }).finally(function () {
      btnFocusBuild.disabled = false;
      btnFocusBuild.textContent = '建立焦點圖';
    });
  }

  function exitFocusMode() {
    focusPassages = null;
    focusStats = null;
    btnFocusExit.hidden = true;
    clearGraph();
    panel.innerHTML = introHTML;
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }

  /* ── side panel ── */

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* 串珠列（chips）；onRef = 點 chip 時的行為 */
  function appendFootRows(container, b, c, entries, onRef) {
    if (!entries.length) {
      container.appendChild(el('p', 'empty-note', '本節沒有串珠。'));
      return;
    }
    entries.forEach(function (e) {
      var row = el('div', 'foot-row');
      if (e.beaded) row.appendChild(el('span', 'foot-letter', e.beaded));
      var parsed = RVParser.parseBeaded(e.content, b, c);
      parsed.refs.forEach(function (r) {
        var label = refLabel(r.b, r.c, r.v) + (r.vEnd ? '-' + r.vEnd : '');
        var chip = el('button', 'ref-chip' + (r.cf ? ' cf' : ''), (r.cf ? '參 ' : '') + label);
        chip.title = r.text;
        chip.onclick = function () { onRef(r.b, r.c, r.v); };
        row.appendChild(chip);
      });
      parsed.unparsed.forEach(function (u) {
        row.appendChild(el('span', 'unparsed-text', u));
      });
      container.appendChild(row);
    });
  }

  function appendCwwlButton(container, b, c, v) {
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
    container.appendChild(actions);
  }

  function renderPanel(b, c, v, verses, foots, stale, opts) {
    var bk = BOOK_BY_CODE[b];
    panel.innerHTML = '';

    if (opts.lite && focusPassages) {
      var back = el('button', 'btn small', '← 回焦點總覽');
      back.onclick = renderFocusSummary;
      panel.appendChild(back);
    }

    panel.appendChild(el('div', 'verse-ref', bk.name + ' ' + c + ':' + v));
    if (stale) panel.appendChild(el('p', 'status-note', '目前無法連線，顯示快取內容。'));
    panel.appendChild(el('div', 'verse-text', verses[v] || '（查無此節經文）'));

    panel.appendChild(el('div', 'section-label', '串　珠'));
    appendFootRows(panel, b, c, foots[v] || [], opts.lite ? showVerseLite : navigateTo);
    if (opts.lite) {
      panel.appendChild(el('p', 'fine-print', '焦點模式中，點串珠只切換側欄內容，不會加進圖裡。'));
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

    appendCwwlButton(panel, b, c, v);
  }

  /* 焦點模式：只看內容，不動圖形 */
  function showVerseLite(b, c, v) {
    setBusy(true);
    var flag = { stale: false };
    Promise.all([
      withStale(RVApi.getChapterVerses(b, c), flag),
      withStale(RVApi.getChapterFoots(b, c), flag),
    ]).then(function (results) {
      hideError();
      renderPanel(b, c, v, results[0], results[1], flag.stale, { lite: true });
    }).catch(function () {
      showError(function () { showVerseLite(b, c, v); });
    }).finally(function () { setBusy(false); });
  }

  function renderFocusSummary() {
    if (!focusPassages) return;
    panel.innerHTML = '';
    panel.appendChild(el('div', 'verse-ref', '焦點總覽'));
    var hint = el('p', 'status-note');
    hint.textContent = focusPassages.length + ' 個段落，彼此直接串珠 ' +
      (focusStats ? focusStats.directs : 0) + ' 組，共同引用的橋接經節 ' +
      (focusStats ? focusStats.bridges : 0) + ' 個。';
    panel.appendChild(hint);

    panel.appendChild(el('div', 'section-label', '焦點段落'));
    focusPassages.forEach(function (p, i) {
      var chip = el('button', 'ref-chip', passageLabel(p));
      chip.onclick = function () { renderPassagePanel(i); };
      panel.appendChild(chip);
    });

    var legend = el('div', null);
    legend.appendChild(el('div', 'section-label', '圖例'));
    legend.appendChild(el('p', 'fine-print',
      '青色粗框＝焦點段落；實線＝段落之間的直接串珠（線上數字是次數，滑過可看明細）；' +
      '灰色小節點＝被兩個以上段落共同引用的橋接經節（虛線相連）。' +
      '點任何節點可在側欄看經文與串珠，圖形不會再擴張。'));
    panel.appendChild(legend);
  }

  function renderPassagePanel(idx) {
    var p = focusPassages[idx];
    setBusy(true);
    var flag = { stale: false };
    Promise.all([
      withStale(RVApi.getChapterVerses(p.b, p.c), flag),
      withStale(RVApi.getChapterFoots(p.b, p.c), flag),
    ]).then(function (results) {
      hideError();
      var verses = results[0], foots = results[1];
      panel.innerHTML = '';
      var back = el('button', 'btn small', '← 回焦點總覽');
      back.onclick = renderFocusSummary;
      panel.appendChild(back);
      panel.appendChild(el('div', 'verse-ref',
        BOOK_BY_CODE[p.b].name + ' ' + p.c + ':' + p.v1 + (p.v2 > p.v1 ? '～' + p.v2 : '')));
      if (flag.stale) panel.appendChild(el('p', 'status-note', '目前無法連線，顯示快取內容。'));

      for (var v = p.v1; v <= p.v2; v++) {
        (function (v) {
          var head = el('div', 'passage-verse-head');
          head.appendChild(el('span', 'passage-verse-num', p.c + ':' + v));
          var more = el('button', 'ref-chip', '詳');
          more.title = '單獨檢視本節（含註解與職事文集）';
          more.onclick = function () { showVerseLite(p.b, p.c, v); };
          head.appendChild(more);
          panel.appendChild(head);
          panel.appendChild(el('div', 'verse-text', verses[v] || '（查無此節經文）'));
          appendFootRows(panel, p.b, p.c, foots[v] || [], showVerseLite);
        })(v);
      }
    }).catch(function () {
      showError(function () { renderPassagePanel(idx); });
    }).finally(function () { setBusy(false); });
  }

  /* ── init ── */

  function initNetwork() {
    network = new vis.Network(graphEl, { nodes: nodes, edges: edges }, {
      nodes: {
        shape: 'box',
        shapeProperties: { borderRadius: 6 },
        borderWidth: 1.5,
        margin: 8,
        font: { face: FONT_FACE, size: 15 },
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
      var id = String(params.nodes[0]);
      if (focusPassages) {
        if (id.indexOf('p:') === 0) renderPassagePanel(Number(id.slice(2)));
        else {
          var bp = id.split('.').map(Number);
          showVerseLite(bp[0], bp[1], bp[2]);
        }
        return;
      }
      var parts = id.split('.').map(Number);
      navigateTo(parts[0], parts[1], parts[2]);
    });
  }

  function init() {
    introHTML = panel.innerHTML;
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
      if (focusPassages) showVerseLite(b, c, v);
      else showVerse(b, c, v);
    });

    btnClear.addEventListener('click', function () {
      if (focusPassages) exitFocusMode();
      else clearGraph();
    });

    btnFocusBuild.addEventListener('click', buildFocusGraph);
    btnFocusExit.addEventListener('click', exitFocusMode);
    btnErrorClose.addEventListener('click', hideError);

    if (/[?&]test=1/.test(location.search)) RVParser.selfTest();

    var mf = /^#f=(.+)$/.exec(location.hash);
    var m = /^#(\d+)\.(\d+)\.(\d+)$/.exec(location.hash);
    if (mf) {
      try { focusInput.value = decodeURIComponent(mf[1]); } catch (e) {}
      if (focusInput.value) {
        focusBox.open = true;
        buildFocusGraph();
      }
    } else if (m) {
      navigateTo(Number(m[1]), Number(m[2]), Number(m[3]));
    } else {
      /* 預設起點：約翰福音 3:16 */
      setSelectors(43, 3, 16);
    }
  }

  init();
})();
