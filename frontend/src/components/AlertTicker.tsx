import React, { useState } from 'react';
import { useStore } from '../stores/appStore';

export default function AlertTicker() {
  const alerts = useStore((s) => s.alerts);
  const [dismissed, setDismissed] = useState(false);

  const unackAlerts = alerts.filter((a) => !a.acknowledged);
  const hasAlerts = unackAlerts.length > 0;

  if (dismissed) return null;

  // Build ticker text — duplicated so it scrolls seamlessly
  const tickerItems = hasAlerts
    ? unackAlerts.map((a) =>
        `${a.severity} · ${a.alert_type.replace(/_/g, ' ')} — ${a.description || 'No details'}`
      )
    : ['ALL SYSTEMS OPERATIONAL — NO ACTIVE ALERTS'];

  const tickerText = [...tickerItems, ...tickerItems].join('   ●   ');

  return (
    <div
      className={`alert-ticker-bar${hasAlerts ? '' : ' no-alerts'}`}
      role="marquee"
      aria-label={hasAlerts ? `${unackAlerts.length} active alerts` : 'No active alerts'}
      aria-live="polite"
    >
      {/* Label */}
      <span className="alert-ticker-label" aria-hidden="true">
        {hasAlerts ? `⚠ ALERT FEED` : '✓ STATUS'}
      </span>

      {/* Scrolling track */}
      <div className="alert-ticker-track" aria-hidden="true">
        <div className="alert-ticker-content">
          {tickerText}
        </div>
      </div>

      {/* Close */}
      <button
        className="alert-ticker-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss alert ticker"
        title="Dismiss ticker"
      >
        ×
      </button>
    </div>
  );
}
