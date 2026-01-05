import { VehicleData } from '../types';

interface DashboardProps {
    data: VehicleData | null;
    error: string | null;
    isWakingUp: boolean;
    onRetry: () => void;

    stats: {
        counts: Record<string, number>;
        total: number;
        onTime: number;
        late: number;
        early: number;
    };

    visibleLayers: Record<string, boolean>;
    onToggleLayer: (type: string) => void;
    lineLoading: Record<string, boolean>;
    lineStatus: Record<string, string>;

    isCollapsed: boolean;
    setIsCollapsed: (v: boolean) => void;

    userLocation: [number, number] | null;
    onCenterUser: () => void;
}

export default function Dashboard({
    data,
    error,
    isWakingUp,
    onRetry,
    stats,
    visibleLayers,
    onToggleLayer,
    lineLoading,
    lineStatus,
    isCollapsed,
    setIsCollapsed,
    userLocation,
    onCenterUser
}: DashboardProps) {
    return (
        <>
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
                        <button onClick={onRetry} style={{ marginTop: '20px', padding: '8px 24px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
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
                                    onCenterUser();
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
                                            onClick={() => onToggleLayer(type)}
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
      `}</style>
        </>
    );
}
