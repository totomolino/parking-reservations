import React, { useState, useEffect, useCallback } from 'react';
import './TopCancellers.css';
import api from '../api';
import Loader from './Loader';
import MonthlyCancellations from './MonthlyCancellations';
import LastCancellations from './LastCancellations';

export default function TopCancellers() {
  const [data, setData]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [penalizing, setPenalizing]       = useState(false);
  const [penalizeResult, setPenalizeResult] = useState(null);

  // No-shows
  const [noShows, setNoShows]             = useState([]);
  const [nsLoading, setNsLoading]         = useState(true);
  const [nsThreshold, setNsThreshold]     = useState(3);
  const [banning, setBanning]             = useState({});

  // Blacklist
  const [blacklist, setBlacklist]         = useState([]);
  const [blLoading, setBlLoading]         = useState(true);
  const [unbanning, setUnbanning]         = useState({});

  // Flagged
  const [flagged, setFlagged]             = useState({ flagged: [], to_be_flagged: [] });
  const [flaggedLoading, setFlaggedLoading] = useState(true);

  // ── Cancellations ──────────────────────────────────────────────────────────
  const fetchTopData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/top_cancellers');
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePenalize = async () => {
    if (!window.confirm('Run monthly penalty? This will penalize users who exceeded the limit and send WhatsApp notifications.')) return;
    setPenalizing(true);
    setPenalizeResult(null);
    try {
      const r = await api.post('/penalize');
      setPenalizeResult(r.data);
      fetchTopData();
      fetchFlagged();
    } catch (err) {
      setPenalizeResult({ error: err.response?.data?.message || 'Failed to run penalty.' });
    } finally {
      setPenalizing(false);
    }
  };

  // ── No-shows ───────────────────────────────────────────────────────────────
  const fetchNoShows = useCallback(async () => {
    try {
      setNsLoading(true);
      const res = await api.get('/admin/compliance/no-shows');
      setNoShows(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setNsLoading(false);
    }
  }, []);

  const handleBan = async (userId, name) => {
    if (!window.confirm(`Ban ${name}? They will be completely blocked from the bot.`)) return;
    setBanning(prev => ({ ...prev, [userId]: true }));
    try {
      await api.post(`/admin/blacklist/${userId}`);
      await Promise.all([fetchNoShows(), fetchBlacklist()]);
    } catch (err) {
      alert('Failed to ban user.');
    } finally {
      setBanning(prev => ({ ...prev, [userId]: false }));
    }
  };

  // ── Blacklist ──────────────────────────────────────────────────────────────
  const fetchBlacklist = useCallback(async () => {
    try {
      setBlLoading(true);
      const res = await api.get('/admin/blacklist');
      setBlacklist(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBlLoading(false);
    }
  }, []);

  const handleUnban = async (userId, name) => {
    if (!window.confirm(`Unban ${name}?`)) return;
    setUnbanning(prev => ({ ...prev, [userId]: true }));
    try {
      await api.delete(`/admin/blacklist/${userId}`);
      await Promise.all([fetchNoShows(), fetchBlacklist()]);
    } catch (err) {
      alert('Failed to unban user.');
    } finally {
      setUnbanning(prev => ({ ...prev, [userId]: false }));
    }
  };

  // ── Flagged ────────────────────────────────────────────────────────────────
  const fetchFlagged = useCallback(async () => {
    try {
      setFlaggedLoading(true);
      const res = await api.get('/admin/compliance/flagged');
      setFlagged(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setFlaggedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopData();
    fetchNoShows();
    fetchBlacklist();
    fetchFlagged();
  }, [fetchNoShows, fetchBlacklist, fetchFlagged]);

  const filteredNoShows = noShows.filter(u => u.no_show_count >= nsThreshold);

  if (loading) return <Loader text="Loading compliance data…" />;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div className="cancellations-page">

      {/* ── SECTION 1: No-shows ───────────────────────────────────────────── */}
      <div className="ci-card">
        <h2 className="ci-card-title">No-shows</h2>
        <p className="ci-subtitle">
          Users with parking assignments who had no attendance record. Cross-referenced with last month's cancellations.
        </p>

        <div className="compliance-threshold-row">
          <label className="ci-label">Show users with</label>
          <input
            type="number"
            min={1}
            value={nsThreshold}
            onChange={e => setNsThreshold(Number(e.target.value))}
            className="compliance-threshold-input"
          />
          <label className="ci-label">or more no-shows</label>
        </div>

        {nsLoading ? <Loader text="Loading no-shows…" /> : (
          filteredNoShows.length === 0 ? (
            <p className="ci-empty">No users match this threshold.</p>
          ) : (
            <table className="ci-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="col-center">No-shows</th>
                  <th className="col-center">+2 Cancellations</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredNoShows.map(u => (
                  <tr key={u.user_id} className={u.banned ? 'compliance-row-banned' : ''}>
                    <td>{u.name}</td>
                    <td className="col-center">
                      <span className="compliance-badge compliance-badge-noshow">{u.no_show_count}</span>
                    </td>
                    <td className="col-center">
                      {Number(u.cancellation_count) >= 2
                        ? <span className="compliance-badge compliance-badge-warn">⚠️ {u.cancellation_count}</span>
                        : <span className="ci-muted">—</span>}
                    </td>
                    <td>
                      {u.banned ? (
                        <span className="compliance-badge compliance-badge-banned">Banned</span>
                      ) : (
                        <button
                          className="ci-btn ci-btn-danger ci-btn-sm"
                          onClick={() => handleBan(u.user_id, u.name)}
                          disabled={banning[u.user_id]}
                        >
                          {banning[u.user_id] ? 'Banning…' : '🚫 Ban'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* ── SECTION 2: Blacklist ──────────────────────────────────────────── */}
      <div className="ci-card">
        <h2 className="ci-card-title">Blacklist</h2>
        <p className="ci-subtitle">Users completely blocked from the bot. Only admins can unban.</p>

        {blLoading ? <Loader text="Loading blacklist…" /> : (
          blacklist.length === 0 ? (
            <p className="ci-empty">No users are currently banned.</p>
          ) : (
            <table className="ci-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map(u => (
                  <tr key={u.id} className="compliance-row-banned">
                    <td>{u.name}</td>
                    <td className="ci-muted">{u.phone}</td>
                    <td>
                      <button
                        className="ci-btn ci-btn-ghost ci-btn-sm"
                        onClick={() => handleUnban(u.id, u.name)}
                        disabled={unbanning[u.id]}
                      >
                        {unbanning[u.id] ? 'Unbanning…' : '✅ Unban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* ── SECTION 3: Penalization Status ───────────────────────────────── */}
      <div className="ci-card">
        <h2 className="ci-card-title">Penalization Status</h2>

        <div className="compliance-penalize-header">
          <div>
            <p className="ci-subtitle" style={{ marginBottom: '0.25rem' }}>
              Preview of what happens when you run the monthly penalty.
            </p>
            <p className="compliance-remind">
              📅 Run on the <strong>1st of each month</strong> — penalizes last month's offenders and releases users who had a clean month.
            </p>
          </div>
          <div className="compliance-penalize-actions">
            <button className="ci-btn ci-btn-danger" onClick={handlePenalize} disabled={penalizing}>
              {penalizing ? 'Processing…' : '⚠️ Run Monthly Penalty'}
            </button>
          </div>
        </div>

        {penalizeResult && (
          <div className={`ci-result-box ${penalizeResult.error ? 'ci-result-err' : 'ci-result-ok'}`} style={{ marginBottom: '1rem' }}>
            {penalizeResult.error ? (
              <p>{penalizeResult.error}</p>
            ) : (
              <>
                <p style={{ marginBottom: '0.75rem' }}>
                  ✅ Done. Max allowed next month: <strong>{penalizeResult.max_allowed_cancellations_next_month}</strong>
                </p>
                {penalizeResult.penalized_users?.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Penalized ({penalizeResult.penalized_users.length}):</strong>
                    <ul className="cancel-result-list">
                      {penalizeResult.penalized_users.map(u => (
                        <li key={u.user_id}>{u.name} — {u.cancellations} cancellations → score {u.new_score}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {penalizeResult.depenalized_users?.length > 0 && (
                  <div>
                    <strong>De-penalized ({penalizeResult.depenalized_users.length}):</strong>
                    <ul className="cancel-result-list">
                      {penalizeResult.depenalized_users.map(u => (
                        <li key={u.user_id}>{u.name} → score {u.new_score}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {flaggedLoading ? <Loader text="Loading…" /> : (
          <div className="compliance-flagged-grid">

            <div>
              <h3 className="compliance-flagged-subtitle">
                Will be penalized ({flagged.to_be_flagged?.length ?? 0})
                <span className="compliance-flagged-hint"> — exceeded limit last month</span>
              </h3>
              {!flagged.to_be_flagged?.length ? (
                <p className="ci-empty">None.</p>
              ) : (
                <table className="ci-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th className="col-center">Cancellations</th>
                      <th className="col-center">Score now → after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flagged.to_be_flagged.map(u => (
                      <tr key={u.user_id}>
                        <td>{u.name}</td>
                        <td className="col-center">
                          <span className="compliance-badge compliance-badge-noshow">{u.cancellation_count}</span>
                        </td>
                        <td className="col-center">
                          <span className="compliance-score-arrow">
                            <span className="compliance-badge compliance-badge-ok">{flagged.max_score}</span>
                            {' → '}
                            <span className="compliance-badge compliance-badge-warn">{u.possible_new_score}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 className="compliance-flagged-subtitle">
                Will be released ({flagged.to_be_depenalized?.length ?? 0})
                <span className="compliance-flagged-hint"> — flagged + clean last month</span>
              </h3>
              {!flagged.to_be_depenalized?.length ? (
                <p className="ci-empty">None.</p>
              ) : (
                <table className="ci-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th className="col-center">Score now → after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flagged.to_be_depenalized.map(u => (
                      <tr key={u.user_id}>
                        <td>{u.name}</td>
                        <td className="col-center">
                          <span className="compliance-score-arrow">
                            <span className="compliance-badge compliance-badge-warn">
                              {flagged.flagged.find(f => f.user_id === u.user_id)?.score ?? '?'}
                            </span>
                            {' → '}
                            <span className="compliance-badge compliance-badge-ok">{u.future_score}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Flagged users NOT being released this run */}
              {(() => {
                const releaseIds = new Set((flagged.to_be_depenalized ?? []).map(u => u.user_id));
                const staying = (flagged.flagged ?? []).filter(u => !releaseIds.has(u.user_id));
                if (!staying.length) return null;
                return (
                  <div style={{ marginTop: '1rem' }}>
                    <h3 className="compliance-flagged-subtitle">
                      Still penalized ({staying.length})
                      <span className="compliance-flagged-hint"> — had cancellations this or last month</span>
                    </h3>
                    <table className="ci-table">
                      <thead>
                        <tr><th>User</th><th className="col-center">Score</th></tr>
                      </thead>
                      <tbody>
                        {staying.map(u => (
                          <tr key={u.user_id}>
                            <td>{u.name}</td>
                            <td className="col-center">
                              <span className="compliance-badge compliance-badge-warn">{u.score}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

          </div>
        )}
      </div>

      {/* ── SECTION 4: Cancellations ──────────────────────────────────────── */}
      <div className="ci-card">
        <h2 className="ci-card-title">Cancellations — Top Cancellers (Last 3 Months)</h2>
        <table className="ci-table">
          <thead>
            <tr>
              <th>User</th>
              <th className="tooltip-container">Total 🛈<span className="tooltip-text">Total cancellations in the last 3 months</span></th>
              <th className="tooltip-container">#Bad 🛈<span className="tooltip-text">Cancellations made too close to the reserved date (penalized)</span></th>
              <th className="tooltip-container">#Good 🛈<span className="tooltip-text">Cancellations made with enough advance notice (not penalized)</span></th>
              <th className="tooltip-container">Assigned 🛈<span className="tooltip-text">Total parking slots assigned in the period</span></th>
              <th className="tooltip-container">Rate 🛈<span className="tooltip-text">Cancellations as a percentage of assigned slots</span></th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 30).map((c) => (
              <tr key={c.user_id}>
                <td>{c.user_name}</td>
                <td className="col-center">{c.total_cancellations}</td>
                <td className="col-center">{c.total_bad}</td>
                <td className="col-center">{c.total_good}</td>
                <td className="col-center">{c.total_assigned_slots}</td>
                <td className="col-center">{c.cancellation_rate_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>


        {penalizeResult && (
          <div className={`ci-result-box ${penalizeResult.error ? 'ci-result-err' : 'ci-result-ok'}`}>
            {penalizeResult.error ? (
              <p>{penalizeResult.error}</p>
            ) : (
              <>
                <p style={{ marginBottom: '1rem' }}>
                  ✅ Penalty run complete. Max allowed next month: {penalizeResult.max_allowed_cancellations_next_month}
                </p>
                {penalizeResult.penalized_users?.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Penalized ({penalizeResult.penalized_users.length}):</strong>
                    <ul className="cancel-result-list">
                      {penalizeResult.penalized_users.map(u => (
                        <li key={u.user_id}>{u.name} — {u.cancellations} cancellations → score {u.new_score}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {penalizeResult.depenalized_users?.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>De-penalized ({penalizeResult.depenalized_users.length}):</strong>
                    <ul className="cancel-result-list">
                      {penalizeResult.depenalized_users.map(u => (
                        <li key={u.user_id}>{u.name} → score {u.new_score}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <MonthlyCancellations />
      <LastCancellations />

    </div>
  );
}

