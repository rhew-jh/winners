/* ── 📸 숙제 사진 올리기 (학생) — 수학·영어 학생 화면이 같이 쓴다.
   사진을 줄여(가로 1600px·JPEG 0.86) GAS '숙제사진채점' 웹앱으로 보낸다.
   올리면 대기열에 쌓이고, 학원 PC가 자동 채점해 선생님 화면 오답함에 번호를 남긴다.
   채점이 끝나면 이 화면에도 결과·경고(풀이 부족 / 글씨 흐림)가 뜨고, 그 자리에서 다시 찍어 보낼 수 있다.
   한 쪽에 채점은 2차까지 — 1차 경고 뒤 다시 찍어 통과하면 통과 카드, 2차에도 경고면 마감 안내(버튼 숨김).
   ※ 올린다고 종이가 나가지 않는다 — 선생님이 [오프라인책 오답인쇄]를 눌러야 인쇄된다. */
(function () {
  'use strict';
  var W = window.WINNERS_PHOTO = window.WINNERS_PHOTO || {};
  /* 자동 채점 서버 주소 — Apps Script 웹앱(숙제사진채점). */
  var API = window.WINNERS_PHOTO_API || 'https://script.google.com/macros/s/AKfycbyjYHvXhjJYNI3_u9KJfQOsF5IBDmOj0nvMogVQAzpHsm3FsMA8lDyFb9S0SfVKrYPIfQ/exec';
  var POLL_MS = 4000, POLL_MAX = 24;   /* 4초 간격, 최대 96초(대기→완료까지) */

  /* 상태 영역·경고 카드 스타일 — 학생 화면 어디에 넣어도 깨지지 않게 여기서 한 번만 넣는다. */
  var CSS = '' +
    '.ph-status-list{margin-top:10px;display:flex;flex-direction:column;gap:8px}' +
    '.ph-item{border:1px solid #dbe7f5;background:#fff;border-radius:12px;padding:9px 11px;' +
    'font-size:13px;line-height:1.55;color:#33506f;word-break:keep-all}' +
    '.ph-item.wait{background:#fff8ec;border-color:#f2dfc1;color:#8a5b00;font-weight:700}' +
    '.ph-item.ok{background:#f2fbf6;border-color:#c9e8d6;color:#1d7d70;font-weight:700}' +
    '.ph-warn{margin-top:8px;border:1px solid #f6c9a8;background:#fff7f2;border-radius:12px;padding:11px 12px}' +
    '.ph-warn-t{font-size:13.5px;font-weight:800;color:#b4441a;line-height:1.55;word-break:keep-all}' +
    '.ph-warn-s{font-size:12.5px;font-weight:700;color:#8a5b2a;margin-top:5px;line-height:1.5;word-break:keep-all}' +
    '.ph-warn-btn{width:100%;min-height:42px;margin-top:9px;border:1px solid #f0b58c;border-radius:11px;' +
    'background:#fff;color:#b4441a;font-size:14px;font-weight:900;font-family:inherit;cursor:pointer}' +
    '.ph-warn-btn:active{background:#ffe9dc}' +
    /* 1차·2차 차수 배지 + 2차 통과 카드 */
    '.ph-warn-h{display:flex;align-items:flex-start;gap:7px}' +
    '.ph-att{flex:0 0 auto;margin-top:1px;border-radius:999px;background:#ffe2cd;color:#a63a13;' +
    'font-size:11px;font-weight:900;padding:2px 7px;letter-spacing:-.2px}' +
    '.ph-att.two{background:#ffc9b4;color:#8f2b06}' +
    '.ph-pass{background:#f1fbf4;border-color:#b7e3c6}' +
    '.ph-pass-t{font-size:13.5px;font-weight:900;color:#137a4b;line-height:1.55;word-break:keep-all}' +
    '.ph-pass-s{font-size:12px;font-weight:700;color:#4b7a61;margin-top:4px;line-height:1.5}' +
    /* 선생님 화면 — 잔소리 예약 학생 모아보기 */
    '.ph-warnboard{margin:0 0 12px;border:1px solid #f0d3b4;background:#fffaf5;border-radius:15px;padding:11px 13px}' +
    '.ph-warnboard.empty{border-color:#dfe8f2;background:#f8fbfe}' +
    '.ph-wb-h{font-size:14px;font-weight:900;color:#a3481c;display:flex;align-items:center;justify-content:space-between;gap:8px}' +
    '.ph-warnboard.empty .ph-wb-h{color:#5d7d9c;font-weight:800;font-size:13px}' +
    '.ph-wb-h button{border:1px solid #e7c9ad;background:#fff;color:#a3481c;border-radius:999px;' +
    'min-height:30px;padding:0 11px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer}' +
    '.ph-wb-row{display:block;width:100%;text-align:left;margin-top:8px;border:1px solid #f0dcc7;background:#fff;' +
    'border-radius:12px;padding:9px 11px;font-size:13px;line-height:1.5;color:#5b3c25;font-family:inherit;cursor:pointer}' +
    '.ph-wb-row:active{background:#fff3e8}' +
    '.ph-wb-row b{color:#1b3b60;font-weight:900}' +
    '.ph-wb-row .m{color:#8a7561;font-weight:700;margin:0 4px}' +
    '.ph-wb-row .w1{color:#b4441a;font-weight:800}' +
    '.ph-wb-row .w2{color:#9a6a15;font-weight:800}' +
    '.ph-wb-row .lbl{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px;' +
    'font-weight:900;letter-spacing:-.2px;margin-bottom:4px}' +
    '.ph-wb-row .lbl.warn1{background:#ffe9d6;color:#a3481c}' +
    '.ph-wb-row .lbl.warn2{background:#ffd3c6;color:#8f2b06}' +
    '.ph-wb-row .lbl.pass{background:#d8f3e2;color:#11724a}' +
    '.ph-wb-row.pass{background:#f7fdf9;border-color:#c4e8d2}' +
    '.ph-wb-row .ln{display:block}' +
    '.ph-wb-row .hist{display:block;margin-top:2px;font-size:11.5px;color:#5f8c74;font-weight:800}' +
    '.ph-wb-row .go{display:block;margin-top:3px;font-size:11.5px;color:#7b8a9a;font-weight:700}' +
    '@media (max-width:390px){.ph-item{font-size:12.5px}.ph-warn-t{font-size:13px}.ph-warn-s{font-size:12px}' +
    '.ph-wb-row{font-size:12.5px;padding:8px 10px}}';

  function injectCss() {
    if (document.getElementById('ph-style')) return;
    var s = document.createElement('style');
    s.id = 'ph-style';
    s.textContent = CSS;
    (document.head || document.body).appendChild(s);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function shrink(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight;
          var f = Math.min(1, maxSide / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * f); c.height = Math.round(h * f);
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          var data = c.toDataURL('image/jpeg', quality).split(',')[1];
          resolve({ name: (file.name || 'photo') + '.jpg', mime: 'image/jpeg', b64: data });
        } catch (e) { reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다.')); };
      img.src = url;
    });
  }

  /* 몇 쪽인지 — 결과 요약("1p · 오답 2")이나 학생이 적은 쪽에서 가져온다. */
  function pageText(r) {
    var pg = (r && r.pages) || [];
    if (pg.length) return pg.join('·') + '쪽';
    if (r && String(r.page || '').trim()) return String(r.page).trim() + '쪽';
    return '';
  }

  /* 결과 요약에서 앞의 "학생이름 교재명" 조각을 떼고 보여 준다. */
  function sumText(r) {
    var s = String((r && r.result) || '');
    var parts = s.split(' · ');
    if (parts.length > 1) s = parts.slice(1).join(' · ');
    return s.replace(/(\d+)\s*p/g, '$1쪽');
  }

  function hasWarn(r) {
    var w = (r && r.warn) || {};
    return !!(w.noSolNos && w.noSolNos.length) || !!(w.checkNos && w.checkNos.length) || !!w.lowText;
  }

  /* 차수 — 한 쪽에 채점은 2차까지 */
  function attemptOf(r) {
    var a = parseInt((r && r.attempt) || 1, 10);
    if (isNaN(a) || a < 1) return 1;
    return a > 2 ? 3 : a;
  }

  /* 채점 실패 이유 — 서버가 적어 둔 note/reason/error 를 사람이 읽을 수 있게 */
  function errReason(r) {
    var s = String((r && (r.note || r.reason || r.error || r.result)) || '').trim();
    if (!s) return '';
    if (/분석본|structure|book\.json|등록되지 않은|교재.*없/.test(s)) return '교재 분석본이 없어요 — 선생님께 알려 주세요(학원 PC 콘솔에서 교재 등록 필요)';
    if (/(쪽|page)/i.test(s) && /(인식|찾지|미확인|못)/.test(s)) return '사진에서 쪽 번호를 찾지 못했어요 — 쪽 번호가 보이게 다시 찍어 주세요';
    if (/timeout|시간 초과|응답/.test(s)) return '채점 서버 응답이 늦었어요 — 잠시 뒤 다시 보내 주세요';
    if (/용량|size|too large|큰/.test(s)) return '사진 용량이 너무 커요 — 조금 작게 찍어 주세요';
    if (/API|연결|network|fetch|offline/i.test(s)) return '채점 서버에 연결하지 못했어요 — 인터넷을 확인해 주세요';
    return s.slice(0, 120);
  }

  /* 경고 내용 한 줄 — "9번은 풀이 과정이 안 보이고, 3, 5번은 글씨가 흐려 확인이 필요해요." */
  function warnDetail(r) {
    var w = (r && r.warn) || {};
    var noSol = w.noSolNos || [], chk = w.checkNos || [];
    var a = noSol.join(', '), b = chk.join(', ');
    if (noSol.length && chk.length) {
      return a + '번은 풀이 과정이 안 보이고, ' + b + '번은 글씨가 흐려 확인이 필요해요.';
    }
    if (noSol.length) return a + '번은 풀이 과정이 안 보여요.';
    if (chk.length) return b + '번은 글씨가 흐려 확인이 필요해요.';
    if (w.lowText) return '글씨가 잘 안 보여요.';
    return '채점을 마치지 못했어요.';
  }

  /* 카드 제목 — 2차는 "⚠️ 2차 풀이과정 부족", 1차는 "⚠️ 9번은 …" */
  function warnTitle(r) {
    if (attemptOf(r) < 2) return '⚠️ ' + warnDetail(r);
    var w = (r && r.warn) || {};
    var kind = (w.noSolNos && w.noSolNos.length) ? '풀이과정 부족'
      : ((w.checkNos && w.checkNos.length) ? '확인 필요'
        : (w.lowText ? '글씨 판독 불가' : '채점 확인 필요'));
    return '⚠️ 2차 ' + kind;
  }

  /* 카드 아래 줄 — 1차는 다시 찍기 안내, 2차는 마감 안내 */
  function warnSub(r) {
    var w = (r && r.warn) || {};
    if (attemptOf(r) < 2) {
      if (r.isLatest === false) return '이미 2차까지 제출했어요. 선생님께 직접 확인받아요!';
      return '잔소리 예약 완료 ^^ (다시 찍어 올리거나 선생님께 확인받아요!)';
    }
    var bits = [];
    if ((w.noSolNos || []).length) bits.push((w.noSolNos || []).join(', ') + '번');
    if ((w.checkNos || []).length) bits.push((w.checkNos || []).join(', ') + '번');
    return (bits.length ? bits.join(' · ') + ' — ' : '') +
      '2차까지 제출을 마쳤어요. 선생님께 직접 확인받아요!';
  }

  function nums(a) { return (a || []).join(', '); }

  /* ── 선생님·원장 화면: 📢 잔소리 예약 학생 모아보기 ──
     GAS op:'warns' 로 최근 완료 제출 중 경고가 있는 것만 받아 온다(토큰 노출 없음).
     opt: { subject:'math'|'eng'|'all', onPick:function(item) }  →  { el, reload() } */
  W.warnBoard = function (opt) {
    var o = opt || {};
    var box = el('div', 'ph-warnboard empty');
    injectCss();
    var head = el('div', 'ph-wb-h');
    var list = el('div');
    box.appendChild(head);
    box.appendChild(list);
    var items = [], loading = false;

    function pickWarn(it) {
      if (o.onPick) { try { o.onPick(it); } catch (e) { } }
    }

    function paint() {
      list.innerHTML = '';
      if (!items.length) {
        box.className = 'ph-warnboard empty';
        head.innerHTML = '';
        head.appendChild(document.createTextNode('📢 잔소리 예약 & 재채점 기록 없음 ✓'));
        return;
      }
      box.className = 'ph-warnboard';
      head.innerHTML = '';
      var passN = 0;
      items.forEach(function (i) { if (i.kind === 'pass' || i.passedAfterRetry) passN++; });
      head.appendChild(document.createTextNode('📢 잔소리 예약 & 재채점 ' + items.length + '건' +
        (passN ? ' · 통과 ' + passN : '')));
      var rf = el('button', '', '새로고침');
      rf.type = 'button';
      rf.onclick = function () { load(); };
      head.appendChild(rf);
      items.forEach(function (it) {
        var kind = it.kind === 'pass' ? 'pass'
          : ((it.kind === 'warn2' || Number(it.attempt) >= 2) ? 'warn2' : 'warn1');
        var rowEl = el('button', 'ph-wb-row' + (kind === 'pass' ? ' pass' : ''));
        rowEl.type = 'button';
        var label = it.statusLabel || (kind === 'pass' ? '재채점 후 통과'
          : ((kind === 'warn2' ? '2차 ' : '1차 ') + '확인 필요'));
        rowEl.appendChild(el('span', 'lbl ' + kind, (kind === 'pass' ? '✅ ' : '') + label));
        var ln = el('span', 'ln');
        ln.appendChild(el('b', '', it.student || it.sid || '학생'));
        ln.appendChild(el('span', 'm', '·'));
        ln.appendChild(document.createTextNode((it.book || '') + (it.page ? ' ' + it.page + '쪽' : '')));
        rowEl.appendChild(ln);
        if (kind === 'pass') {
          rowEl.appendChild(el('span', 'hist', '1차 경고 → 다시 찍어 통과'));
        } else {
          var bits = [];
          if (it.noSolNos && it.noSolNos.length) bits.push(['w1', '풀이 부족(' + nums(it.noSolNos) + '번)']);
          if (it.checkNos && it.checkNos.length) bits.push(['w2', '확인 필요(' + nums(it.checkNos) + '번)']);
          if (!bits.length && it.lowText) bits.push(['w1', '글씨 판독 불가']);
          var numLine = el('span', 'ln');
          bits.forEach(function (b, i) {
            if (i) numLine.appendChild(el('span', 'm', '/'));
            numLine.appendChild(el('span', b[0], b[1]));
          });
          rowEl.appendChild(numLine);
          if (kind === 'warn2') rowEl.appendChild(el('span', 'hist', '2차까지 마감 — 선생님이 직접 확인'));
        }
        rowEl.appendChild(el('span', 'go', '눌러서 이 학생 채점 화면 열기 →'));
        rowEl.onclick = function () { pickWarn(it); };
        list.appendChild(rowEl);
      });
    }

    function load() {
      if (loading) return;
      loading = true;
      var api = o.api || API;
      if (typeof fetch !== 'function') { loading = false; return; }
      fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ op: 'warns', subject: o.subject || 'all', limit: 20 }),
        redirect: 'follow',
        cache: 'no-store'
      }).then(function (r) { return r.json(); }).then(function (j) {
        loading = false;
        if (!j || j.ok !== true) return;
        items = j.items || [];
        paint();
      }).catch(function () { loading = false; });
    }

    if (/[?&]mode=student/.test(String((window.location || {}).search || ''))) {
      box.style.display = 'none';            /* 학생 QR 화면에는 절대 노출하지 않는다 */
      return { el: box, reload: function () { } };
    }
    paint();
    load();
    return { el: box, reload: load };
  };

  /* ── 잔소리 행을 누르면 그 학생을 채점 화면에서 바로 고른다(학년 → 학생 → 교재/쪽). ──
     수학·영어 교사 화면의 고르기 칩을 사람이 누르는 것과 같은 방식으로 눌러 준다. */
  function chipStarts(btn, name) {
    var t = String(btn.textContent || '').replace(/\s+/g, '');
    var n = String(name || '').replace(/\s+/g, '');
    return !!n && t.indexOf(n) === 0;
  }
  function clickChip(list, name) {
    for (var i = 0; i < list.length; i++) { if (chipStarts(list[i], name)) { list[i].click(); return true; } }
    return false;
  }
  W.selectStudent = function (root, o) {
    o = o || {};
    var pick = root && root.querySelector ? root.querySelector('.wb-pick') : null;
    if (!pick) return false;
    /* 학년 칩 묶음과 학생 칩 묶음 — 수학은 .wb-chips / .wb-chips.stu,
       영어 교사 화면은 둘 다 .wb-chips 라서 순서로 구분한다(막 칩은 건드리지 않는다). */
    var groups = pick.querySelectorAll('.wb-chips');
    var gradeBox = null, stuBox = null;
    for (var g = 0; g < groups.length; g++) {
      if (groups[g].classList.contains('stu')) { stuBox = groups[g]; break; }
      if (!gradeBox) gradeBox = groups[g];
      else if (!stuBox) stuBox = groups[g];
    }
    if (!gradeBox || !stuBox) return false;
    function gBtns() { return gradeBox.querySelectorAll('button'); }
    function sBtns() { return stuBox.querySelectorAll('button'); }
    function hasStu() {
      var bs = sBtns();
      for (var i = 0; i < bs.length; i++) if (chipStarts(bs[i], o.name)) return true;
      return false;
    }
    /* 이미 그 학생이 켜져 있으면 학년·학생은 다시 누르지 않는다(교재만 남은 경우). */
    var onStu = false;
    var cur = sBtns();
    for (var c = 0; c < cur.length; c++) {
      if (cur[c].classList.contains('on') && chipStarts(cur[c], o.name)) { onStu = true; break; }
    }
    if (!onStu) {
      var ok = o.grade ? clickChip(gBtns(), o.grade) : false;
      if (!ok || !hasStu()) {
        var gs = gBtns();
        for (var i = 0; i < gs.length; i++) {
          if (gs[i].classList.contains('on')) continue;
          gs[i].click();
          if (hasStu()) break;
        }
      }
      if (!hasStu()) return false;
      clickChip(sBtns(), o.name);
    }

    var sel = pick.querySelector('select');
    if (sel && !o.bookId && !o.bookTitle) return true;
    if (sel && (o.bookId || o.bookTitle)) {
      var opt2 = null, j;
      for (j = 0; j < sel.options.length; j++) {
        if (o.bookId && sel.options[j].value === o.bookId) { opt2 = sel.options[j]; break; }
      }
      if (!opt2 && o.bookTitle) {
        for (j = 0; j < sel.options.length; j++) {
          if (String(sel.options[j].textContent || '').indexOf(o.bookTitle) >= 0) { opt2 = sel.options[j]; break; }
        }
      }
      if (opt2 && opt2.value) {
        opt2.disabled = false; opt2.hidden = false;
        try { opt2.style.display = ''; } catch (e) { }
        sel.value = opt2.value;
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
        return sel.value === opt2.value ? true : 'stu';
      }
      return 'stu';          /* 학생은 골랐지만 교재 목록이 아직 안 나옴 → 곧 다시 시도 */
    }
    return true;
  };

  /* 카드 만들기 — 부르는 화면이 bookSel·sid·k 등을 넘겨 준다. */
  W.build = function (opt) {
    var o = opt || {};
    var box = el('div', 'ph-card');
    /* 서버 주소가 아직 없으면 카드를 아예 띄우지 않는다(눌러도 안 되는 버튼을 보여 주지 않는다). */
    if (!API) { box.style.display = 'none'; return box; }
    injectCss();
    box.appendChild(el('div', 'ph-tt', '📸 숙제 사진으로 자동 채점'));
    box.appendChild(el('div', 'ph-sub',
      '푼 페이지를 찍어 올리면 자동으로 채점해서 선생님 화면에 틀린 번호가 뜹니다. ' +
      '올린다고 바로 인쇄되지는 않아요.'));
    var row = el('div', 'ph-row');
    var pageIn = document.createElement('input');
    pageIn.type = 'number'; pageIn.inputMode = 'numeric'; pageIn.min = '1'; pageIn.max = '999';
    pageIn.className = 'ph-num'; pageIn.placeholder = '쪽';
    pageIn.setAttribute('aria-label', '사진을 찍은 페이지');
    row.appendChild(pageIn);
    var btn = el('button', 'ph-btn', '📸 사진 올리기');
    btn.type = 'button';
    row.appendChild(btn);
    box.appendChild(row);
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.setAttribute('capture', 'environment');
    inp.style.display = 'none';
    box.appendChild(inp);
    var msg = el('div', 'ph-msg', '');
    box.appendChild(msg);
    /* 채점 현황 — 최근 제출 최대 3건 */
    var listBox = el('div', 'ph-status-list');
    listBox.style.display = 'none';
    box.appendChild(listBox);

    function say(t, kind) {
      msg.textContent = t;
      msg.className = 'ph-msg' + (kind === 'ok' ? ' ok' : (kind === 'err' ? ' err' : ''));
    }

    var timer = null, ticks = 0, loading = false;

    function stopPoll() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function startPoll() {
      if (timer) return;
      ticks = 0;
      timer = setInterval(function () {
        ticks++;
        if (ticks > POLL_MAX) { stopPoll(); return; }
        load(true);
      }, POLL_MS);
    }

    /* 다시 찍어 보내기 — 보던 교재 그대로, 그 쪽만 채워 카메라/앨범을 바로 연다. */
    function retake(r) {
      if (r && String(r.page || '').trim()) pageIn.value = String(r.page).trim();
      say('다시 찍어 올려 주세요. 이번엔 글씨가 잘 보이게 밝은 곳에서 찍으면 좋아요.');
      inp.value = '';
      inp.click();
    }

    function paint(rows) {
      listBox.innerHTML = '';
      if (!rows || !rows.length) { listBox.style.display = 'none'; return; }
      listBox.style.display = '';
      rows.slice(0, 3).forEach(function (r) {
        var pg = pageText(r);
        var book = String(r.book || r.bookId || '');
        var where = '(' + [book, pg].filter(Boolean).join(' · ') + ')';
        var item;

        if (r.state === '대기' || r.state === '처리중') {
          item = el('div', 'ph-item wait', '⏳ 자동 채점 중이에요… ' + where);
          listBox.appendChild(item);
          return;
        }
        /* 2차 재채점 통과 — 초록 통과 카드(다시 찍기 버튼 없음) */
        if (r.passedAfterRetry) {
          var sum2 = sumText(r);
          item = el('div', 'ph-item ph-pass');
          item.appendChild(el('div', 'ph-pass-t',
            '🎉 통과! 풀이 과정 확인됐어요 — 선생님께 \'재채점 후 통과\'로 전달됐어요!'));
          item.appendChild(el('div', 'ph-pass-s', where + (sum2 ? ' · ' + sum2 : '')));
          listBox.appendChild(item);
          return;
        }
        if (r.state === '완료' && !hasWarn(r)) {
          var sum = sumText(r);
          item = el('div', 'ph-item ok');
          item.appendChild(document.createTextNode('✅ 채점 완료! ' + where + (sum ? ' · ' + sum : '') +
            ' — 선생님 화면에 전달됐어요.'));
          listBox.appendChild(item);
          return;
        }

        /* 경고(풀이 부족·글씨 흐림) 또는 채점 오류 */
        var a = attemptOf(r);
        var isErr = r.state !== '완료';
        item = el('div', 'ph-item');
        var warn = el('div', 'ph-warn');
        var wHead = el('div', 'ph-warn-h');
        if (!isErr) wHead.appendChild(el('span', 'ph-att' + (a >= 2 ? ' two' : ''), a >= 2 ? '2차' : '1차'));
        wHead.appendChild(el('div', 'ph-warn-t', isErr ? '⚠️ 사진을 채점하지 못했어요.' : warnTitle(r)));
        warn.appendChild(wHead);
        if (isErr) {
          /* 2차(2026-11-28): 왜 실패했는지 서버가 남긴 사유를 같이 보여 준다 */
          var why = errReason(r);
          if (why) warn.appendChild(el('div', 'ph-warn-s', '사유: ' + why));
        }
        warn.appendChild(el('div', 'ph-warn-s',
          isErr ? '다시 찍어 보내면 같은 차수로 다시 채점해요.' : warnSub(r)));
        var allow = (r.canRetry !== false) && (isErr || a < 2);
        if (allow) {
          var again = el('button', 'ph-warn-btn', '📸 다시 찍어 보내기');
          again.type = 'button';
          again.onclick = function () { retake(r); };
          warn.appendChild(again);
        }
        item.appendChild(warn);
        item.appendChild(el('div', 'ph-msg', (book || '') + (pg ? ' · ' + pg : '')));
        listBox.appendChild(item);
      });
    }

    /* 학생 본인 최근 제출 상태 — QR 키로 본인 것만 조회 */
    function load(silent) {
      if (loading) return;
      loading = true;
      var api = o.api || API;
      var body = JSON.stringify({
        op: 'my', subject: o.subject || 'math',
        sid: o.sid, k: o.k, limit: 3
      });
      var done = function () { loading = false; };
      if (typeof fetch !== 'function') { done(); return; }
      fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow',
        cache: 'no-store'
      }).then(function (r) { return r.json(); }).then(function (j) {
        done();
        if (!j || j.ok !== true) { if (!silent) say((j && j.error) || '채점 현황을 불러오지 못했어요.', 'err'); return; }
        var rows = j.rows || [];
        paint(rows);
        var pending = rows.some(function (r) { return r.state === '대기' || r.state === '처리중'; });
        if (pending) startPoll(); else stopPoll();
      }).catch(function () { done(); /* 조용히 — 업로드·입력은 계속 쓸 수 있게 둔다 */ });
    }

    btn.onclick = function () {
      var book = o.bookId ? o.bookId() : '';
      if (!book) { say('먼저 교재를 골라 주세요.', 'err'); return; }
      inp.value = '';
      inp.click();
    };

    inp.onchange = function () {
      var files = Array.prototype.slice.call(inp.files || []);
      if (!files.length) return;
      if (files.length > 6) { say('한 번에 6장까지 올릴 수 있어요.', 'err'); return; }
      var book = o.bookId ? o.bookId() : '';
      var bookTitle = o.bookTitle ? o.bookTitle() : '';
      var sid = o.sid, k = o.k, subject = o.subject || 'math';
      btn.disabled = true;
      say('사진을 준비하는 중…');
      var done = 0, lastMsg = '';
      var chain = Promise.resolve();
      files.forEach(function (f, i) {
        chain = chain.then(function () {
          return shrink(f, 1600, 0.86).then(function (p) {
            say('올리는 중… (' + (i + 1) + '/' + files.length + ')');
            var api = o.api || API;
            if (!api) throw new Error('자동 채점 서버가 아직 연결되지 않았습니다. 선생님께 알려 주세요.');
            return fetch(api, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                op: 'up', subject: subject, sid: sid, k: k,
                bookId: book, bookTitle: bookTitle,
                page: String(pageIn.value || '').trim(),
                photos: [p]
              }),
              redirect: 'follow'
            }).then(function (r) { return r.json(); }).then(function (j) {
              if (!j || j.ok !== true) throw new Error((j && j.error) || '올리지 못했습니다.');
              done++;
              if (j.message) lastMsg = j.message;   /* '2차 사진이 올라갔어요…' 같은 서버 안내 */
            });
          });
        });
      });
      chain.then(function () {
        btn.disabled = false;
        say((lastMsg || '사진이 올라갔어요! 잠시 뒤 자동 채점됩니다.') + ' (' + done + '장)', 'ok');
        pageIn.value = '';
        if (o.onDone) o.onDone(done);
        load();          /* 바로 현황을 그리고, '대기/처리중'이면 4초 간격으로 따라간다 */
        startPoll();
      }).catch(function (e) {
        btn.disabled = false;
        say('사진을 올리지 못했습니다: ' + (e && e.message ? e.message : e), 'err');
      });
    };

    /* 학생 화면에 카드가 뜨는 순간 최근 제출 현황을 먼저 보여 준다. */
    setTimeout(function () { load(true); }, 300);

    return box;
  };
})();
