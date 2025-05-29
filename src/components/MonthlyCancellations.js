import React, { useState, useEffect } from 'react';
import './MonthlyCancellations.css';

export default function MonthlyCancellations() {
  const [data, setData] = useState([]);
  const [headerMonth, setHeaderMonth] = useState([]);

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

        // Get the globalized month name in English, then capitalize the first letter
        const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now);
        const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        // Set the month name in the header or in the state to display
        setHeaderMonth(capitalizedMonthName);  // Assuming you have a state for the header like setHeaderMonth



        const filtered = rawData.filter(item => {
          const date = new Date(item.cancellation_month);

          // Convert the date to UTC and extract the month and year in UTC
          const parsedMonth = date.getUTCMonth();  // getUTCMonth gives the month in UTC
          const parsedYear = date.getUTCFullYear();  // getUTCFullYear gives the year in UTC

          return parsedMonth === currentMonth && parsedYear === currentYear;
        });
        setData(filtered);
      })
      .catch(console.error);
  }, []);

  if (!data.length) {
    return <p>Loading last monthly…</p>;
  }

  return (
    <section className="monthly-cancellations-container">
      <div className="monthly-cancellations">
        <header className="status-metric">
          <h2>Monthly Cancellations for {headerMonth} {new Date().getFullYear()}</h2>
        </header>
        <article className="monthly-list">
          <div className="monthly-header">
            <span className="monthly-cancellation-col-user">User</span>
            <span className="monthly-cancellation-col-score tooltip-container">
              Cancellations 🛈
              <span className="tooltip-text">This is the user's new score after canceller</span>
            </span>
            <span className="monthly-cancellation-col-score tooltip-container">
              Possible Score 🛈
              <span className="tooltip-text">This is the user's new score after canceller</span>
            </span>
          </div>
          <ul>
            {data.slice(0, 30).map((canceller, idx) => (
              <li key={idx} className={`monthly-item`}>
                <div className="monthly-info">
                  <span className="col-user">{canceller.name}</span>
                  <span className="col-score">{canceller.cancellation_count}</span>
                  <span className="col-score">{canceller.possible_new_score}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
