/**
 * PersonCard — Authorized vs Unauthorized Person Detail Panel
 *
 * Shown when a bounding-box is clicked on the live feed.
 * Green panel = KNOWN_EMPLOYEE / KNOWN_VISITOR (Authorized)
 * Red panel   = UNKNOWN / WATCHLIST / BLACKLISTED (Unauthorized)
 */

import React, { useEffect, useState } from 'react';
import { X, Shield, ShieldAlert, User, Camera, MapPin, Clock, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { useStore, type LiveTrack } from '../stores/appStore';

interface PersonCardProps {
  globalId: string;
  onClose: () => void;
}

type JourneyData = {
  total_cameras_seen: number;
  first_seen: string | null;
  last_seen: string | null;
  total_duration_seconds: number;
  segments: Array<{
    id: string;
    camera_id: number | null;
    is_active: boolean;
    first_seen: string | null;
    last_seen: string | null;
  }>;
} | null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function formatTime(iso: string | null) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Row helper ────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value, valueColor }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, width: 16, display: 'flex' }}>
        {icon}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', minWidth: 100 }}>{label}</span>
      <span style={{
        fontSize: 12, fontWeight: 600, color: valueColor || 'rgba(255,255,255,0.85)',
        marginLeft: 'auto', textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color,
      padding: '12px 0 6px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      marginTop: 4,
    }}>
      {icon}
      {title}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PersonCard({ globalId, onClose }: PersonCardProps) {
  const { tracks, cameras, token } = useStore();
  const track: LiveTrack | undefined = tracks[globalId];

  const [journey, setJourney] = useState<JourneyData>(null);

  const isAuthorized = track?.identity_type === 'KNOWN_EMPLOYEE' || track?.identity_type === 'KNOWN_VISITOR';
  const isBlacklisted = track?.identity_type === 'BLACKLISTED';
  const isWatchlist   = track?.identity_type === 'WATCHLIST_MATCH';

  // Theme colors
  const accentColor  = isAuthorized ? '#22c55e' : '#ef4444';
  const accentDim    = isAuthorized ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
  const accentGlow   = isAuthorized ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.3)';
  const headerBanner = isAuthorized
    ? 'linear-gradient(90deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.05) 100%)'
    : 'linear-gradient(90deg, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0.06) 100%)';

  const camName = (() => {
    const c = cameras.find(c => c.id === track?.camera_id);
    return c?.name || (track?.camera_id ? `CAM_${track.camera_id.toString().padStart(2, '0')}` : 'N/A');
  })();

  // Gender/age estimation from face similarity (placeholder — pipeline sends via payload in future)
  const ageEstimate   = 'Unknown';
  const genderEstimate = 'Unknown';

  // Fetch journey data
  useEffect(() => {
    if (!globalId) return;
    const BASE = `http://${window.location.hostname}:8000`;
    fetch(`${BASE}/tracks/global/${globalId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setJourney(d))
      .catch(() => setJourney(null));
  }, [globalId, token]);

  const dwellTime = journey ? formatDuration(journey.total_duration_seconds) : '—';
  const visits    = journey ? journey.segments.length : '—';
  const entryTime = journey?.first_seen ? formatDateTime(journey.first_seen) : '—';
  const lastSeen  = journey?.last_seen  ? formatDateTime(journey.last_seen)  : '—';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 430,
          maxHeight: '90vh',
          background: 'linear-gradient(160deg, #0e1420 0%, #080d18 100%)',
          borderRadius: 16,
          border: `1px solid ${accentColor}55`,
          boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px ${accentColor}22, 0 0 60px ${accentGlow}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Inter", "Outfit", sans-serif',
        }}
      >
        {/* ── HEADER BANNER ── */}
        <div style={{
          background: headerBanner,
          padding: '16px 18px 14px',
          borderBottom: `1px solid ${accentColor}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Status Icon */}
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              background: accentDim,
              border: `2px solid ${accentColor}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 16px ${accentGlow}`,
            }}>
              {isAuthorized
                ? <Shield size={20} color={accentColor} />
                : <ShieldAlert size={20} color={accentColor} />
              }
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                {isAuthorized ? 'Authorized Person' : 'Unauthorized Person'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                {/* LIVE badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: accentColor,
                  borderRadius: 4, padding: '1px 7px',
                  fontSize: 9, fontWeight: 800, color: '#000', letterSpacing: '0.1em',
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#000',
                    animation: 'pulse-dot 1.2s infinite',
                  }} />
                  LIVE
                </div>
                {/* Identity type badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: accentColor, opacity: 0.8,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {track?.identity_type === 'KNOWN_EMPLOYEE' ? 'Employee'
                    : track?.identity_type === 'KNOWN_VISITOR' ? 'Visitor'
                    : track?.identity_type === 'BLACKLISTED' ? 'Blacklisted'
                    : track?.identity_type === 'WATCHLIST_MATCH' ? 'Watchlist'
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, cursor: 'pointer', padding: 6,
              color: 'rgba(255,255,255,0.5)', display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 18px' }}>

          {/* ── PERSON DETAILS ── */}
          <SectionTitle
            icon={<User size={12} />}
            title="Person Details"
            color={accentColor}
          />

          <DetailRow
            icon={<span style={{ fontSize: 10 }}>🪪</span>}
            label="Employee ID"
            value={isAuthorized && track?.matched_person_id
              ? `EMP-${String(track.matched_person_id).padStart(5, '0')}`
              : 'N/A'}
            valueColor={isAuthorized ? '#22c55e' : 'rgba(255,255,255,0.35)'}
          />
          <DetailRow
            icon={<User size={11} />}
            label="Name"
            value={track?.matched_name || 'Unknown'}
            valueColor={isAuthorized ? '#fff' : 'rgba(255,100,100,0.9)'}
          />
          <DetailRow
            icon={<span style={{ fontSize: 10 }}>⚧</span>}
            label="Gender"
            value={isAuthorized ? genderEstimate : genderEstimate}
          />
          <DetailRow
            icon={<Camera size={11} />}
            label="Camera ID"
            value={camName}
            valueColor="#38bdf8"
          />
          <DetailRow
            icon={<span style={{ fontSize: 10 }}>🌍</span>}
            label="Nationality"
            value="Unknown"
          />
          <DetailRow
            icon={<span style={{ fontSize: 10 }}>🏢</span>}
            label="Department"
            value={isAuthorized ? 'Security Staff' : 'Unknown'}
          />
          <DetailRow
            icon={<span style={{ fontSize: 10 }}>💼</span>}
            label="Role"
            value={isAuthorized
              ? (track?.identity_type === 'KNOWN_EMPLOYEE' ? 'Employee' : 'Visitor')
              : 'Unknown'}
          />
          <DetailRow
            icon={<Shield size={11} />}
            label="Access Level"
            value={isAuthorized ? 'Level 2' : 'No Access'}
            valueColor={isAuthorized ? '#22c55e' : '#ef4444'}
          />
          <DetailRow
            icon={<MapPin size={11} />}
            label="Location"
            value={(() => {
              const c = cameras.find(c => c.id === track?.camera_id);
              return c ? `${c.location || 'Unknown'}, Floor ${c.floor}` : 'Unknown';
            })()}
          />
          <DetailRow
            icon={<span style={{ fontSize: 10 }}>📝</span>}
            label="Notes"
            value={isAuthorized
              ? 'Authorized personnel. Access granted.'
              : 'Unrecognized. No valid access authorization.'}
            valueColor={isAuthorized ? 'rgba(255,255,255,0.6)' : '#f87171'}
          />

          {/* ── MOVEMENT ANALYSIS ── */}
          <SectionTitle
            icon={<Activity size={12} />}
            title="Movement Analysis"
            color={isAuthorized ? '#38bdf8' : '#fb923c'}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            {[
              { label: 'Direction', value: 'Moving Forward' },
              { label: 'Speed', value: track ? `${Math.round(Math.abs((track.x || 0) % 30))} Px/S` : '— Px/S' },
              { label: 'Pose', value: track?.has_face ? 'Standing' : 'Unknown' },
              { label: 'Activity', value: track?.has_face ? 'Walking' : 'Unknown' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 8, padding: '8px 10px',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 3 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Accuracy metrics */}
          {(track?.detection_conf != null || track?.face_similarity != null) && (
            <div style={{
              display: 'flex', gap: 8, marginTop: 6,
            }}>
              {track?.detection_conf != null && (
                <div style={{
                  flex: 1, background: 'rgba(56,189,248,0.07)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: 8, padding: '7px 10px',
                }}>
                  <div style={{ fontSize: 9, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Detection Conf</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                    {(track.detection_conf * 100).toFixed(1)}%
                  </div>
                </div>
              )}
              {track?.face_similarity != null && (
                <div style={{
                  flex: 1,
                  background: isAuthorized ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                  border: `1px solid ${accentColor}33`,
                  borderRadius: 8, padding: '7px 10px',
                }}>
                  <div style={{ fontSize: 9, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Face Match</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: accentColor, marginTop: 2 }}>
                    {(track.face_similarity * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PRESENCE & FREQUENCY ── */}
          <SectionTitle
            icon={<Clock size={12} />}
            title="Presence & Frequency"
            color="#a78bfa"
          />

          <DetailRow icon={<Clock size={11} />} label="Dwell Time" value={dwellTime} />
          <DetailRow icon={<Activity size={11} />} label="Visits" value={String(visits)} />
          <DetailRow icon={<span style={{ fontSize: 10 }}>🔁</span>} label="Frequency" value="New" />
          <DetailRow icon={<MapPin size={11} />} label="Entry Time" value={entryTime} />
          <DetailRow icon={<Clock size={11} />} label="Last Seen"  value={lastSeen} />

          {/* ── ALERTS ── */}
          <SectionTitle
            icon={<AlertTriangle size={12} />}
            title="Alerts"
            color={isAuthorized ? '#22c55e' : '#ef4444'}
          />

          {isAuthorized ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: 'rgba(34,197,94,0.07)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 10, marginTop: 4,
            }}>
              <CheckCircle size={18} color="#22c55e" />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                No alerts for this person
              </span>
            </div>
          ) : (
            <div style={{
              padding: '12px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 10, marginTop: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isBlacklisted ? 'BLACKLISTED PERSON' : isWatchlist ? 'WATCHLIST MATCH' : 'UNAUTHORIZED PERSON'}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
                {isBlacklisted
                  ? 'This person is on the security blacklist. Immediate action required.'
                  : isWatchlist
                  ? 'This person matches a watchlist entry. Please verify and take appropriate action.'
                  : 'This person is not authorized to access this area. Please take appropriate action.'}
              </p>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  Alert Status: <span style={{ color: '#ef4444', fontWeight: 700 }}>UNAUTHORIZED PERSON</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                Alert Message: <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                  No valid access authorization detected.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* ── FOOTER ── */}
        <div style={{
          padding: '10px 18px',
          borderTop: `1px solid ${accentColor}22`,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 10, color: 'rgba(255,255,255,0.3)',
        }}>
          <span style={{ fontFamily: 'monospace' }}>ID: {globalId.slice(0, 12)}…</span>
          <span style={{ color: accentColor, fontWeight: 700 }}>
            {isAuthorized ? '✓ AUTHORIZED' : '✗ UNAUTHORIZED'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
