import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import Location from './Location'; // Import the Location component
import Dashboard from './Dashboard'; // Import the Dashboard component



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
          <Route path="/location" element={<Location />} /> {/* Add the Location route */}
          <Route path="/" element={<h2>Welcome to the Parking App</h2>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
