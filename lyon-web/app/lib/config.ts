/**
 * Base de l'API backend.
 * Par défaut : le Worker Cloudflare de production (sans démarrage à froid).
 * Surchargable via NEXT_PUBLIC_API_URL (ex. .env.local → http://localhost:8788
 * pour `wrangler dev`, ou l'ancien lyon-server sur Render).
 * NB : variable intégrée AU BUILD (export statique) — si elle est aussi définie
 * sur la plateforme d'hébergement (Vercel), c'est CETTE valeur-là qui prime.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://lyon-worker.snownamida.workers.dev";
