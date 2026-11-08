/* CITY BIKE · Бортовой компьютер · UI v23 (Android) */
(function() {
  "use strict";
  var $ = function(id) {
    return document.getElementById(id)
  };
  var E = window.CityBikeEngine;
  if (!E) {
    console.error('Engine not loaded');
    return
  }
  var CB_MODE = E.CB_MODE;
  var IS_V2214 = E.IS_V2214,
    IS_V2213 = E.IS_V2213,
    IS_V2211 = E.IS_V2211,
    IS_V221 = E.IS_V221,
    IS_V22 = E.IS_V22,
    IS_FULL = E.IS_FULL,
    IS_SAFE = E.IS_SAFE;
  var LS_SCHEMA = 'v22_1_7';
  var LS_KEY = 'cityBikeConfig_' + LS_SCHEMA;
  var LS_ETALON_KEY = 'cityBikeEtalonExpanded';
  var LS_MAP_KEY = 'cityBikeMapCenter';
  var LS_WP_KEY = 'cityBikeWaypoints_' + LS_SCHEMA;
  var TPL_IDS = ['mMotorPower', 'mMotorPeak', 'mMotorPrice', 'mCtrlCurrent', 'mCtrlPhase', 'mCtrlEff', 'mCtrlPrice', 'mBattAh', 'mBattV', 'mBattMaxA', 'mBattPrice', 'motorTurns', 'mMaxSpeed', 'mMinSpeed', 'mStopsPerKm'];
  var MAX_WAYPOINTS = 10;
  var waypoints = [];
  var lastResults = {
      opt: null,
      avg: null,
      pess: null
    },
    lastStages = null,
    lastConfig = null,
    userEdited = {};
  var etalonExpanded = true;
  try {
    var s = localStorage.getItem(LS_ETALON_KEY);
    if (s !== null) etalonExpanded = s !== 'false'
  } catch (e) {}
  var advMode = (function() {
    try {
      return localStorage.getItem('citybikeAdvMode') || 'compact'
    } catch (e) {
      return 'compact'
    }
  })();
  var API_KEY_BUILTIN = '1eb394d293394156ac6ae3c078c27206';
  // Ключ можно заменить своим: localStorage 'cbGeoapifyKey' (поле в расширенном режиме).
  var API_KEY = (function() {
    try {
      var k = (localStorage.getItem('cbGeoapifyKey') || '').trim();
      if (/^[a-f0-9]{32}$/i.test(k)) return k
    } catch (e) {}
    return API_KEY_BUILTIN
  })();
  var OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter'
  ];
  var HOME_CENTER = [55.0302, 82.9204]; // Новосибирск
  var VERSION = 'V23';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function(c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      } [c]
    })
  }

  function _overpassHost(url) {
    try {
      return (new URL(url)).hostname
    } catch (e) {
      return url
    }
  }
  var mapInstance = null,
    routePolylines = [],
    elevationMarker = null;
  var lastRouteData = null,
    currentCursorPos = 0,
    lastMapSig = '';

  function lerpRGB(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    }
  }

  function smoothColor(ratio) {
    var stops = [{
      at: 0.00,
      c: {
        r: 255,
        g: 51,
        b: 51
      }
    }, {
      at: 0.30,
      c: {
        r: 255,
        g: 140,
        b: 66
      }
    }, {
      at: 0.60,
      c: {
        r: 255,
        g: 204,
        b: 0
      }
    }, {
      at: 1.00,
      c: {
        r: 92,
        g: 230,
        b: 110
      }
    }];
    ratio = Math.max(0, Math.min(1, ratio));
    for (var i = 0; i < stops.length - 1; i++) {
      if (ratio >= stops[i].at && ratio <= stops[i + 1].at) {
        var t = (ratio - stops[i].at) / (stops[i + 1].at - stops[i].at);
        var c = lerpRGB(stops[i].c, stops[i + 1].c, t);
        return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'
      }
    }
    return 'rgb(92,230,110)'
  }

  function smoothColorTemp(temp) {
    var stops = [{
      at: -20,
      c: {
        r: 79,
        g: 195,
        b: 247
      }
    }, {
      at: 20,
      c: {
        r: 92,
        g: 230,
        b: 110
      }
    }, {
      at: 50,
      c: {
        r: 255,
        g: 204,
        b: 0
      }
    }, {
      at: 80,
      c: {
        r: 255,
        g: 140,
        b: 66
      }
    }, {
      at: 120,
      c: {
        r: 255,
        g: 51,
        b: 51
      }
    }];
    temp = Math.max(stops[0].at, Math.min(temp, stops[stops.length - 1].at));
    for (var i = 0; i < stops.length - 1; i++) {
      if (temp >= stops[i].at && temp <= stops[i + 1].at) {
        var t = (temp - stops[i].at) / (stops[i + 1].at - stops[i].at);
        var c = lerpRGB(stops[i].c, stops[i + 1].c, t);
        return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'
      }
    }
    return 'rgb(92,230,110)'
  }

  function collectInputs() {
    var ids = ['bikeMass', 'riderMass', 'cargoMass', 'frameType', 'wheelSize', 'tireR17', 'pedalMode', 'fwMode', 'regenMode', 'winterMode', 'regenCurrent', 'motorCooling', 'voltageSelect', 'voltageMode', 'motorType', 'motorTurns', 'cellType', 'batterySOH', 'assistMode', 'riderPower', 'rideStyle', 'cityCycle', 'trackPct', 'slope', 'headwind', 'ambientTemp', 'posture', 'surface', 'tire', 'pressure', 'tariff', 'fuelPrice', 'fuelRate', 'yearKm', 'mMotorModel', 'mMotorPower', 'mMotorPeak', 'mMotorPrice', 'mCtrlCurrent', 'mCtrlPhase', 'mCtrlEff', 'mCtrlPrice', 'mBattAh', 'mBattV', 'mBattMaxA', 'mBattPrice', 'mMaxSpeed', 'mMinSpeed', 'mStopsPerKm', 'useSpeedProfile', 'applyWeather', 'hardWeatherCap', 'rangeDistance', 'rangeCoastFactor', 'routeMode', 'routeRoundTrip', 'uphillPct', 'apiWindSpeed', 'apiWindDir', 'apiRouteBearing', 'apiHeadwind', 'routeStart', 'routeEnd'];
    var o = {};
    ids.forEach(function(id) {
      var el = $(id);
      if (!el) return;
      o[id] = el.type === 'checkbox' ? el.checked : el.value
    });
    return o
  }

  function applyInputs(o) {
    if (!o) return;
    Object.keys(o).forEach(function(id) {
      var el = $(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = o[id];
      else el.value = o[id]
    });
    syncSwitches();
    syncWinterMode();
    syncRoundTripSwitch();
    syncSpeedProfile();
    syncApplyWeather();
    syncHardCap();
    syncStyle()
  }

  function saveConfig() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        schema: LS_SCHEMA,
        data: collectInputs(),
        edited: userEdited
      }));
      saveWaypoints()
    } catch (e) {}
  }

  function saveWaypoints() {
    try {
      var wp = waypoints.map(function(w) {
        return {
          lat: w.lat,
          lon: w.lon
        }
      });
      localStorage.setItem(LS_WP_KEY, JSON.stringify(wp))
    } catch (e) {}
  }

  function loadWaypoints() {
    try {
      var raw = localStorage.getItem(LS_WP_KEY);
      if (!raw) return;
      var wp = JSON.parse(raw);
      if (!Array.isArray(wp)) return;
      waypoints = wp.filter(function(w) {
        return w && isFinite(w.lat) && isFinite(w.lon)
      }).slice(0, MAX_WAYPOINTS).map(function(w) {
        return {
          lat: w.lat,
          lon: w.lon,
          marker: null
        }
      });
      if (waypoints.length) rebuildMarkers()
    } catch (e) {}
  }

  function loadConfig() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return false;
      if (o.schema && o.schema !== LS_SCHEMA) return false;
      applyInputs(o.data || o);
      if (o.edited && typeof o.edited === 'object') {
        Object.keys(o.edited).forEach(function(k) {
          userEdited[k] = o.edited[k]
        })
      }
      markTplLocks();
      return true
    } catch (e) {
      return false
    }
  }

  function showError(m) {
    var eb = $('errorBanner'),
      et = $('errorText');
    if (!eb || !et) return;
    et.textContent = m || 'Ошибка';
    eb.classList.add('on');
    $('results').classList.add('on')
  }

  function clearError() {
    var eb = $('errorBanner');
    if (eb) eb.classList.remove('on')
  }

  function updateMotorTypeRestrictions() {
    var mt = $('motorType').value,
      isDD = mt === 'dd';
    var fwRow = $('fwRow'),
      rr = $('regenRow'),
      rc = $('regenCurrentField');
    if (isDD) {
      fwRow.classList.remove('disabled');
      rr.classList.remove('disabled');
      rc.classList.remove('disabled')
    } else {
      fwRow.classList.add('disabled');
      rr.classList.add('disabled');
      rc.classList.add('disabled');
      $('fwMode').checked = false;
      $('regenMode').checked = false
    }
    syncSwitches()
  }

  function syncSwitches() {
    var p = $('pedalMode').checked;
    $('pedalSwitch').classList.toggle('on', p);
    $('pedalSwitch').classList.toggle('off', !p);
    $('fwSwitch').classList.toggle('on', $('fwMode').checked);
    $('fwSwitch').classList.toggle('off', !$('fwMode').checked);
    $('regenSwitch').classList.toggle('on', $('regenMode').checked);
    $('regenSwitch').classList.toggle('off', !$('regenMode').checked);
    $('riderPowerField').classList.toggle('disabled', !p);
    $('riderModeHeader').innerHTML = 'ПРИВОД <b>' + (p ? 'PAS' : 'ГАЗ') + '</b>'
  }

  function syncWinterMode() {
    var t = +$('ambientTemp').value || 0,
      a = t <= E.WINTER_THRESHOLD_C,
      i = $('winterMode'),
      sw = $('winterSwitch'),
      row = $('winterRow'),
      info = $('winterInfo');
    if (a) {
      if (i.dataset.autoPrev === undefined) {
        i.dataset.autoPrev = i.checked ? '1' : '0'
      }
      i.checked = true;
      i.disabled = true;
      sw.classList.remove('off');
      sw.classList.add('on', 'winter-on', 'auto');
      row.setAttribute('title', 'Авто при T ≤ ' + E.WINTER_THRESHOLD_C + '°C');
      info.style.display = 'block';
      info.innerHTML = '❄ <b>ЗИМА АВТО (T=' + t + '°C):</b> рекуп блок <−5°C, зарядка <0°C.'
    } else {
      i.disabled = false;
      if (i.dataset.autoPrev !== undefined) {
        i.checked = i.dataset.autoPrev === '1';
        delete i.dataset.autoPrev
      }
      sw.classList.remove('auto');
      var on = i.checked;
      sw.classList.toggle('on', on);
      sw.classList.toggle('off', !on);
      sw.classList.toggle('winter-on', on);
      row.removeAttribute('title');
      if (on) {
        info.style.display = 'block';
        info.innerHTML = '❄ <b>ЗИМА ВКЛ:</b> рекуп блок <−5°C.'
      } else {
        info.style.display = 'none'
      }
    }
  }

  function syncRoundTripSwitch() {
    var rt = $('routeRoundTrip').checked,
      sw = $('routeRoundTripSwitch');
    sw.classList.toggle('on', rt);
    sw.classList.toggle('off', !rt)
  }

  function syncSpeedProfile() {
    var on = $('useSpeedProfile').checked;
    var sw = $('speedProfileSwitch');
    if (sw) {
      sw.classList.toggle('on', on);
      sw.classList.toggle('off', !on)
    }
    document.querySelectorAll('.speed-field').forEach(function(el) {
      el.classList.toggle('disabled', !on)
    });
    if (on) {
      $('rideStyle').disabled = true
    } else {
      $('rideStyle').disabled = false
    }
  }

  function syncApplyWeather() {
    var w = $('applyWeather');
    if (!w) return;
    var sw = $('applyWeatherSwitch');
    if (sw) {
      sw.classList.toggle('on', w.checked);
      sw.classList.toggle('off', !w.checked)
    }
  }

  function syncHardCap() {
    var w = $('hardWeatherCap');
    if (!w) return;
    var sw = $('hardWeatherCapSwitch');
    if (sw) {
      sw.classList.toggle('on', w.checked);
      sw.classList.toggle('off', !w.checked)
    }
  }

  function getEffectiveSpeedAndStops() {
    var useSP = $('useSpeedProfile').checked;
    var st = E.RIDE_STYLES[$('rideStyle').value] || E.RIDE_STYLES.normal;
    var cc = Math.max(parseFloat($('cityCycle').value) || 1.4, 1.0);
    var trackPct = (+$('trackPct').value || 0) / 100;
    var vMax, stopsPerKm;
    if (useSP) {
      vMax = +$('mMaxSpeed').value || st.vBase;
      stopsPerKm = (+$('mStopsPerKm').value || st.stopsPerKm) * (1 - trackPct) * (IS_V22 ? cc : 1)
    } else {
      vMax = IS_V22 ? st.vBase : st.vBase * cc;
      stopsPerKm = st.stopsPerKm * (1 - trackPct) * (IS_V22 ? cc : 1)
    }
    return {
      vMax: vMax,
      stopsPerKm: stopsPerKm,
      cc: cc,
      st: st,
      useSP: useSP
    }
  }

  function syncStyle() {
    var k = $('rideStyle').value || 'normal';
    var st = E.RIDE_STYLES[k] || E.RIDE_STYLES.normal;
    var cc = parseFloat($('cityCycle').value) || 1.4;
    var info = $('styleInfo');
    var eff = getEffectiveSpeedAndStops();
    if (info) {
      if (IS_V22) {
        info.innerHTML = '<b>' + st.icon + ' ' + st.name + '</b> · vBase <b>' + st.vBase + ' км/ч</b><br><span style="color:var(--text-mute)">Загруженность ×' + cc.toFixed(2) + ':</span> крейсер <b>' + eff.vMax.toFixed(0) + '</b>, остановок/км ≈ <b>' + eff.stopsPerKm.toFixed(2) + '</b>, средняя ≈ <b>' + Math.round(eff.vMax / Math.sqrt(cc)) + '</b> км/ч<br><span style="color:var(--text-mute)">OPT/AVG/PESS:</span> крейсер <b>' + eff.vMax.toFixed(0) + '</b> км/ч, поправка на остановки ×' + cc.toFixed(2) + '<br><span style="color:var(--text-mute)">МАРШРУТ:</span> vBase <b>' + st.vBase + '</b> км/ч с торможениями на светофорах<br><span style="color:var(--text-mute);font-size:9.5px">cityCycle = плотность трафика, не скорость.</span>'
      } else {
        var cruise = Math.round(st.vBase * Math.max(cc, 1.0));
        info.innerHTML = '<b>' + st.icon + ' ' + st.name + '</b> · vBase <b>' + st.vBase + ' км/ч</b><br><span style="color:var(--text-mute)">OPT/AVG/PESS:</span> плоская модель для крейсера <b>' + cruise + '</b> км/ч (vBase×cityCycle).<br><span style="color:var(--text-mute)">МАРШРУТ:</span> пошаговая vBase×cityCycle = <b>' + cruise + '</b> км/ч.<br><span style="color:var(--text-mute);font-size:9.5px">Модели разные — могут отличаться ±15%.</span>'
      }
    }
    var head = $('headStyle');
    if (head) head.textContent = st.name.toUpperCase();
    var sel = $('rideStyle');
    if (sel) sel.style.color = st.color
  }

  function buildConfig() {
    var useSpeedProfile = $('useSpeedProfile').checked;
    var mMaxSpeed = useSpeedProfile ? (+$('mMaxSpeed').value || 0) : 0;
    var mMinSpeed = useSpeedProfile ? (+$('mMinSpeed').value || 0) : 0;
    var mStopsPerKm = useSpeedProfile ? (+$('mStopsPerKm').value || 0) : 0;
    var rawTurns = +$('motorTurns').value || 0;
    var spec = E.getMotorSpecById($('mMotorModel').value);
    var effTurns = rawTurns > 0 ? rawTurns : (spec ? spec.baseTurns : 5);
    var slopeMaxFromRoute = (function() {
      try {
        var r = lastRouteData && lastRouteData.alternatives && lastRouteData.alternatives[lastRouteData.selectedIndex];
        if (r && isFinite(r.maxSlope) && r.maxSlope > 0) return r.maxSlope
      } catch (e) {}
      return (+$('slope').value || 0) * 2
    })();
    return {
      bikeMass: +$('bikeMass').value,
      riderMass: +$('riderMass').value,
      cargoMass: +$('cargoMass').value,
      frameType: $('frameType').value,
      wheelSize: $('wheelSize').value,
      tireR17: $('tireR17').value,
      trackSpeed: 85,
      citySpeedMax: 70,
      citySpeedMin: 10,
      trackPct: +$('trackPct').value || 0,
      rideStyle: $('rideStyle').value || 'normal',
      avgSpeed: 0,
      cityCycle: parseFloat($('cityCycle').value) || 1.4,
      slope: +$('slope').value,
      headwind: +$('headwind').value,
      ambientTemp: +$('ambientTemp').value,
      posture: $('posture').value,
      surface: $('surface').value,
      tire: $('tire').value,
      pressure: +$('pressure').value,
      voltageSelect: $('voltageSelect').value,
      voltageMode: $('voltageMode').value,
      motorType: $('motorType').value,
      motorTurns: effTurns,
      cellType: $('cellType').value,
      batterySOH: +$('batterySOH').value,
      assistMode: $('assistMode').value,
      pedalMode: $('pedalMode').checked,
      fwMode: $('fwMode').checked,
      fwEnabled: $('fwMode').checked,
      regenMode: $('regenMode').checked,
      winterMode: $('winterMode').checked,
      regenCurrent: +$('regenCurrent').value,
      motorCooling: $('motorCooling').value,
      riderPower: +$('riderPower').value,
      tariff: +$('tariff').value,
      fuelPrice: +$('fuelPrice').value,
      fuelRate: +$('fuelRate').value,
      yearKm: +$('yearKm').value || 3200,
      mMotorModel: $('mMotorModel').value,
      mMotorPower: +$('mMotorPower').value || 0,
      mMotorPeak: +$('mMotorPeak').value || 0,
      mMotorPrice: +$('mMotorPrice').value || 0,
      mCtrlCurrent: +$('mCtrlCurrent').value || 0,
      mCtrlPhase: +$('mCtrlPhase').value || 0,
      mCtrlEff: +$('mCtrlEff').value || 0,
      mCtrlPrice: +$('mCtrlPrice').value || 0,
      mBattAh: +$('mBattAh').value || 0,
      mBattV: +$('mBattV').value || 0,
      mBattMaxA: +$('mBattMaxA').value || 0,
      mBattPrice: +$('mBattPrice').value || 0,
      mMaxSpeed: mMaxSpeed,
      mMinSpeed: mMinSpeed,
      mStopsPerKm: mStopsPerKm,
      useSpeedProfile: useSpeedProfile,
      uphillPct: (+$('uphillPct').value || 0) / 100,
      slopeMaxPct: slopeMaxFromRoute,
      applyWeather: $('applyWeather') ? $('applyWeather').checked : true,
      hardWeatherCap: $('hardWeatherCap') ? $('hardWeatherCap').checked : false,
      routeRoundTrip: $('routeRoundTrip') ? $('routeRoundTrip').checked : true,
      routeMode: $('routeMode') ? $('routeMode').value : 'bicycle',
      vmaxProfile: null
    }
  }

  function setTplField(id, v) {
    if (userEdited[id]) return;
    var el = $(id);
    if (!el) return;
    el.value = v
  }

  function markTplLocks() {
    TPL_IDS.forEach(function(id) {
      var el = $(id);
      if (!el) return;
      var fld = el.closest('.field');
      if (!fld) return;
      if (userEdited[id]) {
        fld.classList.add('tpl-locked');
        var lbl = fld.querySelector('label');
        if (lbl && !lbl._resetBound) {
          lbl._resetBound = true;
          lbl.title = '' /*сброс через resetAdvBtn*/
        }
      } else {
        fld.classList.remove('tpl-locked')
      }
    })
  }

  function resetFieldToTemplate(id) {
    delete userEdited[id];
    if (id === 'mMaxSpeed') {
      $('mMaxSpeed').value = 50;
      markTplLocks();
      if (lastResults.avg) calculate();
      return
    }
    if (id === 'mMinSpeed') {
      $('mMinSpeed').value = 5;
      markTplLocks();
      if (lastResults.avg) calculate();
      return
    }
    if (id === 'mStopsPerKm') {
      $('mStopsPerKm').value = 1.5;
      markTplLocks();
      if (lastResults.avg) calculate();
      return
    }
    var m = E.getMotorSpecById($('mMotorModel').value);
    if (m) applyMotorTemplate(m);
    markTplLocks();
    if (lastResults.avg) calculate()
  }

  function applyMotorTemplate(spec) {
    if (!spec) return;
    $('motorType').value = spec.type;
    setTplField('mMotorPower', spec.power);
    setTplField('mMotorPeak', spec.peak);
    setTplField('mMotorPrice', E.estimateMotorPrice(spec.type, spec.power));
    if (spec.recV) {
      var vOpts = ['36', '48', '52', '60', '72', '84', '96'];
      if (vOpts.indexOf(String(spec.recV)) >= 0) {
        if (!userEdited['voltageSelect']) $('voltageSelect').value = String(spec.recV);
        if (!userEdited['mBattV']) $('mBattV').value = spec.recV
      } else {
        if (!userEdited['voltageSelect']) $('voltageSelect').value = 'auto'
      }
    }
    if (spec.recCtrlBat) setTplField('mCtrlCurrent', spec.recCtrlBat);
    if (spec.recCtrlPhz) setTplField('mCtrlPhase', spec.recCtrlPhz);
    setTplField('mCtrlEff', 0);
    setTplField('mCtrlPrice', spec.type === 'dd' ? 15000 : spec.type === 'mid' ? 20000 : 9000);
    if (spec.recBattAh) setTplField('mBattAh', spec.recBattAh);
    if (spec.recV) setTplField('mBattV', spec.recV);
    if (spec.recBattMaxA) setTplField('mBattMaxA', spec.recBattMaxA);
    setTplField('mBattPrice', 0);
    setTplField('motorTurns', spec.baseTurns);
    if (spec.type !== 'dd') {
      $('fwMode').checked = false;
      $('regenMode').checked = false;
      $('fwMode').disabled = true;
      $('regenMode').disabled = true
    } else {
      $('fwMode').disabled = false;
      $('regenMode').disabled = false
    }
    markTplLocks()
  }

  function renderPeakTable() {
    var el = $('peakAtVTable');
    if (!el) return;
    var vNom = parseInt($('voltageSelect').value) || +$('mBattV').value || 72;
    var sc = E.getSeries(vNom);
    var pv = +(sc * 4.2).toFixed(1),
      av = +(sc * 3.9).toFixed(1),
      lv = +(sc * 3.46).toFixed(1);
    var amps = +$('mCtrlCurrent').value || 120;
    var ci = (+$('mCtrlEff').value || 0) / 100;
    var ec = ci || 0.98,
      ecFallback = !ci;
    if (!ci && lastResults.avg && lastResults.avg.ctrlEff > 0) {
      ec = lastResults.avg.ctrlEff;
      ecFallback = false
    }
    var em = 0.74,
      emFallback = true;
    if (lastResults.avg && lastResults.avg.effM > 0) {
      em = lastResults.avg.effM;
      emFallback = false
    }

    function row(l, v, c) {
      var pe = v * amps * ec,
        pm = pe * em;
      return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:4px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)"><span style="' + c + '">' + l + ' (' + v.toFixed(1) + 'В)</span><span style="color:var(--accent-2);font-weight:700;text-align:right">' + pe.toFixed(0) + 'Вт</span><span style="color:var(--green);font-weight:700;text-align:right">' + pm.toFixed(0) + 'Вт</span></div>'
    }
    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr auto auto;gap:4px;padding:2px 0;border-bottom:1px solid var(--line-hot);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--text-mute);font-weight:900"><span>Точка ' + sc + 'S</span><span>ЭЛ.</span><span>МЕХ.</span></div>' + row('🔵 ПИК', pv, 'color:var(--accent)') + row('🟢 СРЕД', av, 'color:var(--green)') + row('🟠 НИЗК', lv, 'color:var(--accent-2)') + '<div style="margin-top:4px;padding:3px 6px;background:rgba(92,230,110,.05);border-left:2px solid var(--green);font-size:10px;line-height:1.35">' + amps + 'А · КПДк ' + (ec * 100).toFixed(0) + '%' + (ecFallback ? '*' : '') + ' · КПДм ' + (em * 100).toFixed(0) + '%' + (emFallback ? '*' : '') + '</div>' + (ecFallback || emFallback ? '<div style="font-size:9px;color:var(--text-mute);margin-top:2px">* предварительный (запустите расчёт)</div>' : '')
  }

  function R(k, v, c) {
    c = c || '';
    return '<div class="row ' + c + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'
  }

  function qualityBadge(q) {
    if (q >= 0.95) return '<span class="quality-badge">ТОЧНО</span>';
    if (q >= 0.75) return '<span class="quality-badge med">~±15%</span>';
    return '<span class="quality-badge low">~±30%</span>'
  }

  function fmtPayback(m) {
    if (!isFinite(m)) return 'НЕ ОКУП';
    if (m > 240) return '>20 ЛЕТ';
    if (m > 120) return '>10 ЛЕТ';
    if (m > 60) return (m / 12).toFixed(1) + ' лет';
    return m.toFixed(0) + ' мес'
  }

  function makeIcon(letter, color, size) {
    size = size || 22;
    return L.divIcon({
      className: 'custom-marker',
      html: '<div style="background:' + color + ';color:#000;width:' + size + 'px;height:' + size + 'px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:' + (size > 18 ? 12 : 10) + 'px;border:2px solid #fff;box-shadow:0 0 8px rgba(0,0,0,0.7)">' + letter + '</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    })
  }

  function parseCoord(str) {
    if (!str) return null;
    var p = str.replace(/\s/g, '').split(',');
    if (p.length !== 2) return null;
    var lat = parseFloat(p[0]),
      lon = parseFloat(p[1]);
    if (isNaN(lat) || isNaN(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {
      lat: lat,
      lon: lon
    }
  }

  function showRouteStatus(msg, type) {
    var el = $('routeStatus');
    if (!el) return;
    el.className = 'rw-status ' + (type || 'info');
    el.innerHTML = msg
  }

  function calcBearing(lat1, lon1, lat2, lon2) {
    var tr = Math.PI / 180,
      dL = (lon2 - lon1) * tr,
      y = Math.sin(dL) * Math.cos(lat2 * tr),
      x = Math.cos(lat1 * tr) * Math.sin(lat2 * tr) - Math.sin(lat1 * tr) * Math.cos(lat2 * tr) * Math.cos(dL),
      b = Math.atan2(y, x) / tr;
    return (b + 360) % 360
  }

  function angleDiff(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d
  }

  function haversineM(a, b) {
    var R = 6371000,
      la1 = a[0] * Math.PI / 180,
      la2 = b[0] * Math.PI / 180;
    var dLa = (b[0] - a[0]) * Math.PI / 180,
      dLo = (b[1] - a[1]) * Math.PI / 180;
    var s = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(s))
  }

  function findSegment(arr, x) {
    var lo = 0,
      hi = arr.length - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] <= x) lo = mid;
      else hi = mid
    }
    var t = (x - arr[lo]) / ((arr[lo + 1] - arr[lo]) || 1);
    return {
      i: lo,
      t: Math.max(0, Math.min(1, t))
    }
  }

  function buildRouteSamples(flatCoords, elevRange) {
    if (!flatCoords || !flatCoords.length || !elevRange || !elevRange.length) return [];
    var geoDist = [0];
    for (var i = 1; i < flatCoords.length; i++) geoDist.push(geoDist[i - 1] + haversineM(flatCoords[i - 1], flatCoords[i]));
    var totalGeo = geoDist[geoDist.length - 1] || 1;
    var totalElev = elevRange[elevRange.length - 1][0] || 1;
    var scale = totalElev / totalGeo;
    var samples = [];
    for (var j = 0; j < elevRange.length; j++) {
      var d = elevRange[j][0],
        e = elevRange[j][1];
      var targetGeo = d / scale;
      var seg = findSegment(geoDist, targetGeo);
      var p1 = flatCoords[seg.i],
        p2 = flatCoords[seg.i + 1] || p1;
      var lat = p1[0] + (p2[0] - p1[0]) * seg.t;
      var lng = p1[1] + (p2[1] - p1[1]) * seg.t;
      samples.push({
        dist: d,
        elev: e,
        lat: lat,
        lng: lng
      })
    }
    return samples
  }

  function wpLetter(idx) {
    return String.fromCharCode(65 + idx)
  }

  function wpRole(idx, total) {
    if (idx === 0) return 'старт';
    if (idx === total - 1 && total > 1) return 'финиш';
    return 'via'
  }

  function wpColor(idx, total) {
    if (idx === 0) return '#5ce66e';
    if (idx === total - 1 && total > 1) return '#ff8c42';
    return '#a94fe8'
  }

  function rebuildMarkers() {
    waypoints.forEach(function(w) {
      if (w.marker && mapInstance) {
        mapInstance.removeLayer(w.marker);
        w.marker = null
      }
    });
    if (!mapInstance) return;
    var total = waypoints.length;
    waypoints.forEach(function(w, idx) {
      var letter = wpLetter(idx);
      var color = wpColor(idx, total);
      var m = L.marker([w.lat, w.lon], {
        icon: makeIcon(letter, color),
        draggable: true
      }).addTo(mapInstance);
      m.on('dragend', function() {
        var ll = m.getLatLng();
        w.lat = ll.lat;
        w.lon = ll.lng;
        syncWaypointsToInputs();
        renderWaypointsList();
        saveWaypoints();
        clearRoute();
        lastRouteData = null
      });
      m.on('click', function() {
        mapInstance.setView([w.lat, w.lon], Math.max(mapInstance.getZoom(), 14));
        renderWaypointsList()
      });
      w.marker = m
    });
    rebuildWaypointsUI()
  }

  function syncWaypointsToInputs() {
    var rs = $('routeStart'),
      re = $('routeEnd');
    if (waypoints.length === 0) return;
    if (rs) rs.value = waypoints[0].lat.toFixed(5) + ',' + waypoints[0].lon.toFixed(5);
    if (re) re.value = waypoints[waypoints.length - 1].lat.toFixed(5) + ',' + waypoints[waypoints.length - 1].lon.toFixed(5)
  }

  function syncInputsToWaypoints() {
    var rs = $('routeStart'),
      re = $('routeEnd');
    var a = rs ? parseCoord(rs.value) : null;
    var b = re ? parseCoord(re.value) : null;
    if (!a && !b) return;
    if (b && !a && waypoints.length === 0) {
      showRouteStatus('⚠ Сначала задайте точку A', 'err');
      return
    }
    var structureChanged = false;
    if (a) {
      if (waypoints.length === 0) {
        waypoints.push({
          lat: a.lat,
          lon: a.lon,
          marker: null
        });
        structureChanged = true
      } else {
        waypoints[0].lat = a.lat;
        waypoints[0].lon = a.lon
      }
    }
    if (b) {
      if (waypoints.length <= 1) {
        waypoints.push({
          lat: b.lat,
          lon: b.lon,
          marker: null
        });
        structureChanged = true
      } else {
        waypoints[waypoints.length - 1].lat = b.lat;
        waypoints[waypoints.length - 1].lon = b.lon
      }
    }
    if (structureChanged) {
      rebuildMarkers()
    } else {
      waypoints.forEach(function(w) {
        if (w.marker) w.marker.setLatLng([w.lat, w.lon])
      });
      renderWaypointsList()
    }
    saveWaypoints()
  }

  function rebuildWaypointsUI() {
    renderWaypointsList();
    updateWpControls();
    var c = $('wpCount');
    if (c) c.textContent = waypoints.length + '/' + MAX_WAYPOINTS
  }

  function renderWaypointsList() {
    var el = $('waypointsList');
    if (!el) return;
    var lbl = $('routeEndLabel');
    if (lbl) {
      if (waypoints.length === 0) lbl.textContent = 'Финиш (lat,lon)';
      else lbl.textContent = 'Точка ' + wpLetter(waypoints.length - 1) + ' (финиш, lat,lon)'
    }
    if (waypoints.length === 0) {
      el.innerHTML = '<div class="wp-empty">Тап по карте — добавить точку</div>';
      return
    }
    var total = waypoints.length;
    var html = '';
    waypoints.forEach(function(w, idx) {
      var letter = wpLetter(idx);
      var role = wpRole(idx, total);
      var cls = idx === 0 ? 'start' : (idx === total - 1 && total > 1 ? 'end' : 'mid');
      var canDelete = total > 2;
      html += '<div class="wp-item" data-idx="' + idx + '">';
      html += '<span class="wp-badge ' + cls + '">' + letter + '</span>';
      html += '<span class="wp-coords">' + w.lat.toFixed(5) + ', ' + w.lon.toFixed(5) + '</span>';
      html += '<span style="color:var(--text-mute);font-size:9px">' + role + '</span>';
      if (canDelete) {
        html += '<button class="wp-del" data-idx="' + idx + '" title="Удалить точку">×</button>'
      } else {
        html += '<span style="width:15px"></span>'
      }
      html += '</div>'
    });
    el.innerHTML = html;
    el.querySelectorAll('.wp-item').forEach(function(item) {
      item.addEventListener('click', function(ev) {
        if (ev.target.classList.contains('wp-del')) return;
        var idx = +item.dataset.idx;
        var w = waypoints[idx];
        if (w && mapInstance) mapInstance.setView([w.lat, w.lon], Math.max(mapInstance.getZoom(), 14))
      })
    });
    el.querySelectorAll('.wp-del').forEach(function(btn) {
      btn.addEventListener('click', function(ev) {
        ev.stopPropagation();
        removeWaypoint(+btn.dataset.idx)
      })
    })
  }

  function updateWpControls() {
    var t = waypoints.length;
    var addBtn = $('wpAddBtn'),
      undoBtn = $('wpUndoBtn'),
      revBtn = $('wpReverseBtn'),
      clrBtn = $('wpClearBtn');
    if (addBtn) addBtn.disabled = t >= MAX_WAYPOINTS;
    if (undoBtn) undoBtn.disabled = t === 0;
    if (revBtn) revBtn.disabled = t < 2;
    if (clrBtn) clrBtn.disabled = t === 0;
    var rf = $('routeFetchBtn');
    if (rf) {
      rf.disabled = t < 2;
      rf.textContent = t < 2 ? '📡 Нужно ≥2 точки' : '📡 Загрузить маршрут'
    }
  }

  function addWaypoint(lat, lon) {
    if (waypoints.length >= MAX_WAYPOINTS) {
      showRouteStatus('⚠ Максимум ' + MAX_WAYPOINTS + ' точек', 'err');
      return
    }
    for (var i = 0; i < waypoints.length; i++) {
      var d = E.haversineLocal([lat, lon], [waypoints[i].lat, waypoints[i].lon]);
      if (d < 3) {
        showRouteStatus('⚠ Точка слишком близко к ' + wpLetter(i), 'err');
        return
      }
    }
    var newWp = {
      lat: lat,
      lon: lon,
      marker: null
    };
    var insertIdx = waypoints.length;
    var insertLabel = 'в конец';
    if (waypoints.length >= 2) {
      var bestDetour = Infinity,
        bestIdx = -1,
        bestSegLen = 0;
      for (var j = 0; j < waypoints.length - 1; j++) {
        var wa = waypoints[j],
          wb = waypoints[j + 1];
        var segLen2 = E.haversineLocal([wa.lat, wa.lon], [wb.lat, wb.lon]);
        if (segLen2 < 10) continue;
        var d1 = E.haversineLocal([lat, lon], [wa.lat, wa.lon]);
        var d2 = E.haversineLocal([lat, lon], [wb.lat, wb.lon]);
        if (d1 >= segLen2 || d2 >= segLen2) continue;
        var detour = d1 + d2 - segLen2;
        if (detour < bestDetour) {
          bestDetour = detour;
          bestIdx = j + 1;
          bestSegLen = segLen2
        }
      }
      if (bestIdx >= 0 && bestDetour < bestSegLen * 0.4) {
        insertIdx = bestIdx;
        insertLabel = 'после ' + wpLetter(bestIdx - 1)
      }
    }
    waypoints.splice(insertIdx, 0, newWp);
    syncWaypointsToInputs();
    rebuildMarkers();
    saveWaypoints();
    clearRoute();
    lastRouteData = null;
    showRouteStatus('📍 Точек: ' + waypoints.length + '/' + MAX_WAYPOINTS + ' · вставлено ' + insertLabel, 'info')
  }

  function removeWaypoint(idx) {
    if (idx < 0 || idx >= waypoints.length) return;
    if (waypoints.length <= 2) {
      showRouteStatus('⚠ Нужно минимум 2 точки', 'err');
      return
    }
    if (waypoints[idx].marker && mapInstance) mapInstance.removeLayer(waypoints[idx].marker);
    waypoints.splice(idx, 1);
    syncWaypointsToInputs();
    rebuildMarkers();
    saveWaypoints();
    clearRoute();
    lastRouteData = null;
    showRouteStatus('🗑 Удалена точка · осталось ' + waypoints.length, 'info')
  }

  function clearAllWaypoints() {
    waypoints.forEach(function(w) {
      if (w.marker && mapInstance) mapInstance.removeLayer(w.marker)
    });
    waypoints = [];
    syncWaypointsToInputs();
    rebuildWaypointsUI();
    clearRoute();
    lastRouteData = null;
    saveWaypoints();
    showRouteStatus('🗑 Очищено', 'info')
  }

  function reverseWaypoints() {
    if (waypoints.length < 2) return;
    waypoints.reverse();
    syncWaypointsToInputs();
    rebuildMarkers();
    saveWaypoints();
    clearRoute();
    lastRouteData = null;
    showRouteStatus('⇄ Реверс · A↔B', 'info')
  }

  function undoLastWaypoint() {
    if (waypoints.length === 0) return;
    removeWaypoint(waypoints.length - 1)
  }

  /*patch_signals_v2 UI*/
  var signalsLayer = null;

  function getSignalIcon(type) {
    var m = {
      traffic_signals: {
        c: '#ff3333',
        e: '\uD83D\uDEA6'
      },
      crossing: {
        c: '#ffcc00',
        e: '\uD83D\uDEB6'
      },
      crossing_signal: {
        c: '#ffcc00',
        e: '\uD83D\uDEB8'
      },
      traffic_calming: {
        c: '#ff8c42',
        e: '\u26A0'
      },
      school: {
        c: '#4fc3f7',
        e: '\uD83C\uDFEB'
      },
      hospital: {
        c: '#a855f7',
        e: '\uD83C\uDFE5'
      },
      roundabout: {
        c: '#888',
        e: '\u21BB'
      },
      living_street: {
        c: '#ff66cc',
        e: '\u25CF'
      }
    };
    return m[type] || {
      c: '#666',
      e: '\u25CF'
    };
  }

  function vZoneLimitByType(t, v) {
    var _el = document.getElementById("rideStyle");
    var _sk = _el ? _el.value : "normal";
    var _L = (window.CityBikeEngine && window.CityBikeEngine.STYLE_LIMITS && window.CityBikeEngine.STYLE_LIMITS[_sk]) || {
      ts: 35,
      cr: 30,
      cs: 25,
      tc: 20,
      rnd: 25,
      live: 40,
      school: 35,
      hosp: 0
    };
    if (t === 'traffic_signals') return _L.ts;
    if (t === 'crossing') return _L.cr;
    if (t === 'crossing_signal') return _L.cs;
    if (t === 'traffic_calming') return _L.tc;
    if (t === 'school') return _L.school;
    if (t === 'hospital') return _L.hosp;
    if (t === 'living_street') return _L.live;
    if (t === 'roundabout') return _L.rnd;
    if (t === 'maxspeed' && v) return v;
    return 0;
  }

  function typeNameRu(t) {
    var m = {
      traffic_signals: 'Светофор',
      crossing: 'Пешеходный переход',
      crossing_signal: 'Переход со светофором',
      traffic_calming: 'Лежачий полицейский',
      school: 'Школа',
      hospital: 'Больница',
      roundabout: 'Круговое движение',
      living_street: 'Жилая зона',
      maxspeed: 'Знак ограничения'
    };
    return m[t] || t;
  }

  function renderSignalsOnMap() {
    try {
      if (signalsLayer && mapInstance) {
        mapInstance.removeLayer(signalsLayer);
        signalsLayer = null
      }
      if (!lastRouteData || !lastRouteData.signals || !lastRouteData.signals.length || !mapInstance) return;
      signalsLayer = L.layerGroup();
      lastRouteData.signals.forEach(function(s) {
        var ic = getSignalIcon(s.type);
        var lim = vZoneLimitByType(s.type, s.v);
        if (!(lim > 0)) return; // v23: больницы без ограничения не рисуем
        var icon = L.divIcon({
          className: 'signal-marker',
          html: '<div style="background:' + ic.c + ';color:#000;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.7)">' + ic.e + '</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        var popup = '<b>' + typeNameRu(s.type) + '</b>';
        if (lim > 0) popup += '<br>Лимит: <b>' + lim + ' км/ч</b>';
        else popup += '<br><span style="color:#888">Без ограничений</span>';
        L.marker([s.lat, s.lng], {
          icon: icon
        }).bindPopup(popup).addTo(signalsLayer);
      });
      signalsLayer.addTo(mapInstance);
    } catch (err) {
      window.__SIGNALS_ERROR__ = err;
      console.error("[signals]", err)
    }
  }

  function clearRoute() {
    if (signalsLayer && mapInstance) {
      mapInstance.removeLayer(signalsLayer);
      signalsLayer = null
    }
    if (routePolylines) {
      routePolylines.forEach(function(p) {
        if (mapInstance) mapInstance.removeLayer(p)
      });
      routePolylines = []
    }
    if (elevationMarker && mapInstance) {
      mapInstance.removeLayer(elevationMarker);
      elevationMarker = null
    }
    var ew = $('elevationWrap');
    if (ew) ew.classList.remove('on');
    var info = $('elevationInfo');
    if (info) info.textContent = '—';
    var alt = $('altSwitcher');
    if (alt) alt.classList.remove('on');
    currentCursorPos = 0;
    var slider = $('elevationSlider');
    if (slider) slider.value = 0;
    lastMapSig = ''
  }

  function initMap() {
    // v23: точки грузятся до карты. Раньше без Leaflet loadWaypoints не вызывался,
    // а при закрытии сохранялся пустой список — маршрут стирался.
    if (typeof L === 'undefined') {
      console.warn('Leaflet не загружен');
      rebuildWaypointsUI();
      return
    }
    var center = HOME_CENTER.slice();
    try {
      var saved = localStorage.getItem(LS_MAP_KEY);
      if (saved) {
        var c = JSON.parse(saved);
        if (c.lat && c.lon) center = [c.lat, c.lon]
      }
    } catch (e) {}
    mapInstance = L.map('map', {
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: false,
      touchZoom: true,
      attributionControl: true
    }).setView(center, 13);
    L.tileLayer('https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=' + API_KEY, {
      attribution: '© OSM © Geoapify',
      maxZoom: 19,
      minZoom: 3
    }).addTo(mapInstance);
    mapInstance.on('click', function(e) {
      addWaypoint(e.latlng.lat, e.latlng.lng)
    });
    mapInstance.on('moveend', function() {
      try {
        var c = mapInstance.getCenter();
        localStorage.setItem(LS_MAP_KEY, JSON.stringify({
          lat: c.lat,
          lon: c.lng
        }))
      } catch (e) {}
    });
    rebuildMarkers();
    syncWaypointsToInputs();
    if (waypoints.length >= 2) {
      var bounds = L.latLngBounds();
      waypoints.forEach(function(w) {
        bounds.extend([w.lat, w.lon])
      });
      mapInstance.fitBounds(bounds, {
        padding: [30, 30]
      })
    }
  }

  function drawColoredRoute(route, isSelected, clickHandler) {
    if (!route) return null;
    if (!route.vmaxProfile || !route.vmaxProfile.segments || route.vmaxProfile.segments.length < 2) {
      var poly = L.polyline(route.flatCoords, {
        color: isSelected ? '#a94fe8' : '#555',
        weight: isSelected ? 6 : 3,
        opacity: isSelected ? .92 : .5,
        lineCap: 'round',
        smoothFactor: 1.2,
        bubblingMouseEvents: false
      });
      if (clickHandler) poly.on('click', clickHandler);
      return poly
    }
    var segs = route.vmaxProfile.segments,
      vMaxMax = route.vmaxProfile.vMaxMax,
      group = L.layerGroup(),
      i = 1;
    while (i < segs.length) {
      var ratio = Math.max(0, Math.min(1, segs[i - 1].vRide / Math.max(vMaxMax, 1)));
      var binKey = Math.round(ratio * 20) / 20;
      var coords = [
        [segs[i - 1].lat, segs[i - 1].lng],
        [segs[i].lat, segs[i].lng]
      ];
      var j = i + 1;
      while (j < segs.length) {
        var r2 = Math.max(0, Math.min(1, segs[j - 1].vRide / Math.max(vMaxMax, 1)));
        var b2 = Math.round(r2 * 20) / 20;
        if (b2 !== binKey) break;
        coords.push([segs[j].lat, segs[j].lng]);
        j++
      }
      var segPoly = L.polyline(coords, {
        color: smoothColor(binKey),
        weight: isSelected ? 6 : 3,
        opacity: isSelected ? .92 : .55,
        lineCap: 'round',
        smoothFactor: 1.2,
        bubblingMouseEvents: false
      });
      if (clickHandler) segPoly.on('click', clickHandler);
      segPoly.addTo(group);
      i = j
    }
    return group
  }

  function drawAllRoutes() {
    if (routePolylines) {
      routePolylines.forEach(function(p) {
        mapInstance.removeLayer(p)
      })
    }
    routePolylines = [];
    if (!lastRouteData || !lastRouteData.alternatives) return;
    var bounds = L.latLngBounds();
    lastRouteData.alternatives.forEach(function(route, idx) {
      var isSelected = (idx === lastRouteData.selectedIndex);
      var layer = drawColoredRoute(route, isSelected, function() {
        selectRoute(idx)
      });
      layer.addTo(mapInstance);
      routePolylines.push(layer);
      route.flatCoords.forEach(function(c) {
        bounds.extend(c)
      })
    });
    mapInstance.fitBounds(bounds, {
      padding: [30, 30]
    })
  }

  function renderAltSwitcher() {
    var el = $('altSwitcher');
    if (!el) return;
    if (!lastRouteData || !lastRouteData.alternatives || lastRouteData.alternatives.length < 2) {
      el.classList.remove('on');
      return
    }
    el.classList.add('on');
    var container = $('altBtns');
    var html = '';
    lastRouteData.alternatives.forEach(function(r, idx) {
      var active = idx === lastRouteData.selectedIndex ? ' active' : '';
      html += '<button class="alt-btn' + active + '" data-idx="' + idx + '">' + (idx + 1) + '</button>'
    });
    container.innerHTML = html;
    container.querySelectorAll('.alt-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        selectRoute(+b.dataset.idx)
      })
    });
    var sel = lastRouteData.alternatives[lastRouteData.selectedIndex];
    var ai = $('altInfo');
    if (ai) ai.innerHTML = 'выбран <b>' + (lastRouteData.selectedIndex + 1) + '</b> · <b>' + (sel.totalDist / 1000).toFixed(1) + ' км</b> · 🛣 ' + (sel.roadSegments ? sel.roadSegments.length : 0) + ' сегм'
  }

  function selectRoute(idx) {
    if (!lastRouteData || !lastRouteData.alternatives || !lastRouteData.alternatives[idx]) return;
    lastRouteData.selectedIndex = idx;
    if (routePolylines) {
      routePolylines.forEach(function(layer) {
        mapInstance.removeLayer(layer)
      });
      routePolylines = [];
      lastRouteData.alternatives.forEach(function(route, i) {
        var layer = drawColoredRoute(route, i === idx, function() {
          selectRoute(i)
        });
        layer.addTo(mapInstance);
        routePolylines.push(layer)
      })
    }
    var route = lastRouteData.alternatives[idx];
    var roundTrip = $('routeRoundTrip').checked;
    $('apiRouteBearing').value = route.bearing.toFixed(0);
    $('apiWindSpeed').value = route.windMs.toFixed(1);
    $('apiWindDir').value = route.windDir.toFixed(0);
    var diffR = angleDiff(route.windDir, route.bearing);
    var hc_tu = route.windMs * Math.cos(diffR * Math.PI / 180);
    $('apiHeadwind').value = hc_tu.toFixed(2);
    $('apiHeadwind').style.color = (Math.abs(hc_tu) < 0.05) ? 'var(--green)' : 'var(--accent-2)';
    renderAltSwitcher();
    applyLastRoute()
  }

  function currentCruiseKmh() {
    if ($('useSpeedProfile').checked && +$('mMaxSpeed').value > 0) return +$('mMaxSpeed').value;
    var st = E.RIDE_STYLES[$('rideStyle').value] || E.RIDE_STYLES.normal;
    return st.vBase
  }

  // Ветер, который при постоянной скорости даёт то же аэросопротивление,
  // что и реальный ветер на всех участках маршрута (с обратным путём).
  function equivHeadwind(route, roundTrip, vKmh) {
    var w = route.windMs,
      dir = route.windDir;
    if (!(w > 0) || !isFinite(dir) || !route.flatCoords || route.flatCoords.length < 2) return 0;
    var v = Math.max(vKmh, 5) / 3.6,
      pts = route.flatCoords,
      step = Math.max(1, Math.floor(pts.length / 600)),
      sum = 0,
      L = 0;

    function add(a, b) {
      var len = haversineM(a, b);
      if (len < 1) return;
      var hc = w * Math.cos(angleDiff(dir, calcBearing(a[0], a[1], b[0], b[1])) * Math.PI / 180),
        va = v + hc;
      sum += va * Math.abs(va) * len;
      L += len
    }
    var prev = pts[0];
    for (var i = step; i < pts.length; i += step) {
      add(prev, pts[i]);
      if (roundTrip) add(pts[i], prev);
      prev = pts[i]
    }
    if (prev !== pts[pts.length - 1]) {
      add(prev, pts[pts.length - 1]);
      if (roundTrip) add(pts[pts.length - 1], prev)
    }
    if (!L) return 0;
    var avg = sum / L,
      veq = (avg >= 0 ? 1 : -1) * Math.sqrt(Math.abs(avg));
    return veq - v
  }

  function applyLastRoute() {
    if (!lastRouteData || !lastRouteData.alternatives || !lastRouteData.alternatives.length) {
      showRouteStatus('⚠ Сначала загрузите маршрут', 'err');
      return
    }
    var route = lastRouteData.alternatives[lastRouteData.selectedIndex];
    var roundTrip = $('routeRoundTrip').checked;
    var mt = $('motorType').value;
    var regenEnabled = $('regenMode').checked && mt === 'dd' && (+$('ambientTemp').value >= -5);
    var bearing = route.bearing,
      windMs = route.windMs,
      windDir = route.windDir;
    var oneWayDist = route.totalDist,
      oneWayGain = route.gain || 0,
      oneWayLoss = route.loss || 0;
    var effDist = roundTrip ? oneWayDist * 2 : oneWayDist;
    // v23: туда-обратно набор = набор туда + сброс туда (на обратном пути он становится подъёмом)
    var effGain = roundTrip ? oneWayGain + oneWayLoss : oneWayGain;
    var effLoss = roundTrip ? oneWayGain + oneWayLoss : oneWayLoss;
    var rd = $('routeDist');
    if (rd) rd.innerHTML = (effDist / 1000).toFixed(1) + '<small>км</small>';
    var rg = $('routeGain');
    if (rg) rg.innerHTML = effGain.toFixed(0) + '<small>м</small>';
    var rsa = $('routeSlopeAvg');
    if (rsa) rsa.innerHTML = route.avgSlope.toFixed(2) + '<small>%</small>';
    var rsm = $('routeSlopeMax');
    if (rsm) rsm.innerHTML = route.maxSlope.toFixed(2) + '<small>%</small>';
    var distKm = Math.round(effDist / 1000);
    if (distKm > 0 && distKm <= 500) {
      $('rangeDistance').value = distKm;
      document.querySelectorAll('.range-head .quick button[data-dist]').forEach(function(b) {
        b.classList.toggle('active', parseInt(b.dataset.dist) === distKm)
      })
    }
    // v23: для общего расчёта ветер берём «эквивалентный» по всем участкам маршрута
    // (и по обратному пути), а не по прямой старт→финиш.
    var hc = equivHeadwind(route, roundTrip, currentCruiseKmh());
    // v23: эффективный уклон = (подъёмы − часть энергии, возвращённой на спусках) / путь.
    // Раньше спуски не учитывались вовсе, а на круговом маршруте подъём шёл дважды.
    var giveBack = regenEnabled ? 0.65 : 0.45;
    var effectiveSlope = effDist > 0 ? (effGain - giveBack * effLoss) / effDist * 100 : 0;
    effectiveSlope = Math.max(-5, Math.min(15, effectiveSlope));
    $('headwind').value = hc.toFixed(2);
    $('apiHeadwind').value = hc.toFixed(2);
    $('apiHeadwind').style.color = (hc < 0.05) ? 'var(--green)' : 'var(--accent-2)';
    $('slope').value = effectiveSlope.toFixed(2);
    var hwEl = $('headwind');
    if (hc < 0) {
      hwEl.style.color = 'var(--green)';
      hwEl.style.borderColor = 'var(--green)'
    } else {
      hwEl.style.color = '';
      hwEl.style.borderColor = ''
    }
    var windStr = (hc < 0.05 ? '<span style="color:var(--green)">в среднем попутный</span>' : 'в среднем встречный') + ', ветер ' + windMs.toFixed(1) + ' м/с';
    var sigCount = lastRouteData.signals ? lastRouteData.signals.length : 0;
    var overpassStatus = lastRouteData.overpassStatus || 'ok';
    var vp = route.vmaxProfile;
    var nCurves = vp ? vp.nCurves : 0;
    var sigInfo = '';
    if (overpassStatus === 'ok' || overpassStatus === 'cached') {
      if (sigCount > 0) {
        sigInfo = ' · 🚦 ' + sigCount;
        if (vp && vp.nTrafficSignals > 0) {
          sigInfo += ' · светофоров ' + vp.nTrafficSignals;
          if (vp.stopTimeH > 0) sigInfo += ' · ~' + (Math.round(vp.nTrafficStops * 10) / 10) + ' ост. (+' + (vp.stopTimeH * 60).toFixed(0) + ' мин)'
        }
      }
    } else if (overpassStatus === 'offline') {
      sigInfo = sigCount > 0 ? ' · 🚦 ' + sigCount + ' (офлайн-база)' : '';
      if (vp && vp.nTrafficSignals > 0) sigInfo += ' · светофоров ' + vp.nTrafficSignals + ' · ~' + (Math.round(vp.nTrafficStops * 10) / 10) + ' ост. (+' + (vp.stopTimeH * 60).toFixed(0) + ' мин)'
    } else if (overpassStatus === 'fallback: roadSegments only') {
      sigInfo = ' · 🚦 <span style="color:var(--accent-2)">светофоры не загрузились — ограничения по типу дороги</span>';
    } else if (sigCount > 0) {
      sigInfo = ' · 🚦 ' + sigCount + ' <span style="color:var(--red)">(' + esc(overpassStatus) + ')</span>';
    } else {
      sigInfo = ' · 🚦 <span style="color:var(--red)">' + esc(overpassStatus) + '</span>';
    }
    var curveInfo = ' · ↻ ' + nCurves;
    var slopeInfo = ' · ↑' + effGain.toFixed(0) + ' м ↓' + effLoss.toFixed(0) + ' м → уклон ' + effectiveSlope.toFixed(2) + '%';
    var wpCount = waypoints.length;
    var wpStr = wpCount > 2 ? ' · <b>' + wpCount + ' точек</b>' : '';
    var distStr = roundTrip ? '<b>' + (oneWayDist / 1000).toFixed(1) + ' км × 2 = ' + (effDist / 1000).toFixed(1) + ' км</b>' : '<b>' + (effDist / 1000).toFixed(1) + ' км в одну сторону</b>';
    var wDesc = '';
    if (lastRouteData.weather && lastRouteData.weather.desc) {
      wDesc = ' · 🌤 ' + esc(lastRouteData.weather.desc)
    }
    var retryBtn = $('retryOverpassBtn');
    if (retryBtn) {
      var ovs = lastRouteData.overpassStatus || 'ok';
      retryBtn.style.display = (ovs === 'ok' || ovs === 'cached' || ovs === 'offline') ? 'none' : 'inline-block'
    }
    showRouteStatus('✅' + slopeInfo + ' · ветер ' + hc.toFixed(2) + ' м/с (' + windStr + ')' + sigInfo + curveInfo + wpStr + wDesc + '<br>📏 ' + distStr, 'ok');
    if (route.elevRange && route.elevRange.length > 1) {
      drawElevationProfile(route.elevRange, effDist, currentCursorPos, roundTrip);
      if (route.samples && route.samples.length) {
        updateElevationCursor(currentCursorPos)
      }
    }
    renderSignalsOnMap();
    if (lastResults.avg) renderRangeCalc();
    calculate()
  }
  // ═══════════════════════════════════════════════════════════════════════════════
  // v23: объекты дорожной обстановки (светофоры, переходы, лежачие, школы...)
  //  1) офлайн-база (Сибирь) → 2) Overpass, 4 зеркала параллельно.
  //  Берём только объекты не дальше ~40 м от линии маршрута (раньше — всё в
  //  прямоугольнике: 1310 маркеров при 31 реальном). Проигравшие запросы отменяются,
  //  пустой/ошибочный ответ самого быстрого зеркала больше не выбрасывает остальные.
  // ═══════════════════════════════════════════════════════════════════════════════
  var offlinePoi = null;

  function loadOfflinePoi() {
    if (window.__OFFLINE_POI__ && window.__OFFLINE_POI__.length) {
      offlinePoi = window.__OFFLINE_POI__;
      console.log('[POI] офлайн-база: ' + offlinePoi.length)
    }
  }
  var POI_TYPE = {
    ts: 'traffic_signals',
    crs: 'crossing_signal',
    cr: 'crossing',
    tc: 'traffic_calming',
    sch: 'school',
    hos: 'hospital'
  };
  var NEAR_M = {
    traffic_signals: 40,
    crossing_signal: 25,
    crossing: 20,
    traffic_calming: 20,
    roundabout: 40,
    living_street: 60,
    school: 120,
    hospital: 0
  };

  // Сетка точек маршрута (шаг ~20 м) для быстрого «далеко ли объект от линии».
  function buildRouteIndex(flatCoords) {
    var CELL = 0.0012,
      grid = {},
      pts = [];
    for (var i = 0; i < flatCoords.length; i++) {
      var a = flatCoords[i],
        b = flatCoords[i + 1];
      pts.push(a);
      if (!b) break;
      var d = haversineM(a, b),
        n = Math.floor(d / 20);
      for (var k = 1; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n])
    }
    pts.forEach(function(p) {
      var key = Math.floor(p[0] / CELL) + ':' + Math.floor(p[1] / CELL);
      (grid[key] || (grid[key] = [])).push(p)
    });
    return {
      near: function(lat, lng, r) {
        var gx = Math.floor(lat / CELL),
          gy = Math.floor(lng / CELL);
        for (var dx = -1; dx <= 1; dx++)
          for (var dy = -1; dy <= 1; dy++) {
            var c = grid[(gx + dx) + ':' + (gy + dy)];
            if (!c) continue;
            for (var j = 0; j < c.length; j++)
              if (haversineM([lat, lng], c[j]) <= r) return true
          }
        return false
      }
    }
  }

  function keepNearRoute(list, flatCoords) {
    var idx = buildRouteIndex(flatCoords);
    return list.filter(function(s) {
      var r = NEAR_M[s.type];
      if (r == null) r = 30;
      return r > 0 && idx.near(s.lat, s.lng, r)
    })
  }

  function routeBBox(flatCoords, pad) {
    var S = 90,
      N = -90,
      W = 180,
      E2 = -180;
    flatCoords.forEach(function(c) {
      if (c[0] < S) S = c[0];
      if (c[0] > N) N = c[0];
      if (c[1] < W) W = c[1];
      if (c[1] > E2) E2 = c[1]
    });
    return [S - pad, W - pad, N + pad, E2 + pad]
  }

  function filterOfflinePoi(flatCoords) {
    if (!offlinePoi || !offlinePoi.length) return null;
    var bb = routeBBox(flatCoords, 0.003),
      res = [];
    for (var i = 0; i < offlinePoi.length; i++) {
      var p = offlinePoi[i];
      if (p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3]) res.push({
        lat: p[0],
        lng: p[1],
        type: POI_TYPE[p[2]] || 'crossing'
      })
    }
    return res
  }

  function parseOverpassData(data) {
    var signals = [];
    (data.elements || []).forEach(function(e) {
      var lat = e.lat || (e.center && e.center.lat);
      var lng = e.lon || (e.center && e.center.lon);
      if (!lat || !lng) return;
      var tags = e.tags || {};
      var type = '';
      if (tags.highway === 'traffic_signals') type = 'traffic_signals';
      else if (tags.highway === 'crossing') type = tags.crossing === 'traffic_signals' ? 'crossing_signal' : 'crossing';
      else if (tags.traffic_calming) type = 'traffic_calming';
      else if (tags.amenity === 'school') type = 'school';
      else if (tags.junction === 'roundabout') type = 'roundabout';
      else if (tags.highway === 'living_street') type = 'living_street';
      var v = 0;
      if (tags.maxspeed) {
        var ms = String(tags.maxspeed).match(/\d+/);
        if (ms) v = parseFloat(ms[0])
      }
      if (type) signals.push({
        lat: lat,
        lng: lng,
        type: type,
        v: v
      })
    });
    return signals
  }

  async function fetchTrafficSignals(flatCoords, routeKey) {
    if (!flatCoords || flatCoords.length < 2) return {
      signals: [],
      status: 'empty_coords',
      mirror: null
    };
    var off = filterOfflinePoi(flatCoords);
    if (off && off.length) {
      var nearOff = keepNearRoute(off, flatCoords);
      if (nearOff.length) return {
        signals: nearOff,
        status: 'offline',
        mirror: 'офлайн-база'
      }
    }
    var cacheKey = 'overpass_v4_' + routeKey;
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        var cd = JSON.parse(cached);
        if (cd.expires > Date.now()) return {
          signals: cd.signals,
          status: 'cached',
          mirror: cd.mirror || null
        }
      }
    } catch (e) {}
    var bb = routeBBox(flatCoords, 0.0015).join(',');
    var query = '[out:json][timeout:15];(' +
      'node["highway"="traffic_signals"](' + bb + ');' +
      'node["highway"="crossing"](' + bb + ');' +
      'node["traffic_calming"](' + bb + ');' +
      'way["junction"="roundabout"](' + bb + ');' +
      'node["amenity"="school"](' + bb + ');' +
      'way["highway"="living_street"](' + bb + ');' +
      ');out center tags;';
    var TIMEOUT = 20000;
    var ctrls = OVERPASS_MIRRORS.map(function() {
      return new AbortController()
    });

    function one(url, i) {
      var tid = setTimeout(function() {
        ctrls[i].abort()
      }, TIMEOUT);
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json'
        },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrls[i].signal
      }).then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json()
      }).then(function(data) {
        clearTimeout(tid);
        if (!data || !Array.isArray(data.elements)) throw new Error('bad json');
        if (data.remark && !data.elements.length) throw new Error('remark: ' + String(data.remark).slice(0, 60));
        return {
          data: data,
          mirror: url,
          i: i
        }
      }).catch(function(err) {
        clearTimeout(tid);
        throw {
          mirror: url,
          msg: err && err.name === 'AbortError' ? 'timeout ' + (TIMEOUT / 1000) + 's' : ((err && err.message) || 'network')
        }
      })
    }
    var result = await new Promise(function(resolve) {
      var left = OVERPASS_MIRRORS.length,
        errors = [],
        emptyHit = null,
        done = false;

      function settle() {
        if (--left === 0 && !done) {
          done = true;
          resolve(emptyHit || {
            data: null,
            errors: errors
          })
        }
      }
      OVERPASS_MIRRORS.forEach(function(m, i) {
        one(m, i).then(function(r) {
          if (done) return;
          if (r.data.elements.length) {
            done = true;
            resolve(r);
            return
          }
          emptyHit = emptyHit || r; // пустой, но корректный ответ — ждём остальных
          settle()
        }, function(e) {
          errors.push(_overpassHost(e.mirror) + ': ' + e.msg);
          settle()
        })
      })
    });
    ctrls.forEach(function(c, i) {
      if (result.i !== i) try {
        c.abort()
      } catch (e) {}
    });
    if (result.data) {
      var signals = keepNearRoute(parseOverpassData(result.data), flatCoords);
      var mirrorStr = _overpassHost(result.mirror);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          signals: signals,
          expires: Date.now() + (signals.length ? 3600000 : 300000),
          mirror: mirrorStr
        }))
      } catch (e) {}
      return {
        signals: signals,
        status: 'ok',
        mirror: mirrorStr
      }
    }
    return {
      signals: [],
      status: 'fallback_road',
      mirror: null,
      errors: result.errors || []
    }
  }

  function parseRoadSegments(legs) {
    var segments = [],
      offset = 0;
    (legs || []).forEach(function(leg) {
      (leg.steps || []).forEach(function(step) {
        var stepDist = step.distance || 0;
        segments.push({
          distStart: offset,
          distEnd: offset + stepDist,
          roadClass: step.road_class || step.roadClass || '',
          surface: step.surface || '',
          maxspeed: step.speed_limit || step.maxspeed || 0
        });
        offset += stepDist
      })
    });
    return segments
  }
  async function fetchRouteAndWind() {
    if (waypoints.length < 2) {
      showRouteStatus('❌ Нужно минимум 2 точки', 'err');
      return
    }
    var btn = $('routeFetchBtn');
    btn.disabled = true;
    btn.textContent = '⏳...';
    showRouteStatus('⏳ Строим маршрут через ' + waypoints.length + ' точек...', 'info');
    try {
      var mode = $('routeMode').value || 'bicycle';
      var wpStr = waypoints.map(function(w) {
        return w.lat.toFixed(6) + ',' + w.lon.toFixed(6)
      }).join('|');
      // v23: route_details нужен, чтобы в шагах пришли road_class/speed_limit —
      // без него «запасной путь по классу дороги» всегда был пустым.
      // Параметра alternatives у Geoapify нет — убран.
      var useAlternatives = false;
      var url = 'https://api.geoapify.com/v1/routing?waypoints=' + encodeURIComponent(wpStr) + '&mode=' + mode + '&details=elevation,route_details&apiKey=' + API_KEY;
      var res = await fetch(url);
      if (!res.ok) {
        var errBody = '';
        try {
          errBody = await res.text()
        } catch (e) {}
        console.error('[Geoapify ' + res.status + ']', errBody);
        var errHint = '';
        try {
          var ej = JSON.parse(errBody);
          if (ej.message) errHint = ' — ' + String(ej.message).slice(0, 160);
          else if (ej.error) errHint = ' — ' + String(ej.error).slice(0, 160)
        } catch (e) {}
        throw new Error('Geoapify: HTTP ' + res.status + errHint)
      }
      var data = await res.json();
      if (!data.features || !data.features.length) throw new Error('Маршрут не найден');
      var alternatives = data.features.map(function(feature) {
        var props = feature.properties,
          legs = props.legs;
        if (!legs || !legs.length) return null;
        var allPoints = [],
          totalDist = 0,
          offset = 0;
        legs.forEach(function(leg) {
          var legDistM = 0;
          if (leg.distance) legDistM = leg.distance;
          if (leg.elevation_range && leg.elevation_range.length > 1) {
            var erMax = leg.elevation_range[leg.elevation_range.length - 1][0];
            if (!legDistM && erMax > 0) legDistM = erMax;
            var erScale = (erMax > 0 && legDistM > 0) ? legDistM / erMax : 1;
            leg.elevation_range.forEach(function(p) {
              allPoints.push({
                dist: offset + p[0] * erScale,
                elev: p[1]
              })
            })
          }
          offset += legDistM;
          totalDist += legDistM
        });
        if (allPoints.length < 2) return null;
        var roadSegments = parseRoadSegments(legs);
        var gain = 0,
          loss = 0,
          segs = [];
        for (var i = 1; i < allPoints.length; i++) {
          var dH = allPoints[i].elev - allPoints[i - 1].elev;
          var dD = allPoints[i].dist - allPoints[i - 1].dist;
          if (dD > 0.5) {
            var grade = (dH / dD) * 100;
            segs.push({
              grade: grade,
              dist: dD
            });
            if (dH > 0) gain += dH;
            else loss -= dH
          }
        }
        var avgSlope = totalDist > 0 ? (gain / totalDist) * 100 : 0;
        var sorted = segs.map(function(s) {
          return Math.abs(s.grade)
        }).sort(function(a, b) {
          return a - b
        });
        var idx95 = Math.floor(sorted.length * 0.95);
        var maxSlope = sorted[idx95] || 0;
        var coords = feature.geometry.coordinates,
          flatCoords = [];
        if (coords.length && Array.isArray(coords[0][0])) {
          coords.forEach(function(part) {
            part.forEach(function(c) {
              flatCoords.push([c[1], c[0]])
            })
          })
        } else {
          coords.forEach(function(c) {
            flatCoords.push([c[1], c[0]])
          })
        }
        var bearing = calcBearing(waypoints[0].lat, waypoints[0].lon, waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lon);
        var elevRange = allPoints.map(function(p) {
          return [p.dist, p.elev]
        });
        var samples = buildRouteSamples(flatCoords, elevRange);
        return {
          avgSlope: avgSlope,
          maxSlope: maxSlope,
          bearing: bearing,
          totalDist: totalDist,
          gain: gain,
          loss: loss,
          elevRange: elevRange,
          samples: samples,
          flatCoords: flatCoords,
          roadSegments: roadSegments
        };
      }).filter(function(r) {
        return r !== null
      });
      if (!alternatives.length) throw new Error('Нет данных о высотах');
      showRouteStatus('⏳ Светофоры и переходы: офлайн-база → Overpass (' + OVERPASS_MIRRORS.length + ' зеркала)...', 'info');
      var signals = [];
      var overpassStatus = 'ok';
      var overpassMirror = null;
      try {
        var _allCoords = [];
        alternatives.forEach(function(a) {
          if (a && a.flatCoords) a.flatCoords.forEach(function(c) {
            _allCoords.push(c)
          })
        });
        var routeKey = waypoints.map(function(w) {
          return w.lat.toFixed(4) + '_' + w.lon.toFixed(4)
        }).join('_') + '_' + _allCoords.length;
        var sigRes = await fetchTrafficSignals(_allCoords, routeKey);
        signals = sigRes.signals;
        overpassStatus = sigRes.status;
        overpassMirror = sigRes.mirror;
        if (overpassStatus === 'fallback_road') {
          overpassStatus = 'fallback: roadSegments only';
          console.warn('[Overpass] Все зеркала недоступны. Используем ограничения по классу дороги.');
          if (sigRes.errors) console.warn('[Overpass errors]', sigRes.errors);
        }
      } catch (e) {
        overpassStatus = 'error: ' + (e.message || 'unknown');
        console.warn('Overpass:', e.message)
      }
      showRouteStatus('⏳ Запрашиваем погоду...', 'info');
      // v23: если wttr.in недоступен, маршрут всё равно строится — с ветром из поля «Ветер».
      var wData = null,
        weatherErr = '';
      try {
        var _wctrl = new AbortController();
        var _wtid = setTimeout(function() {
          try {
            _wctrl.abort()
          } catch (e) {}
        }, 10000);
        var wRes = await fetch('https://wttr.in/' + waypoints[0].lat.toFixed(4) + ',' + waypoints[0].lon.toFixed(4) + '?format=j1', {
          signal: _wctrl.signal
        });
        clearTimeout(_wtid);
        if (!wRes.ok) throw new Error('HTTP ' + wRes.status);
        wData = await wRes.json()
      } catch (e) {
        weatherErr = (e && e.name === 'AbortError') ? 'таймаут' : ((e && e.message) || 'нет связи');
        console.warn('[wttr.in]', weatherErr)
      }
      var cc = wData && wData.current_condition && wData.current_condition[0];
      var windMs, windDir;
      if (cc) {
        windMs = parseFloat(cc.windspeedKmph) / 3.6;
        windDir = parseFloat(cc.winddirDegree)
      }
      var weatherOk = !!cc && isFinite(windMs) && isFinite(windDir);
      if (!weatherOk) {
        // ручной ветер считаем встречным по направлению старт→финиш
        windMs = Math.abs(+$('headwind').value || 0);
        windDir = calcBearing(waypoints[0].lat, waypoints[0].lon, waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lon)
      }
      var astro = (wData && wData.weather && wData.weather[0] && wData.weather[0].astronomy && wData.weather[0].astronomy[0]) || {};
      var weatherInfo = {
        ok: weatherOk,
        err: weatherErr,
        precipMM: cc ? (parseFloat(cc.precipMM || 0) || 0) : 0,
        cloudcover: cc ? (parseFloat(cc.cloudcover || 0) || 0) : 0,
        visibility: cc ? (parseFloat(cc.visibility || 10) || 10) : 10,
        desc: (cc && cc.weatherDesc && cc.weatherDesc[0] && cc.weatherDesc[0].value) || '',
        tempC: cc ? parseFloat(cc.temp_C) : NaN,
        windMs: windMs,
        windDir: windDir,
        sunrise: astro.sunrise || null,
        sunset: astro.sunset || null
      };
      alternatives.forEach(function(r) {
        r.windMs = windMs;
        r.windDir = windDir;
        r.vmaxProfile = null
      });
      lastRouteData = {
        alternatives: alternatives,
        selectedIndex: 0,
        weather: weatherInfo,
        signals: signals,
        overpassStatus: overpassStatus,
        overpassMirror: overpassMirror
      };
      lastMapSig = '';
      drawAllRoutes();
      selectRoute(0);
      var segCount = alternatives[0].roadSegments.length;
      var sunInfo = (weatherInfo.sunrise ? ' · 🌅 ' + weatherInfo.sunrise : '') + (weatherInfo.sunset ? ' · 🌇 ' + weatherInfo.sunset : '');
      var altInfo = (useAlternatives && alternatives.length > 1) ? ' · вариантов: <b>' + alternatives.length + '</b>' : '';
      var wInfo = weatherInfo.ok ? (weatherInfo.desc ? ' · 🌤 ' + esc(weatherInfo.desc) : '') : ' · <span style="color:var(--accent-2)">погода недоступна (' + esc(weatherInfo.err) + '), ветер из поля</span>';
      var opStatus;
      if (overpassStatus === 'ok' || overpassStatus === 'cached') {
        opStatus = ' · ' + esc(overpassMirror)
      } else if (overpassStatus === 'fallback: roadSegments only') {
        opStatus = ' · <span style="color:var(--accent-2)">⚠ светофоры не загрузились — ограничения по типу дороги</span>'
      } else {
        opStatus = ' · <span style="color:var(--red)">Overpass ' + esc(overpassStatus) + '</span>'
      }
      showRouteStatus('✅ Готово · ' + waypoints.length + ' точек · ' + (alternatives[0].totalDist / 1000).toFixed(1) + ' км' + altInfo + ' · 🚦 ' + signals.length + ' · 🛣 ' + segCount + ' сегм · 🌬 ' + windMs.toFixed(1) + ' м/с' + wInfo + sunInfo + opStatus, 'ok');
    } catch (err) {
      console.error(err);
      showRouteStatus('❌ ' + esc(err.message || 'Ошибка загрузки'), 'err')
    } finally {
      btn.disabled = false;
      updateWpControls()
    }
  }

  function drawElevationProfile(elevRange, totalDist, cursorPos, roundTrip) {
    var wrap = $('elevationWrap');
    if (!wrap) return;
    wrap.classList.add('on');
    var canvas = $('elevationCanvas'),
      rect = canvas.getBoundingClientRect(),
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = rect.width,
      H = rect.height,
      pad = {
        top: 8,
        bottom: 16,
        left: 32,
        right: 8
      },
      cw = W - pad.left - pad.right,
      ch = H - pad.top - pad.bottom;
    if (!elevRange || elevRange.length < 2) return;
    var effElevRange = elevRange;
    if (roundTrip) {
      var oneWayDist = elevRange[elevRange.length - 1][0];
      effElevRange = [];
      for (var i = 0; i < elevRange.length; i++) {
        effElevRange.push([elevRange[i][0], elevRange[i][1]])
      }
      for (var i = elevRange.length - 1; i >= 0; i--) {
        effElevRange.push([oneWayDist + (oneWayDist - elevRange[i][0]), elevRange[i][1]])
      }
    }
    var minE = Infinity,
      maxE = -Infinity;
    effElevRange.forEach(function(p) {
      if (p[1] < minE) minE = p[1];
      if (p[1] > maxE) maxE = p[1]
    });
    var rangeE = maxE - minE || 1;
    canvas._elevRange = effElevRange;
    canvas._totalDist = totalDist;
    canvas._pad = pad;
    canvas._cw = cw;
    canvas._ch = ch;
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 3; i++) {
      var y = pad.top + ch * i / 3;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke()
    }
    var grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, 'rgba(169,79,232,.30)');
    grad.addColorStop(.5, 'rgba(169,79,232,.12)');
    grad.addColorStop(1, 'rgba(169,79,232,.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ch);
    effElevRange.forEach(function(p) {
      var x = pad.left + (p[0] / totalDist) * cw,
        y = pad.top + ch - ((p[1] - minE) / rangeE) * ch;
      ctx.lineTo(x, y)
    });
    ctx.lineTo(pad.left + cw, pad.top + ch);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a94fe8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    effElevRange.forEach(function(p, i) {
      var x = pad.left + (p[0] / totalDist) * cw,
        y = pad.top + ch - ((p[1] - minE) / rangeE) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y)
    });
    ctx.stroke();
    if (cursorPos != null && cursorPos >= 0 && cursorPos <= 1) {
      var cx = pad.left + cursorPos * cw;
      ctx.strokeStyle = 'rgba(255,204,0,.85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + ch);
      ctx.stroke();
      ctx.setLineDash([]);
      var targetDist = cursorPos * totalDist,
        interpElev = minE;
      for (var k = 1; k < effElevRange.length; k++) {
        if (effElevRange[k][0] >= targetDist) {
          var t = (targetDist - effElevRange[k - 1][0]) / ((effElevRange[k][0] - effElevRange[k - 1][0]) || 1);
          interpElev = effElevRange[k - 1][1] + (effElevRange[k][1] - effElevRange[k - 1][1]) * t;
          break
        }
      }
      var cy = pad.top + ch - ((interpElev - minE) / rangeE) * ch;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill()
    }
    ctx.fillStyle = '#888';
    ctx.font = '10px Manrope, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(maxE.toFixed(0), pad.left - 3, pad.top + 6);
    ctx.fillText(minE.toFixed(0), pad.left - 3, pad.top + ch);
    ctx.textAlign = 'center';
    ctx.fillText('0', pad.left, H - 3);
    ctx.fillText((totalDist / 1000).toFixed(1) + ' км', pad.left + cw, H - 3)
  }

  function drawVmaxProfile(profile, totalDist, cursorPos, roundTrip) {
    var canvas = $('vmaxCanvas');
    if (!canvas || !profile || !profile.segments || profile.segments.length < 2) return;
    var wrap = $('elevationWrap');
    if (wrap) wrap.classList.add('on');
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = rect.width,
      H = rect.height;
    var pad = {
      top: 16,
      bottom: 28,
      left: 34,
      right: 38
    };
    var cw = W - pad.left - pad.right,
      ch = H - pad.top - pad.bottom;
    canvas._pad = pad;
    canvas._cw = cw;
    canvas._ch = ch;
    var segs = profile.segments;
    var vMaxMin = Infinity,
      vMaxMax = -Infinity;
    segs.forEach(function(s) {
      if (s.vMax < vMaxMin) vMaxMin = s.vMax;
      if (s.vMax > vMaxMax) vMaxMax = s.vMax
    });
    vMaxMin = Math.floor(vMaxMin / 5) * 5;
    vMaxMax = Math.ceil(vMaxMax / 5) * 5;
    if (vMaxMax - vMaxMin < 5) vMaxMax = vMaxMin + 5;
    var hasEffective = false;
    segs.forEach(function(s) {
      if (Math.abs(s.vMax - s.vRide) > 0.5) hasEffective = true
    });
    var series = profile.series || 20;
    var vMinV = series * 3.0,
      vMaxV = series * 4.2;
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 3; i++) {
      var y = pad.top + ch * i / 3;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke()
    }
    ctx.font = '10px Manrope, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#a94fe8';
    for (var i = 0; i <= 3; i++) {
      var val = vMaxMax - (vMaxMax - vMaxMin) * i / 3;
      ctx.fillText(val.toFixed(0), pad.left - 3, pad.top + ch * i / 3 + 4)
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5ce66e';
    for (var i = 0; i <= 3; i++) {
      ctx.fillText(Math.round(100 - i * 100 / 3) + '%', pad.left + cw + 3, pad.top + ch * i / 3 + 4)
    }
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    segs.forEach(function(s, i) {
      var x = pad.left + (s.dist / totalDist) * cw;
      var norm = (s.voltage - vMinV) / Math.max(vMaxV - vMinV, 1);
      var y = pad.top + ch - norm * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y)
    });
    ctx.stroke();
    ctx.strokeStyle = '#5ce66e';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    segs.forEach(function(s, i) {
      var x = pad.left + (s.dist / totalDist) * cw;
      var y = pad.top + ch - s.soc * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y)
    });
    ctx.stroke();
    ctx.setLineDash([]);
    var grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, 'rgba(169,79,232,.22)');
    grad.addColorStop(.5, 'rgba(169,79,232,.09)');
    grad.addColorStop(1, 'rgba(169,79,232,.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    segs.forEach(function(s, i) {
      var x = pad.left + (s.dist / totalDist) * cw;
      var y = pad.top + ch - ((s.vMax - vMaxMin) / Math.max(vMaxMax - vMaxMin, 1)) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y)
    });
    var lastX = pad.left + (segs[segs.length - 1].dist / totalDist) * cw;
    ctx.lineTo(lastX, pad.top + ch);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a94fe8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    segs.forEach(function(s, i) {
      var x = pad.left + (s.dist / totalDist) * cw;
      var y = pad.top + ch - ((s.vMax - vMaxMin) / Math.max(vMaxMax - vMaxMin, 1)) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y)
    });
    ctx.stroke();
    if (hasEffective) {
      ctx.strokeStyle = '#ff8c42';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      segs.forEach(function(s, i) {
        var x = pad.left + (s.dist / totalDist) * cw;
        var y = pad.top + ch - ((s.vRide - vMaxMin) / Math.max(vMaxMax - vMaxMin, 1)) * ch;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y)
      });
      ctx.stroke();
      ctx.setLineDash([])
    }
    segs.forEach(function(sg) {
      var x = pad.left + (sg.dist / totalDist) * cw;
      var y = pad.top + ch;
      if (sg.isSignal) {
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.arc(x, y + 6, 3, 0, Math.PI * 2);
        ctx.fill()
      } else if (sg.curv > 0.02 && Math.abs(sg.vRide - sg.vCurve) < 0.5) {
        ctx.fillStyle = '#ff8c42';
        ctx.beginPath();
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x - 3, y + 9);
        ctx.lineTo(x + 3, y + 9);
        ctx.closePath();
        ctx.fill()
      } else if (sg.zoneName && sg.vZone <= sg.vRide + 0.5) {
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(x, y + 6, 2.5, 0, Math.PI * 2);
        ctx.fill()
      } else if (sg.roadName && sg.vRoad <= sg.vRide + 0.5) {
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.rect(x - 2, y + 4, 4, 4);
        ctx.fill()
      }
    });
    if (profile.distToCutoff > 0 && profile.distToCutoff < totalDist) {
      var cxCut = pad.left + (profile.distToCutoff / totalDist) * cw;
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 2]);
      ctx.beginPath();
      ctx.moveTo(cxCut, pad.top);
      ctx.lineTo(cxCut, pad.top + ch);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 11px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✗ НЕ ДОЕДЕТ', cxCut, pad.top + 10)
    }
    if (cursorPos != null && cursorPos >= 0 && cursorPos <= 1) {
      var cx = pad.left + cursorPos * cw;
      ctx.strokeStyle = 'rgba(255,204,0,.85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + ch);
      ctx.stroke();
      ctx.setLineDash([]);
      var targetDist = cursorPos * totalDist;
      var interp = segs[segs.length - 1];
      for (var i = 1; i < segs.length; i++) {
        if (segs[i].dist >= targetDist) {
          var t = (targetDist - segs[i - 1].dist) / ((segs[i].dist - segs[i - 1].dist) || 1);
          interp = {
            vMax: segs[i - 1].vMax + t * (segs[i].vMax - segs[i - 1].vMax),
            vRide: segs[i - 1].vRide + t * (segs[i].vRide - segs[i - 1].vRide),
            soc: segs[i - 1].soc + t * (segs[i].soc - segs[i - 1].soc),
            voltage: segs[i - 1].voltage + t * (segs[i].voltage - segs[i - 1].voltage)
          };
          break
        }
      }
      var cy = pad.top + ch - ((interp.vMax - vMaxMin) / Math.max(vMaxMax - vMaxMin, 1)) * ch;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill()
    }
    ctx.fillStyle = '#888';
    ctx.font = '10px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0', pad.left, H - 2);
    ctx.fillText((totalDist / 1000).toFixed(1) + ' км', pad.left + cw, H - 2);
    ctx.textAlign = 'left';
    ctx.font = '9px Manrope, sans-serif';
    ctx.fillStyle = '#a94fe8';
    ctx.fillText('■ vMax', pad.left + 2, pad.top - 4);
    if (hasEffective) {
      ctx.fillStyle = '#ff8c42';
      ctx.fillText('▬ vRide', pad.left + 46, pad.top - 4);
      ctx.fillStyle = '#5ce66e';
      ctx.fillText('▬SOC', pad.left + 92, pad.top - 4);
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('▬V', pad.left + 124, pad.top - 4)
    }
    ctx.fillStyle = '#ff3333';
    ctx.fillText('●свет', pad.left + 144, pad.top - 4);
    ctx.fillStyle = '#ff8c42';
    ctx.fillText('▲пов', pad.left + 178, pad.top - 4);
    ctx.fillStyle = '#a855f7';
    ctx.fillText('●зона', pad.left + 210, pad.top - 4);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText('■дорога', pad.left + 248, pad.top - 4)
  }

  function updateElevationCursor(pos) {
    currentCursorPos = Math.max(0, Math.min(1, pos));
    if (!lastRouteData || !lastRouteData.alternatives || !lastRouteData.alternatives.length) return;
    var route = lastRouteData.alternatives[lastRouteData.selectedIndex];
    var roundTrip = $('routeRoundTrip').checked;
    var oneWay = route.totalDist;
    var effDist = roundTrip ? oneWay * 2 : oneWay;
    var targetDist = currentCursorPos * effDist;
    var onReturn = false,
      distOnOneWay = targetDist;
    if (roundTrip && targetDist > oneWay) {
      onReturn = true;
      distOnOneWay = effDist - targetDist
    }
    var samples = route.samples,
      idx = 0;
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].dist >= distOnOneWay) {
        idx = i;
        break
      }
      idx = i
    }
    var sample = samples[idx];
    if (!sample) return;
    if (!elevationMarker) {
      var elevIcon = L.divIcon({
        className: 'custom-elev-marker',
        html: '<div style="width:12px;height:12px;background:#ffcc00;border:2px solid #000;border-radius:50%;box-shadow:0 0 8px #ffcc00;"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      elevationMarker = L.marker([sample.lat, sample.lng], {
        icon: elevIcon
      }).addTo(mapInstance)
    } else {
      elevationMarker.setLatLng([sample.lat, sample.lng])
    }
    var grade = 0;
    if (idx > 0 && idx < samples.length - 1) {
      var dDist = samples[idx + 1].dist - samples[idx - 1].dist,
        dElev = samples[idx + 1].elev - samples[idx - 1].elev;
      if (dDist > 0.5) grade = (dElev / dDist) * 100
    }
    if (onReturn) grade = -grade;
    var info = $('elevationInfo');
    if (info) {
      var gradeCls = grade > 1 ? 'grade-up' : (grade < -1 ? 'grade-down' : 'grade-flat');
      var gradeStr = (grade >= 0 ? '+' : '') + grade.toFixed(1) + '%';
      var dirLabel = onReturn ? ' <b>(обр)</b>' : '';
      info.innerHTML = '📍 <b>' + (targetDist / 1000).toFixed(2) + ' км</b>' + dirLabel + ' · <b>' + sample.elev.toFixed(0) + 'м</b> · уклон <span class="' + gradeCls + '">' + gradeStr + '</span>';
      if (route.vmaxProfile && route.vmaxProfile.segments) {
        var vpSegs = route.vmaxProfile.segments;
        var vMaxNow = null,
          vRideNow = null,
          socNow = null,
          reason = null,
          roadName = '',
          zoneName = '',
          windTempNow = null,
          ttoNow = null;
        for (var ii = 0; ii < vpSegs.length; ii++) {
          if (vpSegs[ii].dist >= targetDist) {
            vMaxNow = vpSegs[ii].vMax;
            vRideNow = vpSegs[ii].vRide;
            socNow = vpSegs[ii].soc * 100;
            reason = vpSegs[ii].limitReason;
            roadName = vpSegs[ii].roadName || '';
            zoneName = vpSegs[ii].zoneName || '';
            windTempNow = vpSegs[ii].windingTemp;
            ttoNow = vpSegs[ii].timeToOverheatS;
            break
          }
          vMaxNow = vpSegs[ii].vMax;
          vRideNow = vpSegs[ii].vRide;
          socNow = vpSegs[ii].soc * 100;
          reason = vpSegs[ii].limitReason;
          roadName = vpSegs[ii].roadName || '';
          zoneName = vpSegs[ii].zoneName || '';
          windTempNow = vpSegs[ii].windingTemp;
          ttoNow = vpSegs[ii].timeToOverheatS
        }
        if (vMaxNow != null) {
          info.innerHTML += ' · <b style="color:#a94fe8">vMax ' + vMaxNow.toFixed(0) + '</b>';
          if (Math.abs(vMaxNow - vRideNow) > 0.5) info.innerHTML += ' <span style="color:#ff8c42">/ едем ' + vRideNow.toFixed(0) + '</span>';
          if (reason && reason !== 'стиль') info.innerHTML += ' <span style="color:#ff8c42;font-size:10px">(' + reason + ')</span>';
          if (roadName) info.innerHTML += ' <span style="color:#4fc3f7;font-size:10px">[' + roadName + ']</span>';
          info.innerHTML += ' · <b style="color:#5ce66e">SOC ' + socNow.toFixed(0) + '%</b>';
          if (windTempNow != null) {
            var tCls = smoothColorTemp(windTempNow);
            info.innerHTML += ' · <b style="color:' + tCls + '">🌡 ' + windTempNow.toFixed(0) + '°C</b>';
            if (ttoNow != null && isFinite(ttoNow) && ttoNow < 3600) info.innerHTML += ' <span style="color:#ff3333;font-size:10px">⏱ ' + (ttoNow / 60).toFixed(0) + 'м</span>'
          }
        }
      }
    }
    drawElevationProfile(route.elevRange, effDist, currentCursorPos, roundTrip);
    if (route.vmaxProfile) drawVmaxProfile(route.vmaxProfile, effDist, currentCursorPos, roundTrip)
  }

  function setAdvMode(mode) {
    advMode = mode;
    try {
      localStorage.setItem('citybikeAdvMode', mode)
    } catch (e) {}
    var el = $('advCompact'),
      fl = $('advFull');
    if (el) el.style.display = mode === 'compact' ? 'grid' : 'none';
    if (fl) fl.style.display = mode === 'full' ? 'block' : 'none';
    document.querySelectorAll('.adv-controls button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.adv === mode)
    })
  }

  function renderCompactAdvanced(S, stages) {
    if (!IS_V221) return;
    var el = $('advCompact');
    if (!el) return;

    function row(k, v, cls) {
      cls = cls || '';
      return '<div class="adv-group-row ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'
    }

    function group(t, r) {
      return '<div class="adv-group"><h3>' + t + '</h3>' + r + '</div>'
    }
    var g1 = '';
    g1 += row('Масса', S.mass.toFixed(0) + ' кг');
    g1 += row('CdA', S.CdA.toFixed(3) + ' м²');
    g1 += row('Crr', S.crr.toFixed(5));
    g1 += row('Силы', 'Г' + S.fGravity.toFixed(0) + '·К' + S.fRolling.toFixed(0) + '·А' + S.fAero.toFixed(0) + '·Σ' + S.fCruise.toFixed(0) + ' Н');
    g1 += row('Тормоз 25→0', S.brakeDist25.toFixed(1) + ' м');
    var g2 = '';
    g2 += row('НОМ', S.motorNom + ' Вт');
    g2 += row('Мех пик', S.powerToWheelPeak.toFixed(0) + ' Вт (' + (S.effM * 100).toFixed(1) + '%)', 'hot');
    g2 += row('Витки', S.motorTurns + ' · KV ' + S.motorKV.toFixed(2));
    g2 += row('Потолок', S.vMaxByWindingRaw.toFixed(0) + ' км/ч');
    g2 += row('vMax', S.vMax.toFixed(1) + ' (' + S.vMaxLimiter + ')', 'hot');
    var g3 = '';
    g3 += row('Батарея', S.currentPeak.toFixed(0) + ' А');
    g3 += row('Фаза', S.currentPhasePeak.toFixed(0) + ' А', 'hot');
    g3 += row('P бат', S.pBattFromPack.toFixed(0) + ' Вт');
    g3 += row('Контроллер', S.ctrlCurrentLimit + '/' + S.ctrlPhaseLimit.toFixed(0) + ' А');
    g3 += row('КПД контр', (S.ctrlEff * 100).toFixed(1) + '%', 'good');
    var g4 = '';
    var _wT = Math.min(S.windingTemp, 180),
      _wTp = Math.min(S.windingTempPeak, 180),
      _hsT = Math.min(_wT + 20, 200);
    var tCls = _wT > 100 ? 'bad' : (_wT > 80 ? 'warn' : '');
    g4 += row('Обмотка ср/пик/магн', _wT.toFixed(0) + '° / ' + _wTp.toFixed(0) + '° / ' + S.magnetTemp.toFixed(0) + '°', tCls);
    g4 += row('Горячая точка', _hsT.toFixed(0) + '°', _hsT > 120 ? 'bad' : (_hsT > 90 ? 'warn' : 'good'));
    g4 += row('Потери', S.heatLossEq.toFixed(0) + ' / ' + S.heatLossPeak.toFixed(0) + ' Вт', 'hot');
    g4 += row('До 120°C', isFinite(S.timeToOverheat) ? (S.timeToOverheat / 60).toFixed(0) + ' мин' : '∞', S.timeToOverheat < 1800 ? 'warn' : 'good');
    g4 += row('Пик до 120°C', isFinite(S.timeToOverheatPeak) ? (S.timeToOverheatPeak / 60).toFixed(1) + ' мин' : '∞', S.timeToOverheatPeak < 600 ? 'bad' : (S.timeToOverheatPeak < 1800 ? 'warn' : 'good'));
    if (S.vmaxProfile && S.vmaxProfile.windingTempMax != null) g4 += row('Маршр пик', S.vmaxProfile.windingTempMax.toFixed(0) + '°C', S.vmaxProfile.windingTempMax > 100 ? 'bad' : '');
    var g5 = '';
    g5 += row('АКБ', S.voltageNom.toFixed(1) + 'В (' + S.S_pack + 'S) · ' + S.battery.capacity + 'Ач');
    g5 += row('Ватт-час', S.battery.wh.toFixed(0) + ' Втч');
    g5 += row('Сред/отсеч', S.voltageAvg.toFixed(1) + 'В / ' + S.voltageCutoff.toFixed(1) + 'В');
    g5 += row('Ресурс', S.cycLifeVal + ' цикл', 'good');
    g5 += row('Рекуп', S.regenEnabled ? 'ВКЛ +' + S.regenSavedWhKm.toFixed(2) + ' Втч/км' : 'ВЫКЛ', S.regenEnabled ? 'good' : 'warn');
    if (S.winterActive) g5 += row('Зима', S.winterAuto ? 'АВТО' : 'ВРУЧН', 'warn');
    var g6 = '';
    g6 += row('Комплект', S.totalPrice.toLocaleString('ru-RU') + ' ₽', 'hot');
    g6 += row('TCO 5л', Math.round(S.tco5y).toLocaleString('ru-RU') + ' ₽');
    g6 += row('Окуп', fmtPayback(S.paybackMonths));
    g6 += row('Бенз/эл', S.fuelCostPer100km.toFixed(0) + '₽ / ' + S.evCostPer100km.toFixed(1) + '₽');
    g6 += row('Экономия', S.netSavePer100km.toFixed(0) + '₽/100 · ' + (S.yearSaving / 1000).toFixed(0) + '₽/год', 'good');
    if (stages && stages.etalon && stages.etalon.realRangeKm > 0) {
      var pct = (S.realRangeKm / stages.etalon.realRangeKm * 100).toFixed(0);
      g6 += row('От эталона', pct + '%', pct >= 70 ? 'good' : (pct >= 40 ? 'warn' : 'bad'))
    }
    el.innerHTML = group('🏃 ДВИЖЕНИЕ', g1) + group('⚙ МОТОР', g2) + group('⚡ ЭЛЕКТРИКА', g3) + group('🌡 ТЕПЛО', g4) + group('🔋 АКБ', g5) + group('💰 ЭКОНОМИКА', g6)
  }

  function renderEtalonBlock(stages) {
    var section = $('etalonSection'),
      block = $('etalonBlock');
    if (!stages || !section || !block) {
      if (section) section.style.display = 'none';
      return
    }
    section.style.display = 'flex';
    var e = stages.etalon,
      w = stages.withWeather,
      c = stages.withCity,
      r = stages.real;
    var maxWh = Math.max(e.whKmCr, w.whKmCr, c.whKmCr, 1);

    function barPct(v) {
      return Math.max(2, Math.min(100, (v / maxWh) * 100))
    }
    var dW = w.whKmCr - e.whKmCr,
      dC = c.whKmCr - e.whKmCr;
    var html = '<div class="etalon-subtitle">Идеал: <b>20°C, штиль, ровно, SOH 100%</b></div><div class="etalon-bars">';
    html += '<div class="ebar etalon"><div class="ebar-label">◈ ЭТАЛОН<span class="ebar-small">20°C штиль</span></div><div class="ebar-track"><div class="ebar-fill" style="width:' + barPct(e.whKmCr) + '%"></div></div><div class="ebar-val">' + e.whKmCr.toFixed(1) + '<small>Втч/км</small></div></div>';
    html += '<div class="ebar weather"><div class="ebar-label">🌡 ПОГОДА<span class="ebar-small">' + r.temp + '°C ' + r.headwind + 'м/с</span></div><div class="ebar-track"><div class="ebar-fill" style="width:' + barPct(w.whKmCr) + '%"></div></div><div class="ebar-val">' + w.whKmCr.toFixed(1) + '<small>' + (dW >= 0 ? '+' : '') + dW.toFixed(1) + '</small></div></div>';
    html += '<div class="ebar city"><div class="ebar-label">🚦 ГОРОД<span class="ebar-small">пробки</span></div><div class="ebar-track"><div class="ebar-fill" style="width:' + barPct(c.whKmCr) + '%"></div></div><div class="ebar-val">' + c.whKmCr.toFixed(1) + '<small>' + (dC >= 0 ? '+' : '') + dC.toFixed(1) + '</small></div></div></div>';
    html += '<table class="etalon-table"><thead><tr><th>Параметр</th><th class="col-etalon">Эталон</th><th class="col-real">Реальность</th><th class="col-delta">Δ</th></tr></thead><tbody>';

    function row(l, ev, rv, u, inv) {
      var d = rv - ev,
        dp = ev !== 0 ? (d / ev) * 100 : 0,
        good = inv ? d < 0 : d > 0,
        cls = Math.abs(d) < 0.01 ? '' : (good ? 'pos' : 'neg'),
        sgn = d >= 0 ? '+' : '';
      return '<tr><td>' + l + '</td><td class="col-etalon">' + ev.toFixed(1) + (u ? ' ' + u : '') + '</td><td class="col-real">' + rv.toFixed(1) + (u ? ' ' + u : '') + '</td><td class="col-delta ' + cls + '">' + sgn + d.toFixed(1) + ' (' + sgn + dp.toFixed(0) + '%)</td></tr>'
    }
    html += row('Расход', e.whKmCr, r.whKmCr, 'Втч/км', false) + row('Запас', e.realRangeKm, r.realRangeKm, 'км', true) + row('vMax', e.vMax, r.vMax, 'км/ч', false) + row('T обм', e.windingTemp, r.windingTemp, '°C', false) + row('КПД', e.effM * 100, r.effM * 100, '%', false);
    html += '</tbody></table>';
    var ratio = e.realRangeKm > 0 ? (r.realRangeKm / e.realRangeKm) * 100 : 0,
      vCls = ratio >= 70 ? 'good' : (ratio >= 40 ? 'warn' : 'bad'),
      vIcon = ratio >= 70 ? '✅' : (ratio >= 40 ? '⚠' : '❌');
    html += '<div class="etalon-verdict ' + vCls + '"><div class="ev-icon">' + vIcon + '</div><div class="ev-body"><span class="big">' + ratio.toFixed(0) + '% от эталона</span><br><b>' + r.realRangeKm.toFixed(0) + ' км</b> vs <b>' + e.realRangeKm.toFixed(0) + ' км</b></div></div>';
    block.innerHTML = html;
    updateEtalonVisibility()
  }

  function updateEtalonVisibility() {
    var b = $('etalonBlock'),
      t = $('etalonToggle');
    if (!b || !t) return;
    if (etalonExpanded && b.innerHTML) {
      b.classList.add('on');
      t.classList.add('on');
      t.querySelector('span:nth-child(2)').textContent = 'СКРЫТЬ ЭТАЛОН'
    } else {
      b.classList.remove('on');
      t.classList.remove('on');
      t.querySelector('span:nth-child(2)').textContent = 'ЭТАЛОННЫЙ РАСЧЁТ'
    }
  }

  function setupEtalonToggle() {
    var t = $('etalonToggle');
    if (!t) return;
    t.addEventListener('click', function() {
      etalonExpanded = !etalonExpanded;
      try {
        localStorage.setItem(LS_ETALON_KEY, etalonExpanded)
      } catch (e) {}
      updateEtalonVisibility()
    })
  }

  function renderRangeCalc() {
    if (!lastResults.avg) return;
    var opt = lastResults.opt,
      avg = lastResults.avg,
      pess = lastResults.pess;
    var dist = E.clamp(parseFloat($('rangeDistance').value) || 50, 1, 500);
    var cf = E.clamp(parseFloat($('rangeCoastFactor').value) || 0, 0, 40);
    var boost = 1 + cf / 100,
      optR = opt.realRangeKm * boost,
      avgR = avg.realRangeKm * boost,
      pessR = pess.realRangeKm * boost,
      routeR = avg.routeRangeKm ? avg.routeRangeKm * boost : null,
      bonusKm = avg.realRangeKm * (boost - 1);
    var maxR = Math.max(optR, avgR, pessR, routeR || 0, dist),
      scale = Math.max(maxR * 1.15, dist * 1.05);

    function bp(v) {
      return Math.min(100, (v / scale) * 100)
    }
    var eO = optR >= dist,
      eA = avgR >= dist,
      eP = pessR >= dist,
      eRoute = routeR ? routeR >= dist : true;
    var rec = $('rangeRec'),
      rC, rI, rT, rS;
    // v23: вердикт по порядку сценариев. Раньше «Хватит +-50 км» (Math.min с null = 0)
    // и «Даже в ОПТ не хватает», когда оптимистичный как раз хватал.
    var worstR = Math.min.apply(null, [avgR, pessR].concat(routeR ? [routeR] : []));
    if (eA && eP && eRoute) {
      rC = 'ok';
      rI = '✅';
      rT = 'Хватит, запас ' + Math.max(0, worstR - dist).toFixed(0) + ' км';
      rS = routeR ? 'Проходят все сценарии и маршрут' : 'Проходят все сценарии'
    } else if (!eRoute) {
      rC = 'bad';
      rI = '❌';
      rT = 'ПО МАРШРУТУ НЕ ХВАТИТ';
      rS = 'По маршруту ' + routeR.toFixed(0) + ' км < ' + dist + ' км'
    } else if (eA) {
      rC = 'warn';
      rI = '⚠';
      rT = 'Впритык';
      rS = 'В среднем хватит, в пессимистичном нет'
    } else if (eO) {
      rC = 'warn';
      rI = '⚠';
      rT = 'Только при удаче';
      rS = 'Хватит лишь в оптимистичном сценарии'
    } else {
      rC = 'bad';
      rI = '❌';
      rT = 'НЕ ХВАТИТ';
      rS = 'Даже в оптимистичном сценарии ' + optR.toFixed(0) + ' км < ' + dist + ' км'
    }
    rec.className = 'range-rec ' + rC;
    rec.innerHTML = '<div class="rc-icon">' + rI + '</div><div class="rc-body">' + rT + '<div class="rc-sub">' + rS + '</div></div>';
    var scn = $('rangeScn');

    function row(cls, label, sub, avail, dv) {
      if (avail == null) return '';
      var en = avail >= dv,
        m = avail - dv,
        pct = bp(avail),
        mp = bp(dv),
        ov = avail < dv,
        fc = 'scn-bar-fill' + (ov ? ' over' : ''),
        bt = (en ? '+' : '−') + Math.abs(m).toFixed(0) + 'км';
      return '<div class="scn ' + cls + '"><div class="scn-l">' + label + '<small>' + sub + '</small></div><div><div class="scn-nums"><span>Запас: <b>' + avail.toFixed(0) + ' км</b></span><span>До: <b>' + dv.toFixed(0) + '</b></span></div><div class="scn-bar"><div class="' + fc + '" style="width:' + pct + '%"></div><div class="scn-bar-marker" style="left:' + mp + '%"></div></div></div><div class="scn-r ' + (en ? 'ok' : 'no') + '"><span class="big">' + bt + '</span><small>' + (en ? 'остаток' : 'не хватает') + '</small></div></div>'
    }
    scn.innerHTML = row('opt', '🟢 ОПТ', 'стиль без погоды', optR, dist) + row('avg', '🔵 СРЕД', 'стиль номинал', avgR, dist) + row('pess', '🟠 ПЕСС', 'стиль пессим', pessR, dist) + row('route', '🚦 МАРШРУТ', 'погода→расход', routeR, dist);
    var sum = $('rangeSum'),
      cc = cf > 0 ? '<div class="sum-cell"><div class="l">🍃 БОНУС</div><div class="v">+' + bonusKm.toFixed(1) + '<small>км</small></div></div>' : '';
    sum.innerHTML = '<div class="sum-cell"><div class="l">СТОИМОСТЬ</div><div class="v">' + (avg.whKmCr * dist / 1000 * avg.tariff).toFixed(2) + '<small>₽</small></div></div><div class="sum-cell"><div class="l">ВРЕМЯ</div><div class="v">' + (dist / Math.max(avg.avgSpeed, 5)).toFixed(1) + '<small>ч</small></div></div><div class="sum-cell"><div class="l">ЭНЕРГИЯ</div><div class="v">' + (avg.whKmCr * dist / 1000 / boost).toFixed(2) + '<small>кВтч</small></div></div><div class="sum-cell"><div class="l">ЗАРЯДОВ</div><div class="v">' + (dist / avgR).toFixed(2) + '<small>×</small></div></div>' + (routeR ? '<div class="sum-cell route"><div class="l">🚦 МАРШРУТ</div><div class="v">' + routeR.toFixed(0) + '<small>км</small></div></div>' : '') + cc;
    var adv;
    if (!eRoute) adv = '<b style="color:var(--red)">По маршруту не хватит ' + (dist - (routeR || 0)).toFixed(0) + ' км.</b> Сократите до ' + routeR.toFixed(0) + ' км или едьте спокойнее.';
    else if (eA && eP) adv = '<b>По среднему</b> запас <span class="accent">' + (avgR - dist).toFixed(0) + ' км</span>. Маршрут: <span class="accent">' + (routeR ? routeR.toFixed(0) : '—') + ' км</span>.';
    else if (eA) adv = '<b>Впритык.</b> Надёжно — до <span class="accent">' + pessR.toFixed(0) + ' км</span>.';
    else if (eO) adv = '<b>Осторожно.</b> Сократить до <span class="accent">' + avgR.toFixed(0) + ' км</span>.';
    else adv = '<b>Не хватит.</b> Максимум <span class="accent">' + optR.toFixed(0) + ' км</span>.';
    if (routeR && routeR < dist) adv += ' <span style="color:var(--yellow);font-weight:700">🚦 Маршрут: не хватит ' + (dist - routeR).toFixed(0) + ' км</span>';
    if (cf > 0) adv += ' <span style="padding:2px 6px;background:rgba(92,230,110,.15);border-left:2px solid var(--green);color:var(--green);font-weight:700">🍃 +' + cf + '% → +' + bonusKm.toFixed(1) + 'км</span>';
    $('rangeAdvice').innerHTML = adv
  }

  function renderAll(S, opt, pess, stages) {
    var hp = S.heatLossPeak || S.heatLoss || 0;
    var style = S.styleKey || 'normal';
    var styleObj = E.RIDE_STYLES[style] || E.RIDE_STYLES.normal;
    var modeStr = S.pedalMode ? 'PAS+' + S.modeName : 'ГАЗ',
      frameStr = S.frameType === 'space' ? '·ПРОСТР' : '',
      fwStr = S.fwEnabled ? '·FW' : '',
      regenStr = S.regenEnabled ? '·РЕКУП' : '·БЕЗ РЕКУП',
      winterStr = S.winterActive ? '·❄' : '';
    var coolStr = S.motorCooling !== 'none' ? '·ОХЛ' : '';
    var bnC = $('bannerCold'),
      bnH = $('bannerHot'),
      bnF = $('bannerFw'),
      bnE = $('bannerEcon'),
      bnW = $('bannerWinter'),
      bnA = $('bannerAvgWarn'),
      bnVR = $('bannerVRideWarn'),
      bnHW = $('bannerHeatWarn'),
      bnST = $('bannerStyleInfo');
    [bnC, bnH, bnF, bnE, bnW, bnA, bnVR, bnHW, bnST].forEach(function(b) {
      if (b) b.classList.remove('on')
    });
    if (bnST) {
      bnST.classList.add('on');
      if (IS_V22) {
        bnST.innerHTML = styleObj.icon + ' <b>СТИЛЬ: ' + styleObj.name.toUpperCase() + '</b> · vBase ' + styleObj.vBase + ' км/ч · загруженность ×' + S.cityCycle.toFixed(2) + ' (остановок/км ≈ ' + S.stopsPerKmEff.toFixed(2) + ') · крейсер ' + S.speedKmhEff.toFixed(0) + ' · OPT/AVG/PESS'
      } else {
        bnST.innerHTML = styleObj.icon + ' <b>СТИЛЬ: ' + styleObj.name.toUpperCase() + '</b> · vBase ' + styleObj.vBase + ' км/ч · OPT/AVG/PESS для крейсера ' + Math.round(styleObj.vBase * Math.max(S.cityCycle, 1.0)) + ' · МАРШРУТ для vBase×cityCycle ' + Math.round(styleObj.vBase * Math.max(S.cityCycle, 1.0))
      }
    }
    if (S.winterActive) {
      bnW.classList.add('on');
      var rStat = S.regenEnabled ? 'ON' : 'OFF' + (S.regenBlockReason ? ' (' + S.regenBlockReason + ')' : '');
      bnW.innerHTML = '❄ <b>ЗИМА' + (S.winterAuto ? ' АВТО' : '') + ':</b> рекуп ' + rStat + (S.chargeBlocked ? ' · заряд блок' : '')
    }
    if (S.temp <= 0) {
      bnC.classList.add('on');
      bnC.innerHTML = '❄️ <b>' + S.temp + '°C:</b> ёмкость ~' + (S.tempDerate * 100).toFixed(0) + '%'
    }
    var _tRoute = S.vmaxProfile && S.vmaxProfile.windingTempMax != null ? S.vmaxProfile.windingTempMax + 20 : null;
    var _tShow = (_tRoute != null ? _tRoute : Math.min(S.windingTemp, 180));
    if (_tShow > 100) {
      bnH.classList.add('on');
      var _tLabel = _tRoute != null ? 'обмотка (маршрут)' : 'обмотка (статика)';
      bnH.innerHTML = '🔥 <b>ПЕРЕГРЕВ:</b> ' + _tLabel + ' ' + _tShow.toFixed(0) + '°C' + (S.windingTemp > 180 ? ' <span style="font-size:9px;color:var(--text-mute)">(статика упирается в 180°C — перегрев)</span>' : '')
    }
    if (S.fwEnabled) {
      var fh = S.vMaxLimiter === 'ПО ВИТКАМ';
      bnF.classList.add('on');
      bnF.style.borderColor = fh ? 'var(--green)' : 'var(--accent-2)';
      bnF.innerHTML = fh ? '⚡ <b>FW РАБОТАЕТ:</b> vMax <b>' + S.vMax.toFixed(1) + ' км/ч</b> · winding-limit расширен +50%, КПД −10%.' : '⚡ <b>FW активен, но power-limited:</b> vMax <b>' + S.vMax.toFixed(1) + ' км/ч</b> (КПД −10%).'
    }
    var econMsgs = [];
    if (S.netSavePer100km < 0) econMsgs.push('💸 <b>ЭКОНОМИЯ <0</b>');
    // v23: раньше эти подмены происходили молча
    if (S.turnsClamped && S.turnsRange) econMsgs.push('🌀 <b>Витки ' + S.turnsRequested + '</b> вне диапазона ' + S.turnsRange[0] + '–' + S.turnsRange[1] + ' для этого мотора — считаю как ' + S.motorTurns);
    if (S.battery && S.battery.price && S.battery.price.P && Math.abs(S.battery.capacity - S.battRequestedAh) > 0.5) econMsgs.push('🔋 <b>Батарея ' + S.battery.capacity + ' Ач</b>, а не ' + S.battRequestedAh + ': ячейки по ' + (S.battery.price.cellCap || (S.battery.capacity / S.battery.price.P)) + ' Ач, сборка ' + S.battery.price.S + 'S' + S.battery.price.P + 'P');
    if (econMsgs.length) {
      bnE.classList.add('on');
      bnE.innerHTML = econMsgs.join('<br>')
    }
    if (S.vmaxProfile && (S.vmaxProfile.heatWarn || (S.vmaxProfile.timeToOverheatS != null && isFinite(S.vmaxProfile.timeToOverheatS) && S.vmaxProfile.timeToOverheatS < 3600))) {
      if (bnHW) {
        bnHW.classList.add('on');
        var tStart = S.vmaxProfile.windingTempStart,
          tMax = S.vmaxProfile.windingTempMax,
          tEnd = S.vmaxProfile.windingTempAtEnd;
        var tempStr;
        var _hs = tMax + 20;
        if (Math.abs(tMax - tStart) < 2) {
          tempStr = '🌡 старт ' + tStart.toFixed(0) + '°C → конец ' + tEnd.toFixed(0) + '°C (средняя; обмотка ~' + _hs.toFixed(0) + '°C)'
        } else {
          tempStr = '🌡 старт ' + tStart.toFixed(0) + '°C → пик ' + tMax.toFixed(0) + '°C (обмотка ~' + _hs.toFixed(0) + '°C) → конец ' + tEnd.toFixed(0) + '°C'
        }
        var ttoStr = '';
        if (tMax < 60) {
          ttoStr = ' · ✅ мотор не нагревается';
        } else if (S.vmaxProfile.timeToOverheatS != null && isFinite(S.vmaxProfile.timeToOverheatS)) {
          if (tMax >= 80) {
            ttoStr = ' · ⏱ до 120°C: ' + (S.vmaxProfile.timeToOverheatS / 60).toFixed(0) + ' мин (при пиковой)';
          } else {
            ttoStr = ' · ⏱ до 120°C: ' + (S.vmaxProfile.timeToOverheatS / 60).toFixed(0) + ' мин (при пике мощности)';
          }
        }
        var cutStr = S.vmaxProfile.heatWarn ? ' · <b style="color:#fff">⚠ достигнет 120°C на ' + (S.vmaxProfile.heatCutoffDist / 1000).toFixed(1) + ' км</b>' : '';
        bnHW.innerHTML = '🔥 <b>ТЕПЛО МАРШРУТА:</b> ' + tempStr + ttoStr + cutStr
      }
    }
    if (S.vmaxProfile && S.vmaxProfile.vRideWeighted > 0) {
      var rsn = [];
      if (S.vmaxProfile.weatherEnergyF > 1.01) rsn.push('погода ' + S.vmaxProfile.weatherKey + (S.vmaxProfile.weatherDesc ? ' (' + esc(S.vmaxProfile.weatherDesc) + ')' : '') + ' → расход ×' + S.vmaxProfile.weatherEnergyF.toFixed(2));
      if (S.vmaxProfile.lightsW > 0) rsn.push('🌙 ' + S.vmaxProfile.nightObjLabel + ' +' + S.vmaxProfile.lightsW + ' Вт');
      if (S.vmaxProfile.nSignals > 0) rsn.push('🚦 ' + S.vmaxProfile.nSignals + ' объектов карты');
      if (S.vmaxProfile.nCurves > 0) rsn.push('↻ ' + S.vmaxProfile.nCurves + ' поворотов');
      if (S.vmaxProfile.hardCap) {
        if (S.vmaxProfile.hardCapActive) rsn.push('<b style="color:var(--red)">HARD CAP ACTIVE: vTarget → ' + S.vmaxProfile.vTargetCruise.toFixed(0) + ' км/ч (было ' + S.vmaxProfile.vTargetNoCap.toFixed(0) + ')</b>');
        else rsn.push('<span style="color:var(--text-mute)">HARD CAP armed (погода ' + S.vmaxProfile.weatherKey + ', не ниже vBase)</span>')
      }
      if (S.vmaxProfile.totalRegenWh > 0) rsn.push('<b style="color:var(--green)">↩ рекуп +' + S.vmaxProfile.totalRegenWh.toFixed(0) + ' Вт·ч</b>');
      if (IS_V22 && S.cityCycle > 1.05) {
        rsn.push('<span style="color:var(--text-mute);font-size:9.5px">cityCycle ×' + S.cityCycle.toFixed(2) + ' применяется только к OPT/AVG/PESS.</span>')
      }
      if (rsn.length > 0) {
        bnVR.classList.add('on');
        var lc = S.vmaxProfile.limitCount || {};
        var header = IS_V22 ? 'vBase ' + styleObj.vBase + ' (cityCycle НЕ в скорости)' : 'vBase×cityCycle ' + Math.round(styleObj.vBase * Math.max(S.cityCycle, 1.0));
        bnVR.innerHTML = '⚠ <b>МАРШРУТ (' + header + '):</b> vRide ' + S.vmaxProfile.vRideWeighted.toFixed(0) + ' средн, ' + S.vmaxProfile.vRideMin.toFixed(0) + ' мин · ограничили: дорога ' + (lc.road || 0) + ', поворот ' + (lc.curve || 0) + ', светофор/зона ' + (lc.signal || 0) + ', мотор ' + (lc.phys || 0) + ', стиль ' + (lc.style || 0) + '<br>' + rsn.join(' · ') + ' · ΔKE ' + S.vmaxProfile.totalKE_loss.toFixed(0) + ' Вт·ч'
      }
    }
    var vmaxStr = S.vmaxProfile ? ' · физ ХХ ' + S.vmaxProfile.vMaxStart.toFixed(0) + '→' + S.vmaxProfile.vMaxEnd.toFixed(0) + ' / едем ' + S.vmaxProfile.vRideStart.toFixed(0) + '→' + S.vmaxProfile.vRideEnd.toFixed(0) + ' (мин ' + S.vmaxProfile.vRideMin.toFixed(0) + ')' : '';
    var speedLine;
    if (IS_V22) {
      speedLine = 'vBase ' + styleObj.vBase + ' км/ч · ×' + S.cityCycle.toFixed(2) + ' остановок/км ≈ ' + S.stopsPerKmEff.toFixed(2) + ' · крейсер ' + S.speedKmhEff.toFixed(0)
    } else {
      speedLine = 'vBase×cityCycle ' + Math.round(styleObj.vBase * Math.max(S.cityCycle, 1.0)) + ' км/ч'
    }
    $('specText').innerHTML = '<div><b>' + (S.motor.label || S.motor.power + 'Вт') + '</b> · ' + S.voltage.toFixed(1) + 'В · ' + S.battery.capacity + 'Ач · <span class="accent">' + styleObj.icon + ' ' + styleObj.name.toUpperCase() + ' · ' + modeStr + frameStr + fwStr + regenStr + winterStr + coolStr + '</span>' + qualityBadge(S.quality) + '</div><div style="margin-top:2px">' + S.mass.toFixed(0) + ' кг · ' + speedLine + ' · pulse ' + (S.pulseFactor ? S.pulseFactor.toFixed(2) : '1.00') + '×' + vmaxStr + '</div><div style="margin-top:2px;color:var(--text-mute);font-size:10px">' + S.whKmCr.toFixed(1) + ' Вт·ч/км · запас ' + S.realRangeKm.toFixed(0) + ' км' + (S.routeRangeKm ? ' · <span style="color:var(--yellow)">маршрут ' + S.routeRangeKm.toFixed(0) + ' км</span>' : '') + '</div>';
    $('totalPrice').innerHTML = S.totalPrice.toLocaleString('ru-RU') + '<small>₽</small>';
    var _g = $('gauges');
    if (_g) {
      _g.innerHTML = '<div class="gauge"><div style="font-size:9px;color:var(--text-mute);letter-spacing:1px">РАСХОД</div><div style="font-size:22px;font-weight:900;color:var(--accent);line-height:1.1">' + S.whKmCr.toFixed(1) + '<small style="font-size:10px;color:var(--text-dim);margin-left:2px">Втч/км</small></div></div>' + '<div class="gauge"><div style="font-size:9px;color:var(--text-mute);letter-spacing:1px">ЗАПАС</div><div style="font-size:22px;font-weight:900;color:var(--green);line-height:1.1">' + S.realRangeKm.toFixed(0) + '<small style="font-size:10px;color:var(--text-dim);margin-left:2px">км</small></div></div>' + '<div class="gauge"><div style="font-size:9px;color:var(--text-mute);letter-spacing:1px">vMax</div><div style="font-size:22px;font-weight:900;color:var(--accent-2);line-height:1.1">' + S.vMax.toFixed(0) + '<small style="font-size:10px;color:var(--text-dim);margin-left:2px">км/ч</small></div></div>' + '<div class="gauge"><div style="font-size:9px;color:var(--text-mute);letter-spacing:1px">КПД</div><div style="font-size:22px;font-weight:900;color:var(--yellow);line-height:1.1">' + (S.effM * 100).toFixed(0) + '<small style="font-size:10px;color:var(--text-dim);margin-left:2px">%</small></div></div>' + '<div class="gauge"><div style="font-size:9px;color:var(--text-mute);letter-spacing:1px">ОКУП</div><div style="font-size:22px;font-weight:900;color:var(--ice);line-height:1.1">' + fmtPayback(S.paybackMonths) + '</div></div>'
    }
    var routeCells = '';
    if (S.vmaxProfile) {
      var vp = S.vmaxProfile;
      var styleCellLabel, styleCellVal;
      if (IS_V22) {
        styleCellLabel = styleObj.icon + ' vBase';
        styleCellVal = styleObj.vBase
      } else {
        styleCellLabel = styleObj.icon + ' vBase×cityCycle';
        styleCellVal = Math.round(styleObj.vBase * Math.max(S.cityCycle, 1.0))
      }
      routeCells = '<div class="speed-cell" style="border-left-color:' + styleObj.color + '"><div class="l">' + styleCellLabel + '</div><div class="v" style="color:' + styleObj.color + '">' + styleCellVal + '<small>км/ч</small></div></div>';
      routeCells += '<div class="speed-cell"><div class="l">vMax физ ХХ</div><div class="v" style="color:#a94fe8">' + vp.vMaxStart.toFixed(0) + '→' + vp.vMaxEnd.toFixed(0) + '<small>км/ч</small></div></div>';
      routeCells += '<div class="speed-cell"><div class="l">vRide маршр</div><div class="v" style="color:#ff8c42">' + vp.vRideStart.toFixed(0) + '→' + vp.vRideEnd.toFixed(0) + '<small>км/ч</small></div></div>';
      var vRideMinCol = smoothColor(vp.vRideMin / Math.max(vp.vMaxMax, 1));
      routeCells += '<div class="speed-cell"><div class="l">vRide мин</div><div class="v" style="color:' + vRideMinCol + '">' + vp.vRideMin.toFixed(0) + '<small>км/ч</small></div></div>';
      if (vp.nSignals > 0) routeCells += '<div class="speed-cell"><div class="l">🚦 сигналов</div><div class="v">' + vp.nSignals + '</div></div>';
      if (vp.nCurves > 0) routeCells += '<div class="speed-cell"><div class="l">↻ поворотов</div><div class="v">' + vp.nCurves + '</div></div>';
      if (vp.nRoadSegments > 0) routeCells += '<div class="speed-cell"><div class="l">🛣 сегментов</div><div class="v">' + vp.nRoadSegments + '</div></div>';
      routeCells += '<div class="speed-cell"><div class="l">ΔKE потери</div><div class="v" style="color:var(--yellow)">' + vp.totalKE_loss.toFixed(0) + '<small>Вт·ч</small></div></div>';
      if (vp.totalRegenWh > 0) routeCells += '<div class="speed-cell" style="border-left-color:var(--green)"><div class="l">↩ РЕКУП</div><div class="v" style="color:var(--green)">+' + vp.totalRegenWh.toFixed(0) + '<small>Вт·ч</small></div></div>';
      if (IS_FULL && vp.weatherKey) {
        var weatherIcon = vp.weatherEnergyF > 1.05 ? '🌧' : (vp.weatherEnergyF < 1.0 ? '☀️' : '🌤');
        var weatherColor = vp.weatherEnergyF > 1.05 ? 'var(--ice)' : 'var(--text-mute)';
        var weatherBorder = vp.weatherEnergyF > 1.05 ? 'var(--ice)' : 'var(--line-hot)';
        var weatherTitle = esc(vp.weatherDesc || vp.weatherKey);
        routeCells += '<div class="speed-cell" style="border-left-color:' + weatherBorder + '" title="' + weatherTitle + '"><div class="l">' + weatherIcon + ' ' + vp.weatherKey.toUpperCase() + '</div><div class="v" style="color:' + weatherColor + '">×' + vp.weatherEnergyF.toFixed(2) + '<small>расход</small></div></div>'
      }
      if (vp.lightsW > 0) {
        routeCells += '<div class="speed-cell" style="border-left-color:var(--etalon)"><div class="l">🌙 ФАРЫ</div><div class="v" style="color:var(--etalon)">+' + vp.lightsW + '<small>Вт</small></div></div>'
      }
      if (vp.windingTempMax != null) {
        var tCol = smoothColorTemp(vp.windingTempMax);
        var tLabel = (Math.abs(vp.windingTempMax - vp.windingTempStart) < 2) ? 'старт/конец' : 'пик';
        routeCells += '<div class="speed-cell" style="border-left-color:' + tCol + '"><div class="l">🌡 ОБМОТКА ' + tLabel + '</div><div class="v" style="color:' + tCol + '">' + vp.windingTempMax.toFixed(0) + '<small>°C</small></div></div>'
      }
      if (vp.timeToOverheatS != null && isFinite(vp.timeToOverheatS) && vp.timeToOverheatS < 3600) {
        routeCells += '<div class="speed-cell" style="border-left-color:var(--red)"><div class="l">⏱ ДО 120°C</div><div class="v" style="color:var(--red)">' + (vp.timeToOverheatS / 60).toFixed(0) + '<small>мин</small></div></div>'
      }
      if (!vp.reachedEnd && vp.distToCutoff > 0) {
        routeCells += '<div class="speed-cell" style="border-left-color:var(--red)"><div class="l">ЗАРЯД ДО</div><div class="v" style="color:var(--red)">' + (vp.distToCutoff / 1000).toFixed(1) + '<small>км</small></div></div>'
      }
    }
    $('speedPanel').innerHTML = '<div class="speed-head"><div class="speed-main"><div class="lbl">▶ МАКС ' + S.voltage.toFixed(1) + 'В</div><div class="num">' + S.vMax.toFixed(1) + '<small>КМ/Ч</small></div><div class="sub">' + S.vMaxLimiter + ' · обмотка ' + S.vMaxByWinding.toFixed(1) + ' · P ' + S.vMaxByPower.toFixed(1) + (S.vmaxProfile ? ' · едем ' + S.vmaxProfile.vRideWeighted.toFixed(0) : '') + '</div></div><div class="speed-limiter"><div class="lbl">ТИП</div><div class="val">' + S.vMaxLimiter + '</div></div></div><div class="speed-grid"><div class="speed-cell"><div class="l">ХХ</div><div class="v">' + S.vMaxByWindingRaw.toFixed(0) + '<small>км/ч</small></div></div><div class="speed-cell"><div class="l">ПОТОЛОК</div><div class="v">' + S.vMaxByWinding.toFixed(0) + '<small>км/ч</small></div></div><div class="speed-cell"><div class="l">ПО P</div><div class="v">' + S.vMaxByPower.toFixed(0) + '<small>км/ч</small></div></div><div class="speed-cell"><div class="l">FW</div><div class="v">' + (S.fwEnabled ? 'ON' : 'OFF') + '</div></div>' + routeCells + '</div>';
    var vcEl = $('voltageCompare');
    if (S.voltageMode === 'both' || S.voltageMode === 'both5') {
      var is5 = S.voltageMode === 'both5';
      var anchors = [{
        k: 'peak',
        l: 'ПИК',
        v: S.voltagePeak,
        m: E.computeVoltageMetrics(S, S.voltagePeak)
      }, {
        k: 'avg',
        l: 'СРЕД',
        v: S.voltageAvg,
        m: E.computeVoltageMetrics(S, S.voltageAvg)
      }, {
        k: 'nom',
        l: 'НОМ',
        v: S.voltageNom,
        m: E.computeVoltageMetrics(S, S.voltageNom)
      }];
      if (is5) {
        anchors.push({
          k: 'low',
          l: 'НИЗ',
          v: S.voltageLow,
          m: E.computeVoltageMetrics(S, S.voltageLow)
        });
        anchors.push({
          k: 'cutoff',
          l: 'ОТСЕЧ',
          v: S.voltageCutoff,
          m: E.computeVoltageMetrics(S, S.voltageCutoff)
        })
      }
      var metrics = [{
        lbl: 'U, В',
        get: function(a) {
          return a.v
        },
        fmt: function(v) {
          return v.toFixed(1)
        }
      }, {
        lbl: 'P эл., Вт',
        get: function(a) {
          return a.m.ctrlMaxPower
        },
        fmt: function(v) {
          return v.toFixed(0)
        }
      }, {
        lbl: 'P мех., Вт',
        get: function(a) {
          return a.m.powerToWheel
        },
        fmt: function(v) {
          return v.toFixed(0)
        }
      }, {
        lbl: 'Ток, А',
        get: function(a) {
          return a.m.currentPeak
        },
        fmt: function(v) {
          return v.toFixed(1)
        }
      }, {
        lbl: 'vMax, км/ч',
        get: function(a) {
          return a.m.vMax
        },
        fmt: function(v) {
          return v.toFixed(0)
        }
      }, {
        lbl: 'RPM ХХ',
        get: function(a) {
          return a.m.motorRpmNoLoad
        },
        fmt: function(v) {
          return v.toFixed(0)
        }
      }];
      var h = '<div class="vc-subtitle"><b>' + anchors.length + ' якоря</b> — как меняется по мере разряда.</div><table class="vc-table"><thead><tr><th>Параметр</th>';
      anchors.forEach(function(a) {
        h += '<th class="vc-col-' + a.k + '">' + a.l + '<small>' + a.v.toFixed(1) + 'В</small></th>'
      });
      h += '</tr></thead><tbody>';
      metrics.forEach(function(met) {
        var vals = anchors.map(function(a) {
          return met.get(a)
        });
        var mx = Math.max.apply(null, vals),
          mn = Math.min.apply(null, vals);
        h += '<tr><td>' + met.lbl + '</td>';
        anchors.forEach(function(a, i) {
          var v = vals[i],
            cls = '';
          if (mx !== mn) {
            if (v === mx) cls = 'vc-max';
            else if (v === mn) cls = 'vc-min'
          }
          h += '<td class="vc-col-' + a.k + ' ' + cls + '">' + met.fmt(v) + '</td>'
        });
        h += '</tr>'
      });
      h += '</tbody></table><div class="vc-footer">P падает ~U, потолок v = <b>KV×U</b>.</div>';
      vcEl.innerHTML = h;
      vcEl.style.display = 'block'
    } else {
      vcEl.style.display = 'none';
      vcEl.innerHTML = ''
    }
    renderEtalonBlock(stages);
    renderRangeCalc();
    // v23: категория по ПДД РФ. Электровелосипед: ≤250 Вт и ≤25 км/ч с педалями.
    // Мопед (M): ≤4 кВт и конструктивная скорость ≤50 км/ч. Выше — мотоцикл (A1 ≤11 кВт, иначе A).
    var vDesign = S.vMax,
      pNom = S.motorNom,
      hasP = !(pNom <= 250 && vDesign <= 25 && S.pedalMode),
      vI, vT, vC;
    if (!hasP) {
      vT = 'Электровелосипед: права не нужны';
      vI = '✅';
      vC = ''
    } else if (pNom <= 4000 && vDesign <= 50) {
      vT = 'Мопед (кат. M): ≤4 кВт и ≤50 км/ч';
      vI = '⚠️';
      vC = 'warn'
    } else if (pNom <= 11000) {
      vT = 'Мотоцикл (кат. A1): ' + (pNom / 1000).toFixed(1) + ' кВт, до ' + vDesign.toFixed(0) + ' км/ч';
      vI = '⚠️';
      vC = 'warn'
    } else {
      vT = 'Мотоцикл (кат. A): ' + (pNom / 1000).toFixed(1) + ' кВт';
      vI = '⚠️';
      vC = 'warn'
    }
    var taxiYear = 40 * (S.yearKm || 3200),
      bikeYear = (S.whKmCr * (S.yearKm || 3200) / 1000 * S.tariff) + (S.battAmortPer100km * (S.yearKm || 3200) / 100) + 2000;
    var html = '<div class="verdict ' + vC + '"><span class="icon">' + vI + '</span><span>' + vT + '</span></div>';
    var styleConclusion;
    if (IS_V22) {
      styleConclusion = '<strong>Стиль ' + styleObj.name + ':</strong> vBase ' + styleObj.vBase + ' км/ч · ×' + S.cityCycle.toFixed(2) + ' остановок/км ≈ ' + S.stopsPerKmEff.toFixed(2)
    } else {
      styleConclusion = '<strong>Стиль ' + styleObj.name + ':</strong> vBase×cityCycle ' + Math.round(styleObj.vBase * Math.max(S.cityCycle, 1.0)) + ' км/ч'
    }
    html += '<div class="conclusion-item good"><div class="ci-icon">' + styleObj.icon + '</div><div class="ci-text">' + styleConclusion + '</div></div>';
    html += '<div class="conclusion-item good"><div class="ci-icon">🏁</div><div class="ci-text"><strong>Макс физика:</strong> ' + S.vMax.toFixed(1) + ' км/ч' + (S.vmaxProfile ? ' (едем ' + S.vmaxProfile.vRideWeighted.toFixed(0) + ', мин ' + S.vmaxProfile.vRideMin.toFixed(0) + ')' : '') + '</div></div>';
    html += '<div class="conclusion-item"><div class="ci-icon">🛣</div><div class="ci-text"><strong>Расход:</strong> ' + S.whKmCr.toFixed(1) + ' Втч/км' + (S.routeWhKm ? ' · <span style="color:var(--yellow)">маршрут ' + S.routeWhKm.toFixed(1) + '</span>' : '') + '</div></div>';
    html += '<div class="conclusion-item good"><div class="ci-icon">🔋</div><div class="ci-text"><strong>Запас:</strong> ' + S.realRangeKm.toFixed(0) + ' км' + (S.routeRangeKm ? ' · <span style="color:var(--yellow)">маршрут ' + S.routeRangeKm.toFixed(0) + ' км</span>' : '') + '</div></div>';
    if (stages) {
      var rp = stages.etalon.realRangeKm > 0 ? (S.realRangeKm / stages.etalon.realRangeKm) * 100 : 0;
      html += '<div class="conclusion-item ' + (rp >= 70 ? 'good' : rp >= 40 ? 'warn' : 'bad') + '"><div class="ci-icon">◈</div><div class="ci-text"><strong>От эталона:</strong> ' + rp.toFixed(0) + '%<div class="ci-sub">' + stages.etalon.realRangeKm.toFixed(0) + ' → ' + S.realRangeKm.toFixed(0) + ' км</div></div></div>'
    }
    if (S.vmaxProfile && S.vmaxProfile.windingTempMax != null) {
      var tCls2 = S.vmaxProfile.windingTempMax > 100 ? 'bad' : (S.vmaxProfile.windingTempMax > 80 ? 'warn' : 'good');
      var tIcon = S.vmaxProfile.windingTempMax > 100 ? '🔥' : '🌡';
      var tTxt;
      if (Math.abs(S.vmaxProfile.windingTempMax - S.vmaxProfile.windingTempStart) < 2) {
        tTxt = '<strong>Тепло маршрута:</strong> старт ' + S.vmaxProfile.windingTempStart.toFixed(0) + '°C → конец ' + S.vmaxProfile.windingTempAtEnd.toFixed(0) + '°C (средняя; обмотка ~' + (S.vmaxProfile.windingTempMax + 20).toFixed(0) + '°C)'
      } else {
        tTxt = '<strong>Тепло маршрута:</strong> старт ' + S.vmaxProfile.windingTempStart.toFixed(0) + '°C → пик ' + S.vmaxProfile.windingTempMax.toFixed(0) + '°C (обмотка ~' + (S.vmaxProfile.windingTempMax + 20).toFixed(0) + '°C) → конец ' + S.vmaxProfile.windingTempAtEnd.toFixed(0) + '°C'
      }
      if (S.vmaxProfile.windingTempMax < 60) {
        tTxt += '<div class="ci-sub">✅ мотор не нагревается — перегрев невозможен</div>'
      } else if (S.vmaxProfile.timeToOverheatS != null && isFinite(S.vmaxProfile.timeToOverheatS)) {
        tTxt += '<div class="ci-sub">⏱ до 120°C: ' + (S.vmaxProfile.timeToOverheatS / 60).toFixed(0) + ' мин (при пиковой мощности)' + (S.vmaxProfile.heatWarn ? ' · ⚠ перегрев на ' + (S.vmaxProfile.heatCutoffDist / 1000).toFixed(1) + ' км' : '') + '</div>'
      }
      html += '<div class="conclusion-item ' + tCls2 + '"><div class="ci-icon">' + tIcon + '</div><div class="ci-text">' + tTxt + '</div></div>'
    }
    if (S.vmaxProfile && S.vmaxProfile.totalRegenWh > 0) {
      html += '<div class="conclusion-item good"><div class="ci-icon">↩</div><div class="ci-text"><strong>Рекуперация маршрута:</strong> +' + S.vmaxProfile.totalRegenWh.toFixed(0) + ' Вт·ч</div></div>'
    }
    html += '<div class="conclusion-item good"><div class="ci-icon">🚕</div><div class="ci-text"><strong>vs такси:</strong> ' + (taxiYear - bikeYear).toFixed(0) + ' ₽/год</div></div>';
    if (hasP) html += '<div class="conclusion-item warn"><div class="ci-icon">⚖️</div><div class="ci-text"><strong>Не велосипед по ПДД:</strong> ' + vT + '</div></div>';
    if (S.vmaxProfile && !S.vmaxProfile.reachedEnd) {
      html += '<div class="conclusion-item bad"><div class="ci-icon">⚠</div><div class="ci-text"><strong>НЕ ДОЕДЕТ:</strong> заряд до <b>' + (S.vmaxProfile.distToCutoff / 1000).toFixed(1) + ' км</b></div></div>'
    }
    html += '<div class="conclusion-item good"><div class="ci-icon">💰</div><div class="ci-text"><strong>Стоимость км:</strong> ' + S.costKm.toFixed(2) + ' ₽<div class="ci-sub">Окуп: ' + fmtPayback(S.paybackMonths) + '</div></div></div>';
    $('conclusions').innerHTML = html;
    $('forces').innerHTML = R('ГРАВ', S.fGravity.toFixed(2) + ' Н') + R('КАЧ', S.fRolling.toFixed(2) + ' Н') + R('ПОДШ', S.fBearing.toFixed(2) + ' Н') + R('АЭРО', S.fAero.toFixed(2) + ' Н') + R('СУММА', S.fCruise.toFixed(2) + ' Н', 'hot total');
    $('aero').innerHTML = R('ρ', S.rho.toFixed(4) + ' кг/м³') + R('CdA', S.CdA.toFixed(3) + ' м²', 'hot total');
    $('tireCard').innerHTML = R('Crr', S.crr.toFixed(5), 'hot total');
    $('motorCard').innerHTML = R('НОМ', S.motorNom + ' Вт') + R('МЕХ', S.powerToWheelPeak.toFixed(0) + ' Вт', 'hot') + R('КПД', (S.effM * 100).toFixed(1) + '%', 'good');
    $('windingCard').innerHTML = R('ВИТКИ', S.motorTurns) + R('KV', S.motorKV.toFixed(3), 'good') + R('ПОТОЛОК', S.vMaxByWindingRaw.toFixed(1) + ' км/ч', 'hot');
    $('currentsCard').innerHTML = R('БАТ', S.currentPeak.toFixed(1) + ' А', 'hot') + R('ФАЗ', S.currentPhasePeak.toFixed(0) + ' А', 'hot') + R('МЕДЬ', S.pCopperPeakRaw.toFixed(0) + ' Вт', 'warn');
    $('electricCard').innerHTML = R('P БАТ', S.pBattFromPack.toFixed(0) + ' Вт', 'hot') + R('КПД К', (S.ctrlEff * 100).toFixed(1) + '%', 'good');
    $('vmaxCard').innerHTML = R('vMax', S.vMax.toFixed(1) + ' км/ч', 'hot total') + R('ЛИМИТ', S.vMaxLimiter, 'warn') + (S.vmaxProfile ? R('МАРШР', S.vmaxProfile.vRideWeighted.toFixed(0) + ' (мин ' + S.vmaxProfile.vRideMin.toFixed(0) + ')', 'good') : '');
    var avgCells;
    if (IS_V22) {
      avgCells = R('СТИЛЬ', styleObj.name, 'hot') + R('vBase', styleObj.vBase + ' км/ч', 'hot total') + R('крейсер', S.speedKmhEff.toFixed(0) + ' км/ч', 'warn') + R('ост/км', S.stopsPerKmEff.toFixed(2), 'warn')
    } else {
      avgCells = R('СТИЛЬ', styleObj.name, 'hot') + R('vBase', styleObj.vBase + ' км/ч', 'hot total') + R('vBase×cityCycle', Math.round(styleObj.vBase * Math.max(S.cityCycle, 1.0)) + ' км/ч', 'warn') + R('PULSE', S.pulseFactor ? S.pulseFactor.toFixed(2) : '1.00', 'good')
    }
    $('avgSpeedCard').innerHTML = avgCells;
    $('batteryCard').innerHTML = R('НОМ', S.voltageNom.toFixed(1) + 'В (' + E.getSeries(S.voltageNom) + 'S)') + R('СРЕД', S.voltageAvg.toFixed(1) + 'В') + R('ОТСЕЧ', S.voltageCutoff.toFixed(1) + 'В', 'bad') + R('РЕСУРС', S.cycLifeVal + ' цикл', 'good');
    $('brakeCard').innerHTML = R('25→0', S.brakeDist25.toFixed(2) + ' м') + R('ОСТАНОВ', S.safetyDist.toFixed(2) + ' м', 'bad');
    $('regenProCard').innerHTML = R('СТАТУС', S.regenEnabled ? 'ВКЛ' : 'ВЫКЛ' + (S.regenBlockReason ? ' (' + S.regenBlockReason + ')' : ''), S.regenEnabled ? 'good' : 'warn') + R('ВОЗВРАТ', S.regenSavedWhKm.toFixed(2) + ' Втч/км', 'good');
    $('winterCard').innerHTML = R('РЕЖИМ', S.winterActive ? (S.winterAuto ? 'АВТО' : 'ВРУЧН') : 'ВЫКЛ', S.winterActive ? 'good' : '') + R('ЗАРЯД', S.chargeBlocked ? 'ЗАБЛ' : 'ОК', S.chargeBlocked ? 'bad' : 'good') + R('ВРЕМЯ', isFinite(S.chargeTime) ? S.chargeTime.toFixed(1) + ' ч' : '∞', 'hot');
    $('ctrlProCard').innerHTML = R('БАТ', S.ctrlCurrentLimit + ' А') + R('ФАЗ', S.ctrlPhaseLimit.toFixed(0) + ' А', 'hot');
    var thermalExtra = '';
    if (S.vmaxProfile && S.vmaxProfile.windingTempMax != null) {
      thermalExtra = R('МАРШР ПИК', S.vmaxProfile.windingTempMax.toFixed(1) + '°C', S.vmaxProfile.windingTempMax > 100 ? 'bad' : '');
      if (S.vmaxProfile.timeToOverheatS != null && isFinite(S.vmaxProfile.timeToOverheatS)) {
        thermalExtra += R('ДО 120°C', (S.vmaxProfile.timeToOverheatS / 60).toFixed(0) + ' мин', S.vmaxProfile.timeToOverheatS < 1800 ? 'bad' : 'warn')
      }
    }
    $('thermalProCard').innerHTML = R('T СРЕД', Math.min(S.windingTemp, 180).toFixed(1) + '°C', S.windingTemp > 100 ? 'warn' : 'good') + R('T ОБМ', Math.min(S.windingTemp + 20, 200).toFixed(0) + '°C', S.windingTemp > 100 ? 'bad' : '') + R('T ПИК', Math.min(S.windingTempPeak, 180).toFixed(1) + '°C') + R('HEAT', S.heatLossEq.toFixed(0) + ' Вт', 'hot') + R('ПИК', hp.toFixed(0) + ' Вт', 'hot') + R('ПЕРЕГР', isFinite(S.timeToOverheat) ? (S.timeToOverheat / 60).toFixed(0) + ' мин' : '∞', 'good') + thermalExtra;
    $('kit').innerHTML = R('МОТОР', S.motor.price.toLocaleString('ru-RU') + ' ₽') + R('КОНТР', S.controller.price.toLocaleString('ru-RU') + ' ₽') + R('АКБ', S.battTotalPrice.toLocaleString('ru-RU') + ' ₽') + R('ИТОГО', S.totalPrice.toLocaleString('ru-RU') + ' ₽', 'hot total');
    $('tcoCard').innerHTML = R('КАП', S.totalPrice.toLocaleString('ru-RU') + ' ₽') + R('TCO 5л', Math.round(S.tco5y).toLocaleString('ru-RU') + ' ₽', 'hot') + R('ОКУП', fmtPayback(S.paybackMonths));
    $('fuelCard').innerHTML = R('БЕНЗ', S.fuelCostPer100km.toFixed(2) + ' ₽', 'bad') + R('ЭЛ', S.evCostPer100km.toFixed(2) + ' ₽', 'good') + R('ЭКОН', S.netSavePer100km.toFixed(2) + ' ₽/100', 'hot total') + R('ЗА ' + S.yearKm + 'КМ', S.yearSaving.toFixed(0) + ' ₽/год', 'good');
    var legalEl = $('legal');
    legalEl.className = 'legal ' + (hasP ? 'warn' : 'ok');
    legalEl.innerHTML = (hasP ? '⚠ ' : '▲ ') + '<b>' + vT + '</b> · номинал ' + pNom + ' Вт · макс. ' + vDesign.toFixed(0) + ' км/ч' + (S.pedalMode ? '' : ' · только газ');
    renderCompactAdvanced(S, stages)
  }

  function updateAdvRecommend() {
    var el = $('advRecommend');
    if (!el) return;
    var bm = +$('bikeMass').value || 0,
      rm = +$('riderMass').value || 0,
      cm = +$('cargoMass').value || 0,
      ft = $('frameType').value,
      fe = E.FRAME_PROPS[ft] ? E.FRAME_PROPS[ft].massExtra : 0,
      tm = bm + rm + cm + fe;
    var mPower = +$('mMotorPower').value || 0,
      vSel = $('voltageSelect').value,
      vShow = vSel === 'auto' ? (+$('mBattV').value > 0 ? $('mBattV').value + 'В' : 'авто') : vSel + 'В';
    var phase = +$('mCtrlPhase').value || 0,
      bat = +$('mCtrlCurrent').value || 0,
      mt = $('motorType').value,
      mp = +$('mMotorPeak').value || 0,
      t = +$('ambientTemp').value || 0,
      wm = t <= E.WINTER_THRESHOLD_C ? ' · <span style="color:var(--ice)">❄</span>' : '';
    var st = E.RIDE_STYLES[$('rideStyle').value] || E.RIDE_STYLES.normal;
    el.innerHTML = '<b>СТИЛЬ:</b> <span class="big">' + st.icon + ' ' + st.name.toUpperCase() + '</span> vBase ' + st.vBase + ' км/ч<br><b>МАССА:</b> <span class="big">' + tm.toFixed(0) + ' кг</span><br><b>МОТОР:</b> ' + (mPower > 0 ? mPower + 'Вт' : 'авто') + ' пик ' + mp + 'Вт V:' + vShow + wm + '<br><b>ТОКИ:</b> ' + bat + 'А / ф' + (phase > 0 ? phase + 'А' : 'авто') + ' · <b>ТОЧЕК:</b> ' + waypoints.length + ' · <b>ПРОБЕГ:</b> ' + ($('yearKm').value || 3200) + ' км/год';
    renderPeakTable()
  }

  function calculate() {
    var btn = $('calcBtn');
    if (btn && btn._busy) return;
    if (btn) {
      btn._busy = true;
      btn.disabled = true
    }
    try {
      clearError();
      var cfg = buildConfig();
      var applyW0 = $('applyWeather') ? $('applyWeather').checked : true;
      var w0 = (lastRouteData && lastRouteData.weather) || null;
      // v23: выключатель погоды выключает её везде — и в общем расчёте, и по маршруту.
      cfg.weatherKey = (applyW0 && w0 && w0.ok) ? E.classifyWeather(w0) : null;
      cfg.lightsW = applyW0 ? E.getNightFactor(w0 && w0.sunrise, w0 && w0.sunset).lightsW : 0;
      cfg.weatherDesc = (w0 && w0.desc) || '';
      var route = (lastRouteData && lastRouteData.alternatives && lastRouteData.alternatives[lastRouteData.selectedIndex]) ? lastRouteData.alternatives[lastRouteData.selectedIndex] : null;
      cfg.slopeFromRoute = !!route;
      if (route && route.samples && route.samples.length > 1) {
        var Sbase = E.compute(cfg, E.PROFILE_MULT.avg);
        var applyW = $('applyWeather') ? $('applyWeather').checked : true;
        var hardCapW = $('hardWeatherCap') ? $('hardWeatherCap').checked : false;
        var rt = $('routeRoundTrip').checked;
        var w = (lastRouteData.weather && lastRouteData.weather.ok) ? lastRouteData.weather : {
          sunrise: lastRouteData.weather && lastRouteData.weather.sunrise,
          sunset: lastRouteData.weather && lastRouteData.weather.sunset
        };
        var vprof = E.computeVmaxProfileByRoute(cfg, Sbase, route.samples, {
          roundTrip: rt,
          weather: w,
          signals: lastRouteData.signals || [],
          roadSegments: route.roadSegments || [],
          applyWeather: applyW,
          hardWeatherCap: hardCapW,
          sunrise: w.sunrise || null,
          sunset: w.sunset || null,
          windMs: route.windMs,
          windDir: route.windDir
        });
        if (vprof) {
          cfg.vmaxProfile = vprof;
          route.vmaxProfile = vprof
        }
      } else {
        cfg.vmaxProfile = null
      }
      lastConfig = cfg;
      var rOpt = E.compute(cfg, E.PROFILE_MULT.opt);
      var rAvg = E.compute(cfg, E.PROFILE_MULT.avg);
      var rPess = E.compute(cfg, E.PROFILE_MULT.pess);
      var stages = E.computeStages(cfg);
      lastResults = {
        opt: rOpt,
        avg: rAvg,
        pess: rPess
      };
      lastStages = stages;
      renderAll(rAvg, rOpt, rPess, stages);
      updateAdvRecommend();
      $('results').classList.add('on');
      if (!$('results')._animated) {
        $('results')._animated = true;
        document.querySelectorAll('#results .animate-item').forEach(function(it, i) {
          it.classList.remove('on');
          void it.offsetWidth;
          setTimeout(function() {
            it.classList.add('on')
          }, i * 50)
        })
      }
      if (route && route.vmaxProfile) {
        var rt2 = $('routeRoundTrip').checked;
        var sig = route.vmaxProfile.vMaxStart.toFixed(1) + '|' + route.vmaxProfile.vMaxEnd.toFixed(1) + '|' + route.vmaxProfile.vRideStart.toFixed(1) + '|' + route.vmaxProfile.vRideEnd.toFixed(1) + '|' + lastRouteData.selectedIndex + '|' + rt2 + '|' + route.vmaxProfile.nSignals + '|' + route.vmaxProfile.styleKey + '|' + waypoints.length;
        if (lastMapSig !== sig) {
          lastMapSig = sig;
          if (routePolylines) {
            routePolylines.forEach(function(l) {
              mapInstance.removeLayer(l)
            })
          }
          routePolylines = [];
          lastRouteData.alternatives.forEach(function(r, i) {
            var layer = drawColoredRoute(r, i === lastRouteData.selectedIndex, function() {
              selectRoute(i)
            });
            layer.addTo(mapInstance);
            routePolylines.push(layer)
          })
        }
        var effDist = route.totalDist * (rt2 ? 2 : 1);
        drawVmaxProfile(route.vmaxProfile, effDist, currentCursorPos, rt2)
      }
      saveConfig()
    } catch (err) {
      console.error(err);
      showError(err.message || String(err))
    } finally {
      if (btn) {
        btn._busy = false;
        btn.disabled = false
      }
    }
  }

  // v23: в Android blob-ссылки не скачиваются — сохраняем через нативный мост в «Загрузки/CityBike».
  function saveTextFile(name, text, mime) {
    if (window.CBNative && window.CBNative.saveFile) {
      var where = window.CBNative.saveFile(name, text, mime);
      return !!where
    }
    try {
      var blob = new Blob([text], {
          type: mime + ';charset=utf-8'
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() {
        URL.revokeObjectURL(url)
      }, 1000);
      return true
    } catch (e) {
      return false
    }
  }

  function copyText(txt) {
    if (window.CBNative && window.CBNative.copy) return Promise.resolve(!!window.CBNative.copy(txt));
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function() {
      return true
    }, function() {
      return false
    });
    return Promise.resolve(false)
  }

  function exportRouteCsv() {
    if (!lastRouteData || !lastRouteData.alternatives || !lastRouteData.alternatives.length) {
      alert('Сначала загрузите маршрут');
      return
    }
    var route = lastRouteData.alternatives[lastRouteData.selectedIndex];
    if (!route.vmaxProfile || !route.vmaxProfile.segments || !route.vmaxProfile.segments.length) {
      alert('Маршрут без профиля. Запустите расчёт.');
      return
    }
    var segs = route.vmaxProfile.segments;
    var headers = ['dist_km', 'elev_m', 'slope_pct', 'soc_pct', 'voltage_OC_V', 'voltage_load_V', 'vMax_kph', 'vRide_kph', 'vRoad_kph', 'vZone_kph', 'whKm', 'limitReason', 'windingTemp_C', 'timeToOverheat_s', 'onReturn', 'heatWarn'];
    var lines = [headers.join(',')];
    segs.forEach(function(s) {
      var vRoadStr = '';
      if (s.vRoad != null && isFinite(s.vRoad) && s.vRoad < 1e6) vRoadStr = s.vRoad.toFixed(1);
      var vZoneStr = '';
      if (s.vZone != null && isFinite(s.vZone) && s.vZone < 1e6) vZoneStr = s.vZone.toFixed(1);
      var ttoStr = '';
      if (s.timeToOverheatS != null && isFinite(s.timeToOverheatS)) ttoStr = s.timeToOverheatS.toFixed(0);
      lines.push([(s.dist / 1000).toFixed(3), s.elev.toFixed(1), s.slope.toFixed(2), (s.soc * 100).toFixed(2), s.voltage.toFixed(2), s.vLoad.toFixed(2), s.vMax.toFixed(1), s.vRide.toFixed(1), vRoadStr, vZoneStr, s.whKm.toFixed(2), '"' + String(s.limitReason || '').replace(/"/g, '""') + '"', (s.windingTemp != null ? s.windingTemp.toFixed(1) : ''), ttoStr, s.onReturn ? '1' : '0', s.heatWarn ? '1' : '0'].join(','))
    });
    var wpInfo = '';
    if (waypoints.length > 2) {
      wpInfo = '\n# waypoints=' + waypoints.length + ' : ' + waypoints.map(function(w, i) {
        return wpLetter(i) + '(' + w.lat.toFixed(5) + ',' + w.lon.toFixed(5) + ')'
      }).join(' → ')
    }
    var okSave = saveTextFile('citybike_route_' + Date.now() + '.csv', lines.join('\n') + wpInfo, 'text/csv');
    var b = $('saveCsvBtn');
    if (b) {
      var orig = b.textContent;
      b.textContent = okSave ? '✓ ' + segs.length : '✗ ошибка';
      b.classList.add('done');
      setTimeout(function() {
        b.textContent = orig;
        b.classList.remove('done')
      }, 1500)
    }
  }

  function setupCopySave() {
    $('copyBtn').onclick = function() {
      if (!lastResults.avg) {
        alert('Запустите расчёт');
        return
      }
      var S = lastResults.avg;
      var st = E.RIDE_STYLES[S.styleKey] || E.RIDE_STYLES.normal;
      var vpLine = S.vmaxProfile ? '\nvMax физ ХХ: A=' + S.vmaxProfile.vMaxStart.toFixed(0) + '→' + S.vmaxProfile.vMaxEnd.toFixed(0) + '\nvRide: A=' + S.vmaxProfile.vRideStart.toFixed(0) + '→' + S.vmaxProfile.vRideEnd.toFixed(0) + ' средн=' + S.vmaxProfile.vRideWeighted.toFixed(0) + ' мин=' + S.vmaxProfile.vRideMin.toFixed(0) + '\nΔKE: ' + S.vmaxProfile.totalKE_loss.toFixed(0) + ' Втч · рекуп +' + S.vmaxProfile.totalRegenWh.toFixed(0) + ' Втч · SOC ' + (S.vmaxProfile.socAtEnd * 100).toFixed(0) + '% · 🚦 ' + S.vmaxProfile.nSignals + ' · ↻ ' + S.vmaxProfile.nCurves + ' · 🌡 старт ' + S.vmaxProfile.windingTempStart.toFixed(0) + '→пик ' + S.vmaxProfile.windingTempMax.toFixed(0) + '→конец ' + S.vmaxProfile.windingTempAtEnd.toFixed(0) + '°C' : '';
      var routeLine = S.routeRangeKm ? '\nЗапас по маршруту: ' + S.routeRangeKm.toFixed(0) + ' км' : '\nЗапас по маршруту: — (не рассчитан)';
      var wpLine = waypoints.length > 2 ? '\nТочек: ' + waypoints.length + ' (' + waypoints.map(function(w, i) {
        return wpLetter(i)
      }).join('→') + ')' : '';
      var verLine = VERSION;
      var speedLine = IS_V22 ? 'vBase ' + st.vBase + ' · крейсер ' + S.speedKmhEff.toFixed(0) + ' · ост/км ' + S.stopsPerKmEff.toFixed(2) : 'vBase×cityCycle ' + Math.round(st.vBase * Math.max(S.cityCycle, 1.0)) + ' км/ч';
      var txt = 'CITY·BIKE ' + verLine + '\n' + st.icon + ' ' + st.name + '\n' + speedLine + '\nМасса: ' + S.mass.toFixed(1) + ' кг · мотор ' + S.motorNom + ' Вт · КПД ' + (S.effM * 100).toFixed(1) + '%\nЗапас ОПТ/СРЕД/ПЕСС: ' + (lastResults.opt ? lastResults.opt.realRangeKm.toFixed(0) : '—') + ' / ' + S.realRangeKm.toFixed(0) + ' / ' + (lastResults.pess ? lastResults.pess.realRangeKm.toFixed(0) : '—') + ' км' + routeLine + wpLine + '\nРасход: ' + S.whKmCr.toFixed(1) + ' Втч/км' + vpLine;
      var btn = this;

      // v23: «✓» только если текст действительно попал в буфер обмена
      copyText(txt).then(function(okc) {
        btn.classList.toggle('done', okc);
        btn.textContent = okc ? '✓ СКОПИРОВАНО' : '✗ НЕ ВЫШЛО';
        setTimeout(function() {
          btn.classList.remove('done');
          btn.textContent = 'КОПИРОВАТЬ'
        }, 1600)
      })
    };
    $('saveTxtBtn').onclick = function() {
      if (!lastConfig || !lastResults.avg) {
        alert('Запустите расчёт');
        return
      }
      var st = E.RIDE_STYLES[lastConfig.rideStyle] || E.RIDE_STYLES.normal;
      var verLine = VERSION;
      var L = ['CITY·BIKE ' + verLine + ' — ОТЧЁТ', 'Дата: ' + new Date().toLocaleString('ru-RU'), 'Версия: ' + verLine + ' (Android)', '', 'Стиль: ' + st.icon + ' ' + st.name + ' (vBase ' + st.vBase + ')', 'Точек маршрута: ' + waypoints.length, ''];
      L.push('═══ WAYPOINTS ═══');
      waypoints.forEach(function(w, i) {
        L.push('  ' + wpLetter(i) + ' [' + wpRole(i, waypoints.length) + ']: ' + w.lat.toFixed(6) + ',' + w.lon.toFixed(6))
      });
      var route = lastRouteData && lastRouteData.alternatives && lastRouteData.alternatives[lastRouteData.selectedIndex];
      if (route) {
        L.push('');
        L.push('═══ ДИАГНОСТИКА МАРШРУТА ═══');
        L.push('route_oneWay_km: ' + (route.totalDist / 1000).toFixed(2));
        L.push('route_roundTrip: ' + (lastConfig.routeRoundTrip ? 'ON' : 'OFF'));
        L.push('route_avgSlope: ' + route.avgSlope.toFixed(2) + '%');
        L.push('route_maxSlope_95p: ' + route.maxSlope.toFixed(2) + '%');
        L.push('slopeEff_used: ' + lastConfig.slope.toFixed(2) + '%');
        var sigCount = lastRouteData.signals ? lastRouteData.signals.length : 0;
        var ovs = lastRouteData.overpassStatus || 'ok';
        var ovm = lastRouteData.overpassMirror || '—';
        L.push('nSignals: ' + sigCount + ' (Overpass: ' + ovs + ', mirror: ' + ovm + ')');
        var vp = route.vmaxProfile;
        if (vp) {
          L.push('nCurves: ' + (vp.nCurves || 0));
          L.push('vRide_min: ' + vp.vRideMin.toFixed(1) + ' км/ч (' + (vp.vRideMinReason || '?') + ')')
        }
        L.push('nRoadSegments: ' + route.roadSegments.length);
        L.push('routeFlatCoords: ' + route.flatCoords.length);
        L.push('routeElevSamples: ' + route.samples.length)
      }
      L.push('');
      L.push('═══ КОНФИГ ═══');
      var savedCfg = {};
      Object.keys(lastConfig).forEach(function(k) {
        if (k === 'vmaxProfile') {
          var vp = lastConfig[k];
          if (vp) {
            var capStr;
            if (vp.hardCap) {
              if (vp.hardCapActive) {
                capStr = 'vTarget: ' + vp.vTargetNoCap.toFixed(0) + ' → ' + vp.vTargetCruise.toFixed(0) + ' (' + vp.weatherKey + ')'
              } else {
                capStr = 'HARD CAP armed'
              }
            } else {
              capStr = 'HARD CAP off'
            }
            var wDesc = vp.weatherDesc ? ' (' + vp.weatherDesc + ')' : '';
            var tMax = vp.windingTempMax,
              tStart = vp.windingTempStart,
              tEnd = vp.windingTempAtEnd;
            var tStr = (Math.abs(tMax - tStart) < 2) ? ('старт ' + tStart.toFixed(0) + '°C → конец ' + tEnd.toFixed(0) + '°C (без нагрева)') : ('старт ' + tStart.toFixed(0) + '°C → пик ' + tMax.toFixed(0) + '°C → конец ' + tEnd.toFixed(0) + '°C');
            var minReason = vp.vRideMinReason ? ' (' + vp.vRideMinReason + ')' : '';
            var whKmRouteStr = vp.whKmRoute ? vp.whKmRoute.toFixed(1) : '?';
            savedCfg[k] = '[по маршруту] ' + (vp.totalDist / 1000).toFixed(2) + ' км · физ ХХ A=' + vp.vMaxStart.toFixed(1) + '→' + vp.vMaxEnd.toFixed(1) + ' / едем A=' + vp.vRideStart.toFixed(1) + '→' + vp.vRideEnd.toFixed(1) + ' (мин ' + vp.vRideMin.toFixed(1) + minReason + ') · SOC ' + (vp.socAtEnd * 100).toFixed(0) + '% (' + whKmRouteStr + ' Втч/км) · weather=' + vp.weatherKey + wDesc + ' · фары ' + (vp.lightsW || 0) + ' Вт · ' + capStr + ' · рекуп +' + vp.totalRegenWh.toFixed(0) + ' Втч · 🌡 ' + tStr + ' · 🚦 ' + vp.nSignals + ' ↻ ' + (vp.nCurves || 0) + ' · ' + (vp.reachedEnd ? 'ОК' : 'НЕ ДОЕДЕТ до ' + (vp.distToCutoff / 1000).toFixed(2) + ' км')
          } else {
            savedCfg[k] = '[маршрут не загружен]'
          }
        } else {
          savedCfg[k] = lastConfig[k]
        }
      });
      Object.keys(savedCfg).sort().forEach(function(k) {
        L.push(k + ': ' + savedCfg[k])
      });
      saveTextFile('citybike_' + Date.now() + '.txt', L.join('\n'), 'text/plain')
    };
    var csvBtn = $('saveCsvBtn');
    if (csvBtn) csvBtn.onclick = exportRouteCsv
  }

  function setupCacheReset() {
    var btn = $('cacheResetBtn');
    if (!btn) return;
    var longPress = false,
      lpTimer = null;
    btn.addEventListener('touchstart', function() {
      longPress = false;
      lpTimer = setTimeout(function() {
        longPress = true
      }, 700)
    }, {
      passive: true
    });
    btn.addEventListener('touchend', function() {
      clearTimeout(lpTimer)
    });
    btn.addEventListener('click', function(ev) {
      if (ev.shiftKey || longPress) {
        longPress = false;
        if (!confirm('ПОЛНЫЙ СБРОС\n\nБудут удалены:\n• все настройки\n• точки маршрута\n• кэш Overpass\n• позиция карты\n\nПродолжить?')) return;
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {}
        location.reload();
        return;
      }
      var opKeys = [];
      try {
        for (var i = 0; i < sessionStorage.length; i++) {
          var k = sessionStorage.key(i);
          if (k && k.indexOf('overpass_') === 0) opKeys.push(k);
        }
      } catch (e) {}
      if (!confirm('СБРОС КЭША\n\n• Кэш Overpass (' + opKeys.length + ' зап.)\n• Позиция карты\n• Режим отчёта\n\nНастройки байка и точки маршрута сохранятся.\n\n(Долгое нажатие — полный сброс)')) return;
      try {
        opKeys.forEach(function(k) {
          sessionStorage.removeItem(k)
        });
        localStorage.removeItem(LS_MAP_KEY);
        localStorage.removeItem('citybikeAdvMode');
      } catch (e) {}
      var orig = btn.textContent;
      btn.textContent = '✓ СБРОШ';
      btn.classList.add('done');
      btn.disabled = true;
      setTimeout(function() {
        btn.textContent = orig;
        btn.classList.remove('done');
        btn.disabled = false;
      }, 1500);
    });
  }

  // v23: онлайн-индикатор отражает реальное состояние сети, а не статичный текст.
  function setupOnlineIndicator() {
    var dot = $('netDot'),
      lbl = $('netLabel');

    function upd() {
      var on = navigator.onLine !== false;
      if (dot) dot.classList.toggle('off', !on);
      if (lbl) lbl.textContent = on ? 'В СЕТИ' : 'НЕТ СЕТИ'
    }
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    upd()
  }

  function setupPanelCollapse() {
    document.querySelectorAll('.panel .panel-head').forEach(function(h) {
      h.addEventListener('click', function() {
        var p = h.closest('.panel');
        if (p) p.classList.toggle('collapsed')
      })
    })
  }

  function setupFrameSwitch() {
    var f = $('frameType'),
      r = $('tireR17Field'),
      w = $('wheelSize'),
      prev = w.value;

    function apply() {
      if (f.value === 'space') {
        if (w.value !== 'r17') prev = w.value;
        r.style.display = 'grid';
        w.value = 'r17'
      } else {
        r.style.display = 'none';
        if (w.value === 'r17') w.value = prev !== 'r17' ? prev : '26'
      }
      updateAdvRecommend()
    }
    f.addEventListener('change', apply);
    w.addEventListener('change', function() {
      if (w.value === 'r17' && f.value !== 'space') {
        f.value = 'space';
        r.style.display = 'grid'
      }
    });
    apply()
  }

  function tick() {
    var d = new Date(),
      s = d.toLocaleTimeString('ru-RU');
    var c = $('clock');
    if (c) c.textContent = s;
    var f = $('footClock');
    if (f) f.textContent = s.slice(0, 5)
  }

  function refreshWeather() {
    var btn = $('weatherBtn'),
      status = $('weatherStatus');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '...';
    // Координаты: маршрут → точка A → центр карты → Новосибирск
    var lat = HOME_CENTER[0],
      lon = HOME_CENTER[1],
      src = 'Новосибирск';
    try {
      if (lastRouteData && lastRouteData.alternatives && lastRouteData.alternatives[lastRouteData.selectedIndex]) {
        var r = lastRouteData.alternatives[lastRouteData.selectedIndex];
        if (r.samples && r.samples.length) {
          lat = r.samples[0].lat;
          lon = r.samples[0].lng;
          src = 'начало маршрута'
        }
      } else if (waypoints.length > 0) {
        lat = waypoints[0].lat;
        lon = waypoints[0].lon;
        src = 'точка ' + wpLetter(0)
      } else if (mapInstance) {
        var c = mapInstance.getCenter();
        if (c && isFinite(c.lat) && isFinite(c.lng)) {
          lat = c.lat;
          lon = c.lng;
          src = 'центр карты'
        }
      }
    } catch (e) {}
    if (status) {
      status.style.display = 'block';
      status.textContent = '⏳ wttr.in @ ' + lat.toFixed(3) + ',' + lon.toFixed(3) + ' (' + src + ')...'
    }
    var url = 'https://wttr.in/' + lat.toFixed(4) + ',' + lon.toFixed(4) + '?format=j1';
    var ctrl = new AbortController(),
      tid = setTimeout(function() {
        ctrl.abort()
      }, 12000);
    fetch(url, {
      signal: ctrl.signal
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json()
    }).then(function(data) {
      var cc = data.current_condition && data.current_condition[0];
      if (!cc) throw new Error('Нет данных');
      var tC = parseFloat(cc.temp_C),
        wK = parseFloat(cc.windspeedKmph),
        wM = wK / 3.6;
      if (!isFinite(tC)) tC = 20;
      if (!isFinite(wM)) wM = 3;
      var tEl = $('ambientTemp'),
        wEl = $('headwind');
      if (tEl) tEl.value = Math.round(tC);
      if (wEl) wEl.value = Math.round(wM * 2) / 2;
      var area = (data.nearest_area && data.nearest_area[0] && data.nearest_area[0].areaName && data.nearest_area[0].areaName[0].value) || '?';
      if (status) status.textContent = '✅ ' + area + ' · ' + tC.toFixed(1) + '°C · ветер ' + wM.toFixed(1) + ' м/с · ' + src;
      syncWinterMode();
      if (lastResults.avg) calculate()
    }).catch(function(err) {
      var why = err && err.name === 'AbortError' ? 'wttr.in не ответил за 12 с' : ('wttr.in: ' + ((err && err.message) || 'нет связи'));
      if (status) status.textContent = '❌ ' + why + '. Температуру и ветер можно ввести вручную.'
    }).finally(function() {
      clearTimeout(tid);
      btn.disabled = false;
      btn.textContent = 'ОБНОВИТЬ'
    })
  }

  function init() {
    loadOfflinePoi();
    var _ver = VERSION;
    var vl = $('versionLabel');
    if (vl) vl.textContent = _ver;
    document.title = 'CITY BIKE · Бортовой компьютер';
    E.MOTOR_SPECS.forEach(function(m) {
      var o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.name + ' — ' + m.power + 'W';
      $('mMotorModel').appendChild(o)
    });
    $('mMotorModel').value = 'qs205_5t';
    loadConfig();
    (function() {
      var s = null;
      for (var i = 0; i < E.MOTOR_SPECS.length; i++) {
        if (E.MOTOR_SPECS[i].id === $('mMotorModel').value) {
          s = E.MOTOR_SPECS[i];
          break
        }
      }
      if (s) applyMotorTemplate(s)
    })();
    updateMotorTypeRestrictions();
    setupFrameSwitch();
    setupCopySave();
    setupPanelCollapse();
    setupEtalonToggle();
    syncRoundTripSwitch();
    syncSpeedProfile();
    syncApplyWeather();
    syncHardCap();
    syncStyle();
    setupOnlineIndicator();
    setupCacheReset();
    if (IS_V221) {
      document.querySelectorAll('.adv-controls button').forEach(function(b) {
        b.addEventListener('click', function() {
          setAdvMode(this.dataset.adv)
        })
      });
      setAdvMode(advMode)
    } else {
      var ctrl = $('advControls');
      if (ctrl) ctrl.style.display = 'none';
      var comp = $('advCompact');
      if (comp) comp.style.display = 'none';
      var full = $('advFull');
      if (full) full.style.display = 'block'
    }
    loadWaypoints();
    initMap();
    var addBtn = $('wpAddBtn');
    if (addBtn) addBtn.addEventListener('click', function() {
      if (waypoints.length >= MAX_WAYPOINTS) {
        showRouteStatus('⚠ Максимум ' + MAX_WAYPOINTS, 'err');
        return
      }
      var c = mapInstance ? mapInstance.getCenter() : {
        lat: HOME_CENTER[0],
        lng: HOME_CENTER[1]
      };
      var off = 0.0008 * (waypoints.length + 1);
      addWaypoint(c.lat + off, c.lng + off)
    });
    var undoBtn = $('wpUndoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undoLastWaypoint);
    var revBtn = $('wpReverseBtn');
    if (revBtn) revBtn.addEventListener('click', reverseWaypoints);
    var clrBtn = $('wpClearBtn');
    if (clrBtn) clrBtn.addEventListener('click', function() {
      if (waypoints.length && confirm('Удалить все ' + waypoints.length + ' точек?')) clearAllWaypoints()
    });
    var mcBtn = $('mapClearBtn');
    if (mcBtn) mcBtn.addEventListener('click', function() {
      clearAllWaypoints();
      var rs = $('routeStatus');
      if (rs) rs.className = 'rw-status'
    });
    var mcBtn2 = $('mapCenterBtn');
    if (mcBtn2) mcBtn2.addEventListener('click', function() {
      var btn = this;
      var orig = btn.textContent;
      var isSecure = (window.isSecureContext === true) || (location.protocol === 'https:') || (location.hostname === 'localhost') || (location.hostname === '127.0.0.1');
      if (!isSecure) {
        showRouteStatus('❌ GPS не работает на этом протоколе.', 'err');
        return
      }
      if (!navigator.geolocation) {
        showRouteStatus('❌ GPS недоступен', 'err');
        return
      }
      btn.disabled = true;
      btn.textContent = '⏳ GPS...';
      showRouteStatus('⏳ Запрашиваем координаты...', 'info');
      navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude,
          lng = pos.coords.longitude,
          acc = pos.coords.accuracy || 0;
        mapInstance.setView([lat, lng], 16);
        if (waypoints.length === 0) {
          addWaypoint(lat, lng)
        }
        showRouteStatus('✅ GPS: ' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ' · ±' + Math.round(acc) + ' м', 'ok');
        btn.disabled = false;
        btn.textContent = orig
      }, function(err) {
        showRouteStatus('❌ GPS: ' + (err.code === 1 ? 'нет разрешения на геолокацию' : err.code === 2 ? 'позиция недоступна' : 'таймаут'), 'err');
        btn.disabled = false;
        btn.textContent = orig
      }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      })
    });
    $('rideStyle').addEventListener('change', function() {
      syncStyle();
      if (lastRouteData) applyLastRoute();
      if (lastResults.avg) calculate()
    });
    $('cityCycle').addEventListener('change', function() {
      syncStyle();
      if (lastResults.avg) calculate()
    });
    $('routeRoundTrip').addEventListener('change', function() {
      syncRoundTripSwitch();
      if (lastRouteData) applyLastRoute()
    });
    $('regenMode').addEventListener('change', function() {
      syncSwitches();
      if (lastRouteData && $('routeRoundTrip').checked) applyLastRoute();
      else if (lastResults.avg) calculate()
    });
    $('winterMode').addEventListener('change', function() {
      syncWinterMode();
      if (lastRouteData && $('routeRoundTrip').checked) applyLastRoute();
      else if (lastResults.avg) calculate()
    });
    $('ambientTemp').addEventListener('input', function() {
      syncWinterMode()
    });
    $('useSpeedProfile').addEventListener('change', function() {
      syncSpeedProfile();
      syncStyle();
      if (lastResults.avg) calculate()
    });
    if ($('applyWeather')) $('applyWeather').addEventListener('change', function() {
      syncApplyWeather();
      if (lastRouteData) applyLastRoute()
    });
    if ($('hardWeatherCap')) $('hardWeatherCap').addEventListener('change', function() {
      syncHardCap();
      if (lastRouteData) applyLastRoute()
    });
    $('routeFetchBtn').addEventListener('click', fetchRouteAndWind);
    var _retryBtn = $('retryOverpassBtn');
    if (_retryBtn) _retryBtn.addEventListener('click', async function() {
      if (!lastRouteData || !lastRouteData.alternatives || !lastRouteData.alternatives.length) return;
      var route = lastRouteData.alternatives[lastRouteData.selectedIndex];
      var routeKey = waypoints.map(function(w) {
        return w.lat.toFixed(4) + '_' + w.lon.toFixed(4)
      }).join('_') + '_' + route.flatCoords.length;
      try {
        sessionStorage.removeItem('overpass_v4_' + routeKey)
      } catch (e) {}
      this.disabled = true;
      this.textContent = '⏳...';
      showRouteStatus('⏳ Повтор Overpass (' + OVERPASS_MIRRORS.length + ' зеркала)...', 'info');
      try {
        var result = await fetchTrafficSignals(route.flatCoords, routeKey);
        lastRouteData.signals = result.signals;
        lastRouteData.overpassStatus = result.status === 'fallback_road' ? 'fallback: roadSegments only' : result.status;
        lastRouteData.overpassMirror = result.mirror;
        var txt;
        if (result.status === 'ok') txt = '✅ ' + result.signals.length + ' объектов с ' + esc(result.mirror);
        else if (result.status === 'cached') txt = '✅ ' + result.signals.length + ' из кэша';
        else if (result.status === 'offline') txt = '✅ ' + result.signals.length + ' из офлайн-базы';
        else if (result.status === 'fallback_road') txt = '⚠ Все зеркала недоступны — ограничения по типу дороги';
        else txt = '❌ ' + esc(result.status);
        showRouteStatus('Overpass: ' + txt, (result.status === 'ok' || result.status === 'cached' || result.status === 'offline') ? 'ok' : 'err');
        applyLastRoute()
      } catch (e) {
        showRouteStatus('❌ Overpass: ' + esc(e.message), 'err')
      } finally {
        this.disabled = false;
        this.textContent = '↻ Повторить Overpass'
      }
    });
    $('applyWindBtn').addEventListener('click', applyLastRoute);
    ['routeStart', 'routeEnd'].forEach(function(id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function() {
        syncInputsToWaypoints()
      })
    });
    $('elevationSlider').addEventListener('input', function() {
      updateElevationCursor(parseInt(this.value) / 1000)
    });
    var elevCanvas = $('elevationCanvas'),
      vmaxCanvas = $('vmaxCanvas');

    function canvasPosToCursor(e, el) {
      var rect = el.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      var pad = el._pad;
      if (!pad) return 0;
      var cw = el._cw;
      var pos = (x - pad.left) / cw;
      return Math.max(0, Math.min(1, pos))
    }

    function handleMove(e, el) {
      if (!lastRouteData || !lastRouteData.alternatives) return;
      var pos = canvasPosToCursor(e, el);
      $('elevationSlider').value = Math.round(pos * 1000);
      updateElevationCursor(pos)
    }
    elevCanvas.addEventListener('mousemove', function(e) {
      handleMove(e, elevCanvas)
    });
    elevCanvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      handleMove(e, elevCanvas)
    }, {
      passive: false
    });
    elevCanvas.addEventListener('click', function(e) {
      handleMove(e, elevCanvas)
    });
    vmaxCanvas.addEventListener('mousemove', function(e) {
      handleMove(e, vmaxCanvas)
    });
    vmaxCanvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      handleMove(e, vmaxCanvas)
    }, {
      passive: false
    });
    vmaxCanvas.addEventListener('click', function(e) {
      handleMove(e, vmaxCanvas)
    });
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (lastRouteData && lastRouteData.alternatives && lastRouteData.alternatives[lastRouteData.selectedIndex]) {
          var rt = $('routeRoundTrip').checked;
          var route = lastRouteData.alternatives[lastRouteData.selectedIndex];
          var effDist = route.totalDist * (rt ? 2 : 1);
          if (route.elevRange) drawElevationProfile(route.elevRange, effDist, currentCursorPos, rt);
          if (route.vmaxProfile) drawVmaxProfile(route.vmaxProfile, effDist, currentCursorPos, rt)
        }
      }, 200)
    });
    syncWinterMode();
    $('advBtn').onclick = function() {
      var p = $('advPanel');
      p.classList.toggle('on');
      this.classList.toggle('on', p.classList.contains('on'))
    };
    $('resetAdvBtn').onclick = function() {
      TPL_IDS.forEach(function(id) {
        userEdited[id] = false
      });
      var s = null;
      for (var i = 0; i < E.MOTOR_SPECS.length; i++) {
        if (E.MOTOR_SPECS[i].id === $('mMotorModel').value) {
          s = E.MOTOR_SPECS[i];
          break
        }
      }
      if (s) applyMotorTemplate(s);
      var b = this;
      b.classList.add('done');
      b.textContent = '✓ СБРОШ';
      setTimeout(function() {
        b.classList.remove('done');
        b.textContent = '↺ СБРОСИТЬ'
      }, 1200);
      if (lastResults.avg) calculate()
    };
    $('pedalMode').addEventListener('change', function() {
      syncSwitches();
      if (lastResults.avg) calculate()
    });
    $('fwMode').addEventListener('change', function() {
      syncSwitches();
      if (lastResults.avg) calculate()
    });
    $('calcBtn').onclick = calculate;
    document.querySelectorAll('.range-head .quick button').forEach(function(b) {
      b.onclick = function() {
        if (this.dataset.dist) $('rangeDistance').value = this.dataset.dist;
        if (this.dataset.coast) $('rangeCoastFactor').value = this.dataset.coast;
        var g = this.parentElement;
        g.querySelectorAll('button').forEach(function(x) {
          x.classList.remove('active')
        });
        this.classList.add('active');
        if (lastResults.avg) renderRangeCalc()
      }
    });
    $('rangeDistance').addEventListener('input', function() {
      if (lastResults.avg) renderRangeCalc()
    });
    $('rangeCoastFactor').addEventListener('input', function() {
      if (lastResults.avg) renderRangeCalc()
    });
    $('reportToggle').onclick = function() {
      var adv = $('advancedReport');
      var on = adv.classList.toggle('on');
      this.classList.toggle('on', on);
      this.querySelector('span:first-child').textContent = on ? 'СКРЫТЬ' : 'РАСШИРЕННЫЙ'
    };
    $('mMotorModel').addEventListener('change', function() {
      var v = this.value,
        m = null;
      for (var i = 0; i < E.MOTOR_SPECS.length; i++) {
        if (E.MOTOR_SPECS[i].id === v) {
          m = E.MOTOR_SPECS[i];
          break
        }
      }
      if (!m) return;
      applyMotorTemplate(m);
      updateMotorTypeRestrictions();
      if (lastResults.avg) calculate()
    });
    $('motorType').addEventListener('change', function() {
      var nt = this.value,
        cs = E.getMotorSpecById($('mMotorModel').value);
      if (!cs || cs.type !== nt) {
        var ns = E.getMotorSpec(nt, cs ? cs.power : 5000, null);
        if (ns) {
          $('mMotorModel').value = ns.id;
          applyMotorTemplate(ns)
        }
      }
      updateMotorTypeRestrictions();
      if (lastResults.avg) calculate()
    });
    TPL_IDS.forEach(function(id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function() {
        userEdited[id] = true;
        markTplLocks()
      })
    });
    ['ambientTemp', 'headwind'].forEach(function(id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function() {
        userEdited[id] = true
      })
    });
    $('voltageSelect').addEventListener('change', function() {
      userEdited['voltageSelect'] = true
    });
    ['mCtrlCurrent', 'mCtrlEff', 'voltageSelect', 'mBattV'].forEach(function(id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', renderPeakTable);
      el.addEventListener('change', renderPeakTable)
    });
    var wBtn = $('weatherBtn');
    if (wBtn) wBtn.addEventListener('click', refreshWeather);
    var t;

    function deb() {
      clearTimeout(t);
      t = setTimeout(function() {
        if (lastResults.avg) calculate()
      }, 700)
    }
    document.addEventListener('input', function(e) {
      if (!lastResults.avg) return;
      if (!e.target.matches('input[type="number"],select')) return;
      if (e.target.id === 'rangeDistance' || e.target.id === 'rangeCoastFactor') return;
      deb()
    });
    document.addEventListener('change', function(e) {
      if (!lastResults.avg) return;
      if (e.target.tagName !== 'SELECT') return;
      if (e.target.id === 'rangeDistance' || e.target.id === 'rangeCoastFactor' || e.target.id === 'rideStyle') return;
      deb()
    });
    // v23: Android может закрыть приложение без beforeunload — сохраняем и при сворачивании.
    window.addEventListener('beforeunload', saveConfig);
    window.addEventListener('pagehide', saveConfig);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') saveConfig()
    });
    window.__cbSave = saveConfig;
    window.__cbState = function() {
      return {
        results: lastResults,
        route: lastRouteData,
        waypoints: waypoints.length
      }
    };
    window.__cbBack = function() {
      var p = $('advPanel');
      if (p && p.classList.contains('on')) {
        $('advBtn').click();
        return true
      }
      return false
    };
    var keyEl = $('geoKey');
    if (keyEl) {
      try {
        keyEl.value = localStorage.getItem('cbGeoapifyKey') || ''
      } catch (e) {}
      keyEl.addEventListener('change', function() {
        var v = keyEl.value.trim();
        try {
          if (!v) localStorage.removeItem('cbGeoapifyKey');
          else if (/^[a-f0-9]{32}$/i.test(v)) localStorage.setItem('cbGeoapifyKey', v);
          else {
            alert('Ключ Geoapify — 32 символа 0-9/a-f');
            return
          }
        } catch (e) {}
        alert('Ключ сохранён. Перезапустите приложение.')
      })
    }
    setInterval(tick, 1000);
    tick();
    renderPeakTable();
    calculate();
    console.log('✅ CITY BIKE ' + _ver);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init()
})();