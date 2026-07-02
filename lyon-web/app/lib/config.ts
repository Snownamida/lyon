/**
 * Base de l'API lyon-server.
 * Par défaut : le backend de production (Render). Surchargable en dev local
 * via NEXT_PUBLIC_API_URL (ex. .env.local → http://localhost:8080).
 * NB : variable intégrée AU BUILD (export statique) — la définir sur la
 * plateforme d'hébergement n'a d'effet qu'au moment du build.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://lyon-server.onrender.com";
