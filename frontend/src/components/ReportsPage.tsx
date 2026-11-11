import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import { useStore } from '../stores/appStore';
import { getApiBaseUrl } from '../config/runtime';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  timestamp: string;
}

export default function ReportsPage() {
  const { token } = useStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  useEffect(() => {
    if (token && token !== 'demo-token') {
      loadLogs();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(token as string, 50, 0);
      setLogs(data);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const downloadAuditCsv = () => {
    const url = `${getApiBaseUrl()}/audit/export/audit?month=${month}&token=${token}`;
    window.open(url, '_blank');
  };

  const downloadEmployeesCsv = () => {
    const url = `${getApiBaseUrl()}/audit/export/employees?month=${month}&token=${token}`;
    window.open(url, '_blank');
  };

  const downloadVisitorsCsv = () => {
    const url = `${getApiBaseUrl()}/audit/export/visitors?month=${month}&token=${token}`;
    window.open(url, '_blank');
  };

  const downloadEntryExitCsv = () => {
    const url = `${getApiBaseUrl()}/audit/export/entry_exit?month=${month}&token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-content" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--white)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Reports & Audit
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-body)' }}>
          Download monthly compliance reports and view recent system activity.
        </p>
      </div>

      {/* Export Actions */}
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, color: 'var(--teal)' }}>
          Data Exports
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '0 0 auto' }}>
            <label className="form-label" style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Select Month
            </label>
            <input 
              type="month" 
              value={month} 
              onChange={e => setMonth(e.target.value)}
              className="form-input"
              style={{ width: 200, height: 36 }}
            />
          </div>
          <button 
            onClick={downloadAuditCsv}
            className="btn btn-primary"
            style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}
          >
            <FileSpreadsheet size={16} /> Export Audit Logs
          </button>
          <button 
            onClick={downloadEmployeesCsv}
            className="btn btn-secondary"
            style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}
          >
            <FileSpreadsheet size={16} /> Export Employee Data
          </button>
          <button 
            onClick={downloadVisitorsCsv}
            className="btn btn-secondary"
            style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}
          >
            <FileSpreadsheet size={16} /> Export Visitor Data
          </button>
          <button 
            onClick={downloadEntryExitCsv}
            className="btn btn-secondary"
            style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}
          >
            <FileSpreadsheet size={16} /> Export Entry/Exit Logs
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            Recent Audit Activity
          </h2>
          <button 
            onClick={loadLogs} 
            className="btn btn-secondary btn-sm" 
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 28 }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '200px' }}>Timestamp</th>
                <th style={{ width: '100px' }}>User ID</th>
                <th style={{ width: '150px' }}>Action</th>
                <th style={{ width: '200px' }}>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No recent activity.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>{log.user_id ? `User #${log.user_id}` : '-'}</td>
                    <td>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: 11, 
                        color: log.action.includes('FAIL') ? 'var(--red)' : 'var(--teal)',
                        fontWeight: 600
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {log.resource_type} {log.resource_id ? `#${log.resource_id}` : ''}
                    </td>
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
