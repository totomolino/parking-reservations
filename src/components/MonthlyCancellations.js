import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import './MonthlyCancellations.css';
import api from '../api';
import Loader from './Loader';

const MonthlyCancellations = forwardRef(function MonthlyCancellations(props, ref) {
  const [data, setData] = useState([]);
  const [dataLastMonth, setDataLastMonth] = useState([]);
  const [headerMonth, setHeaderMonth] = useState('');
  const [headerLastMonth, setHeaderLastMonth] = useState('');
  const [headerLastYear, setHeaderLastYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeMonth, setActiveMonth] = useState('current');

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get('/monthly_cancellations')
      .then(res => {
        const rawData = res.data;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const timestamp = Date.now();

        // Compute last month and its year
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastYear = lastMonthDate.getFullYear();

        // Format month names
        const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now);
        const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        setHeaderMonth(capitalizedMonthName);

        const lastMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(lastMonthDate);
        const capitalizedLastMonthName = lastMonthName.charAt(0).toUpperCase() + lastMonthName.slice(1);
        setHeaderLastMonth(capitalizedLastMonthName);
        setHeaderLastYear(lastYear);

        // Filter current month data
        const filteredCurrent = rawData.filter(item => {
          const date = new Date(item.cancellation_month);
          return date.getUTCMonth() === currentMonth && date.getUTCFullYear() === currentYear;
        });
        setData(filteredCurrent);

        // Filter last month data
        const filteredLast = rawData.filter(item => {
          const date = new Date(item.cancellation_month);
          return date.getUTCMonth() === lastMonth && date.getUTCFullYear() === lastYear;
        });
        setDataLastMonth(filteredLast);

        // Cache the entire state with timestamp
        localStorage.setItem('monthlyCancellations', JSON.stringify({
          current: filteredCurrent,
          last: filteredLast,
          headerMonth: capitalizedMonthName,
          headerLastMonth: capitalizedLastMonthName,
          headerLastYear: lastYear,
          timestamp,
        }));

        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const fiveMinutesMs = 5 * 60 * 1000;
    const now = Date.now();
    let shouldFetch = true;

    // Try loading from cache first
    const cached = localStorage.getItem('monthlyCancellations');
    if (cached) {
      try {
        const { current, last, headerMonth, headerLastMonth, headerLastYear, timestamp } = JSON.parse(cached);
        setData(current);
        setDataLastMonth(last);
        setHeaderMonth(headerMonth);
        setHeaderLastMonth(headerLastMonth);
        setHeaderLastYear(headerLastYear);
        setLoading(false);

        // Only fetch if cache is older than 5 minutes
        if (now - timestamp <= fiveMinutesMs) {
          shouldFetch = false;
        }
      } catch (e) {
        console.error('Cache parse error:', e);
      }
    }

    // Only fetch if cache is older than 5 minutes or missing
    if (shouldFetch) {
      fetchData();
    }
  }, [fetchData]);

  useImperativeHandle(ref, () => ({
    refresh: fetchData,
  }), [fetchData]);

  if (loading) return <Loader text="Loading cancellations…" />;

  const displayData = activeMonth === 'current' ? data : dataLastMonth;
  const displayHeader = activeMonth === 'current' ? headerMonth : headerLastMonth;
  const displayYear = activeMonth === 'current' ? new Date().getFullYear() : headerLastYear;

  return (
    <section className="monthly-cancellations">
        <header className="title">
          <h2 className="card-title">Monthly Cancellations for {displayHeader} {displayYear}</h2>
        </header>

        <div className="buttons">
          <button
            className={activeMonth === 'last' ? 'active' : ''}
            onClick={() => setActiveMonth('last')}
          >
            Last Month
          </button>
          <button
            className={activeMonth === 'current' ? 'active' : ''}
            onClick={() => setActiveMonth('current')}
          >
            Current Month
          </button>
        </div>

        {displayData.length === 0 ? (
          <p>No cancellations yet</p>
        ) : (
          <article className="monthly">
            <div className="monthly-header">
              <span className="monthly-cancellation-col-user">User</span>
              <span className="monthly-cancellation-col-cancellations tooltip-container">
                Cancellations 🛈
                <span className="tooltip-text">This is the user's new score after canceller</span>
              </span>
              <span className="monthly-cancellation-col-score tooltip-container">
                Possible Score 🛈
                <span className="tooltip-text">This is the user's new score after canceller</span>
              </span>
            </div>
            <ul className="monthly-list">
              {displayData.slice(0, 30).map((canceller) => {
                const isHigh = parseInt(canceller.cancellation_count, 10) > 2;
                return (
                  <li
                    key={canceller.user_id}
                    className={`monthly-item ${isHigh ? 'high-cancellation' : ''}`}
                  >
                    <div className="monthly-info">
                      <span className="monthly-cancellation-col-user">{canceller.name}</span>
                      <span className="monthly-cancellation-col-cancellations">{canceller.cancellation_count}</span>
                      <span className="monthly-cancellation-col-score">{canceller.possible_new_score}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        )}
    </section>
  );
});

export default MonthlyCancellations;
