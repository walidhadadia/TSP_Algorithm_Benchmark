/* ═══════════════════════════════════════════════════════════════
   graphe.js — éditeur de graphe (page 1)
═══════════════════════════════════════════════════════════════ */
const G = {
  nodes: [],
  edges: [],
  directed: false,
  _nodeSeq: 0,
  _edgeSeq: 0,
  start: null,         // id du nœud de départ (cycle fermé)
  mode: 'select',
  dragging: null,      // { node, ox, oy }
  panning: null,       // { sx, sy, px, py }
  panX: 0, panY: 0,
  zoom: 1,
  edgeStart: null,
  hover: null,         // id nœud survolé
  hoverEdge: null,     // id arête survolée
  _mouseX: null,
  _mouseY: null,
  pendingEdge: null,
  editingEdge: null,
};

const NODE_R_ED = 16;
const edCanvas = document.getElementById('editor-canvas');
const edCtx    = edCanvas.getContext('2d');

/* Couleur d'accent selon l'outil actif (pour le survol) */
const TOOL_ACCENT = {
  delete:     '#f87171',
  editWeight: '#fbbf24',
  addEdge:    '#6366f1',
  addNode:    '#6366f1',
  select:     '#6366f1',
};

/* ── Persistance ──────────────────────────────────────────────── */
function persist() {
  const ids = new Set(G.nodes.map(n => n.id));
  if (!ids.has(G.start)) G.start = G.nodes.length ? G.nodes[0].id : null;

  saveGraphState({ nodes: G.nodes, edges: G.edges, directed: G.directed, start: G.start });
  document.getElementById('info-nodes').textContent = `${G.nodes.length} nœuds`;
  document.getElementById('info-edges').textContent = `${G.edges.length} arêtes`;
  populateEndpoints();
  updateEndpointMode();
}

/* ── Nœud de départ ───────────────────────────────────────────── */
function populateEndpoints() {
  const ss = document.getElementById('select-start');
  ss.innerHTML = G.nodes.map(n => `<option value="${n.id}">${n.label || n.id}</option>`).join('');
  if (G.start) ss.value = G.start;
}
function updateEndpointMode() {
  document.getElementById('endpoint-mode').textContent =
    `Cycle fermé : départ ${G.start || '?'} — visite tous les nœuds et revient au départ`;
}
document.getElementById('select-start').addEventListener('change', e => {
  G.start = e.target.value || null;
  persist(); redraw();
});

/* ── Dessin ───────────────────────────────────────────────────── */
function redraw() {
  fitCanvas(edCanvas);
  const W = edCanvas.width, H = edCanvas.height;
  edCtx.clearRect(0, 0, W, H);
  edCtx.save();
  edCtx.translate(G.panX, G.panY);
  edCtx.scale(G.zoom, G.zoom);

  const nm = Object.fromEntries(G.nodes.map(n => [n.id, n]));
  const accent = TOOL_ACCENT[G.mode] || '#6366f1';

  G.edges.forEach(e => {
    const a = nm[e.source], b = nm[e.target];
    if (!a || !b) return;
    let color = '#3a3a52', width = 1.6;
    // survol d'arête dans les modes qui agissent sur les arêtes
    if (e.id === G.hoverEdge && (G.mode === 'delete' || G.mode === 'editWeight')) {
      color = accent; width = 2.8;
    }
    drawEdge(edCtx, a.x, a.y, b.x, b.y, color, width, null, G.directed, fmtWeight(e.weight));
  });

  if (G.mode === 'addEdge' && G.edgeStart && G._mouseX != null) {
    const s = nm[G.edgeStart];
    if (s) drawEdge(edCtx, s.x, s.y, G._mouseX, G._mouseY, '#6366f1aa', 1.6, [6, 4], G.directed, null);
  }

  G.nodes.forEach(n => {
    const isHover = n.id === G.hover;
    const isEdgeStart = n.id === G.edgeStart;
    // anneau du nœud de départ (vert)
    if (n.id === G.start) ringNode(n.x, n.y, '#34d399');

    let fill = '#1e1e2e', stroke = '#4a4a6a';
    if (isEdgeStart) {
      fill = '#6366f1'; stroke = '#a5b4fc';
    } else if (isHover) {
      fill = accent + '2e'; stroke = accent;
    }
    drawNode(edCtx, n.x, n.y, n.label || n.id, fill, stroke, NODE_R_ED);
  });

  edCtx.restore();
}

function ringNode(x, y, color) {
  edCtx.save();
  edCtx.beginPath();
  edCtx.arc(x, y, NODE_R_ED + 5, 0, Math.PI * 2);
  edCtx.strokeStyle = color;
  edCtx.lineWidth = 3;
  edCtx.stroke();
  edCtx.restore();
}

/* ── Coordonnées (espace monde = écran - pan) ─────────────────── */
function coords(e) {
  const r = edCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - G.panX) / G.zoom,
    y: (e.clientY - r.top - G.panY) / G.zoom,
  };
}
function nodeAt(x, y) {
  return G.nodes.find(n => Math.hypot(n.x - x, n.y - y) <= NODE_R_ED + 4) || null;
}
function edgeAt(x, y) {
  const nm = Object.fromEntries(G.nodes.map(n => [n.id, n]));
  for (const e of G.edges) {
    const a = nm[e.source], b = nm[e.target];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (len * len)));
    const px = a.x + t * dx, py = a.y + t * dy;
    if (Math.hypot(x - px, y - py) < 8) return e;
  }
  return null;
}
function nextNodeLabel() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const seq = G._nodeSeq++;
  return seq < letters.length ? letters[seq] : 'N' + (seq - letters.length + 1);
}

/* ── Interactions ─────────────────────────────────────────────── */
edCanvas.addEventListener('mousedown', e => {
  const { x, y } = coords(e);
  const node = nodeAt(x, y);

  if (G.mode === 'select') {
    if (node) {
      G.dragging = { node, ox: x - node.x, oy: y - node.y };
    } else {
      // glisser le fond = déplacer la vue (pan)
      const r = edCanvas.getBoundingClientRect();
      G.panning = { sx: e.clientX - r.left, sy: e.clientY - r.top, px: G.panX, py: G.panY };
      edCanvas.style.cursor = 'grabbing';
    }
  } else if (G.mode === 'addEdge') {
    if (node) {
      if (!G.edgeStart) {
        G.edgeStart = node.id;
      } else if (node.id !== G.edgeStart) {
        const exists = G.edges.some(ed =>
          (ed.source === G.edgeStart && ed.target === node.id) ||
          (!G.directed && ed.source === node.id && ed.target === G.edgeStart));
        if (exists) { alert('Cette arête existe déjà.'); G.edgeStart = null; redraw(); return; }
        G.pendingEdge = { source: G.edgeStart, target: node.id };
        G.editingEdge = null;
        G.edgeStart   = null;
        showEdgeModal('Poids de la nouvelle arête', 10);
      }
    }
  } else if (G.mode === 'editWeight') {
    const edge = edgeAt(x, y);
    if (edge) {
      G.editingEdge = edge;
      G.pendingEdge = null;
      showEdgeModal(`Modifier le poids (${edge.source} → ${edge.target})`, edge.weight);
    }
  } else if (G.mode === 'delete') {
    if (node) {
      G.edges = G.edges.filter(ed => ed.source !== node.id && ed.target !== node.id);
      G.nodes = G.nodes.filter(n => n.id !== node.id);
    } else {
      const edge = edgeAt(x, y);
      if (edge) G.edges = G.edges.filter(ed => ed.id !== edge.id);
    }
    G.hover = null; G.hoverEdge = null;
    persist(); redraw();
  }
});

edCanvas.addEventListener('mousemove', e => {
  const { x, y } = coords(e);
  G._mouseX = x; G._mouseY = y;

  if (G.dragging) {
    G.dragging.node.x = x - G.dragging.ox;
    G.dragging.node.y = y - G.dragging.oy;
    redraw();
    return;
  }
  if (G.panning) {
    const r = edCanvas.getBoundingClientRect();
    G.panX = G.panning.px + (e.clientX - r.left - G.panning.sx);
    G.panY = G.panning.py + (e.clientY - r.top - G.panning.sy);
    redraw();
    return;
  }

  // survol : nœud prioritaire, sinon arête (selon le mode)
  const n = nodeAt(x, y);
  let he = null;
  if (!n && (G.mode === 'delete' || G.mode === 'editWeight')) {
    const ed = edgeAt(x, y);
    he = ed ? ed.id : null;
  }
  const changed = (n ? n.id : null) !== G.hover || he !== G.hoverEdge || G.mode === 'addEdge';
  G.hover = n ? n.id : null;
  G.hoverEdge = he;
  if (changed) redraw();
});

edCanvas.addEventListener('mouseup', () => {
  if (G.dragging) { G.dragging = null; persist(); }
  if (G.panning)  { G.panning = null; edCanvas.style.cursor = ''; setCursor(); }
});
edCanvas.addEventListener('mouseleave', () => {
  if (G.dragging) { G.dragging = null; persist(); }
  G.panning = null;
  G.hover = null; G.hoverEdge = null; G._mouseX = null; G._mouseY = null;
  redraw();
});

edCanvas.addEventListener('click', e => {
  if (G.mode !== 'addNode') return;
  const { x, y } = coords(e);
  if (nodeAt(x, y)) return;
  const label = nextNodeLabel();
  G.nodes.push({ id: label, x, y, label });
  persist(); redraw();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && G.mode === 'addEdge') { G.edgeStart = null; redraw(); }
});

/* ── Modale poids ─────────────────────────────────────────────── */
function showEdgeModal(title, value) {
  document.getElementById('modal-edge-title').textContent = title;
  document.getElementById('modal-weight').value = value;
  document.getElementById('modal-edge').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-weight').select(), 50);
}
document.getElementById('modal-edge-confirm').addEventListener('click', () => {
  const w = parseFloat(document.getElementById('modal-weight').value);
  if (isNaN(w) || w <= 0) { alert('Poids invalide.'); return; }
  if (G.editingEdge) {
    G.editingEdge.weight = w; G.editingEdge = null;
  } else if (G.pendingEdge) {
    G._edgeSeq++;
    G.edges.push({ id: 'e' + G._edgeSeq + '_' + Date.now(), ...G.pendingEdge, weight: w });
    G.pendingEdge = null;
  }
  document.getElementById('modal-edge').classList.add('hidden');
  persist(); redraw();
});
document.getElementById('modal-edge-cancel').addEventListener('click', () => {
  G.pendingEdge = null; G.editingEdge = null;
  document.getElementById('modal-edge').classList.add('hidden');
});
document.getElementById('modal-weight').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('modal-edge-confirm').click();
});

/* ── Toolbar ──────────────────────────────────────────────────── */
const HINTS = {
  select:     'Glissez un nœud pour le déplacer · glissez le fond pour vous déplacer dans le graphe.',
  addNode:    'Cliquez sur une zone vide pour ajouter un nœud.',
  addEdge:    'Cliquez sur deux nœuds pour les relier — Échap pour annuler.',
  editWeight: 'Survolez puis cliquez une arête pour modifier son poids.',
  delete:     'Survolez puis cliquez un nœud ou une arête pour le supprimer.',
};
function setCursor() {
  edCanvas.style.cursor =
    G.mode === 'addNode'    ? 'crosshair' :
    G.mode === 'delete'     ? 'not-allowed' :
    G.mode === 'editWeight' ? 'pointer' :
    G.mode === 'select'     ? 'grab' : 'default';
}
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    G.mode = btn.dataset.mode;
    G.edgeStart = null; G.hover = null; G.hoverEdge = null;
    setCursor();
    document.getElementById('hint-bar').textContent = HINTS[G.mode];
    redraw();
  });
});

document.getElementById('toggle-directed').addEventListener('change', e => {
  G.directed = e.target.checked;
  persist(); redraw();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('Effacer tout le graphe ?')) return;
  G.nodes = []; G.edges = []; G._nodeSeq = 0; G.panX = 0; G.panY = 0; G.zoom = 1;
  updateZoomLabel(); persist(); redraw();
});
/* ── Zoom & ajustement ────────────────────────────────────────── */
const ZOOM_MIN = 0.2, ZOOM_MAX = 4;

function updateZoomLabel() {
  document.getElementById('zoom-level').textContent = Math.round(G.zoom * 100) + '%';
}

/** Zoom autour d'un point écran (sx, sy) pour garder ce point fixe. */
function zoomAt(sx, sy, factor) {
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, G.zoom * factor));
  if (newZoom === G.zoom) return;
  // point monde sous le curseur avant zoom
  const wx = (sx - G.panX) / G.zoom, wy = (sy - G.panY) / G.zoom;
  G.zoom = newZoom;
  G.panX = sx - wx * G.zoom;
  G.panY = sy - wy * G.zoom;
  updateZoomLabel(); redraw();
}

/** Ajuste le zoom et le centre pour afficher tout le graphe au milieu. */
function fitView() {
  const W = edCanvas.width, H = edCanvas.height;
  if (!G.nodes.length) { G.zoom = 1; G.panX = 0; G.panY = 0; updateZoomLabel(); redraw(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  G.nodes.forEach(n => {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  });
  const pad = 70;
  const gw = (maxX - minX) || 1, gh = (maxY - minY) || 1;
  G.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min((W - 2 * pad) / gw, (H - 2 * pad) / gh)));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  G.panX = W / 2 - cx * G.zoom;
  G.panY = H / 2 - cy * G.zoom;
  updateZoomLabel(); redraw();
}

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  zoomAt(edCanvas.width / 2, edCanvas.height / 2, 1.2);
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  zoomAt(edCanvas.width / 2, edCanvas.height / 2, 1 / 1.2);
});
document.getElementById('btn-recenter').addEventListener('click', fitView);

edCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r = edCanvas.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 1 / 1.1);
}, { passive: false });

/* ── Sélecteur de graphe (modèle) ─────────────────────────────── */
document.getElementById('select-builtin').addEventListener('change', async e => {
  const which = e.target.value;
  const data = await api('GET', `/api/graph/default?which=${which}`);
  applyGraph(data);
  fitView();
});

/* ── Sauvegarde / chargement BDD ──────────────────────────────── */
document.getElementById('btn-save-graph').addEventListener('click', () => {
  document.getElementById('modal-save-name').value = '';
  document.getElementById('modal-save').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-save-name').focus(), 50);
});
document.getElementById('modal-save-confirm').addEventListener('click', async () => {
  const name = document.getElementById('modal-save-name').value.trim();
  if (!name) { alert('Entrez un nom.'); return; }
  await api('POST', '/api/graphs', { name, nodes: G.nodes, edges: G.edges, directed: G.directed });
  document.getElementById('modal-save').classList.add('hidden');
  loadGraphList();
});
document.getElementById('modal-save-cancel').addEventListener('click', () => {
  document.getElementById('modal-save').classList.add('hidden');
});
document.getElementById('modal-save-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('modal-save-confirm').click();
});

document.getElementById('select-load-graph').addEventListener('change', async e => {
  const id = e.target.value;
  if (!id) return;
  const data = await api('GET', `/api/graphs/${id}`);
  applyGraph(data);
  e.target.value = '';
});

async function loadGraphList() {
  const list = await api('GET', '/api/graphs');
  const sel  = document.getElementById('select-load-graph');
  sel.innerHTML = '<option value="">Charger un graphe…</option>';
  list.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id; opt.textContent = g.name;
    sel.appendChild(opt);
  });
}

/* ── Application d'un graphe ───────────────────────────────────── */
function applyGraph(data) {
  G.nodes    = data.nodes;
  G.edges    = data.edges;
  G.directed = !!data.directed;
  G._nodeSeq = G.nodes.length;
  G._edgeSeq = G.edges.length;
  G.panX = 0; G.panY = 0; G.zoom = 1;
  const ids = new Set(G.nodes.map(n => n.id));
  G.start = (data.start && ids.has(data.start)) ? data.start : (G.nodes[0] ? G.nodes[0].id : null);
  document.getElementById('toggle-directed').checked = G.directed;
  persist(); redraw();
}
async function loadDefaultGraph() {
  const data = await api('GET', '/api/graph/default');
  applyGraph(data);
}

/* ── Init ─────────────────────────────────────────────────────── */
async function init() {
  const saved = loadGraphState();
  if (saved && saved.nodes && saved.nodes.length) applyGraph(saved);
  else await loadDefaultGraph();
  await loadGraphList();
  setCursor();
  updateZoomLabel();
  // centrer et ajuster automatiquement au chargement (canvas dimensionné)
  requestAnimationFrame(() => { fitCanvas(edCanvas); fitView(); });
}
window.addEventListener('load', () => { fitCanvas(edCanvas); fitView(); });

// pendant les premières secondes, si la fenêtre change, on ré-ajuste pour
// tomber sur un cadrage propre (utile quand le layout se stabilise après init)
let _initialFitDeadline = Date.now() + 1500;
window.addEventListener('resize', () => {
  fitCanvas(edCanvas);
  if (Date.now() < _initialFitDeadline) fitView();
  else redraw();
});
init();
