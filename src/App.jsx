import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const deviceId = import.meta.env.VITE_DEVICE_ID || 'POPCORN001';

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Utility functions
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

const getActivityEmoji = (activityClass) => {
  const emojis = { 0: '😴', 1: '🧘', 2: '🚶', 3: '🏃', 4: '🎾' };
  return emojis[activityClass] || '❓';
};

const getGradeColor = (grade) => {
  const colors = { A: 'text-green-400', B: 'text-blue-400', C: 'text-yellow-400', F: 'text-red-400' };
  return colors[grade] || 'text-gray-400';
};

const getVerificationColor = (status) => {
  const colors = {
    excellent: 'bg-green-600',
    good: 'bg-blue-600',
    fair: 'bg-yellow-600',
    poor: 'bg-red-600',
    vehicle_detected: 'bg-red-700',
    excess_carrying: 'bg-orange-600'
  };
  return colors[status] || 'bg-gray-600';
};

// Components
function StatCard({ icon, label, value, detail, alert }) {
  return (
    <div className={`rounded-lg p-4 ${alert ? 'bg-red-900/50 border border-red-500' : 'bg-gray-800'}`}>
      <div className="flex items-start space-x-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-lg font-bold text-white">{value}</p>
          {detail && <p className="text-gray-500 text-xs">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

function Header({ status }) {
  const lastSeen = status?.last_seen_at ? new Date(status.last_seen_at) : null;
  const minutesAgo = lastSeen ? Math.floor((Date.now() - lastSeen) / 60000) : null;
  const isOnline = minutesAgo !== null && minutesAgo < 10;
  
  const batteryColor = status?.battery_percent > 50 ? 'text-green-400' : 
                       status?.battery_percent > 20 ? 'text-yellow-400' : 'text-red-400';

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-4xl">🐕</span>
            <div>
              <h1 className="text-2xl font-bold text-white">Popcorn Tracker</h1>
              <p className="text-gray-400 text-sm">v6.1 Anti-Cheat</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${isOnline ? 'bg-green-600' : 'bg-gray-700'}`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-sm text-white">{minutesAgo !== null ? `${minutesAgo}m ago` : 'Offline'}</span>
            </div>

            <div className={`flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded-full ${batteryColor}`}>
              <span>🔋</span>
              <span className="text-sm">{status?.battery_percent || 0}%</span>
            </div>

            {status?.is_escaped ? (
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                🚨 ESCAPED
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
          </div>
        </div>
      </div>
    </header>
  );
}

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
    </nav>
  );
}

// Anti-Cheat Walk Verification Component
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
    <div className="bg-gray-800 rounded-lg p-4 border-2 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
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
          <p className="text-2xl font-bold text-white">{formatDuration(walkDuration)}</p>
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

// Walk History with Anti-Cheat Details
function WalksView({ walks, walkerStats }) {
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
      {/* Walker Performance Summary */}
      {walkerStats && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-4 text-white">📊 Walker Performance (7 Days)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-gray-400 text-xs">Avg Quality</p>
              <p className={`text-3xl font-bold ${walkerStats.avg_quality_score >= 70 ? 'text-green-400' : walkerStats.avg_quality_score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(walkerStats.avg_quality_score || 0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">Total Walks</p>
              <p className="text-3xl font-bold text-white">{walkerStats.total_walks || 0}</p>
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
          <div className="mt-4 flex justify-around">
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

      {/* Walk History */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-bold mb-4 text-white">🚶 Walk History</h2>
        <div className="space-y-3">
          {walks.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No walks recorded yet</p>
          ) : (
            walks.map((walk, i) => {
              const cheatIssues = getCheatFlags(walk.cheat_flags || 0);
              
              return (
                <div key={i} className={`p-4 rounded-lg ${walk.vehicle_detected ? 'bg-red-900/30 border border-red-500' : 'bg-gray-700/50'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white">{formatDate(walk.started_at)}</p>
                      <p className="text-gray-400 text-sm">
                        {formatDuration(walk.duration_seconds)} • 
                        {((walk.distance_meters || 0) / 1000).toFixed(2)} km • 
                        {walk.stop_count || 0} stops
                      </p>
                      
                      {/* Anti-cheat details */}
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
            })
          )}
        </div>
      </div>

      {/* Grading explanation */}
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

// Map View Component
function MapView({ status, locations }) {
  const lat = status?.latitude || 28.5355;
  const lon = status?.longitude || 77.21;

  return (
    <div className="space-y-4">
      {/* Live Walk Verification (only shows during walks) */}
      <WalkVerificationCard status={status} />
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-white">Live Location</h2>
            <p className="text-gray-400 text-xs">Updated: {formatTime(status?.last_seen_at)}</p>
          </div>
          <a 
            href={`https://www.google.com/maps?q=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 px-4 py-2 rounded text-sm text-white hover:bg-blue-700"
          >
            Open in Maps
          </a>
        </div>
        <div className="relative" style={{ height: '350px' }}>
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lon}`}
            style={{ border: 0 }}
          />
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Lat: {lat.toFixed(6)} | Lon: {lon.toFixed(6)}
          </div>
        </div>
      </div>

      {/* Location History */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-bold mb-3 text-white">Location History ({locations.length} points)</h2>
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
            <tbody className="text-white">
              {locations.slice(0, 10).map((loc, i) => (
                <tr key={i} className="border-b border-gray-700/50">
                  <td className="py-2">{formatTime(loc.recorded_at)}</td>
                  <td className="py-2">{getActivityEmoji(loc.activity_class)}</td>
                  <td className="py-2">{loc.speed?.toFixed(1) || 0} km/h</td>
                  <td className="py-2">
                    {loc.is_escaped ? '🚨 Escaped' : loc.is_home ? '🏠 Home' : '🚶 Out'}
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

// Activity View
function ActivityView({ status }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <div className="text-6xl mb-2">{getActivityEmoji(status?.activity_class)}</div>
        <h2 className="text-2xl font-bold capitalize text-white">{status?.activity_name || 'Unknown'}</h2>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-gray-400 text-xs">Today's Steps</p>
            <p className="text-2xl font-bold text-green-400">{status?.today_steps?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Session</p>
            <p className="text-2xl font-bold text-white">{status?.session_steps || 0}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Variance</p>
            <p className="text-2xl font-bold text-white">{status?.accel_variance?.toFixed(4) || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-bold mb-3 text-white">Accelerometer</h2>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="bg-gray-700 rounded p-2">
            <p className="text-gray-400 text-xs">X</p>
            <p className="font-mono text-white">{status?.accel_x?.toFixed(3) || 0}g</p>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <p className="text-gray-400 text-xs">Y</p>
            <p className="font-mono text-white">{status?.accel_y?.toFixed(3) || 0}g</p>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <p className="text-gray-400 text-xs">Z</p>
            <p className="font-mono text-white">{status?.accel_z?.toFixed(3) || 0}g</p>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <p className="text-gray-400 text-xs">Mag</p>
            <p className="font-mono text-white">{status?.accel_magnitude?.toFixed(2) || 0}g</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sleep View
function SleepView({ sleepHistory }) {
  const avgQuality = sleepHistory.length > 0
    ? sleepHistory.reduce((sum, s) => sum + (s.quality_score || 0), 0) / sleepHistory.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-xs">Avg Quality</p>
          <p className="text-3xl font-bold text-blue-400">{avgQuality.toFixed(0)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-xs">Sessions</p>
          <p className="text-3xl font-bold text-white">{sleepHistory.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-xs">Last Night</p>
          <p className="text-3xl font-bold text-green-400">{sleepHistory[0]?.quality_score || '-'}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-bold mb-3 text-white">Sleep History</h2>
        <div className="space-y-2">
          {sleepHistory.map((session, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
              <div>
                <p className="font-bold text-white">{formatDate(session.started_at)}</p>
                <p className="text-gray-400 text-sm">
                  {session.duration_minutes ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m` : '-'}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-bold ${session.quality_score > 80 ? 'text-green-400' : session.quality_score > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {session.quality_score || '-'}
                </p>
                <p className="text-gray-500 text-xs">{session.restless_count || 0} restless</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Health View
function HealthView({ scratchHistory, status }) {
  const totalScratches = scratchHistory.reduce((sum, d) => sum + (d.total_count || 0), 0);
  const avgDaily = scratchHistory.length > 0 ? totalScratches / scratchHistory.length : 0;
  const maxCount = Math.max(...scratchHistory.map(d => d.total_count || 0), 1);

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-bold mb-3 text-white">🐾 Scratch Monitoring</h2>
        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div>
            <p className="text-gray-400 text-xs">Total (7d)</p>
            <p className="text-2xl font-bold text-white">{totalScratches}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Daily Avg</p>
            <p className="text-2xl font-bold text-white">{avgDaily.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Status</p>
            <p className={`text-2xl font-bold ${avgDaily > 15 ? 'text-red-400' : 'text-green-400'}`}>
              {avgDaily > 15 ? '⚠️ High' : '✓ Normal'}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between h-24 gap-1">
          {scratchHistory.slice(0, 7).map((day, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div 
                className={`w-full rounded-t ${(day.total_count || 0) > 15 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ height: `${((day.total_count || 0) / maxCount) * 100}%`, minHeight: '4px' }}
              />
              <p className="text-xs mt-1 text-white">{day.total_count || 0}</p>
              <p className="text-xs text-gray-500">{formatDate(day.date).split(' ')[0]}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 text-center">
        {status?.anomaly_detected ? (
          <>
            <span className="text-4xl">⚠️</span>
            <h3 className="font-bold mt-2 text-yellow-400">Anomaly Detected</h3>
            <p className="text-gray-400 text-sm">{status.anomaly_type}</p>
          </>
        ) : (
          <>
            <span className="text-4xl">✅</span>
            <h3 className="font-bold mt-2 text-green-400">Health Normal</h3>
            <p className="text-gray-400 text-sm">No anomalies detected</p>
          </>
        )}
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [status, setStatus] = useState(null);
  const [locations, setLocations] = useState([]);
  const [sleepHistory, setSleepHistory] = useState([]);
  const [scratchHistory, setScratchHistory] = useState([]);
  const [walks, setWalks] = useState([]);
  const [walkerStats, setWalkerStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch data
  const fetchData = async () => {
    if (!supabase) {
      console.log('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      // Fetch device status
      const { data: statusData } = await supabase
        .from('device_status')
        .select('*')
        .eq('device_id', deviceId)
        .single();
      
      if (statusData) setStatus(statusData);

      // Fetch locations
      const { data: locData } = await supabase
        .from('locations')
        .select('*')
        .eq('device_id', deviceId)
        .order('recorded_at', { ascending: false })
        .limit(50);
      
      if (locData) setLocations(locData);

      // Fetch walks with anti-cheat data
      const { data: walkData } = await supabase
        .from('walk_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .order('started_at', { ascending: false })
        .limit(20);
      
      if (walkData) setWalks(walkData);

      // Calculate walker stats from walks
      if (walkData && walkData.length > 0) {
        const stats = {
          total_walks: walkData.length,
          avg_quality_score: walkData.reduce((sum, w) => sum + (w.quality_score || w.grade_score || 0), 0) / walkData.length,
          excellent_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) >= 90).length,
          good_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) >= 70 && (w.quality_score || w.grade_score || 0) < 90).length,
          fair_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) >= 50 && (w.quality_score || w.grade_score || 0) < 70).length,
          poor_walks: walkData.filter(w => (w.quality_score || w.grade_score || 0) < 50).length,
          total_distance_km: (walkData.reduce((sum, w) => sum + (w.distance_meters || 0), 0) / 1000).toFixed(2),
          avg_carried_percent: walkData.reduce((sum, w) => sum + (w.carried_percent || 0), 0) / walkData.length,
          vehicle_incidents: walkData.filter(w => w.vehicle_detected).length
        };
        setWalkerStats(stats);
      }

      // Fetch sleep
      const { data: sleepData } = await supabase
        .from('sleep_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .order('started_at', { ascending: false })
        .limit(10);
      
      if (sleepData) setSleepHistory(sleepData);

      // Fetch scratches
      const { data: scratchData } = await supabase
        .from('scratch_daily')
        .select('*')
        .eq('device_id', deviceId)
        .order('date', { ascending: false })
        .limit(7);
      
      if (scratchData) setScratchHistory(scratchData);

    } catch (error) {
      console.error('Error fetching data:', error);
    }

    setLoading(false);
  };

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchData();

    // Set up real-time subscription
    if (supabase) {
      const subscription = supabase
        .channel('device_status_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'device_status', filter: `device_id=eq.${deviceId}` },
          (payload) => {
            console.log('Real-time update:', payload);
            setStatus(payload.new);
          }
        )
        .subscribe();

      // Refresh every 30 seconds
      const interval = setInterval(fetchData, 30000);

      return () => {
        subscription.unsubscribe();
        clearInterval(interval);
      };
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🐕</div>
          <p className="text-white text-xl">Loading Popcorn Tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header status={status} />
      
      {/* Escape Alert */}
      {status?.is_escaped && (
        <div className="bg-red-600 py-4 px-4 text-center animate-pulse">
          <div className="text-2xl font-bold text-white">🚨 ESCAPE ALERT 🚨</div>
          <p className="text-white">Popcorn is {Math.round(status.distance_from_home)}m from home!</p>
          <a 
            href={`https://www.google.com/maps?q=${status.latitude},${status.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block bg-white text-red-600 px-4 py-2 rounded font-bold"
          >
            📍 Open in Maps
          </a>
        </div>
      )}
      
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="p-4 max-w-4xl mx-auto">
        {activeTab === 'map' && <MapView status={status} locations={locations} />}
        {activeTab === 'activity' && <ActivityView status={status} />}
        {activeTab === 'sleep' && <SleepView sleepHistory={sleepHistory} />}
        {activeTab === 'health' && <HealthView scratchHistory={scratchHistory} status={status} />}
        {activeTab === 'walks' && <WalksView walks={walks} walkerStats={walkerStats} />}
      </main>
      
      <footer className="text-center py-4 text-gray-500 text-xs">
        Popcorn GPS Collar V6.1 Anti-Cheat • Made with ❤️
      </footer>
    </div>
  );
}
