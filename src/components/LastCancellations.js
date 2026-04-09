import React, { useState, useEffect } from 'react';
import './LastCancellations.css';
import { formatTimestamp } from '../utils/dates';
import api from '../api';
import Loader from './Loader';

export default function LastCancellations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/last_cancellations')
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

  if (loading) return <Loader text="Loading cancellations…" />;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <section className="last-cancellations">
      <h2 className="card-title">Last Cancellations</h2>
      <table className="lc-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Time</th>
            <th className="tooltip-container col-center">
              Score 🛈
              <span className="tooltip-text">User's score after cancellation</span>
            </th>
            <th className="col-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.cancellation_id} className={c.is_bad ? 'row-bad' : 'row-good'}>
              <td className="td-user">{c.name}</td>
              <td className="td-time">{formatTimestamp(c.cancellation_time)}</td>
              <td className="col-center">{c.possible_new_score}</td>
              <td className="col-center">
                <span className={`lc-badge ${c.is_bad ? 'badge-danger' : 'badge-success'}`}>
                  {c.is_bad ? 'Bad' : 'Good'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
