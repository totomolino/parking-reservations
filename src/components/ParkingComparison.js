import React, { useState, useEffect } from 'react';
import './ParkingComparison.css';
import api from '../api';
import Loader from './Loader';

export default function ParkingComparison() {
  const [data, setData] = useState({ today: null, yesterday: null });
  const [selected, setSelected] = useState('today');
  const [health, setHealth] = useState(null);
  const [balance, setBalance] = useState(null);

  const buildWhatsAppLink = (phone, message) => {
    const clean = phone.replace(/\D/g, '');
    const text = encodeURIComponent(message);
    return `https://wa.me/${clean}?text=${text}`;
  };

  useEffect(() => {
    Promise.allSettled([
      api.get('/parking-data'),
      api.get('/health'),
      api.get('/twilio-balance'),
    ]).then(([parkingResult, healthResult, balanceResult]) => {
      if (parkingResult.status === 'fulfilled') {
        setData(parkingResult.value.data);
      } else {
        console.error('Parking data fetch failed:', parkingResult.reason);
      }

      if (healthResult.status === 'fulfilled') {
        setHealth(String(healthResult.value.data).trim());
      } else {
        console.error('Health check failed:', healthResult.reason);
        setHealth('FAIL');
      }

      if (balanceResult.status === 'fulfilled') {
        setBalance(`$${balanceResult.value.data.balance}`);
      } else {
        console.error('Twilio balance check failed:', balanceResult.reason);
        setBalance('FAIL');
      }
    });
  }, []);

  if (!data.today || !data.yesterday) {
    return <Loader text="Loading parking data…" />;
  }

  const { today, yesterday } = data;
  const current = selected === 'today' ? today : yesterday;
  const healthClass = health === 'OK' ? 'healthy' : 'unhealthy';

  return (
    <section className="parking-comparison">
        <header className="status-metric">
          <div>
            <strong>System Status: </strong>
            <span className={`health-indicator ${healthClass}`}>{health || '...'}</span>
          </div>
          <span className="twilio-balance" style={{ marginLeft: '1em' }}>
            <strong>Twilio Balance:</strong> {balance || '...'}
          </span>
        </header>

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

        <article className="slots">
          <h3>Parking Slots for {current.parkingDate}</h3>
          <ul className="slots-list">
            {current.parkingSlots.map(slot => (
              <li key={slot.number} className="slot-item">
                <div className="slot-info">
                  <span className="slot-number">Slot {slot.number}</span>
                  <span className={`slot-status ${slot.status}`}>{slot.status}</span>
                  <span className="slot-assigned">{slot.assignedTo}</span>
                </div>

                {selected === 'today' && slot.status !== 'available' && (
                  <a
                    href={buildWhatsAppLink(
                      slot.phone,
                      slot.status === 'assigned'
                        ? `Hello ${slot.assignedTo}, please check in for your parking slot ${slot.number}.`
                        : `Hi, are you going to accept parking slot ${slot.number}?`
                    )}
                    title={
                      slot.status === 'assigned'
                        ? `Hello ${slot.assignedTo}, please check in for your parking slot ${slot.number}.`
                        : `Hi, are you going to accept parking slot ${slot.number}?`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-button"
                  >
                    WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article className="waiting-list">
          <h3>Waiting List</h3>
          {current.waitingList.length ? (
            <ol>
              {current.waitingList.map((person, idx) => (
                <li key={idx}>{person.name}</li>
              ))}
            </ol>
          ) : (
            <p className="no-waiters">No one on the waiting list.</p>
          )}
        </article>

    </section>
  );
}
