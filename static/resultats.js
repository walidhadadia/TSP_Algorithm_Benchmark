/* ═══════════════════════════════════════════════════════════════
   resultats.js — page 3
═══════════════════════════════════════════════════════════════ */
const ALGO_CLASS = { nn: 'algo-tag-nn', two_opt: 'algo-tag-2opt', genetic: 'algo-tag-ga' };
const ALGO_SUB   = { nn: 'Glouton', two_opt: 'Amélioration locale', genetic: 'Méta-heuristique' };

/* ── Cartes comparatives de la dernière simulation ────────────── */
function renderLastSim() {
  const result = loadSimResult();
  const cont    = document.getElementById('last-sim-cards');
  const empty   = document.getElementById('last-sim-empty');

  if (!result || !result.data) {
    cont.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const d = result.data;
  let entries = ALGO_KEYS.map(k => ({
    key: k,
    dist: d[k].total_distance,
    time: d[k].time_ms,
    tour: d[k].tour,
    valid: d[k].valid !== false,
    reason: d[k].reason || '',
  }));

  // tri
  const mode = document.getElementById('select-sort').value;
  const big = Number.POSITIVE_INFINITY;
  if (mode === 'distance') entries = [...entries].sort((a, b) => (a.dist ?? big) - (b.dist ?? big));
  else if (mode === 'time') entries = [...entries].sort((a, b) => (a.time ?? big) - (b.time ?? big));

  cont.innerHTML = entries.map((e, i) => {
    const rank = mode !== 'none' ? `<span class="cc-rank">#${i + 1}</span>` : '';
    const validity = e.valid
      ? '<span class="cc-valid ok">✓ cycle valide (revient au départ)</span>'
      : `<span class="cc-valid bad">✗ ${e.reason || 'chemin invalide'}</span>`;
    return `
      <div class="compare-card ${e.valid ? '' : 'card-invalid'}" style="--accent:${ALGO_COLORS[e.key]}">
        <div class="cc-head">
          <span class="cc-title">${rank}${ALGO_DISPLAY[e.key]}</span>
        </div>
        <div class="cc-sub">${ALGO_SUB[e.key]}</div>
        <div class="cc-dist">${e.dist != null ? e.dist.toFixed(1) : '∞'}</div>
        <div class="cc-dist-label">distance totale</div>
        <div class="cc-time">⏱ ${e.time != null ? e.time.toFixed(2) : '—'} ms</div>
        ${validity}
        <div class="cc-tour">${(e.tour || []).join(' → ')}</div>
      </div>`;
  }).join('');
}

document.getElementById('select-sort').addEventListener('change', renderLastSim);

/* ── Historique BDD (groupé par exécution) ────────────────────── */
function cell(algo) {
  if (!algo) return '<td class="muted-cell">—</td>';
  const d = algo.distance != null ? algo.distance.toFixed(1) : '∞';
  const t = algo.time_ms != null ? algo.time_ms.toFixed(2) : '—';
  return `<td><span class="cell-dist">${d}</span><span class="cell-time">${t} ms</span></td>`;
}

async function loadHistory() {
  let runs = [];
  try { runs = await api('GET', '/api/results/grouped'); } catch {}
  const tbody = document.getElementById('results-body');
  const table = document.getElementById('results-table');
  const empty = document.getElementById('results-empty');

  if (!runs.length) {
    table.classList.add('hidden'); empty.classList.remove('hidden'); return;
  }
  table.classList.remove('hidden'); empty.classList.add('hidden');
  tbody.innerHTML = runs.map(run => {
    const date = new Date(run.created_at + 'Z').toLocaleString('fr-FR');
    return `<tr>
      <td class="td-date">${date}</td>
      <td>${run.graph_name || '—'}</td>
      ${cell(run.algos.nn)}
      ${cell(run.algos.two_opt)}
      ${cell(run.algos.genetic)}
    </tr>`;
  }).join('');
}

document.getElementById('btn-refresh').addEventListener('click', loadHistory);

renderLastSim();
loadHistory();
