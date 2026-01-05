import { useState, useEffect } from 'react';
import { VehicleData } from '../types';

const REFRESH_INTERVAL = 3000;

export function useVehicleData() {
  const [data, setData] = useState<VehicleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWakingUp, setIsWakingUp] = useState(false);

  const fetchData = async () => {
    // If it's the very first fetch, start a wake-up timer
    let wakeTimer: NodeJS.Timeout | null = null;
    if (!data) {
      wakeTimer = setTimeout(() => setIsWakingUp(true), 3000);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(apiUrl + '/api/vehicles');
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const jsonData = await response.json();
      setData(jsonData);
      setError(null);
      setIsWakingUp(false);
    } catch (err: any) {
      console.error("Error fetching vehicles:", err);
      setError(err.message || 'Connection failed');
    } finally {
      if (wakeTimer) clearTimeout(wakeTimer);
    }
  };

  useEffect(() => {
    fetchData(); // Initial fetch
    const refreshInterval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(refreshInterval);
  }, []);

  return { data, error, isWakingUp, reload: fetchData };
}
