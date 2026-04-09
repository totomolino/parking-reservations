import React, { useState } from 'react';
import api from '../api';
import './AssignModal.css'; // reuse same modal base styles

export default function SwapModal({ slots, onClose, onSwapped }) {
  const occupied = slots.filter(s => s.status !== 'available');
  const [slotA, setSlotA] = useState('');
  const [slotB, setSlotB] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSwap = async () => {
    if (!slotA || !slotB || slotA === slotB) return;
    setLoading(true);
    try {
      await api.post('/admin/swap', { slotA: Number(slotA), slotB: Number(slotB) });
      onSwapped();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Swap failed');
    } finally {
      setLoading(false);
    }
  };

  const slotLabel = (s) => `Slot ${s.number} — ${s.assignedTo}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Swap Slots</h3>
        <p className="modal-subtitle">Pick two occupied slots to swap their occupants.</p>

        <div className="swap-selects">
          <div className="swap-select-group">
            <label className="swap-label">Slot A</label>
            <select
              className="modal-input"
              value={slotA}
              onChange={e => setSlotA(e.target.value)}
            >
              <option value="">Select a slot…</option>
              {occupied.map(s => (
                <option key={s.number} value={s.number}>{slotLabel(s)}</option>
              ))}
            </select>
          </div>

          <div className="swap-arrow">⇄</div>

          <div className="swap-select-group">
            <label className="swap-label">Slot B</label>
            <select
              className="modal-input"
              value={slotB}
              onChange={e => setSlotB(e.target.value)}
            >
              <option value="">Select a slot…</option>
              {occupied
                .filter(s => String(s.number) !== slotA)
                .map(s => (
                  <option key={s.number} value={s.number}>{slotLabel(s)}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="modal-btn-confirm"
            onClick={handleSwap}
            disabled={!slotA || !slotB || slotA === slotB || loading}
          >
            {loading ? 'Swapping…' : 'Swap'}
          </button>
        </div>
      </div>
    </div>
  );
}
