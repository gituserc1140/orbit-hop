"use strict";

(function () {
  var canvas = document.getElementById("gameCanvas");
  var stage = document.getElementById("stage");
  var statusEl = document.getElementById("status");
  var muteBtn = document.getElementById("mute");
  if (!canvas || !stage) return;
  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  var VIEW_W = 180;
  var HOP = 170;
  var GRAV = 198;
  var OUT_W = 1.18;
  var TAN_W = 0.58;
  var PERCH = 4;
  var CATCH = 5;
  var BEST_KEY = "orbit-hop.best";
  var MUTE_KEY = "orbit-hop.muted";

  var PALETTE = [
    { body: "#24e7ff", dark: "#07566e", band: "#7af6ff", light: "#e7fdff" },
    { body: "#ff45d0", dark: "#7a145c", band: "#ff8ae3", light: "#ffe4f8" },
    { body: "#b6ff3c", dark: "#3d6e0e", band: "#dcff86", light: "#f6ffd4" },
    { body: "#ffd23a", dark: "#7a5a0c", band: "#ffe58a", light: "#fff6d0" },
    { body: "#7d8cff", dark: "#2a2f86", band: "#b7c0ff", light: "#e4e8ff" },
    { body: "#ff7a3c", dark: "#7a3010", band: "#ffb088", light: "#ffe6d8" },
  ];

  var INK = {
    o: "#140c22",
    s: "#f4f0e4",
    v: "#6ffbff",
    p: "#ff4fd8",
  };

  var SHIP = [
    [0, 4, "v"],
    [-1, 3, "o"],
    [0, 3, "v"],
    [1, 3, "o"],
    [-2, 2, "o"],
    [-1, 2, "s"],
    [0, 2, "v"],
    [1, 2, "s"],
    [2, 2, "o"],
    [-2, 1, "o"],
    [-1, 1, "s"],
    [0, 1, "s"],
    [1, 1, "s"],
    [2, 1, "o"],
    [-1, 0, "o"],
    [0, 0, "p"],
    [1, 0, "o"],
    [-2, -1, "o"],
    [-1, -1, "s"],
    [1, -1, "s"],
    [2, -1, "o"],
    [-2, -2, "o"],
    [2, -2, "o"],
  ];

  var FONT = {
    A: ["010", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    C: ["111", "100", "100", "100", "111"],
    D: ["110", "101", "101", "101", "110"],
    E: ["111", "100", "110", "100", "111"],
    F: ["111", "100", "110", "100", "100"],
    G: ["111", "100", "101", "101", "111"],
    H: ["101", "101", "111", "101", "101"],
    I: ["111", "010", "010", "010", "111"],
    J: ["001", "001", "001", "101", "010"],
    K: ["101", "101", "110", "101", "101"],
    L: ["100", "100", "100", "100", "111"],
    M: ["101", "111", "101", "101", "101"],
    N: ["110", "101", "101", "101", "101"],
    O: ["111", "101", "101", "101", "111"],
    P: ["110", "101", "110", "100", "100"],
    Q: ["111", "101", "101", "111", "001"],
    R: ["110", "101", "110", "101", "101"],
    S: ["111", "100", "111", "001", "111"],
    T: ["111", "010", "010", "010", "010"],
    U: ["101", "101", "101", "101", "111"],
    V: ["101", "101", "101", "101", "010"],
    W: ["101", "101", "101", "111", "101"],
    X: ["101", "101", "010", "101", "101"],
    Y: ["101", "101", "010", "010", "010"],
    Z: ["111", "001", "010", "100", "111"],
    0: ["111", "101", "101", "101", "111"],
    1: ["010", "110", "010", "010", "111"],
    2: ["111", "001", "111", "100", "111"],
    3: ["111", "001", "111", "001", "111"],
    4: ["101", "101", "111", "001", "001"],
    5: ["111", "100", "111", "001", "111"],
    6: ["111", "100", "111", "101", "111"],
    7: ["111", "001", "010", "010", "010"],
    8: ["111", "101", "111", "101", "111"],
    9: ["111", "101", "111", "001", "111"],
  };

  var stars = [];
  for (var i = 0; i < 56; i++) {
    stars.push({
      x: (i * 47 + 11) % VIEW_W,
      y: (i * 83 + 5) % 420,
      layer: i % 3,
      w: i % 9 === 0 ? 2 : 1,
      c: i % 6 === 0 ? "#ffe7a3" : i % 4 === 0 ? "#9fd6ff" : "#e8eeff",
    });
  }

  var reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    reduce = false;
  }

  var viewW = VIEW_W;
  var viewH = 320;
  var camera = 0;
  var score = 0;
  var best = 0;
  var phase = "boot";
  var hopped = false;
  var player = null;
  var planets = [];
  var particles = [];
  var trail = [];
  var shake = 0;
  var shipSquash = 0;
  var pop = 0;
  var time = 0;
  var seed = 1;
  var runs = 0;
  var booted = false;
  var lockUntil = 0;
  var last = 0;
  var soundOn = true;
  var actx = null;

  function loadBest() {
    try {
      var n = Number(window.localStorage.getItem(BEST_KEY));
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    } catch (err) {
      return 0;
    }
    return 0;
  }

  function saveBest(n) {
    try {
      window.localStorage.setItem(BEST_KEY, String(n));
    } catch (err) {
      /* storage can be blocked; the run still plays */
    }
  }

  function loadSound() {
    try {
      soundOn = window.localStorage.getItem(MUTE_KEY) !== "1";
    } catch (err) {
      soundOn = true;
    }
    paintMute();
  }

  function paintMute() {
    if (!muteBtn) return;
    muteBtn.classList.toggle("is-muted", !soundOn);
    muteBtn.setAttribute("aria-pressed", soundOn ? "false" : "true");
    var label = soundOn ? "Mute sound" : "Unmute sound";
    muteBtn.setAttribute("aria-label", label);
    muteBtn.setAttribute("title", label);
  }

  function setStatus(text) {
    if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
  }

  function rnd() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function facing(theta, spin) {
    var outX = Math.sin(theta);
    var outY = Math.cos(theta);
    var sgn = spin >= 0 ? 1 : -1;
    var tanX = Math.cos(theta) * sgn;
    var tanY = -Math.sin(theta) * sgn;
    var fx = outX * OUT_W + tanX * TAN_W;
    var fy = outY * OUT_W + tanY * TAN_W;
    var len = Math.hypot(fx, fy) || 1;
    return { x: fx / len, y: fy / len };
  }

  function makeStart() {
    return {
      index: 0,
      x: 90,
      baseX: 90,
      y: 92,
      r: 36,
      spin: 0.72,
      ang: 0.6,
      pal: PALETTE[0],
      moving: false,
      amp: 0,
      freq: 0,
      phase: 0,
      squash: 0,
      vx: 0,
      fresh: false,
      ring: false,
    };
  }

  function makePlanet(prev, index) {
    var t = clamp((index - 1) / 12, 0, 1);
    var r = Math.round(lerp(31, 16, t));
    var spinMag = lerp(0.82, 1.85, t);
    var spin = (index % 2 === 0 ? -1 : 1) * spinMag;
    var surfaceGap = Math.round(lerp(18, 46, t));
    var offset = Math.round(lerp(14, 32, t));
    if (index === 1) {
      r = 33;
      spin = 0.78;
      surfaceGap = 24;
      offset = 16;
    }
    var sign = prev.spin >= 0 ? 1 : -1;
    var jitter = 0.9 + rnd() * 0.22;
    var x = prev.x + sign * offset * jitter + (VIEW_W / 2 - prev.x) * 0.2;
    var minX = r + 14;
    var maxX = VIEW_W - r - 14;
    x = clamp(x, minX, maxX);
    var moving = index >= 6 && index % 3 === 0;
    var room = Math.min(x - minX, maxX - x);
    var amp = moving ? Math.min(16, Math.floor(room)) : 0;
    if (amp < 8) {
      moving = false;
      amp = 0;
    }
    return {
      index: index,
      x: x,
      baseX: x,
      y: prev.y + prev.r + r + surfaceGap,
      r: r,
      spin: spin,
      ang: index * 1.3,
      pal: PALETTE[index % PALETTE.length],
      moving: moving,
      amp: amp,
      freq: moving ? 1.7 : 0,
      phase: index * 0.7,
      squash: 0,
      vx: 0,
      fresh: true,
      ring: index % 4 === 0,
    };
  }

  function placeLanded() {
    var p = player.planet;
    var perch = p.r + PERCH;
    player.x = p.x + Math.sin(player.theta) * perch;
    player.y = p.y + Math.cos(player.theta) * perch;
  }

  function desiredCam() {
    var anchor = player && player.planet ? player.planet.y : 0;
    var cam = anchor - viewH * 0.3;
    return cam < 0 ? 0 : cam;
  }

  function ensureAhead() {
    var anchorIndex = player && player.planet ? player.planet.index : 0;
    var guard = 0;
    while (planets[planets.length - 1].index < anchorIndex + 2 && guard < 4) {
      var top = planets[planets.length - 1];
      planets.push(makePlanet(top, top.index + 1));
      guard += 1;
    }
    while (
      planets.length > 8 &&
      planets[0] !== player.planet &&
      planets[0] !== player.left &&
      planets[0].y < camera - 120
    ) {
      planets.shift();
    }
  }

  function nextPlanet() {
    if (!player || !player.planet) return null;
    var bestP = null;
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      if (p.y > player.planet.y + 4 && (!bestP || p.y < bestP.y)) bestP = p;
    }
    return bestP;
  }

  function reset() {
    runs += 1;
    seed = ((Date.now() + runs * 997) >>> 0) || 1;
    score = 0;
    hopped = false;
    phase = "play";
    shake = 0;
    shipSquash = 0;
    pop = 0;
    particles = [];
    trail = [];
    planets = [makeStart()];
    player = {
      state: "landed",
      planet: planets[0],
      theta: -0.28,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      left: null,
      flight: 0,
    };
    placeLanded();
    camera = desiredCam();
    ensureAhead();
    setStatus("Tap to hop.");
  }

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) {
      try {
        actx = new AC();
      } catch (err) {
        return null;
      }
    }
    if (actx.state === "suspended") {
      var pending = actx.resume();
      if (pending && pending.catch) pending.catch(function () {});
    }
    return actx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!soundOn) return;
    var audio = unlockAudio();
    if (!audio) return;
    try {
      var t0 = audio.currentTime;
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(Math.max(1, freq), t0);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      }
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) {
      /* audio devices can reject a blip; the game continues */
    }
  }

  function blipHop() {
    blip(460, 0.07, "square", 0.04, 740);
  }

  function blipLand() {
    blip(640, 0.06, "square", 0.045, 860);
    window.setTimeout(function () {
      blip(880, 0.07, "square", 0.035, 1120);
    }, 50);
  }

  function blipFail() {
    blip(210, 0.24, "sawtooth", 0.05, 68);
  }

  function burst(x, y, color) {
    var n = reduce ? 6 : 11;
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n + Math.random() * 0.25;
      var sp = 24 + Math.random() * 52;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.26 + Math.random() * 0.18,
        color: i % 2 ? "#fffaf0" : color,
        big: i % 5 === 0,
      });
    }
  }

  function kick(x, y, dx, dy) {
    var len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    var n = reduce ? 3 : 6;
    for (var i = 0; i < n; i++) {
      var ang = (Math.random() - 0.5) * 1.1;
      var c = Math.cos(ang);
      var s = Math.sin(ang);
      var sp = 28 + Math.random() * 36;
      particles.push({
        x: x,
        y: y,
        vx: (dx * c - dy * s) * sp,
        vy: (dx * s + dy * c) * sp,
        life: 0.14 + Math.random() * 0.12,
        color: i % 2 ? "#d8fbff" : "#fff6c8",
        big: false,
      });
    }
  }

  function launch() {
    var planet = player.planet;
    var face = facing(player.theta, planet.spin);
    player.vx = face.x * HOP + planet.vx;
    player.vy = face.y * HOP;
    player.state = "flying";
    player.left = planet;
    player.flight = 0;
    kick(player.x, player.y, -face.x, -face.y);
    if (!hopped) {
      hopped = true;
      setStatus("Hopping.");
    }
    blipHop();
  }

  function land(planet) {
    var dx = player.x - planet.x;
    var dy = player.y - planet.y;
    player.theta = Math.atan2(dx, dy);
    player.state = "landed";
    player.planet = planet;
    player.left = null;
    player.vx = 0;
    player.vy = 0;
    player.flight = 0;
    placeLanded();
    planet.squash = 1;
    shipSquash = 1;
    burst(player.x, player.y, planet.pal.light);
    blipLand();
    if (planet.fresh) {
      planet.fresh = false;
      score += 1;
      pop = 1;
      if (score > best) {
        best = score;
        saveBest(best);
      }
      setStatus("Score " + score + ". Best " + best + ".");
    }
    ensureAhead();
  }

  function fail() {
    if (phase === "over") return;
    phase = "over";
    shake = reduce ? 2 : 6;
    burst(player.x, player.y, "#ff8aa0");
    blipFail();
    setStatus("Game over. Score " + score + ". Best " + best + ". Tap to retry.");
  }

  function tryLand() {
    if (player.left) {
      var left = player.left;
      var ld = Math.hypot(player.x - left.x, player.y - left.y);
      if (ld > left.r + 12) player.left = null;
    }
    var caught = null;
    var caughtD = 1e9;
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      if (p === player.left) continue;
      var dx = player.x - p.x;
      var dy = player.y - p.y;
      var dist = Math.hypot(dx, dy);
      if (dist >= p.r + CATCH || dist >= caughtD) continue;
      var radial = (player.vx * dx + player.vy * dy) / (dist || 1);
      if (radial < 40) {
        caught = p;
        caughtD = dist;
      }
    }
    if (!caught) return false;
    land(caught);
    return true;
  }

  function fly(dt) {
    var steps = Math.max(1, Math.ceil(dt / 0.016));
    var h = dt / steps;
    for (var s = 0; s < steps; s++) {
      player.flight += h;
      player.vy -= GRAV * h;
      player.x += player.vx * h;
      player.y += player.vy * h;
      if (tryLand()) return;
    }
  }

  function checkMiss() {
    if (player.state !== "flying" || phase === "over") return;
    var s = worldToScreen(player.x, player.y);
    if (
      s.x < -16 ||
      s.x > viewW + 16 ||
      s.y < -22 ||
      s.y > viewH + 22 ||
      player.flight > 2.8
    ) {
      fail();
    }
  }

function update(dt) {
    time += dt;
    if (phase !== "over") {
      for (var i = 0; i < planets.length; i++) {
        planets[i].ang += planets[i].spin * dt;
        if (planets[i].moving) {
          var w = Math.sin(time * planets[i].freq + planets[i].phase);
          planets[i].x = planets[i].baseX + w * planets[i].amp;
          planets[i].vx =
            Math.cos(time * planets[i].freq + planets[i].phase) *
            planets[i].freq *
            planets[i].amp;
        } else {
          planets[i].vx = 0;
        }
        if (planets[i].squash > 0) {
          planets[i].squash = Math.max(0, planets[i].squash - dt * 3.4);
        }
      }
      if (player.state === "landed") {
        player.theta = wrapAngle(player.theta + player.planet.spin * dt);
        placeLanded();
      } else {
        fly(dt);
        if (player.state === "flying") {
          trail.push({ x: player.x, y: player.y, life: 0.22 });
          if (trail.length > 7) trail.shift();
          checkMiss();
        }
      }
      ensureAhead();
    }
    var kept = [];
    for (var t = 0; t < trail.length; t++) {
      trail[t].life -= dt;
      if (trail[t].life > 0) kept.push(trail[t]);
    }
    trail = kept;
    var alive = [];
    for (var q = 0; q < particles.length; q++) {
      var bit = particles[q];
      bit.vy -= 28 * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.life -= dt;
      if (bit.life > 0) alive.push(bit);
    }
    particles = alive;
    if (shipSquash > 0) shipSquash = Math.max(0, shipSquash - dt * 4.6);
    if (shake > 0) shake = Math.max(0, shake - dt * 13);
    if (pop > 0) pop = Math.max(0, pop - dt * 2.4);
    var target = desiredCam();
    var follow = 1 - Math.exp(-dt * (reduce ? 14 : 5.2));
    camera += (target - camera) * follow;
  }

  function worldToScreen(x, y) {
    return {
      x: Math.round(x),
      y: Math.round(viewH - (y - camera)),
    };
  }

  function fillDisk(cx, cy, rx, ry, color) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    rx = Math.max(1, Math.round(rx));
    ry = Math.max(1, Math.round(ry));
    ctx.fillStyle = color;
    var ry2 = ry * ry;
    for (var y = -ry; y <= ry; y++) {
      var span = 1 - (y * y) / ry2;
      if (span < 0) continue;
      var w = Math.round(rx * Math.sqrt(span));
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  }

  function drawRing(cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    var steps = Math.max(16, Math.round((rx + ry) * 2));
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      ctx.fillRect(
        Math.round(cx + Math.cos(a) * rx),
        Math.round(cy + Math.sin(a) * ry),
        1,
        1
      );
    }
  }

  function drawPlanet(p) {
    var c = worldToScreen(p.x, p.y);
    var sx = 1 + 0.14 * p.squash;
    var sy = 1 - 0.2 * p.squash;
    var rx = p.r * sx;
    var ry = p.r * sy;
    if (p.ring) drawRing(c.x, c.y, rx * 1.7, Math.max(2, ry * 0.4), p.pal.band);
    fillDisk(c.x, c.y, rx + 1, ry + 1, p.pal.dark);
    fillDisk(c.x, c.y, rx, ry, p.pal.body);
    fillDisk(c.x - rx * 0.22, c.y - ry * 0.26, rx * 0.46, ry * 0.4, p.pal.band);
    ctx.fillStyle = p.pal.dark;
    for (var k = 0; k < 4; k++) {
      var a = p.ang + k * 1.7;
      var cr = p.r * (0.26 + (k % 2) * 0.16);
      ctx.fillRect(
        Math.round(c.x + Math.sin(a) * cr),
        Math.round(c.y - Math.cos(a) * cr * (ry / (rx || 1))),
        k === 0 ? 2 : 1,
        1
      );
    }
    if (p.moving) {
      ctx.fillStyle = p.pal.light;
      var stripe = Math.max(1, Math.round(ry * 0.1));
      ctx.fillRect(
        Math.round(c.x - rx * 0.62),
        Math.round(c.y - stripe / 2),
        Math.round(rx * 1.24),
        stripe
      );
    }
    ctx.fillStyle = p.pal.light;
    ctx.fillRect(Math.round(c.x - rx * 0.34), Math.round(c.y - ry * 0.46), 2, 1);
    ctx.fillRect(Math.round(c.x - rx * 0.16), Math.round(c.y - ry * 0.54), 1, 1);
  }

  function drawShip() {
    var face =
      player.state === "landed"
        ? facing(player.theta, player.planet.spin)
        : { x: player.vx, y: player.vy };
    var flen = Math.hypot(face.x, face.y) || 1;
    var nx = face.x / flen;
    var ny = -face.y / flen;
    var px = -ny;
    var py = nx;
    var s = worldToScreen(player.x, player.y);
    if (shipSquash > 0) s.y += Math.round(shipSquash * 2);
    var squash = 1 - 0.42 * shipSquash;
    var pack = INK.p;
    var scale = 2;
    if (player.state === "flying" && Math.floor(time * 18) % 2 === 0) pack = "#fff3a0";
    function blit(ox, oy, force) {
      for (var i = 0; i < SHIP.length; i++) {
        var bit = SHIP[i];
        var lx = bit[0];
        var ly = bit[1] * squash;
        var x = s.x + (lx * px + ly * nx) * scale + ox;
        var y = s.y + (lx * py + ly * ny) * scale + oy;
        x = Math.round(x / scale) * scale;
        y = Math.round(y / scale) * scale;
        ctx.fillStyle = force || (bit[2] === "p" ? pack : INK[bit[2]]);
        ctx.fillRect(x, y, scale, scale);
      }
    }
    blit(scale, scale, "#140c22");
    blit(0, 0, null);
  }

  function drawAim() {
    if (phase === "over" || player.state !== "landed") return;
    var face = facing(player.theta, player.planet.spin);
    var next = nextPlanet();
    var color = next ? next.pal.light : "#fff6c8";
    var dots = hopped ? 3 : 5;
    ctx.fillStyle = color;
    for (var i = 1; i <= dots; i++) {
      var wx = player.x + face.x * (12 + i * 5);
      var wy = player.y + face.y * (12 + i * 5);
      var p = worldToScreen(wx, wy);
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }

  function drawSky() {
    ctx.fillStyle = "#070614";
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function drawStars() {
    var speeds = [0.16, 0.4, 0.72];
    var flick = Math.floor(time * 2.2);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if ((i + flick) % 23 === 0) continue;
      var parallax = speeds[s.layer];
      var sy = s.y - camera * parallax;
      sy = ((sy % viewH) + viewH) % viewH;
      var sx = s.x;
      if (s.layer === 2) sx = (s.x + Math.floor(camera * 0.03)) % viewW;
      ctx.fillStyle = s.c;
      ctx.fillRect(Math.round(sx), Math.round(sy), s.w, s.w);
    }
  }

  function textWidth(str, scale) {
    return str.length * 4 * scale - scale;
  }

  function drawText(str, x, y, scale, color, align) {
    var s = String(str).toUpperCase();
    var width = textWidth(s, scale);
    var cx = Math.round(x);
    if (align === "center") cx = Math.round(x - width / 2);
    else if (align === "right") cx = Math.round(x - width);
    var cy = Math.round(y);
    for (var i = 0; i < s.length; i++) {
      var glyph = FONT[s.charAt(i)];
      if (glyph) {
        for (var r = 0; r < 5; r++) {
          for (var c = 0; c < 3; c++) {
            if (glyph[r].charAt(c) !== "1") continue;
            ctx.fillStyle = "#140a22";
            ctx.fillRect(cx + c * scale + 1, cy + r * scale + 1, scale, scale);
            ctx.fillStyle = color;
            ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
          }
        }
      }
      cx += 4 * scale;
    }
  }

  function drawBanner(text, y, color) {
    var scale = 2;
    var tw = textWidth(text, scale);
    var w = tw + 16;
    var h = 5 * scale + 10;
    var x = Math.round((viewW - w) / 2);
    y = Math.round(y);
    ctx.fillStyle = "#120a22";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    drawText(text, viewW / 2, y + 5, scale, color, "center");
  }

  function drawHud() {
    var scale = pop > 0.4 ? 4 : 3;
    drawText(String(score), viewW / 2, 8, scale, "#fff6e0", "center");
    drawText("BEST " + best, viewW / 2, scale === 4 ? 30 : 27, 1, "#f0c98a", "center");
    if (phase === "play" && !hopped) {
      var hintY = viewH - 36;
      if (player && player.planet) {
        var seat = worldToScreen(player.planet.x, player.planet.y);
        if (seat.y + player.planet.r + 6 > hintY) hintY = 42;
      }
      drawBanner("TAP TO HOP", hintY, "#fff6e0");
    } else if (phase === "over") {
      var y = Math.round(viewH * 0.4);
      drawBanner("GAME OVER", y, "#ff5d73");
      drawBanner("TAP TO RETRY", y + 26, "#fff6e0");
    }
  }

  function drawFx() {
    for (var i = 0; i < trail.length; i++) {
      var bit = trail[i];
      var p = worldToScreen(bit.x, bit.y);
      ctx.fillStyle = i % 2 ? "#6ffbff" : "#fff6c8";
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    for (var j = 0; j < particles.length; j++) {
      var part = particles[j];
      var sp = worldToScreen(part.x, part.y);
      ctx.fillStyle = part.color;
      ctx.fillRect(sp.x, sp.y, 2, 2);
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    drawSky();
    drawStars();
    ctx.save();
    if (shake > 0 && !reduce) {
      var mag = shake > 3 ? 2 : 1;
      var ox = Math.floor(time * 46) % 2 === 0 ? -mag : mag;
      var oy = Math.floor(time * 31) % 2 === 0 ? mag : -mag;
      ctx.translate(ox, oy);
    } else if (shake > 0) {
      ctx.translate(1, 0);
    }
    for (var i = 0; i < planets.length; i++) drawPlanet(planets[i]);
    drawFx();
    if (player) {
      drawShip();
      drawAim();
    }
    ctx.restore();
    drawHud();
    if (phase === "over" && shake > 0.4) {
      ctx.fillStyle = "#ff3b5c";
      ctx.fillRect(0, 0, viewW, 2);
      ctx.fillRect(0, viewH - 2, viewW, 2);
      ctx.fillRect(0, 0, 2, viewH);
      ctx.fillRect(viewW - 2, 0, 2, viewH);
    }
  }

  function loop(now) {
    window.requestAnimationFrame(loop);
    if (document.hidden) {
      last = 0;
      return;
    }
    var dt = last ? Math.min(0.033, (now - last) / 1000) : 0.016;
    last = now;
    update(dt);
    draw();
  }

  function act(now) {
    if (!booted) return;
    if (now < lockUntil) return;
    unlockAudio();
    if (phase === "over") {
      reset();
      lockUntil = now + 240;
      return;
    }
    if (player && player.state === "landed") launch();
  }

  function onPointer(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.isPrimary === false) return;
    if (e.target && e.target.closest && e.target.closest("#mute")) return;
    if (e.cancelable) e.preventDefault();
    act(performance.now());
  }

  function onKey(e) {
    if (e.code !== "Space" && e.key !== " ") return;
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest("#mute")) return;
    e.preventDefault();
    act(performance.now());
  }

  function fit() {
    var vw = stage.clientWidth;
    var vh = stage.clientHeight;
    if (vw < 8 || vh < 8) return false;
    var scale = 1;
    while ((scale + 1) * VIEW_W <= vw && (scale + 1) * 240 <= vh && scale < 6) {
      scale += 1;
    }
    var lh = Math.floor(vh / scale);
    if (lh > 320) lh = 320;
    if (lh < 1) lh = 1;
    viewW = VIEW_W;
    viewH = lh;
    canvas.width = viewW;
    canvas.height = viewH;
    canvas.style.width = viewW * scale + "px";
    canvas.style.height = viewH * scale + "px";
    ctx.imageSmoothingEnabled = false;
    return true;
  }

  function onResize() {
    fit();
  }

  if (muteBtn) {
    muteBtn.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    });
    muteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      soundOn = !soundOn;
      try {
        window.localStorage.setItem(MUTE_KEY, soundOn ? "0" : "1");
      } catch (err) {
        /* ignore blocked storage */
      }
      paintMute();
      if (soundOn) blip(660, 0.05, "square", 0.035, 880);
    });
  }

  window.addEventListener("pointerdown", onPointer, { passive: false });
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
  }
  document.addEventListener(
    "touchmove",
    function (e) {
      if (e.cancelable) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  window.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener("gesturestart", function (e) {
    e.preventDefault();
  });

  function snapshot() {
    var face = { x: 0, y: 1 };
    if (player && player.state === "landed" && player.planet) {
      face = facing(player.theta, player.planet.spin);
    }
    var upcoming = player ? nextPlanet() : null;
    return {
      score: score,
      best: best,
      phase: phase,
      state: player ? player.state : "none",
      theta: player ? player.theta : 0,
      x: player ? player.x : 0,
      y: player ? player.y : 0,
      fx: face.x,
      fy: face.y,
      py: player && player.planet ? player.planet.y : 0,
      pr: player && player.planet ? player.planet.r : 0,
      spin: player && player.planet ? player.planet.spin : 0,
      vx: player ? player.vx : 0,
      vy: player ? player.vy : 0,
      next: upcoming
        ? { x: upcoming.x, y: upcoming.y, r: upcoming.r, moving: upcoming.moving }
        : null,
      planets: planets.length,
      viewW: viewW,
      viewH: viewH,
      hopped: hopped,
      sound: soundOn,
    };
  }

  window.__orbitHop = { snapshot: snapshot };

  function boot() {
    if (!fit()) {
      window.requestAnimationFrame(boot);
      return;
    }
    best = loadBest();
    loadSound();
    reset();
    booted = true;
    window.requestAnimationFrame(loop);
  }

  boot();
})();
