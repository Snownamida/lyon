import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from "../lib/config";
import { VehicleData } from '../types';

// Rafraîchissement toutes les 10 s (au lieu de 3 s). Couplé à la mise en pause
// quand l'onglet est masqué, cela réduit fortement le nombre de requêtes
// envoyées au Worker (quota gratuit Cloudflare = 100 000 requêtes/jour, et le
// Worker s'exécute avant le cache : seul le frontend peut faire baisser ce compte).
const REFRESH_INTERVAL = 10000;

export function useVehicleData() {
  const [data, setData] = useState<VehicleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWakingUp, setIsWakingUp] = useState(false);
  // Ref (et non la state `data`) pour éviter le piège de closure dans l'intervalle.
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    let wakeTimer: NodeJS.Timeout | null = null;
    if (!hasDataRef.current) {
      wakeTimer = setTimeout(() => setIsWakingUp(true), 3000);
    }

    try {
      const response = await fetch(API_URL + '/api/vehicles');
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const jsonData = await response.json();
      setData(jsonData);
      hasDataRef.current = true;
      setError(null);
      setIsWakingUp(false);
    } catch (err: any) {
      console.error("Error fetching vehicles:", err);
      setError(err.message || 'Connection failed');
    } finally {
      if (wakeTimer) clearTimeout(wakeTimer);
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const start = () => {
      if (timer) return;
      fetchData(); // une requête immédiate à la reprise
      timer = setInterval(fetchData, REFRESH_INTERVAL);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    // Onglet masqué → on suspend le polling ; visible → on reprend et on rafraîchit.
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  return { data, error, isWakingUp, reload: fetchData };
}
