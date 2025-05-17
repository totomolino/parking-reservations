import React, { useState, useEffect } from 'react';
import './ParkingComparison.css';

export default function ParkingComparison() {
  const [data, setData] = useState({ today: null, yesterday: null });
  const [selected, setSelected] = useState('yesterday');
  const [health, setHealth] = useState(null);

  // Fetch parking data
  useEffect(() => {
    fetch('https://brief-stable-penguin.ngrok-free.app/parking-data', {
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

  // Fetch health status as text
  useEffect(() => {
    fetch('https://brief-stable-penguin.ngrok-free.app/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    })
      .then(res => res.text())
      .then(text => setHealth(text.trim()))
      .catch(err => {
        console.error('Health check failed:', err);
        setHealth('FAIL');
      });
  }, []);

  if (!data.today || !data.yesterday) {
    return <p>Loading parking assignments…</p>;
  }

  const { today, yesterday } = data;
  const current = selected === 'today' ? today : yesterday;
  const healthClass = health === 'OK' ? 'healthy' : 'unhealthy';

  return (
    <div className="parking-comparison">
      <div className="status-metric">
        <strong>System Status:</strong>{' '}
        {health ? (
          <span className={`health-indicator ${healthClass}`}>{health}</span>
        ) : (
          <span>Loading...</span>
        )}
      </div>

      <div className="buttons">
        <button
          onClick={() => setSelected('yesterday')}
          className={selected === 'yesterday' ? 'active' : ''}
        >
          {yesterday.parkingDate}
        </button>
        <button
          onClick={() => setSelected('today')}
          className={selected === 'today' ? 'active' : ''}
        >
          {today.parkingDate}
        </button>
      </div>

      <h3>Parking Slots for {current.parkingDate}</h3>
      <ul>
        {current.parkingSlots.map((slot) => (
          <li key={slot.number}>
            Slot {slot.number} - {slot.status}{slot.assignedTo ? ` (to ${slot.assignedTo})` : ''}
          </li>
        ))}
      </ul>

      <h3>Waiting List</h3>
      {current.waitingList.length ? (
        <ul>
          {current.waitingList.map((person, idx) => (
            <li key={idx}>{person.name}</li>
          ))}
        </ul>
      ) : (
        <p>No one on the waiting list.</p>
      )}
    </div>
  );
}
