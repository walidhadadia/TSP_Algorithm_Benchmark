import time
from . import nearest_neighbor


def _cycle_dist(seq, dist):
    """Distance d'un cycle fermé (inclut le retour seq[-1] → seq[0])."""
    total = 0.0
    n = len(seq)
    for i in range(n):
        total += dist[seq[i]][seq[(i + 1) % n]]
    return total


def run(nodes: list, edges: list, directed: bool = False, start=None):
    """2-Opt — amélioration locale d'un cycle fermé, à partir du tour PPV."""
    t0 = time.perf_counter()
    n = len(nodes)
    if n < 3:
        return [], 0.0, [], 0.0

    node_ids, idx, dist = nearest_neighbor.build_matrix(nodes, edges, directed)
    si = nearest_neighbor.resolve_start(node_ids, start)

    # Tour initial via PPV (même départ)
    nn_res = nearest_neighbor.run(nodes, edges, directed, start)
    nn_tour = nn_res["tour"]
    seq_ids = nn_tour[:-1] if (len(nn_tour) > 1 and nn_tour[-1] == nn_tour[0]) else nn_tour
    tour = [idx[nid] for nid in seq_ids if nid in idx]
    # compléter avec les nœuds manquants si PPV s'est arrêté en chemin
    if len(tour) < n:
        seen = set(tour)
        tour += [k for k in range(n) if k not in seen]

    current_dist = _cycle_dist(tour, dist)
    steps = [{
        "type": "init",
        "tour": [node_ids[i] for i in tour] + [node_ids[tour[0]]],
        "total_distance": round(current_dist, 2),
        "swap": None,
        "improvement": 0.0,
        "description": f"Tour initial (PPV) : {current_dist:.1f}",
    }]

    improved = True
    swap_count = 0
    while improved:
        improved = False
        for i in range(n - 1):
            for j in range(i + 2, n):
                if i == 0 and j == n - 1:
                    continue  # arêtes adjacentes dans le cycle
                candidate = tour[:i + 1] + tour[i + 1:j + 1][::-1] + tour[j + 1:]
                new_dist = _cycle_dist(candidate, dist)
                if new_dist < current_dist - 1e-9:
                    a, b = tour[i], tour[i + 1]
                    c, d = tour[j], tour[(j + 1) % n]
                    gain = current_dist - new_dist
                    tour = candidate
                    current_dist = new_dist
                    improved = True
                    swap_count += 1
                    steps.append({
                        "type": "swap",
                        "tour": [node_ids[k] for k in tour] + [node_ids[tour[0]]],
                        "total_distance": round(current_dist, 2),
                        "swap": {
                            "removed": [
                                {"source": node_ids[a], "target": node_ids[b]},
                                {"source": node_ids[c], "target": node_ids[d]},
                            ],
                            "added": [
                                {"source": node_ids[a], "target": node_ids[c]},
                                {"source": node_ids[b], "target": node_ids[d]},
                            ],
                        },
                        "improvement": round(gain, 2),
                        "description": f"Échange #{swap_count} : gain={gain:.1f}  →  {current_dist:.1f}",
                    })
                    break
            if improved:
                break

    INF = float("inf")
    valid = current_dist != INF
    final_tour = [node_ids[i] for i in tour] + [node_ids[tour[0]]]
    steps.append({
        "type": "complete",
        "tour": final_tour,
        "total_distance": round(current_dist, 2) if valid else None,
        "swap": None,
        "improvement": 0.0,
        "description": (f"Optimum local — {swap_count} échange(s). Distance : {current_dist:.1f}"
                        if valid else "Aucun cycle valide (le graphe ne permet pas de boucler)."),
    })

    elapsed = (time.perf_counter() - t0) * 1000
    return {
        "steps": steps,
        "total_distance": round(current_dist, 2) if valid else None,
        "tour": final_tour,
        "time_ms": round(elapsed, 3),
        "valid": valid,
        "reason": "" if valid else "Le cycle emprunte une arête inexistante.",
    }
