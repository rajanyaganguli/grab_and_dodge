/**
 * handtracking.js — GRAB & DODGE
 *
 * ROOT-CAUSE FIX:
 * The @mediapipe/camera_utils Camera class re-opens its own getUserMedia stream
 * and races with any stream set via srcObject, causing silent failures.
 * Fix: acquire the stream ourselves, attach it, then drive MediaPipe with our
 * own requestAnimationFrame loop — no Camera utility needed.
 */

const HandTracker = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let hands          = null;
  let stream         = null;
  let activeVideo    = null;
  let activeCanvas   = null;
  let statusCallback = null;
  let rafLoopId      = null;
  let loopRunning    = false;

  let handX          = 0.5;
  let handDetected   = false;

  const WRIST_IDX = 0;
  const INDEX_MCP = 5;

  /* ── Overlay drawing ────────────────────────────────────── */
  function drawOverlay(results) {
    const cv = activeCanvas;
    if (!cv) return;
    const c  = cv.getContext('2d');
    const dw = cv.offsetWidth  || 180;
    const dh = cv.offsetHeight || 135;
    if (cv.width  !== dw) cv.width  = dw;
    if (cv.height !== dh) cv.height = dh;
    c.clearRect(0, 0, cv.width, cv.height);
    if (!results.multiHandLandmarks?.length) return;
    for (const lm of results.multiHandLandmarks) {
      if (window.drawConnectors && window.HAND_CONNECTIONS)
        drawConnectors(c, lm, HAND_CONNECTIONS, { color: 'rgba(0,220,160,0.8)', lineWidth: 2 });
      if (window.drawLandmarks)
        drawLandmarks(c, lm, { color: '#00e8a8', lineWidth: 1, radius: 4 });
    }
  }

  /* ── MediaPipe result callback ──────────────────────────── */
  function onResults(results) {
    drawOverlay(results);
    if (results.multiHandLandmarks?.length) {
      const lm = results.multiHandLandmarks[0];
      handX        = 1 - (lm[WRIST_IDX].x + lm[INDEX_MCP].x) / 2;
      handDetected = true;
    } else {
      handDetected = false;
    }
    if (statusCallback) statusCallback(handDetected, handX);
  }

  /* ── Build Hands once ───────────────────────────────────── */
  function ensureHands() {
    if (hands) return;
    hands = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`
    });
    hands.setOptions({
      maxNumHands:            1,
      modelComplexity:        0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence:  0.45,
    });
    hands.onResults(onResults);
  }

  /* ── rAF detection loop ─────────────────────────────────── */
  function stopLoop() {
    loopRunning = false;
    if (rafLoopId) { cancelAnimationFrame(rafLoopId); rafLoopId = null; }
  }

  function startLoop() {
    stopLoop();
    loopRunning = true;
    async function tick() {
      if (!loopRunning) return;
      const vid = activeVideo;
      if (vid && vid.readyState >= 2 && hands) {
        try { await hands.send({ image: vid }); } catch (_) {}
      }
      if (loopRunning) rafLoopId = requestAnimationFrame(tick);
    }
    rafLoopId = requestAnimationFrame(tick);
  }

  /* ── Attach stream to a video element ───────────────────── */
  function attachStream(videoEl) {
    return new Promise((resolve) => {
      videoEl.srcObject   = stream;
      videoEl.muted       = true;
      videoEl.playsInline = true;
      if (videoEl.readyState >= 2) { videoEl.play().catch(() => {}); resolve(); return; }
      videoEl.addEventListener('loadeddata', () => { videoEl.play().catch(() => {}); resolve(); }, { once: true });
      setTimeout(resolve, 2500); // fallback
    });
  }

  /* ── PUBLIC: startCamera ────────────────────────────────── */
  async function startCamera(videoEl, canvasEl, cb) {
    activeVideo    = videoEl;
    activeCanvas   = canvasEl;
    statusCallback = cb;
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
    }
    await attachStream(videoEl);
    ensureHands();
    startLoop();
  }

  /* ── PUBLIC: switchTo ───────────────────────────────────── */
  async function switchTo(videoEl, canvasEl) {
    if (!stream) return;
    activeVideo  = videoEl;
    activeCanvas = canvasEl;
    await attachStream(videoEl);
    ensureHands();
    startLoop();
  }

  /* ── PUBLIC: stop ───────────────────────────────────────── */
  function stop() {
    stopLoop();
    if (hands)  { hands.close();   hands  = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    handDetected = false;
  }

  return {
    startCamera,
    switchTo,
    stop,
    getHandX:       () => handX,
    isHandDetected: () => handDetected,
    hasStream:      () => !!stream,
  };
})();
