// =============================================================================
// POPCORN GPS COLLAR - DEBUG VERSION
// =============================================================================
// Minimal version to identify what's crashing
// =============================================================================

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'POPCORN001';

// Create client only if env vars exist
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

export default function App() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            if (!supabase) {
                setError('Supabase not initialized - env vars missing');
                setLoading(false);
                return;
            }

            try {
                const { data, error: fetchError } = await supabase
                    .from('device_status')
                    .select('*')
                    .eq('device_id', DEVICE_ID)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    setError(fetchError.message);
                } else {
                    setStatus(data);
                }
            } catch (e) {
                setError(e.message);
            }
            setLoading(false);
        }

        fetchData();
    }, []);

    // Debug info
    const debugInfo = {
        envUrl: !!SUPABASE_URL,
        envKey: !!SUPABASE_ANON_KEY,
        envDevice: DEVICE_ID,
        supabaseReady: !!supabase,
        timestamp: new Date().toISOString()
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#1a1a2e', 
            color: 'white', 
            padding: '20px',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
                🐕 Popcorn Dashboard - Debug Mode
            </h1>

            {/* Debug Info */}
            <div style={{ 
                backgroundColor: '#16213e', 
                padding: '20px', 
                borderRadius: '10px',
                marginBottom: '20px'
            }}>
                <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>🔍 Debug Info</h2>
                <pre style={{ 
                    backgroundColor: '#0f3460', 
                    padding: '15px', 
                    borderRadius: '5px',
                    overflow: 'auto',
                    fontSize: '12px'
                }}>
{JSON.stringify(debugInfo, null, 2)}
                </pre>
            </div>

            {/* Error Display */}
            {error && (
                <div style={{ 
                    backgroundColor: '#e74c3c', 
                    padding: '20px', 
                    borderRadius: '10px',
                    marginBottom: '20px'
                }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>❌ Error</h2>
                    <p>{error}</p>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div style={{ 
                    backgroundColor: '#3498db', 
                    padding: '20px', 
                    borderRadius: '10px',
                    marginBottom: '20px'
                }}>
                    <p>⏳ Loading data from Supabase...</p>
                </div>
            )}

            {/* Status Display */}
            {!loading && status && (
                <div style={{ 
                    backgroundColor: '#27ae60', 
                    padding: '20px', 
                    borderRadius: '10px',
                    marginBottom: '20px'
                }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>✅ Connected!</h2>
                    <p><strong>Device:</strong> {status.device_id}</p>
                    <p><strong>Battery:</strong> {status.battery_percent}%</p>
                    <p><strong>Activity:</strong> {status.activity_name}</p>
                    <p><strong>Last seen:</strong> {status.last_seen_at}</p>
                </div>
            )}

            {/* No Data State */}
            {!loading && !status && !error && (
                <div style={{ 
                    backgroundColor: '#f39c12', 
                    padding: '20px', 
                    borderRadius: '10px',
                    marginBottom: '20px'
                }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>⚠️ No Device Data</h2>
                    <p>Connected to Supabase but no data found for device: {DEVICE_ID}</p>
                </div>
            )}

            {/* Instructions */}
            <div style={{ 
                backgroundColor: '#16213e', 
                padding: '20px', 
                borderRadius: '10px',
                marginTop: '20px'
            }}>
                <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>📋 Diagnosis</h2>
                <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                    <li><strong>If you see this:</strong> React works! My premium code had bugs.</li>
                    <li><strong>If blank:</strong> Something more fundamental is broken.</li>
                </ul>
            </div>
        </div>
    );
}
