import React, { useState, useEffect } from 'react';
import './TopCancellers.css';
import api from '../api';
import Loader from './Loader';
import MonthlyCancellations from './MonthlyCancellations';
import LastCancellations from './LastCancellations';

export default function TopCancellers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [penalizing, setPenalizing] = useState(false);
  const [penalizeResult, setPenalizeResult] = useState(null);

  const fetchTopData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/top_cancellers');
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopData();
  }, []);

  const handlePenalize = async () => {
    if (!window.confirm('Run monthly penalty? This will penalize users who exceeded the limit and send WhatsApp notifications.')) {
      return;
    }
    setPenalizing(true);
    setPenalizeResult(null);
    try {
      const r = await api.post('/penalize');
      setPenalizeResult(r.data);
      // Refresh the top cancellers list after penalty run
      fetchTopData();
    } catch (err) {
      setPenalizeResult({ error: err.response?.data?.message || 'Failed to run penalty.' });
    } finally {
      setPenalizing(false);
    }
  };

  if (loading) return <Loader text="Loading cancellations…" />;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div className="cancellations-page">

      {/* ── Panel A: Top Cancellers Table ─────────────────────────────── */}
      <div className="ci-card">
        <h2 className="ci-card-title">Top Cancellers (Last 3 Months)</h2>

        <table className="ci-table">
          <thead>
            <tr>
              <th>User</th>
              <th className="tooltip-container">
                Total 🛈
                <span className="tooltip-text">Total cancellations in the last 3 months</span>
              </th>
              <th className="tooltip-container">
                #Bad 🛈
                <span className="tooltip-text">Cancellations made too close to the reserved date (penalized)</span>
              </th>
              <th className="tooltip-container">
                #Good 🛈
                <span className="tooltip-text">Cancellations made with enough advance notice (not penalized)</span>
              </th>
              <th className="tooltip-container">
                Assigned 🛈
                <span className="tooltip-text">Total parking slots assigned to this user in the period</span>
              </th>
              <th className="tooltip-container">
                Rate 🛈
                <span className="tooltip-text">Cancellations as a percentage of assigned slots</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 30).map((canceller) => (
              <tr key={canceller.user_id}>
                <td>{canceller.user_name}</td>
                <td className="col-center">{canceller.total_cancellations}</td>
                <td className="col-center">{canceller.total_bad}</td>
                <td className="col-center">{canceller.total_good}</td>
                <td className="col-center">{canceller.total_assigned_slots}</td>
                <td className="col-center">{canceller.cancellation_rate_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Admin Actions */}
        <div className="cancel-actions">
          <button
            className="ci-btn ci-btn-danger"
            onClick={handlePenalize}
            disabled={penalizing}
          >
            {penalizing ? 'Processing…' : '⚠️ Run Monthly Penalty'}
          </button>
        </div>

        {/* Penalize Result Display */}
        {penalizeResult && (
          <div className={`ci-result-box ${penalizeResult.error ? 'ci-result-err' : 'ci-result-ok'}`}>
            {penalizeResult.error ? (
              <p>{penalizeResult.error}</p>
            ) : (
              <>
                <p style={{ marginBottom: '1rem' }}>
                  ✅ Penalty run complete. Max allowed next month: {penalizeResult.max_allowed_cancellations_next_month}
                </p>

                {penalizeResult.penalized_users && penalizeResult.penalized_users.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Penalized ({penalizeResult.penalized_users.length}):
                    </strong>
                    <ul className="cancel-result-list">
                      {penalizeResult.penalized_users.map(u => (
                        <li key={u.user_id}>
                          {u.name} — {u.cancellations} cancellations → score {u.new_score}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {penalizeResult.depenalized_users && penalizeResult.depenalized_users.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                      De-penalized ({penalizeResult.depenalized_users.length}):
                    </strong>
                    <ul className="cancel-result-list">
                      {penalizeResult.depenalized_users.map(u => (
                        <li key={u.user_id}>
                          {u.name} → score {u.new_score}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Panel B: Monthly Cancellations ────────────────────────────── */}
      <MonthlyCancellations />

      {/* ── Panel C: Recent Cancellations ─────────────────────────────── */}
      <LastCancellations />

    </div>
  );
}
