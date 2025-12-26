// =============================================================================
// POPCORN GPS COLLAR V6.1 - PREMIUM DASHBOARD
// =============================================================================
// Modern UI with Vuexy-inspired design: gradients, shadows, animations
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'POPCORN001';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const formatTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

const getActivityInfo = (activityClass) => {
    const activities = [
        { emoji: '😴', name: 'Resting', color: 'from-slate-400 to-slate-500' },
        { emoji: '🧘', name: 'Still', color: 'from-blue-400 to-blue-500' },
        { emoji: '🚶', name: 'Walking', color: 'from-emerald-400 to-emerald-500' },
        { emoji: '🏃', name: 'Running', color: 'from-orange-400 to-orange-500' },
        { emoji: '🎾', name: 'Playing', color: 'from-pink-400 to-pink-500' }
    ];
    return activities[activityClass] || { emoji: '❓', name: 'Unknown', color: 'from-gray-400 to-gray-500' };
};

// =============================================================================
// MAIN APP
// =============================================================================

export default function App() {
    const [status, setStatus] = useState(null);
    const [locations, setLocations] = useState([]);
    const [sleepHistory, setSleepHistory] = useState([]);
    const [scratchHistory, setScratchHistory] = useState([]);
    const [walkHistory, setWalkHistory] = useState([]);
    const [anomalies, setAnomalies] = useState([]);
    const [walkerStats, setWalkerStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [lastRefresh, setLastRefresh] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            
            const { data: statusData, error: statusError } = await supabase
                .from('device_status')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .single();
            
            if (statusError && statusError.code !== 'PGRST116') throw statusError;
            setStatus(statusData);

            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: locData } = await supabase
                .from('locations')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('recorded_at', yesterday)
                .order('recorded_at', { ascending: true });
            setLocations(locData || []);

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: sleepData } = await supabase
                .from('sleep_sessions')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('started_at', weekAgo)
                .order('started_at', { ascending: false });
            setSleepHistory(sleepData || []);

            const { data: scratchData } = await supabase
                .from('scratch_daily')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('date', weekAgo.split('T')[0])
                .order('date', { ascending: false });
            setScratchHistory(scratchData || []);

            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data: walkData } = await supabase
                .from('walk_sessions')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .gte('started_at', monthAgo)
                .order('started_at', { ascending: false });
            setWalkHistory(walkData || []);

            if (walkData && walkData.length > 0) {
                const stats = {
                    total_walks: walkData.length,
                    avg_quality_score: walkData.reduce((sum, w) => sum + (w.quality_score || w.grade_score || 0), 0) / walkData.length,
                    excellent_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) >= 90).length,
                    good_walks: walkData.filter(w => { const s = w.quality_score || w.grade_score || 0; return s >= 70 && s < 90; }).length,
                    fair_walks: walkData.filter(w => { const s = w.quality_score || w.grade_score || 0; return s >= 50 && s < 70; }).length,
                    poor_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) < 50).length,
                    total_distance_km: (walkData.reduce((sum, w) => sum + (w.distance_meters || 0), 0) / 1000).toFixed(2),
                    avg_carried_percent: walkData.reduce((sum, w) => sum + (w.carried_percent || 0), 0) / walkData.length,
                    vehicle_incidents: walkData.filter(w => w.vehicle_detected).length
                };
                setWalkerStats(stats);
            }

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

    useEffect(() => {
        fetchData();
        const subscription = supabase
            .channel('device_status_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'device_status',
                filter: `device_id=eq.${DEVICE_ID}`
            }, (payload) => {
                setStatus(payload.new);
                setLastRefresh(new Date());
            })
            .subscribe();

        const interval = setInterval(fetchData, 30000);
        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [fetchData]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 animate-ping opacity-20"></div>
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
                            <span className="text-4xl">🐕</span>
                        </div>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-700">Loading Popcorn's Data...</h2>
                    <p className="text-slate-400 mt-2">Please wait a moment</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Connection Error</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button 
                        onClick={fetchData}
                        className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-violet-200 transition-all duration-300"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
            {/* Sidebar */}
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                isOpen={sidebarOpen}
                status={status}
            />
            
            {/* Main Content */}
            <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
                {/* Top Header */}
                <Header 
                    status={status} 
                    lastRefresh={lastRefresh} 
                    onRefresh={fetchData}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                />
                
                {/* Alert Banners */}
                {anomalies.length > 0 && <AlertBanner anomalies={anomalies} />}
                {status?.is_escaped && <EscapeAlert status={status} />}
                
                {/* Content */}
                <main className="p-6">
                    {activeTab === 'overview' && (
                        <OverviewView status={status} locations={locations} walkHistory={walkHistory} walkerStats={walkerStats} sleepHistory={sleepHistory} />
                    )}
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
                        <WalksView walkHistory={walkHistory} walkerStats={walkerStats} status={status} />
                    )}
                </main>
            </div>
        </div>
    );
}

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

function Sidebar({ activeTab, setActiveTab, isOpen, status }) {
    const menuItems = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'map', icon: '📍', label: 'Live Map' },
        { id: 'activity', icon: '🏃', label: 'Activity' },
        { id: 'sleep', icon: '😴', label: 'Sleep' },
        { id: 'health', icon: '❤️', label: 'Health' },
        { id: 'walks', icon: '🚶', label: 'Walks' },
    ];

    return (
        <aside className={`fixed left-0 top-0 h-full bg-white shadow-xl z-40 transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
            {/* Logo */}
            <div className="h-20 flex items-center px-6 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <span className="text-xl">🐕</span>
                    </div>
                    {isOpen && (
                        <div className="animate-fadeIn">
                            <h1 className="font-bold text-slate-800">Popcorn</h1>
                            <p className="text-xs text-slate-400">GPS Tracker v6.1</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Navigation */}
            <nav className="p-4 space-y-2">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                            activeTab === item.id
                                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <span className="text-xl">{item.icon}</span>
                        {isOpen && <span className="font-medium">{item.label}</span>}
                    </button>
                ))}
            </nav>
            
            {/* Status Card */}
            {isOpen && status && (
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-400">Device Status</span>
                            <span className={`w-2 h-2 rounded-full ${status?.last_seen_at && (Date.now() - new Date(status.last_seen_at)) < 300000 ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold">{status?.battery_percent || 0}%</p>
                                <p className="text-xs text-slate-400">Battery</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                <span className="text-2xl">🔋</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

function Header({ status, lastRefresh, onRefresh, sidebarOpen, setSidebarOpen }) {
    const getConnectionStatus = () => {
        if (!status?.last_seen_at) return { text: 'Never connected', color: 'bg-red-100 text-red-600' };
        const minutes = (Date.now() - new Date(status.last_seen_at)) / 60000;
        if (minutes < 5) return { text: 'Online', color: 'bg-emerald-100 text-emerald-600' };
        if (minutes < 60) return { text: `${Math.floor(minutes)}m ago`, color: 'bg-amber-100 text-amber-600' };
        return { text: 'Offline', color: 'bg-red-100 text-red-600' };
    };

    const connection = getConnectionStatus();

    return (
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-30">
            <div className="h-full px-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            Welcome back! 👋
                        </h2>
                        <p className="text-sm text-slate-400">
                            Here's what's happening with Popcorn today
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center space-x-3">
                    {/* Connection Status */}
                    <div className={`px-4 py-2 rounded-xl text-sm font-medium ${connection.color}`}>
                        {connection.text}
                    </div>
                    
                    {/* Location Badge */}
                    {status?.is_escaped ? (
                        <div className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium animate-pulse">
                            ⚠️ ESCAPED
                        </div>
                    ) : status?.is_home ? (
                        <div className="px-4 py-2 bg-emerald-100 text-emerald-600 rounded-xl text-sm font-medium">
                            🏠 At Home
                        </div>
                    ) : (
                        <div className="px-4 py-2 bg-amber-100 text-amber-600 rounded-xl text-sm font-medium">
                            🚶 Outside
                        </div>
                    )}
                    
                    {/* Refresh Button */}
                    <button 
                        onClick={onRefresh}
                        className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        title={`Last refresh: ${lastRefresh?.toLocaleTimeString()}`}
                    >
                        <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    
                    {/* Profile */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-violet-200 transition-all">
                        <span className="text-lg">🐕</span>
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
        <div className="mx-6 mt-4">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg shadow-amber-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-xl">⚠️</span>
                        </div>
                        <div>
                            <p className="font-semibold">Health Alert Detected</p>
                            <p className="text-sm text-white/80">{anomalies[0]?.anomaly_type?.replace('_', ' ')} - {formatDate(anomalies[0]?.detected_at)}</p>
                        </div>
                    </div>
                    <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
                        View Details
                    </button>
                </div>
            </div>
        </div>
    );
}

function EscapeAlert({ status }) {
    return (
        <div className="mx-6 mt-4">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200 animate-pulse">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <span className="text-3xl">🚨</span>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">ESCAPE ALERT!</p>
                            <p className="text-white/80">Popcorn is {Math.round(status?.distance_from_home || 0)}m from home</p>
                        </div>
                    </div>
                    <a 
                        href={`https://maps.google.com/?q=${status?.latitude},${status?.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-white text-red-600 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                        📍 Open in Maps
                    </a>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

function StatCard({ icon, label, value, change, changeType, gradient, delay = 0 }) {
    return (
        <div 
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 animate-slideUp"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{label}</p>
                    <p className="text-3xl font-bold text-slate-800">{value}</p>
                    {change && (
                        <div className={`flex items-center mt-2 text-sm font-medium ${
                            changeType === 'up' ? 'text-emerald-500' : changeType === 'down' ? 'text-red-500' : 'text-slate-400'
                        }`}>
                            {changeType === 'up' && '↑'}
                            {changeType === 'down' && '↓'}
                            <span className="ml-1">{change}</span>
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient || 'from-violet-500 to-purple-600'} flex items-center justify-center shadow-lg`}>
                    <span className="text-xl">{icon}</span>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// OVERVIEW VIEW
// =============================================================================

function OverviewView({ status, locations, walkHistory, walkerStats, sleepHistory }) {
    const activity = getActivityInfo(status?.activity_class);
    const avgSleepQuality = sleepHistory.length > 0 
        ? (sleepHistory.reduce((sum, s) => sum + (s.quality_score || 0), 0) / sleepHistory.length).toFixed(0)
        : '-';
    
    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    icon="📍"
                    label="Distance from Home"
                    value={`${Math.round(status?.distance_from_home || 0)}m`}
                    change={status?.is_home ? 'At home' : 'Outside'}
                    changeType={status?.is_home ? 'up' : 'neutral'}
                    gradient="from-violet-500 to-purple-600"
                    delay={0}
                />
                <StatCard 
                    icon="👣"
                    label="Today's Steps"
                    value={status?.today_steps?.toLocaleString() || '0'}
                    change="+12.5% from yesterday"
                    changeType="up"
                    gradient="from-emerald-400 to-teal-500"
                    delay={100}
                />
                <StatCard 
                    icon="🚶"
                    label="Total Walks"
                    value={walkerStats?.total_walks || 0}
                    change="This month"
                    changeType="neutral"
                    gradient="from-blue-400 to-indigo-500"
                    delay={200}
                />
                <StatCard 
                    icon="😴"
                    label="Avg Sleep Quality"
                    value={avgSleepQuality}
                    change="Last 7 days"
                    changeType="neutral"
                    gradient="from-indigo-400 to-violet-500"
                    delay={300}
                />
            </div>
            
            {/* Live Activity Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Current Activity</h3>
                            <p className="text-slate-400 text-sm">Real-time status</p>
                        </div>
                        <span className="flex items-center px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-sm">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                            Live
                        </span>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                        <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${activity.color} flex items-center justify-center shadow-lg`}>
                            <span className="text-5xl">{activity.emoji}</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-2xl font-bold text-slate-800 capitalize">{status?.activity_name || 'Unknown'}</h4>
                            <p className="text-slate-400 mt-1">Last updated: {formatTime(status?.last_seen_at)}</p>
                            
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-800">{status?.accel_variance?.toFixed(3) || '0'}</p>
                                    <p className="text-xs text-slate-400">Variance</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-800">{status?.speed?.toFixed(1) || '0'}</p>
                                    <p className="text-xs text-slate-400">Speed (km/h)</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-800">{status?.satellites || '0'}</p>
                                    <p className="text-xs text-slate-400">GPS Sats</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Quick Stats */}
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-violet-200">
                    <h3 className="text-lg font-semibold mb-4">Weekly Summary</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-white/80">Total Distance</span>
                            <span className="text-xl font-bold">{walkerStats?.total_distance_km || 0} km</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white rounded-full h-2" style={{ width: '70%' }}></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-white/80">Avg Quality</span>
                            <span className="text-xl font-bold">{Math.round(walkerStats?.avg_quality_score || 0)}/100</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white rounded-full h-2" style={{ width: `${walkerStats?.avg_quality_score || 0}%` }}></div>
                        </div>
                        <div className="pt-4 border-t border-white/20">
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div>
                                    <p className="text-2xl font-bold">{walkerStats?.excellent_walks || 0}</p>
                                    <p className="text-xs text-white/60">A</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{walkerStats?.good_walks || 0}</p>
                                    <p className="text-xs text-white/60">B</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{walkerStats?.fair_walks || 0}</p>
                                    <p className="text-xs text-white/60">C</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{walkerStats?.poor_walks || 0}</p>
                                    <p className="text-xs text-white/60">F</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Live Walk Verification */}
            {status?.walk_active && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-violet-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-xl">🔍</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">Live Walk Verification</h3>
                                <p className="text-sm text-slate-400">Anti-cheat monitoring active</p>
                            </div>
                        </div>
                        <span className="px-4 py-2 bg-violet-100 text-violet-600 rounded-xl text-sm font-medium">
                            {status.walk_verification_status?.toUpperCase() || 'MONITORING'}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className={`text-3xl font-bold ${status.walk_quality_score >= 70 ? 'text-emerald-500' : status.walk_quality_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                {status.walk_quality_score || 0}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Quality Score</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-500">
                                {status.walk_duration ? ((status.actual_walk_seconds / status.walk_duration) * 100).toFixed(0) : 0}%
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Actual Walking</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className={`text-3xl font-bold ${status.carried_seconds > status.walk_duration * 0.15 ? 'text-red-500' : 'text-slate-600'}`}>
                                {status.walk_duration ? ((status.carried_seconds / status.walk_duration) * 100).toFixed(0) : 0}%
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Carried</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-slate-800">{formatDuration(status.walk_duration)}</p>
                            <p className="text-xs text-slate-400 mt-1">Duration</p>
                        </div>
                    </div>
                    
                    {status.vehicle_seconds > 0 && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
                            <span className="text-2xl">🚗</span>
                            <div>
                                <p className="font-semibold text-red-600">Vehicle Detected!</p>
                                <p className="text-sm text-red-500">Time in vehicle: {formatDuration(status.vehicle_seconds)}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Recent Locations */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Recent Activity</h3>
                        <p className="text-slate-400 text-sm">{locations.length} points in last 24 hours</p>
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50 rounded-xl transition-colors">
                        View All →
                    </button>
                </div>
                
                <div className="overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Time</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Activity</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Speed</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {locations.slice(-5).reverse().map((loc, i) => {
                                const act = getActivityInfo(loc.activity_class);
                                return (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 text-sm text-slate-600">{formatTime(loc.recorded_at)}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center space-x-2">
                                                <span>{act.emoji}</span>
                                                <span className="text-sm text-slate-600">{act.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600">{loc.speed?.toFixed(1) || 0} km/h</td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                                loc.is_escaped ? 'bg-red-100 text-red-600' :
                                                loc.is_home ? 'bg-emerald-100 text-emerald-600' :
                                                'bg-amber-100 text-amber-600'
                                            }`}>
                                                {loc.is_escaped ? '⚠️ Escaped' : loc.is_home ? '🏠 Home' : '🚶 Outside'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// MAP VIEW
// =============================================================================

function MapView({ status, locations }) {
    const lat = status?.latitude || 28.5355;
    const lon = status?.longitude || 77.21;
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.005},${lat-0.005},${lon+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lon}`;

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon="📍" label="Location" value={status?.is_home ? 'Home' : 'Outside'} gradient="from-violet-500 to-purple-600" />
                <StatCard icon={getActivityInfo(status?.activity_class).emoji} label="Activity" value={status?.activity_name || 'Unknown'} gradient="from-emerald-400 to-teal-500" />
                <StatCard icon="📶" label="Signal" value={status?.signal_strength || 0} gradient="from-blue-400 to-indigo-500" />
                <StatCard icon="🛰️" label="GPS Satellites" value={status?.satellites || 0} gradient="from-orange-400 to-rose-500" />
            </div>

            {/* Map Card */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Live Location</h3>
                        <p className="text-slate-400 text-sm">Updated: {formatTime(status?.last_seen_at)}</p>
                    </div>
                    <a 
                        href={`https://maps.google.com/?q=${lat},${lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-200 transition-all"
                    >
                        Open in Maps
                    </a>
                </div>
                <div className="relative h-96">
                    <iframe
                        title="Location Map"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        src={mapUrl}
                    />
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg">
                        <div className="text-sm">
                            <p className="text-slate-400">Coordinates</p>
                            <p className="font-mono font-medium text-slate-800">{lat.toFixed(6)}, {lon.toFixed(6)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// ACTIVITY VIEW
// =============================================================================

function ActivityView({ status, locations }) {
    const breakdown = locations.reduce((acc, loc) => {
        const name = getActivityInfo(loc.activity_class).name;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});
    
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;

    return (
        <div className="space-y-6">
            {/* Current Activity Hero */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
                <div className="flex flex-col lg:flex-row items-center justify-between">
                    <div className="flex items-center space-x-6 mb-6 lg:mb-0">
                        <div className={`w-28 h-28 rounded-2xl bg-gradient-to-br ${getActivityInfo(status?.activity_class).color} flex items-center justify-center shadow-xl`}>
                            <span className="text-6xl">{getActivityInfo(status?.activity_class).emoji}</span>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Current Activity</p>
                            <h2 className="text-4xl font-bold text-slate-800 capitalize mt-1">{status?.activity_name || 'Unknown'}</h2>
                            <p className="text-slate-400 mt-2">Last updated {formatTime(status?.last_seen_at)}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6">
                        <div className="text-center">
                            <p className="text-4xl font-bold text-slate-800">{status?.today_steps?.toLocaleString() || 0}</p>
                            <p className="text-sm text-slate-400">Today's Steps</p>
                        </div>
                        <div className="text-center">
                            <p className="text-4xl font-bold text-slate-800">{status?.accel_variance?.toFixed(3) || 0}</p>
                            <p className="text-sm text-slate-400">Variance</p>
                        </div>
                        <div className="text-center">
                            <p className="text-4xl font-bold text-slate-800">{status?.session_steps || 0}</p>
                            <p className="text-sm text-slate-400">Session Steps</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Activity Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Today's Activity Breakdown</h3>
                <div className="space-y-4">
                    {Object.entries(breakdown).map(([name, count]) => {
                        const percent = ((count / total) * 100).toFixed(0);
                        const activity = Object.values([
                            { name: 'Resting', color: 'from-slate-400 to-slate-500' },
                            { name: 'Still', color: 'from-blue-400 to-blue-500' },
                            { name: 'Walking', color: 'from-emerald-400 to-emerald-500' },
                            { name: 'Running', color: 'from-orange-400 to-orange-500' },
                            { name: 'Playing', color: 'from-pink-400 to-pink-500' }
                        ]).find(a => a.name === name) || { color: 'from-gray-400 to-gray-500' };
                        
                        return (
                            <div key={name} className="flex items-center space-x-4">
                                <div className="w-24 text-sm font-medium text-slate-600">{name}</div>
                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full bg-gradient-to-r ${activity.color} rounded-full transition-all duration-500`}
                                        style={{ width: `${percent}%` }}
                                    ></div>
                                </div>
                                <div className="w-16 text-right text-sm font-semibold text-slate-800">{percent}%</div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Accelerometer */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Accelerometer Data</h3>
                <div className="grid grid-cols-4 gap-4">
                    {[
                        { label: 'X-Axis', value: status?.accel_x?.toFixed(3) || 0, color: 'from-red-400 to-rose-500' },
                        { label: 'Y-Axis', value: status?.accel_y?.toFixed(3) || 0, color: 'from-emerald-400 to-teal-500' },
                        { label: 'Z-Axis', value: status?.accel_z?.toFixed(3) || 0, color: 'from-blue-400 to-indigo-500' },
                        { label: 'Magnitude', value: status?.accel_magnitude?.toFixed(2) || 0, color: 'from-violet-400 to-purple-500' }
                    ].map((item) => (
                        <div key={item.label} className="bg-slate-50 rounded-xl p-4">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 shadow-md`}>
                                <span className="text-white text-sm font-bold">{item.label[0]}</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-800 font-mono">{item.value}g</p>
                            <p className="text-xs text-slate-400">{item.label}</p>
                        </div>
                    ))}
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
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                                <span className="text-4xl">😴</span>
                            </div>
                            <div>
                                <p className="text-xl font-bold">Popcorn is Sleeping</p>
                                <p className="text-white/80">Sweet dreams!</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-8">
                            <div className="text-center">
                                <p className="text-3xl font-bold">{status?.sleep_quality?.toFixed(0) || '-'}</p>
                                <p className="text-xs text-white/60">Quality</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold">{status?.respiratory_rate?.toFixed(0) || '-'}</p>
                                <p className="text-xs text-white/60">Breaths/min</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold">{status?.restless_count || 0}</p>
                                <p className="text-xs text-white/60">Restless</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon="⭐" label="Avg Quality" value={avgQuality.toFixed(0)} gradient="from-amber-400 to-orange-500" />
                <StatCard icon="🌙" label="Sleep Sessions" value={sleepHistory.length} gradient="from-indigo-400 to-violet-500" />
                <StatCard icon="📊" label="Last Night" value={sleepHistory[0]?.quality_score?.toFixed(0) || '-'} gradient="from-emerald-400 to-teal-500" />
            </div>

            {/* Sleep History */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Sleep History</h3>
                <div className="space-y-4">
                    {sleepHistory.map((session, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl flex items-center justify-center">
                                    <span className="text-xl">🌙</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{formatDate(session.started_at)}</p>
                                    <p className="text-sm text-slate-400">
                                        {session.duration_minutes ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m` : 'In progress'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-2xl font-bold ${
                                    session.quality_score > 80 ? 'text-emerald-500' :
                                    session.quality_score > 50 ? 'text-amber-500' : 'text-red-500'
                                }`}>
                                    {session.quality_score?.toFixed(0) || '-'}
                                </div>
                                <p className="text-xs text-slate-400">{session.restless_count || 0} restless periods</p>
                            </div>
                        </div>
                    ))}
                    {sleepHistory.length === 0 && (
                        <div className="text-center py-12">
                            <span className="text-4xl">🌙</span>
                            <p className="text-slate-400 mt-2">No sleep data recorded yet</p>
                        </div>
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
    const maxDaily = Math.max(...scratchHistory.map(d => d.total_count || 0), 1);

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon="🐾" label="Total Scratches" value={totalScratches} gradient="from-rose-400 to-pink-500" />
                <StatCard icon="📊" label="Daily Average" value={avgDaily.toFixed(1)} gradient="from-amber-400 to-orange-500" />
                <StatCard 
                    icon={avgDaily > 15 ? '⚠️' : '✓'} 
                    label="Status" 
                    value={avgDaily > 15 ? 'High' : 'Normal'} 
                    gradient={avgDaily > 15 ? 'from-red-400 to-rose-500' : 'from-emerald-400 to-teal-500'} 
                />
            </div>

            {/* Scratch Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Scratch Frequency (Last 7 Days)</h3>
                <div className="flex items-end justify-between h-48 px-4">
                    {scratchHistory.slice(0, 7).reverse().map((day, i) => {
                        const height = (day.total_count / maxDaily) * 100;
                        return (
                            <div key={i} className="flex flex-col items-center flex-1 mx-1">
                                <div className="w-full relative" style={{ height: '160px' }}>
                                    <div 
                                        className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-500 ${
                                            day.total_count > 15 ? 'bg-gradient-to-t from-red-500 to-rose-400' : 'bg-gradient-to-t from-violet-500 to-purple-400'
                                        }`}
                                        style={{ height: `${height}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                                </p>
                                <p className="text-sm font-semibold text-slate-600">{day.total_count}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Anomalies */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Health Anomalies</h3>
                {anomalies.length > 0 ? (
                    <div className="space-y-4">
                        {anomalies.map((a, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                        <span className="text-xl">⚠️</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-red-700">{a.anomaly_type?.replace('_', ' ')}</p>
                                        <p className="text-sm text-red-400">{formatDate(a.detected_at)} at {formatTime(a.detected_at)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-red-600">{a.deviation_percent?.toFixed(1)}%</p>
                                    <p className="text-xs text-red-400">deviation</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">✅</span>
                        </div>
                        <p className="text-slate-600 font-medium">All Clear!</p>
                        <p className="text-slate-400 text-sm">No health anomalies detected</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// WALKS VIEW
// =============================================================================

function WalksView({ walkHistory, walkerStats, status }) {
    const getGradeColor = (grade) => {
        switch (grade) {
            case 'A': return 'from-emerald-400 to-teal-500';
            case 'B': return 'from-blue-400 to-indigo-500';
            case 'C': return 'from-amber-400 to-orange-500';
            case 'F': return 'from-red-400 to-rose-500';
            default: return 'from-slate-400 to-slate-500';
        }
    };

    const getCheatFlags = (flags) => {
        const issues = [];
        if (flags & 0x01) issues.push({ icon: '🎒', label: 'Carried' });
        if (flags & 0x02) issues.push({ icon: '🚗', label: 'Vehicle' });
        if (flags & 0x04) issues.push({ icon: '⏸️', label: 'Long Stop' });
        if (flags & 0x08) issues.push({ icon: '🦮', label: 'Leash Only' });
        return issues;
    };

    return (
        <div className="space-y-6">
            {/* Live Walk Card */}
            {status?.walk_active && (
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-violet-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🚶</span>
                            </div>
                            <div>
                                <p className="text-xl font-bold">Walk in Progress</p>
                                <p className="text-white/80">Anti-cheat monitoring active</p>
                            </div>
                        </div>
                        <span className="flex items-center px-4 py-2 bg-white/20 rounded-xl text-sm">
                            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
                            LIVE
                        </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white/10 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold">{status.walk_quality_score || 0}</p>
                            <p className="text-xs text-white/60">Quality</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold">{formatDuration(status.walk_duration)}</p>
                            <p className="text-xs text-white/60">Duration</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold">{((status.walk_distance || 0) / 1000).toFixed(2)}</p>
                            <p className="text-xs text-white/60">Distance (km)</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold">{status.walk_stops || 0}</p>
                            <p className="text-xs text-white/60">Stops</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Walker Performance */}
            {walkerStats && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Walker Performance</h3>
                            <p className="text-slate-400 text-sm">Last 30 days summary</p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                            walkerStats.avg_quality_score >= 70 ? 'bg-emerald-100 text-emerald-600' :
                            walkerStats.avg_quality_score >= 50 ? 'bg-amber-100 text-amber-600' :
                            'bg-red-100 text-red-600'
                        }`}>
                            Avg Score: {Math.round(walkerStats.avg_quality_score)}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-slate-800">{walkerStats.total_walks}</p>
                            <p className="text-xs text-slate-400">Total Walks</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-violet-600">{walkerStats.total_distance_km} km</p>
                            <p className="text-xs text-slate-400">Distance</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-slate-800">{walkerStats.avg_carried_percent?.toFixed(1) || 0}%</p>
                            <p className="text-xs text-slate-400">Avg Carried</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className={`text-3xl font-bold ${walkerStats.vehicle_incidents > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {walkerStats.vehicle_incidents}
                            </p>
                            <p className="text-xs text-slate-400">Vehicle Issues</p>
                        </div>
                    </div>
                    
                    {/* Grade Distribution */}
                    <div className="flex items-center justify-center space-x-4">
                        {[
                            { grade: 'A', count: walkerStats.excellent_walks, color: 'emerald' },
                            { grade: 'B', count: walkerStats.good_walks, color: 'blue' },
                            { grade: 'C', count: walkerStats.fair_walks, color: 'amber' },
                            { grade: 'F', count: walkerStats.poor_walks, color: 'red' }
                        ].map((item) => (
                            <div key={item.grade} className="text-center">
                                <div className={`w-16 h-16 rounded-xl bg-${item.color}-100 flex items-center justify-center mb-2`}>
                                    <span className={`text-2xl font-bold text-${item.color}-600`}>{item.count}</span>
                                </div>
                                <p className="text-sm font-semibold text-slate-600">Grade {item.grade}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Walk History */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Walk History</h3>
                <div className="space-y-4">
                    {walkHistory.map((walk, i) => {
                        const cheatIssues = getCheatFlags(walk.cheat_flags || 0);
                        const score = walk.quality_score || walk.grade_score || 0;
                        
                        return (
                            <div 
                                key={i} 
                                className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                                    walk.vehicle_detected ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getGradeColor(walk.grade)} flex items-center justify-center shadow-md`}>
                                            <span className="text-2xl font-bold text-white">{walk.grade || '?'}</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">{formatDate(walk.started_at)}</p>
                                            <p className="text-sm text-slate-400">
                                                {formatDuration(walk.duration_seconds)} • {((walk.distance_meters || 0) / 1000).toFixed(2)} km • {walk.stop_count || 0} stops
                                            </p>
                                            {walk.carried_percent > 0 && (
                                                <p className={`text-sm ${walk.carried_percent > 15 ? 'text-orange-500' : 'text-slate-400'}`}>
                                                    Carried: {walk.carried_percent?.toFixed(1)}% {walk.carried_percent > 15 && '⚠️'}
                                                </p>
                                            )}
                                            {cheatIssues.length > 0 && (
                                                <div className="flex gap-2 mt-2">
                                                    {cheatIssues.map((issue, j) => (
                                                        <span key={j} className="inline-flex items-center px-2 py-1 bg-red-100 text-red-600 rounded-lg text-xs">
                                                            {issue.icon} {issue.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-2xl font-bold ${
                                            score >= 70 ? 'text-emerald-500' :
                                            score >= 50 ? 'text-amber-500' : 'text-red-500'
                                        }`}>{score}</p>
                                        <p className="text-xs text-slate-400">Quality Score</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {walkHistory.length === 0 && (
                        <div className="text-center py-12">
                            <span className="text-4xl">🚶</span>
                            <p className="text-slate-400 mt-2">No walks recorded yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Anti-Cheat Info */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">🔍 Anti-Cheat Walk Verification</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 rounded-xl p-4">
                        <span className="text-2xl mb-2 block">✅</span>
                        <p className="font-medium">Actual Walking</p>
                        <p className="text-xs text-white/60">GPS moving + dog active</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                        <span className="text-2xl mb-2 block">🎒</span>
                        <p className="font-medium">Carrying</p>
                        <p className="text-xs text-white/60">GPS moving, dog still (15% OK)</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                        <span className="text-2xl mb-2 block">🚗</span>
                        <p className="font-medium">Vehicle</p>
                        <p className="text-xs text-white/60">Speed &gt;15 km/h = penalty</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                        <span className="text-2xl mb-2 block">⏸️</span>
                        <p className="font-medium">Long Stops</p>
                        <p className="text-xs text-white/60">&gt;5 min stop = penalty</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
