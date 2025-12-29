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

export default function Map() {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const response = await fetch(apiUrl + '/api/vehicles');
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

        // Clean up destination
        // "ActIV:StopArea:SP:48376:SYTRAL" -> "SP:48376" or keep as is if needed, let's keep it raw but maybe split if too long
        // Actually, backend sends "destinationName" which is the raw value from DestinationRef.
        // Let's try to make it readable if it's a known format, otherwise raw.
        // Format seems to be ActIV:StopArea:SP:XXXX:SYTRAL. We can probably just show "SP:XXXX" for debug or the whole thing.
        // User asked to "show them", so let's show the raw values or slightly cleaned.
        const dstMatch = v.destinationName ? v.destinationName.match(/ActIV:StopArea:(.*?):SYTRAL/) : null;
        const prettyDest = dstMatch ? dstMatch[1] : (v.destinationName || 'N/A');

        // Determine type and style
        let bgColor = '#808080'; // Default gray for unknown
        let type = 'UNKNOWN';
        let shape = 'border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';

        if (/^T\d+$/.test(lineCode)) {
          type = 'Tramway';
          bgColor = '#864098'; // Purple for Tram
        } else if (/^C\d+$/.test(lineCode)) {
          type = 'Bus chrono';
          bgColor = '#697a84'; // Yellow/Gold for Chrono
          // Chrono often square-ish or distinct
          shape += 'border-radius: 8px;';
        } else if (/^\d+$/.test(lineCode)) {
          type = 'Bus standard';
          bgColor = '#ea2e2e'; // Red for Bus
        } else if (/^TB\d+$/.test(lineCode)) {
          type = 'Trambus';
          bgColor = '#fdc210'; // Teal for Trambus
        } else if (lineCode === 'RX') {
          type = 'Rhônexpress';
          bgColor = '#c9151d'; // Orange for Rhônexpress
          shape += 'border-radius: 4px;'; // Distinct shape for airport shuttle
        } else {
          // Keep default gray for unknown
        }

        // Add bearing rotation arrow indicator next to text or wrapper
        // Since we are using a divIcon with text, rotating the text might be hard to read.
        // Let's add a small arrow on the border or a separate element.
        // Alternatively, just rotate the whole marker if it's a vehicle shape.
        // For now, let's keep the marker upright (so text is readable) but maybe add a small arrow.
        // OR simply display bearing in popup as requested. The user said "use suitable way to display".
        // Let's create a wrapper that rotates? No, text must be horizontal.
        // Let's just create the icon as before.

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

                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-bold text-lg">{type}: {lineCode}</div>
                    <div className="text-xs text-gray-500">{v.vehicleId}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono bg-gray-100 px-1 py-0.5 rounded">{v.vehicleStatus || 'N/A'}</span>
                  </div>
                </div>

                {/* Main Info */}
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
                        if (!d) return 'N/A'; // Handle missing delay
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
                </div>

                {/* Technical Details */}
                <div className="text-xs text-gray-400 border-t pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Source:</span> <span>{v.dataSource || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recorded:</span> <span>{v.recordedAtTime ? new Date(v.recordedAtTime).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valid Until:</span> <span>{v.validUntilTime ? new Date(v.validUntilTime).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
