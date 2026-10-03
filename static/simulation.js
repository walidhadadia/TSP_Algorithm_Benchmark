/* ═══════════════════════════════════════════════════════════════
   simulation.js — page 2
═══════════════════════════════════════════════════════════════ */
const S = {
  nodes: [], edges: [], directed: false, start: null,
  data: null,
  steps: { nn: [], two_opt: [], genetic: [] },
  idx:   { nn: 0, two_opt: 0, genetic: 0 },
  timer: null,
  phase: 'idle',          // idle | playing | paused | done
  speed: 1000,            // ms par étape (≈ 1s)
};

const canvases = {
  nn:      document.getElementById('canvas-nn'),
  two_opt: document.getElementById('canvas-2opt'),
  genetic: document.getElementById('canvas-ga'),
};
const UI = {
  nn:      { time:'time-nn',   dist:'dist-nn',   step:'step-nn',   desc:'desc-nn',   live:'live-nn',   ts:'ts-nn',   valid:'valid-nn'   },
  two_opt: { time:'time-2opt', dist:'dist-2opt', step:'step-2opt', desc:'desc-2opt', live:'live-2opt', ts:'ts-2opt', valid:'valid-2opt' },
  genetic: { time:'time-ga',   dist:'dist-ga',   step:'step-ga',   desc:'desc-ga',   live:'live-ga',   ts:'ts-ga',   valid:'valid-ga'   },
};

const fmtDist = v => (v == null ? '∞' : v.toFixed(1));

/* Ensemble des arêtes réelles (pour ne JAMAIS dessiner d'arête fantôme) */
let EDGE_SET = new Set();
function rebuildEdgeSet() {
  EDGE_SET = new Set();
  S.edges.forEach(e => {
    EDGE_SET.add(`${e.source}|${e.target}`);
    if (!S.directed) EDGE_SET.add(`${e.target}|${e.source}`);
  });
}
const edgeExists = (a, b) => EDGE_SET.has(`${a}|${b}`);

/* ── Surlignage par étape ─────────────────────────────────────── */
function highlights(key, step) {
  const h = { pathEdges: [], pathNodes: new Set(), currentNode: null, removedEdges: [], addedEdges: [] };
  if (!step) return h;
  const tourToEdges = (tour) => {
    const out = [];
    for (let i = 0; i < tour.length - 1; i++) out.push({ source: tour[i], target: tour[i + 1] });
    return out;
  };
  if (step.tour) { step.tour.forEach(id => h.pathNodes.add(id)); h.pathEdges = tourToEdges(step.tour); }
  if (key === 'nn') {
    if (step.current_node) h.currentNode = step.current_node;
    if (step.edge_added)   h.addedEdges = [step.edge_added];
  } else if (key === 'two_opt') {
    if (step.swap) { h.removedEdges = step.swap.removed; h.addedEdges = step.swap.added; }
  }
  return h;
}

function drawPanel(key, step) {
  const canvas = canvases[key];
  fitCanvas(canvas);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (!S.nodes.length) return;

  const color  = ALGO_COLORS[key];
  const scaled = scaleNodes(S.nodes, W, H, 34);
  const nm     = Object.fromEntries(scaled.map(n => [n.id, n]));
  const h      = highlights(key, step);

  const eset = (arr) => new Set((arr || []).map(e => `${e.source}→${e.target}`));
  const removed = eset(h.removedEdges), added = eset(h.addedEdges), path = eset(h.pathEdges);

  S.edges.forEach(e => {
    const a = nm[e.source], b = nm[e.target];
    if (!a || !b) return;
    const k1 = `${e.source}→${e.target}`, k2 = `${e.target}→${e.source}`;
    if (removed.has(k1) || removed.has(k2) || path.has(k1) || path.has(k2)) return;
    drawEdge(ctx, a.sx, a.sy, b.sx, b.sy, '#1e1e2e', 1, null, S.directed, null);
  });
  (h.pathEdges || []).forEach(e => {
    const a = nm[e.source], b = nm[e.target];
    if (!a || !b) return;
    if (edgeExists(e.source, e.target)) {
      drawEdge(ctx, a.sx, a.sy, b.sx, b.sy, color + 'cc', 2.6, null, S.directed, null);
    } else {
      // segment inexistant dans le graphe → tracé rouge pointillé (jamais "plein")
      drawEdge(ctx, a.sx, a.sy, b.sx, b.sy, '#ef444466', 1.5, [3, 5], S.directed, null);
    }
  });
  (h.removedEdges || []).forEach(e => {
    const a = nm[e.source], b = nm[e.target];
    if (a && b) drawEdge(ctx, a.sx, a.sy, b.sx, b.sy, '#f87171', 2, [6, 4], S.directed, null);
  });
  (h.addedEdges || []).forEach(e => {
    const a = nm[e.source], b = nm[e.target];
    if (a && b && edgeExists(e.source, e.target)) drawEdge(ctx, a.sx, a.sy, b.sx, b.sy, '#34d399', 3, null, S.directed, null);
  });
  scaled.forEach(n => {
    const inPath = h.pathNodes.has(n.id);
    const isCur  = h.currentNode === n.id;
    const isStart = n.id === S.start;
    let fill = '#0c0c12', stroke = '#2c2c40', r = NODE_R;
    if (inPath) { fill = color + '33'; stroke = color + 'aa'; }
    if (isCur)  { fill = color; stroke = '#fff'; r = NODE_R + 3; }
    // anneau du nœud de départ
    if (isStart) { ctx.save(); ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 5, 0, 7); ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); }
    drawNode(ctx, n.sx, n.sy, n.label || n.id, fill, stroke, r, isCur ? '#fff' : color);
  });
}

function redrawAll() {
  ALGO_KEYS.forEach(key => drawPanel(key, S.steps[key][S.idx[key]] || null));
}

/* ── Stats + timestamp ────────────────────────────────────────── */
function updateStats(key) {
  const ids = UI[key], steps = S.steps[key], i = S.idx[key], step = steps[i];
  const data = S.data?.[key];
  if (data) document.getElementById(ids.time).textContent =
    data.time_ms != null ? `${data.time_ms} ms` : '—';
  if (step) {
    const d = fmtDist(step.total_distance);
    document.getElementById(ids.dist).textContent = d;
    document.getElementById(ids.step).textContent = `${i + 1} / ${steps.length}`;
    document.getElementById(ids.desc).textContent = step.description || '';
    document.getElementById(ids.live).textContent = d;
  }
  // temps d'affichage écoulé = nb d'étapes jouées × vitesse
  const elapsed = (i * S.speed) / 1000;
  document.getElementById(ids.ts).textContent = `+${elapsed.toFixed(1)}s`;
}
function resetStats() {
  ALGO_KEYS.forEach(key => {
    const ids = UI[key];
    document.getElementById(ids.time).textContent = '—';
    document.getElementById(ids.dist).textContent = '—';
    document.getElementById(ids.step).textContent = '0 / 0';
    document.getElementById(ids.desc).textContent = 'En attente de simulation…';
    document.getElementById(ids.live).textContent = '—';
    document.getElementById(ids.ts).textContent = '+0.0s';
    document.getElementById(ids.valid).classList.add('hidden');
  });
}

/* ── Boucle ───────────────────────────────────────────────────── */
function tick() {
  let done = true;
  ALGO_KEYS.forEach(key => {
    if (S.idx[key] < S.steps[key].length - 1) { S.idx[key]++; done = false; }
    drawPanel(key, S.steps[key][S.idx[key]]);
    updateStats(key);
  });
  if (done) finish();
}

async function compute() {
  document.getElementById('sim-status').textContent = 'Calcul en arrière-plan…';
  document.getElementById('btn-play').disabled = true;
  let data;
  try {
    data = await api('POST', '/api/simulate', {
      nodes: S.nodes, edges: S.edges, directed: S.directed, start: S.start,
    });
  } catch (err) {
    alert('Erreur : ' + err.message);
    document.getElementById('btn-play').disabled = false;
    document.getElementById('sim-status').textContent = '';
    return false;
  }
  S.data  = data;
  S.steps = { nn: data.nn.steps, two_opt: data.two_opt.steps, genetic: data.genetic.steps };
  S.idx   = { nn: 0, two_opt: 0, genetic: 0 };

  // sauvegarde résultats (localStorage + BDD)
  saveSimResult({ data, directed: S.directed, start: S.start, ts: Date.now() });
  api('POST', '/api/results', {
    graph_name: null,
    nn:      { distance: data.nn.total_distance,      time_ms: data.nn.time_ms,      tour: data.nn.tour },
    two_opt: { distance: data.two_opt.total_distance, time_ms: data.two_opt.time_ms, tour: data.two_opt.tour },
    genetic: { distance: data.genetic.total_distance, time_ms: data.genetic.time_ms, tour: data.genetic.tour },
  }).catch(() => {});

  document.getElementById('btn-play').disabled = false;
  ALGO_KEYS.forEach(key => { drawPanel(key, S.steps[key][0]); updateStats(key); setValidity(key); });
  return true;
}

function setValidity(key) {
  const el = document.getElementById(UI[key].valid);
  const d = S.data?.[key];
  if (!d) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (d.valid !== false) {
    el.className = 'algo-valid ok';
    el.textContent = '✓ Cycle valide — revient au départ';
  } else {
    el.className = 'algo-valid bad';
    el.textContent = '✗ ' + (d.reason || 'Chemin invalide');
  }
}

function play() {
  S.phase = 'playing';
  setPlayButton('⏸ Pause');
  document.getElementById('sim-status').textContent = 'Lecture en cours…';
  document.getElementById('btn-reset-sim').disabled = false;
  S.timer = setInterval(tick, S.speed);
}
function pause() {
  S.phase = 'paused';
  clearInterval(S.timer);
  setPlayButton('▶ Reprendre');
  document.getElementById('sim-status').textContent = 'En pause';
}
function finish() {
  clearInterval(S.timer);
  S.phase = 'done';
  setPlayButton('↻ Relancer');
  document.getElementById('sim-status').textContent = '✓ Terminée — voir l\'onglet Résultats';
}

async function onPlayClick() {
  if (S.phase === 'idle') {
    if (!S.nodes.length) { alert('Aucun graphe.'); return; }
    const ok = await compute();
    if (ok) play();
  } else if (S.phase === 'playing') {
    pause();
  } else if (S.phase === 'paused') {
    play();
  } else if (S.phase === 'done') {
    // rejouer l'animation sans recalculer
    S.idx = { nn: 0, two_opt: 0, genetic: 0 };
    ALGO_KEYS.forEach(key => { drawPanel(key, S.steps[key][0]); updateStats(key); });
    play();
  }
}

function setPlayButton(label) {
  document.getElementById('btn-play').textContent = label;
}

function reset() {
  clearInterval(S.timer);
  S.phase = 'idle';
  S.data = null;
  S.steps = { nn: [], two_opt: [], genetic: [] };
  S.idx   = { nn: 0, two_opt: 0, genetic: 0 };
  setPlayButton('▶ Lancer la simulation');
  document.getElementById('btn-reset-sim').disabled = true;
  document.getElementById('sim-status').textContent = '';
  resetStats();
  redrawAll();
}

document.getElementById('toggle-directed-sim').addEventListener('change', e => {
  S.directed = e.target.checked;
  rebuildEdgeSet();
  updateGraphInfo();
  reset();
});

document.getElementById('btn-play').addEventListener('click', onPlayClick);
document.getElementById('btn-reset-sim').addEventListener('click', reset);
window.addEventListener('resize', redrawAll);

/* ── Info graphe ──────────────────────────────────────────────── */
function updateGraphInfo() {
  document.getElementById('sim-graph-info').textContent =
    `${S.nodes.length} nœuds · ${S.edges.length} arêtes · ${S.directed ? 'dirigé' : 'non-dirigé'} · cycle fermé (départ ${S.start || '?'})`;
}

/* ── Init ─────────────────────────────────────────────────────── */
async function init() {
  try { const cfg = await api('GET', '/api/config'); S.speed = cfg.simulation_speed_ms ?? 1000; } catch {}

  let g = loadGraphState();
  if (!g || !g.nodes || !g.nodes.length) {
    try { g = await api('GET', '/api/graph/default'); } catch { g = null; }
  }
  if (!g || !g.nodes || !g.nodes.length) {
    document.getElementById('empty-notice').classList.remove('hidden');
    return;
  }
  S.nodes = g.nodes; S.edges = g.edges; S.directed = !!g.directed;
  S.start = g.start || (g.nodes[0] ? g.nodes[0].id : null);
  rebuildEdgeSet();
  document.getElementById('toggle-directed-sim').checked = S.directed;
  updateGraphInfo();
  redrawAll();
  requestAnimationFrame(redrawAll);
}
window.addEventListener('load', redrawAll);
init();
