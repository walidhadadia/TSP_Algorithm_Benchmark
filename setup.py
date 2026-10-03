"""
setup.py — Initialise le projet (variables d'environnement + base de données).
Commande : python setup.py
"""
import shutil
import os
from pathlib import Path

ROOT = Path(__file__).parent
ENV_EXAMPLE = ROOT / ".env.example"
ENV_FILE    = ROOT / ".env"

print("Configuration du projet Comparaison d'Algorithmes de Graphes\n")

# 1. Créer .env à partir de .env.example si absent
if ENV_FILE.exists():
    print("[OK]  .env existe déjà — aucune modification.")
else:
    shutil.copy(ENV_EXAMPLE, ENV_FILE)
    print("[OK]  .env créé à partir de .env.example")

# 2. Initialiser la base de données SQLite
os.chdir(ROOT)           # garantit que data.db sera créé au bon endroit
import sys
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ENV_FILE)

from database import init_db
init_db()
print("[OK]  Base de données SQLite initialisée (data.db)")

print("\nProjet pret. Lancez : python run.py")
