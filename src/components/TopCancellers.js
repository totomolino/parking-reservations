import React, { useState, useEffect } from 'react';
import './TopCancellers.css';
import api from '../api';
import Loader from './Loader';

export default function TopCancellers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/top_cancellers')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <Loader text="Loading top cancellers…" />;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <section className="top-cancellers">
      <header className="title">
        <h2>Top cancellers (Last 3 months)</h2>
      </header>
      <article className="cancellers-list">
        <div className="cancellers-header">
          <span className="col-user">User</span>
          <span className="col-score tooltip-container">
            Total 🛈
            <span className="tooltip-text">Total cancellations in the last 3 months</span>
          </span>
          <span className="col-score tooltip-container">
            #Bad 🛈
            <span className="tooltip-text">Cancellations made too close to the reserved date (penalized)</span>
          </span>
          <span className="col-score tooltip-container">
            #Good 🛈
            <span className="tooltip-text">Cancellations made with enough advance notice (not penalized)</span>
          </span>
          <span className="col-score tooltip-container">
            Assigned 🛈
            <span className="tooltip-text">Total parking slots assigned to this user in the period</span>
          </span>
          <span className="col-score tooltip-container">
            Rate 🛈
            <span className="tooltip-text">Cancellations as a percentage of assigned slots</span>
          </span>
        </div>
        <ul>
          {data.slice(0, 30).map((canceller) => (
            <li key={canceller.user_id} className="cancellers-item">
              <div className="cancellers-info">
                <span className="col-user">{canceller.user_name}</span>
                <span className="col-score">{canceller.total_cancellations}</span>
                <span className="col-score">{canceller.total_bad}</span>
                <span className="col-score">{canceller.total_good}</span>
                <span className="col-score">{canceller.total_assigned_slots}</span>
                <span className="col-score">{`${canceller.cancellation_rate_pct}%`}</span>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
