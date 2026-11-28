/* ------------------------------------------------------------------
   WINNERS 정적 화면 ↔ Google Apps Script 웹앱 브리지
   github.io 같은 정적 호스팅에는 google.script.run 이 없으므로,
   화면이 부르던 서버 함수 이름 그대로 GAS 웹앱의 JSON API 로 보낸다.
   · 비밀값(토큰·교사키·핀)은 이 파일에 없다. 화면에서 입력한 값을 그대로 전달만 한다.
   · mode:'gas' 는 {bridge:1, key, fn, args} 로 보내고, 서버 doPost 의 허용 함수만 실행된다.
   사용법: <script>window.WINNERS_BRIDGE={mode:'gas'|'english'|'math'|'clinic', exec:'.../exec', key:'...'};</script>
          <script src="bridge.js"></script>
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var CFG = window.WINNERS_BRIDGE || {};
  var EXEC = CFG.exec || '';
  var MODE = CFG.mode || 'english';
  var TIMEOUT = CFG.timeout || 60000;
  /* Q4(2026-11-28): 쓰기 함수는 재시도하지 않는다(중복 저장 방지). 읽기만 한 번 더. */
  var WRITE_FNS = { w62WbSavePage: 1, w62WbSavePagesBatch: 1, w62WbHwMark: 1, w62WbPrintRequest: 1,
                    w62WbCommentSave: 1, w62WbAssignSave: 1, w62StSavePage: 1,
                    w62AdmSetScopes: 1, w62AdmSetTeachers: 1, save: 1, publish: 1,
                    setTeacher: 1, setToken: 1, setPhotoEngine: 1, waeWbSavePage: 1 };
  function isWrite(name) { return !!(WRITE_FNS[name] || /Save|save/.test(String(name || ''))); }

  function bridgeKey() {
    var c = window.WINNERS_BRIDGE || {};
    if (c.key) return c.key;
    try { return localStorage.getItem('winners_bridge_key') || ''; } catch (e) { return ''; }
  }

  var MATH_WRITE = { save: 1, publish: 1, setTeacher: 1, setToken: 1, setPhotoEngine: 1 };

  function withParam(url, q) {
    if (!q) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + q;
  }
  function qs(obj) {
    var out = [];
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (v === undefined || v === null) return;
      if (typeof v === 'object') v = JSON.stringify(v);
      out.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return out.join('&');
  }
  function parse(text) {
    if (!text) return { ok: false, error: '빈 응답' };
    try { return JSON.parse(text); }
    catch (e) {
      return { ok: false, error: '서버 응답을 읽지 못했습니다', raw: String(text).slice(0, 300) };
    }
  }
  function request(url, opt) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
    var o = opt || {};
    if (ctrl) o.signal = ctrl.signal;
    o.cache = 'no-store';
    return fetch(url, o).then(function (r) {
      if (!r.ok) {
        if (timer) clearTimeout(timer);
        return { ok: false, code: 'HTTP' + r.status,
                 error: (r.status === 429)
                   ? '요청이 많아 잠시 막혔어요. 10초 뒤 다시 시도해 주세요.'
                   : '서버가 잠시 불안정해요. 잠시 뒤 다시 시도해 주세요. (' + r.status + ')' };
      }
      return r.text().then(function (t) {
        if (timer) clearTimeout(timer);
        return parse(t);
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      var msg = String((e && e.message) || e);
      if (/abort/i.test(msg)) return { ok: false, code: 'TIMEOUT', error: '서버 응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요.' };
      return { ok: false, code: 'NETWORK', error: '연결이 잠깐 끊겼어요. 인터넷을 확인하고 다시 시도해 주세요.' };
    });
  }
  /* 읽기 요청만 0.5초 뒤 한 번 더 시도 */
  function requestRetry(url, opt, name) {
    return request(url, opt).then(function (r) {
      if (r && r.ok === false && !isWrite(name) && /^HTTP5|^TIMEOUT|^NETWORK/.test(String(r.code || ''))) {
        return new Promise(function (res) { setTimeout(res, 500); }).then(function () { return request(url, opt); });
      }
      return r;
    });
  }
  function post(body) {
    return request(EXEC, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body || {}),
      redirect: 'follow'
    });
  }
  function get(params) {
    return request(withParam(EXEC, qs(params)), { method: 'GET', redirect: 'follow' });
  }

  /* ---- 클리닉 새 교재 PDF: 파일 → base64 → 서버 ---- */
  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || '');
        var i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      fr.onerror = function () { reject(new Error('파일을 읽지 못했습니다.')); };
      fr.readAsDataURL(file);
    });
  }
  function field(form, name) {
    try {
      var el = form && form.elements ? form.elements[name] : null;
      return el ? String(el.value || '') : '';
    } catch (e) { return ''; }
  }
  function fileOf(form, name) {
    try {
      var el = form && form.elements ? form.elements[name] : null;
      return el && el.files && el.files[0] ? el.files[0] : null;
    } catch (e) { return null; }
  }
  function uploadBook(form) {
    var f = fileOf(form, 'file');
    if (!f) return Promise.resolve({ ok: false, error: 'PDF 파일을 골라 주세요.' });
    if (f.size > 38 * 1024 * 1024) return Promise.resolve({ ok: false, error: 'PDF가 너무 큽니다(40MB 이하).' });
    return readBase64(f).then(function (b64) {
      return post({
        api: 'book_upload_b64',
        key: field(form, 'key'),
        subject: field(form, 'subject'),
        title: field(form, 'title'),
        grade: field(form, 'grade'),
        role: field(form, 'role'),
        mask_mode: field(form, 'mask_mode'),
        pages: field(form, 'pages'),
        exam_range: field(form, 'exam_range'),
        essay_pages: field(form, 'essay_pages'),
        file_name: f.name || 'book.pdf',
        pdf_b64: b64
      });
    });
  }

  /* ---- 서버 호출 ---- */
  function callServer(name, args) {
    if (!EXEC) return Promise.resolve({ ok: false, code: 'NOCONF', error: '서버 주소가 설정되지 않았습니다.' });
    if (MODE === 'clinic') {
      if (name === 'apiCall') {
        var p = {};
        var src = args[1] || {};
        Object.keys(src).forEach(function (k) { p[k] = src[k]; });
        p.api = args[0];
        return post(p);
      }
      if (name === 'apiBookUpload') return uploadBook(args[0]);
      return Promise.resolve({ ok: false, code: 'NOROUTE', error: '지원하지 않는 호출: ' + name });
    }
    if (MODE === 'math') {
      if (name === 'apiCall') {
        var d = args[0] || {};
        return MATH_WRITE[d.api] ? post(d) : get(d);
      }
      return Promise.resolve({ ok: false, code: 'NOROUTE', error: '지원하지 않는 호출: ' + name });
    }
    if (MODE === 'gas') {
      return requestRetry(EXEC, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ bridge: 1, key: bridgeKey(), fn: name, args: args || [] }),
        redirect: 'follow'
      }, name);
    }
    /* english: 화면이 쓰던 함수 이름 그대로 서버 화이트리스트로 보낸다 */
    if (name === 'ui3Logo') return Promise.resolve({ ok: false, error: 'logo-local' });
    return post({ bridge: 1, fn: name, args: args || [] });
  }

  function makeRunner() {
    var ok = null, fail = null;
    var api = {
      withSuccessHandler: function (f) { ok = f; return proxy; },
      withFailureHandler: function (f) { fail = f; return proxy; },
      withUserObject: function () { return proxy; }
    };
    var proxy;
    var handler = {
      get: function (t, k) {
        if (k in t) return t[k];
        if (typeof k !== 'string') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          callServer(k, args).then(function (r) {
            if (r && r.ok === false && r.error) {
              /* 서버가 돌려준 실패는 code 를 잃지 않게 그대로 넘긴다(2026-11-28 2차).
                 - clinic·math 화면은 화면 코드가 {ok:false, code:'AUTH'} 를 직접 판단하므로 성공 핸들러로 준다.
                 - 그 밖의 화면은 기존대로 실패 핸들러로 보내되, message/error/code 를 모두 담는다. */
              var errObj = { ok: false, message: r.error, error: r.error,
                             code: r.code || '', data: r };
              if (MODE === 'clinic' || MODE === 'math') {
                if (ok) { try { ok(r); } catch (e) { console.error(e); } }
                else if (fail) { try { fail(errObj); } catch (e) { } }
                return;
              }
              if (fail) { try { fail(errObj); } catch (e) { } }
              else if (ok) { try { ok(r); } catch (e) { } }
              return;
            }
            if (ok) { try { ok(r); } catch (e) { console.error(e); } }
          }, function (e) {
            if (fail) { try { fail(e); } catch (x) { console.error(x); } }
          });
          return proxy;
        };
      }
    };
    proxy = typeof Proxy !== 'undefined' ? new Proxy(api, handler) : api;
    return proxy;
  }

  var scriptObj = {
    host: {
      origin: 'https://script.google.com',
      close: function () { try { window.close(); } catch (e) { } },
      setHeight: function () { },
      setWidth: function () { },
      editor: { focus: function () { } }
    },
    history: { push: function () { }, replace: function () { }, setChangeHandler: function () { } }
  };
  Object.defineProperty(scriptObj, 'run', { get: function () { return makeRunner(); }, configurable: true });

  window.google = window.google || {};
  try { window.google.script = scriptObj; } catch (e) { window.google.script = scriptObj; }
  window.WINNERS_BRIDGE.call = callServer;
})();
