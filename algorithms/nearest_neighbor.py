import time


def build_matrix(nodes, edges, directed):
    """Construit la matrice des distances. Les arêtes manquantes valent
    l'infini : les algorithmes n'empruntent QUE des arêtes réelles.
    Retourne (node_ids, idx, dist)."""
    node_ids = [nd["id"] for nd in nodes]
    idx = {nid: i for i, nid in enumerate(node_ids)}
    n = len(node_ids)
    INF = float("inf")

    dist = [[INF] * n for _ in range(n)]
    for i in range(n):
        dist[i][i] = 0.0
    for e in edges:
        i, j = idx.get(e["source"]), idx.get(e["target"])
        if i is None or j is None:
            continue
        dist[i][j] = e["weight"]
        if not directed:
            dist[j][i] = e["weight"]
    return node_ids, idx, dist


def resolve_start(node_ids, start):
    idx = {nid: i for i, nid in enumerate(node_ids)}
    return idx.get(start, 0)


def run(nodes: list, edges: list, directed: bool = False, start=None):
    """Plus Proche Voisin — cycle fermé (visite tout puis revient au départ)."""
    t0 = time.perf_counter()
    n = len(nodes)
    if n == 0:
        return [], 0.0, [], 0.0

    INF = float("inf")
    node_ids, idx, dist = build_matrix(nodes, edges, directed)
    si = resolve_start(node_ids, start)

    visited = [False] * n
    current = si
    visited[si] = True
    tour = [node_ids[si]]
    total = 0.0
    valid = True
    reason = ""
    steps = [{
        "type": "init",
        "current_node": node_ids[si],
        "edge_added": None,
        "tour": tour.copy(),
        "total_distance": 0.0,
        "unvisited": [node_ids[k] for k in range(n) if not visited[k]],
        "description": f"Départ depuis {node_ids[si]}",
    }]

    for _ in range(n - 1):
        # choisir le plus proche voisin ATTEIGNABLE (arête réelle)
        best_j, best_d = -1, INF
        for j in range(n):
            if not visited[j] and dist[current][j] < best_d:
                best_d, best_j = dist[current][j], j

        if best_j == -1:  # aucun voisin réel non visité → bloqué (pas d'arête fantôme)
            valid = False
            reason = f"Bloqué à {node_ids[current]} : aucune arête vers un nœud non visité."
            steps.append({
                "type": "stuck",
                "current_node": node_ids[current],
                "edge_added": None,
                "tour": tour.copy(),
                "total_distance": round(total, 2),
                "unvisited": [node_ids[k] for k in range(n) if not visited[k]],
                "description": reason,
            })
            break

        prev = node_ids[current]
        total += best_d
        visited[best_j] = True
        tour.append(node_ids[best_j])
        current = best_j
        steps.append({
            "type": "move",
            "current_node": node_ids[current],
            "edge_added": {"source": prev, "target": node_ids[current], "weight": best_d},
            "tour": tour.copy(),
            "total_distance": round(total, 2),
            "unvisited": [node_ids[k] for k in range(n) if not visited[k]],
            "description": f"→ {node_ids[current]}  (d={best_d:.1f},  Σ={total:.1f})",
        })

    # fermeture du cycle : retour au départ SEULEMENT si l'arête existe
    if valid and all(visited):
        ret = dist[current][si]
        if ret == INF:
            valid = False
            reason = f"Pas d'arête de retour {node_ids[current]} → {node_ids[si]} : cycle non bouclé."
            steps.append({
                "type": "stuck",
                "current_node": node_ids[current],
                "edge_added": None,
                "tour": tour.copy(),
                "total_distance": round(total, 2),
                "unvisited": [],
                "description": reason,
            })
        else:
            total += ret
            tour.append(node_ids[si])
            steps.append({
                "type": "complete",
                "current_node": node_ids[si],
                "edge_added": {"source": node_ids[current], "target": node_ids[si], "weight": ret},
                "tour": tour.copy(),
                "total_distance": round(total, 2),
                "unvisited": [],
                "description": f"Retour au départ {node_ids[si]} (d={ret:.1f}). Distance totale : {total:.1f}",
            })
    elif valid:
        valid = False
        reason = "Tous les nœuds n'ont pas été visités."

    elapsed = (time.perf_counter() - t0) * 1000
    return {
        "steps": steps,
        "total_distance": round(total, 2),
        "tour": tour,
        "time_ms": round(elapsed, 3),
        "valid": valid,
        "reason": reason,
    }
