import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Camera, User, ArrowRight, X, AlertTriangle, Shield, ChevronDown } from 'lucide-react';
import { useStore, type LiveTrack, type IdentityType } from '../stores/appStore';

interface JourneySegment {
  id: string;
  camera_id: number | null;
  local_track_id: number | null;
  first_seen: string | null;
  last_seen: string | null;
  last_x: number | null;
  last_y: number | null;
  is_active: boolean;
  matched_visitor_id: number | null;
  matched_employee_id: number | null;
}

interface JourneyData {
  global_id: string;
  total_cameras_seen: number;
  first_seen: string | null;
  last_seen: string | null;
  total_duration_seconds: number;
  segments: JourneySegment[];
}

const IDENTITY_STYLES: Record<IdentityType, { color: string; bg: string; icon: string; label: string }> = {
  KNOWN_EMPLOYEE:  { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)',  icon: '👤', label: 'Employee' },
  KNOWN_VISITOR:   { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: '🎫', label: 'Visitor' },
  WATCHLIST_MATCH: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: '⚠️', label: 'Watchlist' },
  BLACKLISTED:     { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)',  icon: '🚫', label: 'Blacklisted' },
  UNKNOWN:         { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', icon: '❓', label: 'Unknown' },
};

interface PersonJourneyProps {
  globalId: string;
  onClose: () => void;
}

export default function PersonJourney({ globalId, onClose }: PersonJourneyProps) {
  const { tracks, cameras, token } = useStore();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get live track data
  const liveTrack: LiveTrack | undefined = tracks[globalId];
  const identityType = liveTrack?.identity_type || 'UNKNOWN';
  const style = IDENTITY_STYLES[identityType];

  useEffect(() => {
    fetchJourney();
  }, [globalId]);

  const fetchJourney = async () => {
    setLoading(true);
    setError(null);
    try {
      const BASE = `http://${window.location.hostname}:8000`;
      const res = await fetch(`${BASE}/tracks/global/${globalId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setJourney(data);
    } catch (err: any) {
      setError('Journey data not available yet');
      setJourney(null);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getCameraName = (camId: number | null) => {
    if (!camId) return 'Unknown Camera';
    const cam = cameras.find(c => c.id === camId);
    return cam?.name || `Camera ${camId}`;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center',
    }}>
      <div style={{
        width: 520, maxHeight: '80vh', background: 'var(--surface-0)',
        borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: style.bg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: style.color + '22', border: `2px solid ${style.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              {style.icon}
            </div>
            <div>
              <div style={{
                fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16,
                color: 'var(--white)',
              }}>
                {liveTrack?.matched_name || 'Unknown Person'}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 100,
                  background: style.color + '33', color: style.color,
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {style.label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {globalId.slice(0, 8)}…
                </span>
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Live Status Bar */}
        {liveTrack && (
          <div style={{
            padding: '12px 24px', background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Camera</div>
              <div style={{ fontSize: 13, color: 'var(--cyan)', fontWeight: 600, marginTop: 2 }}>
                {getCameraName(liveTrack.camera_id)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Position</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: 2 }}>
                ({liveTrack.x}, {liveTrack.y})
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Matched Via</div>
              <div style={{ fontSize: 13, color: 'var(--green-bright)', fontWeight: 600, marginTop: 2, textTransform: 'capitalize' }}>
                {liveTrack.matched_via}
              </div>
            </div>
          </div>
        )}

        {/* Journey Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-ghost)',
            textTransform: 'uppercase', marginBottom: 16,
          }}>
            Cross-Camera Journey
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Loading journey data…
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center', padding: 32, color: 'var(--text-muted)',
              background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
            }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontSize: 13 }}>{error}</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Journey data becomes available once the track is persisted to the database.
              </div>
            </div>
          ) : journey ? (
            <div>
              {/* Summary */}
              <div style={{
                display: 'flex', gap: 16, marginBottom: 20,
                padding: '12px 16px', background: 'var(--surface-2)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cyan)', fontFamily: 'Outfit' }}>
                    {journey.total_cameras_seen}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cameras</div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green-bright)', fontFamily: 'Outfit' }}>
                    {journey.segments.length}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Segments</div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--magenta)', fontFamily: 'Outfit' }}>
                    {formatDuration(journey.total_duration_seconds)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Duration</div>
                </div>
              </div>

              {/* Timeline segments */}
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute', left: 8, top: 0, bottom: 0, width: 2,
                  background: 'linear-gradient(to bottom, var(--cyan), var(--magenta))',
                  borderRadius: 2,
                }} />

                {journey.segments.map((seg, i) => (
                  <div key={seg.id} style={{
                    position: 'relative', marginBottom: 16,
                    padding: '12px 16px', background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: -20, top: 16,
                      width: 12, height: 12, borderRadius: '50%',
                      background: seg.is_active ? 'var(--cyan)' : 'var(--surface-3)',
                      border: '2px solid var(--surface-0)',
                      boxShadow: seg.is_active ? '0 0 8px var(--cyan)' : 'none',
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={14} style={{ color: 'var(--cyan)' }} />
                        <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 13, color: 'var(--white)' }}>
                          {getCameraName(seg.camera_id)}
                        </span>
                      </div>
                      {seg.is_active && (
                        <span className="live-badge" style={{ fontSize: 9, padding: '2px 8px' }}>
                          <span className="live-dot" />LIVE
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)',
                    }}>
                      <span>🕐 {formatTime(seg.first_seen)} → {formatTime(seg.last_seen)}</span>
                      {seg.last_x != null && seg.last_y != null && (
                        <span style={{ fontFamily: 'monospace' }}>📍 ({seg.last_x}, {seg.last_y})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
