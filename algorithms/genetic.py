import time
import random
import os
from . import nearest_neighbor


def _env_int(key, default):
    try:
        return int(os.getenv(key, str(default)))
    except (ValueError, TypeError):
        return default


def _env_float(key, default):
    try:
        return float(os.getenv(key, str(default)))
    except (ValueError, TypeError):
        return default


def _cycle_dist(seq, dist):
    total = 0.0
    n = len(seq)
    for i in range(n):
        total += dist[seq[i]][seq[(i + 1) % n]]
    return total


def _ox_crossover(p1, p2):
    """Order Crossover (OX)."""
    n = len(p1)
    if n < 2:
        return p1[:]
    a, b = sorted(random.sample(range(n), 2))
    child = [-1] * n
    child[a:b + 1] = p1[a:b + 1]
    fill = [x for x in p2 if x not in child[a:b + 1]]
    fi = 0
    for i in range(n):
        if child[i] == -1:
            child[i] = fill[fi]; fi += 1
    return child


def _mutate(seq, rate):
    s = seq[:]
    for i in range(len(s)):
        if random.random() < rate:
            j = random.randint(0, len(s) - 1)
            s[i], s[j] = s[j], s[i]
    return s


def _tournament(pop, fits, k):
    cand = random.sample(range(len(pop)), min(k, len(pop)))
    return pop[min(cand, key=lambda i: fits[i])]


def run(nodes: list, edges: list, directed: bool = False, start=None):
    """Algorithme Génétique — cycle fermé (départ fixé)."""
    t0 = time.perf_counter()
    n = len(nodes)
    if n < 4:
        return [], 0.0, [], 0.0

    POP   = _env_int("GA_POPULATION_SIZE", 50)
    GENS  = _env_int("GA_GENERATIONS", 100)
    MUT   = _env_float("GA_MUTATION_RATE", 0.02)
    TOURN = _env_int("GA_TOURNAMENT_SIZE", 5)

    node_ids, idx, dist = nearest_neighbor.build_matrix(nodes, edges, directed)
    si = nearest_neighbor.resolve_start(node_ids, start)

    # départ fixé en position 0 ; la GA permute les autres nœuds
    middle = [k for k in range(n) if k != si]

    def build(perm):
        return [si] + perm

    def fitness(perm):
        return _cycle_dist(build(perm), dist)

    pop  = [random.sample(middle, len(middle)) for _ in range(POP)]
    fits = [fitness(p) for p in pop]
    bi   = min(range(POP), key=lambda i: fits[i])
    best, best_d = pop[bi][:], fits[bi]

    steps = [{
        "type": "init",
        "generation": 0,
        "tour": [node_ids[i] for i in build(best)] + [node_ids[si]],
        "total_distance": round(best_d, 2),
        "population_size": POP,
        "description": f"Population initiale ({POP}). Meilleur : {best_d:.1f}",
    }]

    # une étape d'animation seulement quand le meilleur s'améliore
    for g in range(1, GENS + 1):
        new_pop = [best[:]]  # élitisme
        while len(new_pop) < POP:
            p1 = _tournament(pop, fits, TOURN)
            p2 = _tournament(pop, fits, TOURN)
            new_pop.append(_mutate(_ox_crossover(p1, p2), MUT))
        pop  = new_pop
        fits = [fitness(p) for p in pop]
        gi   = min(range(POP), key=lambda i: fits[i])
        if fits[gi] < best_d - 1e-9:
            best_d, best = fits[gi], pop[gi][:]
            avg = sum(fits) / len(fits)
            steps.append({
                "type": "generation",
                "generation": g,
                "tour": [node_ids[i] for i in build(best)] + [node_ids[si]],
                "total_distance": round(best_d, 2),
                "avg_distance": round(avg, 2),
                "description": f"Gén. {g}/{GENS} — amélioration : {best_d:.1f}",
            })

    INF = float("inf")
    valid = best_d != INF
    final = [node_ids[i] for i in build(best)] + [node_ids[si]]
    steps.append({
        "type": "complete",
        "generation": GENS,
        "tour": final,
        "total_distance": round(best_d, 2) if valid else None,
        "description": (f"Terminé ({GENS} générations). Distance : {best_d:.1f}"
                        if valid else "Aucun cycle valide trouvé (graphe incomplet)."),
    })

    elapsed = (time.perf_counter() - t0) * 1000
    return {
        "steps": steps,
        "total_distance": round(best_d, 2) if valid else None,
        "tour": final,
        "time_ms": round(elapsed, 3),
        "valid": valid,
        "reason": "" if valid else "Le graphe ne permet pas de boucler.",
    }
