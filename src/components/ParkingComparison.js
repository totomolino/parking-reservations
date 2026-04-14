import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import './ParkingComparison.css';
import api from '../api';
import Loader from './Loader';

const ParkingComparison = forwardRef(function ParkingComparison(props, ref) {
  const [data, setData] = useState({ today: null, yesterday: null });
  const [selected, setSelected] = useState('today');
  const [health, setHealth] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  const buildWhatsAppLink = (phone, message) => {
    const clean = phone.replace(/\D/g, '');
    const text = encodeURIComponent(message);
    return `https://wa.me/${clean}?text=${text}`;
  };

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.get('/parking-data'),
      api.get('/health'),
      api.get('/twilio-balance'),
    ]).then(([parkingResult, healthResult, balanceResult]) => {
      const now = Date.now();
      if (parkingResult.status === 'fulfilled') {
        const newData = parkingResult.value.data;
        setData(newData);
        localStorage.setItem('parkingData', JSON.stringify({ data: newData, timestamp: now }));
      } else {
        console.error('Parking data fetch failed:', parkingResult.reason);
      }

      if (healthResult.status === 'fulfilled') {
        const healthStr = String(healthResult.value.data).trim();
        setHealth(healthStr);
        localStorage.setItem('parkingHealth', JSON.stringify({ data: healthStr, timestamp: now }));
      } else {
        console.error('Health check failed:', healthResult.reason);
        setHealth('FAIL');
      }

      if (balanceResult.status === 'fulfilled') {
        const balanceStr = `$${balanceResult.value.data.balance}`;
        setBalance(balanceStr);
        localStorage.setItem('parkingBalance', JSON.stringify({ data: balanceStr, timestamp: now }));
      } else {
        console.error('Twilio balance check failed:', balanceResult.reason);
        setBalance('FAIL');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const fiveMinutesMs = 5 * 60 * 1000;
    const now = Date.now();
    let shouldFetch = true;

    // Try loading from cache first
    const cachedData = localStorage.getItem('parkingData');
    const cachedHealth = localStorage.getItem('parkingHealth');
    const cachedBalance = localStorage.getItem('parkingBalance');

    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        setData(data);
        if (now - timestamp <= fiveMinutesMs) shouldFetch = false;
      } catch (e) {}
    }
    if (cachedHealth) {
      try {
        const { data } = JSON.parse(cachedHealth);
        setHealth(data);
      } catch (e) {}
    }
    if (cachedBalance) {
      try {
        const { data } = JSON.parse(cachedBalance);
        setBalance(data);
      } catch (e) {}
    }

    if (!cachedData) {
      setLoading(false);
    }

    // Only fetch if cache is older than 5 minutes or missing
    if (shouldFetch) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [fetchData]);

  useImperativeHandle(ref, () => ({
    refresh: fetchData,
  }), [fetchData]);

  if (!data.today || !data.yesterday) {
    return <Loader text="Loading parking data…" />;
  }

  const { today, yesterday } = data;
  const current = selected === 'today' ? today : yesterday;
  const healthClass = health === 'OK' ? 'healthy' : 'unhealthy';

  return (
    <section className="parking-comparison" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
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
});

export default ParkingComparison;
