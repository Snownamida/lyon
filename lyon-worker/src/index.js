/**
 * lyon-worker — backend Cloudflare Worker de la carte temps réel TCL.
 *
 * Réimplémente à l'identique le contrat HTTP de `lyon-server` (Spring Boot) :
 *   GET /api/vehicles              → { vehicles[], apiResponseTimestamp, lastFetchTime, apiStatus }
 *   GET /api/vehicles/passages     → Passage[]   (filtré par ?stopId=)
 *   GET /api/lines/{type}          → { geojson: string, status }   (type: metro|tram|bus|rhonexpress|stops)
 *   GET /healthz                   → "ok"
 *
 * Le frontend (lyon-web) n'a donc rien à changer sinon l'URL de base.
 *
 * Pourquoi un backend et pas un appel direct depuis le navigateur :
 *   1. le flux SIRI Grand Lyon exige une authentification Basic (identifiants
 *      secrets, à ne jamais exposer côté client) ;
 *   2. CORS ;
 *   3. mise en cache courte (3 s) pour ne pas marteler l'API amont.
 *
 * Le cache d'arête Cloudflare (`caches.default`) protège l'API amont : quel que
 * soit le nombre d'utilisateurs, on ne rappelle Grand Lyon qu'une fois par
 * fenêtre de TTL. (Il ne réduit PAS le compteur de requêtes Worker : le Worker
 * s'exécute avant le cache — voir README.)
 */

// --- URL amont (données ouvertes publiques, comme application.properties) ---
const UPSTREAM = {
  vehicles: "https://data.grandlyon.com/siri-lite/2.0/vehicle-monitoring.json",
  passages:
    "https://data.grandlyon.com/fr/datapusher/ws/rdata/tcl_sytral.tclpassagearret/all.json?maxfeatures=-1&start=1",
  lines: {
    metro:
      "https://data.grandlyon.com/fr/geoserv/ogc/features/v1/collections/sytral:tcl_sytral.tcllignemf_2_0_0/items?&f=application/geo%2Bjson&crs=EPSG:4326&startIndex=0&sortby=gid",
    tram: "https://data.grandlyon.com/fr/geoserv/ogc/features/v1/collections/sytral:tcl_sytral.tcllignetram_2_0_0/items?&f=application/geo%2Bjson&crs=EPSG:4326&startIndex=0&sortby=gid",
    bus: "https://data.grandlyon.com/fr/geoserv/ogc/features/v1/collections/sytral:tcl_sytral.tcllignebus_2_0_0/items?&f=application/geo%2Bjson&crs=EPSG:4326&startIndex=0&sortby=gid",
    rhonexpress:
      "https://data.grandlyon.com/fr/geoserv/ogc/features/v1/collections/sytral:rx_rhonexpress.rxligne_2_0_0/items?&f=application/geo%2Bjson&crs=EPSG:4326&startIndex=0&sortby=gid",
    stops:
      "https://data.grandlyon.com/fr/geoserv/ogc/features/v1/collections/sytral:tcl_sytral.tclarret/items?&f=application/geo%2Bjson&crs=EPSG:4326&startIndex=0",
  },
};

// Durées de cache (secondes). Positions/passages = temps réel ; lignes = quasi figées.
const TTL = { vehicles: 3, passages: 3, lines: 86400 };

const EMPTY_FC = '{"type":"FeatureCollection","features":[]}';

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// --- Helpers de réponse -----------------------------------------------------

/** Réponse JSON avec CORS et, optionnellement, un Cache-Control cacheable. */
function json(data, { status = 200, maxAge } = {}) {
  const headers = { "Content-Type": "application/json; charset=utf-8", ...CORS };
  if (maxAge != null && maxAge > 0) headers["Cache-Control"] = `public, max-age=${maxAge}`;
  return new Response(JSON.stringify(data), { status, headers });
}

/** En-tête d'authentification Basic pour le flux SIRI/passages Grand Lyon. */
function authHeader(env) {
  return "Basic " + btoa(`${env.GRANDLYON_API_USERNAME}:${env.GRANDLYON_API_PASSWORD}`);
}

// --- Fonctions pures (testées dans index.test.js) ---------------------------

/**
 * Convertit une durée ISO-8601 (« PT3M », « -PT1M30S », « PT30S »…) en secondes.
 * Renvoie null si non parsable. Sert à choisir la « meilleure » position d'un
 * véhicule dupliqué (retard absolu le plus faible).
 */
export function durationToSeconds(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = /^(-)?P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/.exec(iso);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const d = parseFloat(m[2] || 0);
  const h = parseFloat(m[3] || 0);
  const min = parseFloat(m[4] || 0);
  const s = parseFloat(m[5] || 0);
  return sign * (d * 86400 + h * 3600 + min * 60 + s);
}

/** Normalise un horodatage en ISO-8601 (ou null). */
export function toIso(t) {
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Mappe une VehicleActivity SIRI vers notre VehiclePosition (mêmes champs que le Java). */
export function mapVehicle(activity) {
  const j = activity?.MonitoredVehicleJourney;
  if (!j) return null;
  return {
    vehicleId: j.VehicleRef?.value ?? null,
    lineId: j.LineRef?.value ?? null,
    direction: j.DirectionRef?.value ?? null,
    latitude: j.VehicleLocation?.Latitude ?? 0,
    longitude: j.VehicleLocation?.Longitude ?? 0,
    delay: j.Delay ?? null,
    recordedAtTime: toIso(activity.RecordedAtTime),
    validUntilTime: toIso(activity.ValidUntilTime),
    destinationName: j.DestinationRef?.value ?? null,
    dataSource: j.DataSource ?? null,
    bearing: j.Bearing ?? null,
    vehicleStatus: j.VehicleStatus ?? null,
  };
}

/**
 * Dédoublonne par vehicleId. Pour un même véhicule apparaissant plusieurs fois,
 * garde le candidat prioritaire : (1) qui a un retard non-null, puis (2) dont le
 * retard absolu est le plus faible (temps réel vs horaire théorique fantôme).
 * Reproduit la logique de GrandLyonService.fetchDataFromApi.
 */
export function dedupeVehicles(positions) {
  const groups = new Map();
  for (const p of positions) {
    if (!p || p.vehicleId == null) continue;
    let g = groups.get(p.vehicleId);
    if (!g) groups.set(p.vehicleId, (g = []));
    g.push(p);
  }
  const out = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      out.push(g[0]);
      continue;
    }
    const best = g
      .slice()
      .sort((a, b) => {
        const ha = a.delay != null ? 0 : 1;
        const hb = b.delay != null ? 0 : 1;
        if (ha !== hb) return ha - hb;
        const sa = a.delay != null ? Math.abs(durationToSeconds(a.delay) ?? Infinity) : Infinity;
        const sb = b.delay != null ? Math.abs(durationToSeconds(b.delay) ?? Infinity) : Infinity;
        return sa - sb;
      })[0];
    out.push(best);
  }
  return out;
}

/** Transforme la réponse SIRI brute en VehicleData. `status` explicite les cas vides. */
export function buildVehicleData(siriRoot) {
  const sd = siriRoot?.Siri?.ServiceDelivery;
  const deliveries = sd?.VehicleMonitoringDelivery;
  const now = new Date().toISOString();
  if (!deliveries) {
    return { vehicles: [], apiResponseTimestamp: null, lastFetchTime: now, apiStatus: "EMPTY_RESPONSE" };
  }
  const activities = deliveries.flatMap((d) => d?.VehicleActivity ?? []);
  const vehicles = dedupeVehicles(activities.map(mapVehicle));
  return {
    vehicles,
    apiResponseTimestamp: toIso(sd.ResponseTimestamp),
    lastFetchTime: now,
    apiStatus: "OK",
  };
}

/** Filtre + trie les passages pour un arrêt donné (comportement de GrandLyonService.getPassages). */
export function selectPassages(values, stopId) {
  if (!Array.isArray(values)) return [];
  if (!stopId) return values;
  return values
    .filter((p) => String(p.id) === String(stopId))
    .sort((a, b) => String(a.heurepassage ?? "").localeCompare(String(b.heurepassage ?? "")));
}

// --- Handlers ---------------------------------------------------------------

async function handleVehicles(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/vehicles", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let body;
  let cacheable = false;
  try {
    const res = await fetch(UPSTREAM.vehicles, {
      headers: { Authorization: authHeader(env), Accept: "application/json" },
    });
    if (!res.ok) {
      body = { vehicles: [], apiResponseTimestamp: null, lastFetchTime: new Date().toISOString(), apiStatus: "API_DOWN" };
    } else {
      body = buildVehicleData(await res.json());
      cacheable = body.apiStatus === "OK";
    }
  } catch (e) {
    body = { vehicles: [], apiResponseTimestamp: null, lastFetchTime: new Date().toISOString(), apiStatus: "API_DOWN" };
  }

  const resp = json(body, { maxAge: cacheable ? TTL.vehicles : 0 });
  if (cacheable) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

async function handlePassages(request, env, ctx) {
  const stopId = new URL(request.url).searchParams.get("stopId");
  const cache = caches.default;
  // Clé fixe : on met en cache la liste COMPLÈTE (une seule requête amont),
  // puis on filtre en mémoire par stopId — comme le cachedPassages du Java.
  const cacheKey = new Request(new URL("/__cache/passages-all", request.url).toString());

  let values;
  const hit = await cache.match(cacheKey);
  if (hit) {
    values = await hit.json();
  } else {
    try {
      const res = await fetch(UPSTREAM.passages, {
        headers: { Authorization: authHeader(env), Accept: "application/json" },
      });
      const data = res.ok ? await res.json() : null;
      values = Array.isArray(data?.values) ? data.values : [];
      if (res.ok) ctx.waitUntil(cache.put(cacheKey, json(values, { maxAge: TTL.passages }).clone()));
    } catch (e) {
      values = [];
    }
  }

  return json(selectPassages(values, stopId), { maxAge: TTL.passages });
}

async function handleLines(request, env, ctx, type) {
  const upstreamUrl = UPSTREAM.lines[type];
  if (!upstreamUrl) return json({ geojson: EMPTY_FC, status: "NOT_FOUND" });

  const cache = caches.default;
  const cacheKey = new Request(new URL(`/api/lines/${type}`, request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const res = await fetch(upstreamUrl); // données publiques, pas d'auth
    if (!res.ok) return json({ geojson: EMPTY_FC, status: "API_DOWN" });
    // Le GeoJSON est renvoyé comme CHAÎNE (le frontend fait JSON.parse(geojson)).
    const text = await res.text();
    const resp = json({ geojson: text, status: "OK" }, { maxAge: TTL.lines });
    ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e) {
    return json({ geojson: EMPTY_FC, status: `ERROR: ${e.message}` });
  }
}

// --- Routeur ----------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, { status: 405 });

    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

    if (path === "/healthz") {
      return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS } });
    }
    if (path === "/api/vehicles") return handleVehicles(request, env, ctx);
    if (path === "/api/vehicles/passages") return handlePassages(request, env, ctx);

    const lm = /^\/api\/lines\/([^/]+)$/.exec(path);
    if (lm) return handleLines(request, env, ctx, decodeURIComponent(lm[1]));

    return json({ error: "Not found", path }, { status: 404 });
  },
};
