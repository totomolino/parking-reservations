import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';

// Component for the Dashboard (your original code)
function Dashboard() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch parking assignments
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
            <th>Slot</th>
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
              <td>{entry.slot}</td>
              <td>{entry.is_new ? '✅' : '❌'}</td>
              <td>{entry.is_early ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Component for the Location Page
function Location() {
  useEffect(() => {
    // Extract user_id from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');

    if (userId) {
      // Check if the location has already been sent in the current session
      const locationSent = sessionStorage.getItem('locationSent');

      if (!locationSent) {
        // Get the user's location if not already sent
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;

            // Send location data to the API
            fetch(`http://18.216.164.92:3000/save_location?user_id=${userId}&latitude=${latitude}&longitude=${longitude}`, {
              method: 'GET',
            })
            .then(response => response.json())
            .then(data => {
              console.log('Location saved:', data);

              // Mark that location has been sent for the session
              sessionStorage.setItem('locationSent', 'true');
            })
            .catch(error => {
              console.error('Error saving location:', error);
            });
          });
        } else {
          console.log("Geolocation is not supported by this browser.");
        }
      } else {
        console.log("Location has already been sent for this session.");
      }
    }
  }, []);

  return (
    <div className="App">
      <h1>Location Check-in</h1>
      <p>Your location has been sent to the system if you have not checked in already.</p>
    </div>
  );
}

// Main App Component with Router
function App() {
  return (
    <Router>
      <div className="App">
        <nav>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="/location">Check-in Location</Link></li>
          </ul>
        </nav>

        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/location" element={<Location />} />
          <Route path="/" element={<h2>Welcome to the Parking App</h2>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
