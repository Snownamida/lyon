# Lyon — Carte temps réel des transports TCL

Visualiseur en temps réel des transports en commun lyonnais (réseau **TCL** : bus, tramway, métro), construit à partir des données ouvertes du **SYTRAL** / Grand Lyon.

**Démo en ligne : [lyon-web.vercel.app](https://lyon.snownamida.top)**

![Capture d'écran de la carte temps réel](docs/screenshot.jpg)

> Capture prise de nuit : le réseau TCL étant à l'arrêt, aucun véhicule ne circule et le flux temps réel du Grand Lyon est vide (d'où l'avertissement affiché). En journée, les véhicules apparaissent et se déplacent sur la carte.

## Fonctionnalités

- Positions des véhicules mises à jour toutes les 3 secondes sur une carte interactive (Leaflet / OpenStreetMap)
- Affichage des tracés de lignes (bus, tram, métro) avec leurs couleurs officielles
- Tableau de bord : nombre de véhicules par mode, ponctualité (à l'heure / en retard / en avance)
- Orientation des véhicules (flèches de cap) et géolocalisation de l'utilisateur

## Architecture

Monorepo composé de trois parties :

```
lyon/
├── lyon-web/       Frontend Next.js (React 19, react-leaflet, Tailwind CSS)
├── lyon-server/    Backend Java 21 / Spring Boot (agrégation des données SYTRAL)
└── data-example/   Échantillons des flux open data SYTRAL (arrêts, lignes, passages, SIRI)
```

```
Open data SYTRAL / Grand Lyon
        │  (SIRI vehicle monitoring, GeoJSON lignes & arrêts)
        ▼
lyon-server (Spring Boot)
  • GET /api/vehicles          → positions temps réel + ponctualité
  • GET /api/vehicles/passages → prochains passages
  • GET /api/lines/{type}      → tracés GeoJSON (bus / tram / métro)
  • GET /healthz               → sonde de vie
        │  (JSON, rafraîchi côté client toutes les 3 s)
        ▼
lyon-web (Next.js) → carte Leaflet dans le navigateur
```

Le frontend est déployé sur **Vercel** ; le backend est hébergé sur **Render** (offre gratuite : un démarrage à froid de 30 à 50 secondes est possible lors de la première visite).

## Développement local

### Backend (`lyon-server`)

Prérequis : Java 21.

```bash
cd lyon-server
./mvnw spring-boot:run
# API disponible sur http://localhost:8080
```

Ou via Docker :

```bash
cd lyon-server
docker build -t lyon-server .
docker run -p 8080:8080 lyon-server
```

### Frontend (`lyon-web`)

Prérequis : Node.js 20+.

```bash
cd lyon-web
npm ci
npm run dev
# Application disponible sur http://localhost:3000
```

Par défaut, le frontend interroge `http://localhost:8080`. Pour pointer vers un autre backend, définissez la variable d'environnement :

```bash
NEXT_PUBLIC_API_URL=https://mon-backend.example.com npm run dev
```

## Données

Les données proviennent des jeux open data du SYTRAL / Métropole de Lyon (data.grandlyon.com) : positions des véhicules (SIRI vehicle monitoring), arrêts, tracés des lignes de bus, tramway, métro/funiculaire et Rhônexpress. Le dossier `data-example/` contient des échantillons de ces flux pour référence.

## Soutenir le projet

Si ce projet vous est utile, vous pouvez [☕ soutenir son développement sur Ko-fi](https://ko-fi.com/snownamida).

## Licence

[MIT](LICENSE) © Snownamida
