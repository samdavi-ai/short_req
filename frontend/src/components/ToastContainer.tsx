import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useStore } from '../stores/appStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useStore();

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? XCircle : Info;
        return (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <Icon size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'currentColor', opacity: 0.6, display: 'flex', padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
