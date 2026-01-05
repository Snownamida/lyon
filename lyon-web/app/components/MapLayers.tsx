import { GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { VehiclePosition, Passage, StopInfo } from '../types';

interface MapLayersProps {
    transportLines: Record<string, any>;
    visibleLayers: Record<string, boolean>;
    vehicles: VehiclePosition[];
    selectedStop: StopInfo | null;
    setSelectedStop: (s: StopInfo | null) => void;
    fetchPassages: (id: number) => void;
    stopPassages: Passage[] | null;
    passagesLoading: boolean;
}

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

const getStopColor = (desserte: string | undefined): string => {
    if (!desserte) return '#4a5568';
    const lines = desserte.split(',').map(s => s.split(':')[0]);
    if (lines.some(l => l === 'A')) return '#e63375';
    if (lines.some(l => l === 'B')) return '#5688bf';
    if (lines.some(l => l === 'C')) return '#f0ac00';
    if (lines.some(l => l === 'D')) return '#24a858';
    if (lines.some(l => l.startsWith('F'))) return '#5e6e30';
    if (lines.some(l => /^T\d+/.test(l))) return '#864098';
    if (lines.some(l => /^TB\d+/.test(l))) return '#fdc210';
    if (lines.includes('RX')) return '#c9151d';
    if (lines.some(l => /^C\d+/.test(l))) return '#697a84';
    if (lines.some(l => /^\d+/.test(l))) return '#ea2e2e';
    return '#4a5568';
};

const lineStyle = (feature: any) => {
    let color = feature.properties.couleur || '#808080';
    if (color && typeof color === 'string' && color.includes(' ')) {
        const parts = color.split(' ');
        if (parts.length === 3) {
            color = `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
        }
    }
    return {
        color: color,
        weight: 3,
        opacity: 0.7
    };
};

export default function MapLayers({
    transportLines,
    visibleLayers,
    vehicles,
    selectedStop,
    setSelectedStop,
    fetchPassages,
    stopPassages,
    passagesLoading
}: MapLayersProps) {
    return (
        <>
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
                                    const stopId = props.id;
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
                  <!-- White Border Arrow -->
                  <div style="
                    position: absolute; 
                    top: -12px; 
                    left: 50%; 
                    margin-left: -9px; 
                    width: 0; 
                    height: 0; 
                    border-left: 9px solid transparent; 
                    border-right: 9px solid transparent; 
                    border-bottom: 14px solid white;
                    z-index: 0;
                  "></div>
                  
                  <!-- Colored Inner Arrow -->
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
                    z-index: 1;
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
        </>
    );
}
