import React, { useEffect, useState } from 'react';
import './Assignements.css';

function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('https://brief-stable-penguin.ngrok-free.app/today_assignments', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAssignments(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch assignments:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const formatTimestamp = (isoString) => {
    const [datePart, timePartWithZ] = isoString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
  
    const timePart = timePartWithZ.replace('Z', '');
    const [hour, minute, second] = timePart.split(':').map((val) => parseInt(val, 10));
  
    // Create the date as if it's already in Argentina time (ignore UTC interpretation)
    const localDate = new Date(year, month - 1, day, hour, minute, second);
  
    return localDate.toLocaleString('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };
  

  if (loading) return <p className="loader">Loading assignments...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div className="assignments-container">
      <h1 className='h1-assignments'>Today's Parking Assignments</h1>
      <table className="assignments-table">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Name</th>
            <th>Priority</th>
            <th>Reservation Time</th>
            <th>New Hire</th>
            <th>Early?</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((entry) => (
            <tr key={entry.reservation_id}>
              <td>{entry.slot || 'WL'}</td>
              <td>{entry.name}</td>
              <td>{entry.priority}</td>
              <td>{formatTimestamp(entry.reservation_timestamp)}</td>
              <td>{entry.is_new ? '✅' : '❌'}</td>
              <td>{entry.is_early ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Assignments;
