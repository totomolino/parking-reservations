// src/components/Roster.js
import React, { useEffect, useState, useMemo } from 'react';
import './Roster.css';

const UPDATE_ENDPOINT =
  'https://prod-126.westus.logic.azure.com:443/workflows/b2d6f475b0de4c0d80a142dcf337d9e6/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=hoJZZgkvY_aMGyVGNUDOMSl5LfIE-imsBBxTw3P8JU4';
const ROSTER_ENDPOINT = 'https://brief-stable-penguin.ngrok-free.app/roster';

function Roster() {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters & sort state
  const [filters, setFilters] = useState({
    name: '',
    phone: '',
    date_of_hire: '',
    priority: '',
    score: '',
    flagged: '',
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'id',
    direction: 'ascending',
  });

  // central data fetch
  const fetchRoster = () => {
    setLoading(true);
    setError(null);

    fetch(ROSTER_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => {
        setRoster(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch roster:', err);
        setError(err.message);
        setLoading(false);
      });
  };

  // initial load
  useEffect(() => {
    fetchRoster();
  }, []);

  // trigger your Power Automate flow, then re-fetch
  const updateRoster = () => {
    fetch(UPDATE_ENDPOINT, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(() => {
        fetchRoster();
      })
      .catch(err => console.error('Update Roster failed:', err));
  };

  // just re-fetch
  const refreshData = () => {
    fetchRoster();
  };

  // handle typing into filter inputs
  const handleFilterChange = e => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // toggle sort config when clicking headers
  const requestSort = key => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return {
          key,
          direction:
            prev.direction === 'ascending' ? 'descending' : 'ascending',
        };
      } else {
        return { key, direction: 'ascending' };
      }
    });
  };

  // apply filters + sort
  const displayedRoster = useMemo(() => {
    let data = [...roster];

    // filters
    data = data.filter(entry => {
      const byName = entry.name
        .toLowerCase()
        .includes(filters.name.toLowerCase());
      const byPhone = entry.phone.includes(filters.phone);
      const byDate = entry.date_of_hire
        .toLowerCase()
        .includes(filters.date_of_hire.toLowerCase());
      const byPriority = String(entry.priority).includes(filters.priority);
      const byScore = String(entry.score).includes(filters.score);
      const byFlagged =
        filters.flagged === ''
          ? true
          : filters.flagged === 'yes'
          ? entry.flagged
          : !entry.flagged;

      return (
        byName && byPhone && byDate && byPriority && byScore && byFlagged
      );
    });

    // sort
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'date_of_hire') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [roster, filters, sortConfig]);

  if (loading) return <p className="loader">Loading Roster…</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div className="Roster-container">
      <div className="Roster-header">
        <h1 className="h1-Roster">Roster</h1>
        <div className="Roster-buttons">
          <button className="refresh-btn" onClick={refreshData}>
            Refresh
          </button>
          <button className="update-roster-btn" onClick={updateRoster}>
            Update Roster
          </button>
        </div>
      </div>

      <table className="Roster-table">
        <thead>
          <tr className="filter-row">
            <th />
            <th>
              <input
                className="filter-input"
                name="name"
                value={filters.name}
                onChange={handleFilterChange}
                placeholder="Filter…"
              />
            </th>
            <th>
              <input
                className="filter-input"
                name="phone"
                value={filters.phone}
                onChange={handleFilterChange}
                placeholder="Filter…"
              />
            </th>
            <th>
              <input
                className="filter-input"
                name="date_of_hire"
                value={filters.date_of_hire}
                onChange={handleFilterChange}
                placeholder="YYYY-MM-DD"
              />
            </th>
            <th>
              <input
                className="filter-input"
                name="priority"
                value={filters.priority}
                onChange={handleFilterChange}
                placeholder="Filter…"
              />
            </th>
            <th>
              <input
                className="filter-input"
                name="score"
                value={filters.score}
                onChange={handleFilterChange}
                placeholder="Filter…"
              />
            </th>
            <th>
              <select
                className="filter-select"
                name="flagged"
                value={filters.flagged}
                onChange={handleFilterChange}
              >
                <option value="">Any</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </th>
          </tr>
          <tr>
            {[
              'id',
              'name',
              'phone',
              'date_of_hire',
              'priority',
              'score',
              'flagged',
            ].map(col => (
              <th key={col} onClick={() => requestSort(col)}>
                {col === 'date_of_hire'
                  ? 'Date of hire'
                  : col.charAt(0).toUpperCase() + col.slice(1)}
                {sortConfig.key === col
                  ? sortConfig.direction === 'ascending'
                    ? ' ▲'
                    : ' ▼'
                  : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayedRoster.map(entry => (
            <tr key={entry.id}>
              <td>{entry.id}</td>
              <td>{entry.name || 'WL'}</td>
              <td>{entry.phone}</td>
              <td>{entry.date_of_hire}</td>
              <td>{entry.priority}</td>
              <td>{entry.score}</td>
              <td>{entry.flagged ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Roster;
