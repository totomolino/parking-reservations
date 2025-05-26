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
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data.length) {
    return <p>Loading last cancellations…</p>;
  }

  return (
    <section className="last-cancellations">
      <header className="status-metric">
        <h2>Last Cancellations</h2>
      </header>

      <article className="cancellations-list">
        <ul>
          {data.map((cancellation, idx) => (
            <li key={idx} className={`cancellation-item ${cancellation.is_bad ? 'bad-cancellation' : ''}`}>
              <div className="cancellation-info">
                <span className="cancellation-user">{cancellation.name}</span>
                <span className="cancellation-time">{formatTimestamp(cancellation.cancellation_time)}</span>
                <span className={`cancellation-status ${cancellation.is_bad ? 'bad' : 'good'}`}>
                  {cancellation.is_bad ? 'Bad Cancellation' : 'Good Cancellation'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
