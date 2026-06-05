import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Camera, MapPin, ShieldAlert,
  Users, UserCheck, BarChart3, Settings, Search, X,
} from 'lucide-react';
import { useStore } from '../stores/appStore';

interface CmdItem {
  id: string;
  label: string;
  sub: string;
  icon: React.ElementType;
  group: string;
  action: () => void;
  key?: string;
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const setPage = useStore((s) => s.setPage);
  const alerts = useStore((s) => s.alerts);
  const cameras = useStore((s) => s.cameras);

  const NAV_ITEMS: CmdItem[] = [
    { id: 'dashboard',  label: 'Dashboard',     sub: 'Operations overview',       icon: LayoutDashboard, group: 'Pages', action: () => setPage('dashboard'),  key: 'G D' },
    { id: 'live',       label: 'Live Feeds',    sub: 'Camera feed viewer',         icon: Camera,          group: 'Pages', action: () => setPage('live'),       key: 'G L' },
    { id: 'layout',     label: 'Layout Editor', sub: 'Floor plan & zone editor',   icon: MapPin,          group: 'Pages', action: () => setPage('layout'),     key: 'G E' },
    { id: 'alerts',     label: 'Alerts',        sub: 'Alert management',           icon: ShieldAlert,     group: 'Pages', action: () => setPage('alerts'),     key: 'G A' },
    { id: 'visitors',   label: 'Visitors',      sub: 'Visitor records & watchlist',icon: Users,           group: 'Pages', action: () => setPage('visitors'),   key: 'G V' },
    { id: 'employees',  label: 'Employees',     sub: 'Staff monitoring & breaks',  icon: UserCheck,       group: 'Pages', action: () => setPage('employees'),  key: 'G M' },
    { id: 'analytics',  label: 'Analytics',     sub: 'Reports & intelligence',     icon: BarChart3,       group: 'Pages', action: () => setPage('analytics'),  key: 'G I' },
    { id: 'cameras',    label: 'Cameras',       sub: 'Camera management',          icon: Camera,          group: 'Pages', action: () => setPage('cameras'),    key: 'G C' },
    { id: 'settings',   label: 'Settings',      sub: 'System configuration',       icon: Settings,        group: 'Pages', action: () => setPage('settings'),   key: 'G S' },
  ];

  const alertItems: CmdItem[] = alerts
    .filter((a) => !a.acknowledged)
    .slice(0, 5)
    .map((a) => ({
      id: `alert-${a.id}`,
      label: a.alert_type.replace(/_/g, ' '),
      sub: a.description || `Severity: ${a.severity}`,
      icon: ShieldAlert,
      group: 'Unacknowledged Alerts',
      action: () => setPage('alerts'),
    }));

  const cameraItems: CmdItem[] = cameras.slice(0, 5).map((c) => ({
    id: `cam-${c.id}`,
    label: c.name,
    sub: `${c.status} · Floor ${c.floor} · ${c.location}`,
    icon: Camera,
    group: 'Cameras',
    action: () => setPage('cameras'),
  }));

  const allItems = [...NAV_ITEMS, ...alertItems, ...cameraItems];

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.sub.toLowerCase().includes(query.toLowerCase()) ||
          item.group.toLowerCase().includes(query.toLowerCase()),
      )
    : NAV_ITEMS; // default: show nav pages only

  const groups = [...new Set(filtered.map((i) => i.group))];

  const runSelected = useCallback(() => {
    const item = filtered[selected];
    if (item) {
      item.action();
      onClose();
    }
  }, [filtered, selected, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runSelected();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, selected, runSelected, onClose]);

  // Reset selection on query change
  useEffect(() => setSelected(0), [query]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  let itemIdx = -1;

  return (
    <div
      className="cmd-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="cmd-palette"
        onClick={(e) => e.stopPropagation()}
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
        aria-controls="cmd-results"
      >
        {/* Header */}
        <div className="cmd-header">
          <Search size={15} className="cmd-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search pages, cameras, alerts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search command palette"
            aria-autocomplete="list"
            aria-controls="cmd-results"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', display: 'flex', padding: 4 }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          <span className="cmd-hint">ESC to close</span>
        </div>

        {/* Results */}
        <div className="cmd-results" id="cmd-results" role="listbox" aria-label="Search results">
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map((group) => (
              <div key={group}>
                <div className="cmd-group-label" aria-hidden="true">{group}</div>
                {filtered
                  .filter((i) => i.group === group)
                  .map((item) => {
                    itemIdx++;
                    const idx = itemIdx;
                    const Icon = item.icon;
                    const isSelected = selected === idx;
                    return (
                      <div
                        key={item.id}
                        className={`cmd-result${isSelected ? ' selected' : ''}`}
                        onClick={() => { item.action(); onClose(); }}
                        onMouseEnter={() => setSelected(idx)}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        id={`cmd-item-${item.id}`}
                      >
                        <div className="cmd-result-icon">
                          <Icon size={14} aria-hidden="true" />
                        </div>
                        <div className="cmd-result-text">
                          <div className="cmd-result-name">{item.label}</div>
                          <div className="cmd-result-sub">{item.sub}</div>
                        </div>
                        {item.key && (
                          <span className="cmd-result-key" aria-label={`Shortcut: ${item.key}`}>
                            {item.key}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="cmd-footer" aria-hidden="true">
          <div className="cmd-footer-hint">
            <span className="cmd-key">↑↓</span> navigate
          </div>
          <div className="cmd-footer-hint">
            <span className="cmd-key">↵</span> open
          </div>
          <div className="cmd-footer-hint">
            <span className="cmd-key">ESC</span> close
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.06em' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
