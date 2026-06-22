import React, { useRef, useState, useCallback } from 'react';
import {
  Upload, Play, Download, Trash2, AlertTriangle, CheckCircle2,
  Loader2, Film, Eye, FileVideo, ChevronRight, X, Cpu,
  Activity, Users, ShieldCheck, ShieldOff, RefreshCw,
} from 'lucide-react';
import { useStore } from '../stores/appStore';
import { getApiBaseUrl } from '../config/runtime';

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = 'live' | 'annotate';

interface LiveSession {
  cameraId: number;
  cameraName: string;
  fileName: string;
  startedAt: number;
}

interface AnnotateState {
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  errorMsg?: string;
  fileName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── File Drop Zone ───────────────────────────────────────────────────────────

function FileDropZone({
  onFile,
  disabled,
}: { onFile: (f: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith('.mp4')) onFile(f);
  }, [onFile]);

  return (
    <div
      style={{
        border: `2px dashed ${dragging ? 'var(--orange)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 12,
        padding: '40px 24px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging ? 'rgba(255,107,0,0.06)' : 'rgba(255,255,255,0.02)',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      <FileVideo size={40} style={{ color: 'var(--orange)', marginBottom: 12, opacity: 0.8 }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        Drop an MP4 here
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        or <span style={{ color: 'var(--orange)' }}>click to browse</span> — .mp4 only
      </div>
    </div>
  );
}

// ─── Video Preview Card ───────────────────────────────────────────────────────

function VideoPreviewCard({ file, onClear }: { file: File; onClear: () => void }) {
  const [dur, setDur] = useState<number | null>(null);
  const objUrl = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(objUrl), [objUrl]);

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <video
        src={objUrl}
        style={{ width: 100, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: '#000' }}
        muted
        preload="metadata"
        onLoadedMetadata={e => setDur(e.currentTarget.duration)}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
          <span>{formatSize(file.size)}</span>
          {dur !== null && <span>{formatDuration(dur)}</span>}
          <span style={{ color: 'var(--orange)' }}>MP4</span>
        </div>
      </div>
      <button
        onClick={onClear}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Live Session Card ────────────────────────────────────────────────────────

function LiveSessionCard({
  session,
  tracks,
  onGoToFeeds,
  onStop,
}: {
  session: LiveSession;
  tracks: Record<string, any>;
  onGoToFeeds: () => void;
  onStop: () => void;
}) {
  const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
  const camTracks = Object.values(tracks || {}).filter(
    (t: any) => t.camera_id === session.cameraId && Date.now() / 1000 - t.timestamp < 3
  );
  const authorized = camTracks.filter((t: any) =>
    t.identity_type === 'KNOWN_EMPLOYEE' || t.identity_type === 'KNOWN_VISITOR'
  ).length;
  const unknown = camTracks.length - authorized;

  return (
    <div style={{
      background: 'rgba(34,197,94,0.06)',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 12,
      padding: '18px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>PIPELINE ACTIVE</span>
        </div>
        <button
          onClick={onStop}
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '4px 10px', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Trash2 size={12} /> Stop
        </button>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Camera', value: session.cameraName, icon: <Cpu size={12} /> },
          { label: 'Elapsed', value: formatDuration(elapsed), icon: <Activity size={12} /> },
          { label: 'Live Tracks', value: camTracks.length, icon: <Users size={12} /> },
          { label: 'Authorized', value: authorized, icon: <ShieldCheck size={12} />, good: true },
          { label: 'Unknown', value: unknown, icon: <ShieldOff size={12} />, bad: unknown > 0 },
        ].map(({ label, value, icon, good, bad }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              {icon} {label.toUpperCase()}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: good ? '#4ade80' : bad ? '#f87171' : 'var(--text-primary)' }}>
              {String(value)}
            </div>
          </div>
        ))}
      </div>

      {/* File */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 10px', marginBottom: 14, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        📁 {session.fileName}
      </div>

      <button
        onClick={onGoToFeeds}
        style={{ width: '100%', background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.1) 100%)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8, padding: '10px 16px', color: '#4ade80', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Eye size={14} /> View in Live Feeds <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, label, color = 'var(--orange)' }: { pct: number; label: string; color?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          borderRadius: 999,
          transition: 'width 0.3s ease',
          boxShadow: `0 0 10px ${color}44`,
        }} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideoTestPage() {
  const { tracks, token, setPage, setCameras } = useStore();

  const [mode, setMode] = useState<Mode>('live');

  // Live mode state
  const [liveFile, setLiveFile] = useState<File | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);

  // Annotate mode state
  const [annotateFile, setAnnotateFile] = useState<File | null>(null);
  const [annotateState, setAnnotateState] = useState<AnnotateState>({ status: 'idle', progress: 0 });

  const base = getApiBaseUrl();
  const headers = token && token !== 'demo-token' ? { Authorization: `Bearer ${token}` } : {};

  // ── Live mode: upload + register camera ─────────────────────────────────────
  const handleLiveUpload = async () => {
    if (!liveFile) return;
    setLiveLoading(true);
    setLiveError(null);

    const fd = new FormData();
    fd.append('file', liveFile);

    try {
      const res = await fetch(`${base}/upload-video/`, {
        method: 'POST',
        headers: headers as Record<string, string>,
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');

      setLiveSession({
        cameraId: data.camera_id,
        cameraName: data.camera_name,
        fileName: liveFile.name,
        startedAt: Date.now(),
      });

      // Refresh camera list so the new tile appears in Live Feeds
      const camsRes = await fetch(`${base}/cameras/`, { headers: headers as Record<string, string> });
      if (camsRes.ok) {
        const cams = await camsRes.json();
        if (Array.isArray(cams)) setCameras(cams);
      }
    } catch (e: any) {
      setLiveError(e.message || 'Unknown error');
    } finally {
      setLiveLoading(false);
    }
  };

  // ── Live mode: stop session ──────────────────────────────────────────────────
  const handleLiveStop = async () => {
    if (!liveSession) return;
    try {
      await fetch(`${base}/upload-video/${liveSession.cameraId}`, {
        method: 'DELETE',
        headers: headers as Record<string, string>,
      });
      // Refresh cameras
      const camsRes = await fetch(`${base}/cameras/`, { headers: headers as Record<string, string> });
      if (camsRes.ok) {
        const cams = await camsRes.json();
        if (Array.isArray(cams)) setCameras(cams);
      }
    } catch (e) {
      console.warn('Failed to delete camera:', e);
    }
    setLiveSession(null);
    setLiveFile(null);
  };

  // ── Annotate mode: upload + download ─────────────────────────────────────────
  const handleAnnotateUpload = async () => {
    if (!annotateFile) return;
    setAnnotateState({ status: 'uploading', progress: 10, fileName: annotateFile.name });

    const fd = new FormData();
    fd.append('file', annotateFile);

    try {
      // Fake progress while server processes (actual processing can take 30–120 s)
      let prog = 10;
      const ticker = setInterval(() => {
        prog = Math.min(prog + 3, 88);
        setAnnotateState(prev => ({ ...prev, progress: prog, status: 'processing' }));
      }, 1200);

      setAnnotateState(prev => ({ ...prev, status: 'processing', progress: 15 }));

      const res = await fetch(`${base}/annotate-video/`, {
        method: 'POST',
        headers: headers as Record<string, string>,
        body: fd,
      });

      clearInterval(ticker);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Processing failed' }));
        throw new Error(errData.detail || 'Processing failed');
      }

      setAnnotateState(prev => ({ ...prev, progress: 95, status: 'processing' }));

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename="(.+?)"/);
      a.download = nameMatch?.[1] || `annotated_${annotateFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setAnnotateState({ status: 'done', progress: 100, fileName: annotateFile.name });
    } catch (e: any) {
      setAnnotateState({ status: 'error', progress: 0, errorMsg: e.message || 'Unknown error', fileName: annotateFile?.name });
    }
  };

  return (
    <div
      className="page-content"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}
    >
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 24px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,107,0,0.15)', border: '1px solid var(--orange-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Film size={18} style={{ color: 'var(--orange)' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
              VIDEO TESTING LAB
            </h1>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Upload MP4 files to test AI detection, tracking &amp; identity recognition
            </div>
          </div>
        </div>

        {/* Mode switcher */}
        <div style={{ display: 'flex', gap: 0, marginTop: 18, marginBottom: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {([
            { key: 'live', label: 'Live View', icon: <Play size={13} /> },
            { key: 'annotate', label: 'Annotate & Export', icon: <Download size={13} /> },
          ] as const).map(item => (
            <button
              key={item.key}
              id={`video-test-tab-${item.key}`}
              onClick={() => setMode(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.18s',
                background: mode === item.key ? 'var(--orange)' : 'transparent',
                color: mode === item.key ? '#000' : 'var(--text-secondary)',
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignContent: 'start' }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        {mode === 'live' ? (
          // ─── LIVE VIEW PANEL ────────────────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Card */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Play size={14} style={{ color: 'var(--orange)' }} /> Upload & Watch Live
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                The AI pipeline runs on your video and streams real-time bounding boxes directly to the Live Feeds view — exactly like an RTSP camera.
              </div>

              {!liveSession ? (
                <>
                  {liveFile ? (
                    <div style={{ marginBottom: 14 }}>
                      <VideoPreviewCard file={liveFile} onClear={() => { setLiveFile(null); setLiveError(null); }} />
                    </div>
                  ) : (
                    <div style={{ marginBottom: 14 }}>
                      <FileDropZone onFile={setLiveFile} disabled={liveLoading} />
                    </div>
                  )}

                  {liveError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: '#f87171' }}>
                      <AlertTriangle size={14} /> {liveError}
                    </div>
                  )}

                  <button
                    id="btn-start-live-pipeline"
                    disabled={!liveFile || liveLoading}
                    onClick={handleLiveUpload}
                    style={{
                      width: '100%', padding: '11px 20px', borderRadius: 9,
                      border: 'none', cursor: (!liveFile || liveLoading) ? 'not-allowed' : 'pointer',
                      background: (!liveFile || liveLoading) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--orange) 0%, #ff8c33 100%)',
                      color: (!liveFile || liveLoading) ? 'var(--text-muted)' : '#000',
                      fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      transition: 'all 0.2s',
                    }}
                  >
                    {liveLoading
                      ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Registering Pipeline…</>
                      : <><Upload size={14} /> Start Live Detection</>}
                  </button>
                </>
              ) : (
                <LiveSessionCard
                  session={liveSession}
                  tracks={tracks}
                  onGoToFeeds={() => setPage('live')}
                  onStop={handleLiveStop}
                />
              )}
            </div>

            {/* How it works */}
            <div style={{ background: 'rgba(255,107,0,0.05)', border: '1px solid var(--orange-border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', marginBottom: 10, letterSpacing: '0.08em' }}>HOW IT WORKS</div>
              {[
                ['1', 'Upload', 'Your MP4 is saved to the server and registered as an ACTIVE camera'],
                ['2', 'Auto-Discover', 'The AI pipeline manager picks it up within ~10 seconds'],
                ['3', 'Detect & Track', 'Full pipeline: YOLOv8 → ByteTrack → FaceID → Body ReID → Identity Resolution'],
                ['4', 'See Results', 'Bounding boxes + names appear over the video in Live Feeds, just like RTSP'],
              ].map(([num, title, desc]) => (
                <div key={num} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--orange)', color: '#000', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{num}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        ) : (
          // ─── ANNOTATE & EXPORT PANEL ─────────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} style={{ color: 'var(--teal)' }} /> Annotate & Download
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Process a video offline. Bounding boxes, identity labels, and accuracy metrics are burned directly into each frame. No services need to be running.
              </div>

              {annotateState.status === 'idle' || annotateState.status === 'error' ? (
                <>
                  {annotateFile ? (
                    <div style={{ marginBottom: 14 }}>
                      <VideoPreviewCard file={annotateFile} onClear={() => { setAnnotateFile(null); setAnnotateState({ status: 'idle', progress: 0 }); }} />
                    </div>
                  ) : (
                    <div style={{ marginBottom: 14 }}>
                      <FileDropZone onFile={setAnnotateFile} />
                    </div>
                  )}

                  {annotateState.status === 'error' && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: '#f87171' }}>
                      <AlertTriangle size={14} /> {annotateState.errorMsg}
                      <button
                        onClick={() => setAnnotateState({ status: 'idle', progress: 0 })}
                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  )}

                  <button
                    id="btn-annotate-video"
                    disabled={!annotateFile}
                    onClick={handleAnnotateUpload}
                    style={{
                      width: '100%', padding: '11px 20px', borderRadius: 9,
                      border: 'none', cursor: !annotateFile ? 'not-allowed' : 'pointer',
                      background: !annotateFile ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--teal) 0%, #38bdf8 100%)',
                      color: !annotateFile ? 'var(--text-muted)' : '#000',
                      fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      transition: 'all 0.2s',
                    }}
                  >
                    <Download size={14} /> Process &amp; Download Annotated MP4
                  </button>
                </>
              ) : annotateState.status === 'uploading' || annotateState.status === 'processing' ? (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--teal)', fontSize: 13, fontWeight: 600 }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    {annotateState.status === 'uploading' ? 'Uploading…' : 'Running AI pipeline…'}
                  </div>
                  <ProgressBar
                    pct={annotateState.progress}
                    label={annotateState.status === 'uploading' ? 'Uploading video' : 'Detecting & annotating frames'}
                    color="var(--teal)"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
                    Running: YOLOv8 detection → ByteTrack → FaceID → ArcFace matching → burn annotations. This may take 1–3 min for longer clips.
                  </div>
                </div>
              ) : (
                // done
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <CheckCircle2 size={40} style={{ color: '#4ade80', marginBottom: 10 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>Download Started!</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Your annotated video has been saved to your downloads folder.
                  </div>
                  <button
                    onClick={() => { setAnnotateState({ status: 'idle', progress: 0 }); setAnnotateFile(null); }}
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 20px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Process another video
                  </button>
                </div>
              )}
            </div>

            {/* Annotation legend */}
            <div style={{ background: 'rgba(78,205,196,0.05)', border: '1px solid var(--teal-border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', marginBottom: 12, letterSpacing: '0.08em' }}>ANNOTATION LEGEND</div>
              {[
                { color: '#22c55e', label: 'AUTHORIZED', desc: 'KNOWN_EMPLOYEE or KNOWN_VISITOR — matched from enrolled DB' },
                { color: '#ef4444', label: 'UNAUTHORIZED', desc: 'UNKNOWN — not in any enrolled identity database' },
                { color: '#ef4444', label: 'BLACKLISTED', desc: 'Matched against blacklisted identity' },
              ].map(({ color, label, desc }) => (
                <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Each box shows: <strong style={{ color: 'var(--text-primary)' }}>Name</strong> · <strong style={{ color: 'var(--text-primary)' }}>Det%</strong> (YOLOv8 confidence) · <strong style={{ color: 'var(--text-primary)' }}>Face%</strong> (ArcFace similarity)
              </div>
            </div>
          </div>
        )}

        {/* ── RIGHT PANEL — Info & Stats ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pipeline status */}
          <PipelineStatusCard tracks={tracks} />

          {/* Recent detections for current session if live */}
          {mode === 'live' && liveSession && (
            <RecentDetectionsCard cameraId={liveSession.cameraId} tracks={tracks} />
          )}

          {/* Tips */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.08em' }}>💡 TIPS</div>
            {mode === 'live' ? [
              'Use our existing test videos: SS1.mp4, SS2.mp4, MS1.mp4 etc.',
              'The pipeline auto-discovers the new camera within 10 seconds.',
              'Go to Live Feeds → click the [TEST] camera tile to see live bounding boxes.',
              'Known employees: john, ponniyah, dinesh — green boxes.',
              'Unknown people in the video will show red UNAUTHORIZED boxes.',
            ] : [
              'Annotate mode works without any running services.',
              'Processing time: ~1 min per 30 sec of video on CPU.',
              'The output MP4 has burned-in boxes and is ready to share.',
              'Accuracy metrics (Det%, Face%) are shown on each box.',
              'Use this to compare detection quality across different videos.',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--orange)', flexShrink: 0 }}>›</span> {tip}
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

// ─── Pipeline Status Card ─────────────────────────────────────────────────────

function PipelineStatusCard({ tracks }: { tracks: Record<string, any> }) {
  const now = Date.now() / 1000;
  const activeTracks = Object.values(tracks || {}).filter((t: any) => now - t.timestamp < 3);
  const cameras = [...new Set(activeTracks.map((t: any) => t.camera_id))];
  const authorized = activeTracks.filter((t: any) => t.identity_type === 'KNOWN_EMPLOYEE' || t.identity_type === 'KNOWN_VISITOR').length;
  const unknown = activeTracks.filter((t: any) => t.identity_type === 'UNKNOWN').length;

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>LIVE PIPELINE STATUS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Active Cameras', value: cameras.length, color: 'var(--teal)' },
          { label: 'Total Tracks', value: activeTracks.length, color: 'var(--orange)' },
          { label: 'Authorized', value: authorized, color: '#4ade80' },
          { label: 'Unknown', value: unknown, color: unknown > 0 ? '#f87171' : 'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Detections Card ───────────────────────────────────────────────────

function RecentDetectionsCard({ cameraId, tracks }: { cameraId: number; tracks: Record<string, any> }) {
  const now = Date.now() / 1000;
  const camTracks = Object.values(tracks || {})
    .filter((t: any) => t.camera_id === cameraId && now - t.timestamp < 5)
    .slice(0, 8);

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>
        CURRENT DETECTIONS ({camTracks.length})
      </div>
      {camTracks.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
          Waiting for pipeline to start…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {camTracks.map((t: any) => {
            const authorized = t.identity_type === 'KNOWN_EMPLOYEE' || t.identity_type === 'KNOWN_VISITOR';
            const color = authorized ? '#4ade80' : '#f87171';
            return (
              <div key={t.global_id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {authorized ? (t.matched_name || `Person #${t.track_id}`) : `UNKNOWN #${t.track_id}`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {t.identity_type?.replace('_', ' ')}
                    {t.detection_conf != null && ` · Det ${(t.detection_conf * 100).toFixed(0)}%`}
                    {t.face_similarity != null && ` · Face ${(t.face_similarity * 100).toFixed(0)}%`}
                  </div>
                </div>
                {authorized ? <ShieldCheck size={13} style={{ color }} /> : <ShieldOff size={13} style={{ color }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
