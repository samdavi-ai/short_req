/**
 * PersonDetailModal — COBALT FORGE Design Language
 * Renders a rich full-screen person detail view for both:
 *   • Authorized personnel (employees) — green border, full details
 *   • Visitors (authorized / unauthorized) — adapts color + messaging to status
 *
 * Reference: OpenVisionGuard Aknesys AI Solution person detail panel
 */
import React, { useEffect, useState } from 'react';
import {
  X, Camera, ShieldCheck, ShieldAlert, User, Activity,
  MapPin, Clock, Users, Eye, TrendingUp, AlertTriangle,
  Hash, Globe, Building2, Briefcase, Key, FileText, Trash2
} from 'lucide-react';
import { resolveAssetUrl } from '../config/runtime';
import { useStore } from '../stores/appStore';
import { api } from '../hooks/api';

/* ─────────────────────────────────────────────────── */
/* Types                                               */
/* ─────────────────────────────────────────────────── */
export interface PersonDetailEmployee {
  type: 'employee';
  id: number;
  employee_code: string;
  fullname: string;
  department: string;
  is_active: boolean;
  current_location?: string;
  last_seen?: string;
  break_interval_minutes: number;
  break_duration_minutes: number;
  photo_path?: string;
  // Enriched from tracking
  camera_name?: string;
  camera_id?: number;
  dwell_time?: string;
  visit_count?: number;
  frequency?: string;
  entry_time?: string;
  direction?: string;
  speed?: string;
  pose?: string;
  activity?: string;
  alerts?: string;
  access_level?: string;
}

export interface PersonDetailVisitor {
  type: 'visitor';
  id: number;
  fullname: string;
  passport_number?: string;
  nationality?: string;
  phone_number?: string;
  department?: string;
  role?: string;
  location?: string;
  entry_time?: string;
  exit_time?: string;
  status: 'WHITELISTED' | 'BLACKLISTED' | 'WATCHLIST' | 'PENDING';
  approved_by?: string;
  approver_id?: string;
  purpose?: string;
  requires_escort: boolean;
  photo_path?: string;
  face_embedding_id?: string;
  current_location?: string;
  last_seen?: string;
  // Enriched from tracking
  camera_name?: string;
  camera_id?: number;
  dwell_time?: string;
  visit_count?: number;
  frequency?: string;
  direction?: string;
  speed?: string;
  pose?: string;
  activity?: string;
}

export type PersonDetail = PersonDetailEmployee | PersonDetailVisitor;

/* ─────────────────────────────────────────────────── */
/* Helpers                                             */
/* ─────────────────────────────────────────────────── */

function isAuthorized(p: PersonDetail): boolean {
  if (p.type === 'employee') return p.is_active;
  return p.status === 'WHITELISTED' || p.status === 'PENDING';
}

function getAccessLabel(p: PersonDetail): string {
  if (p.type === 'employee') return p.is_active ? 'Level 2' : 'Suspended';
  if (p.status === 'WHITELISTED') return 'Level 1 — Visitor';
  if (p.status === 'PENDING') return 'Pending Review';
  return 'No Access';
}

function getStatusColor(p: PersonDetail): string {
  if (p.type === 'employee') return p.is_active ? 'var(--green)' : 'var(--red)';
  if (p.status === 'WHITELISTED') return 'var(--green)';
  if (p.status === 'PENDING') return 'var(--amber)';
  return 'var(--red)';
}

function getStatusLabel(p: PersonDetail): string {
  if (p.type === 'employee') return p.is_active ? 'AUTHORIZED' : 'INACTIVE';
  if (p.status === 'WHITELISTED') return 'AUTHORIZED VISITOR';
  if (p.status === 'PENDING') return 'PENDING REVIEW';
  if (p.status === 'WATCHLIST') return 'WATCHLIST ALERT';
  return 'UNAUTHORIZED PERSON';
}

function getBorderColor(p: PersonDetail): string {
  if (isAuthorized(p)) return 'var(--green)';
  if (p.type === 'visitor' && p.status === 'PENDING') return 'var(--amber)';
  return 'var(--red)';
}

function getPhotoSrc(p: PersonDetail): string | undefined {
  if (!p.photo_path) return undefined;
  return resolveAssetUrl(p.photo_path);
}

/* ─────────────────────────────────────────────────── */
/* Sub-components                                      */
/* ─────────────────────────────────────────────────── */

function InfoRow({ label, value, valueColor }: { label: string; value: string | undefined; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{
        width: 100, flexShrink: 0,
        fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-ghost)', letterSpacing: '0.04em',
        textTransform: 'uppercase', paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{
        flex: 1, fontSize: 11, fontFamily: 'var(--font-body)',
        color: valueColor || 'var(--text-primary)', fontWeight: 500,
        wordBreak: 'break-word',
      }}>
        {value || <span style={{ color: 'var(--text-ghost)' }}>N/A</span>}
      </span>
    </div>
  );
}

function SectionHeader({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--orange)', marginBottom: 8,
      paddingBottom: 4, borderBottom: '1px solid var(--orange-border)',
    }}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </div>
  );
}

function MovementTag({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '6px 10px', border: '1px solid var(--border)',
      background: 'var(--bg-elevated)', minWidth: 70,
    }}>
      <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
        {value}
      </span>
    </div>
  );
}

function LiveImagePanel({ person, borderColor }: { person: PersonDetail; borderColor: string }) {
  const photoSrc = getPhotoSrc(person);
  const camLabel = person.camera_name || (person.camera_id ? `CAM_${String(person.camera_id).padStart(2, '0')}` : 'CAM_01');

  return (
    <div style={{ position: 'relative', width: 200, flexShrink: 0 }}>
      {/* Outer frame */}
      <div style={{
        border: `2px solid ${borderColor}`,
        position: 'relative', overflow: 'hidden', background: '#000',
        height: 240,
      }}>
        {/* Corner brackets */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, borderTop: `3px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}`, zIndex: 2 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderTop: `3px solid ${borderColor}`, borderRight: `3px solid ${borderColor}`, zIndex: 2 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 10, height: 10, borderBottom: `3px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}`, zIndex: 2 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderBottom: `3px solid ${borderColor}`, borderRight: `3px solid ${borderColor}`, zIndex: 2 }} />

        {/* LIVE badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 3,
          background: '#FF2244', color: '#fff', fontFamily: 'var(--font-mono)',
          fontSize: 9, fontWeight: 700, padding: '2px 6px', letterSpacing: '0.12em',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
          LIVE
        </div>

        {photoSrc ? (
          <img
            src={photoSrc}
            alt={person.fullname}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-ghost)',
          }}>
            <User size={48} opacity={0.3} />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>NO IMAGE</span>
          </div>
        )}

        {/* Camera label bottom */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(0,0,0,0.75)', padding: '3px 6px', width: 'fit-content',
        }}>
          <Camera size={9} color="var(--text-muted)" />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {camLabel}
          </span>
        </div>
      </div>

      {/* Labels below image */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', width: 70 }}>Live Status</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#FF2244', fontWeight: 700 }}>LIVE</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', width: 70, flexShrink: 0, paddingTop: 1 }}>Live Person Image</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Real-time image of the {person.type === 'employee' ? 'authorized' : isAuthorized(person) ? 'authorized' : 'unauthorized'} person captured by the camera.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', width: 70 }}>Camera</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 700 }}>{camLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/* Main Component                                      */
/* ─────────────────────────────────────────────────── */

interface Props {
  person: PersonDetail;
  onClose: () => void;
}

export function PersonDetailModal({ person, onClose }: Props) {
  const authorized = isAuthorized(person);
  const borderColor = getBorderColor(person);
  const statusColor = getStatusColor(person);
  const statusLabel = getStatusLabel(person);

  const { token, addToast, setEmployees, setVisitors } = useStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Mock presence & movement data (would come from tracking API in prod)
  const dwellTime = person.dwell_time || '2m 14s';
  const visitCount = person.visit_count ?? 1;
  const frequency = person.frequency || 'New';
  const entryTime = person.entry_time || (person.type === 'visitor' ? person.entry_time : undefined) || '29 May 2026, 05:42:31 PM';
  const lastSeen = person.last_seen || '29 May 2026, 05:44:45 PM';
  const direction = person.direction || 'Moving Forward';
  const speed = person.speed || '24 Px/S';
  const pose = person.pose || 'Standing / Walking';
  const activity = person.activity || 'Walking';

  const handleDelete = async () => {
    if (!token) return;
    setIsDeleting(true);
    try {
      if (person.type === 'employee') {
        await api.deleteEmployee(token, person.id);
        const updated = await api.getEmployees(token);
        setEmployees(updated);
        addToast(`Employee "${person.fullname}" deleted successfully`, 'success');
      } else {
        await api.deleteVisitor(token, person.id);
        const updated = await api.getVisitors(token);
        setVisitors(updated);
        addToast(`Visitor "${person.fullname}" deleted successfully`, 'success');
      }
      onClose();
    } catch (err: any) {
      addToast(`Failed to delete record: ${err.message}`, 'error');
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Person Detail: ${person.fullname}`}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(7, 9, 15, 0.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: 24, animation: 'fade-in 0.18s ease-out',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        style={{
          background: 'var(--bg-panel)', border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius)', maxWidth: 920, width: '100%',
          boxShadow: `0 0 48px ${borderColor}22, var(--shadow-lg)`,
          display: 'flex', flexDirection: 'column', position: 'relative',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top header stripe */}
        <div style={{
          background: authorized ? 'rgba(74, 222, 128, 0.06)' : 'rgba(255, 34, 68, 0.06)',
          borderBottom: `1px solid ${borderColor}33`,
          padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {authorized
              ? <ShieldCheck size={16} color="var(--green)" aria-hidden="true" />
              : <ShieldAlert size={16} color="var(--red)" aria-hidden="true" />
            }
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: statusColor,
            }}>
              {person.type === 'employee' ? 'Authorized Person' : authorized ? 'Authorized Visitor' : 'Unauthorized Person'}
            </span>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)',
              color: 'var(--text-ghost)', marginLeft: 4,
            }}>
              ID: {person.type === 'employee' ? person.employee_code : `VIS-${String(person.id).padStart(4, '0')}`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {showConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Confirm delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{
                    background: 'var(--red)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '3px 8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isDeleting}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    padding: '2px 8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '4px',
                  color: '#ef4444',
                  padding: '3px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.border = '1px solid var(--red)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                }}
              >
                <Trash2 size={10} />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-ghost)', display: 'flex', alignItems: 'center', padding: 4,
                transition: 'color var(--t-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-ghost)'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', gap: 0, minHeight: 0 }}>

          {/* ── LEFT: Live Image + Movement Analysis ── */}
          <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LiveImagePanel person={person} borderColor={borderColor} />

            {/* Movement Analysis */}
            <div>
              <SectionHeader label="Movement Analysis" icon={Activity} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <MovementTag label="Direction" value={direction} />
                <MovementTag label="Speed" value={speed} />
                <MovementTag label="Pose" value={pose} />
                <MovementTag label="Activity" value={activity} />
              </div>
            </div>

            {/* Unauthorized warning */}
            {!authorized && (
              <div style={{
                background: 'rgba(255, 34, 68, 0.08)', border: '1px solid var(--red-border)',
                padding: 10, display: 'flex', gap: 6, alignItems: 'flex-start',
              }}>
                <ShieldAlert size={14} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--red)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                    UNAUTHORIZED
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    This person is not authorized to access this area. Please take appropriate action.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── MIDDLE: Person Details ── */}
          <div style={{ flex: 1, borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            {/* Person Details section */}
            <div>
              <SectionHeader label="Person Details" icon={User} />
              {person.type === 'employee' ? (
                <>
                  <InfoRow label="Employee ID" value={person.employee_code} />
                  <InfoRow label="Name" value={person.fullname} />
                  <InfoRow label="Camera ID" value={person.camera_name || (person.camera_id ? `CAM_${String(person.camera_id).padStart(2, '0')}` : 'CAM_01')} />
                  <InfoRow label="Department" value={person.department} />
                  <InfoRow label="Access Level" value={getAccessLabel(person)} valueColor={authorized ? 'var(--teal)' : 'var(--red)'} />
                  <InfoRow label="Location" value={person.current_location || 'Building A, Floor 3'} />
                  <InfoRow label="Notes" value={`${person.department} employee. Break interval: ${person.break_interval_minutes} min.`} />
                </>
              ) : (
                <>
                  <InfoRow label="Employee ID" value="N/A" />
                  <InfoRow label="Name" value={person.status === 'BLACKLISTED' || person.status === 'WATCHLIST' ? 'Unknown' : person.fullname} />
                  <InfoRow label="Gender" value="Unknown" />
                  <InfoRow label="Age Range" value="Approx. 30 - 40" />
                  <InfoRow label="Nationality" value={person.nationality || 'Unknown'} />
                  <InfoRow label="Department" value={person.department || 'Unknown'} />
                  <InfoRow label="Role" value={person.role || 'Unknown'} />
                  <InfoRow
                    label="Access Level"
                    value={getAccessLabel(person)}
                    valueColor={authorized ? 'var(--teal)' : 'var(--red)'}
                  />
                  <InfoRow label="Location" value={person.current_location || (person.location || 'Building B, Floor 1')} />
                  <InfoRow
                    label="Notes"
                    value={
                      authorized
                        ? `Registered visitor. Purpose: ${person.purpose || 'Not specified'}`
                        : 'Unrecognized individual. No valid access authorization.'
                    }
                  />
                </>
              )}
            </div>

            {/* Presence & Frequency section */}
            <div>
              <SectionHeader label="Presence & Frequency" icon={Clock} />
              <InfoRow label="Dwell Time" value={dwellTime} />
              <InfoRow label="Visits" value={String(visitCount)} />
              <InfoRow label="Frequency" value={frequency} />
              <InfoRow label="Entry Time" value={entryTime} />
              <InfoRow label="Last Seen" value={lastSeen} />
            </div>

          </div>

          {/* ── RIGHT: Status + Alerts ── */}
          <div style={{ width: 220, flexShrink: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Quick stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Direction */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Direction</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--orange-bright)' }}>{direction}</div>
              </div>
              {/* Speed */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Speed</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--teal)' }}>{speed}</div>
              </div>
              {/* Pose */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Pose</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)' }}>{pose}</div>
              </div>
              {/* Activity */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Activity</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--lime)' }}>{activity}</div>
              </div>
            </div>

            {/* Alerts section */}
            <div>
              <SectionHeader label="Alerts" icon={ShieldAlert} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 4 }}>Alert Status</div>
                  <div style={{
                    padding: '4px 8px', background: authorized ? 'var(--green-dim)' : 'var(--red-dim)',
                    border: `1px solid ${authorized ? 'var(--green-border)' : 'var(--border-red)'}`,
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    color: authorized ? 'var(--green)' : 'var(--red)', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    {statusLabel}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase', marginBottom: 4 }}>Alert Message</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {authorized
                      ? 'No alerts for this person'
                      : 'No valid access authorization detected.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Presence summary mini tiles */}
            <div>
              <SectionHeader label="Presence & Frequency" icon={TrendingUp} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Dwell Time', value: dwellTime },
                  { label: 'Visits', value: String(visitCount) },
                  { label: 'Frequency', value: frequency },
                  { label: 'Entry Time', value: entryTime.split(' ').slice(0, 2).join(' ') },
                  { label: 'Last Seen', value: lastSeen.split(' ').slice(0, 2).join(' ') },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', textTransform: 'uppercase' }}>{label}</span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.01)',
        }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)', letterSpacing: '0.08em' }}>
            Confidential — Aknesys AI Solution
          </span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--orange)', letterSpacing: '0.08em' }}>
            OpenVisionGuard · SecureWatch v3
          </span>
        </div>
      </div>
    </div>
  );
}

export default PersonDetailModal;
