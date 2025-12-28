'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';

// Fix for default marker icon missing in React-Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface VehiclePosition {
  vehicleId: string;
  lineId: string;
  direction: string;
  latitude: number;
  longitude: number;
  delay: string;
  timestamp: string;
}

export default function Map() {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/vehicles');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setVehicles(data);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      }
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 5000); // Refresh every 5s

    return () => clearInterval(interval);
  }, []);

  return (
    <MapContainer center={[45.7578137, 4.8320114]} zoom={13} style={{ height: '100vh', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {vehicles.map((v) => {
        const lineCodeRegex = /ActIV:Line::(.*?):SYTRAL/;
        const match = v.lineId.match(lineCodeRegex);
        const lineCode = match ? match[1] : '?';

        // Determine type and style
        let bgColor = '#808080'; // Default gray for unknown
        let type = 'UNKNOWN';
        let shape = 'border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';

        if (/^T\d+$/.test(lineCode)) {
          type = 'TRAM';
          bgColor = '#9333ea'; // Purple for Tram
        } else if (/^C\d+$/.test(lineCode)) {
          type = 'CHRONO';
          bgColor = '#eab308'; // Yellow/Gold for Chrono
          // Chrono often square-ish or distinct
          shape += 'border-radius: 8px;';
        } else if (/^\d+$/.test(lineCode)) {
          type = 'BUS';
          bgColor = '#ef4444'; // Red for Bus
        } else if (/^TB\d+$/.test(lineCode)) {
          type = 'TRAMBUS';
          bgColor = '#14b8a6'; // Teal for Trambus
        } else {
          // Keep default gray for unknown
        }

        const icon = L.divIcon({
          className: 'custom-vehicle-icon',
          html: `<div style="background-color: ${bgColor}; ${shape}">${lineCode}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -15]
        });

        return (
          <Marker key={v.vehicleId} position={[v.latitude, v.longitude]} icon={icon}>
            <Popup>
              <div className="p-2">
                <div className="font-bold text-lg mb-1">{type}: {lineCode}</div>
                <div className="text-sm text-gray-600 mb-2">ID: {v.vehicleId}</div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold">Direction:</span>
                  <span>{v.direction}</span>

                  <span className="font-semibold">Delay:</span>
                  <span className={`${v.delay.startsWith('-') ? 'text-green-600' : 'text-red-600'}`}>
                    {(() => {
                      const d = v.delay;
                      const isEarly = d.startsWith('-');
                      const raw = isEarly ? d.substring(1) : d;

                      // Parse PT#M#S
                      let minutes = 0;
                      let seconds = 0;

                      const mMatch = raw.match(/(\d+)M/);
                      if (mMatch) minutes = parseInt(mMatch[1], 10);

                      const sMatch = raw.match(/(\d+)S/);
                      if (sMatch) seconds = parseInt(sMatch[1], 10);

                      if (minutes === 0 && seconds === 0) return 'On Time';

                      const parts = [];
                      if (minutes > 0) parts.push(`${minutes} min`);
                      if (seconds > 0) parts.push(`${seconds} s`);

                      const text = parts.join(' ');
                      return isEarly ? `Early by ${text}` : `Late by ${text}`;
                    })()}
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-400 border-t pt-1">
                  Updated: {new Date(v.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
