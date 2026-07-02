# lyon-worker

Backend **Cloudflare Worker** de la carte temps réel TCL. Il agrège les données
ouvertes SYTRAL / Grand Lyon et expose exactement le même contrat HTTP que
`lyon-server` (Spring Boot) — le frontend `lyon-web` n'a donc rien à changer,
sinon son URL de base.

## Pourquoi un Worker plutôt que `lyon-server` ?

`lyon-server` tourne sur l'offre gratuite de Render, qui **met le service en
veille** après 15 min d'inactivité : la visite suivante subit un démarrage à
froid de 30 à 50 s (d'où les « Failed to fetch » au premier chargement). Un
Cloudflare Worker **n'a pas de démarrage à froid**, ne demande aucun serveur à
maintenir, et s'exécute au plus près des utilisateurs. `lyon-server` est
conservé tel quel comme référence / solution de repli.

## Contrat HTTP

| Route | Réponse |
|---|---|
| `GET /api/vehicles` | `{ vehicles[], apiResponseTimestamp, lastFetchTime, apiStatus }` |
| `GET /api/vehicles/passages?stopId=…` | `Passage[]` (filtré par arrêt, trié par horaire) |
| `GET /api/lines/{type}` | `{ geojson: string, status }` — `type` ∈ `metro·tram·bus·rhonexpress·stops` |
| `GET /healthz` | `ok` |

`geojson` est une **chaîne** (le frontend fait `JSON.parse(geojson)`), à
l'identique du Java.

## Développement local

```bash
npm install
cp .dev.vars.example .dev.vars   # puis renseigner les identifiants SIRI
npm run dev                      # wrangler dev sur http://localhost:8787
npm test                         # tests unitaires (mapping / dédup / filtres)
```

Les données de lignes/arrêts sont publiques (aucun identifiant requis). Seuls
`/api/vehicles` et `/api/vehicles/passages` interrogent le flux SIRI
authentifié : sans identifiants valides, ils renvoient `apiStatus: "API_DOWN"`
(ou une liste vide) — le reste fonctionne.

## Déploiement

```bash
wrangler deploy
wrangler secret put GRANDLYON_API_USERNAME
wrangler secret put GRANDLYON_API_PASSWORD
```

Puis pointer le frontend vers le Worker en définissant `NEXT_PUBLIC_API_URL`
(voir `lyon-web/app/lib/config.ts`) sur l'URL du Worker, et rebuilder
`lyon-web` (la variable est intégrée au build).

## Cache & quota (important)

Le cache d'arête (`caches.default`, TTL 3 s pour le temps réel, 24 h pour les
lignes) garantit qu'on **ne rappelle l'API Grand Lyon qu'une fois par fenêtre**,
quel que soit le nombre d'utilisateurs — il protège la source amont.

⚠️ Il ne réduit **pas** le quota de requêtes Worker : sur Cloudflare, le Worker
s'exécute *avant* le cache, donc chaque requête entrante compte, même servie
depuis le cache. Le plan gratuit couvre 100 000 requêtes/jour ; comme le
frontend interroge toutes les 3 s, la vraie économie côté quota vient du
frontend (mise en pause quand l'onglet est masqué, fréquence réduite), pas d'ici.
