/* CITY BIKE · загрузка данных с домашнего сервера */
(function () {
  var q = new URLSearchParams(location.search);
  var api = q.get('api') || localStorage.getItem('cbApi') || '';
  if (api) { try { localStorage.setItem('cbApi', api); } catch (e) {} }

  window.CB_API = api;
  window.__OFFLINE_POI__ = [];

  function fail(msg) {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#7a2323;color:#fff;padding:10px 14px;font:13px system-ui;z-index:99999';
    b.textContent = msg;
    document.body.appendChild(b);
  }

  function loadUi() {
    var s = document.createElement('script');
    s.src = 'js/ui.js';
    document.body.appendChild(s);
  }

  if (!api) {
    fail('Нет адреса сервера данных. Откройте калькулятор по ссылке из бота.');
    loadUi();
    return;
  }

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 12000);
  var token = q.get('t') || '';

  fetch(api + '/api/poi' + (token ? '?t=' + encodeURIComponent(token) : ''), { signal: ctrl.signal })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      window.__OFFLINE_POI__ = Array.isArray(d) ? d : [];
    })
    .catch(function () {
      fail('Данные недоступны — проверьте, что компьютер с сервером включён.');
    })
    .finally(function () { clearTimeout(timer); loadUi(); });
})();
