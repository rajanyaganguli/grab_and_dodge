/**
 * game.js — GRAB & DODGE
 * Physics, scoring, rendering. Hand-tracking via HandTracker module.
 *
 * Object types: ball / diamond / star / bomb
 * Scores      : +5   / +8      / +15  / -10
 */

/* ══════════════════════════════════════════════════════════════
   CONFIG  (unchanged)
══════════════════════════════════════════════════════════════ */
const GAME_DURATION = 60;

const STAGES = [
  { label: '🌱 Warm-Up',    spawnMs: 1500, speedMin: 2.2, speedMax: 3.6 },
  { label: '🔥 Heating Up', spawnMs: 1100, speedMin: 3.2, speedMax: 5.0 },
  { label: '⚡ Intense',    spawnMs:  800, speedMin: 4.2, speedMax: 6.2 },
  { label: '💥 MAX SPEED',  spawnMs:  600, speedMin: 5.5, speedMax: 7.8 },
];

function getStageIndex(t) {
  if (t > 40) return 0;
  if (t > 20) return 1;
  if (t > 10) return 2;
  return 3;
}

const BALL_RADIUS_BASE = 16;
const BUCKET_W         = 120;
const BUCKET_H         = 52;
const BUCKET_Y_FRAC    = 0.87;
const LERP_SPEED       = 10;

/* ── Object type definitions ──────────────────────────────── */
const OBJ_TYPES = [
  { type: 'ball',    label: 'Ball',    points: +5,  weight: 0.36 },
  { type: 'diamond', label: 'Diamond', points: +8,  weight: 0.30 },
  { type: 'star',    label: 'Star',    points: +15, weight: 0.15 },
  { type: 'bomb',    label: 'Bomb',    points: -10, weight: 0.19 },
];

function pickObjType() {
  const r = Math.random();
  let acc = 0;
  for (const o of OBJ_TYPES) { acc += o.weight; if (r < acc) return o; }
  return OBJ_TYPES[0];
}

/* ══════════════════════════════════════════════════════════════
   DOM
══════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const startScreen    = $('startScreen');
const gameScreen     = $('gameScreen');
const gameOverScreen = $('gameOverScreen');

const enableCamBtn   = $('enableCamBtn');
const startBtn       = $('startBtn');
const playAgainBtn   = $('playAgainBtn');
const mainMenuBtn    = $('mainMenuBtn');
const camErrorEl     = $('camError');
const camStatusEl    = $('camStatus');
const handStatusEl   = $('handStatus');

const scoreDisplay   = $('scoreDisplay');
const timerDisplay   = $('timerDisplay');
const stageDisplay   = $('stageDisplay');
const finalScoreEl   = $('finalScore');
const scoreRatingEl  = $('scoreRating');
const bestScoreDisplay = $('bestScoreDisplay');
const newBestBanner    = $('newBestBanner');

// Collection stat elements
const colBall    = $('col-ball');    const colBallPts    = $('col-ball-pts');
const colDiamond = $('col-diamond'); const colDiamondPts = $('col-diamond-pts');
const colStar    = $('col-star');    const colStarPts    = $('col-star-pts');
const colBomb    = $('col-bomb');    const colBombPts    = $('col-bomb-pts');

const startVideo   = $('startVideo');
const startOverlay = $('startOverlay');
const gameVideo    = $('gameVideo');
const gameOverlay  = $('gameOverlay');

const canvas = $('gameCanvas');
const ctx    = canvas.getContext('2d');

/* ══════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════ */
let score       = 0;
let timeLeft    = GAME_DURATION;
let stageIdx    = 0;
let gameRunning = false;
let collection  = { ball: 0, diamond: 0, star: 0, bomb: 0 };

let controlMode  = 'hand';   // 'hand' | 'mouse'
let mouseX       = 0.5;      // normalised 0–1, used only in mouse mode

let balls        = [];
let spawnTimerId = null;
let countdownId  = null;
let rafId        = null;
let lastTs       = null;

let bucketSmooth = 0.5;
let audioCtx     = null;
let bgGrad       = null;
let canvasW      = 0;
let canvasH      = 0;

/* ══════════════════════════════════════════════════════════════
   AUDIO  (unchanged)
══════════════════════════════════════════════════════════════ */
function ensureAudio() {
  if (!audioCtx)
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
}

function beep(freq, dur, type = 'sine', vol = 0.15) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.connect(g); g.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.start(); osc.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}

function playCatch()   { beep(660, 0.08); setTimeout(() => beep(880, 0.07), 55); }
function playBomb()    { beep(180, 0.18, 'sawtooth', 0.2); }
function playStageUp() {
  beep(440, 0.09, 'triangle');
  setTimeout(() => beep(560, 0.09, 'triangle'), 110);
  setTimeout(() => beep(700, 0.14, 'triangle'), 220);
}

/* ══════════════════════════════════════════════════════════════
   CANVAS SIZING  (unchanged)
══════════════════════════════════════════════════════════════ */
function resizeCanvas() {
  const area = document.querySelector('.game-area');
  if (!area) return;
  const w = area.clientWidth, h = area.clientHeight;
  if (w === canvasW && h === canvasH) return;
  canvas.width  = canvasW = w;
  canvas.height = canvasH = h;
  bgGrad = null;
}
window.addEventListener('resize', resizeCanvas);

/* Mouse position tracking — used only when controlMode === 'mouse' */
document.addEventListener('mousemove', (e) => {
  if (controlMode !== 'mouse' || !gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  mouseX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
});

/* ══════════════════════════════════════════════════════════════
   BACKGROUND  (unchanged)
══════════════════════════════════════════════════════════════ */
function ensureBgGrad() {
  if (bgGrad) return;
  bgGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
  bgGrad.addColorStop(0,    '#dde8f2');
  bgGrad.addColorStop(0.55, '#e8f0f8');
  bgGrad.addColorStop(1,    '#dde6ef');
}

function drawBackground() {
  ensureBgGrad();
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);
  const groundY = canvasH * 0.87;
  ctx.save();
  ctx.strokeStyle = 'rgba(44,62,80,0.08)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(0, groundY + 52);
  ctx.lineTo(canvasW, groundY + 52);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   BUCKET DRAWING  (completely unchanged)
══════════════════════════════════════════════════════════════ */
function drawBucket(cx, ty, w, h) {
  const lx = cx - w / 2;
  ctx.save();
  const topInset = 8, botFlare = 5;
  const tl = { x: lx + topInset,     y: ty };
  const tr = { x: lx + w - topInset, y: ty };
  const br = { x: lx + w + botFlare, y: ty + h };
  const bl = { x: lx - botFlare,     y: ty + h };

  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(lx, ty, lx + w, ty + h);
  bodyGrad.addColorStop(0,   '#e8a87c');
  bodyGrad.addColorStop(0.5, '#d4784a');
  bodyGrad.addColorStop(1,   '#c06030');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.lineWidth = 2.8; ctx.strokeStyle = '#7a3c18';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  function jit(v) { return v + Math.sin(v * 0.37) * 0.8; }
  ctx.beginPath();
  ctx.moveTo(jit(tl.x), jit(tl.y)); ctx.lineTo(jit(tr.x), jit(tr.y));
  ctx.lineTo(jit(br.x), jit(br.y)); ctx.lineTo(jit(bl.x), jit(bl.y));
  ctx.closePath(); ctx.stroke();

  const rimH = 7, rimInset = topInset - 4;
  ctx.beginPath();
  ctx.moveTo(lx + rimInset - 4, ty);
  ctx.lineTo(lx + w - rimInset + 4, ty);
  ctx.lineWidth = rimH; ctx.strokeStyle = '#5c2a0e'; ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(lx + rimInset - 2, ty - rimH / 2 + 1);
  ctx.lineTo(lx + w - rimInset + 2, ty - rimH / 2 + 1);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,200,150,0.65)';
  ctx.stroke();

  const stripeY   = ty + h * 0.42;
  const sL = bl.x, sR = br.x;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
  ctx.closePath(); ctx.clip();

  ctx.beginPath(); ctx.moveTo(sL, stripeY); ctx.lineTo(sR, stripeY);
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(90,30,5,0.18)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sL, stripeY + 10); ctx.lineTo(sR, stripeY + 10);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(90,30,5,0.10)'; ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tl.x + 10, ty + 10); ctx.lineTo(tl.x + 26, ty + h * 0.52);
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,220,180,0.30)';
  ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   OBJECT SHAPE DRAWING  — real silhouettes, no emoji
══════════════════════════════════════════════════════════════ */

/* Helper — draw a star polygon */
function starPath(cx, cy, outerR, innerR, points) {
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r   = i % 2 === 0 ? outerR : innerR;
    const ang = i * step - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    else         ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
  }
  ctx.closePath();
}

/* Helper — hex shade */
function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = v => Math.max(0, Math.min(255, v));
  const r  = cl((n >> 16) + amt);
  const g  = cl(((n >> 8) & 0xff) + amt);
  const b  = cl((n & 0xff) + amt);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function drawObject(obj) {
  const { x, y, r, type, catchAnim } = obj;

  ctx.save();
  ctx.shadowColor    = 'rgba(44,62,80,0.20)';
  ctx.shadowBlur     = 6;
  ctx.shadowOffsetX  = 1;
  ctx.shadowOffsetY  = 2;

  switch (type) {

    /* ── BALL: glossy sphere ─────────────────────────── */
    case 'ball': {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.04, x, y, r);
      g.addColorStop(0,    '#ffffff');
      g.addColorStop(0.25, '#5b9cf6');   // cornflower blue
      g.addColorStop(1,    '#1d4ed8');   // deep blue
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      /* Curved shine line */
      ctx.beginPath();
      ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.4, 0.8, 2.3);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.stroke();
      break;
    }

    /* ── DIAMOND: rhombus with facets ───────────────── */
    case 'diamond': {
      const top  = { x, y: y - r * 1.2 };
      const mid1 = { x: x - r * 0.9, y };
      const bot  = { x, y: y + r * 1.1 };
      const mid2 = { x: x + r * 0.9, y };

      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(mid2.x, mid2.y);
      ctx.lineTo(bot.x,  bot.y);
      ctx.lineTo(mid1.x, mid1.y);
      ctx.closePath();

      const dg = ctx.createLinearGradient(x - r, y - r * 1.2, x + r, y + r * 1.1);
      dg.addColorStop(0,   '#a5f3fc');  // light cyan
      dg.addColorStop(0.4, '#22d3ee');  // cyan
      dg.addColorStop(1,   '#0e7490');  // deep teal
      ctx.fillStyle = dg;
      ctx.fill();

      ctx.shadowBlur  = 0;
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth   = 1.6;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      /* Inner facet line */
      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.lineTo(top.x,  top.y);
      ctx.lineTo(mid2.x, mid2.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = 1.2;
      ctx.stroke();
      break;
    }

    /* ── STAR: 5-pointed silhouette ─────────────────── */
    case 'star': {
      starPath(x, y, r * 1.15, r * 0.48, 5);
      const sg = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r * 1.15);
      sg.addColorStop(0,   '#fef08a');  // pale yellow
      sg.addColorStop(0.5, '#facc15');  // gold
      sg.addColorStop(1,   '#ca8a04');  // dark gold
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.stroke();
      /* Glint on top point */
      ctx.beginPath();
      ctx.arc(x - r * 0.1, y - r * 0.9, r * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = 0;
      ctx.fill();
      break;
    }

    /* ── BOMB: round body + fuse ────────────────────── */
    case 'bomb': {
      const bodyR = r * 0.9;

      /* Body */
      const bg = ctx.createRadialGradient(x - bodyR * 0.3, y - bodyR * 0.3, bodyR * 0.05, x, y, bodyR);
      bg.addColorStop(0,   '#6b7280');   // mid grey
      bg.addColorStop(0.5, '#374151');   // dark grey
      bg.addColorStop(1,   '#111827');   // near-black
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, bodyR, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur  = 0;
      ctx.strokeStyle = '#030712';
      ctx.lineWidth   = 1.4;
      ctx.stroke();

      /* Fuse — squiggly line from top of bomb */
      const fuseBaseX = x + bodyR * 0.18;
      const fuseBaseY = y - bodyR * 0.95;
      ctx.beginPath();
      ctx.moveTo(fuseBaseX, fuseBaseY);
      ctx.bezierCurveTo(
        fuseBaseX + 7, fuseBaseY - 5,
        fuseBaseX - 5, fuseBaseY - 12,
        fuseBaseX + 4, fuseBaseY - 18
      );
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth   = 2.2;
      ctx.lineCap     = 'round';
      ctx.stroke();

      /* Spark at top of fuse */
      ctx.beginPath();
      ctx.arc(fuseBaseX + 4, fuseBaseY - 19, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();

      /* Shine on body */
      ctx.beginPath();
      ctx.arc(x - bodyR * 0.28, y - bodyR * 0.3, bodyR * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      break;
    }
  }

  ctx.restore();

  /* Catch burst ring */
  if (catchAnim > 0) {
    ctx.save();
    ctx.globalAlpha = catchAnim;
    ctx.strokeStyle = type === 'bomb' ? '#ef4444' : '#22c55e';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.3 + (1 - catchAnim) * 1.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════════════
   PARTICLES
══════════════════════════════════════════════════════════════ */
function spawnParticle(cx, cy, label) {
  const area     = document.querySelector('.game-area');
  const areaRect = area.getBoundingClientRect();
  const cnvRect  = canvas.getBoundingClientRect();
  const p = document.createElement('div');
  p.className   = 'particle';
  p.textContent = label || '+5';
  p.style.color = label && label.startsWith('-') ? '#dc2626' : '#16a34a';
  p.style.left  = (cnvRect.left - areaRect.left + cx - 22) + 'px';
  p.style.top   = (cnvRect.top  - areaRect.top  + cy - 22) + 'px';
  area.appendChild(p);
  setTimeout(() => p.remove(), 850);
}

/* ══════════════════════════════════════════════════════════════
   STAGE BANNER
══════════════════════════════════════════════════════════════ */
let bannerTid = null;
function showBanner(text) {
  let el = $('stageBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stageBanner';
    document.querySelector('.game-area').appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  if (bannerTid) clearTimeout(bannerTid);
  bannerTid = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ══════════════════════════════════════════════════════════════
   OBJECT FACTORY + SPAWNING
══════════════════════════════════════════════════════════════ */
function makeObj() {
  const st     = STAGES[stageIdx];
  const margin = BALL_RADIUS_BASE + 12;
  const obj    = pickObjType();
  return {
    x:         margin + Math.random() * (canvasW - margin * 2),
    y:         -(BALL_RADIUS_BASE + 8),
    r:         BALL_RADIUS_BASE - 2 + Math.random() * 7,
    speed:     st.speedMin + Math.random() * (st.speedMax - st.speedMin),
    type:      obj.type,
    points:    obj.points,
    caught:    false,
    catchAnim: 0,
  };
}

function spawnBall() {
  if (!gameRunning) return;
  balls.push(makeObj());
}

function resetSpawnTimer() {
  if (spawnTimerId) clearInterval(spawnTimerId);
  if (!gameRunning) return;
  spawnTimerId = setInterval(spawnBall, STAGES[stageIdx].spawnMs);
}

/* ══════════════════════════════════════════════════════════════
   UPDATE  (physics/collision UNCHANGED)
══════════════════════════════════════════════════════════════ */
function update(dt) {
  const target = controlMode === 'mouse'
    ? mouseX
    : (HandTracker.isHandDetected() ? HandTracker.getHandX() : bucketSmooth);
  bucketSmooth += (target - bucketSmooth) * Math.min(1, dt * LERP_SPEED);

  const halfW = BUCKET_W / 2;
  bucketSmooth = Math.max(halfW / canvasW, Math.min(1 - halfW / canvasW, bucketSmooth));

  const bCx   = bucketSmooth * canvasW;
  const bTop  = canvasH * BUCKET_Y_FRAC;
  const bLeft = bCx - BUCKET_W / 2 - 4;
  const bRight = bCx + BUCKET_W / 2 + 4;

  for (const b of balls) {
    if (b.caught) {
      b.catchAnim = Math.max(0, b.catchAnim - dt * 2.5);
      continue;
    }

    b.y += b.speed * dt * 60;

    const prevY = b.y - b.speed * dt * 60;
    const ballL = b.x - b.r * 0.6;
    const ballR = b.x + b.r * 0.6;

    const crossedRim   = (b.y + b.r) >= bTop && (prevY + b.r) < bTop + b.speed * dt * 60 + 8;
    const inBucketX    = ballR > bLeft && ballL < bRight;
    const insideBucket = b.y >= bTop && b.y <= bTop + BUCKET_H && inBucketX;

    if ((crossedRim && inBucketX) || insideBucket) {
      b.caught    = true;
      b.catchAnim = 1;
      score = Math.max(0, score + b.points);
      scoreDisplay.textContent = score;
      if (collection[b.type] !== undefined) collection[b.type]++;
      const ptLabel = b.points > 0 ? `+${b.points}` : `${b.points}`;
      if (b.type === 'bomb') playBomb(); else playCatch();
      spawnParticle(b.x, bTop, ptLabel);
    }
  }

  balls = balls.filter(b => {
    if (b.caught && b.catchAnim <= 0) return false;
    if (!b.caught && b.y - b.r > canvasH) return false;
    return true;
  });
}

/* ══════════════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════════════ */
function render() {
  resizeCanvas();
  drawBackground();
  for (const b of balls) drawObject(b);
  drawBucket(bucketSmooth * canvasW, canvasH * BUCKET_Y_FRAC, BUCKET_W, BUCKET_H);
}

/* ══════════════════════════════════════════════════════════════
   GAME LOOP  (unchanged)
══════════════════════════════════════════════════════════════ */
function loop(ts) {
  if (!gameRunning) return;
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  update(dt);
  render();

  if (controlMode === 'mouse') {
    handStatusEl.textContent = '🖱️ Mouse Control';
    handStatusEl.style.color = '#3b82f6';
  } else if (HandTracker.isHandDetected()) {
    handStatusEl.textContent = '✅ Hand Detected';
    handStatusEl.style.color = '#16a34a';
  } else {
    handStatusEl.textContent = '👀 Show your hand...';
    handStatusEl.style.color = '#d97706';
  }

  rafId = requestAnimationFrame(loop);
}

/* ══════════════════════════════════════════════════════════════
   STAGE CHECK
══════════════════════════════════════════════════════════════ */
function checkStage() {
  const idx = getStageIndex(timeLeft);
  if (idx !== stageIdx) {
    stageIdx = idx;
    stageDisplay.textContent = idx + 1;
    stageDisplay.style.color = ['#22c55e','#f59e0b','#fb923c','#ef4444'][idx];
    showBanner(STAGES[idx].label);
    playStageUp();
    resetSpawnTimer();
  }
}

/* ══════════════════════════════════════════════════════════════
   COUNTDOWN  (unchanged)
══════════════════════════════════════════════════════════════ */
function startCountdown() {
  countdownId = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;
    timerDisplay.classList.toggle('urgent', timeLeft <= 10);
    checkStage();
    if (timeLeft <= 0) endGame();
  }, 1000);
}

/* ══════════════════════════════════════════════════════════════
   SCORE RATING
══════════════════════════════════════════════════════════════ */
function rating(s) {
  if (s >= 150) return '🏆 Legend! Incredible reflexes!';
  if (s >= 100) return '⭐ Amazing! You\'re a pro!';
  if (s >=  60) return '👍 Great job! Well played!';
  if (s >=  25) return '😊 Good effort! Keep practising!';
  return '🌱 Just getting started — try again!';
}

/* ══════════════════════════════════════════════════════════════
   LIFECYCLE
══════════════════════════════════════════════════════════════ */
function showScreen(el) {
  [startScreen, gameScreen, gameOverScreen].forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

function startGame() {
  ensureAudio();
  score        = 0;
  timeLeft     = GAME_DURATION;
  stageIdx     = 0;
  balls        = [];
  lastTs       = null;
  gameRunning  = true;
  bucketSmooth = 0.5;
  collection   = { ball: 0, diamond: 0, star: 0, bomb: 0 };

  /* Read selected control mode from UI */
  const activeBtn = document.querySelector('.ctrl-btn.active');
  controlMode = activeBtn ? activeBtn.dataset.mode : 'hand';
  mouseX      = 0.5;

  scoreDisplay.textContent = '0';
  timerDisplay.textContent = GAME_DURATION;
  timerDisplay.classList.remove('urgent');
  stageDisplay.textContent = '1';
  stageDisplay.style.color = '#22c55e';

  /* Show/hide webcam panel during game depending on mode */
  const webcamPanel = $('webcamPanel');
  if (webcamPanel) webcamPanel.style.display = controlMode === 'mouse' ? 'none' : '';

  showScreen(gameScreen);

  requestAnimationFrame(() => {
    resizeCanvas();
    bgGrad = null;
    if (controlMode === 'hand') {
      HandTracker.switchTo(gameVideo, gameOverlay)
        .catch(e => console.warn('HandTracker.switchTo:', e));
    }
    setTimeout(spawnBall, 500);
    resetSpawnTimer();
    startCountdown();
    rafId = requestAnimationFrame(loop);
  });
}

function endGame() {
  gameRunning = false;
  if (spawnTimerId) { clearInterval(spawnTimerId); spawnTimerId = null; }
  if (countdownId)  { clearInterval(countdownId);  countdownId  = null; }
  if (rafId)        { cancelAnimationFrame(rafId);  rafId        = null; }

  const prevBest  = parseInt(localStorage.getItem('grabDodgeBest') || '0', 10);
  const isNewBest = score > prevBest;
  if (isNewBest) localStorage.setItem('grabDodgeBest', score);
  const bestScore = isNewBest ? score : prevBest;

  finalScoreEl.textContent     = score;
  scoreRatingEl.textContent    = rating(score);
  bestScoreDisplay.textContent = bestScore;
  newBestBanner.style.display  = isNewBest ? 'block' : 'none';

  colBall.textContent       = `${collection.ball} caught`;
  colBallPts.textContent    = `+${collection.ball * 5} pts`;
  colDiamond.textContent    = `${collection.diamond} caught`;
  colDiamondPts.textContent = `+${collection.diamond * 8} pts`;
  colStar.textContent       = `${collection.star} caught`;
  colStarPts.textContent    = `+${collection.star * 15} pts`;
  colBomb.textContent       = `${collection.bomb} caught`;
  colBombPts.textContent    = `−${collection.bomb * 10} pts`;

  setTimeout(() => showScreen(gameOverScreen), 500);
}

/* ══════════════════════════════════════════════════════════════
   BUTTON HANDLERS
══════════════════════════════════════════════════════════════ */
enableCamBtn.addEventListener('click', async () => {
  camErrorEl.textContent  = '';
  camStatusEl.textContent = '⏳ Starting camera…';
  camStatusEl.style.color = '';
  enableCamBtn.disabled   = true;

  try {
    await HandTracker.startCamera(startVideo, startOverlay, (detected) => {
      camStatusEl.textContent = detected
        ? '✅ Hand Detected — ready!'
        : '👀 Show your hand to begin…';
      camStatusEl.style.color = detected ? '#16a34a' : '#d97706';
    });
    startBtn.disabled        = false;
    enableCamBtn.textContent = '✅ Webcam Active';
    enableCamBtn.disabled    = true;
    camStatusEl.textContent  = '📷 Camera on — show your hand';
  } catch (err) {
    enableCamBtn.disabled   = false;
    camStatusEl.textContent = '❌ Camera error';
    camStatusEl.style.color = '#dc2626';
    camErrorEl.textContent  =
      err.name === 'NotAllowedError' ? '⚠️ Camera permission denied. Please allow access and reload.' :
      err.name === 'NotFoundError'   ? '⚠️ No webcam found. Please connect a camera.' :
                                       '⚠️ Camera error: ' + err.message;
  }
});

startBtn.addEventListener('click', () => {
  const activeBtn = document.querySelector('.ctrl-btn.active');
  const mode = activeBtn ? activeBtn.dataset.mode : 'hand';
  if (mode === 'hand' && !HandTracker.hasStream()) {
    camErrorEl.textContent = '⚠️ Please enable the webcam first, or switch to Mouse Control!';
    return;
  }
  startGame();
});

playAgainBtn.addEventListener('click', () => startGame());
mainMenuBtn.addEventListener('click', () => {
  /* Always reset to Hand Tracking default when returning to Main Menu */
  controlMode = 'hand';
  const handBtn  = $('ctrlHandBtn');
  const mouseBtn = $('ctrlMouseBtn');
  if (handBtn)  handBtn.classList.add('active');
  if (mouseBtn) mouseBtn.classList.remove('active');
  /* Restore webcam section visibility */
  const camWrapper = $('camPreviewWrapper');
  const enableBtn  = $('enableCamBtn');
  const mouseNote  = $('mouseNote');
  if (camWrapper) camWrapper.style.display = '';
  if (enableBtn)  enableBtn.style.display  = '';
  if (mouseNote)  mouseNote.style.display  = 'none';
  /* Only enable Start if webcam is already active */
  startBtn.disabled = !HandTracker.hasStream();
  camErrorEl.textContent = '';
  /* Restore webcam panel in game screen */
  const webcamPanel = $('webcamPanel');
  if (webcamPanel) webcamPanel.style.display = '';
  showScreen(startScreen);
});

/* ══════════════════════════════════════════════════════════════
   CONTROL MODE SELECTOR HANDLERS
══════════════════════════════════════════════════════════════ */
function applyControlMode(mode) {
  controlMode = mode;
  const camWrapper = $('camPreviewWrapper');
  const enableBtn  = $('enableCamBtn');
  const mouseNote  = $('mouseNote');

  if (mode === 'mouse') {
    /* Mouse mode: hide webcam section, enable Start immediately */
    if (camWrapper) camWrapper.style.display = 'none';
    if (enableBtn)  enableBtn.style.display  = 'none';
    if (mouseNote)  mouseNote.style.display  = '';
    startBtn.disabled = false;
    camErrorEl.textContent = '';
  } else {
    /* Hand tracking mode: show webcam section, Start only after cam enabled */
    if (camWrapper) camWrapper.style.display = '';
    if (enableBtn)  enableBtn.style.display  = '';
    if (mouseNote)  mouseNote.style.display  = 'none';
    startBtn.disabled = !HandTracker.hasStream();
  }
}

$('ctrlHandBtn').addEventListener('click', () => {
  $('ctrlHandBtn').classList.add('active');
  $('ctrlMouseBtn').classList.remove('active');
  applyControlMode('hand');
});

$('ctrlMouseBtn').addEventListener('click', () => {
  $('ctrlMouseBtn').classList.add('active');
  $('ctrlHandBtn').classList.remove('active');
  applyControlMode('mouse');
});

/* ══════════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════════ */
showScreen(startScreen);
