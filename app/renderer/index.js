
const video   = document.getElementById("video");
const overlay = document.getElementById("overlay");
const draw    = document.getElementById("draw");
const ctxO    = overlay.getContext("2d");
const ctxD    = draw.getContext("2d", { alpha: true });

const modeLabel   = document.getElementById("mode-label");
const clearBtn    = document.getElementById("clear-btn");
const saveBtn     = document.getElementById("save-btn");
const strokeRange = document.getElementById("stroke");
const strokeVal   = document.getElementById("stroke-val");
const guidesChk   = document.getElementById("guides");

let lineWidth   = +(strokeRange?.value || 4);
let pinchActive = false;
let eraseActive = false;
let lastPoint   = null;
let ws          = null;

let showGuides = true;
if (guidesChk) {
  guidesChk.checked = true;
  guidesChk.onchange = () => (showGuides = guidesChk.checked);
}

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  for (const c of [overlay, draw]) {
    const rect = c.parentElement.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    c.style.width = rect.width + "px";
    c.style.height = rect.height + "px";
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctxD.lineCap = "round";
  ctxD.lineJoin = "round";
}
addEventListener("resize", resize, { passive: true });

if (strokeRange && strokeVal) {
  strokeVal.textContent = lineWidth;
  strokeRange.oninput = () => {
    lineWidth = +strokeRange.value;
    strokeVal.textContent = lineWidth;
  };
}
if (clearBtn) clearBtn.onclick = () => { ctxD.clearRect(0,0,draw.width,draw.height); lastPoint=null; };
if (saveBtn)  saveBtn.onclick  = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type:"save_png", data_url: draw.toDataURL("image/png") }));
  }
};

function connectWS() {
  ws = new WebSocket("ws://127.0.0.1:9876");
  ws.onclose = () => setTimeout(connectWS, 1000);
}
connectWS();

function toCanvas(x, y) {
  return { x: (1 - x) * overlay.clientWidth, y: y * overlay.clientHeight };
}
function setMode() {
  let label = "Idle";
  if (eraseActive) label = "Erasing";
  else if (pinchActive) label = "Drawing";
  if (modeLabel) modeLabel.textContent = label;
}

function drawStroke(normPt) {
  const p = toCanvas(normPt.x, normPt.y);
  if (pinchActive) {
    if (!lastPoint) lastPoint = p;
    ctxD.save();
    ctxD.globalCompositeOperation = "source-over";
    ctxD.strokeStyle = "rgba(255,255,255,0.96)";
    ctxD.lineWidth = lineWidth;
    ctxD.beginPath();
    ctxD.moveTo(lastPoint.x, lastPoint.y);
    ctxD.lineTo(p.x, p.y);
    ctxD.stroke();
    ctxD.restore();
    lastPoint = p;
  } else {
    lastPoint = null;
  }
}

function eraseAt(normPt, radiusPx) {
  const p = toCanvas(normPt.x, normPt.y);
  ctxD.save();
  ctxD.globalCompositeOperation = "destination-out";
  ctxD.beginPath();
  ctxD.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
  ctxD.fill();
  ctxD.restore();

  if (showGuides) {
    ctxO.save();
    ctxO.strokeStyle = "rgba(255,120,120,0.8)";
    ctxO.lineWidth = 2;
    ctxO.beginPath();
    ctxO.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
    ctxO.stroke();
    ctxO.restore();
  }
}

let smoothed = { x:null, y:null };
const EMA_ALPHA = 0.30;
function ema(pt) {
  if (smoothed.x == null) smoothed = { x: pt.x, y: pt.y };
  else {
    smoothed.x = smoothed.x + EMA_ALPHA * (pt.x - smoothed.x);
    smoothed.y = smoothed.y + EMA_ALPHA * (pt.y - smoothed.y);
  }
  return smoothed;
}

let lastValidLm = null, missingFrames = 0;
const HOLD_FRAMES = 6;
function stableLandmarks(lm) {
  if (lm) { lastValidLm = lm; missingFrames = 0; return lm; }
  if (lastValidLm && missingFrames < HOLD_FRAMES) { missingFrames++; return lastValidLm; }
  lastValidLm = null; return null;
}

let smoothLm = null;
const LM_ALPHA = 0.4;
function smoothLandmarks(lm) {
  if (!lm) return null;
  if (!smoothLm) {
    smoothLm = lm.map(p => ({ x:p.x, y:p.y, z:p.z }));
    return smoothLm;
  }
  for (let k=0;k<lm.length;k++) {
    smoothLm[k].x += LM_ALPHA * (lm[k].x - smoothLm[k].x);
    smoothLm[k].y += LM_ALPHA * (lm[k].y - smoothLm[k].y);
    smoothLm[k].z += LM_ALPHA * (lm[k].z - smoothLm[k].z);
  }
  return smoothLm;
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];
function drawHand(allLm) {
  ctxO.clearRect(0,0,overlay.clientWidth,overlay.clientHeight);
  if (!showGuides) return;
  ctxO.strokeStyle = "rgba(180,200,255,0.6)";
  ctxO.lineWidth   = 2;
  ctxO.beginPath();
  for (const [a,b] of HAND_CONNECTIONS) {
    const p1 = toCanvas(allLm[a].x, allLm[a].y);
    const p2 = toCanvas(allLm[b].x, allLm[b].y);
    ctxO.moveTo(p1.x, p1.y);
    ctxO.lineTo(p2.x, p2.y);
  }
  ctxO.stroke();
  ctxO.fillStyle = "rgba(120,220,255,0.9)";
  for (const p of allLm) {
    const pt = toCanvas(p.x, p.y);
    ctxO.beginPath(); ctxO.arc(pt.x, pt.y, 3, 0, Math.PI*2); ctxO.fill();
  }
}

async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:60, max:60} }
  });
  video.srcObject = stream;
  await video.play();
}

const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({
  selfieMode: false,            
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.75
});
hands.onResults(onResults);

const camera = new Camera(video, {
  onFrame: async () => { await hands.send({ image: video }); },
  width: 1280, height: 720
});

function computePinch(lm, scale) {
  const THUMB_TIP = lm[4], INDEX_TIP = lm[8];
  const dist = Math.hypot(THUMB_TIP.x - INDEX_TIP.x, THUMB_TIP.y - INDEX_TIP.y);
  const ON  = 0.65 * scale;
  const OFF = 0.85 * scale;
  if (!pinchActive && dist < ON) pinchActive = true;
  else if (pinchActive && dist > OFF) pinchActive = false;
}

function computeFist(lm, scale) {
  const pairs = [
    [8,5],    
    [12,9],  
    [16,13], 
    [20,17], 
  ];
  const thumbPair = [4,2];

  let closedCount = 0;
  const THRESH = 0.55 * scale;  

  for (const [tip, base] of pairs) {
    const d = Math.hypot(lm[tip].x - lm[base].x, lm[tip].y - lm[base].y);
    if (d < THRESH) closedCount++;
  }
  const dThumb = Math.hypot(lm[thumbPair[0]].x - lm[thumbPair[1]].x,
                            lm[thumbPair[0]].y - lm[thumbPair[1]].y);
  const thumbClosed = dThumb < THRESH;

  const fistDetected = (closedCount >= 3) && thumbClosed;
  const OFF_K = 0.65;  
  const RELEASE = THRESH / OFF_K;

  if (!eraseActive && fistDetected) eraseActive = true;
  else if (eraseActive && !fistDetected) {
    const stillClosed = (closedCount >= 3) && (dThumb < RELEASE);
    if (!stillClosed) eraseActive = false;
  }
}

function onResults(results) {
  const rawLm = results.multiHandLandmarks && results.multiHandLandmarks[0] || null;
  let lm = stableLandmarks(rawLm);
  if (!lm) {
    ctxO.clearRect(0,0,overlay.clientWidth,overlay.clientHeight);
    pinchActive = false; eraseActive = false; lastPoint = null; setMode(); return;
  }

  lm = smoothLandmarks(lm) || lm;

  const WRIST = lm[0], INDEX_MCP = lm[5];
  const scale = Math.hypot(WRIST.x - INDEX_MCP.x, WRIST.y - INDEX_MCP.y);

  computeFist(lm, scale);
  computePinch(lm, scale);
  if (eraseActive) pinchActive = false; // priority

  const THUMB_TIP = lm[4], INDEX_TIP = lm[8];
  const mid = ema({ x: (THUMB_TIP.x + INDEX_TIP.x) * 0.5, y: (THUMB_TIP.y + INDEX_TIP.y) * 0.5 });

  drawHand(lm);

  if (eraseActive) {
    const palmPx = scale * Math.min(overlay.clientWidth, overlay.clientHeight);
    const eraserRadius = Math.max(10, palmPx * 0.9); // big comfy eraser
    eraseAt(mid, eraserRadius);
  } else {
    drawStroke(mid);
  }

  setMode();

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "hand",
      pinch_active: pinchActive,
      erase_active: eraseActive,
      pinch_point: mid,
      landmarks: lm.slice(0,21).map(p => ({ x:p.x, y:p.y, z:p.z }))
    }));
  }
}

(async function boot(){
  resize();
  await initCamera();
  camera.start();
})();
