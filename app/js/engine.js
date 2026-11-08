/* ДВИЖОК — patched */

/* ДВИЖОК — v22.1.7 + FIX-v22.2 + v22.2a + v22.2b */
(function(root) {
  'use strict';
  // v23: одна версия расчёта. Меню «шесть версий, четыре одинаковые» убрано,
  // старые откаты (v21.x, V22_B1) считали иначе и давали другой запас на том же байке.
  var CB_MODE = 'v2214';
  var IS_V2214 = CB_MODE === 'v2214';
  var IS_V2213 = CB_MODE === 'v2213' || IS_V2214;
  var IS_V2211 = IS_V2213 || CB_MODE === 'v2211';
  var IS_V221 = IS_V2211;
  var IS_V22B1 = CB_MODE === 'v22b1';
  var IS_V22 = IS_V221 || IS_V22B1;
  var IS_FULL = IS_V221 || IS_V22B1 || CB_MODE === 'full';
  var IS_SAFE = CB_MODE === 'safe';
  var FIXED_ALT = 150,
    FIXED_HUM = .5,
    TYPICAL_TRIP_KM = 30,
    WINTER_THRESHOLD_C = -1,
    ETALON_TEMP_C = 20;
  var FRAME_PROPS = {
    regular: {
      massExtra: 0,
      cdaMult: 1.00
    },
    space: {
      massExtra: 12,
      cdaMult: 1.05
    }
  };
  var R17_PROPS = {
    street: {
      crr: .010,
      cdaExtra: .02
    },
    dual: {
      crr: .013,
      cdaExtra: .04
    },
    offroad: {
      crr: .018,
      cdaExtra: .05
    }
  };
  var MODES = {
    eco: {
      name: 'ЭКО',
      mult: .55
    },
    normal: {
      name: 'НОРМА',
      mult: 1.00
    },
    sport: {
      name: 'СПОРТ',
      mult: 1.30
    },
    boost: {
      name: 'ТУРБО',
      mult: 1.60
    }
  };
  var COOLING_MODS = {
    none: {
      name: 'Штатное',
      boost: 1.00,
      dragW: 0,
      cost: 0
    },
    ferro: {
      name: 'Феррофлюид',
      boost: 1.15,
      dragW: 1.5,
      cost: 2500
    },
    oil: {
      name: 'Масло ATF + радиаторы',
      boost: 1.30,
      dragW: 12,
      cost: 1200
    }
  };
  var PROFILE_MULT = {
    opt: {
      cdaMult: 0.85,
      crrMult: 0.80,
      effMult: 1.05,
      derate: 0.90,
      peukertAdd: -0.02
    },
    avg: {
      cdaMult: 1.00,
      crrMult: 1.00,
      effMult: 1.00,
      derate: 0.85,
      peukertAdd: 0.00
    },
    pess: {
      cdaMult: 1.20,
      crrMult: 1.35,
      effMult: 0.88,
      derate: 0.75,
      peukertAdd: 0.04
    }
  };
  var RIDE_STYLES = {
    calm: {
      name: 'Спокойный',
      vBase: 20,
      energyMult: 1.00,
      stopsPerKm: 0.5,
      color: '#5ce66e',
      icon: '😌'
    },
    moderate: {
      name: 'Умеренный',
      vBase: 28,
      energyMult: 1.00,
      stopsPerKm: 1.0,
      color: '#4fc3f7',
      icon: '🙂'
    },
    normal: {
      name: 'Нормальный',
      vBase: 36,
      energyMult: 1.00,
      stopsPerKm: 1.5,
      color: '#a94fe8',
      icon: '🚴'
    },
    confident: {
      name: 'Уверенный',
      vBase: 45,
      energyMult: 1.05,
      stopsPerKm: 2.0,
      color: '#ffcc00',
      icon: '🏃'
    },
    aggressive: {
      name: 'Агрессивный',
      vBase: 55,
      energyMult: 1.10,
      stopsPerKm: 2.5,
      color: '#ff8c42',
      icon: '🏍'
    },
    extreme: {
      name: 'Экстрим',
      vBase: 70,
      energyMult: 1.20,
      stopsPerKm: 3.5,
      color: '#ff3333',
      icon: '🔥'
    },
    racing: {
      name: 'Racing',
      vBase: 85,
      energyMult: 1.30,
      stopsPerKm: 4.0,
      color: '#ff00ff',
      icon: '🏎'
    }
  };
  // v23: туман сам по себе энергию не ест (только фары, они учтены отдельно),
  // гроза = сильный дождь + порывы. Снег/лёд — рыхлое покрытие и пробуксовка.
  var WEATHER_ENERGY = {
    ice: 1.35,
    snow: 1.25,
    thunder: 1.12,
    fog: 1.00,
    rainHeavy: 1.10,
    rainMedium: 1.06,
    rainLight: 1.03,
    clear: 1.00
  };
  var ROAD_CLASS_SPEED = {
    motorway: 90,
    motorway_link: 60,
    trunk: 80,
    trunk_link: 50,
    primary: 60,
    primary_link: 40,
    secondary: 50,
    secondary_link: 35,
    tertiary: 45,
    tertiary_link: 30,
    residential: 30,
    living_street: 20,
    unclassified: 35,
    service: 20,
    track: 15,
    path: 15,
    footway: 8,
    pedestrian: 8,
    cycleway: 20,
    steps: 3
  };
  var DEF_PRICES = {
    frame: {
      space: 130000
    },
    display: {
      none: 1000
    },
    options: {
      pas: 1500,
      throttle_std: 1500
    },
    battery: {
      cellSK: 5000,
      cellCapSK: 55,
      cellLG: 550,
      cellCapLG: 5.2,
      cellChina: 310,
      cellCapChina: 5,
      bmsBasic: 1500,
      bmsSmart: 3400,
      bmsSmartHighV: 6500,
      chargerLow: 2500,
      chargerHigh: 4500,
      caseHailong: 6000,
      workSmall: 5000,
      workMedium: 10000,
      workLarge: 20000
    }
  };
  var MOTOR_SPECS = [{
    id: 'geared_250_36',
    name: 'Редуктор 250W 36V',
    type: 'geared',
    power: 250,
    baseKV: 10.0,
    baseTurns: 12,
    ratio: 5,
    finalRatio: 1,
    peak: 500,
    idleI: 0.35,
    recV: 36,
    recCtrlBat: 12,
    recCtrlPhz: 22,
    recBattAh: 10,
    recBattMaxA: 25
  }, {
    id: 'geared_350_48',
    name: 'Редуктор 350W 48V',
    type: 'geared',
    power: 350,
    baseKV: 9.5,
    baseTurns: 14,
    ratio: 5,
    finalRatio: 1,
    peak: 700,
    idleI: 0.4,
    recV: 48,
    recCtrlBat: 18,
    recCtrlPhz: 36,
    recBattAh: 13,
    recBattMaxA: 35
  }, {
    id: 'geared_500_48',
    name: 'Редуктор 500W 48V',
    type: 'geared',
    power: 500,
    baseKV: 10.0,
    baseTurns: 14,
    ratio: 5,
    finalRatio: 1,
    peak: 1000,
    idleI: 0.55,
    recV: 48,
    recCtrlBat: 25,
    recCtrlPhz: 50,
    recBattAh: 20,
    recBattMaxA: 45
  }, {
    id: 'mac500',
    name: 'MAC 500W',
    type: 'geared',
    power: 500,
    baseKV: 10.0,
    baseTurns: 14,
    ratio: 5,
    finalRatio: 1,
    peak: 1200,
    idleI: 0.55,
    recV: 48,
    recCtrlBat: 25,
    recCtrlPhz: 50,
    recBattAh: 20,
    recBattMaxA: 50
  }, {
    id: 'xf15r',
    name: 'MXUS XF15R 500W',
    type: 'geared',
    power: 500,
    baseKV: 6.67,
    baseTurns: 10,
    ratio: 5,
    finalRatio: 1,
    peak: 1200,
    idleI: 0.6,
    recV: 48,
    recCtrlBat: 25,
    recCtrlPhz: 50,
    recBattAh: 20,
    recBattMaxA: 50,
    measuredKV: {
      7: 9.524,
      8: 8.425,
      9: 7.875,
      10: 6.9,
      11: 6.4,
      12: 5.9,
      13: 5.5,
      14: 5.2,
      15: 4.8
    },
    measuredTurns: {
      7: 1,
      8: 1,
      9: 1
    },
    measuredRefV: 54.6,
    measuredSrc: 'bench'
  }, {
    id: 'geared_1000_48',
    name: 'Редуктор 1000W 48V',
    type: 'geared',
    power: 1000,
    baseKV: 7.5,
    baseTurns: 10,
    ratio: 5,
    finalRatio: 1,
    peak: 2000,
    idleI: 0.7,
    recV: 48,
    recCtrlBat: 35,
    recCtrlPhz: 70,
    recBattAh: 25,
    recBattMaxA: 60
  }, {
    id: 'mac1k',
    name: 'MAC 1000W',
    type: 'geared',
    power: 1000,
    baseKV: 7.5,
    baseTurns: 10,
    ratio: 5,
    finalRatio: 1,
    peak: 2000,
    idleI: 0.7,
    recV: 48,
    recCtrlBat: 35,
    recCtrlPhz: 70,
    recBattAh: 25,
    recBattMaxA: 60
  }, {
    id: 'g310',
    name: 'Bafang G310',
    type: 'geared',
    power: 350,
    baseKV: 11.0,
    baseTurns: 14,
    ratio: 5,
    finalRatio: 1,
    peak: 600,
    idleI: 0.4,
    recV: 36,
    recCtrlBat: 15,
    recCtrlPhz: 30,
    recBattAh: 10,
    recBattMaxA: 25
  }, {
    id: 'bbs02',
    name: 'Bafang BBS02 (MID)',
    type: 'mid',
    power: 750,
    baseKV: 2.3,
    baseTurns: 21,
    ratio: 21.9,
    finalRatio: 3.0,
    peak: 1300,
    idleI: 0.45,
    recV: 48,
    recCtrlBat: 25,
    recCtrlPhz: 50,
    recBattAh: 15,
    recBattMaxA: 50
  }, {
    id: 'bbshd',
    name: 'Bafang BBSHD (MID)',
    type: 'mid',
    power: 1000,
    baseKV: 2.7,
    baseTurns: 21,
    ratio: 21.9,
    finalRatio: 3.0,
    peak: 1600,
    idleI: 0.5,
    recV: 48,
    recCtrlBat: 30,
    recCtrlPhz: 60,
    recBattAh: 20,
    recBattMaxA: 60
  }, {
    id: 'dd_1k',
    name: 'DD 1000W',
    type: 'dd',
    power: 1000,
    baseKV: 12.0,
    baseTurns: 4,
    ratio: 1,
    finalRatio: 1,
    peak: 2000,
    idleI: 0.4,
    recV: 48,
    recCtrlBat: 25,
    recCtrlPhz: 50,
    recBattAh: 20,
    recBattMaxA: 50
  }, {
    id: 'dd_2k',
    name: 'DD 2000W',
    type: 'dd',
    power: 2000,
    baseKV: 12.0,
    baseTurns: 4,
    ratio: 1,
    finalRatio: 1,
    peak: 4000,
    idleI: 0.5,
    recV: 60,
    recCtrlBat: 40,
    recCtrlPhz: 80,
    recBattAh: 25,
    recBattMaxA: 80
  }, {
    id: 'hs3540',
    name: 'Crystalyte HS3540',
    type: 'dd',
    power: 2000,
    baseKV: 12.0,
    baseTurns: 4,
    ratio: 1,
    finalRatio: 1,
    peak: 4000,
    idleI: 0.5,
    recV: 72,
    recCtrlBat: 40,
    recCtrlPhz: 80,
    recBattAh: 30,
    recBattMaxA: 80
  }, {
    id: 'mxus3k_4t',
    name: 'MXUS 3000W 4T',
    type: 'dd',
    power: 3000,
    baseKV: 11.0,
    baseTurns: 4,
    ratio: 1,
    finalRatio: 1,
    peak: 6000,
    idleI: 0.55,
    recV: 72,
    recCtrlBat: 80,
    recCtrlPhz: 160,
    recBattAh: 40,
    recBattMaxA: 120
  }, {
    id: 'mxus3k_5t',
    name: 'MXUS 3000W 5T',
    type: 'dd',
    power: 3000,
    baseKV: 9.5,
    baseTurns: 5,
    ratio: 1,
    finalRatio: 1,
    peak: 6000,
    idleI: 0.55,
    recV: 72,
    recCtrlBat: 80,
    recCtrlPhz: 160,
    recBattAh: 40,
    recBattMaxA: 120
  }, {
    id: 'cromotor',
    name: 'Cromotor 5000W',
    type: 'dd',
    power: 5000,
    baseKV: 10.0,
    baseTurns: 4,
    ratio: 1,
    finalRatio: 1,
    peak: 10000,
    idleI: 0.85,
    recV: 72,
    recCtrlBat: 120,
    recCtrlPhz: 250,
    recBattAh: 55,
    recBattMaxA: 150
  }, {
    id: 'qs205_3t',
    name: 'QS205 3T',
    type: 'dd',
    power: 5000,
    baseKV: 16.0,
    baseTurns: 3,
    ratio: 1,
    finalRatio: 1,
    peak: 10000,
    idleI: 0.7,
    recV: 72,
    recCtrlBat: 120,
    recCtrlPhz: 250,
    recBattAh: 55,
    recBattMaxA: 150
  }, {
    id: 'qs205_35t',
    name: 'QS205 3.5T',
    type: 'dd',
    power: 5000,
    baseKV: 13.0,
    baseTurns: 3.5,
    ratio: 1,
    finalRatio: 1,
    peak: 10000,
    idleI: 0.7,
    recV: 72,
    recCtrlBat: 120,
    recCtrlPhz: 250,
    recBattAh: 55,
    recBattMaxA: 150
  }, {
    id: 'qs205_4t',
    name: 'QS205 4T',
    type: 'dd',
    power: 5000,
    baseKV: 11.0,
    baseTurns: 4,
    ratio: 1,
    finalRatio: 1,
    peak: 10000,
    idleI: 0.7,
    recV: 72,
    recCtrlBat: 120,
    recCtrlPhz: 250,
    recBattAh: 55,
    recBattMaxA: 150
  }, {
    id: 'qs205_5t',
    name: 'QS205 5T',
    type: 'dd',
    power: 5000,
    baseKV: 9.4,
    baseTurns: 5,
    ratio: 1,
    finalRatio: 1,
    peak: 10000,
    idleI: 0.7,
    recV: 72,
    recCtrlBat: 120,
    recCtrlPhz: 250,
    recBattAh: 55,
    recBattMaxA: 150
  }, {
    id: 'qs273_4t',
    name: 'QS273 8000W 4T',
    type: 'dd',
    power: 8000,
    baseKV: 11.0,
    baseTurns: 4,
    ratio: 1,
    finalRatio: 1,
    peak: 16000,
    idleI: 0.9,
    recV: 96,
    recCtrlBat: 150,
    recCtrlPhz: 330,
    recBattAh: 70,
    recBattMaxA: 200
  }, {
    id: 'qs273_35t',
    name: 'QS273 8000W 3.5T',
    type: 'dd',
    power: 8000,
    baseKV: 13.0,
    baseTurns: 3.5,
    ratio: 1,
    finalRatio: 1,
    peak: 16000,
    idleI: 0.9,
    recV: 96,
    recCtrlBat: 150,
    recCtrlPhz: 330,
    recBattAh: 70,
    recBattMaxA: 200
  }];

  function clamp(x, a, b) {
    return Math.min(b, Math.max(a, x))
  }

  function kmh2ms(v) {
    return v / 3.6
  }

  function ms2kmh(v) {
    return v * 3.6
  }

  function getWR(s) {
    return ({
      20: .254,
      24: .305,
      26: .330,
      "27.5": .349,
      29: .368,
      "r17": .310
    } [s] || .330)
  }

  function deepCopy(o) {
    return JSON.parse(JSON.stringify(o))
  }

  function haversineLocal(a, b) {
    var R = 6371000,
      la1 = a[0] * Math.PI / 180,
      la2 = b[0] * Math.PI / 180;
    var dLa = (b[0] - a[0]) * Math.PI / 180,
      dLo = (b[1] - a[1]) * Math.PI / 180;
    var s = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(s))
  }

  function angleDiffLocal(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d
  }

  function bearingDeg(p1, p2) {
    var tr = Math.PI / 180,
      dL = (p2[1] - p1[1]) * tr;
    var y = Math.sin(dL) * Math.cos(p2[0] * tr);
    var x = Math.cos(p1[0] * tr) * Math.sin(p2[0] * tr) - Math.sin(p1[0] * tr) * Math.cos(p2[0] * tr) * Math.cos(dL);
    return (Math.atan2(y, x) / tr + 360) % 360
  }

  function airDensity(t, alt, hum) {
    alt = alt || 0;
    hum = hum == null ? .5 : hum;
    var T = t + 273.15,
      R = 287.058;
    var p = 101325 * Math.pow(1 - 2.25577e-5 * alt, 5.25588);
    var pSat = 610.78 * Math.exp(17.27 * t / (t + 237.3));
    var pV = hum * pSat,
      pD = p - pV;
    return pD / (R * T) + pV / (461.495 * T)
  }

  function crrBase(t) {
    var m = {
      slick: .0040,
      semi: .0055,
      city: .0065,
      mtb_xc: .0075,
      mtb_aggr: .0095,
      fat: .0120
    };
    return m[t] != null ? m[t] : .0065
  }

  function crrSurf(s) {
    var m = {
      asphalt_smooth: 1,
      asphalt_rough: 1.15,
      concrete: 1.08,
      gravel_packed: 1.6,
      gravel_loose: 2.2,
      dirt_dry: 2,
      dirt_wet: 2.8,
      sand: 4.5,
      snow_packed: 2.3,
      snow_loose: 3.8,
      ice: .65
    };
    return m[s] != null ? m[s] : 1
  }

  function crrPress(p, pref) {
    pref = pref || 4;
    return Math.pow(pref / Math.max(p, .5), .35)
  }

  function crrTemp(T) {
    if (T >= 20) return Math.max(.88, 1 - .0012 * (T - 20));
    if (T >= 0) return 1 + .0075 * (20 - T);
    return 1.15 + .020 * (0 - T)
  }

  function crrSpeed(v, vref) {
    vref = vref || 20;
    return Math.max(.9, 1 + .0035 * (v - vref))
  }

  function cdaMassFactor(m) {
    var r = clamp(m, 45, 125);
    return clamp(1 + (r - 70) * 0.004, 0.85, 1.20)
  }

  function frontalArea(bt, p, rm) {
    var b = (bt === 'fat' ? .44 : .40) * (p === 'sport' ? .82 : 1);
    return b * cdaMassFactor(rm == null ? 70 : rm)
  }

  function dragCoef(p, bt) {
    var c = p === 'sport' ? .85 : 1;
    if (bt === 'fat') c *= 1.08;
    return c
  }

  function aeroForceCdA(r, C, v, w) {
    var vr = v + w;
    return .5 * r * C * vr * Math.abs(vr)
  }

  function Nforce(m, s) {
    return m * 9.81 * Math.cos(Math.atan(s / 100))
  }

  function Fgrav(m, s) {
    return m * 9.81 * Math.sin(Math.atan(s / 100))
  }

  function Froll(m, s, c) {
    return Nforce(m, s) * c
  }

  function Fbear(m, s, mu) {
    mu = mu || .0015;
    return mu * Nforce(m, s)
  }

  function motorEff(p, rated, type) {
    if (rated <= 0) rated = 1;
    var l = Math.max(p / rated, .05);
    var peak = type === 'dd' ? 0.90 : (type === 'mid' ? 0.87 : 0.86);
    var shape;
    if (l < .2) shape = .62 + .28 * (l / .2);
    else if (l < .5) shape = .90 + .10 * ((l - .2) / .3);
    else if (l < 1.0) shape = 1.0;
    else shape = Math.max(.72, 1 - .10 * Math.pow(l - 1.0, .9));
    return peak * shape
  }

  function fwLossFactor(fwOn) {
    return fwOn ? 0.90 : 1.0
  }

  function fwPowerBoost(fwOn) {
    return 1.0
  }

  function motorRpm(vms, r) {
    return vms / (2 * Math.PI * r) * 60
  }

  function motorTorque(p, rpm) {
    return 9.5493 * p / Math.max(rpm, 1)
  }

  function coastSim(v0, mass, slope, crr, rho, CdA, muB) {
    muB = muB || .0015;
    var v = kmh2ms(v0),
      x = 0,
      t = 0;
    var dt = .02,
      ang = Math.atan(slope / 100);
    var Fc = mass * 9.81 * (crr * Math.cos(ang) + Math.sin(ang) + muB * Math.cos(ang));
    var Fa = .5 * rho * CdA;
    var v0ms = v,
      lastT = -1;
    while (v > .15 && t < 120) {
      var a = -(Fc + Fa * v * v) / mass;
      if (a > 0 && v > v0ms * 1.5) break;
      var vp = v;
      v += a * dt;
      if (v < 0) v = 0;
      x += (vp + v) / 2 * dt;
      t += dt;
      if (t - lastT >= 0.1) lastT = t
    }
    return {
      distance: x,
      time: t
    }
  }

  function calcTimeToOverheat(h, G, C, Ta, Tl) {
    if (h <= 0) return Infinity;
    var s = h / G,
      d = Tl - Ta;
    if (s <= d) return Infinity;
    return -(C / G) * Math.log(1 - d / s)
  }

  function motorThermalRise(h, t, C, G, Ta) {
    C = C || 8000;
    G = G || 4;
    Ta = Ta == null ? 20 : Ta;
    return Ta + (h / G) * (1 - Math.exp(-t / (C / G)))
  }

  function thermalGByPower(m) {
    if (m <= 350) return 2.2;
    if (m <= 500) return 2.5;
    if (m <= 750) return 2.8;
    if (m <= 1000) return 3.2;
    if (m <= 1500) return 3.6;
    if (m <= 3000) return 4.0;
    if (m <= 5000) return 4.5;
    return 5.5
  }

  function thermalCapacityByPower(m) {
    if (m <= 350) return 300;
    if (m <= 500) return 400;
    if (m <= 750) return 600;
    if (m <= 1000) return 800;
    if (m <= 1500) return 1200;
    if (m <= 2000) return 1600;
    if (m <= 3000) return 2500;
    if (m <= 5000) return 5000;
    return 7000
  }

  function battTempDerate(T) {
    var p = [
      [-40, .38],
      [-30, .5],
      [-20, .65],
      [-10, .78],
      [0, .88],
      [10, .95],
      [20, 1],
      [25, 1],
      [40, .95],
      [45, .85]
    ];
    if (T <= -40) return .38;
    if (T >= 45) return .85;
    for (var i = 0; i < p.length - 1; i++) {
      if (T >= p[i][0] && T <= p[i + 1][0]) {
        var t = (T - p[i][0]) / (p[i + 1][0] - p[i][0]);
        return p[i][1] + t * (p[i + 1][1] - p[i][1])
      }
    }
    return 1
  }

  function battIRTempMult(T) {
    var p = [
      [-40, 6.0],
      [-30, 4.2],
      [-20, 3.0],
      [-10, 2.0],
      [0, 1.4],
      [10, 1.15],
      [25, 1.0],
      [40, 1.0]
    ];
    if (T <= -40) return 6.0;
    if (T >= 40) return 1.0;
    for (var i = 0; i < p.length - 1; i++) {
      if (T >= p[i][0] && T <= p[i + 1][0]) {
        var t = (T - p[i][0]) / (p[i + 1][0] - p[i][0]);
        return p[i][1] + t * (p[i + 1][1] - p[i][1])
      }
    }
    return 1.0
  }

  function getSeries(v) {
    var vv = parseInt(v);
    if (!isFinite(vv) || vv <= 0) return 20;
    var m = {
      36: 10,
      48: 13,
      52: 14,
      60: 16,
      72: 20,
      84: 23,
      96: 26
    };
    if (m[vv]) return m[vv];
    var bs = 1,
      bd = Infinity;
    for (var S = 8; S <= 30; S++) {
      var n = S * 3.7;
      var d = Math.abs(n - vv);
      if (d < bd) {
        bd = d;
        bs = S
      }
    }
    return bs
  }

  function getAvgVoltage(v) {
    return +(getSeries(v) * 3.77).toFixed(1)
  }

  function getPeakVoltage(v) {
    return +(getSeries(v) * 4.2).toFixed(1)
  }

  function getLowVoltage(v) {
    return +(getSeries(v) * 3.46).toFixed(1)
  }

  function getCutoffVoltage(v) {
    return +(getSeries(v) * 3.0).toFixed(1)
  }

  function peukertK(c) {
    return (c === 'lg' || c === 'sk') ? 1.04 : 1.06
  }

  function cRate(I, ah) {
    return I / Math.max(ah, .1)
  }

  function cycLife(dod, T, cell) {
    cell = cell || 'sk';
    var rated = cell === 'sk' ? 2500 : (cell === 'lg' ? 800 : 500);
    var tf;
    if (T <= 25) tf = Math.exp(-Math.pow((25 - T) / 30, 2));
    else tf = Math.exp(-Math.pow((T - 25) / 20, 2));
    var dd = clamp(dod, 0.1, 1.0);
    var df = Math.pow(0.8 / Math.max(dd, 0.1), 0.8);
    return Math.round(rated * df * (0.7 + 0.3 * tf))
  }

  function calcBattPrice(v, ah, cell, smart, box, prices) {
    var S = getSeries(v);
    var cc, cp;
    if (cell === 'sk') {
      cc = prices.battery.cellCapSK;
      cp = prices.battery.cellSK
    } else if (cell === 'lg') {
      cc = prices.battery.cellCapLG;
      cp = prices.battery.cellLG
    } else {
      cc = prices.battery.cellCapChina;
      cp = prices.battery.cellChina
    }
    var P = Math.max(1, Math.ceil(ah / cc));
    var cnt = S * P,
      cc2 = cnt * cp;
    var bms;
    if (v >= 60) bms = prices.battery.bmsSmartHighV;
    else if (smart) bms = prices.battery.bmsSmart;
    else bms = prices.battery.bmsBasic;
    var chg = v >= 60 ? prices.battery.chargerHigh : prices.battery.chargerLow;
    var cs = box ? prices.battery.caseHailong : 0;
    // v23: работа считается по реально собранной ёмкости, а не по запрошенной —
    // иначе одна и та же сборка 1P 55 Ач стоила 116 или 121 тыс. в зависимости от того, что попросили.
    var builtAh = P * cc;
    var work = builtAh >= 100 ? prices.battery.workLarge : builtAh > 30 ? prices.battery.workMedium : prices.battery.workSmall;
    return {
      total: cc2 + bms + chg + work + cs,
      S: S,
      P: P,
      actualAh: +builtAh.toFixed(1),
      requestedAh: ah,
      cellCap: cc,
      cellCount: cnt
    }
  }

  function cellVoltageFromSOC(soc) {
    var pts = [
      [0.00, 3.00],
      [0.05, 3.35],
      [0.10, 3.50],
      [0.20, 3.60],
      [0.40, 3.75],
      [0.60, 3.85],
      [0.80, 3.95],
      [0.90, 4.05],
      [1.00, 4.20]
    ];
    soc = Math.max(0, Math.min(1, soc));
    for (var i = 0; i < pts.length - 1; i++) {
      if (soc >= pts[i][0] && soc <= pts[i + 1][0]) {
        var t = (soc - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
        return pts[i][1] + t * (pts[i + 1][1] - pts[i][1])
      }
    }
    return 4.20
  }

  function getMotorSpec(mt, mp, ex) {
    if (ex) {
      for (var i = 0; i < MOTOR_SPECS.length; i++) {
        if (MOTOR_SPECS[i].id === ex && MOTOR_SPECS[i].type === mt) return MOTOR_SPECS[i]
      }
    }
    var c = MOTOR_SPECS.filter(function(s) {
      return s.type === mt
    });
    if (!c.length) return null;
    c.sort(function(a, b) {
      return Math.abs(a.power - mp) - Math.abs(b.power - mp)
    });
    return c[0]
  }

  function getMotorSpecById(id) {
    for (var i = 0; i < MOTOR_SPECS.length; i++) {
      if (MOTOR_SPECS[i].id === id) return MOTOR_SPECS[i]
    }
    return null
  }

  function makeWindingBase(spec, type) {
    if (spec) return {
      baseKV: spec.baseKV,
      baseTurns: spec.baseTurns,
      ratio: spec.ratio,
      finalRatio: spec.finalRatio || 1,
      idleI: spec.idleI || 0.6,
      measuredKV: spec.measuredKV || null,
      measuredTurns: spec.measuredTurns || null,
      measuredRefV: spec.measuredRefV || null,
      measuredSrc: spec.measuredSrc || null
    };
    return (type === 'geared' || type === 'mid') ? {
      baseKV: 5.5,
      baseTurns: 14,
      ratio: 5,
      finalRatio: 1,
      idleI: 0.55,
      measuredKV: null
    } : {
      baseKV: 9.0,
      baseTurns: 5,
      ratio: 1,
      finalRatio: 1,
      idleI: 0.7,
      measuredKV: null
    }
  }

  function getDefaultTurns(t, w) {
    if (t === 'geared' || t === 'mid') {
      if (w <= 250) return 18;
      if (w <= 350) return 16;
      if (w <= 500) return 14;
      if (w <= 750) return 12;
      if (w <= 1000) return 10;
      return 9
    }
    return 5
  }

  function calcKV(wb, turns) {
    if (wb && wb.measuredKV && wb.measuredKV[turns] != null) return wb.measuredKV[turns];
    return wb.baseKV * (wb.baseTurns / Math.max(turns, 1))
  }

  function getKVSource(wb, turns) {
    if (!wb || !wb.measuredKV || wb.measuredKV[turns] == null) return 'model';
    if (wb.measuredTurns && wb.measuredTurns[turns]) return 'measured';
    return 'extrapolated'
  }

  function calcMotorRpm(wb, turns, V) {
    return calcKV(wb, turns) * V * wb.ratio
  }

  function estimateMotorPrice(t, p) {
    var perW;
    if (t === 'dd') {
      if (p <= 500) perW = 28;
      else if (p <= 1000) perW = 22;
      else if (p <= 1500) perW = 17;
      else if (p <= 2000) perW = 14;
      else if (p <= 3000) perW = 13;
      else if (p <= 5000) perW = 10;
      else perW = 8
    } else {
      if (p <= 250) perW = 62;
      else if (p <= 350) perW = 48;
      else if (p <= 500) perW = 36;
      else if (p <= 750) perW = 33;
      else if (p <= 1000) perW = 28;
      else if (p <= 1500) perW = 24;
      else if (p <= 2000) perW = 20;
      else perW = 16
    }
    return Math.min(Math.round(p * perW / 100) * 100, 300000)
  }

  function getMaxSpeedByPower(pW, mass, slope, crr, rho, CdA, hw) {
    var Fc = Fgrav(mass, slope) + Froll(mass, slope, crr) + Fbear(mass, slope);
    if (pW <= 0) return 0;
    var lo = .1,
      hi = 200;
    for (var i = 0; i < 70; i++) {
      var v = (lo + hi) / 2,
        va = v + hw;
      var F = Fc + .5 * rho * CdA * va * Math.abs(va);
      if (F * v > pW) hi = v;
      else lo = v
    }
    return ((lo + hi) / 2) * 3.6
  }

  function regenKPD(v) {
    return .40 + .40 * (clamp(v, 0, 90) / 90)
  }

  function regenEnergyPerStop(mass, vb, rc, vn, en) {
    if (!en || rc <= 0) return 0;
    var v = kmh2ms(vb);
    var ke = .5 * mass * v * v;
    var kpd = regenKPD(vb);
    var pw = rc * vn * .85;
    var dt = Math.min(ke / pw, 10);
    return Math.min(pw * dt / 3600, ke * kpd / 3600)
  }

  function autoV(p) {
    return p <= 500 ? 36 : p <= 1500 ? 48 : p <= 2500 ? 60 : 72
  }

  function ctrlEffFromPower(p, mt) {
    var b = p < 100 ? .92 : p < 500 ? .95 : p < 1500 ? .97 : .975;
    if (mt === 'dd') b -= .005;
    return b
  }

  function copperResistanceByPower(pNom, mt) {
    var P = Math.max(pNom, 100);
    if (mt === 'dd') return clamp(6.0 / Math.sqrt(P), 0.04, 0.8);
    if (mt === 'mid') return clamp(12.0 / Math.sqrt(P), 0.05, 1.5);
    return clamp(10.0 / Math.sqrt(P), 0.04, 1.5)
  }

  function calcMaxSpeedPhysical(S) {
    var kv = S.motorKV,
      fr = S.wb.finalRatio || 1,
      r = S.wheelRadius,
      Vb = S.voltage,
      mass = S.mass,
      slope = S.slope,
      crr = S.crr,
      rho = S.rho,
      CdA = S.CdA,
      hw = S.headwind,
      mt = S.motorType,
      fw = !!S.fwEnabled;
    var boost = fw ? 1.5 : 1.0,
      kvw = kv * fr * boost,
      Ke = 2 * Math.PI * kvw / 60,
      Rp = copperResistanceByPower(S.motorNom || 1000, mt),
      Rb = (mt === 'dd') ? (Rp / 3) : (Rp * 0.5);
    Rb = clamp(Rb, 0.005, 0.8);
    var effB = mt === 'dd' ? 0.89 : 0.84;
    if (fw) effB *= fwLossFactor(true);
    var Ilim = Math.max(S.effectiveCurrentLimit, 1),
      vMaxRaw = ms2kmh(kvw * Vb * 2 * Math.PI * r / 60),
      lo = .1,
      hi = 260;
    for (var i = 0; i < 60; i++) {
      var vk = (lo + hi) / 2,
        vm = kmh2ms(vk),
        Fa = aeroForceCdA(rho, CdA, vm, hw),
        Ft = (mt === 'dd' ? 0 : (Froll(mass, slope, crr) + Fbear(mass, slope)) * 0.02) + (S.coolingDragW || 0) / Math.max(vm, 0.5),
        F = Fgrav(mass, slope) + Froll(mass, slope, crr) + Fbear(mass, slope) + Fa + Ft,
        Pe = F * vm / Math.max(effB, 0.4),
        Ib = Pe / Math.max(Vb, 1);
      if (Ib > Ilim) Ib = Ilim;
      var Vw = Math.max(Vb - Ib * Rb, 0),
        vmk = ms2kmh(Vw * Ke * r);
      if (vmk > vk) lo = vk;
      else hi = vk
    }
    var vMaxW = (lo + hi) / 2,
      Pel = Vb * Ilim * S.ctrlEff,
      ep = motorEff(Pel, S.motorNom, mt);
    if (S.effMult != null) ep *= S.effMult;
    if (fw) ep *= fwLossFactor(true);
    if (ep > 0.95) ep = 0.95;
    var Pw = Pel * ep;
    var vMaxP = getMaxSpeedByPower(Pw, mass, slope, crr, rho, CdA, hw),
      vMax = Math.min(vMaxW, vMaxP);
    if (fw) {
      var noFw = {
        motorKV: kv,
        wb: S.wb,
        motorTurns: S.motorTurns,
        wheelRadius: r,
        voltage: Vb,
        mass: mass,
        slope: slope,
        crr: crr,
        rho: rho,
        CdA: CdA,
        headwind: hw,
        motorType: mt,
        fwEnabled: false,
        coolingDragW: S.coolingDragW || 0,
        effectiveCurrentLimit: S.effectiveCurrentLimit,
        motorNom: S.motorNom,
        ctrlEff: S.ctrlEff,
        effMult: S.effMult
      };
      var rNo = calcMaxSpeedPhysical(noFw);
      if (rNo.vMax > vMax) {
        if (typeof console !== 'undefined') console.warn('[FW-GUARD] vMax_fw=' + vMax.toFixed(2) + ' < vMax_noFw=' + rNo.vMax.toFixed(2));
        vMax = rNo.vMax
      }
    }
    return {
      vMaxByWindingRaw: vMaxRaw,
      vMaxByWinding: vMaxW,
      vMaxByPower: vMaxP,
      vMax: vMax,
      limiter: vMaxW < vMaxP ? 'ПО ВИТКАМ' : 'ПО МОЩНОСТИ'
    }
  }

  function computeVoltageMetrics(S, V) {
    var Imax = Math.min(S.ctrlCurrentLimit, S.battMaxA),
      Pc = V * Imax * S.ctrlEff,
      Pm = Pc,
      op = Pm > S.motorPassportPeak,
      eM = motorEff(Pm, S.motorNom, S.motorType);
    if (S.fwEnabled) eM *= fwLossFactor(true);
    var Pw = Pm * eM;
    var tmp = {};
    for (var k in S) tmp[k] = S[k];
    tmp.voltage = V;
    var phys = calcMaxSpeedPhysical(tmp),
      hL = Pm * (1 - eM),
      lim;
    if (S.battMaxA < S.ctrlCurrentLimit - .5) lim = 'BMS';
    else if (S.ctrlCurrentLimit < S.battMaxA - .5) lim = 'КОНТР';
    else lim = '—';
    if (op) lim = (lim === '—' ? '' : '+') + 'ПЕРЕГР';
    var anchorRpm = calcMotorRpm(S.wb, S.motorTurns, V);
    return {
      voltage: V,
      ctrlMaxPower: Pc,
      pMotor: Pm,
      overPeak: op,
      currentPeak: Pm / (V * S.ctrlEff),
      currentLimitedBy: lim,
      effM_actual: eM,
      powerToWheel: Pw,
      vNoLoad: phys.vMaxByWindingRaw,
      vLoadNoFw: phys.vMaxByWinding,
      vMaxByPower: phys.vMaxByPower,
      vMax: phys.vMax,
      vMaxLimiter: phys.limiter,
      motorRpmNoLoad: anchorRpm,
      rpm: S.rpm,
      torque: motorTorque(Pw, anchorRpm),
      heatLoss: hL
    }
  }

  function estimatePhaseCurrent(ib, vk, vMaxNoLoad, pl, sk) {
    sk = sk == null ? 0.80 : sk;
    if (vMaxNoLoad <= 1) return Math.min(ib * 6, pl);
    var ve = Math.max(vk, 4),
      sr = clamp(ve / vMaxNoLoad, 0.1, 1.0),
      mult = 1.15 + 4.4 * Math.pow(1 - sr, 1.35);
    return Math.min(ib * mult * sk, pl)
  }

  function classifyWeather(w) {
    if (!w) return 'clear';
    var d = (w.desc || '').toLowerCase();
    var p = w.precipMM || 0;
    if (d.match(/ice|freezing|hail|гололёд|лед/)) return 'ice';
    if (d.match(/snow|blizzard|sleet|снег/)) return 'snow';
    if (d.match(/thunder|storm|гроза/)) return 'thunder';
    if (d.match(/fog|mist|туман/)) return 'fog';
    if (p > 5) return 'rainHeavy';
    if (p > 1) return 'rainMedium';
    if (p > 0.1) return 'rainLight';
    return 'clear'
  }

  function parseTimeStr(s) {
    if (!s) return null;
    var m = String(s).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!m) return null;
    var h = parseInt(m[1], 10),
      mn = parseInt(m[2], 10);
    if (!isFinite(h) || !isFinite(mn)) return null;
    var ampm = (m[3] || '').toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h + mn / 60
  }

  // v23: ночью батарея не становится на 15% хуже. Единственное, что реально
  // добавляется в темноте, — фары и габариты: ~12 Вт ночью, ~6 Вт в сумерках.
  // Возвращаем мощность света (lightsW); energy оставлен =1 для совместимости.
  function getNightFactor(sunrise, sunset, when) {
    var now = when || new Date();
    var h = now.getHours() + now.getMinutes() / 60;
    var sr = parseTimeStr(sunrise),
      ss = parseTimeStr(sunset);
    var label;
    if (sr != null && ss != null && sr < ss) {
      var twi = 0.5;
      if (h >= ss + twi || h < sr - twi) label = 'ночь';
      else if (h >= ss - twi || h < sr + twi) label = 'сумерки';
      else label = 'день'
    } else {
      if (h >= 21 || h < 6) label = 'ночь';
      else if (h >= 19 || h < 7) label = 'сумерки';
      else label = 'день'
    }
    return {
      energy: 1.0,
      lightsW: label === 'ночь' ? 12 : (label === 'сумерки' ? 6 : 0),
      label: label === 'день' ? 'день' : label + ' (фары)'
    }
  }

  function whKmAtSpeed(vKmh, slopePct, S) {
    if (vKmh <= 0.5) return Math.max(S.whKmCr * 0.5, 5);
    var vms = vKmh / 3.6,
      ang = Math.atan(slopePct / 100);
    var Fa = 0.5 * S.rho * S.CdA * (vms + S.headwind) * Math.abs(vms + S.headwind);
    var Fr = S.mass * 9.81 * Math.cos(ang) * S.crr;
    var Fg = S.mass * 9.81 * Math.sin(ang);
    var Ftot = Fa + Fr + Fg + S.fBearing;
    var lightsWhKm = (S.lightsW || 0) / vKmh;
    if (Ftot < 0) {
      if (S.regenEnabled) {
        var P_regen = Ftot * vms;
        return Math.max(P_regen * 0.6 / vKmh, -8) + lightsWhKm
      }
      return lightsWhKm
    }
    // v23: педали учитываются и в пошаговом расчёте по маршруту (раньше только в общем).
    var P_wheel = Math.max(0, Ftot * vms - (S.riderWheelAssist || 0));
    if (P_wheel <= 0) return Math.max(lightsWhKm, 0);
    var heatDerate = 1 - Math.min(0.10, Math.max(0, (S.windingTemp - 100) / 500));
    var _effM_seg = motorEff(P_wheel, S.motorNom || 1000, S.motorType || 'dd') * (S.effMult || 1);
    if (S.fwEnabled) _effM_seg *= fwLossFactor(true);
    if (_effM_seg > 0.95) _effM_seg = 0.95;
    var P_batt = P_wheel / Math.max(S.ctrlEff * _effM_seg * heatDerate, 0.30);
    return Math.max(P_batt / vKmh, 2) + lightsWhKm
  }

  function detectCurvature(latlngs) {
    var N = latlngs.length,
      curv = new Array(N).fill(0);
    for (var i = 1; i < N - 1; i++) {
      var p0 = latlngs[i - 1],
        p1 = latlngs[i],
        p2 = latlngs[i + 1];
      var b01 = bearingDeg(p0, p1),
        b12 = bearingDeg(p1, p2);
      var dA = Math.abs(angleDiffLocal(b01, b12));
      if (dA < 12) continue;
      var d01 = haversineLocal(p0, p1),
        d12 = haversineLocal(p1, p2);
      var dAvg = (d01 + d12) / 2;
      if (dAvg < 6) continue;
      var R = Math.max(dAvg / (2 * Math.sin(dA * Math.PI / 360)), 10);
      curv[i] = 1 / R
    }
    var smoothed = new Array(N).fill(0);
    for (var i = 0; i < N; i++) {
      var win = [];
      for (var k = -2; k <= 2; k++) {
        var idx = i + k;
        if (idx >= 0 && idx < N) win.push(curv[idx])
      }
      win.sort(function(a, b) {
        return a - b
      });
      smoothed[i] = win.length ? win[Math.floor(win.length / 2)] : 0
    }
    return smoothed
  }
  /*patch_styles_v1*/
  // v23: жилая зона по ПДД — 20 км/ч в любом стиле; у школ не быстрее 40 даже на racing.
  var STYLE_LIMITS = {
    calm: {
      ts: 20,
      cr: 18,
      cs: 15,
      tc: 12,
      rnd: 18,
      live: 20,
      school: 25,
      hosp: 0,
      rCurve: 0.70
    },
    moderate: {
      ts: 25,
      cr: 22,
      cs: 18,
      tc: 15,
      rnd: 20,
      live: 20,
      school: 28,
      hosp: 0,
      rCurve: 0.85
    },
    normal: {
      ts: 35,
      cr: 30,
      cs: 25,
      tc: 20,
      rnd: 25,
      live: 20,
      school: 35,
      hosp: 0,
      rCurve: 1.00
    },
    confident: {
      ts: 40,
      cr: 35,
      cs: 30,
      tc: 25,
      rnd: 30,
      live: 20,
      school: 40,
      hosp: 0,
      rCurve: 1.10
    },
    aggressive: {
      ts: 45,
      cr: 40,
      cs: 35,
      tc: 30,
      rnd: 35,
      live: 20,
      school: 40,
      hosp: 0,
      rCurve: 1.20
    },
    extreme: {
      ts: 55,
      cr: 50,
      cs: 45,
      tc: 40,
      rnd: 45,
      live: 20,
      school: 40,
      hosp: 0,
      rCurve: 1.35
    },
    racing: {
      ts: 65,
      cr: 60,
      cs: 55,
      tc: 50,
      rnd: 55,
      live: 20,
      school: 40,
      hosp: 0,
      rCurve: 1.50
    }
  };
  var _currentStyleLimits = STYLE_LIMITS.normal;
  var _currentStyleCurveMult = 1.0;

  function setStyleContext(k) {
    _currentStyleLimits = STYLE_LIMITS[k] || STYLE_LIMITS.normal;
    _currentStyleCurveMult = _currentStyleLimits.rCurve || 1.0
  }

  function curvatureToSpeed(curv) {
    if (!curv || curv <= 0.001) return Infinity;
    var R = 1 / curv,
      _m = _currentStyleCurveMult || 1;
    if (R < 12) return 15 * _m;
    if (R < 20) return 28 * _m;
    if (R < 30) return 38 * _m;
    if (R < 50) return 48 * _m;
    if (R < 80) return 55 * _m;
    if (R < 130) return 62 * _m;
    return Infinity;
  }

  function descentToSpeed(slopePct) {
    if (slopePct >= -5) return Infinity;
    if (slopePct >= -10) return 55;
    if (slopePct >= -15) return 45;
    if (slopePct >= -20) return 30;
    return 20
  }

  function ascentToSpeed(slopePct) {
    if (slopePct <= 8) return Infinity;
    if (slopePct <= 12) return 40;
    if (slopePct <= 18) return 30;
    return 22
  }

  function buildRestrictionZones(signals, samples) {
    var zones = [];
    if (!signals || !signals.length || !samples || !samples.length) return zones;
    var radii = {
      traffic_signals: 40,
      crossing: 15,
      crossing_signal: 15,
      traffic_calming: 20,
      roundabout: 30,
      living_street: 100,
      school: 120,
      hospital: 150,
      maxspeed: 10
    };
    signals.forEach(function(sig) {
      var vLimit = 0; /*patch_signals_v2*/
      var _L = _currentStyleLimits;
      if (sig.type === 'traffic_signals') vLimit = _L.ts;
      else if (sig.type === 'crossing') vLimit = _L.cr;
      else if (sig.type === 'crossing_signal') vLimit = _L.cs;
      else if (sig.type === 'traffic_calming') vLimit = _L.tc;
      else if (sig.type === 'school') vLimit = _L.school;
      else if (sig.type === 'hospital') vLimit = _L.hosp;
      else if (sig.type === 'living_street') vLimit = _L.live;
      else if (sig.type === 'roundabout') vLimit = _L.rnd;
      else if (sig.type === 'maxspeed' && sig.v) vLimit = sig.v;
      if (vLimit <= 0) return;
      var r = radii[sig.type] || 30;
      // v23: зона ставится на КАЖДЫЙ проезд мимо объекта. Раньше бралась только
      // первая встреча, и на обратном пути «туда-обратно» светофоров не было
      // (136 ограничений туда против 2 обратно).
      var runStart = -1,
        runEnd = -1;

      function flush() {
        if (runStart < 0) return;
        var e = Math.min(runEnd, runStart + 4);
        zones.push({
          startIdx: Math.max(0, runStart - 1),
          endIdx: Math.min(samples.length - 1, e + 1),
          type: sig.type,
          vLimit: vLimit,
          dist: samples[runStart].dist
        });
        runStart = -1;
        runEnd = -1
      }
      for (var i = 0; i < samples.length; i++) {
        var d = haversineLocal([sig.lat, sig.lng], [samples[i].lat, samples[i].lng]);
        if (d <= r) {
          if (runStart < 0) runStart = i;
          runEnd = i
        } else if (runStart >= 0 && i - runEnd > 2) flush()
      }
      flush()
    });
    zones.forEach(function(z, k) {
      z.id = k
    });
    return zones
  }

  // Вероятность остановиться у объекта (полная остановка и разгон заново).
  var STOP_PROB = {
    traffic_signals: 0.5,
    crossing_signal: 0.4,
    crossing: 0.15
  };

  function getZoneAt(samples, zones, i) {
    var best = null;
    for (var k = 0; k < zones.length; k++) {
      if (i >= zones[k].startIdx && i <= zones[k].endIdx) {
        if (!best || zones[k].vLimit < best.vLimit) best = zones[k]
      }
    }
    return best
  }

  function findSegmentAtDist(segments, dist) {
    if (!segments || !segments.length) return null;
    for (var i = 0; i < segments.length; i++) {
      if (dist >= segments[i].distStart && dist <= segments[i].distEnd) return segments[i]
    }
    return null
  }

  function computeVmaxProfileByRoute(cfg, S, samples, opts) {
    opts = opts || {};
    var style = RIDE_STYLES[cfg.rideStyle] || RIDE_STYLES.normal;
    var roundTrip = !!opts.roundTrip;
    var signals = opts.signals || [];
    var roadSegments = opts.roadSegments || [];
    var applyWeather = opts.applyWeather !== false;
    var hardCap = !!opts.hardWeatherCap;
    if (!samples || samples.length < 2) return null;
    var weatherKey = classifyWeather(opts.weather);
    var weatherDesc = (opts.weather && opts.weather.desc) || '';
    var wEnergyF = applyWeather ? (WEATHER_ENERGY[weatherKey] || 1.0) : 1.0;
    var nightObj = getNightFactor(opts.sunrise, opts.sunset);
    var nEnergyF = 1.0;
    var lightsW = applyWeather ? nightObj.lightsW : 0;
    var hasWind = isFinite(opts.windMs) && isFinite(opts.windDir);
    var vTargetNoCap;
    if (IS_V22) {
      vTargetNoCap = style.vBase
    } else {
      var cityCycleMult = Math.max(cfg.cityCycle || 1.0, 1.0);
      vTargetNoCap = style.vBase * cityCycleMult
    }
    if (cfg.useSpeedProfile && cfg.mMaxSpeed > 0) vTargetNoCap = cfg.mMaxSpeed;
    var vTargetCruise = vTargetNoCap;
    if (applyWeather && hardCap) {
      var wCap = weatherKey === 'ice' ? 15 : weatherKey === 'snow' ? 25 : weatherKey === 'thunder' ? 30 : weatherKey === 'fog' ? 35 : weatherKey === 'rainHeavy' ? 45 : weatherKey === 'rainMedium' ? 60 : weatherKey === 'rainLight' ? 75 : vTargetCruise;
      vTargetCruise = Math.min(vTargetCruise, wCap)
    }
    var hardCapActive = hardCap && vTargetCruise < vTargetNoCap;
    var fullSamples;
    if (roundTrip) {
      var ow = samples[samples.length - 1].dist;
      fullSamples = [];
      for (var k = 0; k < samples.length; k++) fullSamples.push({
        dist: samples[k].dist,
        elev: samples[k].elev,
        lat: samples[k].lat,
        lng: samples[k].lng
      });
      for (var k = samples.length - 1; k >= 0; k--) fullSamples.push({
        dist: ow + (ow - samples[k].dist),
        elev: samples[k].elev,
        lat: samples[k].lat,
        lng: samples[k].lng
      })
    } else fullSamples = samples;
    var fullLatLngs = fullSamples.map(function(s) {
      return [s.lat, s.lng]
    });
    var curv = detectCurvature(fullLatLngs);
    setStyleContext(cfg.rideStyle);
    var zones = buildRestrictionZones(signals, fullSamples);
    var usableWh = Math.max(S.usableWh, 1),
      series = getSeries(S.voltageNom),
      soc = 1.0,
      segments = [];
    var prevDist = fullSamples[0].dist,
      prevElev = fullSamples[0].elev,
      vMinVolt = series * 3.0,
      reachedEnd = true;
    var oneWaySplit = roundTrip ? samples[samples.length - 1].dist : null;
    var prevVRide = 3;
    var totalKE_loss = 0,
      totalTimeH = 0,
      totalRegenWh = 0,
      totalUsedWh = 0,
      stopSeen = {},
      expStops = 0,
      stopWaitH = 0;
    var limitCount = {
      road: 0,
      curve: 0,
      signal: 0,
      phys: 0,
      style: 0
    };
    var windingTemp = (S.temp != null ? S.temp : 20);
    var windingTempStart = windingTemp;
    var G_th = (S.G_thermal_eff != null ? S.G_thermal_eff : thermalGByPower(S.motorNom));
    var C_th = (S.C_thermal_eff != null ? S.C_thermal_eff : (thermalCapacityByPower(S.motorNom) * 1.0));
    var T_ambient = (S.temp != null ? S.temp : 20);
    var minTimeToOverheatS = Infinity,
      heatWarn = false,
      heatCutoffDist = -1,
      windingTempMax = windingTemp;
    for (var i = 1; i < fullSamples.length; i++) {
      var s = fullSamples[i],
        segLenM = s.dist - prevDist;
      if (segLenM <= 0) {
        prevDist = s.dist;
        prevElev = s.elev;
        continue
      }
      var segKm = segLenM / 1000;
      var slope_i = (segLenM > 0.5) ? ((s.elev - prevElev) / segLenM) * 100 : 0;
      var isReturn = roundTrip && s.dist > oneWaySplit;
      var V_oc = series * cellVoltageFromSOC(soc);
      var V_load = Math.max(V_oc - S.effectiveCurrentLimit * S.Rint, vMinVolt);
      // v23: встречный ветер считается по направлению КАЖДОГО участка, а не по
      // прямой «первая точка → последняя». Для круга A→…→A прямая вырождается,
      // и запас скакал 77/219 км в зависимости от того, где поставить старт.
      var eHW;
      if (hasWind) {
        var segBearing = bearingDeg([fullSamples[i - 1].lat, fullSamples[i - 1].lng], [s.lat, s.lng]);
        var segGeo = haversineLocal([fullSamples[i - 1].lat, fullSamples[i - 1].lng], [s.lat, s.lng]);
        eHW = segGeo > 0.5 ? opts.windMs * Math.cos(angleDiffLocal(opts.windDir, segBearing) * Math.PI / 180) : (segments.length ? segments[segments.length - 1].headwind : 0)
      } else eHW = isReturn ? -S.headwind : S.headwind;
      var tmpS = {};
      for (var k2 in S) tmpS[k2] = S[k2];
      tmpS.voltage = V_load;
      tmpS.slope = slope_i;
      tmpS.headwind = eHW;
      var phys = calcMaxSpeedPhysical(tmpS);
      var vPhys = phys.vMax;
      var vCurve = curvatureToSpeed(curv[i] || 0);
      var vDescent = descentToSpeed(slope_i);
      var vAscent = ascentToSpeed(slope_i);
      var vRoad = Infinity,
        roadName = '';
      if (roadSegments.length) {
        var _owDist = samples[samples.length - 1].dist;
        var _distForRoad = isReturn ? (_owDist - (s.dist - _owDist)) : s.dist;
        var seg = findSegmentAtDist(roadSegments, _distForRoad);
        if (seg && seg.roadClass) {
          vRoad = ROAD_CLASS_SPEED[seg.roadClass] || Infinity;
          roadName = seg.roadClass
        }
      }
      var zone = getZoneAt(fullSamples, zones, i);
      var vZone = Infinity,
        zoneName = '';
      if (zone) {
        vZone = zone.vLimit;
        zoneName = {
          traffic_signals: 'светофор',
          crossing: 'переход',
          traffic_calming: 'лежачий',
          roundabout: 'круговое',
          living_street: 'жилая зона',
          school: 'школа',
          maxspeed: 'знак'
        } [zone.type] || zone.type
      }
      var vRide = Math.min(vTargetCruise, vPhys, phys.vMaxByPower, vCurve, vDescent, vAscent, vRoad, vZone);
      if (vRide < 3) vRide = 3;
      var reason = '',
        reasonSpeed = Infinity;
      var cands = [{
        name: 'мотор',
        v: vPhys
      }, {
        name: 'поворот R=' + Math.round(1 / Math.max(curv[i] || 0.001, 0.001)) + 'м',
        v: vCurve
      }, {
        name: 'спуск ' + slope_i.toFixed(1) + '%',
        v: vDescent
      }, {
        name: 'подъём ' + slope_i.toFixed(1) + '%',
        v: vAscent
      }, {
        name: 'дорога ' + (roadName || '?'),
        v: vRoad
      }, {
        name: zoneName,
        v: vZone
      }, {
        name: 'стиль',
        v: vTargetCruise
      }];
      cands.forEach(function(c) {
        if (c.v < reasonSpeed) {
          reasonSpeed = c.v;
          reason = c.name
        }
      });
      if (vRide >= vTargetCruise - 0.5) {
        limitCount.style++
      } else if (vRoad <= vRide) limitCount.road++;
      else if (vCurve <= vRide) limitCount.curve++;
      else if (vZone <= vRide) limitCount.signal++;
      else if (vPhys <= vRide) limitCount.phys++;
      var tmpS2 = {};
      for (var k3 in S) tmpS2[k3] = S[k3];
      tmpS2.headwind = eHW;
      tmpS2.windingTemp = windingTemp;
      tmpS2.lightsW = lightsW;
      var whCrew = whKmAtSpeed(vRide, slope_i, tmpS2);
      var rcR = (S.regenCurrent != null && S.regenCurrent >= 0) ? S.regenCurrent : 20;
      var rrR = S.regenEnabled ? clamp(rcR / 40 * 0.5, 0.1, 0.35) : 0;
      var dKE_Wh = 0,
        _dVsq = Math.pow(vRide / 3.6, 2) - Math.pow(prevVRide / 3.6, 2);
      if (_dVsq > 0.001) {
        dKE_Wh = 0.5 * S.mass * _dVsq / 3600 / Math.max(S.ctrlEff * S.effM_cr, 0.5)
      } else if (_dVsq < -0.001 && S.regenEnabled) {
        dKE_Wh = 0.5 * S.mass * _dVsq / 3600 * rrR
      }
      // v23: светофор — это не «притормозить с 36 до 35», а с вероятностью ~50%
      // полная остановка, стоянка и разгон заново. Считаем ожидаемую энергию разгона.
      if (zone && STOP_PROB[zone.type] && !stopSeen[zone.id]) {
        stopSeen[zone.id] = true;
        var pStop = STOP_PROB[zone.type];
        var vApproach = Math.max(vRide, 5) / 3.6;
        var keStop = 0.5 * S.mass * vApproach * vApproach / 3600;
        dKE_Wh += pStop * keStop * (1 / Math.max(S.ctrlEff * S.effM_cr, 0.5) - rrR);
        expStops += pStop;
        stopWaitH += pStop * 25 / 3600
      }
      var dKE_perKm = dKE_Wh / Math.max(segKm, 0.001);
      totalKE_loss += dKE_Wh;
      var whSeg = whCrew + dKE_perKm;
      if (whSeg < 0) {
        var regenWh = -whSeg * segKm;
        totalRegenWh += regenWh;
        soc = Math.min(1, soc + regenWh / usableWh);
        whSeg = 0
      } else {
        whSeg *= wEnergyF
      }
      var dE = whSeg * segKm;
      totalUsedWh += dE;
      soc = soc - dE / usableWh;
      var cutOff = soc < 0.03;
      soc = Math.max(0.03, soc);
      var _vPrev = kmh2ms(prevVRide || 0),
        _vCur = kmh2ms(vRide);
      var _accelT = Math.abs(_vCur - _vPrev) / Math.max(vRide >= prevVRide ? 2 : 3, 0.5);
      var timeH = segKm / Math.max(vRide, 3) + _accelT / 3600;
      totalTimeH += timeH;
      var P_batt_W_th = Math.max(0, whSeg) * vRide;
      var P_motor_in_th = Math.max(0, P_batt_W_th * S.ctrlEff);
      var _cuR = 1 + 0.002 * Math.max(0, windingTemp - 20);
      var P_heat_th = P_motor_in_th * (1 - S.effM_cr) * _cuR + (S.idleLossW || 0);
      var segTimeS = timeH * 3600;
      var dTw = (P_heat_th - G_th * (windingTemp - T_ambient)) / Math.max(C_th, 1) * segTimeS;
      var timeToOverheat_s = (windingTemp >= 120) ? 0 : calcTimeToOverheat(P_heat_th, G_th, C_th, T_ambient, 120);
      if (timeToOverheat_s < minTimeToOverheatS) minTimeToOverheatS = timeToOverheat_s;
      windingTemp += dTw;
      if (windingTemp > 180) windingTemp = 180;
      if (windingTemp > windingTempMax) windingTempMax = windingTemp;
      if (windingTemp >= 120 && !heatWarn) {
        heatWarn = true;
        heatCutoffDist = s.dist
      }
      segments.push({
        dist: s.dist,
        segLen: segLenM,
        elev: s.elev,
        slope: slope_i,
        soc: soc,
        voltage: V_oc,
        vLoad: V_load,
        vMax: vPhys,
        vRide: vRide,
        vMaxPwr: phys.vMaxByPower,
        vRoad: vRoad,
        vZone: vZone,
        roadName: roadName,
        zoneName: zoneName,
        vCurve: vCurve,
        vDescent: vDescent,
        vAscent: vAscent,
        whKm: whSeg,
        headwind: eHW,
        cutOff: cutOff,
        lat: s.lat,
        lng: s.lng,
        onReturn: isReturn,
        curv: curv[i] || 0,
        limitReason: reason,
        isSignal: zone && zone.type === 'traffic_signals',
        dKE_Wh: dKE_Wh,
        whCrew: whCrew,
        timeH: timeH,
        windingTemp: windingTemp,
        timeToOverheatS: timeToOverheat_s,
        heatWarn: windingTemp >= 120
      });
      prevDist = s.dist;
      prevElev = s.elev;
      prevVRide = vRide;
      if (cutOff) {
        reachedEnd = false;
        break
      }
    }
    if (!segments.length) return null;
    var vMaxStart = segments[0].vMax,
      vMaxEnd = segments[segments.length - 1].vMax;
    var vRideStart = segments[0].vRide,
      vRideEnd = segments[segments.length - 1].vRide;
    var vMaxMin = Infinity,
      vMaxMax = -Infinity,
      vRideMin = Infinity,
      vMaxWeighted = 0,
      vRideWeighted = 0,
      whKmW = 0,
      totalLen = 0;
    var distToCutoff = !reachedEnd ? segments[segments.length - 1].dist : -1;
    segments.forEach(function(sg) {
      if (sg.vMax < vMaxMin) vMaxMin = sg.vMax;
      if (sg.vMax > vMaxMax) vMaxMax = sg.vMax;
      if (sg.vRide < vRideMin) vRideMin = sg.vRide;
      vMaxWeighted += sg.vMax * sg.segLen;
      vRideWeighted += sg.vRide * sg.segLen;
      whKmW += sg.whKm * sg.segLen;
      totalLen += sg.segLen
    });
    vMaxWeighted = totalLen > 0 ? vMaxWeighted / totalLen : vMaxStart;
    vRideWeighted = totalLen > 0 ? vRideWeighted / totalLen : vRideStart;
    // v23: расход маршрута = потрачено минус возвращено рекуперацией, на пройденный км.
    // Раньше рекуперация меняла SOC, но запас по маршруту оставался тем же.
    whKmW = totalLen > 0 ? Math.max(0.5, (totalUsedWh - totalRegenWh) / (totalLen / 1000)) : S.whKmCr;
    var oneWayDist = samples[samples.length - 1].dist;
    var fullDist = roundTrip ? 2 * oneWayDist : oneWayDist;
    totalTimeH += stopWaitH;
    // v23: средняя скорость по реально пройденному пути (при севшей батарее было 357 км/ч).
    var avgSpeedRoute = totalTimeH > 0 ? (totalLen / 1000) / totalTimeH : vRideWeighted;
    var vRideMinReason = '';
    for (var si = 0; si < segments.length; si++) {
      if (Math.abs(segments[si].vRide - vRideMin) < 0.1) {
        var r = segments[si].limitReason || '';
        if (r === 'стиль') {
          if (hardCapActive) {
            r = weatherKey + ' cap (' + vTargetNoCap.toFixed(0) + '→' + vTargetCruise.toFixed(0) + ')'
          } else if (cfg.useSpeedProfile) {
            r = 'явная скорость ' + vTargetNoCap.toFixed(0)
          } else {
            r = 'стиль ' + vTargetNoCap.toFixed(0)
          }
        }
        vRideMinReason = r;
        break
      }
    }
    var nCurves = 0;
    segments.forEach(function(sg) {
      if (sg.curv > 0.001) nCurves++
    });
    // v23: светофоры считаются по проездам (туда и обратно — два раза).
    var _nTS = zones.filter(function(z) {
      return z.type === 'traffic_signals'
    }).length;
    return {
      segments: segments,
      nTrafficSignals: _nTS,
      nTrafficStops: expStops,
      stopTimeH: stopWaitH,
      lightsW: lightsW,
      perSegmentWind: hasWind,
      vMaxStart: vMaxStart,
      vMaxEnd: vMaxEnd,
      vMaxMin: vMaxMin,
      vMaxMax: vMaxMax,
      vMaxWeighted: vMaxWeighted,
      vRideStart: vRideStart,
      vRideEnd: vRideEnd,
      vRideMin: vRideMin,
      vRideMinReason: vRideMinReason,
      nCurves: nCurves,
      vRideWeighted: vRideWeighted,
      vMaxEff: vMaxWeighted,
      socAtEnd: segments[segments.length - 1].soc,
      whKmRoute: whKmW,
      distToCutoff: distToCutoff,
      reachedEnd: reachedEnd,
      totalDist: fullDist,
      oneWayDist: oneWayDist,
      roundTrip: roundTrip,
      series: series,
      weatherKey: weatherKey,
      weatherDesc: weatherDesc,
      weatherEnergyF: wEnergyF,
      nightEnergyF: nEnergyF,
      nightObjLabel: nightObj.label,
      nSignals: zones.length,
      styleKey: cfg.rideStyle,
      styleName: style.name,
      styleVBase: style.vBase,
      styleEnergyMult: style.energyMult,
      totalKE_loss: totalKE_loss,
      totalRegenWh: totalRegenWh,
      totalTimeH: totalTimeH,
      avgSpeedRoute: avgSpeedRoute,
      hardCap: hardCap,
      hardCapActive: hardCapActive,
      applyWeather: applyWeather,
      vTargetNoCap: vTargetNoCap,
      vTargetCruise: vTargetCruise,
      limitCount: limitCount,
      nRoadSegments: roadSegments.length,
      windingTempStart: windingTempStart,
      windingTempMax: windingTempMax,
      windingTempAtEnd: windingTemp,
      timeToOverheatS: minTimeToOverheatS,
      heatWarn: heatWarn,
      heatCutoffDist: heatCutoffDist
    };
  }

  function compute(cfg, profile) {
    var prof = profile || PROFILE_MULT.avg,
      style = RIDE_STYLES[cfg.rideStyle] || RIDE_STYLES.normal;
    var prices = deepCopy(DEF_PRICES),
      fp = FRAME_PROPS[cfg.frameType] || FRAME_PROPS.regular,
      r17 = R17_PROPS[cfg.tireR17] || R17_PROPS.street;
    var totalMass = cfg.bikeMass + cfg.riderMass + cfg.cargoMass + fp.massExtra,
      trackSpeed = cfg.trackSpeed || 85,
      citySpeedMax = cfg.citySpeedMax || 70,
      citySpeedMin = cfg.citySpeedMin || 10;
    var trackPct = clamp(cfg.trackPct || 0, 0, 100),
      cityPct = 100 - trackPct,
      cityCycle = cfg.cityCycle;
    var vStyleAvg = style.vBase;
    var vWorkSpeed;
    if (IS_V22) {
      vWorkSpeed = vStyleAvg
    } else {
      vWorkSpeed = vStyleAvg * Math.max(cityCycle, 1.0)
    }
    if (cfg.useSpeedProfile && cfg.mMaxSpeed > 0) vWorkSpeed = cfg.mMaxSpeed;
    var speed = vWorkSpeed,
      v = kmh2ms(speed),
      temp = clamp(isFinite(cfg.ambientTemp) ? cfg.ambientTemp : 20, -40, 45),
      slope = cfg.slope,
      headwind = cfg.headwind;
    var tariff = clamp(isFinite(cfg.tariff) ? cfg.tariff : 3.20, 0, 50),
      fuelPrice = clamp(isFinite(cfg.fuelPrice) ? cfg.fuelPrice : 60, 0, 200),
      fuelRate = clamp(isFinite(cfg.fuelRate) ? cfg.fuelRate : 3, 0, 20),
      yearKm = Math.max(500, cfg.yearKm || 3200);
    var winterAuto = temp <= WINTER_THRESHOLD_C,
      winterManual = !!cfg.winterMode,
      winterActive = winterAuto || winterManual,
      chargeBlocked = winterActive && temp < 0;
    var rho = airDensity(temp, FIXED_ALT, FIXED_HUM),
      wheelRadius = getWR(cfg.wheelSize),
      bikeClass = cfg.frameType === 'space' ? 'fat' : 'mountain';
    var A = frontalArea(bikeClass, cfg.posture, cfg.riderMass),
      Cd = dragCoef(cfg.posture, bikeClass),
      CdA = Cd * A;
    if (cfg.frameType === 'space') CdA = CdA * fp.cdaMult + r17.cdaExtra;
    CdA *= prof.cdaMult;
    var crrB = crrBase(cfg.tire);
    if (cfg.frameType === 'space') crrB = r17.crr * (crrBase(cfg.tire) / crrBase('city'));
    var crr = crrB * crrSurf(cfg.surface) * crrPress(cfg.pressure) * crrTemp(temp) * crrSpeed(speed) * prof.crrMult;
    var N = Nforce(totalMass, slope),
      fRolling = Froll(totalMass, slope, crr),
      fBearing = Fbear(totalMass, slope),
      fGravity = Fgrav(totalMass, slope),
      coolMod = COOLING_MODS[cfg.motorCooling] || COOLING_MODS.none;
    var coolingDragN = coolMod.dragW / Math.max(v, .5),
      fAccel = totalMass * v / 10,
      fTrans = (cfg.motorType === 'dd' ? 0 : (fRolling + fBearing) * .02) + coolingDragN;
    var fAero = aeroForceCdA(rho, CdA, v, headwind),
      fCruise = fGravity + fRolling + fBearing + fTrans + fAero,
      fTotal = fCruise + fAccel,
      pCruiseWheel = fCruise * v,
      pPeakWheel = fTotal * v;
    var coast25 = coastSim(25, totalMass, slope, crr, rho, CdA, .0015);
    var motorNoms = [1000, 2000, 3000, 5000, 8000, 12000],
      autoMotorNom = 12000;
    for (var i = 0; i < motorNoms.length; i++) {
      if (motorNoms[i] >= pPeakWheel * .65) {
        autoMotorNom = motorNoms[i];
        break
      }
    }
    var motorNom = cfg.mMotorPower > 0 ? cfg.mMotorPower : autoMotorNom,
      motorSpec = getMotorSpec(cfg.motorType, motorNom, cfg.mMotorModel),
      wb = makeWindingBase(motorSpec, cfg.motorType),
      defaultTurns = motorSpec ? motorSpec.baseTurns : getDefaultTurns(cfg.motorType, motorNom),
      motorTurns = defaultTurns,
      turnsClamped = false;
    if (cfg.motorTurns > 0) {
      var loT = Math.max(1, Math.floor(defaultTurns * .5)),
        hiT = Math.ceil(defaultTurns * 2);
      // v23: вне допустимого диапазона берём ближайшую границу (а не молча «5») и сообщаем об этом.
      if (cfg.motorTurns < loT || cfg.motorTurns > hiT) {
        motorTurns = cfg.motorTurns < loT ? loT : hiT;
        turnsClamped = true
      } else motorTurns = cfg.motorTurns
    }
    var kvSource = getKVSource(wb, motorTurns),
      motorKV = calcKV(wb, motorTurns);
    var effM_peak_guess = motorEff(pPeakWheel, motorNom, cfg.motorType) * prof.effMult;
    if (cfg.fwEnabled) effM_peak_guess *= fwLossFactor(true);
    if (effM_peak_guess > 0.95) effM_peak_guess = 0.95;
    var pMotorRequired = pPeakWheel / Math.max(effM_peak_guess, .4),
      voltageNom;
    if (cfg.voltageSelect === 'auto') voltageNom = cfg.mBattV > 0 ? cfg.mBattV : autoV(pMotorRequired);
    else voltageNom = parseInt(cfg.voltageSelect);
    var voltageNominal = voltageNom,
      voltageAvg = getAvgVoltage(voltageNom),
      voltagePeak = getPeakVoltage(voltageNom),
      voltageCutoff = getCutoffVoltage(voltageNom),
      voltageLow = getLowVoltage(voltageNom),
      voltage;
    if (cfg.voltageMode === 'peak') voltage = voltagePeak;
    else if (cfg.voltageMode === 'average') voltage = voltageAvg;
    else if (cfg.voltageMode === 'low') voltage = voltageLow;
    else if (cfg.voltageMode === 'cutoff') voltage = voltageCutoff;
    else if (cfg.voltageMode === 'both' || cfg.voltageMode === 'both5') voltage = voltageAvg;
    else voltage = voltageNominal;
    var ctrlCurrentLimit = cfg.mCtrlCurrent > 0 ? cfg.mCtrlCurrent : 120,
      ctrlPhaseLimit = cfg.mCtrlPhase > 0 ? cfg.mCtrlPhase : ctrlCurrentLimit * 2.2,
      ctrlEffValue = cfg.mCtrlEff > 0 ? cfg.mCtrlEff / 100 : ctrlEffFromPower(voltage * ctrlCurrentLimit, cfg.motorType),
      battMaxA_eff = cfg.mBattMaxA > 0 ? cfg.mBattMaxA : 150,
      effectiveCurrentLimit = Math.min(ctrlCurrentLimit, battMaxA_eff);
    var ctrlMaxPower = voltage * effectiveCurrentLimit * ctrlEffValue,
      pBattFromPack = voltage * effectiveCurrentLimit;
    var motorPassportPeak = cfg.mMotorPeak > 0 ? cfg.mMotorPeak : motorSpec ? motorSpec.peak : cfg.motorType === 'dd' ? Math.min(motorNom * 2.4, 12000) : motorNom * 1.8,
      pMotorPeakForVmax = ctrlMaxPower;
    var effPeakVmax = motorEff(pMotorPeakForVmax, motorNom, cfg.motorType) * prof.effMult;
    if (cfg.fwEnabled) effPeakVmax *= fwLossFactor(true);
    if (effPeakVmax > 0.95) effPeakVmax = 0.95;
    var powerToWheelPeak = pMotorPeakForVmax * effPeakVmax;
    var overPeak = pMotorPeakForVmax > motorPassportPeak;
    var currentPeak = pMotorPeakForVmax / (voltage * ctrlEffValue);
    currentPeak = Math.min(currentPeak, effectiveCurrentLimit);
    var effM = effPeakVmax,
      riderWheelAssist = cfg.pedalMode ? cfg.riderPower * 0.9 : 0,
      wheelFromMotorCruise = Math.max(0, pCruiseWheel - riderWheelAssist),
      pMotorCr_guess = wheelFromMotorCruise / Math.max(effM_peak_guess, .4);
    var effM_cr = motorEff(pMotorCr_guess, motorNom, cfg.motorType) * prof.effMult;
    if (cfg.fwEnabled) effM_cr *= fwLossFactor(true);
    if (effM_cr > 0.95) effM_cr = 0.95;
    pMotorCr_guess = wheelFromMotorCruise / Math.max(effM_cr, .4);
    effM_cr = motorEff(pMotorCr_guess, motorNom, cfg.motorType) * prof.effMult;
    if (cfg.fwEnabled) effM_cr *= fwLossFactor(true);
    if (effM_cr > 0.95) effM_cr = 0.95;
    var pMotorCr = Math.min(pMotorCr_guess, ctrlMaxPower);
    var gearRatio = wb.ratio || 1,
      physContext = {
        motorKV: motorKV,
        wb: wb,
        motorTurns: motorTurns,
        wheelRadius: wheelRadius,
        voltage: voltage,
        mass: totalMass,
        slope: slope,
        crr: crr,
        rho: rho,
        CdA: CdA,
        headwind: headwind,
        motorType: cfg.motorType,
        fwEnabled: cfg.fwEnabled,
        coolingDragW: coolMod.dragW,
        effectiveCurrentLimit: effectiveCurrentLimit,
        motorNom: motorNom,
        ctrlEff: ctrlEffValue,
        effMult: prof.effMult
      },
      phys = calcMaxSpeedPhysical(physContext);
    var vMaxByWindingRaw = phys.vMaxByWindingRaw,
      vMaxByWinding = phys.vMaxByWinding,
      vMaxByPower = phys.vMaxByPower,
      vMax = phys.vMax,
      vMaxLimiter = phys.limiter;
    var vTrack = kmh2ms(trackSpeed),
      pWheelTrack = (fGravity + Froll(totalMass, slope, crr) + Fbear(totalMass, slope) + aeroForceCdA(rho, CdA, vTrack, headwind)) * vTrack;
    var whKmTrackOnly = Math.max(0, pWheelTrack - riderWheelAssist) / Math.max(effM_cr, .4) / Math.max(ctrlEffValue, .7) / trackSpeed;
    var vMaxReal, vMinReal, stopsPerKmReal;
    var turnsRange = cfg.motorTurns > 0 ? [Math.max(1, Math.floor(defaultTurns * .5)), Math.ceil(defaultTurns * 2)] : null;
    var pulseFactor = 1,
      pulseInfo = {
        mode: 'cityCycle',
        factor: cityCycle,
        dKE_Wh: 0,
        nStops: 0,
        regenRecovery: 0,
        aeroExtra: 0,
        slopeLossWh: 0
      };
    if (cfg.useSpeedProfile) {
      vMaxReal = cfg.mMaxSpeed > 0 ? Math.min(cfg.mMaxSpeed, vMax) : vStyleAvg;
      vMinReal = cfg.mMinSpeed > 0 ? Math.min(cfg.mMinSpeed, vMaxReal * 0.99) : vMaxReal * 0.3;
      stopsPerKmReal = cfg.mStopsPerKm > 0 ? cfg.mStopsPerKm : style.stopsPerKm;
      stopsPerKmReal *= Math.max(1 - trackPct / 100, 0.01);
      if (IS_V22) stopsPerKmReal *= Math.max(cityCycle, 1.0)
    } else {
      vMaxReal = Math.min(vWorkSpeed, vMax);
      vMinReal = vMaxReal * 0.4;
      stopsPerKmReal = style.stopsPerKm * (1 - trackPct / 100);
      if (IS_V22) stopsPerKmReal *= Math.max(cityCycle, 1.0)
    }
    var vReal = kmh2ms(Math.max(vMaxReal, 3));
    var fCruiseReal = fGravity + Froll(totalMass, slope, crr) + Fbear(totalMass, slope) + fTrans + aeroForceCdA(rho, CdA, vReal, headwind);
    pCruiseWheel = fCruiseReal * vReal;
    var regenBlockTemp = -5;
    var regenEnabled = cfg.regenMode && cfg.motorType === 'dd' && temp >= regenBlockTemp,
      regenBlockReason = '';
    if (cfg.regenMode) {
      if (cfg.motorType !== 'dd') regenBlockReason = 'только DD';
      else if (temp < regenBlockTemp) regenBlockReason = 'T < ' + regenBlockTemp + ' °C'
    }
    var regenCurrent = !regenEnabled ? 0 : (cfg.regenCurrent != null && cfg.regenCurrent >= 0 ? cfg.regenCurrent : 20),
      regenSavedWhKm = 0;
    var uphillPct = clamp(cfg.uphillPct != null ? cfg.uphillPct : 0.3, 0, 1),
      slopeMaxPct = cfg.slopeMaxPct != null ? cfg.slopeMaxPct : Math.max(slope, 0) * 2;
    var vCityMid = kmh2ms(vMaxReal),
      fCity = fGravity + Froll(totalMass, slope, crr) + Fbear(totalMass, slope) + aeroForceCdA(rho, CdA, vCityMid, headwind),
      pWheelCity = fCity * vCityMid;
    var whKmCityBase = Math.max(0, pWheelCity - riderWheelAssist) / Math.max(effM_cr, .4) / Math.max(ctrlEffValue, .7) / Math.max(vMaxReal, .1);
    // v23: «пульс» (разгоны после остановок) считается всегда и плавно. Раньше при
    // vMax ≤ 1.3×vMin физика выключалась и подставлялся грубый ×cityCycle —
    // отсюда скачок 40,5 → 54,9 Вт·ч/км при сдвиге минималки на 0,1 км/ч.
    {
      var vMinMs = kmh2ms(vMinReal),
        vAccelMs = kmh2ms(Math.max(vMinReal, vMaxReal)),
        dKE_Wh = 0.5 * totalMass * (vAccelMs * vAccelMs - vMinMs * vMinMs) / 3600,
        regenRecovery = regenEnabled ? clamp(regenCurrent / 40 * 0.5, 0.1, 0.35) : 0,
        dKE_lost_Wh = dKE_Wh * (1 - regenRecovery) / Math.max(effM_cr * ctrlEffValue, 0.3),
        nStops = stopsPerKmReal > 0 ? stopsPerKmReal : 0.8,
        extraWhPerKm = dKE_lost_Wh * nStops,
        aeroExtra = 0;
      if (vMaxReal > vStyleAvg * 1.5) aeroExtra = Math.min(0.25, (vMaxReal / vStyleAvg - 1.5) * 0.15);
      var slopeLossWh = 0;
      // v23: если загружен маршрут, подъёмы уже есть в эффективном уклоне — второй раз не добавляем.
      if (!regenEnabled && slopeMaxPct > 0 && !cfg.slopeFromRoute) {
        slopeLossWh = totalMass * 9.81 * (slopeMaxPct / 100) * uphillPct * 1000 / 3.6e3
      }
      pulseFactor = 1 + extraWhPerKm / Math.max(whKmCityBase || 1, 1) + aeroExtra + slopeLossWh / Math.max(whKmCityBase || 1, 1);
      pulseInfo = {
        mode: 'physical',
        factor: pulseFactor,
        dKE_Wh: dKE_Wh,
        nStops: nStops,
        regenRecovery: regenRecovery,
        aeroExtra: aeroExtra,
        slopeLossWh: slopeLossWh
      }
    }
    var whKmCityRaw = whKmCityBase * pulseFactor;
    var stopsPerKm = stopsPerKmReal > 0 ? stopsPerKmReal : 0;
    var vBrakeAvg = citySpeedMax * .7,
      regenWhPerStop = regenEnergyPerStop(totalMass, vBrakeAvg, regenCurrent, voltageNom, regenEnabled);
    if (pulseInfo.mode === 'physical' && regenEnabled) regenSavedWhKm = pulseInfo.dKE_Wh * pulseInfo.regenRecovery * pulseInfo.nStops;
    else regenSavedWhKm = regenEnabled ? stopsPerKm * regenWhPerStop : 0;
    // v23: уровень ассистента влияет на расход только в режиме педалей (PAS).
    // На газу «Турбо» и «Эко» при той же скорости тратят одинаково.
    var _assistMode = MODES[cfg.assistMode] || MODES.normal,
      _assistMult = cfg.pedalMode ? 1 + (_assistMode.mult - 1) * 0.3 : 1;
    var whKmCityOnly = Math.max(2, whKmCityRaw * _assistMult),
      whKmCr = (trackPct / 100) * whKmTrackOnly + (cityPct / 100) * whKmCityOnly;
    whKmCr *= style.energyMult;
    // v23: погода и фары применяются одинаково в общем расчёте и по маршруту
    // (UI передаёт weatherKey/lightsW только когда переключатель погоды включён).
    if (cfg.weatherKey) whKmCr *= WEATHER_ENERGY[cfg.weatherKey] || 1.0;
    if (cfg.lightsW > 0) whKmCr += cfg.lightsW / Math.max(vMaxReal, 5);
    var routeWhKm = cfg.vmaxProfile ? cfg.vmaxProfile.whKmRoute : null;
    var kP = peukertK(cfg.cellType) + prof.peukertAdd,
      tempDerate = battTempDerate(temp),
      motorLabelFallback = motorNom + 'Вт ' + (cfg.motorType === 'dd' ? 'DD' : cfg.motorType === 'mid' ? 'MID' : 'РЕДУКТОР'),
      motor = {
        label: motorSpec ? motorSpec.name : motorLabelFallback,
        power: String(motorNom),
        type: cfg.motorType,
        price: cfg.mMotorPrice > 0 ? cfg.mMotorPrice : estimateMotorPrice(cfg.motorType, motorNom)
      },
      controller = {
        label: 'CTRL ' + ctrlCurrentLimit + 'А',
        current: ctrlCurrentLimit,
        price: cfg.mCtrlPrice > 0 ? cfg.mCtrlPrice : 20000
      },
      battery;
    if (cfg.mBattAh > 0) {
      if (cfg.mBattPrice > 0) {
        var cellCapForP = cfg.cellType === 'sk' ? 55 : (cfg.cellType === 'lg' ? 5.2 : 5.0),
          S_get = getSeries(voltageNom),
          P_get = Math.max(1, Math.ceil(cfg.mBattAh / cellCapForP)),
          actualAhGet = +(P_get * cellCapForP).toFixed(1);
        battery = {
          capacity: actualAhGet,
          wh: voltageAvg * actualAhGet,
          price: {
            total: cfg.mBattPrice,
            S: S_get,
            P: P_get,
            actualAh: actualAhGet,
            cellCount: S_get * P_get
          }
        }
      } else {
        var _bp = calcBattPrice(voltageNom, cfg.mBattAh, cfg.cellType, false, false, prices);
        battery = {
          capacity: _bp.actualAh,
          wh: voltageAvg * _bp.actualAh,
          price: _bp
        }
      }
    } else {
      var _bp20 = calcBattPrice(voltageNom, 20, cfg.cellType, false, false, prices);
      battery = {
        capacity: _bp20.actualAh,
        wh: voltageAvg * _bp20.actualAh,
        price: _bp20
      }
    };
    var cRateV = cRate(currentPeak, battery.capacity),
      chargeCurrent = voltageNom >= 60 ? 15 : (voltageNom >= 48 ? 8 : 4),
      chargeTimeBase = battery.capacity / chargeCurrent / 0.85,
      chargeTime = chargeBlocked ? Infinity : chargeTimeBase,
      dispPrice = prices.display.none,
      pasPrice = cfg.pedalMode ? prices.options.pas : 0,
      throttlePrice = prices.options.throttle_std,
      battTotalPrice = battery.price.total !== undefined ? battery.price.total : battery.price,
      framePrice = cfg.frameType === 'space' ? prices.frame.space : 0,
      coolingPrice = coolMod.cost || 0,
      totalPrice = motor.price + controller.price + battTotalPrice + dispPrice + pasPrice + throttlePrice + framePrice + coolingPrice,
      costCharge = battery.wh / 1000 * tariff;
    var batterySOH = clamp((cfg.batterySOH || 100) / 100, .5, 1),
      doD = clamp(whKmCr * TYPICAL_TRIP_KM / Math.max(battery.wh, 1), 0.2, 0.95),
      cycLifeVal = cycLife(doD, temp, cfg.cellType),
      battLifeKm = cycLifeVal * (battery.wh * doD * batterySOH) / Math.max(whKmCr, .1),
      costKm = (battTotalPrice / Math.max(battLifeKm, 1)) + (whKmCr * tariff / 1000);
    var currentCruise = pMotorCr / Math.max(voltage * ctrlEffValue, .1),
      cRateCruise = currentCruise / Math.max(battery.capacity, .1),
      peukertDerate = Math.pow(Math.max(cRateCruise, .5) / .5, kP - 1),
      usableWh = battery.wh * prof.derate * tempDerate * batterySOH / peukertDerate;
    var realRangeKm = usableWh / Math.max(whKmCr, .1);
    var routeRangeKm = routeWhKm > 0 ? usableWh / Math.max(routeWhKm, .1) : null;
    var realTripTimeH = TYPICAL_TRIP_KM / Math.max(vMaxReal, 5);
    var muBrake = cfg.surface === 'ice' ? .15 : cfg.surface === 'snow_loose' ? .25 : cfg.surface === 'snow_packed' ? .35 : cfg.surface === 'dirt_wet' ? .45 : .7,
      brakeDist25 = Math.pow(kmh2ms(25), 2) / (2 * muBrake * 9.81),
      brakeDistCur = Math.pow(v, 2) / (2 * muBrake * 9.81),
      safetyDist = v * 1.5 + brakeDistCur;
    var Rcell25C = cfg.cellType === 'sk' ? 0.001 : (cfg.cellType === 'lg' ? 0.015 : 0.0125),
      S_pack = getSeries(voltageNom),
      Rp = battery.price.P || 1,
      tempIR = battIRTempMult(temp),
      Rint = Rcell25C * S_pack / Rp * tempIR,
      vSag = currentPeak * Rint,
      vLoad = voltage - vSag;
    var mode = MODES[cfg.assistMode] || MODES.normal,
      motorPowerAssist = Math.min(pMotorCr * mode.mult, ctrlMaxPower),
      elecPerYear = whKmCr * yearKm / 1000 * tariff,
      maintPerYear = 2000,
      residualFactor = Math.pow(0.80, 5),
      tco5y = totalPrice + (elecPerYear + maintPerYear) * 5 - totalPrice * residualFactor,
      fuelCostPer100km = fuelRate * fuelPrice,
      evCostPer100km = whKmCr * 100 / 1000 * tariff,
      fuelSavePer100km = fuelCostPer100km - evCostPer100km,
      battAmortPer100km = (battTotalPrice / Math.max(battLifeKm, 1)) * 100,
      netSavePer100km = fuelSavePer100km - battAmortPer100km,
      yearSaving = netSavePer100km * (yearKm / 100),
      paybackMonths = yearSaving > 0 ? totalPrice / (yearSaving / 12) : Infinity;
    var idleCurrent = (wb.idleI != null) ? wb.idleI : (cfg.motorType === 'dd' ? 0.7 : 0.55),
      idleLossW = voltage * idleCurrent;
    // v23: у кареточных моторов между ротором и колесом стоит ещё звезда/кассета
    // (finalRatio). Раньше обороты считались только через редуктор и выходили втрое выше.
    gearRatio = (wb.ratio || 1) / (wb.finalRatio || 1);
    var rpmWheel = motorRpm(vReal, wheelRadius),
      rpm = rpmWheel * gearRatio,
      motorRpmNoLoad = calcMotorRpm(wb, motorTurns, voltage),
      torque = motorTorque(powerToWheelPeak, rpm);
    var kvRotor = motorKV * (wb.ratio || 1),
      torquePerAmpRotor = 9.5493 / Math.max(kvRotor, 0.1),
      forceWheelCruise = pCruiseWheel / Math.max(vReal, 0.1),
      torqueWheelCruise = forceWheelCruise * wheelRadius,
      torqueRotorCruise = torqueWheelCruise / gearRatio;
    var currentPhaseCruise = Math.min(torqueRotorCruise / Math.max(torquePerAmpRotor, 0.001), ctrlPhaseLimit);
    var currentPhasePeak = estimatePhaseCurrent(currentPeak, 20, vMaxByWindingRaw, ctrlPhaseLimit, 0.85);
    var copperResistance = copperResistanceByPower(motorNom, cfg.motorType),
      dutyCycle = clamp(vStyleAvg / Math.max(vMaxByWindingRaw, 1), 0.15, 1.0),
      IphasePeakRms = currentPhasePeak * Math.sqrt(dutyCycle),
      IphaseCruiseRms = currentPhaseCruise * Math.sqrt(dutyCycle),
      pCopperPeakRaw = 3 * IphasePeakRms * IphasePeakRms * copperResistance;
    var heatLossCopperCruise = 3 * IphaseCruiseRms * IphaseCruiseRms * copperResistance,
      heatLossCopperPeak = 3 * IphasePeakRms * IphasePeakRms * copperResistance,
      rpmNominal = calcMotorRpm(wb, motorTurns, voltageNominal),
      rpmRatio = rpm / Math.max(rpmNominal, 1),
      heatLossIron = 0.06 * motorNom * Math.pow(rpmRatio, 1.3),
      heatLossEq = heatLossCopperCruise + heatLossIron,
      heatLossPeak = heatLossCopperPeak + heatLossIron * 1.5;
    if (IS_V221) heatLossPeak = Math.min(heatLossPeak, pMotorPeakForVmax * 0.85);
    var G_thermal = thermalGByPower(motorNom),
      C_thermal_raw = thermalCapacityByPower(motorNom),
      airCoolBoost = clamp(0.6 + vStyleAvg * 0.013, 0.8, 1.65),
      coolModBoost = (cfg.motorCooling === 'oil') ? 1.20 : ((cfg.motorCooling === 'ferro') ? 1.10 : 1.00),
      coolingEfficiency = airCoolBoost * coolModBoost,
      G_thermal_eff = G_thermal * coolingEfficiency * 0.7,
      C_thermal_eff = C_thermal_raw * 1.0;
    var windingTemp_static = motorThermalRise(heatLossEq, 1800, C_thermal_eff, G_thermal_eff, temp),
      windingTempPeak_eq = motorThermalRise(heatLossPeak, 1800, C_thermal_eff, G_thermal_eff, temp),
      windingTempPeak = Math.min(windingTempPeak_eq, 200),
      dynamicFactor = clamp((cityCycle - 1.0) * 0.55, 0, 0.65),
      windingTemp = Math.min(180, windingTemp_static + (windingTempPeak - windingTemp_static) * dynamicFactor),
      magnetTemp = temp + (windingTemp - temp) * .7;
    var timeToOverheat = calcTimeToOverheat(heatLossEq, G_thermal_eff, C_thermal_eff, temp, 120),
      timeToOverheatPeak = calcTimeToOverheat(heatLossPeak, G_thermal_eff, C_thermal_eff, temp, 120);
    var quality = kvSource === 'measured' ? 1.0 : (kvSource === 'extrapolated' ? 0.8 : 0.6);
    return {
      mass: totalMass,
      crr: crr,
      rho: rho,
      Cd: Cd,
      A: A,
      CdA: CdA,
      v: v,
      slope: slope,
      headwind: headwind,
      N: N,
      fRolling: fRolling,
      fBearing: fBearing,
      fGravity: fGravity,
      fCruise: fCruise,
      fTotal: fTotal,
      fAero: fAero,
      pCruiseWheel: pCruiseWheel,
      pPeakWheel: pPeakWheel,
      speed: speed,
      avgSpeed: vStyleAvg,
      trackSpeed: trackSpeed,
      cityCycle: cityCycle,
      vMax: vMax,
      vMaxByPower: vMaxByPower,
      vMaxByWinding: vMaxByWinding,
      vMaxByWindingRaw: vMaxByWindingRaw,
      vMaxLimiter: vMaxLimiter,
      vMaxEff: vMaxReal,
      vMaxReal: vMaxReal,
      vminReal: vMinReal,
      speedKmhEff: vMaxReal,
      stopsPerKmEff: stopsPerKmReal,
      vmaxProfile: cfg.vmaxProfile || null,
      styleKey: cfg.rideStyle,
      styleName: style.name,
      styleVBase: style.vBase,
      styleEnergyMult: style.energyMult,
      styleColor: style.color,
      styleIcon: style.icon,
      riderMass: cfg.riderMass,
      cargoMass: cfg.cargoMass,
      rpm: rpm,
      motorRpmNoLoad: motorRpmNoLoad,
      torque: torque,
      motorNom: motorNom,
      motorPassportPeak: motorPassportPeak,
      overPeak: overPeak,
      pMotor: pMotorPeakForVmax,
      pMotorCr: pMotorCr,
      ctrlMaxPower: ctrlMaxPower,
      pBattFromPack: pBattFromPack,
      idleCurrent: idleCurrent,
      idleLossW: idleLossW,
      currentPeak: currentPeak,
      currentCruise: currentCruise,
      effM: effM,
      effM_cr: effM_cr,
      powerToWheelPeak: powerToWheelPeak,
      currentPhasePeak: currentPhasePeak,
      currentPhaseCruise: currentPhaseCruise,
      pCopperPeakRaw: pCopperPeakRaw,
      pCopperCruise: 3 * IphaseCruiseRms * IphaseCruiseRms * copperResistance,
      copperResistance: copperResistance,
      dutyCycle: dutyCycle,
      IphasePeakRms: IphasePeakRms,
      IphaseCruiseRms: IphaseCruiseRms,
      heatLoss: heatLossPeak,
      heatLossPeak: heatLossPeak,
      heatLossEq: heatLossEq,
      windingTemp: windingTemp,
      windingTempPeak: windingTempPeak,
      magnetTemp: magnetTemp,
      timeToOverheat: timeToOverheat,
      timeToOverheatPeak: timeToOverheatPeak,
      coolingEfficiency: coolingEfficiency,
      G_thermal_eff: G_thermal_eff,
      C_thermal_eff: C_thermal_eff,
      motorTurns: motorTurns,
      motorKV: motorKV,
      kvSource: kvSource,
      quality: quality,
      motorType: cfg.motorType,
      wb: wb,
      motorCooling: cfg.motorCooling || 'none',
      coolingBoost: coolMod.boost,
      coolingDragW: coolMod.dragW,
      coolingPrice: coolingPrice,
      voltage: voltage,
      voltageNom: voltageNom,
      voltageAvg: voltageAvg,
      voltagePeak: voltagePeak,
      voltageLow: voltageLow,
      voltageCutoff: voltageCutoff,
      voltageMode: cfg.voltageMode,
      battery: battery,
      cRateV: cRateV,
      chargeTime: chargeTime,
      chargeBlocked: chargeBlocked,
      chargeCurrent: chargeCurrent,
      kP: kP,
      tempDerate: tempDerate,
      peukertDerate: peukertDerate,
      usableWh: usableWh,
      Rint: Rint,
      Rp: Rp,
      S_pack: S_pack,
      vSag: vSag,
      vLoad: vLoad,
      batterySOH: batterySOH,
      cycLifeVal: cycLifeVal,
      degRate: Math.exp(.03 * (temp - 25)) * .02,
      battLifeKm: battLifeKm,
      battTotalPrice: battTotalPrice,
      battMaxA: battMaxA_eff,
      doD: doD,
      ctrlCurrentLimit: ctrlCurrentLimit,
      ctrlPhaseLimit: ctrlPhaseLimit,
      ctrlEff: ctrlEffValue,
      effectiveCurrentLimit: effectiveCurrentLimit,
      whKmCr: whKmCr,
      routeWhKm: routeWhKm,
      whKmTrackOnly: whKmTrackOnly,
      whKmCityOnly: whKmCityOnly,
      realRangeKm: realRangeKm,
      routeRangeKm: routeRangeKm,
      realTripTimeH: realTripTimeH,
      pulseFactor: pulseFactor,
      pulseInfo: pulseInfo,
      regenEnabled: regenEnabled,
      regenBlockReason: regenBlockReason,
      regenCurrent: regenCurrent,
      regenSavedWhKm: regenSavedWhKm,
      regenWhPerStop: regenWhPerStop,
      stopsPerKm: stopsPerKm,
      winterActive: winterActive,
      winterAuto: winterAuto,
      uphillPct: uphillPct,
      slopeMaxPct: slopeMaxPct,
      tariff: tariff,
      fuelPrice: fuelPrice,
      fuelRate: fuelRate,
      yearKm: yearKm,
      costKm: costKm,
      totalPrice: totalPrice,
      elecPerYear: elecPerYear,
      tco5y: tco5y,
      fuelCostPer100km: fuelCostPer100km,
      evCostPer100km: evCostPer100km,
      fuelSavePer100km: fuelSavePer100km,
      battAmortPer100km: battAmortPer100km,
      netSavePer100km: netSavePer100km,
      yearSaving: yearSaving,
      paybackMonths: paybackMonths,
      coast25: coast25,
      muBrake: muBrake,
      brakeDist25: brakeDist25,
      brakeDistCur: brakeDistCur,
      safetyDist: safetyDist,
      pedalMode: cfg.pedalMode,
      fwEnabled: cfg.fwEnabled,
      fwBoost: fwPowerBoost(cfg.fwEnabled),
      modeName: mode.name,
      riderPower: cfg.pedalMode ? cfg.riderPower : 0,
      riderWheelAssist: riderWheelAssist,
      turnsClamped: turnsClamped,
      turnsRequested: cfg.motorTurns,
      turnsRange: turnsRange,
      battRequestedAh: cfg.mBattAh > 0 ? cfg.mBattAh : 20,
      lightsW: cfg.lightsW || 0,
      weatherKey: cfg.weatherKey || null,
      temp: temp,
      pressure: cfg.pressure,
      tire: cfg.tire,
      surface: cfg.surface,
      wheelRadius: wheelRadius,
      frameType: cfg.frameType,
      tireR17: cfg.tireR17,
      massExtra: fp.massExtra,
      posture: cfg.posture,
      motor: motor,
      controller: controller,
      effMult: prof.effMult
    }
  }

  function computeStages(cfg) {
    var avg = PROFILE_MULT.avg;
    var eCfg = {};
    for (var k in cfg) eCfg[k] = cfg[k];
    eCfg.weatherKey = null;
    eCfg.nightEnergyF = 1.0;
    eCfg.lightsW = 0;
    eCfg.slopeFromRoute = false;
    eCfg.ambientTemp = ETALON_TEMP_C;
    eCfg.headwind = 0;
    eCfg.slope = 0;
    eCfg.slopeMaxPct = 0;
    eCfg.surface = 'asphalt_smooth';
    eCfg.winterMode = false;
    eCfg.batterySOH = 100;
    eCfg.cityCycle = 1.0;
    eCfg.useSpeedProfile = false;
    eCfg.vmaxProfile = null;
    var etalon = compute(eCfg, avg);
    var wCfg = {};
    for (var k in cfg) wCfg[k] = cfg[k];
    wCfg.cityCycle = 1.0;
    wCfg.useSpeedProfile = false;
    wCfg.vmaxProfile = null;
    var withWeather = compute(wCfg, avg);
    var withCity = compute(cfg, avg);
    return {
      etalon: etalon,
      withWeather: withWeather,
      withCity: withCity,
      real: withCity
    }
  }
  root.CityBikeEngine = {
    STYLE_LIMITS: STYLE_LIMITS,
    compute: compute,
    computeVoltageMetrics: computeVoltageMetrics,
    calcMaxSpeedPhysical: calcMaxSpeedPhysical,
    computeStages: computeStages,
    cellVoltageFromSOC: cellVoltageFromSOC,
    computeVmaxProfileByRoute: computeVmaxProfileByRoute,
    detectCurvature: detectCurvature,
    classifyWeather: classifyWeather,
    getNightFactor: getNightFactor,
    parseTimeStr: parseTimeStr,
    ROAD_CLASS_SPEED: ROAD_CLASS_SPEED,
    RIDE_STYLES: RIDE_STYLES,
    WEATHER_ENERGY: WEATHER_ENERGY,
    MOTOR_SPECS: MOTOR_SPECS,
    FRAME_PROPS: FRAME_PROPS,
    R17_PROPS: R17_PROPS,
    MODES: MODES,
    PROFILE_MULT: PROFILE_MULT,
    WINTER_THRESHOLD_C: WINTER_THRESHOLD_C,
    getMotorSpec: getMotorSpec,
    getMotorSpecById: getMotorSpecById,
    makeWindingBase: makeWindingBase,
    calcKV: calcKV,
    getKVSource: getKVSource,
    estimateMotorPrice: estimateMotorPrice,
    getMaxSpeedByPower: getMaxSpeedByPower,
    motorEff: motorEff,
    getSeries: getSeries,
    getAvgVoltage: getAvgVoltage,
    getPeakVoltage: getPeakVoltage,
    getLowVoltage: getLowVoltage,
    getCutoffVoltage: getCutoffVoltage,
    peukertK: peukertK,
    cRate: cRate,
    cycLife: cycLife,
    battTempDerate: battTempDerate,
    battIRTempMult: battIRTempMult,
    clamp: clamp,
    kmh2ms: kmh2ms,
    ms2kmh: ms2kmh,
    getWR: getWR,
    fwLossFactor: fwLossFactor,
    fwPowerBoost: fwPowerBoost,
    haversineLocal: haversineLocal,
    CB_MODE: CB_MODE,
    IS_V2214: IS_V2214,
    IS_V2213: IS_V2213,
    IS_V2211: IS_V2211,
    IS_V221: IS_V221,
    IS_V22B1: IS_V22B1,
    IS_V22: IS_V22,
    IS_FULL: IS_FULL,
    IS_SAFE: IS_SAFE
  };
})(typeof self !== 'undefined' ? self : this);