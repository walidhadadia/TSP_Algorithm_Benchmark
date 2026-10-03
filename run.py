"""
run.py — Démarre le serveur sur un port libre (8000 par défaut, sinon +1).
Commande : python run.py
"""
import socket
import subprocess
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

PREFERRED = int(os.getenv("PORT", 8000))
HOST      = os.getenv("HOST", "127.0.0.1")


def find_free_port(start: int, host: str = "127.0.0.1") -> int:
    port = start
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                port += 1
    raise RuntimeError("Aucun port libre trouvé.")


port = find_free_port(PREFERRED, HOST)
if port != PREFERRED:
    print(f"[WARN]  Port {PREFERRED} occupé — utilisation du port {port}")

url = f"http://{HOST}:{port}"
print(f"\n==>  Démarrage sur {url}")
print(f"   Page Graphe    : {url}/")
print(f"   Simulation     : {url}/simulation")
print(f"   Résultats      : {url}/resultats")
print("\n   Ctrl+C pour arrêter\n")

subprocess.run(
    [
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", HOST,
        "--port", str(port),
        "--reload",
    ],
    cwd=Path(__file__).parent,
)
