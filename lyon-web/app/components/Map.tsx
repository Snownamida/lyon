'use client';

import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useVehicleData } from '../hooks/useVehicleData';
import { useTransportLines } from '../hooks/useTransportLines';
import Dashboard from './Dashboard';
import MapLayers from './MapLayers';
import { StopInfo, Passage } from '../types';

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

const extractLineCode = (lineId: string): string => {
  const match = lineId.match(/ActIV:Line::(.*?):SYTRAL/);
  return match ? match[1] : '?';
};

const getVehicleConfig = (lineCode: string) => {
  if (/^T\d+$/.test(lineCode)) return { type: 'Tramway', bgColor: '#864098' };
  if (/^C\d+$/.test(lineCode)) return { type: 'Bus Chrono', bgColor: '#697a84', borderRadius: '8px' };
  if (/^TB\d+$/.test(lineCode)) return { type: 'Trambus', bgColor: '#fdc210' };
  if (lineCode === 'RX') return { type: 'Rhônexpress', bgColor: '#c9151d', borderRadius: '4px' };
  if (/^\d+$/.test(lineCode)) return { type: 'Bus Standard', bgColor: '#ea2e2e' };
  return { type: 'Other', bgColor: '#808080' };
};

export default function Map() {
  // Custom Hooks
  const { data, error, isWakingUp, reload } = useVehicleData();
  const { transportLines, lineLoading, lineStatus, fetchTransportLines } = useTransportLines();

  // Local State
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [requestedCenter, setRequestedCenter] = useState<[number, number] | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    metro: true,
    tram: true,
    rhonexpress: true,
    bus: false,
    stops: true
  });

  // Stops & Passages State
  const [selectedStop, setSelectedStop] = useState<StopInfo | null>(null);
  const [stopPassages, setStopPassages] = useState<Passage[] | null>(null);
  const [passagesLoading, setPassagesLoading] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Stop Passage Fetching Logic (kept here for now)
  const fetchPassages = async (stopId: number) => {
    setPassagesLoading(true);
    setStopPassages(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
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
    // Detect mobile
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }

    // Prefetch defaults
    fetchTransportLines('metro');
    fetchTransportLines('tram');
    fetchTransportLines('rhonexpress');
    fetchTransportLines('stops');

    // GeoLocation
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (err) => console.warn("Geolocation error:", err),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vehicles = data?.vehicles || [];

  // Stats Calculation
  const stats = vehicles.reduce((acc, v) => {
    const lineCode = extractLineCode(v.lineId);
    const { type } = getVehicleConfig(lineCode);

    acc.counts[type] = (acc.counts[type] || 0) + 1;
    acc.total++;

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

  const centerOnUser = () => {
    if (userLocation) {
      setRequestedCenter([...userLocation]);
      setTimeout(() => setRequestedCenter(null), 100);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>

      <Dashboard
        data={data}
        error={error}
        isWakingUp={isWakingUp}
        onRetry={reload}
        stats={stats}
        visibleLayers={visibleLayers}
        onToggleLayer={(type) => {
          if (!visibleLayers[type] && !transportLines[type]) {
            fetchTransportLines(type);
          }
          setVisibleLayers(prev => ({ ...prev, [type]: !prev[type] }));
        }}
        lineLoading={lineLoading}
        lineStatus={lineStatus}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        userLocation={userLocation}
        onCenterUser={centerOnUser}
      />

      <MapContainer center={[45.7578137, 4.8320114]} zoom={13} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController center={requestedCenter} />

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

        <MapLayers
          transportLines={transportLines}
          visibleLayers={visibleLayers}
          vehicles={vehicles}
          selectedStop={selectedStop}
          setSelectedStop={setSelectedStop}
          fetchPassages={fetchPassages}
          stopPassages={stopPassages}
          passagesLoading={passagesLoading}
        />

        <style jsx global>{`
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
      </MapContainer>
    </div>
  );
}
