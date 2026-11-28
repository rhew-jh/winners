/* ------------------------------------------------------------------
   WINNERS 빠른정답 — 정답이 "그림"인 문항 보기 (2026-11-27 · v3)
   · 빠른정답 시트에 정답이 "(그림)"처럼 들어 있는 문항은 칩을 눌러 그림을 띄운다.
   · 그림 파일은 이 저장소의 ans_img/ 아래에 둔다(GitHub Pages 정적 경로, 가장 빠르고 안 깨짐).
       기본 규칙 : ans_img/{교재키}/{쪽}p_{문항}.png      예) ans_img/중2-2__올백_중2-2_기말/15p_7.png
       교재키    : 교재ID의 '/'를 '__'로, 나머지 특수문자·공백은 '_'로 바꾼 것
   · 파일 이름을 규칙과 다르게 두고 싶으면 ans_img/manifest.json 에 경로를 적어 두면 그 경로를 먼저 쓴다.
       { "books": { "cho42": { "10": { "1": "ans_img/cho42/cho42_p02_01.png" } } },
         "parts": { "cho42": { "단원평가": { "3": { "7": "ans_img/cho42/cho42_p11_09-2.png" } } } },
         "titles": { "라이트쎈초421권": "cho42" } }
       - books  의 쪽은 「교재 본문 인쇄 쪽번호」다(정답지 PDF 쪽이 아님).
       - parts  는 단원평가·학업성취도평가처럼 평가편 자체 쪽번호를 쓰는 항목을 본문 쪽과 구분해 둔다.
                 화면이 다섯 번째 인자로 단원명/평가편 힌트를 주면 그 안에서 먼저 찾는다.
       - titles 는 교재ID를 모를 때를 위한 별칭표다. 화면이 교재 제목을 함께 넘기면
                 정규화한 제목으로 폴더 키를 찾는다(교재ID가 나중에 정해져도 그림이 연결된다).
   · manifest 에 한 번이라도 등록된 교재는, 없는 (쪽,문항)을 파일 이름 규칙으로 추측하지 않는다.
     (파일 이름이 정답지 PDF 쪽을 담고 있어 규칙으로 찾으면 다른 쪽 그림이 뜰 수 있다 → "그림 준비 중")
   · 그림이 아직 없으면 깨진 이미지 대신 "그림 준비 중" 안내만 보여 준다(수업 중 화면이 깨지지 않게).
   사용법: <script src="ans-img.js?v=4"></script>  →  WINNERS_ANSIMG.open(bookId, page, no [, bookTitle [, partHint]])
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var MAN_URL = 'ans_img/manifest.json';
  var man = null, manReq = null, styled = false;

  /* "(그림)" "(그림 3)" "그림" "[이미지]" 처럼 그림 정답인지 */
  function isFigure(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return false;
    return /그림|이미지/.test(s);
  }

  /* 교재ID → 경로에 쓸 수 있는 키 (추출 작업도 같은 규칙으로 이름을 만든다) */
  function key(bookId) {
    var s = String(bookId == null ? '' : bookId).trim();
    if (!s) return '';
    return s.replace(/\//g, '__')
            .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ._-]/g, '_')
            .replace(/_{3,}/g, '__');
  }

  /* 교재 제목 비교용 정규화 — 공백·괄호·기호를 모두 지우고 소문자로 */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  }

  function pageNo(page) { return String(page == null ? '' : page).replace(/p$/i, '').trim(); }

  /* 화면이 준 힌트(단원명·평가편 이름) → manifest.parts 의 키. 평가편 표지가 없으면 ''(힌트 없음) */
  function partName(hint) {
    var s = String(hint == null ? '' : hint).replace(/\s+/g, '');
    if (!s) return '';
    if (/학업성취도|성취도평가/.test(s)) return '학업성취도평가';
    if (/단원평가/.test(s)) return '단원평가';
    if (s === '본문') return '본문';
    return '';
  }

  /* 규칙 경로 */
  function rulePath(bookId, page, no) {
    var k = key(bookId);
    if (!k) return '';
    return 'ans_img/' + encodeURIComponent(k) + '/' +
           encodeURIComponent(pageNo(page) + 'p_' + String(no)) + '.png';
  }

  /* 별칭 폴더 안의 규칙 경로 — 예) ans_img/cho42/cho42_p02_01.png */
  function aliasRulePath(alias, page, no) {
    if (!alias) return '';
    var p = pageNo(page), n = String(no);
    if (!/^\d+$/.test(p) || !/^\d+$/.test(n)) return '';
    var pad = p.length < 2 ? ('0' + p) : p;
    var padNo = n.length < 2 ? ('0' + n) : n;
    return 'ans_img/' + encodeURIComponent(alias) + '/' +
           encodeURIComponent(alias + '_p' + pad + '_' + padNo) + '.png';
  }

  function loadManifest() {
    if (man) return Promise.resolve(man);
    if (manReq) return manReq;
    manReq = fetch(MAN_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var b = (j && (j.books || j)) || {};
        man = {
          books: b,
          parts: (j && j.parts) || {},
          titles: (j && j.titles) || {}
        };
        return man;
      })
      .catch(function () { man = { books: {}, parts: {}, titles: {} }; return man; });
    return manReq;
  }

  var lastResolve = null;

  /* bookId·제목으로 별칭(폴더 키) 찾기 : 교재ID → 교재키 → 제목 정확일치 → 제목 부분일치(유일할 때만) */
  function findAlias(bookId, title) {
    var m = man || { books: {}, parts: {}, titles: {} };
    var books = m.books || {}, titles = m.titles || {};
    var id = String(bookId == null ? '' : bookId).trim();
    if (id && books[id]) return id;
    var k = key(id);
    if (k && books[k]) return k;
    var t = norm(title);
    if (!t) return '';
    if (titles[t]) return titles[t];
    /* 제목 표기가 조금 달라도(수식어·연도) 한 권으로만 걸리면 그 권으로 본다 */
    var hits = [];
    Object.keys(titles).forEach(function (alias) {
      if (alias.length < 6 || t.length < 6) return;
      if (t.indexOf(alias) >= 0 || alias.indexOf(t) >= 0) hits.push(titles[alias]);
    });
    var uniq = {};
    hits.forEach(function (v) { uniq[v] = 1; });
    var names = Object.keys(uniq);
    if (names.length === 1) return names[0];
    return '';
  }

  function get(obj, k) {
    if (!obj || !k) return null;
    return Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : null;
  }

  /* manifest 경로 → 없으면 null. byBook 이 있으면(등록된 교재) 규칙 추측은 하지 않는다. */
  function resolve(bookId, page, no, title, partHint) {
    var m = man || { books: {}, parts: {}, titles: {} };
    var books = m.books || {}, partsM = m.parts || {};
    var alias = findAlias(bookId, title);
    var byBook = alias ? books[alias] : null;
    var pg = pageNo(page), n = String(no);

    if (byBook) {
      /* ① 평가편(단원평가·학업성취도평가) 힌트가 있으면 그 표 안에서 먼저 찾는다 */
      var partKey = partName(partHint);
      var table = partsM[alias];
      if (partKey && table && table[partKey]) {
        /* 그 평가편 표가 있는 교재면 그 표 안에서만 본다(본문 1~12쪽과 평가편 1~12쪽을 섞지 않는다) */
        var e = get(get(table[partKey], pg), n);
        if (e) return { src: e, alias: alias, basis: 'manifest-part', part: partKey };
        return { src: '', alias: alias, basis: 'none', part: partKey };
      }
      /* ② 본문 쪽 기준 표 */
      var hit = get(get(byBook, pg), n);
      if (hit) return { src: hit, alias: alias, basis: 'manifest', part: '' };
      /* ③ 등록된 교재인데 이 쪽·문항이 없다 → 이름 규칙으로 다른 쪽 그림을 집어오지 않는다 */
      return { src: '', alias: alias, basis: 'none', part: partKey };
    }

    var ap = aliasRulePath(alias, page, no);
    if (ap) return { src: ap, alias: alias, basis: 'alias-rule', part: '' };
    return { src: rulePath(bookId, page, no), alias: alias, basis: 'rule', part: '' };
  }

  function pathFor(bookId, page, no, title, partHint) {
    lastResolve = resolve(bookId, page, no, title, partHint);
    return lastResolve.src;
  }

  function ensureStyle() {
    if (styled) return;
    styled = true;
    var st = document.createElement('style');
    st.textContent =
      '#ansv{position:fixed;inset:0;z-index:9000;background:rgba(12,24,38,.72);' +
      'display:flex;align-items:center;justify-content:center;padding:16px}' +
      '#ansv .ansv-box{background:#fff;border-radius:16px;max-width:min(760px,96vw);max-height:92vh;' +
      'display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}' +
      '#ansv .ansv-hd{display:flex;flex-wrap:nowrap;align-items:center;gap:10px;padding:11px 14px;' +
      'background:#e8f5f3;color:#1d7d70;font-weight:900;font-size:14.5px;border-bottom:1px solid #d9ebe7}' +
      '#ansv .ansv-ht{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
      'text-align:left}' +
      '#ansv .ansv-x{flex:0 0 auto;width:auto;height:auto;min-width:34px;margin:0 0 0 6px;border:1px solid #bfe0da;' +
      'background:#fff;color:#1d7d70;font-weight:900;font-size:15px;line-height:1;padding:6px 9px;' +
      'border-radius:9px;cursor:pointer;box-shadow:none}' +
      '#ansv .ansv-bd{overflow:auto;padding:10px 14px 14px;text-align:center}' +
      '#ansv .ansv-bd img{max-width:100%;height:auto;border-radius:8px;background:#fff}' +
      '#ansv .ansv-msg{font-size:13.5px;line-height:1.7;color:#7b8a9a;padding:22px 8px}' +
      '#ansv .ansv-msg b{color:#c2410c}' +
      '#ansv .ansv-path{font-size:11px;color:#9aa9b8;word-break:break-all;margin-top:8px}' +
      '.wb-q.img{cursor:pointer;border-color:#f0c9a8;background:#fff7ef;color:#b45309}' +
      '.wb-q.img::after{content:" \ud83d\udc41";font-size:10px}' +
      '.wb-q.img:hover{background:#ffefdc}';
    document.head.appendChild(st);
  }

  function open(bookId, page, no, title, partHint) {
    ensureStyle();
    loadManifest().then(function () {
      var r = resolve(bookId, page, no, title, partHint);
      lastResolve = r;
      var src = r.src;
      var label = pageNo(page) + 'p ' + no + '번';
      var wrap = document.createElement('div');
      wrap.className = 'ansv';
      wrap.id = 'ansv';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-label', label + ' 정답 그림');

      var box = document.createElement('div');
      box.className = 'ansv-box';
      var hd = document.createElement('div');
      hd.className = 'ansv-hd';
      var ht = document.createElement('span');
      ht.className = 'ansv-ht';
      ht.textContent = '🖼 ' + label + ' 정답 그림';
      hd.appendChild(ht);
      var x = document.createElement('button');
      x.className = 'ansv-x'; x.type = 'button'; x.textContent = '✕';
      hd.appendChild(x);
      box.appendChild(hd);

      var bd = document.createElement('div');
      bd.className = 'ansv-bd';

      function notReady() {
        bd.innerHTML = '';
        var m = document.createElement('div');
        m.className = 'ansv-msg';
        m.innerHTML = '<b>그림 준비 중</b><br>이 문항의 정답 그림 파일이 아직 등록되지 않았습니다.';
        if (src) {
          var p = document.createElement('div');
          p.className = 'ansv-path';
          p.textContent = decodeURI(src);
          m.appendChild(p);
        }
        bd.appendChild(m);
      }

      if (!src) {
        notReady();
      } else {
        var img = document.createElement('img');
        img.alt = label + ' 정답 그림';
        img.onerror = notReady;
        img.src = src;
        bd.appendChild(img);
      }
      box.appendChild(bd);
      wrap.appendChild(box);
      document.body.appendChild(wrap);
      wrap.setAttribute('data-src', src);
      wrap.setAttribute('data-alias', r.alias || '');
      wrap.setAttribute('data-basis', r.basis || '');

      function close() {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        document.removeEventListener('keydown', onKey);
      }
      function onKey(ev) { if (ev.key === 'Escape') close(); }
      x.onclick = close;
      wrap.onclick = function (ev) { if (ev.target === wrap) close(); };
      document.addEventListener('keydown', onKey);
      x.focus();
    });
  }

  window.WINNERS_ANSIMG = {
    isFigure: isFigure,
    key: key,
    norm: norm,
    partName: partName,
    rulePath: rulePath,
    loadManifest: loadManifest,
    findAlias: findAlias,
    resolve: function (bookId, page, no, title, partHint) {
      if (!man) return null;
      return resolve(bookId, page, no, title, partHint);
    },
    last: function () { return lastResolve; },
    open: open
  };
})();
