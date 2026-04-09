import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import './AssignModal.css';

export default function AssignModal({ slot, onClose, onAssigned }) {
  const [query, setQuery]       = useState('');
  const [roster, setRoster]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notify, setNotify]     = useState(true);
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef(null);

  // Load roster once
  useEffect(() => {
    api.get('/roster').then(r => setRoster(r.data)).catch(console.error);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Filter as user types
  useEffect(() => {
    if (!query.trim()) { setFiltered([]); return; }
    const q = query.toLowerCase();
    setFiltered(roster.filter(u => u.name.toLowerCase().includes(q)).slice(0, 8));
  }, [query, roster]);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await api.post('/admin/assign', { slotNumber: slot.number, userId: selected.id, notify });
      onAssigned();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Assign Slot {slot.number}</h3>

        {slot.status !== 'available' && (
          <p className="modal-warning">
            Currently: <strong>{slot.assignedTo}</strong> — will be replaced.
          </p>
        )}

        <div className="modal-search">
          <input
            ref={inputRef}
            className="modal-input"
            placeholder="Search by name…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); }}
          />
          {filtered.length > 0 && (
            <ul className="modal-suggestions">
              {filtered.map(u => (
                <li
                  key={u.id}
                  className={`modal-suggestion-item ${selected?.id === u.id ? 'selected' : ''}`}
                  onClick={() => { setSelected(u); setQuery(u.name); setFiltered([]); }}
                >
                  <span className="sug-name">{u.name}</span>
                  <span className="sug-meta">P{u.priority} · score {u.score}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="modal-notify-label">
          <input
            type="checkbox"
            checked={notify}
            onChange={e => setNotify(e.target.checked)}
          />
          Notify user via WhatsApp
        </label>

        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="modal-btn-confirm"
            onClick={handleConfirm}
            disabled={!selected || loading}
          >
            {loading ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
