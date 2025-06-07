import React, { useState, useEffect } from 'react';
import './ParkingComparison.css';

export default function ParkingComparison() {
  const [data, setData] = useState({ today: null, yesterday: null });
  const [selected, setSelected] = useState('today');
  const [health, setHealth] = useState(null);
  const [balance, setBalance] = useState(null);

  // Helper to build WhatsApp link
  const buildWhatsAppLink = (phone, message) => {
    const clean = phone.replace(/\D/g, '');
    const text = encodeURIComponent(message);
    return `https://wa.me/${clean}?text=${text}`;
  };

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

  // Fetch Twilio balance using credentials from environment variables
  useEffect(() => {
    console.log(process.env)
    const accountSid = process.env.REACT_APP_TWILIO_ACCOUNT_SID;
    const authToken = process.env.REACT_APP_TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error('Twilio credentials are missing in environment variables.');
      setHealth('NO CREDS');
      return;
    }

    const url = `https://brief-stable-penguin.ngrok-free.app/twilio-balance`;
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };

    fetch(url, { method: 'GET', headers })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch Twilio balance');
        return res.json();
      })
      .then(json => setBalance(`$${json.balance}`))
      .catch(err => {
        console.error('Twilio balance check failed:', err);
        setBalance('FAIL');
      });
  }, []);

  if (!data.today || !data.yesterday) {
    return <p>Loading parking assignments…</p>;
  }

  const { today, yesterday } = data;
  const current = selected === 'today' ? today : yesterday;
  const healthClass = health === 'OK' ? 'healthy' : 'unhealthy';

  return (
    <section className="parking-comparison-container">
      <div className="parking-comparison">
        <header className="status-metric">
          <div >
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

      </div>
    </section>
  );
}
