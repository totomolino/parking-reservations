import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link, NavLink } from 'react-router-dom';
import './App.css';
import Assignments from './components/Assignments';
import Location from './components/Location';
import Home from './components/Home';
import TopCancellers from './components/TopCancellers';
import Roster from './components/Roster';
import Manage from './components/Manage';
import CheckIn from './components/CheckIn';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <Link to="/" className="header-brand">
            <img src="/zs_logo.png" alt="Logo" className="logo-image" />
            <h1 className="logo">ZS Parking</h1>
          </Link>
          <nav>
            <ul className="nav-links">
              <li><NavLink to="/" end>Home</NavLink></li>
              <li><NavLink to="/assignments">Assignments</NavLink></li>
              <li><NavLink to="/top_cancellers">Cancellations</NavLink></li>
              <li><NavLink to="/roster">Roster</NavLink></li>
              <li><NavLink to="/manage">Manage</NavLink></li>
              <li><NavLink to="/checkin">Check-in</NavLink></li>
            </ul>
          </nav>
        </header>

        <main className="App-content">
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/location" element={<Location />} />
            <Route path="/top_cancellers" element={<TopCancellers />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/manage" element={<Manage />} />
            <Route path="/checkin" element={<CheckIn />} />
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