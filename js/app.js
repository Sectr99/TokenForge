/* ─── Token Forge — app.js ──────────────────────────────────────────────────
 * Depends on: BORDERS (js/borders.js loaded before this file)
 * ──────────────────────────────────────────────────────────────────────────── */

const SIZE  = 512;            // drawing units; exports scale from this
const STORE = 'tf-settings';  // localStorage key for remembered settings
const $ = id => document.getElementById(id);
const clampScale = v => Math.max(0.2, Math.min(2.5, v));

// ── State ──────────────────────────────────────────────────────────────────
let portrait   = null;      // HTMLImageElement | null
let borderImg  = null;      // HTMLImageElement | null
let borderInnerR = 220;     // radius the portrait is cut at (canvas px)
let ox = 0, oy = 0;        // portrait offset from centre
let sx = 1, sy = 1;        // portrait scale
let drag  = null;           // { x, y, ox, oy } while dragging
let pinch = null;           // { d, sx, sy } while two fingers are down
const pointers = new Map(); // pointerId → { x, y }
const adj = { 's-bright': 100, 's-contrast': 100, 's-sat': 100 };
let flipH       = false;
let rotation    = 0;        // degrees, -180..180
let exportSize  = 512;
let portraitName = '';
let borderName   = '';
let borderId     = '';

// ── DOM refs ───────────────────────────────────────────────────────────────
const canvas      = $('preview-canvas');
const ctx         = canvas.getContext('2d');
const noImg       = $('no-img');
const exportBtn   = $('export-btn');
const borderGrid  = $('border-grid');
const innerSlider = $('s-inner');
const showRingCb  = $('show-ring');
const safeRing    = $('safe-ring');
const sxSlider    = $('s-sx');
const sySlider    = $('s-sy');
const rotSlider   = $('s-rot');
const linkAxes    = $('link-axes');

// ── Borders ─────────────────────────────────────────────────────────────────
// The tile's <img> is the same 512px file the canvas draws, so it is reused.
function addBorder(b) {
  const el  = document.createElement('button');
  el.type = 'button';
  el.className = 'border-opt';
  el.setAttribute('aria-pressed', 'false');
  const img = new Image();
  img.alt = b.name;
  img.src = b.src;
  img.onerror = () => el.classList.add('error');
  const label = document.createElement('span');
  label.textContent = b.name;
  el.append(img, label);
  el.addEventListener('click', () => selectBorder(el, img, b));
  borderGrid.appendChild(el);
  return r => selectBorder(el, img, b, r);
}

// innerR: optional override (a saved value); otherwise the border's own, or detected
function selectBorder(el, img, b, innerR) {
  if (!img.complete) { img.addEventListener('load', () => selectBorder(el, img, b, innerR), { once: true }); return; }
  if (!img.naturalWidth) return; // failed to load
  document.querySelectorAll('.border-opt').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); });
  el.classList.add('sel');
  el.setAttribute('aria-pressed', 'true');
  borderImg    = img;
  borderName   = b.name;
  borderId     = b.id || '';
  borderInnerR = innerR ?? b.innerR ?? detectInnerR(img);
  innerSlider.value = borderInnerR;
  updateRing();
  render();
}

// Find the border's inner edge: walk out from the centre along 72 rays until a
// pixel is mostly opaque, take the 90th-percentile hit (so uneven borders leave
// no gap) and cut 4px past it. Lands within ~10px of the hand-set built-ins.
// A border with no clear centre gets 200.
function detectInnerR(img) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, SIZE, SIZE);
  const a = g.getImageData(0, 0, SIZE, SIZE).data;
  const alpha = (x, y) => a[(Math.round(y) * SIZE + Math.round(x)) * 4 + 3];
  if (alpha(SIZE / 2, SIZE / 2) > 128) return 200;
  const hits = [];
  for (let i = 0; i < 72; i++) {
    const t = i * Math.PI / 36;
    for (let r = 1; r < SIZE / 2; r++) {
      if (alpha(SIZE / 2 + r * Math.cos(t), SIZE / 2 + r * Math.sin(t)) > 128) { hits.push(r); break; }
    }
  }
  if (hits.length < 36) return 200; // mostly open: not a ring
  hits.sort((x, y) => x - y);
  return Math.min(256, hits[Math.floor(hits.length * 0.9)] + 4);
}

$('add-border-btn').addEventListener('click', () => $('custom-border-input').click());
$('custom-border-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  addBorder({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 20), src: URL.createObjectURL(file) })();
  this.value = ''; // reset so same file can be re-uploaded
});

// ── Portrait upload ─────────────────────────────────────────────────────────
const fi     = $('file-input');
const dzText = $('dz-text');

$('drop-zone').addEventListener('click', () => fi.click());
noImg.addEventListener('click', () => fi.click());
[$('drop-zone'), $('checker')].forEach(t => {
  t.addEventListener('dragover',  e => { e.preventDefault(); t.classList.add('over'); });
  t.addEventListener('dragleave', () => t.classList.remove('over'));
  t.addEventListener('drop', e => {
    e.preventDefault();
    t.classList.remove('over');
    loadPortrait(e.dataTransfer.files[0]);
  });
});
fi.addEventListener('change', () => { loadPortrait(fi.files[0]); fi.value = ''; });

document.addEventListener('paste', e => {
  const file = [...e.clipboardData.files].find(f => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  loadPortrait(file);
});

function portraitError(msg) {
  dzText.textContent = msg;
  dzText.classList.add('err');
}

function loadPortrait(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    portraitError(`${file.name} isn't a PNG, JPG or WEBP image.`);
    return;
  }
  const img = new Image();
  img.onload = () => {
    if (portrait) URL.revokeObjectURL(portrait.src);
    portrait = img;
    portraitName = file.name.replace(/\.[^.]+$/, '');
    ox = 0; oy = 0; sx = 1; sy = 1;
    syncSliders();
    $('dz-name').textContent = file.name;
    dzText.textContent = 'Click to replace it.';
    dzText.classList.remove('err');
    render();
  };
  img.onerror = () => portraitError(`${file.name} could not be read. Try saving it again as PNG.`);
  img.src = URL.createObjectURL(file);
}

// ── Scale ───────────────────────────────────────────────────────────────────
function syncSliders() {
  sxSlider.value = Math.round(sx * 100);
  sySlider.value = Math.round(sy * 100);
  $('v-sx').textContent = sxSlider.value + '%';
  $('v-sy').textContent = sySlider.value + '%';
}

function zoom(d) {
  sx = clampScale(sx + d);
  sy = linkAxes.checked ? sx : clampScale(sy + d);
  syncSliders();
  render();
}

[sxSlider, sySlider].forEach(s => s.addEventListener('input', () => {
  const v = s.value / 100;
  if (s === sxSlider || linkAxes.checked) sx = v;
  if (s === sySlider || linkAxes.checked) sy = v;
  syncSliders();
  render();
}));
linkAxes.addEventListener('change', save);

$('reset-btn').addEventListener('click', () => {
  ox = 0; oy = 0; sx = 1; sy = 1;
  syncSliders();
  render();
});

// ── Safe area ring: drawn exactly where the portrait is cut ─────────────────
function updateRing() {
  $('v-inner').textContent = innerSlider.value;
  safeRing.style.width = safeRing.style.height = (innerSlider.value / 256) * 100 + '%';
  safeRing.style.display = showRingCb.checked ? 'block' : 'none';
  save();
}

innerSlider.addEventListener('input', () => {
  borderInnerR = parseInt(innerSlider.value);
  updateRing();
  render();
});
showRingCb.addEventListener('change', updateRing);

// ── Drag, pinch, wheel, keys ────────────────────────────────────────────────
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const sc   = SIZE / rect.width;
  return { x: (e.clientX - rect.left) * sc, y: (e.clientY - rect.top) * sc };
}
const fingerGap = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

canvas.addEventListener('pointerdown', e => {
  if (!portrait) return;
  const p = canvasPos(e);
  pointers.set(e.pointerId, p);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {} // throws if the pointer is already gone
  if (pointers.size === 2) { drag = null; pinch = { d: fingerGap(), sx, sy }; return; }
  drag = { x: p.x, y: p.y, ox, oy };
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const p = canvasPos(e);
  pointers.set(e.pointerId, p);
  if (pinch && pointers.size === 2) {
    const f = fingerGap() / pinch.d;
    sx = clampScale(pinch.sx * f);
    sy = linkAxes.checked ? sx : clampScale(pinch.sy * f);
    syncSliders();
    render();
  } else if (drag) {
    ox = drag.ox + (p.x - drag.x);
    oy = drag.oy + (p.y - drag.y);
    render();
  }
});
const endDrag = e => { pointers.delete(e.pointerId); drag = pinch = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('dblclick', () => { ox = 0; oy = 0; render(); });

canvas.addEventListener('wheel', e => {
  if (!portrait) return;
  e.preventDefault();
  zoom(-e.deltaY * 0.001);
}, { passive: false });

// Arrow keys nudge (Shift for 10px), + and − zoom
canvas.addEventListener('keydown', e => {
  if (!portrait) return;
  const step = e.shiftKey ? 10 : 2;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) { ox += moves[e.key][0]; oy += moves[e.key][1]; render(); }
  else if (e.key === '+' || e.key === '=') zoom(0.05);
  else if (e.key === '-') zoom(-0.05);
  else return;
  e.preventDefault();
});

// ── Render ───────────────────────────────────────────────────────────────────
// draw() works in 512px units and scales to the target size, so a 1024 export
// redraws the portrait from its source pixels instead of upscaling the preview.
function draw(c, size) {
  c.clearRect(0, 0, size, size);
  c.save();
  c.scale(size / SIZE, size / SIZE);
  c.save();
  c.beginPath();
  c.arc(SIZE / 2, SIZE / 2, borderInnerR, 0, Math.PI * 2);
  c.clip();
  const fit = Math.min(SIZE / portrait.width, SIZE / portrait.height);
  const dw  = portrait.width  * fit * sx;
  const dh  = portrait.height * fit * sy;
  c.filter = `brightness(${adj['s-bright']}%) contrast(${adj['s-contrast']}%) saturate(${adj['s-sat']}%)`;
  c.translate(SIZE / 2 + ox, SIZE / 2 + oy);
  if (flipH) c.scale(-1, 1);
  c.rotate(rotation * Math.PI / 180);
  c.drawImage(portrait, -dw / 2, -dh / 2, dw, dh);
  c.restore();
  if (borderImg) c.drawImage(borderImg, 0, 0, SIZE, SIZE);
  c.restore();
}

function render() {
  noImg.hidden  = !!portrait;
  canvas.hidden = !portrait;
  updateStatus();
  if (portrait) draw(ctx, SIZE);
}

function updateStatus() {
  const ready = !!(portrait && borderImg);
  exportBtn.disabled = !ready;
  exportBtn.textContent = ready ? 'Download token' : portrait ? 'Pick a border to download' : 'Add a portrait to download';
  $('dateline').textContent =
    [portraitName || 'No portrait', borderName || 'No border', `${Math.round(sx * 100)}%`].join(' · ');
  $('size-meta').textContent = `${exportSize} × ${exportSize} · PNG · Transparent`;
  save();
}

// ── Image adjustments ────────────────────────────────────────────────────────
function setAdj(id, v) { adj[id] = v; $(id).value = v; $(id.replace('s-', 'v-')).textContent = v; }
Object.keys(adj).forEach(id => $(id).addEventListener('input', e => { setAdj(id, parseInt(e.target.value)); render(); }));

function setRotation(v) {
  rotation = ((v + 540) % 360) - 180;
  rotSlider.value = rotation;
  $('v-rot').textContent = rotation + '°';
}
rotSlider.addEventListener('input', () => { setRotation(parseInt(rotSlider.value)); render(); });
$('btn-rot').addEventListener('click', () => { setRotation(rotation + 90); render(); });
$('btn-flip').addEventListener('click', () => { flipH = !flipH; render(); });

$('reset-adj').addEventListener('click', () => {
  flipH = false;
  setRotation(0);
  Object.keys(adj).forEach(id => setAdj(id, 100));
  render();
});

// ── Export ───────────────────────────────────────────────────────────────────
function setSize(n) {
  exportSize = n;
  document.querySelectorAll('#size-seg button').forEach(b => b.classList.toggle('active', +b.dataset.size === n));
}
document.querySelectorAll('#size-seg button').forEach(b =>
  b.addEventListener('click', () => { setSize(+b.dataset.size); render(); }));

exportBtn.addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = out.height = exportSize;
  draw(out.getContext('2d'), exportSize);
  const a    = document.createElement('a');
  a.download = (portraitName || 'token') + '-token.png';
  a.href     = out.toDataURL('image/png');
  a.click();
});

// ── Saved settings (everything except the portrait and its position) ────────
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      borderId, innerR: borderInnerR, adj, flipH, rotation, exportSize,
      link: linkAxes.checked, ring: showRingCb.checked,
    }));
  } catch (e) {}
}

function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
  if (!s) return null;
  Object.keys(adj).forEach(id => { if (typeof s.adj?.[id] === 'number') setAdj(id, s.adj[id]); });
  flipH = !!s.flipH;
  setRotation(+s.rotation || 0);
  setSize([256, 512, 1024].includes(s.exportSize) ? s.exportSize : 512);
  linkAxes.checked   = s.link !== false;
  showRingCb.checked = !!s.ring;
  return s;
}

// ── Theme: Auto → Light → Dark ───────────────────────────────────────────────
const themeBtn = $('theme-btn');
const themes   = ['', 'light', 'dark'];
function showTheme() {
  const t = document.documentElement.dataset.theme || '';
  themeBtn.textContent = { '': 'Auto', light: 'Light', dark: 'Dark' }[t];
}
themeBtn.addEventListener('click', () => {
  const t = themes[(themes.indexOf(document.documentElement.dataset.theme || '') + 1) % 3];
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { t ? localStorage.setItem('tf-theme', t) : localStorage.removeItem('tf-theme'); } catch (e) {}
  showTheme();
});
showTheme();

// ── Init ─────────────────────────────────────────────────────────────────────
// restore() runs before any save() so the first render can't overwrite saved settings.
const saved   = restore();
const pickers = BORDERS.map(addBorder);
const savedAt = BORDERS.findIndex(b => b.id === saved?.borderId);
if (savedAt >= 0) pickers[savedAt](saved.innerR); else pickers[0]();
render();
