import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import Location from './Location';
import Assignements from './Assignements';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1 className="logo">ZS Parking App</h1>
          <nav>
            <ul className="nav-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/Assignements">Assignements</Link></li>
              <li><Link to="/dashboard">Cancellations</Link></li>
            </ul>
          </nav>
        </header>

        <main className="App-content">
          <Routes>
            <Route
              path="/"
              element={
                <div className="welcome">
                  <h2>Welcome to the Parking App</h2>
                  <p>Your one-stop solution for parking management.</p>
                </div>
              }
            />
            <Route path="/assignements" element={<Assignements />} />
            <Route path="/location" element={<Location />} />
          </Routes>
        </main>

        <footer className="App-footer">
          <p>&copy; {new Date().getFullYear()} Parking App. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;