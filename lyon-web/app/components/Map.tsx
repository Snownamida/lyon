'use client';

import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
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

interface VehicleConfig {
  type: string;
  bgColor: string;
  borderRadius?: string;
}

const extractLineCode = (lineId: string): string => {
  const match = lineId.match(/ActIV:Line::(.*?):SYTRAL/);
  return match ? match[1] : '?';
};

const getVehicleConfig = (lineCode: string): VehicleConfig => {
  if (/^T\d+$/.test(lineCode)) return { type: 'Tramway', bgColor: '#864098' };
  if (/^C\d+$/.test(lineCode)) return { type: 'Bus Chrono', bgColor: '#697a84', borderRadius: '8px' };
  if (/^TB\d+$/.test(lineCode)) return { type: 'Trambus', bgColor: '#fdc210' };
  if (lineCode === 'RX') return { type: 'Rhônexpress', bgColor: '#c9151d', borderRadius: '4px' };
  if (/^\d+$/.test(lineCode)) return { type: 'Bus Standard', bgColor: '#ea2e2e' };
  return { type: 'Other', bgColor: '#808080' };
};

export default function Map() {
  const [data, setData] = useState<VehicleData | null>(null);
  const [transportLines, setTransportLines] = useState<Record<string, any>>({});
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    metro: true,
    tram: true,
    bus: false
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchTransportLines = async (type: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/lines/${type}`);
      if (response.ok) {
        const jsonData = await response.json();
        setTransportLines(prev => ({ ...prev, [type]: jsonData }));
      }
    } catch (err) {
      console.error(`Error fetching ${type} lines:`, err);
    }
  };

  useEffect(() => {
    // Detect mobile on mount
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }

    fetchData(); // Initial fetch
    fetchTransportLines('metro');
    fetchTransportLines('tram');
    fetchTransportLines('bus');

    // Actual Data Refresh
    const refreshInterval = setInterval(fetchData, REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  const vehicles = data?.vehicles || [];

  // Statistics Calculation
  const stats = vehicles.reduce((acc, v) => {
    const lineCode = extractLineCode(v.lineId);
    const { type } = getVehicleConfig(lineCode);

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

  const lineStyle = (feature: any) => {
    let color = feature.properties.couleur || '#808080';
    // Grand Lyon API color format is often "R G B" (e.g., "255 0 0")
    if (color && typeof color === 'string' && color.includes(' ')) {
      const parts = color.split(' ');
      if (parts.length === 3) {
        color = `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
      }
    }
    return {
      color: color,
      weight: 4,
      opacity: 0.7
    };
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Initial Loading / Wake up Overlay */}
      {!data && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2000,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #edf2f7',
            borderTopColor: '#4299e1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <h2 style={{ margin: '0 0 8px 0', color: '#2d3748' }}>
            {error ? 'Connection Issue' : (isWakingUp ? 'Waking up Server...' : 'Connecting to Lyon...')}
          </h2>
          <p style={{ margin: 0, color: '#718096', fontSize: '14px', textAlign: 'center', padding: '0 20px' }}>
            {error ? error : (isWakingUp ? 'The free-tier server is spinning up. This usually takes 30-50s.' : 'Fetching real-time traffic data...')}
          </p>
          {error && (
            <button onClick={() => fetchData()} style={{ marginTop: '20px', padding: '8px 24px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Retry Now
            </button>
          )}
        </div>
      )}

      {/* Dashboard Overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(10px)',
        padding: isCollapsed ? '12px 16px' : '20px',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        width: isCollapsed ? 'auto' : '300px',
        maxWidth: 'calc(100vw - 40px)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: isCollapsed ? 'pointer' : 'default',
        userSelect: 'none'
      }} onClick={() => isCollapsed && setIsCollapsed(false)}>

        {/* Header with Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isCollapsed ? '0' : '16px'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: isCollapsed ? '14px' : '18px',
            fontWeight: '800',
            color: '#1a202c',
            whiteSpace: 'nowrap'
          }}>
            {isCollapsed ? '📊 Stats' : 'Lyon Live Traffic'}
          </h1>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            style={{
              background: '#edf2f7',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginLeft: '12px',
              color: '#4a5568',
              transition: 'transform 0.3s ease'
            }}
          >
            <span style={{
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              fontSize: '14px',
              display: 'inline-block'
            }}>▼</span>
          </button>
        </div>

        {!isCollapsed && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ fontSize: '12px', color: '#718096', marginBottom: '16px' }}>
              Server Time: {data?.apiResponseTimestamp ? new Date(data.apiResponseTimestamp).toLocaleTimeString() : '---'}
            </div>

            {/* Layer Toggles */}
            <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Display Layers</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.keys(visibleLayers).map(type => (
                  <button
                    key={type}
                    onClick={() => setVisibleLayers(prev => ({ ...prev, [type]: !prev[type] }))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: visibleLayers[type] ? '#4299e1' : '#edf2f7',
                      color: visibleLayers[type] ? 'white' : '#4a5568',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#ebf8ff', padding: '12px', borderRadius: '14px', textAlign: 'center', border: '1px solid #bee3f8' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#2b6cb0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#2c5282' }}>{stats.total}</div>
              </div>
              <div style={{ background: '#fffaf0', padding: '12px', borderRadius: '14px', textAlign: 'center', border: '1px solid #feebc8' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#b7791f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On Time</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#744210' }}>{stats.onTime}</div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              {Object.entries(stats.counts).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #edf2f7' }}>
                  <span style={{ color: '#4a5568' }}>{type}</span>
                  <span style={{ fontWeight: 'bold', color: '#1a202c' }}>{count}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px', background: '#f7fafc', borderRadius: '12px', fontSize: '12px', color: '#4a5568', fontStyle: 'italic', border: '1px solid #edf2f7' }}>
              💡 {stats.late > stats.early ? `Currently ${stats.late} vehicles are late.` : `Efficiency is high: ${stats.early} vehicles are ahead of schedule.`}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
      `}</style>

      <MapContainer center={[45.7578137, 4.8320114]} zoom={13} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Transport Lines Layers */}
        {Object.entries(transportLines).map(([type, geojson]) => (
          visibleLayers[type] && (
            <GeoJSON
              key={type}
              data={geojson}
              style={lineStyle}
              onEachFeature={(feature, layer) => {
                if (feature.properties && feature.properties.ligne) {
                  layer.bindPopup(`${type.toUpperCase()} Line ${feature.properties.ligne}: ${feature.properties.nom_trace || ''}`);
                }
              }}
            />
          )
        ))}

        {vehicles.map((v) => {
          const lineCode = extractLineCode(v.lineId);
          const { type, bgColor, borderRadius } = getVehicleConfig(lineCode);

          const dstMatch = v.destinationName ? v.destinationName.match(/ActIV:StopArea:(.*?):SYTRAL/) : null;
          const prettyDest = dstMatch ? dstMatch[1] : (v.destinationName || 'N/A');

          const shape = `border-radius: ${borderRadius || '50%'}; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);`;

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
