'use client';

import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';

// Sub-component to access the map instance
function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15, { animate: true });
    }
  }, [center, map]);
  return null;
}

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

interface Passage {
  id: string;
  ligne: string;
  direction: string;
  delaipassage: string;
  type: string;
  heurepassage: string;
  idtarretdestination: number;
  coursetheorique: string;
  gid: number;
  last_update_fme: string;
}

interface StopInfo {
  id: number;
  name: string;
  latlng: [number, number];
}

interface VehicleData {
  vehicles: VehiclePosition[];
  apiResponseTimestamp: string;
  lastFetchTime: string;
  apiStatus?: string;
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

const getStopColor = (desserte: string | undefined): string => {
  if (!desserte) return '#4a5568'; // Default dark grey

  const lines = desserte.split(',').map(s => s.split(':')[0]);

  // Priority: Metro -> Funi -> Tram -> Rhonexpress -> C-Lines -> Bus
  // Metro
  if (lines.some(l => l === 'A')) return '#e63375'; // Pink
  if (lines.some(l => l === 'B')) return '#5688bf'; // Blue
  if (lines.some(l => l === 'C')) return '#f0ac00'; // Orange
  if (lines.some(l => l === 'D')) return '#24a858'; // Green

  // Funicular
  if (lines.some(l => l.startsWith('F'))) return '#5e6e30';

  // Tram (T1, T2...)
  if (lines.some(l => /^T\d+/.test(l))) return '#864098';

  // Trambus
  if (lines.some(l => /^TB\d+/.test(l))) return '#fdc210';

  // Rhonexpress
  if (lines.includes('RX')) return '#c9151d';

  // C-Lines (Bus Chrono)
  if (lines.some(l => /^C\d+/.test(l))) return '#697a84';

  // Standard Bus
  if (lines.some(l => /^\d+/.test(l))) return '#ea2e2e';

  return '#4a5568';
};

export default function Map() {
  const [data, setData] = useState<VehicleData | null>(null);
  const [transportLines, setTransportLines] = useState<Record<string, any>>({});
  const [lineLoading, setLineLoading] = useState<Record<string, boolean>>({});
  const [lineStatus, setLineStatus] = useState<Record<string, string>>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [requestedCenter, setRequestedCenter] = useState<[number, number] | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    metro: true,
    tram: true,
    rhonexpress: true,
    bus: false,
    stops: true
  });
  const [selectedStop, setSelectedStop] = useState<StopInfo | null>(null);
  const [stopPassages, setStopPassages] = useState<Passage[] | null>(null);
  const [passagesLoading, setPassagesLoading] = useState(false);
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

  const fetchPassages = async (stopId: number) => {
    setPassagesLoading(true);
    setStopPassages(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      // We filter by 'gid' which seems to match stop ID in some contexts, or we pass it as stopId param
      const response = await fetch(`${apiUrl}/api/vehicles/passages?stopId=${stopId}`);
      if (response.ok) {
        const data = await response.json();
        setStopPassages(data);
      }
    } catch (err) {
      console.error("Error fetching passages:", err);
    } finally {
      setPassagesLoading(false);
    }
  };

  useEffect(() => {
    // Detect mobile on mount
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }

    fetchData(); // Initial fetch
    // Pre-fetch only the small ones or defaults
    fetchTransportLines('metro');
    fetchTransportLines('tram');
    fetchTransportLines('rhonexpress');
    fetchTransportLines('stops');

    // User Geolocation
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (err) => {
          console.warn("Geolocation error:", err);
        },
        { enableHighAccuracy: true }
      );
    }

    // Actual Data Refresh
    const refreshInterval = setInterval(fetchData, REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const vehicles = data?.vehicles || [];

  const centerOnUser = () => {
    if (userLocation) {
      setRequestedCenter([...userLocation]);
      // Reset after a short delay to allow re-triggering
      setTimeout(() => setRequestedCenter(null), 100);
    }
  };

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
      weight: 3, // slightly thinner for bus congestion
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{
              margin: 0,
              fontSize: isCollapsed ? '14px' : '18px',
              fontWeight: '800',
              color: '#1a202c',
              whiteSpace: 'nowrap'
            }}>
              {isCollapsed ? '📊 Stats' : 'Lyon Live Traffic'}
            </h1>
            {userLocation && !isCollapsed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  centerOnUser();
                }}
                style={{
                  background: '#ebf8ff',
                  border: '1px solid #90cdf4',
                  borderRadius: '12px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#2b6cb0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                📍 Me
              </button>
            )}
          </div>
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

            {/* API Status Warning */}
            {data?.apiStatus && data.apiStatus !== 'OK' && (
              <div style={{
                background: '#fff5f5',
                border: '1px solid #feb2b2',
                color: '#c53030',
                padding: '10px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <div>
                  <strong>Grand Lyon API Issue:</strong><br />
                  {data.apiStatus === 'API_DOWN' ? 'Upstream server unreachable' : data.apiStatus}
                </div>
              </div>
            )}

            {/* Layer Toggles */}
            <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Display Layers</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.keys(visibleLayers).map(type => {
                  const hasError = lineStatus[type] && lineStatus[type] !== 'OK';
                  const label = lineLoading[type]
                    ? '⌛ Loading...'
                    : (hasError ? `⚠️ ${type} Error` : (type.charAt(0).toUpperCase() + type.slice(1)));

                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (!visibleLayers[type] && !transportLines[type]) {
                          fetchTransportLines(type);
                        }
                        setVisibleLayers(prev => ({ ...prev, [type]: !prev[type] }));
                      }}
                      disabled={lineLoading[type]}
                      title={hasError ? `Error: ${lineStatus[type]}` : undefined}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: lineLoading[type] ? 'wait' : 'pointer',
                        background: hasError ? '#fff5f5' : (visibleLayers[type] ? '#4299e1' : '#edf2f7'),
                        color: hasError ? '#c53030' : (visibleLayers[type] ? 'white' : '#4a5568'),
                        border: hasError ? '1px solid #feb2b2' : 'none',
                        transition: 'all 0.2s ease',
                        opacity: lineLoading[type] ? 0.7 : 1
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
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
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(66, 153, 225, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(66, 153, 225, 0); }
        }
        .user-pulse-icon {
            background: #4299e1;
            border: 2px solid white;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
      `}</style>

      <MapContainer center={[45.7578137, 4.8320114]} zoom={13} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController center={requestedCenter} />

        {/* User Location Marker */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={L.divIcon({
              className: 'user-pulse-icon',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup>
              <div style={{ padding: '4px', textAlign: 'center' }}>
                <strong>You are here</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Transport Lines Layers */}
        {Object.entries(transportLines).map(([type, geojson]) => (
          visibleLayers[type] && (
            <GeoJSON
              key={type}
              data={geojson}
              style={type === 'stops' ? (feature) => ({
                fillColor: '#ffffff',
                fillOpacity: 0.9,
                color: getStopColor(feature?.properties?.desserte),
                weight: 2,
                radius: 5
              }) : lineStyle}
              onEachFeature={(feature, layer) => {
                if (type === 'stops') {
                  layer.on('click', (e: any) => {
                    const latlng = e.latlng;
                    const props = feature.properties;
                    const stopId = props.id; // User confirmed linkage by ID
                    setSelectedStop({
                      id: stopId,
                      name: props.nom || 'Unknown Stop',
                      latlng: [latlng.lat, latlng.lng]
                    });
                    fetchPassages(stopId);
                  });
                } else if (feature.properties && feature.properties.ligne) {
                  layer.bindPopup(`${type.toUpperCase()} Line ${feature.properties.ligne}: ${feature.properties.nom_trace || ''}`);
                }
              }}
              pointToLayer={(feature, latlng) => {
                if (type === 'stops') {
                  return L.circleMarker(latlng);
                }
                return L.marker(latlng);
              }}
            />
          )
        ))}

        {selectedStop && (
          <Popup
            position={selectedStop.latlng}
            eventHandlers={{ remove: () => setSelectedStop(null) }}
          >
            <div style={{ minWidth: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                🚏 {selectedStop.name}
              </h3>
              {passagesLoading ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>Loading real-time info...</div>
              ) : (
                stopPassages && stopPassages.length > 0 ? (
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {stopPassages.map((p, idx) => (
                      <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #f7fafc', paddingBottom: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold' }}>{p.ligne}</span>
                          <span style={{
                            color: p.delaipassage === '0 min' ? '#e53e3e' : '#2b6cb0',
                            fontWeight: 'bold'
                          }}>
                            {p.delaipassage}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#718096' }}>
                          To: {p.direction}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#a0aec0', fontSize: '13px' }}>No upcoming passages found.</div>
                )
              )}
            </div>
          </Popup>
        )}

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
