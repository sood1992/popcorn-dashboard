// =============================================================================
// POPCORN GPS COLLAR V6.1 - WEB DASHBOARD (ANTI-CHEAT EDITION)
// =============================================================================
// Deploy to Vercel (free): https://vercel.com
// 
// All V6.0 features retained + Anti-cheat walk verification added
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'POPCORN001';

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const formatTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
    });
};

const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

const getActivityEmoji = (activityClass) => {
    switch (activityClass) {
        case 0: return '😴';
        case 1: return '🧘';
        case 2: return '🚶';
        case 3: return '🏃';
        case 4: return '🎾';
        default: return '❓';
    }
};

const getGradeColor = (grade) => {
    switch (grade) {
        case 'A': return 'text-green-400';
        case 'B': return 'text-blue-400';
        case 'C': return 'text-yellow-400';
        case 'F': return 'text-red-400';
        default: return 'text-gray-400';
    }
};

// V6.1: Anti-cheat verification status colors
const getVerificationColor = (status) => {
    switch (status) {
        case 'excellent': return 'bg-green-600';
        case 'good': return 'bg-blue-600';
        case 'fair': return 'bg-yellow-600';
        case 'poor': return 'bg-red-600';
        case 'vehicle_detected': return 'bg-red-700';
        case 'excess_carrying': return 'bg-orange-600';
        default: return 'bg-gray-600';
    }
};

// =============================================================================
// MAIN APP
// =============================================================================

export default function App() {
    // State
    const [status, setStatus] = useState(null);
    const [locations, setLocations] = useState([]);
    const [sleepHistory, setSleepHistory] = useState([]);
    const [scratchHistory, setScratchHistory] = useState([]);
    const [walkHistory, setWalkHistory] = useState([]);
    const [anomalies, setAnomalies] = useState([]);
    const [walkerStats, setWalkerStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('map');
    const [lastRefresh, setLastRefresh] = useState(null);

    // Fetch all data
    const fetchData = useCallback(async () => {
        try {
            setError(null);
            
            // Fetch device status
            const { data: statusData, error: statusError } = await supabase
                .from('device_status')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .single();
            
            if (statusError && statusError.code !== 'PGRST116') {
                throw statusError;
            }
            setStatus(statusData);

            // Fetch recent locations (24 hours)
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: locData } = await supabase
                .from('locations')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('recorded_at', yesterday)
                .order('recorded_at', { ascending: true });
            setLocations(locData || []);

            // Fetch sleep history (7 days)
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: sleepData } = await supabase
                .from('sleep_sessions')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('started_at', weekAgo)
                .order('started_at', { ascending: false });
            setSleepHistory(sleepData || []);

            // Fetch scratch history (7 days)
            const { data: scratchData } = await supabase
                .from('scratch_daily')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('date', weekAgo.split('T')[0])
                .order('date', { ascending: false });
            setScratchHistory(scratchData || []);

            // Fetch walk history (30 days)
            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data: walkData } = await supabase
                .from('walk_sessions')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('started_at', monthAgo)
                .order('started_at', { ascending: false });
            setWalkHistory(walkData || []);

            // V6.1: Calculate walker stats from walk data
            if (walkData && walkData.length > 0) {
                const stats = {
                    total_walks: walkData.length,
                    avg_quality_score: walkData.reduce((sum, w) => sum + (w.quality_score || w.grade_score || 0), 0) / walkData.length,
                    excellent_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) >= 90).length,
                    good_walks: walkData.filter(w => {
                        const score = w.quality_score || w.grade_score || 0;
                        return score >= 70 && score < 90;
                    }).length,
                    fair_walks: walkData.filter(w => {
                        const score = w.quality_score || w.grade_score || 0;
                        return score >= 50 && score < 70;
                    }).length,
                    poor_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) < 50).length,
                    total_distance_km: (walkData.reduce((sum, w) => sum + (w.distance_meters || 0), 0) / 1000).toFixed(2),
                    avg_carried_percent: walkData.reduce((sum, w) => sum + (w.carried_percent || 0), 0) / walkData.length,
                    vehicle_incidents: walkData.filter(w => w.vehicle_detected).length
                };
                setWalkerStats(stats);
            }

            // Fetch unacknowledged anomalies
            const { data: anomalyData } = await supabase
                .from('anomaly_log')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .eq('acknowledged', false)
                .order('detected_at', { ascending: false });
            setAnomalies(anomalyData || []);

            setLastRefresh(new Date());
            setLoading(false);
            
        } catch (err) {
            console.error('Fetch error:', err);
            setError(err.message);
            setLoading(false);
        }
    }, []);

    // Initial fetch and setup real-time subscription
    useEffect(() => {
        fetchData();

        // Real-time subscription for device status
        const subscription = supabase
            .channel('device_status_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'device_status',
                filter: `device_id=eq.${DEVICE_ID}`
            }, (payload) => {
                console.log('Real-time update:', payload);
                setStatus(payload.new);
                setLastRefresh(new Date());
            })
            .subscribe();

        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [fetchData]);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mx-auto mb-4"></div>
                    <h2 className="text-xl text-white">Loading Popcorn's Data...</h2>
                    <p className="text-gray-400 mt-2">🐕 Woof!</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl text-white mb-2">Connection Error</h2>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button 
                        onClick={fetchData}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <Header status={status} lastRefresh={lastRefresh} onRefresh={fetchData} />
            
            {/* Alert Banner */}
            {anomalies.length > 0 && <AlertBanner anomalies={anomalies} />}
            
            {/* Escape Alert */}
            {status?.is_escaped && <EscapeAlert status={status} />}
            
            {/* Navigation */}
            <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
            
            {/* Content */}
            <main className="container mx-auto px-4 py-6">
                {activeTab === 'map' && (
                    <MapView status={status} locations={locations} />
                )}
                {activeTab === 'activity' && (
                    <ActivityView status={status} locations={locations} />
                )}
                {activeTab === 'sleep' && (
                    <SleepView sleepHistory={sleepHistory} status={status} />
                )}
                {activeTab === 'health' && (
                    <HealthView scratchHistory={scratchHistory} anomalies={anomalies} />
                )}
                {activeTab === 'walks' && (
                    <WalksView walkHistory={walkHistory} walkerStats={walkerStats} />
                )}
            </main>
            
            {/* Footer */}
            <footer className="text-center py-4 text-gray-500 text-xs">
                Popcorn GPS Collar V6.1 Anti-Cheat • Made with ❤️
            </footer>
        </div>
    );
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

function Header({ status, lastRefresh, onRefresh }) {
    const getConnectionStatus = () => {
        if (!status?.last_seen_at) return { text: 'Never connected', color: 'red' };
        
        const lastSeen = new Date(status.last_seen_at);
        const minutes = (Date.now() - lastSeen) / 60000;
        
        if (minutes < 5) return { text: 'Online', color: 'green' };
        if (minutes < 60) return { text: `${Math.floor(minutes)}m ago`, color: 'yellow' };
        return { text: 'Offline', color: 'red' };
    };

    const connection = getConnectionStatus();
    const batteryColor = status?.battery_percent > 50 ? 'green' : 
                         status?.battery_percent > 20 ? 'yellow' : 'red';

    return (
        <header className="bg-gray-800 border-b border-gray-700">
            <div className="container mx-auto px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Logo */}
                    <div className="flex items-center space-x-3">
                        <span className="text-4xl">🐕</span>
                        <div>
                            <h1 className="text-2xl font-bold">Popcorn Tracker</h1>
                            <p className="text-gray-400 text-sm">v6.1 Anti-Cheat</p>
                        </div>
                    </div>

                    {/* Status Pills */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Connection */}
                        <div className="flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded-full">
                            <div className={`w-2 h-2 rounded-full bg-${connection.color}-500 ${connection.color === 'green' ? 'animate-pulse' : ''}`}></div>
                            <span className="text-sm">{connection.text}</span>
                        </div>

                        {/* Battery */}
                        <div className={`flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded-full text-${batteryColor}-400`}>
                            <span>🔋</span>
                            <span className="text-sm">{status?.battery_percent || 0}%</span>
                        </div>

                        {/* Location Status */}
                        {status?.is_escaped ? (
                            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                                ⚠️ ESCAPED
                            </span>
                        ) : status?.is_home ? (
                            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm">
                                🏠 Home
                            </span>
                        ) : (
                            <span className="bg-yellow-600 text-black px-3 py-1 rounded-full text-sm">
                                🚶 Outside
                            </span>
                        )}

                        {/* Refresh */}
                        <button 
                            onClick={onRefresh}
                            className="p-2 hover:bg-gray-700 rounded-full transition"
                            title={`Last refresh: ${lastRefresh?.toLocaleTimeString()}`}
                        >
                            🔄
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

// =============================================================================
// ALERT COMPONENTS
// =============================================================================

function AlertBanner({ anomalies }) {
    return (
        <div className="bg-orange-600 text-white py-2 px-4">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <span className="text-xl">⚠️</span>
                    <span>
                        Health Alert: {anomalies[0]?.anomaly_type?.replace('_', ' ')} detected
                    </span>
                </div>
                <span className="text-sm opacity-75">
                    {formatDate(anomalies[0]?.detected_at)} {formatTime(anomalies[0]?.detected_at)}
                </span>
            </div>
        </div>
    );
}

function EscapeAlert({ status }) {
    return (
        <div className="bg-red-600 text-white py-4 px-4 animate-pulse">
            <div className="container mx-auto text-center">
                <div className="text-3xl mb-2">🚨 ESCAPE ALERT 🚨</div>
                <p className="text-xl">
                    Popcorn is {Math.round(status?.distance_from_home || 0)}m from home!
                </p>
                <a 
                    href={`https://maps.google.com/?q=${status?.latitude},${status?.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 bg-white text-red-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-100"
                >
                    📍 Open in Google Maps
                </a>
            </div>
        </div>
    );
}

// =============================================================================
// NAVIGATION
// =============================================================================

function TabNav({ activeTab, setActiveTab }) {
    const tabs = [
        { id: 'map', label: '📍 Map' },
        { id: 'activity', label: '🏃 Activity' },
        { id: 'sleep', label: '😴 Sleep' },
        { id: 'health', label: '❤️ Health' },
        { id: 'walks', label: '🚶 Walks' }
    ];

    return (
        <nav className="bg-gray-800 border-b border-gray-700 overflow-x-auto">
            <div className="container mx-auto px-4">
                <div className="flex">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </nav>
    );
}

// =============================================================================
// V6.1: LIVE WALK VERIFICATION CARD (Anti-Cheat)
// =============================================================================

function WalkVerificationCard({ status }) {
    if (!status?.walk_active) return null;

    const qualityScore = status.walk_quality_score || 0;
    const verificationStatus = status.walk_verification_status || 'monitoring';
    const carriedSeconds = status.carried_seconds || 0;
    const vehicleSeconds = status.vehicle_seconds || 0;
    const actualWalkSeconds = status.actual_walk_seconds || 0;
    const walkDuration = status.walk_duration || 1;
    
    const carriedPercent = ((carriedSeconds / walkDuration) * 100).toFixed(1);
    const actualPercent = ((actualWalkSeconds / walkDuration) * 100).toFixed(1);

    return (
        <div className="bg-gray-800 rounded-lg p-4 border-2 border-blue-500 mb-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    🔍 Live Walk Verification
                    <span className="animate-pulse text-green-400">●</span>
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getVerificationColor(verificationStatus)}`}>
                    {verificationStatus.toUpperCase()}
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                    <p className="text-gray-400 text-xs">Quality Score</p>
                    <p className={`text-3xl font-bold ${qualityScore >= 70 ? 'text-green-400' : qualityScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {qualityScore}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-gray-400 text-xs">Actual Walking</p>
                    <p className="text-2xl font-bold text-green-400">{actualPercent}%</p>
                </div>
                <div className="text-center">
                    <p className="text-gray-400 text-xs">Carried</p>
                    <p className={`text-2xl font-bold ${parseFloat(carriedPercent) > 15 ? 'text-red-400' : 'text-gray-300'}`}>
                        {carriedPercent}%
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-gray-400 text-xs">Duration</p>
                    <p className="text-2xl font-bold">{formatDuration(walkDuration)}</p>
                </div>
            </div>

            {vehicleSeconds > 0 && (
                <div className="bg-red-900/50 border border-red-500 rounded p-3 mt-2">
                    <p className="text-red-400 font-bold">🚗 VEHICLE DETECTED!</p>
                    <p className="text-gray-300 text-sm">Time in vehicle: {formatDuration(vehicleSeconds)}</p>
                </div>
            )}

            {parseFloat(carriedPercent) > 15 && (
                <div className="bg-orange-900/50 border border-orange-500 rounded p-3 mt-2">
                    <p className="text-orange-400 font-bold">⚠️ Excessive Carrying</p>
                    <p className="text-gray-300 text-sm">Popcorn was carried {carriedPercent}% of the walk (limit: 15%)</p>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// MAP VIEW
// =============================================================================

function MapView({ status, locations }) {
    const lat = status?.latitude || 28.5355;
    const lon = status?.longitude || 77.21;
    
    // OpenStreetMap embed (no API key needed)
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.005},${lat-0.005},${lon+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lon}`;

    return (
        <div className="space-y-6">
            {/* V6.1: Live Walk Verification */}
            <WalkVerificationCard status={status} />
            
            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard 
                    icon="📍" 
                    label="Location"
                    value={status?.is_home ? 'Home' : 'Outside'}
                    detail={`${Math.round(status?.distance_from_home || 0)}m away`}
                />
                <StatCard 
                    icon={getActivityEmoji(status?.activity_class)}
                    label="Activity"
                    value={status?.activity_name || 'Unknown'}
                />
                <StatCard 
                    icon="📶"
                    label="Signal"
                    value={status?.signal_strength || 0}
                    detail={status?.network_operator || '-'}
                />
                <StatCard 
                    icon="🛰️"
                    label="GPS"
                    value={`${status?.satellites || 0} sats`}
                    detail={`HDOP: ${status?.hdop?.toFixed(1) || '-'}`}
                />
            </div>

            {/* Map */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold">Live Location</h2>
                        <p className="text-gray-400 text-sm">
                            Updated: {formatTime(status?.last_seen_at)}
                        </p>
                    </div>
                    <a 
                        href={`https://maps.google.com/?q=${lat},${lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 px-4 py-2 rounded text-sm hover:bg-blue-700"
                    >
                        Open in Maps
                    </a>
                </div>
                <div className="relative" style={{ height: '400px' }}>
                    <iframe
                        title="Location Map"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        src={mapUrl}
                        style={{ border: 0 }}
                    />
                    <div className="absolute bottom-4 left-4 bg-black/75 px-3 py-2 rounded text-sm">
                        <div>Lat: {lat.toFixed(6)}</div>
                        <div>Lon: {lon.toFixed(6)}</div>
                    </div>
                </div>
            </div>

            {/* Recent Locations */}
            <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-bold mb-4">Location History ({locations.length} points)</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="text-left py-2">Time</th>
                                <th className="text-left py-2">Activity</th>
                                <th className="text-left py-2">Speed</th>
                                <th className="text-left py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {locations.slice(-10).reverse().map((loc, i) => (
                                <tr key={i} className="border-b border-gray-700/50">
                                    <td className="py-2">{formatTime(loc.recorded_at)}</td>
                                    <td className="py-2">
                                        {getActivityEmoji(loc.activity_class)} {['Rest','Still','Walk','Run','Play'][loc.activity_class] || '-'}
                                    </td>
                                    <td className="py-2">{loc.speed?.toFixed(1) || 0} km/h</td>
                                    <td className="py-2">
                                        {loc.is_escaped ? '⚠️ Escaped' : loc.is_home ? '🏠 Home' : '🚶 Out'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, detail }) {
    return (
        <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
                <span className="text-2xl">{icon}</span>
                <div>
                    <p className="text-gray-400 text-sm">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                    {detail && <p className="text-gray-500 text-xs">{detail}</p>}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// ACTIVITY VIEW
// =============================================================================

function ActivityView({ status, locations }) {
    // Calculate activity breakdown
    const breakdown = locations.reduce((acc, loc) => {
        const name = ['Resting','Still','Walking','Running','Playing'][loc.activity_class] || 'Unknown';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Current Activity */}
            <div className="bg-gray-800 rounded-lg p-6 text-center">
                <div className="text-6xl mb-4">{getActivityEmoji(status?.activity_class)}</div>
                <h2 className="text-2xl font-bold capitalize mb-2">{status?.activity_name || 'Unknown'}</h2>
                <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
                    <div>
                        <p className="text-gray-400">Today's Steps</p>
                        <p className="text-2xl font-bold">{status?.today_steps || 0}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">Variance</p>
                        <p className="text-2xl font-bold">{status?.accel_variance?.toFixed(4) || 0}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">Session Steps</p>
                        <p className="text-2xl font-bold">{status?.session_steps || 0}</p>
                    </div>
                </div>
            </div>

            {/* Activity Breakdown */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-4">Today's Activity Breakdown</h2>
                <div className="grid grid-cols-5 gap-2">
                    {Object.entries(breakdown).map(([name, count]) => (
                        <div key={name} className="text-center p-3 bg-gray-700 rounded">
                            <div className="text-2xl font-bold">{count}</div>
                            <div className="text-xs text-gray-400">{name}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Accelerometer Data */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-4">Accelerometer</h2>
                <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">X</p>
                        <p className="text-xl font-mono">{status?.accel_x?.toFixed(3) || 0}g</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">Y</p>
                        <p className="text-xl font-mono">{status?.accel_y?.toFixed(3) || 0}g</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">Z</p>
                        <p className="text-xl font-mono">{status?.accel_z?.toFixed(3) || 0}g</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">Magnitude</p>
                        <p className="text-xl font-mono">{status?.accel_magnitude?.toFixed(2) || 0}g</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// SLEEP VIEW
// =============================================================================

function SleepView({ sleepHistory, status }) {
    const avgQuality = sleepHistory.length > 0
        ? sleepHistory.reduce((sum, s) => sum + (s.quality_score || 0), 0) / sleepHistory.length
        : 0;

    return (
        <div className="space-y-6">
            {/* Current Sleep Status */}
            {status?.sleep_active && (
                <div className="bg-indigo-900/50 border border-indigo-500 rounded-lg p-6 text-center">
                    <div className="text-4xl mb-2">😴</div>
                    <h2 className="text-xl font-bold">Popcorn is Sleeping</h2>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                            <p className="text-gray-400 text-sm">Quality</p>
                            <p className="text-2xl font-bold">{status?.sleep_quality?.toFixed(0) || '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Respiratory</p>
                            <p className="text-2xl font-bold">{status?.respiratory_rate?.toFixed(0) || '-'} bpm</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Restless</p>
                            <p className="text-2xl font-bold">{status?.restless_count || 0}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Avg Quality</p>
                    <p className="text-3xl font-bold">{avgQuality.toFixed(0)}</p>
                    <p className="text-gray-500 text-xs">/100</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Sessions</p>
                    <p className="text-3xl font-bold">{sleepHistory.length}</p>
                    <p className="text-gray-500 text-xs">this week</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Last Night</p>
                    <p className="text-3xl font-bold">{sleepHistory[0]?.quality_score?.toFixed(0) || '-'}</p>
                    <p className="text-gray-500 text-xs">quality</p>
                </div>
            </div>

            {/* Sleep History */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-4">Sleep History</h2>
                <div className="space-y-3">
                    {sleepHistory.map((session, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-700/50 rounded">
                            <div>
                                <p className="font-bold">{formatDate(session.started_at)}</p>
                                <p className="text-gray-400 text-sm">
                                    {session.duration_minutes ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m` : '-'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={`text-2xl font-bold ${
                                    session.quality_score > 80 ? 'text-green-400' :
                                    session.quality_score > 50 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                    {session.quality_score?.toFixed(0) || '-'}
                                </p>
                                <p className="text-gray-500 text-xs">{session.restless_count || 0} restless</p>
                            </div>
                        </div>
                    ))}
                    {sleepHistory.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No sleep data yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// HEALTH VIEW
// =============================================================================

function HealthView({ scratchHistory, anomalies }) {
    const totalScratches = scratchHistory.reduce((sum, d) => sum + (d.total_count || 0), 0);
    const avgDaily = scratchHistory.length > 0 ? totalScratches / scratchHistory.length : 0;

    return (
        <div className="space-y-6">
            {/* Scratch Summary */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-4">🐾 Scratch Monitoring</h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">Total (7 days)</p>
                        <p className="text-3xl font-bold">{totalScratches}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">Daily Avg</p>
                        <p className="text-3xl font-bold">{avgDaily.toFixed(1)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">Status</p>
                        <p className={`text-3xl font-bold ${avgDaily > 15 ? 'text-red-400' : 'text-green-400'}`}>
                            {avgDaily > 15 ? '⚠️ High' : '✓ Normal'}
                        </p>
                    </div>
                </div>

                {/* Daily Chart */}
                <div className="flex items-end justify-between h-24 mt-4">
                    {scratchHistory.slice(0, 7).reverse().map((day, i) => (
                        <div key={i} className="flex flex-col items-center flex-1">
                            <div 
                                className={`w-full max-w-8 mx-1 rounded-t ${
                                    day.total_count > 15 ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{ height: `${Math.min(100, day.total_count * 5)}%` }}
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Anomalies */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-4">❤️ Health Anomalies</h2>
                {anomalies.length > 0 ? (
                    <div className="space-y-3">
                        {anomalies.map((a, i) => (
                            <div key={i} className="p-4 bg-red-900/30 border border-red-500/50 rounded">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-red-400">{a.anomaly_type?.replace('_', ' ')}</p>
                                        <p className="text-gray-400 text-sm">{formatDate(a.detected_at)} {formatTime(a.detected_at)}</p>
                                    </div>
                                    <span className="text-sm">{a.deviation_percent?.toFixed(1)}% deviation</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <span className="text-4xl">✅</span>
                        <p className="text-gray-400 mt-2">No anomalies detected</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// WALKS VIEW (V6.1: With Anti-Cheat Stats)
// =============================================================================

function WalksView({ walkHistory, walkerStats }) {
    const totalDistance = walkHistory.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
    const avgScore = walkHistory.filter(w => w.grade_score || w.quality_score).length > 0
        ? walkHistory.reduce((sum, w) => sum + (w.quality_score || w.grade_score || 0), 0) / walkHistory.filter(w => w.grade_score || w.quality_score).length
        : 0;

    // Helper to get cheat flag icons
    const getCheatFlags = (flags) => {
        const issues = [];
        if (flags & 0x01) issues.push('🎒 Carried');
        if (flags & 0x02) issues.push('🚗 Vehicle');
        if (flags & 0x04) issues.push('⏸️ Long Stops');
        if (flags & 0x08) issues.push('🦮 Leash Only');
        return issues;
    };

    return (
        <div className="space-y-6">
            {/* V6.1: Walker Performance Summary */}
            {walkerStats && (
                <div className="bg-gray-800 rounded-lg p-4">
                    <h2 className="text-lg font-bold mb-4">📊 Walker Performance (7 Days)</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                            <p className="text-gray-400 text-xs">Avg Quality</p>
                            <p className={`text-3xl font-bold ${walkerStats.avg_quality_score >= 70 ? 'text-green-400' : walkerStats.avg_quality_score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {Math.round(walkerStats.avg_quality_score || 0)}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-gray-400 text-xs">Total Walks</p>
                            <p className="text-3xl font-bold">{walkerStats.total_walks || 0}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-gray-400 text-xs">Distance</p>
                            <p className="text-3xl font-bold text-blue-400">{walkerStats.total_distance_km || 0} km</p>
                        </div>
                        <div className="text-center">
                            <p className="text-gray-400 text-xs">Issues</p>
                            <p className={`text-3xl font-bold ${walkerStats.vehicle_incidents > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {walkerStats.vehicle_incidents || 0}
                            </p>
                        </div>
                    </div>
                    
                    {/* Grade Distribution */}
                    <div className="flex justify-around">
                        <div className="text-center">
                            <span className="text-green-400 text-2xl font-bold">{walkerStats.excellent_walks || 0}</span>
                            <p className="text-xs text-gray-400">A Walks</p>
                        </div>
                        <div className="text-center">
                            <span className="text-blue-400 text-2xl font-bold">{walkerStats.good_walks || 0}</span>
                            <p className="text-xs text-gray-400">B Walks</p>
                        </div>
                        <div className="text-center">
                            <span className="text-yellow-400 text-2xl font-bold">{walkerStats.fair_walks || 0}</span>
                            <p className="text-xs text-gray-400">C Walks</p>
                        </div>
                        <div className="text-center">
                            <span className="text-red-400 text-2xl font-bold">{walkerStats.poor_walks || 0}</span>
                            <p className="text-xs text-gray-400">F Walks</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Total Walks</p>
                    <p className="text-3xl font-bold">{walkHistory.length}</p>
                    <p className="text-gray-500 text-xs">this month</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Total Distance</p>
                    <p className="text-3xl font-bold">{(totalDistance / 1000).toFixed(1)}</p>
                    <p className="text-gray-500 text-xs">km</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Avg Grade</p>
                    <p className="text-3xl font-bold">{avgScore.toFixed(0)}</p>
                    <p className="text-gray-500 text-xs">/100</p>
                </div>
            </div>

            {/* Walk History */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-4">Walk History</h2>
                <div className="space-y-3">
                    {walkHistory.map((walk, i) => {
                        const cheatIssues = getCheatFlags(walk.cheat_flags || 0);
                        
                        return (
                            <div key={i} className={`p-4 rounded ${walk.vehicle_detected ? 'bg-red-900/30 border border-red-500' : 'bg-gray-700/50'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold">{formatDate(walk.started_at)}</p>
                                        <p className="text-gray-400 text-sm">
                                            {formatDuration(walk.duration_seconds)} • 
                                            {((walk.distance_meters || 0) / 1000).toFixed(2)} km • 
                                            {walk.stop_count || 0} stops
                                        </p>
                                        
                                        {/* V6.1: Anti-cheat details */}
                                        {walk.carried_percent > 0 && (
                                            <p className={`text-sm mt-1 ${walk.carried_percent > 15 ? 'text-orange-400' : 'text-gray-500'}`}>
                                                Carried: {walk.carried_percent?.toFixed(1)}%
                                                {walk.carried_percent > 15 && ' ⚠️'}
                                            </p>
                                        )}
                                        
                                        {/* Cheat flags */}
                                        {cheatIssues.length > 0 && (
                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                {cheatIssues.map((issue, j) => (
                                                    <span key={j} className="bg-red-900/50 text-red-300 text-xs px-2 py-1 rounded">
                                                        {issue}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-3xl font-bold ${getGradeColor(walk.grade)}`}>
                                            {walk.grade || '-'}
                                        </span>
                                        <p className="text-gray-500 text-xs">{walk.quality_score || walk.grade_score || '-'}/100</p>
                                        {walk.verification_status && (
                                            <span className={`text-xs px-2 py-0.5 rounded ${getVerificationColor(walk.verification_status)}`}>
                                                {walk.verification_status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {walkHistory.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No walk data yet</p>
                    )}
                </div>
            </div>

            {/* V6.1: Grading explanation */}
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                <h3 className="font-bold text-yellow-400 mb-2">🔍 Anti-Cheat Walk Grading</h3>
                <div className="text-gray-300 text-sm space-y-1">
                    <p>✅ <strong>Actual Walking:</strong> GPS moving + dog actively walking</p>
                    <p>🎒 <strong>Carrying:</strong> GPS moving but dog is still (up to 15% OK)</p>
                    <p>🚗 <strong>Vehicle:</strong> Speed &gt;15 km/h detected = major penalty</p>
                    <p>⏸️ <strong>Long Stops:</strong> Stopped for &gt;5 minutes = penalty</p>
                </div>
            </div>
        </div>
    );
}
