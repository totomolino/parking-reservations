import React, { useState, useEffect } from 'react';
import './TopCancellers.css';

export default function TopCancellers() {
  const [data, setData] = useState([]);
  
  // Fetch cancellers data
  useEffect(() => {
    fetch('https://brief-stable-penguin.ngrok-free.app/top_cancellers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    })
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data.length) {
    return <p>Loading last cancellers…</p>;
  }

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
          <span className="tooltip-text">This is the user's new score after canceller</span>
        </span>
                <span className="col-score tooltip-container">
          #Bad 🛈
          <span className="tooltip-text">This is the user's new score after canceller</span>
        </span>
                <span className="col-score tooltip-container">
          #Good 🛈
          <span className="tooltip-text">This is the user's new score after canceller</span>
        </span>
                <span className="col-score tooltip-container">
          Assigned 🛈
          <span className="tooltip-text">This is the user's new score after canceller</span>
        </span>
                <span className="col-score tooltip-container">
          Rate 🛈
          <span className="tooltip-text">This is the user's new score after canceller</span>
        </span>
      </div>
      <ul>
        {data.slice(0,30).map((canceller, idx) => (
          <li key={idx} className={`cancellers-item`}>
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
