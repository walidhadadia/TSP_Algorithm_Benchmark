/* ═══════════════════════════════════════════════════════════════
   common.js — utilitaires partagés entre les 3 pages
═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'graph_state';
const RESULT_KEY  = 'last_simulation';

const ALGO_KEYS   = ['nn', 'two_opt', 'genetic'];
const ALGO_COLORS = { nn: '#818cf8', two_opt: '#34d399', genetic: '#fbbf24' };
const ALGO_DISPLAY = { nn: 'Plus Proche Voisin', two_opt: '2-Opt', genetic: 'Alg. Génétique' };
const NODE_R = 14;

/* ── API ──────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}`);
  return r.json();
}

/* ── Stockage du graphe (partagé entre pages via localStorage) ── */
function saveGraphState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadGraphState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function saveSimResult(data) {
  localStorage.setItem(RESULT_KEY, JSON.stringify(data));
}
function loadSimResult() {
  const raw = localStorage.getItem(RESULT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ── Dessin canvas ────────────────────────────────────────────── */
function fitCanvas(canvas) {
  // Lit la taille du conteneur (hauteur FIXE en CSS → pas de boucle de redimensionnement)
  const wrap = canvas.parentElement;
  const w = wrap.clientWidth  || 300;
  const h = wrap.clientHeight || 300;
  if (canvas.width !== w)  canvas.width  = w;
  if (canvas.height !== h) canvas.height = h;
}

function scaleNodes(nodes, W, H, pad = 40) {
  if (!nodes.length) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
  });
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale  = Math.min((W - pad * 2) / rangeX, (H - pad * 2) / rangeY);
  const offX   = (W - rangeX * scale) / 2;
  const offY   = (H - rangeY * scale) / 2;
  return nodes.map(n => ({
    ...n,
    sx: (n.x - minX) * scale + offX,
    sy: (n.y - minY) * scale + offY,
  }));
}

function arrowHead(ctx, x1, y1, x2, y2, color) {
  const len = 10, angle = 0.42;
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  if (d < 1) return;
  const ux = dx / d, uy = dy / d;
  const tx = x2 - ux * NODE_R, ty = y2 - uy * NODE_R;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - len * (ux * Math.cos(angle) - uy * Math.sin(angle)),
             ty - len * (uy * Math.cos(angle) + ux * Math.sin(angle)));
  ctx.lineTo(tx - len * (ux * Math.cos(-angle) - uy * Math.sin(-angle)),
             ty - len * (uy * Math.cos(-angle) + ux * Math.sin(-angle)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawEdge(ctx, x1, y1, x2, y2, color, width, dash, directed, label) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  if (directed) {
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
    const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
  } else {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if (directed) arrowHead(ctx, x1, y1, x2, y2, color);
  if (label != null) {
    const mx = (x1 + x2) / 2 + (directed ? (y2 - y1) * 0.06 : 0);
    const my = (y1 + y2) / 2 + (directed ? -(x2 - x1) * 0.06 : 0) - 7;
    ctx.font = 'bold 11px Inter,system-ui';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(13,13,20,0.82)';
    ctx.fillRect(mx - tw / 2, my - 9, tw, 14);
    ctx.fillStyle = color;
    ctx.fillText(label, mx, my);
  }
  ctx.restore();
}

function drawNode(ctx, x, y, label, fill, stroke, r, textColor) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.fillStyle    = textColor || '#fff';
  ctx.font         = `bold ${r >= 13 ? 12 : 10}px Inter,system-ui`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label || '', x, y);
}

function fmtWeight(w) {
  return w % 1 === 0 ? String(w) : w.toFixed(1);
}
