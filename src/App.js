import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import ParkingComparison from './components/ParkingComparison';
import Assignements from './components/Assignements';
import Location from './components/Location';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1 className="logo">ZS Parking App</h1>
          <nav>
            <ul className="nav-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/assignements">Assignments</Link></li>
            </ul>
          </nav>
        </header>

        <main className="App-content">
          <Routes>
            <Route path="/" element={<ParkingComparison />} />
            <Route path="/assignements" element={<Assignements />} />
            <Route path="/location" element={<Location />} />
          </Routes>
        </main>

        <footer className="App-footer">
          <p>&copy; {new Date().getFullYear()} ZS Parking App. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;