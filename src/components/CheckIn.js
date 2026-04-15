import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import Loader from './Loader';
import './CheckIn.css';

const STATUS_META = {
  checked_in:     { label: 'Checked in',     icon: '✅', cls: 'ci-ok'      },
  wrong_location: { label: 'Wrong location', icon: '⚠️', cls: 'ci-warn'    },
  pending:        { label: 'Pending',         icon: '⏳', cls: 'ci-pending' },
  noshow:         { label: 'No-show',         icon: '❌', cls: 'ci-noshow'  },
};

export default function CheckIn() {
  // ── Panel A: office config ────────────────────────────────────────────────
  const [config, setConfig]         = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg]   = useState(null);

  // ── Panel B: send requests ────────────────────────────────────────────────
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);

  // ── Panel C: live board ───────────────────────────────────────────────────
  const [checkIns, setCheckIns]     = useState([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [manualLoading, setManualLoading] = useState(null);
  const intervalRef = useRef(null);

  // ── Load office config ────────────────────────────────────────────────────
  const fetchConfig = useCallback(() => {
    api.get('/admin/office-config').then(r => {
      setConfig(r.data);
      setConfigForm({
        lat:          r.data.lat,
        lng:          r.data.lng,
        radiusM:      r.data.radiusM,
        openHour:     r.data.openHour,
        openMin:      r.data.openMin,
        deadlineHour: r.data.deadlineHour,
        deadlineMin:  r.data.deadlineMin,
        enableNoshowPenalty:   r.data.enableNoshowPenalty,
      });
    }).catch(console.error);
  }, []);

  // ── Load live board ───────────────────────────────────────────────────────
  const fetchBoard = useCallback(() => {
    api.get('/admin/checkins-today').then(r => {
      setCheckIns(r.data);
      setBoardLoading(false);
    }).catch(err => { console.error(err); setBoardLoading(false); });
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchBoard();
    intervalRef.current = setInterval(fetchBoard, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchConfig, fetchBoard]);

  // ── Save office config ────────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      await api.post('/admin/office-config', configForm);
      setConfigMsg({ type: 'ok', text: 'Config saved.' });
      fetchConfig();
    } catch (err) {
      setConfigMsg({ type: 'err', text: err.response?.data?.message || 'Save failed.' });
    } finally {
      setConfigSaving(false);
    }
  };

  // ── Send check-in requests ────────────────────────────────────────────────
  const handleSendAll = async () => {
    if (!window.confirm('Send check-in request via WhatsApp to all assigned users?')) return;
    setSending(true);
    setSendResult(null);
    try {
      const r = await api.post('/send-checkin-request', { targets: 'all' });
      setSendResult(r.data);
    } catch (err) {
      setSendResult({ error: err.response?.data?.message || 'Send failed.' });
    } finally {
      setSending(false);
    }
  };

  // ── Process no-shows ──────────────────────────────────────────────────────
  const handleProcessNoshow = async () => {
    if (!window.confirm('Process no-shows? Users without a check-in will receive a 2x bad cancellation penalty.')) return;
    setProcessing(true);
    setProcessResult(null);
    try {
      const r = await api.post('/process-noshow');
      setProcessResult(r.data);
      fetchBoard();
    } catch (err) {
      setProcessResult({ error: err.response?.data?.message || 'Process failed.' });
    } finally {
      setProcessing(false);
    }
  };

  // ── Send check-in request to user ────────────────────────────────────────
  const handleSendCheckInRequest = async (entry) => {
    setManualLoading(entry.user_id);
    try {
      await api.post('/admin/send-checkin-to-user', { userId: entry.user_id });
      alert('Check-in request sent!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send check-in request.');
    } finally {
      setManualLoading(null);
    }
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const total    = checkIns.length;
  const checkedIn = checkIns.filter(c => c.status === 'checked_in').length;
  const pct      = total ? Math.round((checkedIn / total) * 100) : 0;
  const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="checkin-page">

      {/* ── Panel A: Office Setup ─────────────────────────────────────── */}
      <div className="ci-card">
        <h2 className="ci-card-title">Office Setup</h2>
        {!config ? <Loader text="Loading config…" /> : (
          <div className="ci-config-grid">
            <div className="ci-config-group">
              <label className="ci-label">Latitude</label>
              <input className="ci-input" type="number" step="0.000001"
                value={configForm.lat ?? ''}
                onChange={e => setConfigForm(f => ({ ...f, lat: e.target.value }))} />
            </div>
            <div className="ci-config-group">
              <label className="ci-label">Longitude</label>
              <input className="ci-input" type="number" step="0.000001"
                value={configForm.lng ?? ''}
                onChange={e => setConfigForm(f => ({ ...f, lng: e.target.value }))} />
            </div>
            <div className="ci-config-group">
              <label className="ci-label">Radius (m)</label>
              <input className="ci-input" type="number"
                value={configForm.radiusM ?? ''}
                onChange={e => setConfigForm(f => ({ ...f, radiusM: e.target.value }))} />
            </div>
            <div className="ci-config-group">
              <label className="ci-label">Window opens</label>
              <div className="ci-time-row">
                <input className="ci-input ci-input-sm" type="number" min="0" max="23"
                  value={configForm.openHour ?? ''}
                  onChange={e => setConfigForm(f => ({ ...f, openHour: e.target.value }))} />
                <span className="ci-colon">:</span>
                <input className="ci-input ci-input-sm" type="number" min="0" max="59"
                  value={configForm.openMin ?? ''}
                  onChange={e => setConfigForm(f => ({ ...f, openMin: e.target.value }))} />
              </div>
            </div>
            <div className="ci-config-group">
              <label className="ci-label">Deadline</label>
              <div className="ci-time-row">
                <input className="ci-input ci-input-sm" type="number" min="0" max="23"
                  value={configForm.deadlineHour ?? ''}
                  onChange={e => setConfigForm(f => ({ ...f, deadlineHour: e.target.value }))} />
                <span className="ci-colon">:</span>
                <input className="ci-input ci-input-sm" type="number" min="0" max="59"
                  value={configForm.deadlineMin ?? ''}
                  onChange={e => setConfigForm(f => ({ ...f, deadlineMin: e.target.value }))} />
              </div>
            </div>
            <div className="ci-config-group ci-config-map">
              <label className="ci-label">Preview</label>
              <a
                className="ci-map-link"
                href={`https://www.google.com/maps?q=${configForm.lat},${configForm.lng}`}
                target="_blank" rel="noopener noreferrer"
              >
                Open in Google Maps ↗
              </a>
            </div>

            <div className="ci-config-group">
              <label className="ci-label">No-Show Penalty</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="enablePenalty"
                  checked={configForm.enableNoshowPenalty ?? true}
                  onChange={e => setConfigForm(f => ({ ...f, enableNoshowPenalty: e.target.checked }))}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="enablePenalty" style={{ cursor: 'pointer', margin: 0 }}>
                  Apply 2x penalty for no-shows
                </label>
              </div>
            </div>

            <div className="ci-config-actions">
              <button className="ci-btn ci-btn-primary" onClick={handleSaveConfig} disabled={configSaving}>
                {configSaving ? 'Saving…' : 'Save Config'}
              </button>
              {configMsg && (
                <span className={`ci-inline-msg ${configMsg.type === 'ok' ? 'ci-ok-text' : 'ci-err-text'}`}>
                  {configMsg.text}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Panel B: Send Requests ────────────────────────────────────── */}
      <div className="ci-card">
        <h2 className="ci-card-title">Send Requests</h2>
        <div className="ci-send-row">
          <button className="ci-btn ci-btn-primary" onClick={handleSendAll} disabled={sending}>
            {sending ? 'Sending…' : '📲 Send Check-in Request to All'}
          </button>
          <button className="ci-btn ci-btn-danger" onClick={handleProcessNoshow} disabled={processing}>
            {processing ? 'Processing…' : '⚠️ Process No-shows'}
          </button>
        </div>

        {sendResult && (
          <div className={`ci-result-box ${sendResult.error ? 'ci-result-err' : 'ci-result-ok'}`}>
            {sendResult.error
              ? sendResult.error
              : `✅ Sent to ${sendResult.sent} user(s). Skipped: ${sendResult.skipped}.`}
          </div>
        )}

        {processResult && (
          <div className={`ci-result-box ${processResult.error ? 'ci-result-err' : 'ci-result-ok'}`}>
            {processResult.error
              ? processResult.error
              : `⚠️ ${processResult.message}`}
            {processResult.processed?.length > 0 && (
              <ul className="ci-noshow-list">
                {processResult.processed.map(p => (
                  <li key={p.user_id}>{p.name} — Slot {p.slot} — {p.penalty}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Panel C: Live Board ───────────────────────────────────────── */}
      <div className="ci-card">
        <div className="ci-board-header">
          <h2 className="ci-card-title" style={{ margin: 0 }}>
            Live Check-in Board
          </h2>
          <div className="ci-board-meta">
            <span className="ci-board-count">{checkedIn} / {total} checked in</span>
            <button className="ci-btn ci-btn-ghost" onClick={fetchBoard}>↺ Refresh</button>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="ci-progress-wrap">
            <div className="ci-progress-bar" style={{ width: `${pct}%`, background: barColor }} />
          </div>
        )}

        {boardLoading ? <Loader text="Loading check-ins…" /> : checkIns.length === 0
          ? <p className="ci-empty">No assigned slots for today.</p>
          : (
            <table className="ci-table">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Distance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map(entry => {
                  const meta = STATUS_META[entry.status] || STATUS_META.pending;
                  return (
                    <tr key={entry.user_id} className={meta.cls}>
                      <td className="ci-td-slot">#{entry.slot_number}</td>
                      <td className="ci-td-name">{entry.name}</td>
                      <td>
                        <span className={`ci-badge ci-badge-${entry.status}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="ci-td-muted">
                        {entry.check_in_time
                          ? new Date(entry.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                          : '—'}
                      </td>
                      <td className="ci-td-muted">
                        {entry.distance_m != null ? `${entry.distance_m}m` : '—'}
                      </td>
                      <td className="ci-td-actions">
                        {entry.status !== 'checked_in' && (
                          <button
                            className="ci-action-btn ci-action-checkin"
                            onClick={() => handleSendCheckInRequest(entry)}
                            disabled={manualLoading === entry.user_id}
                          >
                            {manualLoading === entry.user_id ? '…' : 'Request'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
        <p className="ci-refresh-note">Auto-refreshes every 30 seconds.</p>
      </div>
    </div>
  );
}
