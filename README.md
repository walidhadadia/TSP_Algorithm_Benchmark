# Comparaison d'Algorithmes de Graphes — TSP

Application web interactive pour comparer visuellement trois algorithmes de résolution du **Problème du Voyageur de Commerce (TSP)** sur un graphe personnalisable.

---

## Aperçu

| Page | Description |
|---|---|
| **/** — Éditeur | Créez et modifiez votre graphe : nœuds, arêtes, poids, départ |
| **/simulation** | Lancez et observez les 3 algorithmes côte à côte, pas à pas |
| **/resultats** | Comparez les résultats, triez par distance ou temps |

### Algorithmes implémentés

| Algorithme | Catégorie | Garantie d'optimalité |
|---|---|---|
| **Plus Proche Voisin** | Glouton O(n²) | ❌ Heuristique |
| **2-Opt** | Amélioration locale | ❌ Optimum local |
| **Algorithme Génétique** | Méta-heuristique | ❌ Bonne approximation |

---

## Installation & Lancement — 3 commandes

### 1 — Installer les dépendances

```bash
pip install -r requirements.txt
```

### 2 — Configurer le projet

```bash
python setup.py
```

> Crée le fichier `.env` à partir de `.env.example` et initialise la base de données SQLite (`data.db`).

### 3 — Lancer l'application

```bash
python run.py
```

> Trouve automatiquement un port libre (à partir de 8000) et démarre le serveur.
> L'URL s'affiche dans le terminal, par exemple : `http://127.0.0.1:8000`

## Déploiement sur Vercel

Le projet inclut un point d'entrée FastAPI (`api/index.py`) et une configuration Vercel (`vercel.json`). Pour le déployer :

1. Poussez le projet sur GitHub, puis importez ce dépôt dans Vercel.
2. Laissez Vercel détecter Python et déployer le projet. Aucun dossier de sortie frontend n'est nécessaire.

Les pages et l'API sont servies par une fonction Python. Sur Vercel, SQLite utilise `/tmp` : les graphes enregistrés et l'historique ne sont pas persistants et peuvent disparaître entre deux exécutions ou instances. Pour conserver ces données en production, remplacez SQLite par une base de données hébergée.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Backend | **FastAPI** + Uvicorn |
| Frontend | HTML / CSS / JavaScript vanilla |
| Base de données | **SQLite** (stdlib Python) |
| Algorithmes | Python pur (pas de dépendances ML) |

---

## Structure du projet

```
Most_Optimal_Path/
│
├── main.py                  # Application FastAPI (API + routes pages)
├── database.py              # Connexion SQLite et init des tables
├── run.py                   # Lanceur avec détection de port libre
├── setup.py                 # Initialisation (env + BDD)
│
├── algorithms/
│   ├── nearest_neighbor.py  # Plus Proche Voisin
│   ├── two_opt.py           # 2-Opt (amélioration locale)
│   └── genetic.py          # Algorithme Génétique (OX crossover)
│
├── static/
│   ├── graphe.html / .js    # Page 1 : éditeur de graphe
│   ├── simulation.html / .js # Page 2 : simulation pas à pas
│   ├── resultats.html / .js  # Page 3 : comparaison des résultats
│   ├── common.js            # Utilitaires partagés (API, canvas, stockage)
│   └── style.css            # Thème sombre
│
├── requirements.txt
├── .env.example             # Variables d'environnement par défaut
└── .gitignore
```

---

## Configuration (`.env`)

| Variable | Défaut | Description |
|---|---|---|
| `SIMULATION_SPEED_MS` | `1000` | Délai entre chaque étape d'animation (ms) |
| `DB_PATH` | `data.db` | Chemin de la base de données SQLite |
| `GA_POPULATION_SIZE` | `50` | Taille de la population (Algo Génétique) |
| `GA_GENERATIONS` | `100` | Nombre de générations |
| `GA_MUTATION_RATE` | `0.02` | Taux de mutation (0–1) |
| `GA_TOURNAMENT_SIZE` | `5` | Taille du tournoi pour la sélection |
| `HOST` | `127.0.0.1` | Adresse d'écoute du serveur |
| `PORT` | `8000` | Port préféré (automatiquement incrémenté si occupé) |

---

## Fonctionnalités de l'éditeur

- **Modes** : Sélectionner/Déplacer · Ajouter nœud · Ajouter arête · Modifier poids · Supprimer
- **Navigation** : glisser le fond pour se déplacer · molette pour zoomer · bouton ⊙ Ajuster
- **Graphes prédéfinis** : Graphe 1 (6 nœuds) · Graphe 2 (5 nœuds)
- **Sauvegarde** : persistance locale (localStorage) + sauvegarde nommée en base de données
- **Nœud de départ** : sélectionnable, marqué par un anneau vert

## Fonctionnalités de la simulation

- Calcul en arrière-plan, puis relecture pas à pas (1 s/étape par défaut)
- Bouton **Play ⇄ Pause** + Reset (danger)
- Horodatage écoulé par panneau (+Xs)
- Mode **dirigé / non-dirigé** togglable
- Indicateur de validité : ✓ Cycle valide ou ✗ + raison

## Fonctionnalités des résultats

- Cartes comparatives de la dernière simulation
- Tri par **distance** ou **temps** avec badges de rang (#1/#2/#3)
- Historique groupé par exécution (une ligne par simulation, 3 colonnes algo)

---

## Comportement sur graphe incomplet

Si le graphe que vous dessinez ne permet pas de former un cycle hamiltonien complet :

- **Plus Proche Voisin** : s'arrête à l'endroit où il est bloqué, signale l'arête manquante
- **2-Opt & Génétique** : signalent le cycle comme invalide (distance = ∞)
- Le canvas affiche les segments inexistants en **rouge pointillé** pour visualiser le problème

> **Conseil** : utilisez un graphe complet (tous les nœuds reliés entre eux) pour garantir un cycle valide sur les 3 algorithmes.

---

## Prérequis

- Python **3.10+**
- pip
