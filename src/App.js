import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://18.216.164.92:3000/today_assignments')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
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

  if (loading) return <div className="loader">Loading assignments...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="App">
      <h1>Today's Parking Assignments</h1>
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Name</th>
            <th>Phone</th>
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
              <td>{entry.phone}</td>
              <td>{entry.priority}</td>
              <td>{entry.reservation_timestamp}</td>
              <td>{entry.is_new ? '✅' : '❌'}</td>
              <td>{entry.is_early ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
