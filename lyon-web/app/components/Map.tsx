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
  // new fields
  recordedAtTime: string;
  validUntilTime: string;
  destinationName: string;
  dataSource: string;
  bearing: number;
  vehicleStatus: string;
}

interface VehicleData {
  vehicles: VehiclePosition[];
  apiResponseTimestamp: string;
  lastFetchTime: string;
}

const REFRESH_INTERVAL = 3000; // 3 seconds

export default function Map() {
  const [data, setData] = useState<VehicleData | null>(null);

  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(apiUrl + '/api/vehicles');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      setData(jsonData);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  useEffect(() => {
    fetchData(); // Initial fetch

    // Actual Data Refresh
    const refreshInterval = setInterval(fetchData, REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  const vehicles = data?.vehicles || [];

  // Statistics Calculation
  const stats = vehicles.reduce((acc, v) => {
    const lineCodeRegex = /ActIV:Line::(.*?):SYTRAL/;
    const match = v.lineId.match(lineCodeRegex);
    const lineCode = match ? match[1] : '?';

    let type = 'Standard Bus';
    if (/^T\d+$/.test(lineCode)) type = 'Tramway';
    else if (/^C\d+$/.test(lineCode)) type = 'Bus Chrono';
    else if (/^TB\d+$/.test(lineCode)) type = 'Trambus';
    else if (lineCode === 'RX') type = 'Rhônexpress';

    acc.counts[type] = (acc.counts[type] || 0) + 1;
    acc.total++;

    // "Interesting" Fun Stat: Delay counts
    if (v.delay && v.delay !== 'PT0S') {
      if (v.delay.startsWith('-')) acc.early++;
      else acc.late++;
    } else {
      acc.onTime++;
    }

    return acc;
  }, {
    counts: {} as Record<string, number>,
    total: 0,
    onTime: 0,
    late: 0,
    early: 0
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* Dashboard Overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '20px',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        width: '280px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#333' }}>Lyon Live Traffic</h1>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
          Server Time: {data?.apiResponseTimestamp ? new Date(data.apiResponseTimestamp).toLocaleTimeString() : '---'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <div style={{ background: '#f0f4f8', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#718096', textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2d3748' }}>{stats.total}</div>
          </div>
          <div style={{ background: '#fffaf0', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#b7791f', textTransform: 'uppercase' }}>On Time</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#744210' }}>{stats.onTime}</div>
          </div>
        </div>

        <div>
          {Object.entries(stats.counts).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #edf2f7' }}>
              <span style={{ color: '#4a5568' }}>{type}</span>
              <span style={{ fontWeight: 'bold', color: '#2d3748' }}>{count}</span>
            </div>
          ))}
        </div>

        {/* Interesting Insight */}
        <div style={{ marginTop: '16px', padding: '10px', background: '#f7fafc', borderRadius: '10px', fontSize: '12px', color: '#4a5568', fontStyle: 'italic' }}>
          💡 {stats.late > stats.early ? `Currently ${stats.late} vehicles are late.` : `A good day! ${stats.early} vehicles are ahead of schedule.`}
        </div>
      </div>

      <MapContainer center={[45.7578137, 4.8320114]} zoom={13} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {vehicles.map((v) => {
          const lineCodeRegex = /ActIV:Line::(.*?):SYTRAL/;
          const match = v.lineId.match(lineCodeRegex);
          const lineCode = match ? match[1] : '?';

          const dstMatch = v.destinationName ? v.destinationName.match(/ActIV:StopArea:(.*?):SYTRAL/) : null;
          const prettyDest = dstMatch ? dstMatch[1] : (v.destinationName || 'N/A');

          let bgColor = '#808080';
          let type = 'UNKNOWN';
          let shape = 'border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';

          if (/^T\d+$/.test(lineCode)) {
            type = 'Tramway';
            bgColor = '#864098';
          } else if (/^C\d+$/.test(lineCode)) {
            type = 'Bus chrono';
            bgColor = '#697a84';
            shape += 'border-radius: 8px;';
          } else if (/^\d+$/.test(lineCode)) {
            type = 'Bus standard';
            bgColor = '#ea2e2e';
          } else if (/^TB\d+$/.test(lineCode)) {
            type = 'Trambus';
            bgColor = '#fdc210';
          } else if (lineCode === 'RX') {
            type = 'Rhônexpress';
            bgColor = '#c9151d';
            shape += 'border-radius: 4px;';
          }

          const icon = L.divIcon({
            className: 'custom-vehicle-icon',
            html: `
              <div style="position: relative; width: 30px; height: 30px;">
                <!-- Circle with Line Code (Always upright) -->
                <div style="background-color: ${bgColor}; ${shape} position: absolute; top: 0; left: 0; z-index: 2;">
                  ${lineCode}
                </div>
                <!-- Directional Arrow (Rotates) -->
                <div style="
                  position: absolute; 
                  top: 0; 
                  left: 0; 
                  width: 30px; 
                  height: 30px; 
                  transform: rotate(${v.bearing || 0}deg); 
                  z-index: 1;
                  display: ${v.bearing !== undefined ? 'block' : 'none'};
                ">
                  <div style="
                    position: absolute; 
                    top: -8px; 
                    left: 50%; 
                    margin-left: -6px; 
                    width: 0; 
                    height: 0; 
                    border-left: 6px solid transparent; 
                    border-right: 6px solid transparent; 
                    border-bottom: 10px solid ${bgColor};
                    filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
                  "></div>
                </div>
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
          });

          return (
            <Marker key={v.vehicleId} position={[v.latitude, v.longitude]} icon={icon}>
              <Popup maxWidth={300}>
                <div className="p-2 space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <div className="font-bold text-lg">{type}: {lineCode}</div>
                      <div className="text-xs text-gray-500">{v.vehicleId}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono bg-gray-100 px-1 py-0.5 rounded">{v.vehicleStatus || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-400">Direction</span>
                      <span>{v.direction || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 flex flex-col">
                      <span className="text-xs font-semibold text-gray-400">Destination</span>
                      <span className="truncate">{prettyDest}</span>
                    </div>
                    <div className="col-span-2 flex flex-col">
                      <span className="text-xs font-semibold text-gray-400">Delay</span>
                      <span className={`${v.delay && v.delay.startsWith('-') ? 'text-green-600' : 'text-red-600'}`}>
                        {(() => {
                          const d = v.delay;
                          if (!d) return 'N/A';
                          const isEarly = d.startsWith('-');
                          const raw = isEarly ? d.substring(1) : d;
                          let minutes = 0; let seconds = 0;
                          const mMatch = raw.match(/(\d+)M/);
                          if (mMatch) minutes = parseInt(mMatch[1], 10);
                          const sMatch = raw.match(/(\d+)S/);
                          if (sMatch) seconds = parseInt(sMatch[1], 10);
                          if (minutes === 0 && seconds === 0) return 'On Time';
                          const parts = [];
                          if (minutes > 0) parts.push(`${minutes} min`);
                          if (seconds > 0) parts.push(`${seconds} s`);
                          const text = parts.join(' ');
                          return isEarly ? `Early ${text}` : `Late ${text}`;
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 border-t pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Source:</span> <span>{v.dataSource || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recorded:</span> <span>{v.recordedAtTime ? new Date(v.recordedAtTime).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
