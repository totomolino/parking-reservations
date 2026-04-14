import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import './LastCancellations.css';
import { formatTimestamp } from '../utils/dates';
import api from '../api';
import Loader from './Loader';

const LastCancellations = forwardRef(function LastCancellations(props, ref) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/last_cancellations?limit=100')
      .then(res => {
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const filtered = res.data.filter(item =>
          now - new Date(item.cancellation_time).getTime() <= fifteenDaysMs
        );
        setData(filtered);
        localStorage.setItem('lastCancellations', JSON.stringify(filtered));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    // Try loading from cache first
    const cached = localStorage.getItem('lastCancellations');
    if (cached) {
      setData(JSON.parse(cached));
      setLoading(false);
    }

    // Fetch fresh data in background
    fetchData();
  }, [fetchData]);

  useImperativeHandle(ref, () => ({
    refresh: fetchData,
  }), [fetchData]);

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
            <th className="col-center">Score</th>
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
});

export default LastCancellations;
