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
    api.get('/last_cancellations?limit=50')
      .then(res => {
        // Backend now handles filtering and limiting
        setData(res.data);
        // Save with timestamp
        localStorage.setItem('lastCancellations', JSON.stringify({
          data: res.data,
          timestamp: Date.now()
        }));
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
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const now = Date.now();
        const fiveMinutesMs = 5 * 60 * 1000;

        setData(cachedData);
        setLoading(false);

        // Only fetch if cache is older than 5 minutes
        if (now - timestamp > fiveMinutesMs) {
          fetchData();
        }
        return;
      } catch (e) {
        console.error('Cache parse error:', e);
      }
    }

    // No cache, fetch immediately
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
