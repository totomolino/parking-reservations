import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link, NavLink, useLocation } from 'react-router-dom';
import './App.css';
import Assignments from './components/Assignments';
import Location from './components/Location';
import Home from './components/Home';
import TopCancellers from './components/TopCancellers';
import Roster from './components/Roster';
import Manage from './components/Manage';
import CheckIn from './components/CheckIn';
import CheckinDisplay from './components/CheckinDisplay';
import Insights from './components/Insights';

// Layout with dashboard chrome (header + footer). Standalone routes (e.g. the
// tablet check-in display) render bare, without this chrome.
function Shell() {
  const { pathname } = useLocation();
  const bare = pathname.startsWith('/checkin-display');

  const routes = (
    <Routes>
      <Route path="/" element={<Home/>} />
      <Route path="/assignments" element={<Assignments />} />
      <Route path="/location" element={<Location />} />
      <Route path="/top_cancellers" element={<TopCancellers />} />
      <Route path="/roster" element={<Roster />} />
      <Route path="/manage" element={<Manage />} />
      <Route path="/checkin" element={<CheckIn />} />
      <Route path="/checkin-display/:floorId" element={<CheckinDisplay />} />
      <Route path="/insights" element={<Insights />} />
    </Routes>
  );

  if (bare) return routes;

  return (
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
            <li><NavLink to="/top_cancellers">Compliance</NavLink></li>
            <li><NavLink to="/roster">Roster</NavLink></li>
            <li><NavLink to="/manage">Manage</NavLink></li>
            <li><NavLink to="/checkin">Check-in</NavLink></li>
            <li><NavLink to="/insights">Insights</NavLink></li>
          </ul>
        </nav>
      </header>

      <main className="App-content">
        {routes}
      </main>

      <footer className="App-footer">
        <p>&copy; {new Date().getFullYear()} ZS Parking App. All rights reserved.</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Shell />
    </Router>
  );
}

export default App;
