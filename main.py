import os
import json
import uuid
import math
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

from database import init_db, get_connection
from algorithms import nearest_neighbor, two_opt, genetic

app = FastAPI(title="Comparaison d'Algorithmes de Graphes")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


@app.on_event("startup")
async def startup():
    init_db()


# ── Modèles Pydantic ──────────────────────────────────────────────────────────

class NodeModel(BaseModel):
    id: str
    x: float
    y: float
    label: Optional[str] = None


class EdgeModel(BaseModel):
    id: str
    source: str
    target: str
    weight: float


class SimulateRequest(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    directed: bool = False
    start: Optional[str] = None


class SaveGraphRequest(BaseModel):
    name: str
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    directed: bool = False


class SaveResultRequest(BaseModel):
    graph_name: Optional[str] = None
    nn: Optional[dict] = None
    two_opt: Optional[dict] = None
    genetic: Optional[dict] = None


# ── Graphe par défaut (12 nœuds, graphe complet euclidien) ───────────────────

def _complete_graph(raw) -> dict:
    """Construit un graphe COMPLET (toutes les paires reliées) à partir de
    nœuds positionnés ; poids = distance euclidienne."""
    pos = {n["id"]: n for n in raw}

    def w(a, b):
        na, nb = pos[a], pos[b]
        return round(((na["x"] - nb["x"]) ** 2 + (na["y"] - nb["y"]) ** 2) ** 0.5, 1)

    ids = [nd["id"] for nd in raw]
    edges, eid = [], 0
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            edges.append({"id": f"e{eid}", "source": ids[i], "target": ids[j], "weight": w(ids[i], ids[j])})
            eid += 1
    return {"nodes": raw, "edges": edges, "directed": False}


# Graphe 1 : 6 nœuds en hexagone (complet, 15 arêtes)
GRAPH_1 = _complete_graph([
    {"id": "A", "x": 400, "y":  70, "label": "A"},
    {"id": "B", "x": 640, "y": 210, "label": "B"},
    {"id": "C", "x": 640, "y": 430, "label": "C"},
    {"id": "D", "x": 400, "y": 540, "label": "D"},
    {"id": "E", "x": 160, "y": 430, "label": "E"},
    {"id": "F", "x": 160, "y": 210, "label": "F"},
])

# Graphe 2 : 5 nœuds en pentagone, tous reliés (complet, 10 arêtes)
GRAPH_2 = _complete_graph([
    {"id": "A", "x": 400, "y":  90, "label": "A"},
    {"id": "B", "x": 610, "y": 250, "label": "B"},
    {"id": "C", "x": 530, "y": 500, "label": "C"},
    {"id": "D", "x": 270, "y": 500, "label": "D"},
    {"id": "E", "x": 190, "y": 250, "label": "E"},
])

DEFAULT_GRAPHS = {1: GRAPH_1, 2: GRAPH_2}
DEFAULT_GRAPH = GRAPH_1  # rétro-compatibilité


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    return {"simulation_speed_ms": int(os.getenv("SIMULATION_SPEED_MS", "400"))}


@app.get("/api/graph/default")
def get_default_graph(which: int = 1):
    return DEFAULT_GRAPHS.get(which, GRAPH_1)


def _clean(obj):
    """Remplace récursivement les flottants non finis (inf, nan) par None
    afin que la réponse soit sérialisable en JSON (graphe incomplet/dirigé)."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return obj


@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    nodes = [n.model_dump() for n in req.nodes]
    edges = [e.model_dump() for e in req.edges]
    directed = req.directed
    start = req.start

    return _clean({
        "nn":      nearest_neighbor.run(nodes, edges, directed, start),
        "two_opt": two_opt.run(nodes, edges, directed, start),
        "genetic": genetic.run(nodes, edges, directed, start),
    })


@app.get("/api/graphs")
def list_graphs():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, name, directed, created_at FROM graphs ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/graphs")
def save_graph(req: SaveGraphRequest):
    conn = get_connection()
    conn.execute(
        "INSERT INTO graphs (name, nodes, edges, directed) VALUES (?, ?, ?, ?)",
        (
            req.name,
            json.dumps([n.model_dump() for n in req.nodes]),
            json.dumps([e.model_dump() for e in req.edges]),
            int(req.directed),
        ),
    )
    conn.commit()
    gid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": gid, "message": "Graphe sauvegardé"}


@app.get("/api/graphs/{graph_id}")
def load_graph(graph_id: int):
    conn = get_connection()
    row = conn.execute("SELECT * FROM graphs WHERE id = ?", (graph_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Graphe non trouvé")
    d = dict(row)
    d["nodes"]    = json.loads(d["nodes"])
    d["edges"]    = json.loads(d["edges"])
    d["directed"] = bool(d["directed"])
    return d


@app.delete("/api/graphs/{graph_id}")
def delete_graph(graph_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM graphs WHERE id = ?", (graph_id,))
    conn.commit()
    conn.close()
    return {"message": "Graphe supprimé"}


@app.get("/api/results")
def list_results():
    """Liste à plat (compatibilité)."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM run_results ORDER BY created_at DESC LIMIT 60"
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("path"):
            d["path"] = json.loads(d["path"])
        out.append(d)
    return out


@app.get("/api/results/grouped")
def list_results_grouped():
    """Une entrée par exécution (run_id) regroupant les 3 algorithmes."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM run_results ORDER BY created_at DESC, id DESC LIMIT 150"
    ).fetchall()
    conn.close()

    runs = {}
    order = []
    for r in rows:
        d = dict(r)
        rid = d.get("run_id") or f"legacy-{d['id']}"
        if rid not in runs:
            runs[rid] = {
                "run_id": rid,
                "graph_name": d.get("graph_name"),
                "created_at": d.get("created_at"),
                "algos": {},
            }
            order.append(rid)
        runs[rid]["algos"][d["algorithm"]] = {
            "distance": d.get("distance"),
            "time_ms": d.get("execution_time_ms"),
        }
    return [runs[rid] for rid in order][:30]


@app.post("/api/results")
def save_results(req: SaveResultRequest):
    conn = get_connection()
    run_id = uuid.uuid4().hex[:12]
    for key, data in [("nn", req.nn), ("two_opt", req.two_opt), ("genetic", req.genetic)]:
        if data:
            conn.execute(
                "INSERT INTO run_results (run_id, graph_name, algorithm, distance, execution_time_ms, path)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    run_id,
                    req.graph_name,
                    key,
                    data.get("distance"),
                    data.get("time_ms"),
                    json.dumps(data.get("tour", [])),
                ),
            )
    conn.commit()
    conn.close()
    return {"run_id": run_id}
    return {"message": "Résultats sauvegardés"}


# ── Frontend ──────────────────────────────────────────────────────────────────

@app.get("/")
def page_graphe():
    return FileResponse(STATIC_DIR / "graphe.html")


@app.get("/simulation")
def page_simulation():
    return FileResponse(STATIC_DIR / "simulation.html")


@app.get("/resultats")
def page_resultats():
    return FileResponse(STATIC_DIR / "resultats.html")


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
