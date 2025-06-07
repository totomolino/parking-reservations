import React, { useState, useEffect } from 'react';
import './MonthlyCancellations.css';

export default function MonthlyCancellations() {
  const [data, setData] = useState([]);
  const [dataLastMonth, setDataLastMonth] = useState([]);
  const [headerMonth, setHeaderMonth] = useState('');
  const [headerLastMonth, setHeaderLastMonth] = useState('');
  const [headerLastYear, setHeaderLastYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeMonth, setActiveMonth] = useState('current');

  // Fetch monthly data
  useEffect(() => {
    fetch('https://brief-stable-penguin.ngrok-free.app/monthly_cancellations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    })
      .then(res => res.json())
      .then(rawData => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

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

        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Loading cancellations…</p>;
  }

  const displayData = activeMonth === 'current' ? data : dataLastMonth;
  const displayHeader = activeMonth === 'current' ? headerMonth : headerLastMonth;
  const displayYear = activeMonth === 'current' ? new Date().getFullYear() : headerLastYear;

  return (
    <section className="monthly-cancellations-container">
      <div className="monthly-cancellations">
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
              {displayData.slice(0, 30).map((canceller, idx) => {
                const isHigh = parseInt(canceller.cancellation_count, 10) > 2;
                return (
                  <li
                    key={idx}
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
      </div>
    </section>
  );
}
