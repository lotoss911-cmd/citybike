/* CITY BIKE · мост к Android.
 * fetch к разрешённым API (Geoapify, wttr.in, Overpass) идёт через нативный HTTP —
 * без CORS и без перехвата собственных запросов страницы (в Tauri-версии шим ловил
 * и внутренние вызовы ipc.localhost, отсюда 27 с на первом запросе). */
(function() {
  'use strict';
  var N = window.CBNative;
  if (!N || !N.http) return;
  var HOSTS = ['api.geoapify.com', 'wttr.in', 'overpass-api.de', 'overpass.kumi.systems', 'overpass.private.coffee', 'overpass.openstreetmap.fr'];
  var pending = {},
    seq = 0;

  window.__cbHttpDone = function(id, status, b64, err) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    if (err || !status) {
      p.reject(new TypeError(err || 'network error'));
      return
    }
    var bin = atob(b64 || ''),
      bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var st = status >= 200 && status <= 599 ? status : 502;
    var body = (st === 204 || st === 205 || st === 304) ? null : bytes;
    p.resolve(new Response(body, {
      status: st === 304 ? 200 : st
    }))
  };

  var orig = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url);
    var u;
    try {
      u = new URL(url, location.href)
    } catch (e) {
      return orig(input, init)
    }
    if (u.protocol !== 'https:' || HOSTS.indexOf(u.hostname) < 0) return orig(input, init);
    init = init || {};
    var id = ++seq;
    return new Promise(function(resolve, reject) {
      var sig = init.signal;
      if (sig && sig.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return
      }
      pending[id] = {
        resolve: resolve,
        reject: reject
      };
      if (sig) sig.addEventListener('abort', function() {
        if (!pending[id]) return;
        delete pending[id];
        try {
          N.cancel(id)
        } catch (e) {}
        reject(new DOMException('Aborted', 'AbortError'))
      });
      var headers = {};
      if (init.headers) {
        if (typeof init.headers.forEach === 'function' && !(init.headers instanceof Object && init.headers.constructor === Object)) init.headers.forEach(function(v, k) {
          headers[k] = v
        });
        else Object.keys(init.headers).forEach(function(k) {
          headers[k] = String(init.headers[k])
        })
      }
      N.http(id, u.toString(), (init.method || 'GET').toUpperCase(), JSON.stringify(headers), init.body == null ? '' : String(init.body))
    })
  };
})();
