import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import Assignements from './components/Assignements';
import Location from './components/Location';
import Home from './components/Home';
import TopCancellers from './components/TopCancellers';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <img src="/zs_logo.png" alt="Logo" className="logo-image" />
          <h1 className="logo">ZS Parking App</h1>
          <nav>
            <ul className="nav-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/assignements">Assignments</Link></li>
              <li><Link to="/top_cancellers">Top Cancellers</Link></li>
            </ul>
          </nav>
        </header>

        <main className="App-content">
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/assignements" element={<Assignements />} />
            <Route path="/location" element={<Location />} />
            <Route path="/top_cancellers" element={<TopCancellers />} />
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