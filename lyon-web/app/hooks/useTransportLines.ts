import { useState } from 'react';

interface TransportLineState {
    data: Record<string, any>;
    loading: Record<string, boolean>;
    status: Record<string, string>;
}

export function useTransportLines() {
  const [transportLines, setTransportLines] = useState<Record<string, any>>({});
  const [lineLoading, setLineLoading] = useState<Record<string, boolean>>({});
  const [lineStatus, setLineStatus] = useState<Record<string, string>>({});

  const fetchTransportLines = async (type: string) => {
    if (transportLines[type] || lineLoading[type]) return;

    setLineLoading(prev => ({ ...prev, [type]: true }));
    setLineStatus(prev => ({ ...prev, [type]: 'OK' }));
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/lines/${type}`);
      if (response.ok) {
        const jsonData = await response.json();
        // jsonData is now { geojson: "...", status: "..." }
        if (jsonData.status === 'OK') {
          setTransportLines(prev => ({ ...prev, [type]: JSON.parse(jsonData.geojson) }));
        } else {
          setLineStatus(prev => ({ ...prev, [type]: jsonData.status }));
        }
      } else {
        setLineStatus(prev => ({ ...prev, [type]: 'HTTP_' + response.status }));
      }
    } catch (err) {
      console.error(`Error fetching ${type} lines:`, err);
      setLineStatus(prev => ({ ...prev, [type]: 'FETCH_ERROR' }));
    } finally {
      setLineLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  return { 
      transportLines, 
      lineLoading, 
      lineStatus, 
      fetchTransportLines 
  };
}
