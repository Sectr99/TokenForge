/* ─── Token Forge — app.js ──────────────────────────────────────────────────
 * Depends on: BORDERS (js/borders.js loaded before this file)
 * ──────────────────────────────────────────────────────────────────────────── */

const SIZE = 512;
const $ = id => document.getElementById(id);
const clampScale = v => Math.max(0.2, Math.min(2.5, v));

// ── State ──────────────────────────────────────────────────────────────────
let portrait   = null;      // HTMLImageElement | null
let borderImg  = null;      // HTMLImageElement | null
let borderInnerR = 200;     // current clip radius (canvas px)
let ox = 0, oy = 0;        // portrait offset from centre
let sx = 1, sy = 1;        // portrait scale
let drag = null;            // { x, y, ox, oy } while dragging
const adj = { 's-bright': 100, 's-contrast': 100, 's-sat': 100 };
let flipH       = false;
let rotation    = 0;
let portraitName = '';
let borderName   = '';

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
  return () => selectBorder(el, img, b);
}

function selectBorder(el, img, b) {
  if (!img.complete) { img.addEventListener('load', () => selectBorder(el, img, b), { once: true }); return; }
  if (!img.naturalWidth) return; // failed to load
  document.querySelectorAll('.border-opt').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); });
  el.classList.add('sel');
  el.setAttribute('aria-pressed', 'true');
  borderImg    = img;
  borderName   = b.name;
  borderInnerR = b.innerR;
  innerSlider.value = borderInnerR;
  updateRing();
  render();
}

$('add-border-btn').addEventListener('click', () => $('custom-border-input').click());
$('custom-border-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  addBorder({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 20), src: URL.createObjectURL(file), innerR: 180 })();
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

$('reset-btn').addEventListener('click', () => {
  ox = 0; oy = 0; sx = 1; sy = 1;
  syncSliders();
  render();
});

// ── Safe area ring ──────────────────────────────────────────────────────────
function updateRing() {
  $('v-inner').textContent = innerSlider.value;
  safeRing.style.width = safeRing.style.height = (innerSlider.value / 256) * 100 + '%';
  safeRing.style.display = showRingCb.checked ? 'block' : 'none';
}

innerSlider.addEventListener('input', () => {
  borderInnerR = parseInt(innerSlider.value);
  updateRing();
  render();
});
showRingCb.addEventListener('change', updateRing);

// ── Drag, wheel, keys ───────────────────────────────────────────────────────
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const sc   = SIZE / rect.width;
  return { x: (e.clientX - rect.left) * sc, y: (e.clientY - rect.top) * sc };
}

canvas.addEventListener('pointerdown', e => {
  if (!portrait) return;
  const p = canvasPos(e);
  drag = { x: p.x, y: p.y, ox, oy };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = canvasPos(e);
  ox = drag.ox + (p.x - drag.x);
  oy = drag.oy + (p.y - drag.y);
  render();
});
const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

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
function render() {
  noImg.hidden  = !!portrait;
  canvas.hidden = !portrait;
  updateStatus();
  if (!portrait) return;

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, borderInnerR + 20, 0, Math.PI * 2);
  ctx.clip();
  const fit = Math.min(SIZE / portrait.width, SIZE / portrait.height);
  const dw  = portrait.width  * fit * sx;
  const dh  = portrait.height * fit * sy;
  ctx.filter = `brightness(${adj['s-bright']}%) contrast(${adj['s-contrast']}%) saturate(${adj['s-sat']}%)`;
  ctx.translate(SIZE / 2 + ox, SIZE / 2 + oy);
  if (flipH) ctx.scale(-1, 1);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(portrait, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  if (borderImg) ctx.drawImage(borderImg, 0, 0, SIZE, SIZE);
}

function updateStatus() {
  const ready = !!(portrait && borderImg);
  exportBtn.disabled = !ready;
  exportBtn.textContent = ready ? 'Download token' : portrait ? 'Pick a border to download' : 'Add a portrait to download';
  $('dateline').textContent =
    [portraitName || 'No portrait', borderName || 'No border', `${Math.round(sx * 100)}%`].join(' · ');
}

// ── Image adjustments ────────────────────────────────────────────────────────
const adjOut = id => $(id.replace('s-', 'v-'));
Object.keys(adj).forEach(id => $(id).addEventListener('input', e => {
  adj[id] = parseInt(e.target.value);
  adjOut(id).textContent = e.target.value;
  render();
}));

$('btn-flip').addEventListener('click', () => { flipH = !flipH; render(); });
$('btn-rot').addEventListener('click', () => { rotation = (rotation + 90) % 360; render(); });

$('reset-adj').addEventListener('click', () => {
  flipH = false; rotation = 0;
  Object.keys(adj).forEach(id => { adj[id] = 100; $(id).value = 100; adjOut(id).textContent = '100'; });
  render();
});

// ── Export ───────────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  const a    = document.createElement('a');
  a.download = (portraitName || 'token') + '-token.png';
  a.href     = canvas.toDataURL('image/png');
  a.click();
});

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
BORDERS.map(addBorder)[0]();
render();
