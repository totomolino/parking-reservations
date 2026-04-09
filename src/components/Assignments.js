import React, { useEffect, useState } from 'react';
import './Assignments.css';
import { formatTimestamp } from '../utils/dates';
import api from '../api';
import Loader from './Loader';

function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/today_assignments')
      .then((res) => {
        setAssignments(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch assignments:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);


  if (loading) return <Loader text="Loading assignments…" />;
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
