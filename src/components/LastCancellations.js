import React, { useState, useEffect } from 'react';
import './LastCancellations.css';
import { formatTimestamp } from '../utils/dates';

export default function LastCancellations() {
  const [data, setData] = useState([]);

  // Fetch cancellations data
  useEffect(() => {
    fetch('https://brief-stable-penguin.ngrok-free.app/last_cancellations', {
      method: 'GET',
      headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      },
    })
      .then(res => res.json())
      .then(fetchedData => {
      const now = Date.now();
      const fourteenDaysMs = 15 * 24 * 60 * 60 * 1000;
      const filtered = fetchedData.filter(item => {
        const cancellationTime = new Date(item.cancellation_time).getTime();
        return now - cancellationTime <= fourteenDaysMs;
      });
      setData(filtered);
      })
      .catch(console.error);
  }, []);

  if (!data.length) {
    return <p>Loading last cancellations…</p>;
  }

  return (
    <section className="last-cancellations-container">
      <div className="last-cancellations">
        <header className="title">
          <h2 className="card-title">Last Cancellations</h2>
        </header>
        <article className="cancellations-list">
          <div className="cancellation-header">
            <span className="col-user">User</span>
            <span className="col-time">Time</span>
            <span className="col-score tooltip-container">
              Score 🛈
              <span className="tooltip-text">This is the user's new score after cancellation</span>
            </span>
            <span className="col-status">Status</span>
          </div>
          <ul>
            {data.map((cancellation, idx) => (
              <li key={idx} className={`cancellation-item ${cancellation.is_bad ? 'bad-cancellation' : 'good-cancellation'}`}>
                <div className="cancellation-info">
                  <span className="col-user">{cancellation.name}</span>
                  <span className="col-time">{formatTimestamp(cancellation.cancellation_time)}</span>
                  <span className="col-score">{cancellation.possible_new_score}</span>
                  <span className={`col-status cancellation-status ${cancellation.is_bad ? 'bad' : 'good'}`}>
                    {cancellation.is_bad ? 'Bad' : 'Good'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
